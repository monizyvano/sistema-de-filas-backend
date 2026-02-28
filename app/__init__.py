"""
Application Factory Pattern
Cria e configura a aplicação Flask
"""
from app.extensions import db, migrate, jwt, bcrypt, ma, socketio
from app.utils.logger import setup_logging
from app.utils.request_logger import log_request
from flasgger import Swagger
from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
from app.config import get_config
import os


def create_app(config_name=None):
    """
    Factory Function - Cria e configura a aplicação
    """

    # Criar aplicação
    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder='../static',
        template_folder='../templates'
    )

    # Carregar configuração
    app.config.from_object(get_config(config_name))

    # Inicializar extensões
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    bcrypt.init_app(app)
    ma.init_app(app)
    socketio.init_app(app)

    # Logging
    setup_logging(app)
    log_request(app)

    app.logger.info('Aplicação iniciada', extra={
        'config': config_name or 'development'
    })

    # ================= SWAGGER =================
    swagger_config = {
        "headers": [],
        "specs": [
            {
                "endpoint": 'apispec',
                "route": '/apispec.json',
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/docs"
    }

    swagger_template = {
        "swagger": "2.0",
        "info": {
            "title": "API Sistema de Filas IMTSB",
            "description": "Sistema Inteligente de Gerenciamento de Filas e Atendimento - IMTSB",
            "version": "1.0.0"
        },
        "host": "localhost:5000",
        "basePath": "/",
        "schemes": ["http"],
        "securityDefinitions": {
            "Bearer": {
                "type": "apiKey",
                "name": "Authorization",
                "in": "header",
                "description": "JWT Token. Use: Bearer {seu_token_aqui}"
            }
        }
    }

    Swagger(app, config=swagger_config, template=swagger_template)

    # ================= CORS =================
    CORS(app, origins=app.config['CORS_ORIGINS'])

    # ================= IMPORTAR MODELS =================
    from app.models import BaseModel, Servico, Senha, Atendente, LogActividade, Configuracao

    # ================= REGISTRAR BLUEPRINTS =================
    register_blueprints(app)

    # ================= ROTAS DO FRONTEND =================

    @app.route('/')
    def home():
        return render_template('principal.html')

    @app.route('/login')
    def login_page():
        return render_template('logintcc.html')

    @app.route('/principal.html')
    def principal():
        return render_template('principal.html')

    @app.route('/index.html')
    @app.route('/painel-usuario')
    def painel_usuario():
        return render_template('index.html')

    @app.route('/dashtrabalho.html')
    @app.route('/painel-trabalhador')
    def painel_trabalhador():
        return render_template('dashtrabalho.html')

    @app.route('/dashadm.html')
    @app.route('/painel-admin')
    def painel_admin():
        return render_template('dashadm.html')

    # Servir arquivos estáticos manualmente (caso necessário)
    @app.route('/static/<path:filename>')
    def serve_static(filename):
        return send_from_directory(app.static_folder, filename)

    # ================= HANDLERS DE ERRO =================
    register_error_handlers(app)

    # Criar pasta de uploads se não existir
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    return app


def register_blueprints(app):
    """Registra todos os blueprints (controllers)"""

    from app.controllers.auth_controller import auth_bp
    from app.controllers.senha_controller import senha_bp
    from app.controllers.fila_controller import fila_bp
    from app.controllers.servico_controller import servico_bp
    from app.controllers.dashboard_controller import dashboard_bp
    from app.controllers.config_controller import config_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(senha_bp, url_prefix='/api')
    app.register_blueprint(fila_bp, url_prefix='/api/filas')
    app.register_blueprint(servico_bp, url_prefix='/api/servicos')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(config_bp, url_prefix='/api')


def register_error_handlers(app):
    """Handlers de erro personalizados"""

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