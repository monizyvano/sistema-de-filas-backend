"""
Controller de Autenticação
Rotas: /api/auth/*
"""
from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services import AuthService
from app.schemas import LoginSchema, RegistrarAtendenteSchema, AtendenteSchema
from app.utils.decorators import admin_required, get_current_user

# Criar Blueprint
auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    """
    POST /api/auth/login
    
    Login de atendente
    
    Body:
        {
            "email": "admin@imtsb.ao",
            "senha": "admin123"
        }
    
    Response:
        {
            "atendente": {...},
            "access_token": "...",
            "refresh_token": "..."
        }
    """
    try:
        # Validar dados
        schema = LoginSchema()
        data = schema.load(request.get_json())
        
        # Pegar IP do cliente
        ip_address = request.remote_addr
        
        # Autenticar
        resultado = AuthService.login(
            email=data['email'],
            senha=data['senha'],
            ip_address=ip_address
        )
        
        return jsonify(resultado), 200
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 401
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@auth_bp.route('/register', methods=['POST'])
@jwt_required()
@admin_required
def register():
    """
    POST /api/auth/register
    
    Registrar novo atendente (apenas admin)
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "nome": "Ana Santos",
            "email": "ana@imtsb.ao",
            "senha": "senha123",
            "tipo": "atendente",
            "balcao": 4
        }
    
    Response:
        {
            "mensagem": "Atendente criado com sucesso",
            "atendente": {...}
        }
    """
    try:
        # Validar dados
        schema = RegistrarAtendenteSchema()
        data = schema.load(request.get_json())
        
        # Pegar ID do admin logado
        admin_id = get_jwt_identity()
        
        # Registrar atendente
        atendente = AuthService.registrar_atendente(data, admin_id)
        
        # Serializar resposta
        atendente_schema = AtendenteSchema()
        
        return jsonify({
            "mensagem": "Atendente criado com sucesso",
            "atendente": atendente_schema.dump(atendente)
        }), 201
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    """
    GET /api/auth/me
    
    Dados do usuário logado
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "id": 1,
            "nome": "Administrador",
            "email": "admin@imtsb.ao",
            ...
        }
    """
    try:
        atendente = get_current_user()
        
        if not atendente:
            return jsonify({"erro": "Atendente não encontrado"}), 404
        
        schema = AtendenteSchema()
        return jsonify(schema.dump(atendente)), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@auth_bp.route('/health', methods=['GET'])
def health():
    """
    GET /api/auth/health
    
    Verifica se API está funcionando
    """
    return jsonify({
        "status": "ok",
        "mensagem": "API IMTSB está funcionando! 🚀"
    }), 200
