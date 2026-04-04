"""Rotas Tickets (Compatibilidade)."""

from flask import Blueprint, request, jsonify

from app.controllers.compat.tickets_compat_controller import (
    emitir_ticket,
    chamar_proximo,
    iniciar_atendimento,
    concluir_atendimento,
    reencaminhar_ticket,
    adicionar_nota,
    marcar_recebido,
    avaliar_atendimento,
)

tickets_compat_bp = Blueprint("tickets_compat", __name__)


@tickets_compat_bp.route("/tickets", methods=["POST"])
def emitir():
    dados = request.get_json(silent=True)
    if not dados:
        return jsonify({"ok": False, "message": "Corpo JSON inválido."}), 400
    resposta, codigo = emitir_ticket(dados)
    return jsonify(resposta), codigo


@tickets_compat_bp.route("/tickets/call-next", methods=["POST"])
def chamar():
    resposta, codigo = chamar_proximo(request.get_json(silent=True) or {})
    return jsonify(resposta), codigo


@tickets_compat_bp.route("/tickets/start", methods=["POST"])
def iniciar():
    resposta, codigo = iniciar_atendimento(request.get_json(silent=True) or {})
    return jsonify(resposta), codigo


@tickets_compat_bp.route("/tickets/conclude", methods=["POST"])
def concluir():
    resposta, codigo = concluir_atendimento(request.get_json(silent=True) or {})
    return jsonify(resposta), codigo


@tickets_compat_bp.route("/tickets/redirect", methods=["POST"])
def reencaminhar():
    resposta, codigo = reencaminhar_ticket(request.get_json(silent=True) or {})
    return jsonify(resposta), codigo


@tickets_compat_bp.route("/tickets/note", methods=["POST"])
def nota():
    resposta, codigo = adicionar_nota(request.get_json(silent=True) or {})
    return jsonify(resposta), codigo


@tickets_compat_bp.route("/tickets/received", methods=["POST"])
def recebido():
    resposta, codigo = marcar_recebido(request.get_json(silent=True) or {})
    return jsonify(resposta), codigo


@tickets_compat_bp.route("/tickets/rate", methods=["POST"])
def avaliar():
    resposta, codigo = avaliar_atendimento(request.get_json(silent=True) or {})
    return jsonify(resposta), codigo
