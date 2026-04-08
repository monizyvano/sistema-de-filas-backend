"""Rotas Tempo Real (Compatibilidade)."""

from flask import Blueprint, jsonify

from app.controllers.compat.snapshot_controller import (
    obter_snapshot,
    obter_fila_activa,
    obter_estatisticas,
)

realtime_compat_bp = Blueprint("realtime_compat", __name__)


@realtime_compat_bp.route("/realtime/snapshot", methods=["GET"])
def snapshot():
    return jsonify(obter_snapshot()), 200


@realtime_compat_bp.route("/queue", methods=["GET"])
def fila():
    return jsonify(obter_fila_activa()), 200


@realtime_compat_bp.route("/stats", methods=["GET"])
def estatisticas():
    return jsonify(obter_estatisticas()), 200
