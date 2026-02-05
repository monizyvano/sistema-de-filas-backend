from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://root:senha@localhost/sistema_filas_imtsb'
    
    db.init_app(app)
    
    # Registrar rotas
    from app.routes import filas_bp
    app.register_blueprint(filas_bp, url_prefix='/api/filas')
    
    return app