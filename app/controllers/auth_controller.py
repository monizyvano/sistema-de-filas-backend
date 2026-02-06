"""Controller de autenticação (temporário para teste)"""
from flask import Blueprint, jsonify

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/health', methods=['GET'])
def health_check():
    """Endpoint de teste"""
    return jsonify({
        "status": "ok",
        "mensagem": "Backend IMTSB está funcionando! 🚀"
    }), 200
