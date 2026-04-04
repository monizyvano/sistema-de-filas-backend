"""Rotas Utilizadores/Trabalhadores (Compatibilidade)."""

import logging
from flask import Blueprint, request, jsonify

from app.extensions import db
from app.models.atendente import Atendente
from app.models.utente import Utente

logger = logging.getLogger(__name__)
users_compat_bp = Blueprint("users_compat", __name__)


@users_compat_bp.route("/users/register", methods=["POST"])
def registar_visitante():
    dados = request.get_json(silent=True) or {}
    if not dados:
        return jsonify({"ok": False, "message": "Corpo inválido."}), 400

    nome = str(dados.get("name", "")).strip()
    email = str(dados.get("email", "")).strip().lower()
    telefone = str(dados.get("phone", "")).strip()
    password = str(dados.get("password", ""))

    if not nome:
        return jsonify({"ok": False, "message": "Nome é obrigatório."}), 400
    if email and "@" not in email:
        return jsonify({"ok": False, "message": "E-mail inválido."}), 400
    if password and len(password) < 6:
        return jsonify({"ok": False, "message": "Password mínimo 6 caracteres."}), 400

    try:
        utente, _ = Utente.encontrar_ou_criar(nome=nome, telefone=telefone or None, email=email or None)
        return jsonify({
            "ok": True,
            "message": "Conta criada.",
            "user": {
                "id": str(utente.id),
                "name": utente.nome,
                "email": utente.email or email,
                "role": "usuario",
            },
        }), 201
    except Exception as exc:
        logger.error("Erro criar utente: %s", exc)
        return jsonify({"ok": False, "message": "Erro interno."}), 500


@users_compat_bp.route("/workers", methods=["POST"])
def adicionar_trabalhador():
    dados = request.get_json(silent=True) or {}
    departamento = str(dados.get("department", "")).strip()
    balcao = {
        "secretaria academica": 1,
        "secretaria": 1,
        "tesouraria": 2,
        "contabilidade": 2,
        "apoio ao cliente": 3,
        "apoio": 3,
    }.get(departamento.lower(), 1)

    nome = str(dados.get("name", "")).strip()
    email = str(dados.get("email", "")).strip().lower()
    password = str(dados.get("password", ""))

    if not nome or "@" not in email or len(password) < 6:
        return jsonify({"ok": False, "message": "Dados inválidos."}), 400

    try:
        if Atendente.query.filter_by(email=email).first():
            return jsonify({"ok": False, "message": "E-mail já registado."}), 409

        novo = Atendente(
            nome=nome,
            email=email,
            senha=password,
            tipo="atendente",
            balcao=balcao,
            ativo=True,
        )
        db.session.add(novo)
        db.session.commit()

        return jsonify({
            "ok": True,
            "message": "Trabalhador adicionado.",
            "worker": {
                "id": str(novo.id),
                "name": novo.nome,
                "email": novo.email,
                "department": departamento or "Não atribuído",
                "balcao": balcao,
            },
        }), 201
    except Exception as exc:
        db.session.rollback()
        logger.error("Erro criar trabalhador: %s", exc)
        return jsonify({"ok": False, "message": "Erro interno."}), 500


@users_compat_bp.route("/workers", methods=["GET"])
def listar_trabalhadores():
    try:
        lista = Atendente.query.filter(
            Atendente.tipo.in_(["atendente", "admin"]), Atendente.ativo.is_(True)
        ).order_by(Atendente.nome).all()
        mapa = {1: "Secretaria Académica", 2: "Tesouraria", 3: "Apoio ao Cliente"}
        workers = [
            {
                "id": str(a.id),
                "name": a.nome,
                "email": a.email,
                "role": a.tipo,
                "balcao": a.balcao,
                "department": mapa.get(a.balcao, "Não atribuído"),
            }
            for a in lista
        ]
        return jsonify({"ok": True, "workers": workers}), 200
    except Exception as exc:
        logger.error("Erro listar trabalhadores: %s", exc)
        return jsonify({"ok": False, "message": "Erro interno.", "workers": []}), 500
