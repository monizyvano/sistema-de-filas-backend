"""Rotas Tempo Real (Compatibilidade)."""

from flask import Blueprint, request, jsonify

from app.controllers.compat.snapshot_controller import (
    obter_snapshot,
    obter_fila_activa,
    obter_estatisticas,
)

realtime_compat_bp = Blueprint("realtime_compat", __name__)


@realtime_compat_bp.route("/realtime/snapshot", methods=["GET"])
def snapshot():
    servico_id = request.args.get("servico_id", type=int)
    data_str = request.args.get("data", type=str)
    resposta, codigo = obter_snapshot(servico_id=servico_id, data_str=data_str)
    return jsonify(resposta), codigo


@realtime_compat_bp.route("/queue", methods=["GET"])
def fila():
    resposta, codigo = obter_fila_activa(
        servico_id=request.args.get("servico_id", type=int),
        balcao=request.args.get("balcao", type=int),
    )
    return jsonify(resposta), codigo


@realtime_compat_bp.route("/stats", methods=["GET"])
def estatisticas():
    resposta, codigo = obter_estatisticas(data_str=request.args.get("data", type=str))
    return jsonify(resposta), codigo
