"""
Controlador de snapshot em tempo real — Sistema de Filas IMTSB
Serve o endpoint GET /api/realtime/snapshot

Correcções aplicadas:
  P1 — Mapeamento de status ("atendendo"/"chamada" → "em_atendimento", "concluida" → "concluido")
  P2 — ticket id serializado como string
  P3 — counterName completo ("Balcão 1 - Secretaria Académica")
  P4 — satisfacao_pct calculada + tempo_medio_espera (sem sufixo _min)
"""

from datetime import date, datetime
from sqlalchemy import func
from app.extensions import db
from app.models.atendente import Atendente
from app.models.senha import Senha
from app.models.servico import Servico


# ──────────────────────────────────────────────
# MAPEAMENTO DE STATUS  (P1)
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


def _mapear_status(status_bd):
    """Converte o status da BD para o valor que o frontend espera."""
    return _STATUS_MAP.get(str(status_bd or "").lower(), str(status_bd or ""))


# ──────────────────────────────────────────────
# MAPEAMENTO DE COUNTER NAME  (P3)
# ──────────────────────────────────────────────

_SERVICO_BALCAO = {
    1: "Secretaria Académica",
    2: "Tesouraria",
    3: "Direcção Pedagógica",
    4: "Biblioteca",
    5: "Apoio ao Cliente",
}


def _counter_name(numero_balcao, servico_id=None, servico_nome=None):
    """
    Constrói o nome completo do balcão.
    Exemplos:
      _counter_name(1, 1)  → "Balcão 1 - Secretaria Académica"
      _counter_name(None)  → "Balcão"
    """
    if not numero_balcao:
        return "Balcão"
    nome_servico = servico_nome or _SERVICO_BALCAO.get(servico_id, "")
    if nome_servico:
        return f"Balcão {numero_balcao} - {nome_servico}"
    return f"Balcão {numero_balcao}"


# ──────────────────────────────────────────────
# SERIALIZADOR DE SENHA  (P1 P2 P3)
# ──────────────────────────────────────────────

def _senha_para_ticket(s):
    """
    Converte um objecto Senha para o formato que o frontend espera.
    """
    # Nome do serviço
    servico_nome = ""
    servico_id   = getattr(s, "servico_id", None)
    if hasattr(s, "servico") and s.servico:
        servico_nome = s.servico.nome
    elif servico_id:
        servico_nome = _SERVICO_BALCAO.get(servico_id, "")

    # Atendente
    atendido_por = None
    if getattr(s, "atendente_id", None):
        at = db.session.get(Atendente, s.atendente_id)
        atendido_por = at.nome if at else None

    # Avaliação
    rating = None
    if getattr(s, "avaliacao_nota", None) is not None:
        rating = {
            "score":   s.avaliacao_nota,
            "comment": getattr(s, "avaliacao_comentario", "") or "",
            "at":      s.avaliacao_em.isoformat() if getattr(s, "avaliacao_em", None) else None,
        }

    return {
        "id":               str(s.id),                          # P2 — string
        "code":             s.numero,
        "service":          servico_nome,
        "userName":         getattr(s, "usuario_contato", "") or "",
        "userEmail":        getattr(s, "usuario_contato", "") or "",
        "notificationEmail": getattr(s, "usuario_contato", "") or "",
        "serviceForm":      {},
        "status":           _mapear_status(s.status),           # P1 — mapeado
        "type":             s.tipo if s.tipo else "normal",
        "counterName":      _counter_name(                      # P3 — completo
                                getattr(s, "numero_balcao", None),
                                servico_id,
                                servico_nome,
                            ),
        "createdAt":        s.emitida_em.isoformat() if s.emitida_em else s.created_at.isoformat(),
        "calledAt":         s.chamada_em.isoformat() if getattr(s, "chamada_em", None) else None,
        "completedAt":      s.atendimento_concluido_em.isoformat() if getattr(s, "atendimento_concluido_em", None) else None,
        "attendedBy":       atendido_por,
        "notes":            getattr(s, "observacoes", "") or "",
        "rating":           rating,
        "attachments":      [],
        "serviceDurationSec": getattr(s, "tempo_atendimento_minutos", 0) or 0,
    }


# ──────────────────────────────────────────────
# ATENDENTE DICT
# ──────────────────────────────────────────────

def _atendente_dict(a):
    """Serializa um Atendente para o formato que o frontend espera."""
    dept = _SERVICO_BALCAO.get(getattr(a, "balcao", None), "Não atribuído")
    # Mapear tipo BD → role frontend
    role = "admin" if a.tipo == "admin" else "trabalhador"
    return {
        "id":         str(a.id),
        "name":       a.nome,
        "email":      a.email,
        "role":       role,
        "department": dept,
        "balcao":     getattr(a, "balcao", None),
    }


# ──────────────────────────────────────────────
# CÁLCULO DE ESTATÍSTICAS  (P4)
# ──────────────────────────────────────────────

def _calcular_stats(hoje):
    """
    Devolve dicionário de estatísticas do dia para o frontend.
    Campos:
      total_emitidas, em_espera, em_atendimento, concluidas, canceladas,
      tempo_medio_espera, satisfacao_pct,
      por_servico, por_atendente
    """
    # Totais do dia
    total = Senha.query.filter(Senha.data_emissao == hoje).count()

    em_espera = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.status == "aguardando"
    ).count()

    # Status activos de "atendendo"
    em_atend = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.status.in_(["atendendo", "chamada", "chamando", "iniciada"])
    ).count()

    concluidas = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.status == "concluida"
    ).count()

    canceladas = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.status == "cancelada"
    ).count()

    # Tempo médio de espera (em minutos)
    tempo_medio_espera = 0
    try:
        resultado = db.session.query(
            func.avg(Senha.tempo_espera_minutos)
        ).filter(
            Senha.data_emissao == hoje,
            Senha.tempo_espera_minutos.isnot(None)
        ).scalar()
        tempo_medio_espera = round(float(resultado or 0), 1)
    except Exception:
        pass

    # Satisfação — P4
    satisfacao_pct = 0
    try:
        avg_nota = db.session.query(
            func.avg(Senha.avaliacao_nota)
        ).filter(
            Senha.data_emissao == hoje,
            Senha.avaliacao_nota.isnot(None)
        ).scalar()
        if avg_nota:
            satisfacao_pct = round((float(avg_nota) / 5.0) * 100)
    except Exception:
        pass

    # Por serviço
    por_servico = []
    try:
        servicos = Servico.query.filter_by(ativo=True).all()
        for sv in servicos:
            total_sv = Senha.query.filter(
                Senha.data_emissao == hoje,
                Senha.servico_id == sv.id
            ).count()
            if total_sv == 0:
                continue
            concl_sv = Senha.query.filter(
                Senha.data_emissao == hoje,
                Senha.servico_id == sv.id,
                Senha.status == "concluida"
            ).count()
            por_servico.append({
                "servico":    sv.nome,
                "total":      total_sv,
                "concluidas": concl_sv,
            })
    except Exception:
        pass

    return {
        "total_emitidas":     total,
        "em_espera":          em_espera,
        "em_atendimento":     em_atend,     # nome usado pelo frontend
        "concluidas":         concluidas,
        "canceladas":         canceladas,
        "tempo_medio_espera": tempo_medio_espera,   # P4 — sem sufixo _min
        "satisfacao_pct":     satisfacao_pct,        # P4 — novo campo
        "por_servico":        por_servico,
        "por_atendente":      [],
    }


# ──────────────────────────────────────────────
# FUNÇÕES PÚBLICAS
# ──────────────────────────────────────────────

def obter_snapshot():
    """
    Devolve snapshot completo: fila activa, histórico, users, lastCalled, stats.
    Chamado por GET /api/realtime/snapshot
    """
    hoje = date.today()

    # Fila activa — aguardando + em atendimento
    senhas_activas = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.status.in_(["aguardando", "atendendo", "chamada", "chamando", "iniciada"])
    ).order_by(Senha.emitida_em.asc()).all()

    # Histórico do dia — concluídas
    historico = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.status == "concluida"
    ).order_by(Senha.atendimento_concluido_em.desc()).limit(50).all()

    # Última senha chamada
    ultima = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.chamada_em.isnot(None)
    ).order_by(Senha.chamada_em.desc()).first()

    last_called = None
    if ultima:
        servico_nome = ""
        if hasattr(ultima, "servico") and ultima.servico:
            servico_nome = ultima.servico.nome
        elif ultima.servico_id:
            servico_nome = _SERVICO_BALCAO.get(ultima.servico_id, "")

        last_called = {
            "code":        ultima.numero,
            "service":     servico_nome,
            "counterName": _counter_name(
                               getattr(ultima, "numero_balcao", None),
                               ultima.servico_id,
                               servico_nome,
                           ),
            "at":          ultima.chamada_em.isoformat(),
        }

    # Atendentes activos
    atendentes = Atendente.query.filter_by(ativo=True).all()

    return {
        "queue":      [_senha_para_ticket(s) for s in senhas_activas],
        "history":    [_senha_para_ticket(s) for s in historico],
        "users":      [_atendente_dict(a) for a in atendentes],
        "lastCalled": last_called,
        "stats":      _calcular_stats(hoje),
    }


def obter_fila_activa(servico_id=None):
    """
    Devolve só a fila activa, com filtro opcional por serviço.
    Chamado por GET /api/queue
    """
    hoje = date.today()
    q = Senha.query.filter(
        Senha.data_emissao == hoje,
        Senha.status.in_(["aguardando", "atendendo", "chamada", "chamando", "iniciada"])
    )
    if servico_id:
        q = q.filter(Senha.servico_id == servico_id)
    senhas = q.order_by(Senha.emitida_em.asc()).all()
    return [_senha_para_ticket(s) for s in senhas]


def obter_estatisticas():
    """
    Devolve só as estatísticas do dia.
    Chamado por GET /api/stats
    """
    hoje = date.today()
    return _calcular_stats(hoje)
