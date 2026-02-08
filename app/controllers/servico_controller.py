"""
Controller de Serviços
Rotas: /api/servicos/*
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.models import Servico
from app.schemas import ServicoSchema
from app.utils.decorators import admin_required

# Criar Blueprint
servico_bp = Blueprint('servico', __name__)


@servico_bp.route('/', methods=['GET'])
def listar():
    """
    GET /api/servicos
    
    Listar todos os serviços ativos
    
    Response:
        [
            {
                "id": 1,
                "nome": "Secretaria Académica",
                "icone": "📄",
                ...
            }
        ]
    """
    try:
        # Buscar apenas ativos, ordenados
        servicos = Servico.query.filter_by(ativo=True).order_by(
            Servico.ordem_exibicao
        ).all()
        
        # Serializar
        schema = ServicoSchema(many=True)
        
        return jsonify(schema.dump(servicos)), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@servico_bp.route('/<int:servico_id>', methods=['GET'])
def buscar(servico_id):
    """
    GET /api/servicos/:id
    
    Buscar serviço por ID
    """
    try:
        servico = Servico.query.get(servico_id)
        
        if not servico:
            return jsonify({"erro": "Serviço não encontrado"}), 404
        
        schema = ServicoSchema()
        return jsonify(schema.dump(servico)), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@servico_bp.route('/', methods=['POST'])
@jwt_required()
@admin_required
def criar():
    """
    POST /api/servicos
    
    Criar novo serviço (apenas admin)
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "nome": "Coordenação",
            "descricao": "Atendimento coordenação",
            "tempo_medio_minutos": 10,
            "icone": "👔",
            "ordem_exibicao": 5
        }
    """
    try:
        data = request.get_json()
        
        # Criar serviço
        servico = Servico(
            nome=data['nome'],
            descricao=data.get('descricao'),
            tempo_medio_minutos=data.get('tempo_medio_minutos', 10),
            icone=data.get('icone', '📄'),
            ordem_exibicao=data.get('ordem_exibicao', 99)
        )
        servico.save()
        
        # Serializar
        schema = ServicoSchema()
        
        return jsonify({
            "mensagem": "Serviço criado com sucesso",
            "servico": schema.dump(servico)
        }), 201
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500
