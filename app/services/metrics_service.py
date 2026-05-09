"""
app/services/metrics_service.py
═══════════════════════════════════════════════════════════════
Serviço de Métricas por Atendente — VERSÃO CORRIGIDA

CORRECÇÕES APLICADAS:
  ✅ FIX-M1: calcular_score() devolve Optional[float] — None quando
     não existem dados de produção reais (total_atendimentos == 0).
     O frontend NUNCA mais verá scores sintéticos para atendentes
     sem produção.

  ✅ FIX-M2: get_atendente_metrics() inclui campo 'dados_insuficientes'
     (bool) no dict de retorno. O frontend usa este flag para
     decidir o que mostrar — score, badge ou "Sem dados".

  ✅ FIX-M3: get_todos_atendentes_metrics() propaga 'dados_insuficientes'
     para cada item da lista, e passa None ao campo 'score' quando
     o atendente não tem produção real.

  ✅ FIX-M4: Normalização de avaliação_media: se aval_total == 0
     devolve 0.0 (e dados_insuficientes fica True via total == 0),
     NÃO usa valor neutro fictício.

REGRA DE OURO:
  O backend é a ÚNICA autoridade para:
    - score de produtividade
    - badge/categoria
    - flag de dados insuficientes
  O frontend DEVE:
    - renderizar
    - formatar
    - ordenar
  O frontend NÃO DEVE:
    - estimar
    - normalizar
    - inventar valores neutros
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

# Mínimo de atendimentos para o score ser considerado fiável
_MIN_ATENDIMENTOS_PARA_SCORE = 1


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
          "avaliacao_media":    float,   # 0.0–5.0 (0.0 se sem avaliações)
          "avaliacoes_total":   int,
          "total_atendimentos": int,
          "atendimentos_concluidos": int,
          "taxa_conclusao":     float,   # 0.0–100.0
          "tempo_medio":        float,   # minutos (só concluídas)
          "redirecionamentos":  int,
          "dados_insuficientes": bool,   # ← NOVO: True se sem produção real
        }

    FIX-M2: 'dados_insuficientes' é True quando total_atendimentos == 0.
    Quando True, o frontend deve exibir "—" em vez de qualquer score.
    """
    # ── Filtros de data ──────────────────────────────────────
    filtros_base = [Senha.atendente_id == atendente_id]
    if data_inicio:
        filtros_base.append(Senha.data_emissao >= data_inicio)
    if data_fim:
        filtros_base.append(Senha.data_emissao <= data_fim)

    # ── Consulta agregada principal ──────────────────────────
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

    # FIX-M4: avaliação — 0.0 real quando sem avaliações (não valor neutro)
    filtros_aval_join = list(filtros_base[1:])  # filtros de data sem o atendente_id

    try:
        aval_query = db.session.query(
            func.avg(Avaliacao.score).label("media"),
            func.count(Avaliacao.id).label("total"),
        ).join(Senha, Avaliacao.senha_id == Senha.id)

        aval_query = aval_query.filter(Avaliacao.atendente_id == atendente_id)
        for f in filtros_aval_join:
            aval_query = aval_query.filter(f)

        aval = aval_query.one()
        # FIX-M4: 0.0 quando sem avaliações — NÃO usar valor neutro fictício
        aval_media = round(float(aval.media or 0.0), 2)
        aval_total = int(aval.total or 0)
    except Exception as _aval_exc:
        _msg = str(_aval_exc).lower()
        if "avaliacoes" in _msg or "doesn't exist" in _msg or "no such table" in _msg:
            # Tabela avaliacoes ausente → fallback para Senha.avaliacao_nota
            if hasattr(Senha, "avaliacao_nota"):
                _fb = db.session.query(
                    func.avg(Senha.avaliacao_nota).label("media"),
                    func.count(Senha.id).label("total"),
                ).filter(
                    Senha.atendente_id == atendente_id,
                    Senha.avaliacao_nota.isnot(None),
                    Senha.avaliacao_nota > 0,
                    *filtros_aval_join,
                ).one()
                aval_media = round(float(_fb.media or 0.0), 2)
                aval_total = int(_fb.total or 0)
            else:
                logger.warning(
                    "Fallback avaliacao_nota indisponível: coluna não mapeada no model Senha."
                )
                aval_media = 0.0
                aval_total = 0
        else:
            logger.warning("Avaliacao query error atendente %s: %s", atendente_id, _aval_exc)
            aval_media = 0.0
            aval_total = 0

    # FIX-M2: flag de dados insuficientes — critério objectivo
    dados_insuficientes = total < _MIN_ATENDIMENTOS_PARA_SCORE

    return {
        "avaliacao_media":         aval_media,
        "avaliacoes_total":        aval_total,
        "total_atendimentos":      total,
        "atendimentos_concluidos": concluidas,
        "taxa_conclusao":          taxa,
        "tempo_medio":             round(tempo_medio, 1),
        "redirecionamentos":       redirs,
        "dados_insuficientes":     dados_insuficientes,  # ← FIX-M2
    }


# ─────────────────────────────────────────────────────────────
# FUNÇÃO — score composto ponderado (0–100 ou None)
# ─────────────────────────────────────────────────────────────

def calcular_score(
    metrics: dict,
    max_atendimentos: int = None
) -> Optional[float]:
    """
    Calcula o score composto de um atendente a partir das suas métricas.

    FIX-M1: Devolve None quando não existem dados de produção reais.
    O frontend deve tratar None como "Sem dados suficientes" e NÃO
    atribuir qualquer badge, ranking ou posição no pódio.

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
        score arredondado a 1 decimal (0.0–100.0) ou None se sem dados.
    """
    # FIX-M1: sem dados reais → None, nunca um valor sintético
    if metrics.get("dados_insuficientes"):
        return None

    if metrics.get("total_atendimentos", 0) < _MIN_ATENDIMENTOS_PARA_SCORE:
        return None

    ref = max_atendimentos or _REF_MAX_ATENDIMENTOS

    # ── Componente: avaliação (0–5 → 0–100) ─────────────────
    # FIX-M4: se aval_media == 0 (sem avaliações), contribuição = 0
    # NÃO usar valor neutro de 70 como antes
    p_aval = (metrics.get("avaliacao_media", 0) / 5.0) * 100

    # ── Componente: taxa de conclusão (já em %) ──────────────
    p_taxa = float(metrics.get("taxa_conclusao", 0))

    # ── Componente: atendimentos (normalizado) ───────────────
    total   = metrics.get("total_atendimentos", 0)
    p_atend = min(total / ref * 100, 100.0) if ref > 0 else 0.0

    # ── Componente: tempo médio invertido ────────────────────
    tempo = metrics.get("tempo_medio", 0) or 0
    if tempo <= _TEMPO_IDEAL_MIN:
        p_tempo = 100.0
    elif tempo >= _TEMPO_MAXIMO_MIN:
        p_tempo = 0.0
    else:
        intervalo = _TEMPO_MAXIMO_MIN - _TEMPO_IDEAL_MIN
        p_tempo = max(0.0, (1 - (tempo - _TEMPO_IDEAL_MIN) / intervalo) * 100)

    # ── Componente: redirecionamentos invertidos ─────────────
    redir   = metrics.get("redirecionamentos", 0) or 0
    p_redir = max(0.0, 100.0 - redir * 10)

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

    FIX-M3: Atendentes com dados_insuficientes=True terão score=None
    e aparecem NO FIM da lista (após os que têm dados reais).

    Args:
        data_inicio       — Filtro de data início
        data_fim          — Filtro de data fim
        apenas_ativos     — Se True, exclui atendentes desactivados
        apenas_atendentes — Se True, exclui admins do ranking

    Returns:
        Lista de dicts com campos:
          id, nome, email, balcao, tipo, departamento,
          + todos os campos de get_atendente_metrics()
          + score: Optional[float]  ← None se sem dados reais
          + dados_insuficientes: bool
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

    # ── Calcular máximo real de atendimentos ─────────────────
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
    for atendente in atendentes:
        try:
            metricas = get_atendente_metrics(
                atendente.id, data_inicio, data_fim
            )
            # FIX-M1 + FIX-M3: score é None quando sem dados reais
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
                "score":               score,               # Optional[float]
                "dados_insuficientes": metricas["dados_insuficientes"],
            })
        except Exception as exc:
            logger.error(
                "Erro ao calcular métricas do atendente %s: %s",
                atendente.id, exc
            )
            continue

    # FIX-M3: ordenar — scores reais primeiro (desc), sem dados no fim
    resultado.sort(
        key=lambda x: (
            x["score"] is None,     # False (0) vai antes de True (1)
            -(x["score"] or 0),     # score desc para os que têm dados
        )
    )

    return resultado


# ─────────────────────────────────────────────────────────────
# HELPERS — parsing de datas (reutilizável nos controllers)
# ─────────────────────────────────────────────────────────────

def parse_date(value: str, field_name: str = "data") -> Optional[date]:
    """
    Converte string 'YYYY-MM-DD' para date.

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
