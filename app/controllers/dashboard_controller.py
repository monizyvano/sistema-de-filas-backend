"""
app/controllers/dashboard_controller.py
═══════════════════════════════════════════════════════════════
Controller de Dashboard — SPRINT 1 (corrigido)

ALTERAÇÕES:
  ✅ Nova rota GET /api/dashboard/admin/trend
     Calcula variação real hoje vs ontem (elimina "+12%" fixo).
  ✅ Todas as rotas existentes mantidas sem alteração.
═══════════════════════════════════════════════════════════════
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta

from app.models import Senha, Servico, Atendente, LogActividade
from app.services import SenhaService, FilaService
from app.schemas.senha_schema import AtendenteSchema
from app.extensions import db
from sqlalchemy import func

dashboard_bp = Blueprint('dashboard', __name__)


# ═══════════════════════════════════════════════════════════════
# ROTAS EXISTENTES — mantidas sem alteração
# ═══════════════════════════════════════════════════════════════

@dashboard_bp.route('/estatisticas', methods=['GET'])
@jwt_required()
def estatisticas():
    """GET /api/dashboard/estatisticas — Estatísticas gerais do dia."""
    try:
        hoje = date.today()

        stats_senhas = SenhaService.obter_estatisticas_hoje()
        stats_filas  = FilaService.obter_estatisticas_fila()

        atendentes_ativos = Atendente.query.filter_by(ativo=True).count()
        servicos_ativos   = Servico.query.filter_by(ativo=True).count()

        senhas_concluidas = Senha.query.filter(
            Senha.status == 'concluida',
            func.date(Senha.atendimento_concluido_em) == hoje
        ).all()

        tempos     = [s.tempo_atendimento_minutos for s in senhas_concluidas
                      if s.tempo_atendimento_minutos]
        tempo_medio = round(sum(tempos) / len(tempos), 1) if tempos else 0

        return jsonify({
            "senhas": stats_senhas,
            "filas": stats_filas,
            "atendentes_ativos": atendentes_ativos,
            "servicos_ativos": servicos_ativos,
            "tempo_medio_atendimento": tempo_medio
        }), 200

    except Exception as e:
        print(f"❌ Erro em /dashboard/estatisticas: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/atendentes', methods=['GET'])
@jwt_required()
def listar_atendentes():
    """GET /api/dashboard/atendentes — Lista todos os atendentes."""
    try:
        atendentes = Atendente.query.order_by(Atendente.nome).all()
        schema = AtendenteSchema(many=True)
        return jsonify(schema.dump(atendentes)), 200
    except Exception as e:
        print(f"❌ Erro em /dashboard/atendentes: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/logs', methods=['GET'])
@jwt_required()
def listar_logs():
    """GET /api/dashboard/logs — Logs de actividade."""
    try:
        limite = request.args.get('limite', 50, type=int)
        logs   = LogActividade.query.order_by(
            LogActividade.created_at.desc()
        ).limit(limite).all()

        resultado = [{
            "id": log.id,
            "acao": log.acao,
            "descricao": log.descricao,
            "created_at": log.created_at.isoformat()
        } for log in logs]

        return jsonify(resultado), 200
    except Exception as e:
        print(f"❌ Erro em /dashboard/logs: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/trabalhador/estatisticas', methods=['GET'])
@jwt_required()
def estatisticas_trabalhador():
    """GET /api/dashboard/trabalhador/estatisticas — KPIs do trabalhador autenticado."""
    try:
        atendente_id = int(get_jwt_identity())
        stats        = SenhaService.obter_estatisticas_trabalhador(atendente_id)
        stats_gerais = SenhaService.obter_estatisticas_hoje()
        stats['aguardando'] = stats_gerais.get('aguardando', 0)
        return jsonify(stats), 200
    except Exception as e:
        print(f"❌ Erro em /dashboard/trabalhador/estatisticas: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/admin/kpis', methods=['GET'])
@jwt_required()
def kpis_admin():
    """GET /api/dashboard/admin/kpis — KPIs do painel admin."""
    try:
        stats       = SenhaService.obter_estatisticas_hoje()
        total_ativo = stats['aguardando'] + stats['atendendo']
        taxa        = round((stats['atendendo'] / total_ativo) * 100, 1) \
                      if total_ativo > 0 else 0

        return jsonify({
            'atendimentos_hoje':  stats['concluidas'],
            'tempo_medio_espera': stats['tempo_medio_espera'],
            'taxa_ocupacao':      taxa
        }), 200
    except Exception as e:
        print(f"❌ Erro em /dashboard/admin/kpis: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# NOVA ROTA — SPRINT 1
# ═══════════════════════════════════════════════════════════════

@dashboard_bp.route('/admin/trend', methods=['GET'])
@jwt_required()
def trend_admin():
    """
    GET /api/dashboard/admin/trend

    Variação real de atendimentos hoje vs ontem.
    Elimina o "+12%" hardcoded no frontend.

    Resposta (200):
        {
            "hoje": 24,
            "ontem": 20,
            "variacao_absoluta": 4,
            "variacao_percentual": 20.0,
            "tendencia": "alta"   -- "alta" | "baixa" | "estavel"
        }
    """
    try:
        hoje  = date.today()
        ontem = hoje - timedelta(days=1)

        total_hoje  = Senha.query.filter(
            Senha.status == 'concluida',
            func.date(Senha.atendimento_concluido_em) == hoje
        ).count()

        total_ontem = Senha.query.filter(
            Senha.status == 'concluida',
            func.date(Senha.atendimento_concluido_em) == ontem
        ).count()

        variacao_absoluta = total_hoje - total_ontem

        if total_ontem == 0:
            variacao_percentual = 100.0 if total_hoje > 0 else 0.0
        else:
            variacao_percentual = round(
                ((total_hoje - total_ontem) / total_ontem) * 100, 1
            )

        if abs(variacao_percentual) < 2:
            tendencia = "estavel"
        elif variacao_percentual > 0:
            tendencia = "alta"
        else:
            tendencia = "baixa"

        return jsonify({
            "hoje":                 total_hoje,
            "ontem":                total_ontem,
            "variacao_absoluta":    variacao_absoluta,
            "variacao_percentual":  variacao_percentual,
            "tendencia":            tendencia
        }), 200

    except Exception as e:
        print(f"❌ Erro em /dashboard/admin/trend: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500
