"""Rotas Auth (Compatibilidade)."""

import logging
from datetime import datetime, timedelta

import jwt as pyjwt
from flask import Blueprint, request, jsonify, current_app

logger = logging.getLogger(__name__)
auth_compat_bp = Blueprint("auth_compat", __name__)


@auth_compat_bp.route("/auth/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "version": "1.0",
        "servico": "IMTSB Sistema de Filas",
    }), 200


@auth_compat_bp.route("/auth/refresh", methods=["POST"])
def refresh_token():
    dados = request.get_json(silent=True) or {}
    refresh_tk = dados.get("refreshToken", "")

    if not refresh_tk:
        return jsonify({"ok": False, "message": "refreshToken em falta."}), 400

    try:
        secret = current_app.config.get("JWT_SECRET_KEY", "imtsb-secret")
        algoritmo = current_app.config.get("JWT_ALGORITHM", "HS256")

        payload = pyjwt.decode(
            refresh_tk,
            secret,
            algorithms=[algoritmo],
            options={"require": ["exp", "sub", "type"]},
        )

        if payload.get("type") != "refresh":
            return jsonify({"ok": False, "message": "Token não é refresh token."}), 401

        agora = datetime.utcnow()
        novo_payload = {
            "sub": payload["sub"],
            "email": payload.get("email", ""),
            "tipo": payload.get("tipo", "atendente"),
            "type": "access",
            "iat": agora,
            "exp": agora + timedelta(hours=1),
        }
        novo_token = pyjwt.encode(novo_payload, secret, algorithm=algoritmo)

        return jsonify({"ok": True, "accessToken": novo_token, "refreshToken": refresh_tk}), 200
    except Exception as exc:
        logger.warning("Refresh token inválido: %s", exc)
        return jsonify({"ok": False, "message": "Refresh token inválido ou expirado."}), 401


@auth_compat_bp.route("/auth/logout", methods=["POST"])
def logout():
    logger.info("Logout | IP: %s", request.remote_addr)
    return jsonify({"ok": True, "message": "Sessão terminada. Apague os tokens localmente."}), 200
