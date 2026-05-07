"""
app/services/metrics_service.py
═══════════════════════════════════════════════════════════════
Serviço de Métricas por Atendente

Responsabilidades:
  - Calcular métricas individuais por atendente (com filtros de data)
  - Calcular score composto ponderado
  - Devolver ranking ordenado para o dashboard admin
  - Queries eficientes (sem N+1) usando GROUP BY + subqueries

Funções públicas:
  get_atendente_metrics(atendente_id, data_inicio, data_fim) → dict
  get_todos_atendentes_metrics(data_inicio, data_fim) → list[dict]
  calcular_score(metrics) → float

FÓRMULA DO SCORE (0–100):
  35% avaliação média (0–5 → 0–100)
  25% taxa de conclusão (%)
  20% total atendimentos (normalizado 0–100)
  12% tempo médio invertido (quanto menor, melhor)
  8%  redirecionamentos invertidos (quanto menos, melhor)
═══════════════════════════════════════════════════════════════
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Optional

from sqlalchemy import case, func, or_

from app.extensions import db
from app.models.atendente import Atendente
from app.models.avaliacao import Avaliacao
from app.models.senha import Senha

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
# CONSTANTES
# ─────────────────────────────────────────────────────────────

# Referência para normalizar "total_atendimentos" (= 100%)
_REF_MAX_ATENDIMENTOS = 50

# Tempo de referência em minutos (abaixo disto → pontuação máxima)
_TEMPO_IDEAL_MIN = 5
# Acima deste limite → pontuação zero no critério tempo
_TEMPO_MAXIMO_MIN = 40

# Score pesos
_PESOS = {
    "avaliacao":     0.35,
    "taxa":          0.25,
    "atendimentos":  0.20,
    "tempo":         0.12,
    "redir":         0.08,
}


# ─────────────────────────────────────────────────────────────
# FUNÇÃO PRINCIPAL — métricas de UM atendente
# ─────────────────────────────────────────────────────────────

def get_atendente_metrics(
    atendente_id: int,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
) -> dict:
    """
    Calcula métricas completas de um atendente num intervalo de datas.

    Args:
        atendente_id — ID do atendente
        data_inicio  — Data de início (inclusive). None = sem limite inferior
        data_fim     — Data de fim (inclusive).    None = sem limite superior

    Returns:
        {
          "avaliacao_media":    float,   # 0.0–5.0
          "avaliacoes_total":   int,     # quantas avaliações recebeu
          "total_atendimentos": int,     # total de senhas atribuídas
          "atendimentos_concluidos": int,
          "taxa_conclusao":     float,   # 0.0–100.0
          "tempo_medio":        float,   # minutos (só concluídas)
          "redirecionamentos":  int,
        }

    Raises:
        ValueError — se atendente_id não existir
    """
    # ── Filtros de data (aplicados a data_emissao) ──────────
    filtros_base = [Senha.atendente_id == atendente_id]
    if data_inicio:
        filtros_base.append(Senha.data_emissao >= data_inicio)
    if data_fim:
        filtros_base.append(Senha.data_emissao <= data_fim)

    # ── Consulta agregada principal (evita N+1) ─────────────
    resultado = db.session.query(
        func.count(Senha.id).label("total"),
        func.sum(
            case((Senha.status == "concluida", 1), else_=0)
        ).label("concluidas"),
        func.avg(
            case(
                (
                    (Senha.status == "concluida") &
                    (Senha.tempo_atendimento_minutos.isnot(None)),
                    Senha.tempo_atendimento_minutos
                ),
                else_=None
            )
        ).label("tempo_medio"),
        func.sum(
            # Redirecionamentos: observações contendo "REDIR:"
            case(
                (
                    (Senha.observacoes.isnot(None)) &
                    (Senha.observacoes.like("%REDIR:%")),
                    1
                ),
                else_=0
            )
        ).label("redirecionamentos"),
    ).filter(*filtros_base).one()

    total         = resultado.total         or 0
    concluidas    = int(resultado.concluidas or 0)
    tempo_medio   = float(resultado.tempo_medio or 0.0)
    redirs        = int(resultado.redirecionamentos or 0)
    taxa          = round((concluidas / total * 100), 2) if total > 0 else 0.0

    # ── Avaliação média (tabela separada) ───────────────────
    filtros_aval = [Avaliacao.atendente_id == atendente_id]
    # Nota: avaliacoes não têm data própria — filtrar via JOIN com senha
    if data_inicio or data_fim:
        filtros_aval_join = list(filtros_base[1:])  # reutiliza filtros de data
    else:
        filtros_aval_join = []

    aval_query = db.session.query(
        func.avg(Avaliacao.score).label("media"),
        func.count(Avaliacao.id).label("total"),
    ).join(Senha, Avaliacao.senha_id == Senha.id)

    aval_query = aval_query.filter(Avaliacao.atendente_id == atendente_id)
    for f in filtros_aval_join:
        aval_query = aval_query.filter(f)

    aval = aval_query.one()
    aval_media = round(float(aval.media or 0.0), 2)
    aval_total = int(aval.total or 0)

    return {
        "avaliacao_media":         aval_media,
        "avaliacoes_total":        aval_total,
        "total_atendimentos":      total,
        "atendimentos_concluidos": concluidas,
        "taxa_conclusao":          taxa,
        "tempo_medio":             round(tempo_medio, 1),
        "redirecionamentos":       redirs,
    }


# ─────────────────────────────────────────────────────────────
# FUNÇÃO — score composto ponderado (0–100)
# ─────────────────────────────────────────────────────────────

def calcular_score(metrics: dict, max_atendimentos: int = None) -> float:
    """
    Calcula o score composto de um atendente a partir das suas métricas.

    Fórmula (score de 0 a 100):
      35% — avaliação média normalizada (0–5 → 0–100)
      25% — taxa de conclusão (0–100%)
      20% — total atendimentos normalizado (vs referência)
      12% — tempo médio invertido (quanto menor, melhor → 0–100)
       8% — redirecionamentos invertidos (quanto menos, melhor → 0–100)

    Args:
        metrics          — dict devolvido por get_atendente_metrics()
        max_atendimentos — valor de referência para normalizar total;
                           se None usa _REF_MAX_ATENDIMENTOS global

    Returns:
        score arredondado a 1 decimal (0.0–100.0)
    """
    ref = max_atendimentos or _REF_MAX_ATENDIMENTOS

    # ── Componente: avaliação (0–5 → 0–100) ─────────────────
    p_aval = (metrics.get("avaliacao_media", 0) / 5.0) * 100

    # ── Componente: taxa de conclusão (já em %) ──────────────
    p_taxa = float(metrics.get("taxa_conclusao", 0))

    # ── Componente: atendimentos (normalizado) ───────────────
    total   = metrics.get("total_atendimentos", 0)
    p_atend = min(total / ref * 100, 100.0) if ref > 0 else 0.0

    # ── Componente: tempo médio invertido ────────────────────
    # 0 min → 100 pts;  ≥ MAXIMO → 0 pts; linear entre ambos
    tempo = metrics.get("tempo_medio", 0) or 0
    if tempo <= _TEMPO_IDEAL_MIN:
        p_tempo = 100.0
    elif tempo >= _TEMPO_MAXIMO_MIN:
        p_tempo = 0.0
    else:
        intervalo = _TEMPO_MAXIMO_MIN - _TEMPO_IDEAL_MIN
        p_tempo = max(0.0, (1 - (tempo - _TEMPO_IDEAL_MIN) / intervalo) * 100)

    # ── Componente: redirecionamentos invertidos ─────────────
    # 0 redirs → 100 pts;  cada redir subtrai 10 pts (mín 0)
    redir    = metrics.get("redirecionamentos", 0) or 0
    p_redir  = max(0.0, 100.0 - redir * 10)

    score = (
        p_aval  * _PESOS["avaliacao"]    +
        p_taxa  * _PESOS["taxa"]         +
        p_atend * _PESOS["atendimentos"] +
        p_tempo * _PESOS["tempo"]        +
        p_redir * _PESOS["redir"]
    )

    return round(score, 1)


# ─────────────────────────────────────────────────────────────
# FUNÇÃO — métricas de TODOS os atendentes (ranking)
# ─────────────────────────────────────────────────────────────

def get_todos_atendentes_metrics(
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    apenas_ativos: bool = True,
    apenas_atendentes: bool = True,
) -> list[dict]:
    """
    Devolve lista de atendentes com métricas + score, ordenada por score DESC.

    Args:
        data_inicio       — Filtro de data início
        data_fim          — Filtro de data fim
        apenas_ativos     — Se True, exclui atendentes desactivados
        apenas_atendentes — Se True, exclui admins do ranking

    Returns:
        Lista de dicts com campos:
          id, nome, email, balcao, tipo, departamento,
          + todos os campos de get_atendente_metrics()
          + score (float)

    Nota de performance:
        A função faz 2 queries agregadas globais (uma por tabela)
        para calcular máximos de referência, depois 1 query por
        atendente. Para N atendentes → 2 + N queries.
        Aceitável para equipas ≤ 20. Para equipas maiores,
        refactorizar para query única com GROUP BY.
    """
    # ── Carregar atendentes ──────────────────────────────────
    query = Atendente.query
    if apenas_ativos:
        query = query.filter(Atendente.ativo == True)
    if apenas_atendentes:
        query = query.filter(Atendente.tipo == "atendente")
    atendentes = query.order_by(Atendente.nome).all()

    if not atendentes:
        return []

    # ── Calcular o máximo real de atendimentos no período ────
    # (usado para normalizar o score de forma relativa)
    filtros_max = [Senha.status == "concluida"]
    if data_inicio:
        filtros_max.append(Senha.data_emissao >= data_inicio)
    if data_fim:
        filtros_max.append(Senha.data_emissao <= data_fim)

    max_row = db.session.query(
        func.max(func.count(Senha.id)).label("max_total")
    ).filter(*filtros_max).group_by(Senha.atendente_id).first()

    max_atend = int(max_row.max_total) if max_row and max_row.max_total else _REF_MAX_ATENDIMENTOS

    # ── Calcular métricas por atendente ─────────────────────
    resultado = []
    ids = [a.id for a in atendentes]

    # Pré-carregar todas as métricas num único loop de queries
    # (cada get_atendente_metrics faz 2 queries — aceitável)
    for atendente in atendentes:
        try:
            metricas = get_atendente_metrics(
                atendente.id, data_inicio, data_fim
            )
            score = calcular_score(metricas, max_atend)

            resultado.append({
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
            })
        except Exception as exc:
            logger.error(
                "Erro ao calcular métricas do atendente %s: %s",
                atendente.id, exc
            )
            continue

    # ── Ordenar por score descendente ───────────────────────
    resultado.sort(key=lambda x: x["score"], reverse=True)

    return resultado


# ─────────────────────────────────────────────────────────────
# HELPERS — parsing de datas (reutilizável nos controllers)
# ─────────────────────────────────────────────────────────────

def parse_date(value: str, field_name: str = "data") -> Optional[date]:
    """
    Converte string 'YYYY-MM-DD' para date.

    Args:
        value      — string a converter
        field_name — nome do campo para mensagem de erro

    Returns:
        date ou None se value for None/vazio

    Raises:
        ValueError — se o formato for inválido
    """
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError(
            f"Formato inválido para '{field_name}': '{value}'. Use YYYY-MM-DD."
        )