"""
app/controllers/dashboard_controller.py — SPRINT 2
═══════════════════════════════════════════════════════════════
ADIÇÕES SPRINT 2:
  ✅ GET /api/dashboard/admin/fluxo?periodo=dia|semana|mes
     Dados reais para o gráfico de linha (lineChart).
  ✅ GET /api/dashboard/admin/tempo-por-servico
     Tempo médio de atendimento agrupado por serviço.
  (Todas as rotas do Sprint 1 mantidas sem alteração)
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
# ROTAS SPRINT 1 — mantidas sem alteração
# ═══════════════════════════════════════════════════════════════

@dashboard_bp.route('/estatisticas', methods=['GET'])
@jwt_required()
def estatisticas():
    """GET /api/dashboard/estatisticas — Estatísticas gerais do dia."""
    try:
        hoje = date.today()

        stats_senhas  = SenhaService.obter_estatisticas_hoje()
        stats_filas   = FilaService.obter_estatisticas_fila()

        atendentes_ativos = Atendente.query.filter_by(ativo=True).count()
        servicos_ativos   = Servico.query.filter_by(ativo=True).count()

        senhas_concluidas = Senha.query.filter(
            Senha.status == 'concluida',
            func.date(Senha.atendimento_concluido_em) == hoje
        ).all()

        tempos      = [s.tempo_atendimento_minutos for s in senhas_concluidas
                       if s.tempo_atendimento_minutos]
        tempo_medio = round(sum(tempos) / len(tempos), 1) if tempos else 0

        return jsonify({
            "senhas":                 stats_senhas,
            "filas":                  stats_filas,
            "atendentes_ativos":      atendentes_ativos,
            "servicos_ativos":        servicos_ativos,
            "tempo_medio_atendimento": tempo_medio
        }), 200

    except Exception as e:
        print(f"❌ Erro /dashboard/estatisticas: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/atendentes', methods=['GET'])
@jwt_required()
def listar_atendentes():
    """GET /api/dashboard/atendentes — Lista atendentes com stats do dia."""
    try:
        hoje       = date.today()
        atendentes = Atendente.query.order_by(Atendente.nome).all()

        resultado = []
        for a in atendentes:
            # Contar atendimentos do dia para este atendente
            atendidos = Senha.query.filter(
                Senha.atendente_id == a.id,
                Senha.status == 'concluida',
                func.date(Senha.atendimento_concluido_em) == hoje
            ).count()

            # Tempo médio do atendente hoje
            senhas_c = Senha.query.filter(
                Senha.atendente_id == a.id,
                Senha.status == 'concluida',
                func.date(Senha.atendimento_concluido_em) == hoje,
                Senha.tempo_atendimento_minutos.isnot(None)
            ).all()
            tempos    = [s.tempo_atendimento_minutos for s in senhas_c]
            tempo_med = round(sum(tempos) / len(tempos)) if tempos else 0

            resultado.append({
                "id":               a.id,
                "nome":             a.nome,
                "email":            a.email,
                "tipo":             a.tipo,
                "ativo":            a.ativo,
                "balcao":           a.balcao,
                "servico_id":       a.servico_id,
                "departamento":     a.servico.nome if a.servico else "Geral",
                "atendimentos_hoje": atendidos,
                "tempo_medio":      tempo_med
            })

        return jsonify(resultado), 200

    except Exception as e:
        print(f"❌ Erro /dashboard/atendentes: {e}")
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
            "id":         log.id,
            "acao":       log.acao,
            "descricao":  log.descricao,
            "created_at": log.created_at.isoformat()
        } for log in logs]

        return jsonify(resultado), 200

    except Exception as e:
        print(f"❌ Erro /dashboard/logs: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/trabalhador/estatisticas', methods=['GET'])
@jwt_required()
def estatisticas_trabalhador():
    """GET /api/dashboard/trabalhador/estatisticas — KPIs do trabalhador."""
    try:
        atendente_id = int(get_jwt_identity())
        stats        = SenhaService.obter_estatisticas_trabalhador(atendente_id)
        stats_gerais = SenhaService.obter_estatisticas_hoje()
        stats['aguardando'] = stats_gerais.get('aguardando', 0)
        return jsonify(stats), 200
    except Exception as e:
        print(f"❌ Erro /dashboard/trabalhador/estatisticas: {e}")
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
        print(f"❌ Erro /dashboard/admin/kpis: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/admin/trend', methods=['GET'])
@jwt_required()
def trend_admin():
    """GET /api/dashboard/admin/trend — Variação hoje vs ontem."""
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

        tendencia = ("estavel" if abs(variacao_percentual) < 2
                     else "alta" if variacao_percentual > 0 else "baixa")

        return jsonify({
            "hoje":                total_hoje,
            "ontem":               total_ontem,
            "variacao_absoluta":   variacao_absoluta,
            "variacao_percentual": variacao_percentual,
            "tendencia":           tendencia
        }), 200

    except Exception as e:
        print(f"❌ Erro /dashboard/admin/trend: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# ROTAS SPRINT 2 — novas
# ═══════════════════════════════════════════════════════════════

@dashboard_bp.route('/admin/fluxo', methods=['GET'])
@jwt_required()
def fluxo_admin():
    """
    GET /api/dashboard/admin/fluxo?periodo=dia|semana|mes

    Dados para o gráfico de linha (lineChart) no dashboard.

    Resposta:
        {
            "periodo": "dia",
            "labels": ["08h","09h",...],
            "dados":  [3, 7, 12, ...]
        }

    - dia   → agrupado por hora (00h–23h), apenas hoje
    - semana → agrupado por dia (seg–dom), últimos 7 dias
    - mes   → agrupado por dia (1–31), mês actual
    """
    try:
        periodo = request.args.get('periodo', 'dia')
        hoje    = date.today()

        if periodo == 'dia':
            # Agrupar por hora do dia actual
            resultados = db.session.query(
                func.hour(Senha.atendimento_concluido_em).label('hora'),
                func.count(Senha.id).label('total')
            ).filter(
                Senha.status == 'concluida',
                func.date(Senha.atendimento_concluido_em) == hoje
            ).group_by(
                func.hour(Senha.atendimento_concluido_em)
            ).all()

            # Construir array de 24h com zeros onde não há dados
            mapa   = {r.hora: r.total for r in resultados}
            labels = [f"{h:02d}h" for h in range(24)]
            dados  = [mapa.get(h, 0) for h in range(24)]

        elif periodo == 'semana':
            # Últimos 7 dias
            inicio = hoje - timedelta(days=6)

            resultados = db.session.query(
                func.date(Senha.atendimento_concluido_em).label('dia'),
                func.count(Senha.id).label('total')
            ).filter(
                Senha.status == 'concluida',
                func.date(Senha.atendimento_concluido_em) >= inicio,
                func.date(Senha.atendimento_concluido_em) <= hoje
            ).group_by(
                func.date(Senha.atendimento_concluido_em)
            ).all()

            # Nomes dos dias em pt-PT
            DIAS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
            mapa    = {str(r.dia): r.total for r in resultados}
            labels  = []
            dados   = []
            for i in range(7):
                dia    = inicio + timedelta(days=i)
                labels.append(DIAS_PT[dia.weekday()])
                dados.append(mapa.get(str(dia), 0))

        elif periodo == 'mes':
            # Dias do mês actual
            primeiro_dia = hoje.replace(day=1)

            resultados = db.session.query(
                func.day(Senha.atendimento_concluido_em).label('dia'),
                func.count(Senha.id).label('total')
            ).filter(
                Senha.status == 'concluida',
                func.year(Senha.atendimento_concluido_em)  == hoje.year,
                func.month(Senha.atendimento_concluido_em) == hoje.month
            ).group_by(
                func.day(Senha.atendimento_concluido_em)
            ).all()

            dias_no_mes = (
                hoje.replace(month=hoje.month % 12 + 1, day=1)
                - timedelta(days=1)
            ).day
            mapa   = {r.dia: r.total for r in resultados}
            labels = [str(d) for d in range(1, dias_no_mes + 1)]
            dados  = [mapa.get(d, 0) for d in range(1, dias_no_mes + 1)]

        else:
            return jsonify({"erro": "Período inválido. Use: dia, semana, mes"}), 400

        return jsonify({
            "periodo": periodo,
            "labels":  labels,
            "dados":   dados
        }), 200

    except Exception as e:
        print(f"❌ Erro /dashboard/admin/fluxo: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/admin/tempo-por-servico', methods=['GET'])
@jwt_required()
def tempo_por_servico():
    """
    GET /api/dashboard/admin/tempo-por-servico

    Tempo médio de atendimento (em minutos) agrupado por serviço,
    para o dia actual.

    Resposta:
        {
            "servicos": [
                {
                    "id": 1,
                    "nome": "Secretaria Académica",
                    "icone": "📄",
                    "total_hoje": 12,
                    "tempo_medio": 7,
                    "tempo_max": 15,
                    "tempo_min": 2
                },
                ...
            ]
        }
    """
    try:
        hoje     = date.today()
        servicos = Servico.query.filter_by(ativo=True).all()

        resultado = []
        for srv in servicos:
            senhas_c = Senha.query.filter(
                Senha.servico_id == srv.id,
                Senha.status     == 'concluida',
                func.date(Senha.atendimento_concluido_em) == hoje,
                Senha.tempo_atendimento_minutos.isnot(None)
            ).all()

            tempos     = [s.tempo_atendimento_minutos for s in senhas_c]
            total_hoje = len(senhas_c)
            tempo_med  = round(sum(tempos) / len(tempos)) if tempos else 0
            tempo_max  = max(tempos) if tempos else 0
            tempo_min  = min(tempos) if tempos else 0

            resultado.append({
                "id":          srv.id,
                "nome":        srv.nome,
                "icone":       srv.icone or "📄",
                "total_hoje":  total_hoje,
                "tempo_medio": tempo_med,
                "tempo_max":   tempo_max,
                "tempo_min":   tempo_min
            })

        # Ordenar por maior volume de atendimentos
        resultado.sort(key=lambda x: x['total_hoje'], reverse=True)

        return jsonify({"servicos": resultado}), 200

    except Exception as e:
        print(f"❌ Erro /dashboard/admin/tempo-por-servico: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500
