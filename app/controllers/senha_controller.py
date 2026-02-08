"""
Controller de Senhas
Rotas: /api/senhas/*
"""
from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services import SenhaService
from app.schemas import (
    EmitirSenhaSchema,
    CancelarSenhaSchema,
    IniciarAtendimentoSchema,
    FinalizarAtendimentoSchema,
    SenhaSchema
)
from app.utils.decorators import get_current_user

# Criar Blueprint
senha_bp = Blueprint('senha', __name__)


@senha_bp.route('/', methods=['POST'])
def emitir():
    """
    POST /api/senhas
    
    Emitir nova senha (público - não precisa login)
    
    Body:
        {
            "servico_id": 1,
            "tipo": "normal",  // ou "prioritaria"
            "usuario_contato": "923456789"  // opcional
        }
    
    Response:
        {
            "mensagem": "Senha emitida com sucesso",
            "senha": {
                "numero": "N001",
                "servico": {...},
                ...
            }
        }
    """
    try:
        # Validar dados
        schema = EmitirSenhaSchema()
        data = schema.load(request.get_json())
        
        # Emitir senha
        senha = SenhaService.emitir(**data)
        
        # Serializar resposta
        senha_schema = SenhaSchema()
        
        return jsonify({
            "mensagem": "Senha emitida com sucesso",
            "senha": senha_schema.dump(senha)
        }), 201
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/<int:senha_id>', methods=['GET'])
def buscar(senha_id):
    """
    GET /api/senhas/:id
    
    Buscar senha por ID
    
    Response:
        {
            "numero": "N042",
            "status": "aguardando",
            ...
        }
    """
    try:
        senha = SenhaService.obter_por_id(senha_id)
        
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        
        schema = SenhaSchema()
        return jsonify(schema.dump(senha)), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/numero/<string:numero>', methods=['GET'])
def buscar_por_numero(numero):
    """
    GET /api/senhas/numero/:numero
    
    Buscar senha por número (ex: N042)
    
    Response:
        {
            "numero": "N042",
            "status": "aguardando",
            ...
        }
    """
    try:
        senha = SenhaService.obter_por_numero(numero.upper())
        
        if not senha:
            return jsonify({"erro": f"Senha {numero} não encontrada"}), 404
        
        schema = SenhaSchema()
        return jsonify(schema.dump(senha)), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/<int:senha_id>/cancelar', methods=['DELETE'])
@jwt_required()
def cancelar(senha_id):
    """
    DELETE /api/senhas/:id/cancelar
    
    Cancelar senha (requer autenticação)
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "motivo": "Desistência do utente"
        }
    
    Response:
        {
            "mensagem": "Senha cancelada com sucesso",
            "senha": {...}
        }
    """
    try:
        # Validar dados
        schema = CancelarSenhaSchema()
        data = schema.load(request.get_json())
        
        # Pegar atendente logado
        atendente_id = get_jwt_identity()
        
        # Cancelar senha
        senha = SenhaService.cancelar(
            senha_id=senha_id,
            motivo=data['motivo'],
            atendente_id=atendente_id
        )
        
        # Serializar resposta
        senha_schema = SenhaSchema()
        
        return jsonify({
            "mensagem": "Senha cancelada com sucesso",
            "senha": senha_schema.dump(senha)
        }), 200
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/<int:senha_id>/iniciar', methods=['PUT'])
@jwt_required()
def iniciar_atendimento(senha_id):
    """
    PUT /api/senhas/:id/iniciar
    
    Iniciar atendimento de uma senha
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "numero_balcao": 1
        }
    
    Response:
        {
            "mensagem": "Atendimento iniciado",
            "senha": {...}
        }
    """
    try:
        # Validar dados
        schema = IniciarAtendimentoSchema()
        data = schema.load(request.get_json())
        
        # Pegar atendente logado
        atendente_id = get_jwt_identity()
        
        # Buscar senha
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        
        # Iniciar atendimento
        senha.iniciar_atendimento(
            atendente_id=atendente_id,
            numero_balcao=data['numero_balcao']
        )
        
        # Serializar resposta
        senha_schema = SenhaSchema()
        
        return jsonify({
            "mensagem": "Atendimento iniciado",
            "senha": senha_schema.dump(senha)
        }), 200
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/<int:senha_id>/finalizar', methods=['PUT'])
@jwt_required()
def finalizar_atendimento(senha_id):
    """
    PUT /api/senhas/:id/finalizar
    
    Finalizar atendimento de uma senha
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "observacoes": "Atendimento realizado com sucesso"
        }
    
    Response:
        {
            "mensagem": "Atendimento finalizado",
            "senha": {...}
        }
    """
    try:
        # Validar dados
        schema = FinalizarAtendimentoSchema()
        data = schema.load(request.get_json())
        
        # Buscar senha
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        
        # Finalizar atendimento
        senha.finalizar(observacoes=data.get('observacoes'))
        
        # Serializar resposta
        senha_schema = SenhaSchema()
        
        return jsonify({
            "mensagem": "Atendimento finalizado",
            "senha": senha_schema.dump(senha)
        }), 200
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/estatisticas', methods=['GET'])
def estatisticas():
    """
    GET /api/senhas/estatisticas
    
    Estatísticas de senhas do dia
    
    Response:
        {
            "total_emitidas": 42,
            "aguardando": 5,
            "atendendo": 2,
            "concluidas": 35,
            "canceladas": 0
        }
    """
    try:
        stats = SenhaService.obter_estatisticas_hoje()
        return jsonify(stats), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500
