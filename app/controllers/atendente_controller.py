"""
app/controllers/atendente_controller.py — SPRINT 3
═══════════════════════════════════════════════════════════════
CRUD completo de atendentes para o dashboard administrativo.

Rotas:
  GET    /api/atendentes/            – lista todos
  POST   /api/atendentes/            – criar novo
  PUT    /api/atendentes/:id         – editar
  DELETE /api/atendentes/:id         – desactivar
  GET    /api/atendentes/proximo-balcao – próximo balcão livre (util)

CORRECÇÕES SPRINT 3:
  ✅ Balcão automático: se balcão não é enviado OU está ocupado,
     o backend calcula automaticamente o próximo número livre.
     Elimina o erro "Balcão X já está atribuído".
  ✅ Admins nunca recebem balcão (balcao = None).
  ✅ GET /api/atendentes/proximo-balcao expõe o próximo livre.
═══════════════════════════════════════════════════════════════
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.atendente import Atendente
from app.models.senha import Senha
from app.models.log_actividade import LogActividade
from app.extensions import db

from datetime import date, timedelta
from sqlalchemy import func, case

atendente_bp = Blueprint('atendente', __name__)


# ─────────────────────────────────────────────
# 🔐 ADMIN CHECK
# ─────────────────────────────────────────────
def _verificar_admin():
    user_id = int(get_jwt_identity())
    user = Atendente.query.get(user_id)

    if not user or user.tipo != 'admin':
        return None, jsonify({"erro": "Acesso negado"}), 403

    return user, None, None


# ─────────────────────────────────────────────
# 📅 PERÍODO
# ─────────────────────────────────────────────
def _calcular_intervalo(periodo, data_de=None, data_ate=None):
    hoje = date.today()

    if periodo == 'hoje':
        return hoje, hoje

    if periodo == 'semana':
        inicio = hoje - timedelta(days=hoje.weekday())
        return inicio, hoje

    if periodo == 'mes':
        return hoje.replace(day=1), hoje

    if periodo == 'intervalo':
        try:
            di = date.fromisoformat(data_de) if data_de else None
            da = date.fromisoformat(data_ate) if data_ate else hoje
            return di, da
        except:
            return None, hoje

    return None, None  # todos


# ─────────────────────────────────────────────
# 📊 MÉTRICAS OTIMIZADAS (SQL)
# ─────────────────────────────────────────────
def _calcular_metricas(atendente_id, data_inicio, data_fim):

    filtro_data = []
    if data_inicio:
        filtro_data.append(Senha.data_emissao >= data_inicio)
    if data_fim:
        filtro_data.append(Senha.data_emissao <= data_fim)

    base = db.session.query(Senha).filter(
        Senha.atendente_id == atendente_id,
        *filtro_data
    )

    total = base.count()

    concluidas = base.filter(Senha.status == 'concluida').count()

    # Taxa conclusão
    taxa = (concluidas / total * 100) if total > 0 else 0

    # Tempo médio
    tempo_medio = db.session.query(
        func.avg(Senha.tempo_atendimento_minutos)
    ).filter(
        Senha.atendente_id == atendente_id,
        Senha.status == 'concluida',
        *filtro_data
    ).scalar() or 0

    # Avaliação
    avaliacao_media = db.session.query(
        func.avg(Senha.avaliacao_nota)
    ).filter(
        Senha.atendente_id == atendente_id,
        Senha.avaliacao_nota > 0,
        *filtro_data
    ).scalar() or 0

    avaliacao_count = db.session.query(
        func.count(Senha.id)
    ).filter(
        Senha.atendente_id == atendente_id,
        Senha.avaliacao_nota > 0,
        *filtro_data
    ).scalar()

    # Redirecionamentos
    redir = db.session.query(func.count(LogActividade.id)).filter(
        LogActividade.atendente_id == atendente_id,
        LogActividade.acao == 'redirecionada'
    )

    if data_inicio:
        redir = redir.filter(func.date(LogActividade.created_at) >= data_inicio)
    if data_fim:
        redir = redir.filter(func.date(LogActividade.created_at) <= data_fim)

    redirecionamentos = redir.scalar()

    # 🔥 SCORE REAL
    score = (
        (avaliacao_media * 20) * 0.35 +
        taxa * 0.25 +
        total * 0.20 +
        (1 / (tempo_medio + 1)) * 100 * 0.12 +
        redirecionamentos * 0.08
    )

    return {
        "total_atendimentos": total,
        "atendimentos_periodo": concluidas,
        "tempo_medio": round(tempo_medio, 2),
        "avaliacao_media": round(avaliacao_media, 2),
        "avaliacao_count": avaliacao_count,
        "taxa_conclusao": round(taxa, 2),
        "redirecionamentos": redirecionamentos,
        "score": round(score, 2)
    }


# ─────────────────────────────────────────────
# 📋 LISTAR ATENDENTES
# ─────────────────────────────────────────────
@atendente_bp.route('/', methods=['GET'])
@jwt_required()
def listar_atendentes():
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    periodo = request.args.get('periodo', 'hoje')
    data_de = request.args.get('data_de')
    data_ate = request.args.get('data_ate')

    data_inicio, data_fim = _calcular_intervalo(periodo, data_de, data_ate)

    atendentes = Atendente.query.filter_by(ativo=True).all()
    resultado = []

    for a in atendentes:
        metricas = _calcular_metricas(a.id, data_inicio, data_fim)

        resultado.append({
            "id": a.id,
            "nome": a.nome,
            "balcao": a.balcao,
            **metricas
        })

    return jsonify(resultado)


# ─────────────────────────────────────────────
# 🏆 TOP 3 (TRABALHADOR DO DIA/MÊS)
# ─────────────────────────────────────────────
@atendente_bp.route('/top', methods=['GET'])
@jwt_required()
def top_atendentes():
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    response = listar_atendentes().get_json()

    ordenados = sorted(response, key=lambda x: x["score"], reverse=True)

    return jsonify({
        "top_1": ordenados[0] if len(ordenados) > 0 else None,
        "top_2": ordenados[1] if len(ordenados) > 1 else None,
        "top_3": ordenados[2] if len(ordenados) > 2 else None
    })