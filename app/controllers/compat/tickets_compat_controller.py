"""Controller: Tickets (Compatibilidade)."""

import logging
from datetime import datetime, date

from app.extensions import db
from app.models.log_actividade import LogActividade
from app.models.senha import Senha
from app.models.servico import Servico
from app.services.fila_service import FilaService

logger = logging.getLogger(__name__)


def emitir_ticket(dados):
    nome_servico = str(dados.get("service", "")).strip()
    if not nome_servico:
        return {"ok": False, "message": "Campo 'service' obrigatório."}, 400
    return _emitir_directo(dados)


def _emitir_directo(dados):
    try:
        nome_servico = str(dados.get("service", "")).strip()
        servico = Servico.query.filter(
            Servico.nome.ilike(f"%{nome_servico}%"),
            Servico.ativo.is_(True),
        ).first()
        if not servico:
            return {"ok": False, "message": f"Serviço '{nome_servico}' não encontrado."}, 404

        prefixo = "P" if _e_prior(nome_servico) else "N"
        hoje = date.today()
        contagem = Senha.query.filter(
            Senha.data_emissao == hoje,
            Senha.numero.like(f"{prefixo}%"),
        ).count()
        numero = f"{prefixo}{contagem + 1:03d}"

        senha = Senha(
            numero=numero,
            servico_id=servico.id,
            tipo="prioritaria" if prefixo == "P" else "normal",
            usuario_contato=dados.get("userEmail") or dados.get("userName", "Visitante"),
            data_emissao=hoje,
        )
        db.session.add(senha)
        db.session.flush()
        db.session.add(LogActividade(
            senha_id=senha.id,
            acao="emitida",
            descricao=f"Senha {numero} emitida para {servico.nome}",
        ))
        db.session.commit()
        return {"ok": True, "ticket": _ticket(senha, servico.nome, dados)}, 201
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro emitir: %s", exc)
        return {"ok": False, "message": "Erro interno."}, 500


def chamar_proximo(dados):
    try:
        servico_id = dados.get("servico_id")
        atendente_id = dados.get("attendant_id") or dados.get("atendente_id")
        numero_balcao = dados.get("numero_balcao")
        if not numero_balcao:
            return {"ok": False, "message": "numero_balcao é obrigatório."}, 400

        senha = FilaService.chamar_proxima(servico_id=servico_id, atendente_id=atendente_id or 0, numero_balcao=numero_balcao)
        if not senha:
            return {"ok": False, "message": "Não há senhas na fila."}, 404

        db.session.add(LogActividade(
            senha_id=senha.id,
            atendente_id=atendente_id,
            acao="chamada",
            descricao=f"Senha {senha.numero} chamada no balcão {numero_balcao}",
        ))
        db.session.commit()
        return {"ok": True, "ticket": _ticket(senha, senha.servico.nome if senha.servico else "")}, 200
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro chamar: %s", exc)
        return {"ok": False, "message": "Erro interno."}, 500


def iniciar_atendimento(dados):
    ticket_id = dados.get("ticket_id")
    if not ticket_id:
        return {"ok": False, "message": "ticket_id obrigatório."}, 400
    try:
        s = Senha.query.get(ticket_id)
        if not s:
            return {"ok": False, "message": "Senha não encontrada."}, 404
        s.atendimento_iniciado_em = datetime.utcnow()
        s.status = "atendendo"
        if dados.get("attendant_id"):
            s.atendente_id = dados["attendant_id"]
        db.session.add(LogActividade(senha_id=s.id, atendente_id=dados.get("attendant_id"), acao="iniciada", descricao=f"Atendimento {s.numero} iniciado"))
        db.session.commit()
        return {"ok": True, "ticket": _ticket(s, s.servico.nome if s.servico else "")}, 200
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro iniciar: %s", exc)
        return {"ok": False, "message": "Erro interno."}, 500


def concluir_atendimento(dados):
    ticket_id = dados.get("ticket_id")
    if not ticket_id:
        return {"ok": False, "message": "ticket_id obrigatório."}, 400
    return _concluir_directo(dados)


def _concluir_directo(dados):
    try:
        s = Senha.query.get(dados["ticket_id"])
        if not s:
            return {"ok": False, "message": "Senha não encontrada."}, 404
        s.status = "concluida"
        s.atendimento_concluido_em = datetime.utcnow()
        s.observacoes = dados.get("observacoes", "")
        duracao = dados.get("duracao_seg", 0) or 0
        s.tempo_atendimento_minutos = max(1, int(duracao // 60)) if duracao else s.tempo_atendimento_minutos
        if s.chamada_em and s.emitida_em:
            s.tempo_espera_minutos = max(0, int((s.chamada_em - s.emitida_em).total_seconds() / 60))
        db.session.add(LogActividade(senha_id=s.id, atendente_id=dados.get("attendant_id"), acao="concluida", descricao=f"Atendimento {s.numero} concluído"))
        db.session.commit()
        nome = s.servico.nome if s.servico else ""
        return {
            "ok": True,
            "ticket": _ticket(s, nome),
            "receipt": {
                "fileName": f"recibo_{s.numero}.txt",
                "format": "txt",
                "content": _recibo_txt(s, nome),
            },
        }, 200
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro concluir: %s", exc)
        return {"ok": False, "message": "Erro interno."}, 500


def reencaminhar_ticket(dados):
    ticket_id = dados.get("ticket_id")
    destino = str(dados.get("servico_destino", "")).strip()
    if not ticket_id or not destino:
        return {"ok": False, "message": "ticket_id e servico_destino são obrigatórios."}, 400
    try:
        s = Senha.query.get(ticket_id)
        if not s:
            return {"ok": False, "message": "Senha não encontrada."}, 404
        sv = Servico.query.filter(Servico.nome.ilike(f"%{destino}%"), Servico.ativo.is_(True)).first()
        s.status = "aguardando"
        s.chamada_em = None
        s.atendente_id = None
        s.observacoes = f"Reencaminhado: {dados.get('motivo', '')}"
        if sv:
            s.servico_id = sv.id
        db.session.add(LogActividade(senha_id=s.id, atendente_id=dados.get("attendant_id"), acao="reencaminhada", descricao=f"Senha {s.numero} → {destino}"))
        db.session.commit()
        return {"ok": True, "ticket": _ticket(s, destino)}, 200
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro reencaminhar: %s", exc)
        return {"ok": False, "message": "Erro interno."}, 500


def adicionar_nota(dados):
    ticket_id = dados.get("ticket_id")
    nota = str(dados.get("note", "")).strip()
    if not ticket_id:
        return {"ok": False, "message": "ticket_id obrigatório."}, 400
    try:
        s = Senha.query.get(ticket_id)
        if not s:
            return {"ok": False, "message": "Senha não encontrada."}, 404
        s.observacoes = nota
        db.session.add(LogActividade(senha_id=s.id, atendente_id=dados.get("attendant_id"), acao="nota_adicionada", descricao=f"Nota adicionada à senha {s.numero}"))
        db.session.commit()
        return {"ok": True, "ticket": {"id": s.id, "code": s.numero, "observacoes": nota}}, 200
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro nota: %s", exc)
        return {"ok": False, "message": "Erro interno."}, 500


def marcar_recebido(dados):
    ticket_id = dados.get("ticket_id")
    if not ticket_id:
        return {"ok": False, "message": "ticket_id obrigatório."}, 400
    try:
        s = Senha.query.get(ticket_id)
        if not s:
            return {"ok": False, "message": "Senha não encontrada."}, 404
        if hasattr(s, "recebida_em"):
            s.recebida_em = datetime.utcnow()
        db.session.add(LogActividade(senha_id=s.id, acao="recebida", descricao=f"Utente confirmou chamada da senha {s.numero}"))
        db.session.commit()
        return {"ok": True, "ticket": {"id": s.id, "code": s.numero, "recebida_em": datetime.utcnow().isoformat()}}, 200
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro recebido: %s", exc)
        return {"ok": False, "message": "Erro interno."}, 500


def avaliar_atendimento(dados):
    ticket_id = dados.get("ticket_id")
    if not ticket_id:
        return {"ok": False, "message": "ticket_id obrigatório."}, 400
    try:
        score = int(dados.get("score", 0))
        if not 1 <= score <= 5:
            raise ValueError
    except (TypeError, ValueError):
        return {"ok": False, "message": "score deve ser inteiro entre 1 e 5."}, 400

    try:
        s = Senha.query.get(ticket_id)
        if not s:
            return {"ok": False, "message": "Senha não encontrada."}, 404
        if s.status != "concluida":
            return {"ok": False, "message": "Só é possível avaliar atendimentos concluídos."}, 422

        if hasattr(s, "avaliacao_nota"):
            s.avaliacao_nota = score
        if hasattr(s, "avaliacao_comentario"):
            s.avaliacao_comentario = str(dados.get("comment", "")).strip()[:500]
        if hasattr(s, "avaliacao_em"):
            s.avaliacao_em = datetime.utcnow()

        db.session.add(LogActividade(senha_id=s.id, acao="avaliada", descricao=f"Senha {s.numero} avaliada com nota {score}"))
        db.session.commit()
        return {
            "ok": True,
            "ticket": {
                "id": s.id,
                "code": s.numero,
                "rating": {
                    "score": score,
                    "comment": dados.get("comment", ""),
                    "at": datetime.utcnow().isoformat(),
                },
            },
        }, 200
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro avaliar: %s", exc)
        return {"ok": False, "message": "Erro interno."}, 500


def _e_prior(nome):
    return "declar" in (nome or "").lower() or "prior" in (nome or "").lower()


def _ticket(s, servico_nome="", extra=None):
    extra = extra or {}
    return {
        "id": s.id,
        "code": s.numero,
        "service": servico_nome,
        "type": s.tipo,
        "status": s.status,
        "userName": extra.get("userName") or s.usuario_contato or "Visitante",
        "userEmail": extra.get("userEmail") or s.usuario_contato or "",
        "notificationEmail": extra.get("notificationEmail", ""),
        "attendedBy": s.atendente.nome if s.atendente else None,
        "notes": s.observacoes or "",
        "createdAt": s.emitida_em.isoformat() if s.emitida_em else None,
        "calledAt": s.chamada_em.isoformat() if s.chamada_em else None,
        "completedAt": s.atendimento_concluido_em.isoformat() if s.atendimento_concluido_em else None,
        "serviceDurationSec": (s.tempo_atendimento_minutos or 0) * 60,
        "counterName": f"Balcão {s.numero_balcao}" if s.numero_balcao else "Balcão",
        "attachments": [],
        "rating": None,
    }


def _recibo_txt(s, servico_nome):
    atendente = s.atendente.nome if s.atendente else "Atendente"
    return (
        "Instituto Médio Técnico São Benedito\nRecibo de Atendimento\n"
        f"{'─' * 38}\n"
        f"Senha       : {s.numero}\nServiço     : {servico_nome}\n"
        f"Atendido por: {atendente}\nEmissão     : {s.emitida_em}\n"
        f"Conclusão   : {s.atendimento_concluido_em}\n"
        f"Duração     : {s.tempo_atendimento_minutos or 0} minutos\n"
        f"Observações : {s.observacoes or 'Sem observações'}\n"
        f"{'─' * 38}\nObrigado pela sua visita ao IMTSB!\n"
    )
