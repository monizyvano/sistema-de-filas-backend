"""Controller: Snapshot em Tempo Real."""

import logging
from datetime import date, datetime

from app.models.atendente import Atendente
from app.models.log_actividade import LogActividade
from app.models.senha import Senha
from app.models.servico import Servico

logger = logging.getLogger(__name__)


def obter_snapshot(servico_id=None, data_str=None):
    try:
        data_ref = _parse_data(data_str)

        fila_q = Senha.query.filter(
            Senha.status.in_(["aguardando", "chamada", "chamando"]),
            Senha.data_emissao == data_ref,
        )
        if servico_id:
            fila_q = fila_q.filter_by(servico_id=servico_id)
        fila = fila_q.order_by(Senha.emitida_em.asc()).all()

        historico = Senha.query.filter(
            Senha.status.in_(["concluida", "cancelada"]),
            Senha.data_emissao == data_ref,
        ).order_by(Senha.atendimento_concluido_em.desc()).limit(50).all()

        ultimo_log = LogActividade.query.filter_by(acao="chamada").order_by(LogActividade.created_at.desc()).first()
        last_called = None
        if ultimo_log:
            senha_l = Senha.query.get(ultimo_log.senha_id) if ultimo_log.senha_id else None
            if senha_l:
                last_called = {
                    "code": senha_l.numero,
                    "service": senha_l.servico.nome if senha_l.servico else "",
                    "counterName": f"Balcão {senha_l.numero_balcao}" if senha_l.numero_balcao else "Balcão",
                    "at": ultimo_log.created_at.isoformat() if ultimo_log.created_at else None,
                }

        atendentes = Atendente.query.filter(
            Atendente.ativo.is_(True),
            Atendente.tipo.in_(["atendente", "admin"]),
        ).all()

        return {
            "ok": True,
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            "queue": [_senha_para_ticket(s) for s in fila],
            "history": [_senha_para_ticket(s) for s in historico],
            "lastCalled": last_called,
            "stats": _calcular_stats(data_ref),
            "users": [_atendente_dict(a) for a in atendentes],
        }, 200
    except Exception as exc:
        logger.error("Erro snapshot: %s", exc)
        return {
            "ok": False,
            "message": "Erro ao gerar snapshot.",
            "updatedAt": datetime.utcnow().isoformat() + "Z",
            "queue": [],
            "history": [],
            "lastCalled": None,
            "stats": {},
            "users": [],
        }, 500


def obter_fila_activa(servico_id=None, balcao=None):
    try:
        query = Senha.query.filter(
            Senha.status.in_(["aguardando", "chamada", "chamando"]),
            Senha.data_emissao == date.today(),
        )
        if servico_id:
            query = query.filter_by(servico_id=servico_id)
        if balcao:
            query = query.filter_by(numero_balcao=balcao)

        senhas = query.order_by(Senha.emitida_em.asc()).all()
        return {"ok": True, "queue": [_senha_para_ticket(s) for s in senhas], "total": len(senhas)}, 200
    except Exception as exc:
        logger.error("Erro fila: %s", exc)
        return {"ok": False, "message": "Erro.", "queue": [], "total": 0}, 500


def obter_estatisticas(data_str=None):
    try:
        data_ref = _parse_data(data_str)
        stats = _calcular_stats(data_ref)
        stats.update({"ok": True, "data": data_ref.isoformat()})
        return stats, 200
    except Exception as exc:
        logger.error("Erro stats: %s", exc)
        return {"ok": False, "message": "Erro."}, 500


def _parse_data(data_str):
    if not data_str:
        return date.today()
    try:
        return date.fromisoformat(data_str)
    except ValueError:
        return date.today()


def _senha_para_ticket(s):
    servico_nome = s.servico.nome if s.servico else ""
    atendente_nome = s.atendente.nome if s.atendente else None
    return {
        "id": s.id,
        "code": s.numero,
        "service": servico_nome,
        "type": s.tipo,
        "status": {
            "aguardando": "aguardando",
            "chamada": "em_atendimento",
            "chamando": "em_atendimento",
            "atendendo": "em_atendimento",
            "concluida": "concluido",
            "cancelada": "cancelado",
        }.get(s.status, s.status),
        "department": _servico_departamento(servico_nome),
        "counterNumber": s.numero_balcao,
        "counterName": f"Balcão {s.numero_balcao}" if s.numero_balcao else "Balcão",
        "userName": s.usuario_contato or "Visitante",
        "userEmail": s.usuario_contato or "",
        "attendedBy": atendente_nome,
        "notes": s.observacoes or "",
        "rating": _rating(s),
        "attachments": [],
        "createdAt": s.emitida_em.isoformat() if s.emitida_em else None,
        "calledAt": s.chamada_em.isoformat() if s.chamada_em else None,
        "completedAt": s.atendimento_concluido_em.isoformat() if s.atendimento_concluido_em else None,
        "tempo_espera_minutos": s.tempo_espera_minutos,
        "serviceDurationSec": (s.tempo_atendimento_minutos or 0) * 60,
        "receipt": _recibo(s) if s.status == "concluida" else None,
    }


def _rating(s):
    nota = getattr(s, "avaliacao_nota", None)
    if nota is None:
        return None
    aval_em = getattr(s, "avaliacao_em", None)
    return {
        "score": nota,
        "comment": getattr(s, "avaliacao_comentario", "") or "",
        "at": aval_em.isoformat() if aval_em else None,
    }


def _recibo(s):
    atendente = s.atendente.nome if s.atendente else "Atendente"
    servico = s.servico.nome if s.servico else ""
    return {
        "fileName": f"recibo_{s.numero}.txt",
        "format": "txt",
        "mimeType": "text/plain;charset=utf-8",
        "content": (
            "Instituto Médio Técnico São Benedito\nRecibo de Atendimento\n"
            f"Senha: {s.numero}\nServiço: {servico}\nAtendido por: {atendente}\n"
            f"Emissão: {s.emitida_em}\nConclusão: {s.atendimento_concluido_em}\n"
            f"Observações: {s.observacoes or 'Sem observações'}\n"
        ),
    }


def _servico_departamento(nome):
    n = (nome or "").lower()
    if any(k in n for k in ("matr", "reconf", "declar", "secretar")):
        return "Secretaria Académica"
    if any(k in n for k in ("tesour", "propina", "pagam", "contabil")):
        return "Tesouraria"
    return "Apoio ao Cliente"


def _atendente_dict(a):
    mapa = {1: "Secretaria Académica", 2: "Tesouraria", 3: "Apoio ao Cliente"}
    return {
        "id": str(a.id),
        "name": a.nome,
        "email": a.email,
        "role": a.tipo,
        "balcao": a.balcao,
        "department": mapa.get(a.balcao, "Não atribuído"),
    }


def _calcular_stats(data_ref):
    try:
        base = Senha.query.filter_by(data_emissao=data_ref)
        total = base.count()
        aguardando = base.filter(Senha.status == "aguardando").count()
        em_atend = base.filter(Senha.status.in_(["chamada", "chamando", "atendendo"])).count()
        concluidas = base.filter(Senha.status == "concluida").count()
        canceladas = base.filter(Senha.status == "cancelada").count()

        def media(vals):
            return round(sum(vals) / len(vals), 1) if vals else 0

        te = [s.tempo_espera_minutos for s in base.filter(
            Senha.status == "concluida", Senha.tempo_espera_minutos.isnot(None)).all()]
        ta = [s.tempo_atendimento_minutos for s in base.filter(
            Senha.status == "concluida", Senha.tempo_atendimento_minutos.isnot(None)).all()]

        por_servico = []
        for sv in Servico.query.filter_by(ativo=True).all():
            t = base.filter_by(servico_id=sv.id).count()
            c = base.filter(Senha.servico_id == sv.id, Senha.status == "concluida").count()
            if t > 0:
                por_servico.append({"servico": sv.nome, "total": t, "concluidas": c})

        por_atendente = []
        for at in Atendente.query.filter(Atendente.ativo.is_(True), Atendente.tipo == "atendente").all():
            senhas_at = base.filter(Senha.atendente_id == at.id, Senha.status == "concluida").all()
            if senhas_at:
                tms = [s.tempo_atendimento_minutos for s in senhas_at if s.tempo_atendimento_minutos]
                por_atendente.append({"nome": at.nome, "atendidos": len(senhas_at), "tempo_medio_min": media(tms)})

        return {
            "total_emitidas": total,
            "em_espera": aguardando,
            "em_atendimento": em_atend,
            "concluidas": concluidas,
            "canceladas": canceladas,
            "tempo_medio_espera_min": media(te),
            "tempo_medio_atendimento_min": media(ta),
            "por_servico": por_servico,
            "por_atendente": por_atendente,
        }
    except Exception as exc:
        logger.error("Erro stats: %s", exc)
        return {
            "total_emitidas": 0,
            "em_espera": 0,
            "em_atendimento": 0,
            "concluidas": 0,
            "canceladas": 0,
            "tempo_medio_espera_min": 0,
            "tempo_medio_atendimento_min": 0,
            "por_servico": [],
            "por_atendente": [],
        }
