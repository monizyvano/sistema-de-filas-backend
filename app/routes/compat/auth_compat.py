"""
Rotas de autenticação — camada de compatibilidade frontend
Sistema de Filas IMTSB

Rotas:
  GET  /api/auth/health
  POST /api/auth/refresh
  POST /api/auth/logout

Correcção P5:
  POST /api/auth/refresh aceita { "refreshToken": "..." }
  e devolve { "access_token": "..." }
"""

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    decode_token,
    jwt_required,
)
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

auth_compat_bp = Blueprint("auth_compat", __name__)


@auth_compat_bp.get("/auth/health")
def health():
    """GET /api/auth/health — verifica se o servidor está activo."""
    return jsonify({
        "status":  "ok",
        "servico": "API Sistema de Filas IMTSB",
        "hora":    datetime.now(timezone.utc).isoformat(),
    }), 200


@auth_compat_bp.post("/auth/refresh")
def refresh():
    """
    POST /api/auth/refresh
    Body: { "refreshToken": "eyJ..." }
    Devolve: { "access_token": "eyJ..." }

    Usa o refresh token emitido pelo login para gerar um novo access token.
    """
    dados = request.get_json(force=True, silent=True) or {}

    # Aceita "refreshToken" ou "refresh_token"
    refresh_token = (
        dados.get("refreshToken")
        or dados.get("refresh_token")
        or ""
    )

    if not refresh_token:
        return jsonify({"erro": "refreshToken obrigatório"}), 400

    try:
        # Decodifica o refresh token para extrair a identidade
        token_data = decode_token(refresh_token)

        # Verifica que é de facto um refresh token
        if token_data.get("type") != "refresh":
            return jsonify({"erro": "Token inválido — não é um refresh token"}), 401

        identity = token_data.get("sub")
        if not identity:
            return jsonify({"erro": "Token sem identidade"}), 401

        # Emite novo access token com os mesmos claims adicionais
        additional_claims = {}
        for campo in ("tipo", "nome", "balcao", "servico_id"):
            if campo in token_data:
                additional_claims[campo] = token_data[campo]

        novo_access = create_access_token(
            identity=str(identity),
            additional_claims=additional_claims,
        )

        return jsonify({"access_token": novo_access}), 200

    except ExpiredSignatureError:
        return jsonify({"erro": "Refresh token expirado. Faça login novamente."}), 401
    except (InvalidTokenError, Exception) as e:
        return jsonify({"erro": "Token inválido", "detalhe": str(e)}), 401


@auth_compat_bp.post("/auth/logout")
def logout():
    """
    POST /api/auth/logout
    Logout do lado do servidor — pode invalidar token numa blocklist futura.
    Por agora apenas confirma ao cliente que pode limpar os tokens locais.
    """
    return jsonify({
        "ok":       True,
        "mensagem": "Sessão terminada com sucesso.",
    }), 200
