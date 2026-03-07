"""
Configurações da Aplicação
config.py - CORRIGIDO
"""

import os
from datetime import timedelta


class Config:
    """Configurações base (compartilhadas)"""
    
    # ===============================
    # 🔐 SECRET KEYS
    # ===============================
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    
    # ===============================
    # 🗄️ DATABASE
    # ===============================
    DB_NAME = os.getenv('DB_NAME', 'sistema_filas_imtsb')
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '3306')
    
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    
    # Pool de conexões
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'pool_recycle': 3600,
        'pool_pre_ping': True,
        'max_overflow': 20
    }
    
    # ===============================
    # 🔑 JWT
    # ===============================
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    
    # ===============================
    # 🌐 CORS
    # ===============================
    CORS_ORIGINS = [
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'http://localhost:3000',
    ]
    
    # ===============================
    # 📁 UPLOAD
    # ===============================
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'}
    
    # ===============================
    # 🔧 OUTRAS
    # ===============================
    JSON_AS_ASCII = False
    JSON_SORT_KEYS = False
    JSONIFY_PRETTYPRINT_REGULAR = True


class DevelopmentConfig(Config):
    """Configurações de Desenvolvimento"""
    DEBUG = True
    TESTING = False
    ENV = 'development'
    SQLALCHEMY_ECHO = True


class TestingConfig(Config):
    """Configurações de Testes"""
    DEBUG = True
    TESTING = True
    ENV = 'testing'
    
    DB_NAME = 'sistema_filas_imtsb_test'
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{Config.DB_USER}:{Config.DB_PASSWORD}@{Config.DB_HOST}:{Config.DB_PORT}/{DB_NAME}?charset=utf8mb4"
    
    WTF_CSRF_ENABLED = False


class ProductionConfig(Config):
    """Configurações de Produção"""
    DEBUG = False
    TESTING = False
    ENV = 'production'
    
    # Pegar do .env (sem validação no import)
    SECRET_KEY = os.getenv('SECRET_KEY', Config.SECRET_KEY)
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', Config.JWT_SECRET_KEY)
    
    SQLALCHEMY_ECHO = False
    JSONIFY_PRETTYPRINT_REGULAR = False


# ===============================
# 🎯 MAPEAMENTO
# ===============================
config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}


def get_config(config_name=None):
    """Retorna configuração baseada no nome"""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    return config_by_name.get(config_name, DevelopmentConfig)