"""
Decoradores customizados
"""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, get_jwt
from app.models import Atendente


def jwt_required_custom(fn):
    """
    Decorator para exigir JWT válido
    
    Usage:
        @app.route('/api/protegido')
        @jwt_required_custom
        def rota_protegida():
            return jsonify({"mensagem": "Acesso permitido"})
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            return fn(*args, **kwargs)
        except Exception as e:
            return jsonify({"erro": "Token inválido ou expirado"}), 401
    return wrapper


def admin_required(fn):
    """
    Decorator para exigir permissão de admin
    
    Usage:
        @app.route('/api/admin-only')
        @jwt_required_custom
        @admin_required
        def rota_admin():
            return jsonify({"mensagem": "Apenas admins"})
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            
            # Pegar claims do JWT
            claims = get_jwt()
            tipo = claims.get('tipo')
            
            if tipo != 'admin':
                return jsonify({"erro": "Acesso negado. Apenas administradores."}), 403
            
            return fn(*args, **kwargs)
        except Exception as e:
            return jsonify({"erro": "Token inválido"}), 401
    return wrapper


def get_current_user():
    """
    Obtém atendente atual do JWT
    
    Returns:
        Atendente: Atendente logado
    """
    atendente_id = get_jwt_identity()
    return Atendente.query.get(atendente_id)
