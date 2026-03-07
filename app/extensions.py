"""
Extensions - Inicialização de todas as extensões Flask
app/extensions.py

✅ SQLAlchemy, Bcrypt, JWT, Marshmallow, SocketIO, Migrate
✅ Configurações corretas
✅ Compatível com Python 3.13
"""

from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager
from flask_marshmallow import Marshmallow
from flask_socketio import SocketIO
from flask_migrate import Migrate

# ===============================
# 🗄️ DATABASE
# ===============================
db = SQLAlchemy()

# ===============================
# 🔐 SEGURANÇA
# ===============================
bcrypt = Bcrypt()
jwt = JWTManager()

# ===============================
# 📦 SERIALIZAÇÃO
# ===============================
ma = Marshmallow()

# ===============================
# 🔄 MIGRATIONS
# ===============================
migrate = Migrate()

# ===============================
# 📡 WEBSOCKET
# ===============================
socketio = SocketIO(
    cors_allowed_origins="*",
    async_mode='threading',
    logger=False,
    engineio_logger=False
)


# ===============================
# 🎯 CONFIGURAÇÃO JWT
# ===============================
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    """Handler para token expirado"""
    return {
        'erro': 'Token expirado',
        'mensagem': 'Por favor, faça login novamente'
    }, 401


@jwt.invalid_token_loader
def invalid_token_callback(error):
    """Handler para token inválido"""
    return {
        'erro': 'Token inválido',
        'mensagem': 'Autenticação falhou'
    }, 401


@jwt.unauthorized_loader
def missing_token_callback(error):
    """Handler para token ausente"""
    return {
        'erro': 'Token não fornecido',
        'mensagem': 'Esta rota requer autenticação'
    }, 401


@jwt.revoked_token_loader
def revoked_token_callback(jwt_header, jwt_payload):
    """Handler para token revogado"""
    return {
        'erro': 'Token revogado',
        'mensagem': 'Este token foi invalidado'
    }, 401