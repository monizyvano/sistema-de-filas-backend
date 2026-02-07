"""
Application Factory Pattern
Cria e configura a aplicação Flask
"""
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from flask_marshmallow import Marshmallow
from flask_socketio import SocketIO

from app.config import get_config

# Inicializar extensões (sem app ainda)
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
bcrypt = Bcrypt()
ma = Marshmallow()
socketio = SocketIO(cors_allowed_origins="*", async_mode='threading')


def create_app(config_name=None):
    """
    Factory Function - Cria e configura a aplicação
    
    Args:
        config_name (str): Nome da configuração ('development', 'testing', 'production')
    
    Returns:
        Flask: Aplicação configurada
    """
    # Criar aplicação
    app = Flask(__name__, instance_relative_config=True)
    
    # Carregar configuração
    app.config.from_object(get_config(config_name))
    
    # Inicializar extensões com a app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    ma.init_app(app)
    socketio.init_app(app)
    
    # Configurar CORS
    CORS(app, origins=app.config['CORS_ORIGINS'])
    
    # Importar models para que Alembic/Flask-Migrate os detecte
    from app.models import BaseModel, Servico, Senha, Atendente, LogActividade, Configuracao
    
    # Registrar Blueprints (rotas)
    register_blueprints(app)
    
    # Registrar handlers de erro
    register_error_handlers(app)
    
    # Criar pasta de uploads se não existir
    import os
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    return app


def register_blueprints(app):
    """Registra todos os blueprints (controllers)"""
    # Registrar dinamicamente controllers presentes (ignora módulos faltantes)
    controllers = [
        ("app.controllers.auth_controller", "auth_bp", "/api/auth"),
        ("app.controllers.fila_controller", "fila_bp", "/api/filas"),
        ("app.controllers.atendimento_controller", "atendimento_bp", "/api/atendimento"),
        ("app.controllers.documento_controller", "documento_bp", "/api/documentos"),
        ("app.controllers.dashboard_controller", "dashboard_bp", "/api/dashboard"),
    ]

    for module_path, bp_name, url_prefix in controllers:
        try:
            module = __import__(module_path, fromlist=[bp_name])
            bp = getattr(module, bp_name)
            app.register_blueprint(bp, url_prefix=url_prefix)
        except (ImportError, AttributeError):
            # Se o controller não existir, apenas ignora (útil em fases iniciais)
            continue


def register_error_handlers(app):
    """Registra handlers de erro personalizados"""
    
    from flask import jsonify
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"erro": "Recurso não encontrado"}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"erro": "Erro interno do servidor"}), 500
    
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"erro": "Requisição inválida"}), 400
