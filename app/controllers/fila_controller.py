"""
Controller de Filas
Rotas: /api/filas/*
"""
from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services import FilaService
from app.services.fila_service import FilaService
from app.schemas.senha_schema import SenhaSchema

# Criar Blueprint
fila_bp = Blueprint('fila', __name__)


@fila_bp.route('/', methods=['GET'])
def listar_todas():
	"""
	GET /api/filas
    
	Ver todas as filas (geral)
    
	Response:
		{
			"aguardando_total": 10,
			"aguardando_normal": 7,
			"aguardando_prioritaria": 3,
			"atendendo": 4
		}
	"""
	try:
		stats = FilaService.obter_estatisticas_fila()
		return jsonify(stats), 200
    
	except Exception as e:
		return jsonify({"erro": "Erro interno do servidor"}), 500

#OBTER FILA
@fila_bp.route('/<int:servico_id>', methods=['GET'])
def buscar_fila(servico_id):
    """Buscar fila de um serviço
    ---
    tags:
      - Filas
    parameters:
      - in: path
        name: servico_id
        required: true
        type: integer
        description: ID do serviço
        example: 1
    responses:
      200:
        description: Fila retornada com sucesso
        schema:
          type: object
          properties:
            servico_id:
              type: integer
              example: 1
            total:
              type: integer
              example: 5
              description: Total de senhas na fila
            fila:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  numero:
                    type: string
                    example: N001
                  tipo:
                    type: string
                    example: normal
                  status:
                    type: string
                    example: aguardando
      500:
        description: Erro interno do servidor
    """
    try:
        fila = FilaService.obter_fila(servico_id=servico_id)
        
        return jsonify({
            'servico_id': servico_id,
            'total': len(fila),
            'fila': [senha.to_dict(include_relationships=False) for senha in fila]
        }), 200
        
    except Exception as e:
        return jsonify({'erro': 'Erro ao buscar fila'}), 500


@fila_bp.route('/chamar', methods=['POST'])
@jwt_required()
def chamar_proxima():
    try:
        data = request.get_json()

        servico_id = data.get('servico_id')
        numero_balcao = data.get('numero_balcao')

        if not servico_id or not numero_balcao:
            return jsonify({
                "erro": "servico_id e numero_balcao são obrigatórios"
            }), 400

        atendente_id = get_jwt_identity()
        atendente_id = int(get_jwt_identity())

        senha = FilaService.chamar_proxima(
            servico_id=servico_id,
            numero_balcao=numero_balcao,
            atendente_id=atendente_id
        )

        if not senha:
            return jsonify({
                "mensagem": "Nenhuma senha aguardando para este serviço"
            }), 404

        schema = SenhaSchema()

        return jsonify({
            "mensagem": "Senha chamada com sucesso",
            "senha": schema.dump(senha)
        }), 200

    except Exception as e:
        return jsonify({
            "erro": str(e)
        }), 500


@fila_bp.route('/<int:servico_id>/estatisticas', methods=['GET'])
def estatisticas_servico(servico_id):
	"""
	GET /api/filas/:servico_id/estatisticas
    
	Estatísticas de um serviço
    
	Response:
		{
			"aguardando_total": 5,
			"aguardando_normal": 3,
			"aguardando_prioritaria": 2,
			"atendendo": 1,
			"tempo_espera_estimado": 50
		}
	"""
	try:
		stats = FilaService.obter_estatisticas_fila(servico_id)
		return jsonify(stats), 200
    
	except Exception as e:
		return jsonify({"erro": "Erro interno do servidor"}), 500
