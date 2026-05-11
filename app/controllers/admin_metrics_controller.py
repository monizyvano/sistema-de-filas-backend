"""
app/controllers/admin_metrics_controller.py
═══════════════════════════════════════════════════════════════
Controller de Métricas Administrativas

Rotas:
  GET  /api/admin/atendentes/metrics
       Lista todos os atendentes com métricas + score.

  GET  /api/admin/atendentes/metrics/<int:id>
       Métricas detalhadas de um atendente específico.

  GET  /api/admin/atendentes/top
       Top 3 do período (trabalhador do dia/semana/mês).

Autenticação:
  Todas as rotas requerem JWT + tipo 'admin'.

Query params suportados:
  ?data_inicio=YYYY-MM-DD   — início do período (opcional)
  ?data_fim=YYYY-MM-DD      — fim do período    (opcional)
  ?periodo=hoje|semana|mes  — atalho (sobrepõe data_inicio/data_fim)
  ?apenas_ativos=0|1        — default 1
═══════════════════════════════════════════════════════════════
"""

import logging
from datetime import date, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.atendente import Atendente
from app.services.metrics_service import (
    get_atendente_metrics,
    get_todos_atendentes_metrics,
    calcular_score,
    parse_date,
)

logger = logging.getLogger(__name__)

admin_metrics_bp = Blueprint("admin_metrics", __name__)


def _is_missing_table_error(exc: Exception) -> bool:
    """Detecta se o erro é a tabela avaliacoes não existir ainda (antes de flask db upgrade)."""
    msg = str(exc).lower()
    return "avaliacoes" in msg and any(
        kw in msg for kw in ("doesn't exist", "no such table", "does not exist")
    )


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _verificar_admin():
    """
    Verifica se o JWT pertence a um administrador.

    Returns:
        (Atendente, None) em caso de sucesso
        (None, response_json) se acesso negado
    """
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return None, (jsonify({"erro": "Token inválido."}), 401)

    user = Atendente.query.get(user_id)
    if not user or user.tipo != "admin":
        return None, (jsonify({"erro": "Acesso negado. Apenas administradores."}), 403)

    return user, None


def _resolver_periodo(periodo: str, data_de: str, data_ate: str):
    """
    Converte parâmetros de query em datas concretas.

    Prioridade: ?periodo > ?data_inicio/?data_fim

    Returns:
        (data_inicio: date | None, data_fim: date | None)

    Raises:
        ValueError — formato de data inválido
    """
    hoje = date.today()

    if periodo == "hoje":
        return hoje, hoje

    if periodo == "semana":
        inicio_semana = hoje - timedelta(days=hoje.weekday())
        return inicio_semana, hoje

    if periodo == "mes":
        return hoje.replace(day=1), hoje

    # Sem atalho — usar datas explícitas
    di = parse_date(data_de,  "data_inicio")
    df = parse_date(data_ate, "data_fim")
    return di, df


# ─────────────────────────────────────────────────────────────
# GET /api/admin/atendentes/metrics
# ─────────────────────────────────────────────────────────────

@admin_metrics_bp.route("/atendentes/metrics", methods=["GET"])
@jwt_required()
def listar_metricas():
    """
    GET /api/admin/atendentes/metrics

    Devolve lista de atendentes com métricas completas e score,
    ordenada por score descendente.

    Query params:
        periodo     — hoje | semana | mes
        data_inicio — YYYY-MM-DD  (usado se periodo não definido)
        data_fim    — YYYY-MM-DD  (usado se periodo não definido)
        apenas_ativos — 0 | 1 (default: 1)

    Resposta (200):
    [
      {
        "id": 2,
        "nome": "João da Silva",
        "email": "joao@imtsb.ao",
        "balcao": 1,
        "tipo": "atendente",
        "ativo": true,
        "departamento": "Secretaria Académica",
        "avaliacao_media": 4.2,
        "avaliacoes_total": 18,
        "total_atendimentos": 45,
        "atendimentos_concluidos": 40,
        "taxa_conclusao": 88.9,
        "tempo_medio": 9.5,
        "redirecionamentos": 2,
        "score": 76.4
      },
      ...
    ]
    """
    _, erro = _verificar_admin()
    if erro:
        return erro

    # ── Parâmetros de query ──────────────────────────────────
    periodo    = request.args.get("periodo", "").strip().lower()
    data_de    = request.args.get("data_inicio", "").strip()
    data_ate   = request.args.get("data_fim",    "").strip()
    so_ativos  = request.args.get("apenas_ativos", "1") != "0"

    # ── Resolver datas ───────────────────────────────────────
    try:
        data_inicio, data_fim = _resolver_periodo(periodo, data_de, data_ate)
    except ValueError as err:
        return jsonify({"erro": str(err)}), 400

    # ── Calcular métricas ────────────────────────────────────
    try:
        lista = get_todos_atendentes_metrics(
            data_inicio=data_inicio,
            data_fim=data_fim,
            apenas_ativos=so_ativos,
            apenas_atendentes=True,
        )
    except Exception as exc:
        if _is_missing_table_error(exc):
            return jsonify({"erro": "Métricas indisponíveis: execute flask db upgrade para criar tabela avaliacoes."}), 503
        logger.error("Erro ao calcular métricas: %s", exc, exc_info=True)
        return jsonify({"erro": "Erro interno ao calcular métricas."}), 500

    return jsonify(lista), 200


# ─────────────────────────────────────────────────────────────
# GET /api/admin/atendentes/metrics/<id>
# ─────────────────────────────────────────────────────────────

@admin_metrics_bp.route("/atendentes/metrics/<int:atendente_id>", methods=["GET"])
@jwt_required()
def metricas_atendente(atendente_id: int):
    """
    GET /api/admin/atendentes/metrics/<id>

    Métricas detalhadas de um atendente específico.

    Resposta (200):
    {
      "id": 2,
      "nome": "João da Silva",
      "avaliacao_media": 4.2,
      "avaliacoes_total": 18,
      "total_atendimentos": 45,
      "atendimentos_concluidos": 40,
      "taxa_conclusao": 88.9,
      "tempo_medio": 9.5,
      "redirecionamentos": 2,
      "score": 76.4
    }
    """
    _, erro = _verificar_admin()
    if erro:
        return erro

    # ── Verificar se atendente existe ────────────────────────
    atendente = Atendente.query.get(atendente_id)
    if not atendente:
        return jsonify({"erro": f"Atendente {atendente_id} não encontrado."}), 404

    # ── Parâmetros de período ────────────────────────────────
    periodo  = request.args.get("periodo", "").strip().lower()
    data_de  = request.args.get("data_inicio", "").strip()
    data_ate = request.args.get("data_fim",    "").strip()

    try:
        data_inicio, data_fim = _resolver_periodo(periodo, data_de, data_ate)
    except ValueError as err:
        return jsonify({"erro": str(err)}), 400

    # ── Calcular métricas ────────────────────────────────────
    try:
        metricas = get_atendente_metrics(atendente_id, data_inicio, data_fim)
        score    = calcular_score(metricas)
    except Exception as exc:
        if _is_missing_table_error(exc):
            return jsonify({"erro": "Métricas indisponíveis: execute flask db upgrade para criar tabela avaliacoes."}), 503
        logger.error(
            "Erro métricas atendente %s: %s", atendente_id, exc, exc_info=True
        )
        return jsonify({"erro": "Erro interno ao calcular métricas."}), 500

    return jsonify({
        "id":          atendente.id,
        "nome":        atendente.nome,
        "email":       atendente.email,
        "balcao":      atendente.balcao,
        "tipo":        atendente.tipo,
        "ativo":       atendente.ativo,
        "departamento": (
            atendente.servico.nome if atendente.servico else "Geral"
        ),
        **metricas,
        "score": score,
    }), 200


# ─────────────────────────────────────────────────────────────
# GET /api/admin/atendentes/top
# ─────────────────────────────────────────────────────────────

@admin_metrics_bp.route("/atendentes/top", methods=["GET"])
@jwt_required()
def top_atendentes():
    """
    GET /api/admin/atendentes/top

    Devolve os 3 melhores atendentes do período por score.

    Query params:
        periodo     — hoje | semana | mes  (default: hoje)
        n           — quantos lugares (default: 3, máx: 10)

    Resposta (200):
    {
      "periodo": "hoje",
      "data_inicio": "2026-05-04",
      "data_fim":    "2026-05-04",
      "top": [
        { "lugar": 1, "id": 2, "nome": "João", "score": 82.3, ... },
        { "lugar": 2, "id": 3, "nome": "Maria", "score": 74.1, ... },
        { "lugar": 3, "id": 4, "nome": "Paulo", "score": 68.9, ... }
      ]
    }
    """
    _, erro = _verificar_admin()
    if erro:
        return erro

    periodo  = request.args.get("periodo", "hoje").strip().lower()
    data_de  = request.args.get("data_inicio", "").strip()
    data_ate = request.args.get("data_fim",    "").strip()
    n_top    = min(int(request.args.get("n", 3) or 3), 10)

    try:
        data_inicio, data_fim = _resolver_periodo(periodo, data_de, data_ate)
    except ValueError as err:
        return jsonify({"erro": str(err)}), 400

    try:
        lista = get_todos_atendentes_metrics(
            data_inicio=data_inicio,
            data_fim=data_fim,
            apenas_ativos=True,
            apenas_atendentes=True,
        )
    except Exception as exc:
        if _is_missing_table_error(exc):
            return jsonify({"erro": "Métricas indisponíveis: execute flask db upgrade para criar tabela avaliacoes."}), 503
        logger.error("Erro top atendentes: %s", exc, exc_info=True)
        return jsonify({"erro": "Erro interno."}), 500

    com_score = [x for x in lista if x.get("score") is not None]
    top = [
        {"lugar": i + 1, **item}
        for i, item in enumerate(com_score[:n_top])
    ]

    return jsonify({
        "periodo":     periodo or "personalizado",
        "data_inicio": data_inicio.isoformat() if data_inicio else None,
        "data_fim":    data_fim.isoformat()    if data_fim    else None,
        "top":         top,
    }), 200
