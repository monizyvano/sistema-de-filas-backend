"""
Controller de Dashboard
Rotas: /api/dashboard/*
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from datetime import datetime, date

from app.models import Senha, Servico, Atendente, LogActividade
from app.services import SenhaService, FilaService
from app.schemas.senha_schema import AtendenteSchema
from sqlalchemy import func

# Criar Blueprint
dashboard_bp = Blueprint('dashboard', __name__)


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
		return jsonify({"erro": "Erro interno do servidor"}), 500
