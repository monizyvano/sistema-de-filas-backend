"""
Controlador de tickets (senhas) — camada de compatibilidade frontend
Sistema de Filas IMTSB

Expõe os endpoints /api/tickets/* no formato que o frontend demo espera.

Correcções aplicadas:
  P1 — Mapeamento de status ("atendendo"/"chamada" → "em_atendimento", "concluida" → "concluido")
  P2 — ticket id serializado como string
  P3 — counterName completo ("Balcão 1 - Secretaria Académica")
"""

from datetime import datetime, date
from flask import request, jsonify, g
from flask_jwt_extended import get_jwt_identity

from app.extensions import db
from app.models.atendente import Atendente
from app.models.senha import Senha
from app.models.servico import Servico
from app.models.log_actividade import LogActividade
from app.services.fila_service import FilaService


# ──────────────────────────────────────────────
# HELPERS PARTILHADOS COM snapshot_controller
# ──────────────────────────────────────────────

_STATUS_MAP = {
    "aguardando": "aguardando",
    "chamada":    "em_atendimento",
    "chamando":   "em_atendimento",
    "atendendo":  "em_atendimento",
    "iniciada":   "em_atendimento",
    "concluida":  "concluido",
    "concluída":  "concluido",
    "cancelada":  "cancelada",
}

_SERVICO_BALCAO = {
    1: "Secretaria Académica",
    2: "Tesouraria",
    3: "Direcção Pedagógica",
    4: "Biblioteca",
    5: "Apoio ao Cliente",
}

_SERVICO_NOME_PARA_ID = {
    "secretaria academica":  1,
    "secretaria académica":  1,
    "matricula":             1,
    "matrícula":             1,
    "reconfirmacao":         1,
    "reconfirmação":         1,
    "pedido de declaracao":  1,
    "pedido de declaração":  1,
    "tesouraria":            2,
    "direccao pedagogica":   3,
    "direcção pedagógica":   3,
    "biblioteca":            4,
    "apoio ao cliente":      5,
}


def _mapear_status(status_bd):
    """Converte status da BD para valor esperado pelo frontend."""
    return _STATUS_MAP.get(str(status_bd or "").lower(), str(status_bd or ""))


def _counter_name(numero_balcao, servico_id=None, servico_nome=None):
    """Constrói nome completo do balcão."""
    if not numero_balcao:
        return "Balcão"
    nome = servico_nome or _SERVICO_BALCAO.get(servico_id, "")
    return f"Balcão {numero_balcao} - {nome}" if nome else f"Balcão {numero_balcao}"


def _ticket(s):
    """
    Serializa uma Senha para o formato ticket do frontend.
    P1 — status mapeado
    P2 — id como string
    P3 — counterName completo
    """
    servico_id   = getattr(s, "servico_id", None)
    servico_nome = ""
    if hasattr(s, "servico") and s.servico:
        servico_nome = s.servico.nome
    elif servico_id:
        servico_nome = _SERVICO_BALCAO.get(servico_id, "")

    atendido_por = None
    if getattr(s, "atendente_id", None):
        at = db.session.get(Atendente, s.atendente_id)
        atendido_por = at.nome if at else None

    rating = None
    if getattr(s, "avaliacao_nota", None) is not None:
        rating = {
            "score":   s.avaliacao_nota,
            "comment": getattr(s, "avaliacao_comentario", "") or "",
            "at":      s.avaliacao_em.isoformat() if getattr(s, "avaliacao_em", None) else None,
        }

    return {
        "id":                str(s.id),                     # P2
        "code":              s.numero,
        "service":           servico_nome,
        "userName":          getattr(s, "usuario_contato", "") or "",
        "userEmail":         getattr(s, "usuario_contato", "") or "",
        "notificationEmail": getattr(s, "usuario_contato", "") or "",
        "serviceForm":       {},
        "status":            _mapear_status(s.status),      # P1
        "type":              s.tipo if s.tipo else "normal",
        "counterName":       _counter_name(                 # P3
                                 getattr(s, "numero_balcao", None),
                                 servico_id,
                                 servico_nome,
                             ),
        "createdAt":         s.emitida_em.isoformat() if s.emitida_em else s.created_at.isoformat(),
        "calledAt":          s.chamada_em.isoformat() if getattr(s, "chamada_em", None) else None,
        "completedAt":       s.atendimento_concluido_em.isoformat() if getattr(s, "atendimento_concluido_em", None) else None,
        "attendedBy":        atendido_por,
        "notes":             getattr(s, "observacoes", "") or "",
        "rating":            rating,
        "attachments":       [],
        "serviceDurationSec": getattr(s, "tempo_atendimento_minutos", 0) or 0,
    }


def _resolver_servico(nome_servico):
    """Resolve nome de serviço (string) para servico_id."""
    chave = str(nome_servico or "").strip().lower()

    # Procura directa pelo nome normalizado
    sid = _SERVICO_NOME_PARA_ID.get(chave)
    if sid:
        return sid

    # Procura na BD por nome aproximado
    sv = Servico.query.filter(
        Servico.nome.ilike(f"%{nome_servico}%"),
        Servico.ativo == True
    ).first()
    if sv:
        return sv.id

    return 1  # fallback: Secretaria Académica


def _log(acao, senha_id=None, atendente_id=None, descricao=""):
    """Regista uma entrada no log de actividades."""
    try:
        entrada = LogActividade(
            acao=acao,
            senha_id=senha_id,
            atendente_id=atendente_id,
            descricao=descricao,
        )
        db.session.add(entrada)
        db.session.commit()
    except Exception:
        db.session.rollback()


# ──────────────────────────────────────────────
# EMITIR SENHA
# ──────────────────────────────────────────────

def emitir_ticket():
    """
    POST /api/tickets
    Body (frontend): { service, userName, userEmail, notificationEmail,
                       serviceForm, attachments }
    """
    dados = request.get_json(force=True) or {}

    service_name  = dados.get("service", "")
    user_email    = dados.get("userEmail", "") or dados.get("notificationEmail", "")
    servico_id    = _resolver_servico(service_name)
    tipo          = "prioritaria" if "declaracao" in service_name.lower() else "normal"

    # Número da senha: contar senhas do dia para este serviço
    hoje = date.today()
    prefixo = "P" if tipo == "prioritaria" else "N"
    contagem = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.tipo == tipo,
        Senha.servico_id == servico_id,
    ).count()
    numero = f"{prefixo}{str(contagem + 1).zfill(3)}"

    # Número de balcão baseado no serviço
    balcoes = {1: 1, 2: 2, 3: 1, 4: 1, 5: 3}
    balcao = balcoes.get(servico_id, 1)

    nova_senha = Senha(
        numero=numero,
        data_emissao=hoje,
        tipo=tipo,
        status="aguardando",
        servico_id=servico_id,
        numero_balcao=balcao,
        usuario_contato=user_email,
        emitida_em=datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.session.add(nova_senha)
    db.session.commit()

    servico_obj = db.session.get(Servico, servico_id)
    servico_nome = servico_obj.nome if servico_obj else _SERVICO_BALCAO.get(servico_id, "")

    _log("emitida", nova_senha.id, None,
         f"Senha {numero} emitida para {servico_nome}")

    return jsonify({"ok": True, "ticket": _ticket(nova_senha)}), 201


# ──────────────────────────────────────────────
# CHAMAR PRÓXIMA SENHA
# ──────────────────────────────────────────────

def chamar_proximo():
    """
    POST /api/tickets/call-next
    Body: { servico_id, numero_balcao, attendant_id }
    """
    dados         = request.get_json(force=True) or {}
    servico_id    = dados.get("servico_id", 1)
    numero_balcao = dados.get("numero_balcao", 1)
    attendant_id  = dados.get("attendant_id")

    # Usar FilaService se disponível
    try:
        resultado = FilaService.chamar_proxima(
            servico_id=servico_id,
            numero_balcao=numero_balcao,
            atendente_id=attendant_id,
        )
        if resultado and resultado.get("senha"):
            s = db.session.get(Senha, resultado["senha"].id)
            if s:
                _log("chamada", s.id, attendant_id,
                     f"Senha {s.numero} chamada no balcão {numero_balcao}")
                return jsonify({"ok": True, "ticket": _ticket(s)}), 200
    except Exception:
        pass

    # Fallback manual
    hoje = date.today()
    proxima = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.status == "aguardando",
        Senha.servico_id == servico_id,
    ).order_by(
        # Prioritárias primeiro
        (Senha.tipo != "prioritaria").asc(),
        Senha.emitida_em.asc()
    ).first()

    if not proxima:
        return jsonify({"ok": False, "message": "Não há senhas aguardando"}), 200

    proxima.status       = "atendendo"
    proxima.chamada_em   = datetime.utcnow()
    proxima.atendente_id = attendant_id
    proxima.numero_balcao = numero_balcao
    proxima.updated_at   = datetime.utcnow()
    db.session.commit()

    _log("chamada", proxima.id, attendant_id,
         f"Senha {proxima.numero} chamada no balcão {numero_balcao}")

    return jsonify({"ok": True, "ticket": _ticket(proxima)}), 200


# ──────────────────────────────────────────────
# INICIAR ATENDIMENTO
# ──────────────────────────────────────────────

def iniciar_atendimento():
    """POST /api/tickets/start"""
    dados     = request.get_json(force=True) or {}
    ticket_id = dados.get("ticket_id")
    if not ticket_id:
        return jsonify({"erro": "ticket_id obrigatório"}), 400

    s = db.session.get(Senha, int(ticket_id))
    if not s:
        return jsonify({"erro": "Senha não encontrada"}), 404

    s.status     = "atendendo"
    s.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"ok": True, "ticket": _ticket(s)}), 200


# ──────────────────────────────────────────────
# CONCLUIR ATENDIMENTO
# ──────────────────────────────────────────────

def concluir_atendimento():
    """
    POST /api/tickets/conclude
    Body: { ticket_id, attendant_id, observacoes, duracao_seg }
    """
    dados        = request.get_json(force=True) or {}
    ticket_id    = dados.get("ticket_id")
    observacoes  = dados.get("observacoes", "") or ""
    duracao_seg  = int(dados.get("duracao_seg", 0) or 0)
    attendant_id = dados.get("attendant_id")

    if not ticket_id:
        return jsonify({"erro": "ticket_id obrigatório"}), 400

    s = db.session.get(Senha, int(ticket_id))
    if not s:
        return jsonify({"erro": "Senha não encontrada"}), 404

    agora = datetime.utcnow()
    s.status                     = "concluida"
    s.atendimento_concluido_em   = agora
    s.observacoes                = observacoes
    s.tempo_atendimento_minutos  = round(duracao_seg / 60) if duracao_seg else 0
    s.updated_at                 = agora
    if attendant_id:
        s.atendente_id = attendant_id

    db.session.commit()

    # Nome do atendente para o recibo
    nome_atendente = "Atendente"
    if attendant_id:
        at = db.session.get(Atendente, attendant_id)
        nome_atendente = at.nome if at else "Atendente"

    servico_nome = ""
    sv = db.session.get(Servico, s.servico_id)
    if sv:
        servico_nome = sv.nome

    emitida_str  = s.emitida_em.strftime("%Y-%m-%d %H:%M:%S") if s.emitida_em else "—"
    concluida_str = agora.strftime("%Y-%m-%d %H:%M:%S")
    dur_min       = round(duracao_seg / 60) if duracao_seg else 0

    recibo_conteudo = (
        f"Instituto Médio Técnico São Benedito\n"
        f"Recibo de Atendimento\n"
        f"──────────────────────────────────────\n"
        f"Senha       : {s.numero}\n"
        f"Serviço     : {servico_nome}\n"
        f"Atendido por: {nome_atendente}\n"
        f"Emissão     : {emitida_str}\n"
        f"Conclusão   : {concluida_str}\n"
        f"Duração     : {dur_min} minutos\n"
        f"Observações : {observacoes or '—'}\n"
        f"──────────────────────────────────────\n"
        f"Obrigado pela sua visita ao IMTSB!\n"
    )

    _log("concluida", s.id, attendant_id,
         f"Senha {s.numero} concluída por {nome_atendente}")

    return jsonify({
        "ok": True,
        "ticket": _ticket(s),
        "receipt": {
            "fileName": f"recibo_{s.numero}.txt",
            "format":   "txt",
            "content":  recibo_conteudo,
        },
    }), 200


# ──────────────────────────────────────────────
# REENCAMINHAR
# ──────────────────────────────────────────────

def reencaminhar_ticket():
    """POST /api/tickets/redirect"""
    dados        = request.get_json(force=True) or {}
    ticket_id    = dados.get("ticket_id")
    notes        = dados.get("notes", "Reencaminhado") or "Reencaminhado"
    attendant_id = dados.get("attendant_id")

    if not ticket_id:
        return jsonify({"erro": "ticket_id obrigatório"}), 400

    s = db.session.get(Senha, int(ticket_id))
    if not s:
        return jsonify({"erro": "Senha não encontrada"}), 404

    s.status      = "aguardando"
    s.observacoes = notes
    s.chamada_em  = None
    s.updated_at  = datetime.utcnow()
    db.session.commit()

    _log("reencaminhada", s.id, attendant_id,
         f"Senha {s.numero} reencaminhada: {notes}")

    return jsonify({"ok": True, "ticket": _ticket(s)}), 200


# ──────────────────────────────────────────────
# ADICIONAR NOTA
# ──────────────────────────────────────────────

def adicionar_nota():
    """POST /api/tickets/note"""
    dados        = request.get_json(force=True) or {}
    ticket_id    = dados.get("ticket_id")
    note         = dados.get("note", "") or ""

    if not ticket_id:
        return jsonify({"erro": "ticket_id obrigatório"}), 400

    s = db.session.get(Senha, int(ticket_id))
    if not s:
        return jsonify({"erro": "Senha não encontrada"}), 404

    s.observacoes = note
    s.updated_at  = datetime.utcnow()
    db.session.commit()

    return jsonify({"ok": True, "ticket": _ticket(s)}), 200


# ──────────────────────────────────────────────
# MARCAR COMO RECEBIDA (visitante confirma presença)
# ──────────────────────────────────────────────

def marcar_recebido():
    """POST /api/tickets/received"""
    dados     = request.get_json(force=True) or {}
    ticket_id = dados.get("ticket_id")

    if not ticket_id:
        return jsonify({"erro": "ticket_id obrigatório"}), 400

    s = db.session.get(Senha, int(ticket_id))
    if not s:
        return jsonify({"erro": "Senha não encontrada"}), 404

    # Guardar timestamp de recepção se o modelo tiver o campo
    if hasattr(s, "recebida_em"):
        s.recebida_em = datetime.utcnow()
    s.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"ok": True, "ticket": _ticket(s)}), 200


# ──────────────────────────────────────────────
# AVALIAR ATENDIMENTO
# ──────────────────────────────────────────────

def avaliar_atendimento():
    """
    POST /api/tickets/rate  (não requer autenticação)
    Body: { ticket_id, user_email, score, comment }
    """
    dados     = request.get_json(force=True) or {}
    ticket_id = dados.get("ticket_id")
    score     = dados.get("score")
    comment   = dados.get("comment", "") or ""

    if not ticket_id:
        return jsonify({"erro": "ticket_id obrigatório"}), 400

    try:
        score = int(score)
        if score < 1 or score > 5:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"erro": "score deve ser um inteiro entre 1 e 5"}), 400

    s = db.session.get(Senha, int(ticket_id))
    if not s:
        return jsonify({"erro": "Senha não encontrada"}), 404

    agora = datetime.utcnow()
    if hasattr(s, "avaliacao_nota"):
        s.avaliacao_nota       = score
        s.avaliacao_comentario = comment
        s.avaliacao_em         = agora
    s.updated_at = agora
    db.session.commit()

    return jsonify({
        "ok": True,
        "ticket": {
            "id":     str(s.id),
            "code":   s.numero,
            "rating": {
                "score":   score,
                "comment": comment,
                "at":      agora.isoformat(),
            },
        },
    }), 200
