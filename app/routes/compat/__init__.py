"""Camada de Compatibilidade — Rotas."""

from flask import Flask


def registar_blueprints_compat(app: Flask) -> None:
    from app.routes.compat.auth_compat import auth_compat_bp
    from app.routes.compat.users_compat import users_compat_bp
    from app.routes.compat.tickets_compat import tickets_compat_bp
    from app.routes.compat.realtime_compat import realtime_compat_bp

    app.register_blueprint(auth_compat_bp, url_prefix="/api")
    app.register_blueprint(users_compat_bp, url_prefix="/api")
    app.register_blueprint(tickets_compat_bp, url_prefix="/api")
    app.register_blueprint(realtime_compat_bp, url_prefix="/api")
