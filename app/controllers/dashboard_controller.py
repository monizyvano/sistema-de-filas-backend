"""
Controller de Dashboard - VERSÃO MESCLADA
Rotas: /api/dashboard/*

✅ Mantém rotas existentes:
   - GET /api/dashboard/estatisticas
   - GET /api/dashboard/atendentes
   - GET /api/dashboard/logs

✅ Adiciona novas rotas:
   - GET /api/dashboard/trabalhador/estatisticas
   - GET /api/dashboard/admin/kpis
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date

from app.models import Senha, Servico, Atendente, LogActividade
from app.services import SenhaService, FilaService
from app.schemas.senha_schema import AtendenteSchema
from sqlalchemy import func

# Criar Blueprint
dashboard_bp = Blueprint('dashboard', __name__)


# ===============================
# 📊 ROTAS EXISTENTES (MANTIDAS)
# ===============================

@dashboard_bp.route('/estatisticas', methods=['GET'])
@jwt_required()
def estatisticas():
    """
    GET /api/dashboard/estatisticas
    
    Estatísticas gerais do sistema (hoje)
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "senhas": {...},
            "filas": {...},
            "atendentes": {...},
            "servicos": {...}
        }
    """
    try:
        hoje = date.today()
        
        # Estatísticas de senhas
        stats_senhas = SenhaService.obter_estatisticas_hoje()
        
        # Estatísticas de filas
        stats_filas = FilaService.obter_estatisticas_fila()
        
        # Atendentes ativos
        atendentes_ativos = Atendente.query.filter_by(ativo=True).count()
        
        # Serviços ativos
        servicos_ativos = Servico.query.filter_by(ativo=True).count()
        
        # Tempo médio de atendimento hoje
        senhas_concluidas = Senha.query.filter(
            Senha.status == 'concluida',
            func.date(Senha.atendimento_concluido_em) == hoje
        ).all()
        
        tempos = [s.tempo_atendimento_minutos for s in senhas_concluidas if s.tempo_atendimento_minutos]
        tempo_medio = sum(tempos) / len(tempos) if tempos else 0
        
        return jsonify({
            "senhas": stats_senhas,
            "filas": stats_filas,
            "atendentes_ativos": atendentes_ativos,
            "servicos_ativos": servicos_ativos,
            "tempo_medio_atendimento": round(tempo_medio, 1)
        }), 200
    
    except Exception as e:
        print(f"❌ Erro em /dashboard/estatisticas: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/atendentes', methods=['GET'])
@jwt_required()
def listar_atendentes():
    """
    GET /api/dashboard/atendentes
    
    Listar todos os atendentes
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        [
            {
                "id": 1,
                "nome": "João Silva",
                "balcao": 1,
                ...
            }
        ]
    """
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
    """
    GET /api/dashboard/logs
    
    Listar logs de atividades
    
    Query Params:
        limite: Número de logs (padrão 50)
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        [
            {
                "acao": "emitida",
                "descricao": "Senha N001 emitida",
                "created_at": "..."
            }
        ]
    """
    try:
        limite = request.args.get('limite', 50, type=int)
        
        logs = LogActividade.query.order_by(
            LogActividade.created_at.desc()
        ).limit(limite).all()
        
        # Serializar manualmente (simples)
        resultado = []
        for log in logs:
            resultado.append({
                "id": log.id,
                "acao": log.acao,
                "descricao": log.descricao,
                "created_at": log.created_at.isoformat()
            })
        
        return jsonify(resultado), 200
    
    except Exception as e:
        print(f"❌ Erro em /dashboard/logs: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ===============================
# ✅ NOVAS ROTAS (ADICIONADAS)
# ===============================

@dashboard_bp.route('/trabalhador/estatisticas', methods=['GET'])
@jwt_required()
def estatisticas_trabalhador():
    """
    ✅ NOVA ROTA - Estatísticas específicas do trabalhador logado
    
    GET /api/dashboard/trabalhador/estatisticas
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "aguardando": int,           # Total aguardando no sistema
            "atendidos_hoje": int,       # Atendidos pelo trabalhador hoje
            "tempo_medio_atendimento": int  # Tempo médio do trabalhador
        }
    """
    try:
        atendente_id = int(get_jwt_identity())
        
        # Obter estatísticas do trabalhador
        stats = SenhaService.obter_estatisticas_trabalhador(atendente_id)
        
        # Adicionar estatísticas gerais da fila
        stats_gerais = SenhaService.obter_estatisticas_hoje()
        stats['aguardando'] = stats_gerais.get('aguardando', 0)
        
        return jsonify(stats), 200
        
    except Exception as e:
        print(f"❌ Erro em /dashboard/trabalhador/estatisticas: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@dashboard_bp.route('/admin/kpis', methods=['GET'])
@jwt_required()
def kpis_admin():
    """
    ✅ NOVA ROTA - KPIs do dashboard admin
    
    GET /api/dashboard/admin/kpis
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "atendimentos_hoje": int,
            "tempo_medio_espera": int,
            "taxa_ocupacao": float,
            "satisfacao": float
        }
    """
    try:
        stats = SenhaService.obter_estatisticas_hoje()
        
        # Calcular taxa de ocupação (% atendendo vs total)
        total_ativo = stats['aguardando'] + stats['atendendo']
        taxa_ocupacao = 0
        if total_ativo > 0:
            taxa_ocupacao = round((stats['atendendo'] / total_ativo) * 100, 1)
        
        return jsonify({
            'atendimentos_hoje': stats['concluidas'],
            'tempo_medio_espera': stats['tempo_medio_espera'],
            'taxa_ocupacao': taxa_ocupacao,
            'satisfacao': 95  # TODO: Implementar pesquisa de satisfação
        }), 200
        
    except Exception as e:
        print(f"❌ Erro em /dashboard/admin/kpis: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500
