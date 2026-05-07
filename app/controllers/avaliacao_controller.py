"""
app/controllers/avaliacao_controller.py
═══════════════════════════════════════════════════════════════
Controller de Avaliações de Atendimento

Rotas:
  POST /api/tickets/rate
       Submete avaliação de um atendimento concluído.

Regras de negócio:
  - Só aceita senhas com status 'concluida'
  - Previne dupla avaliação (UNIQUE constraint + check antecipado)
  - Score obrigatório entre 1 e 5
  - Associa automaticamente ao atendente da senha
  - Regista também nos campos de avaliação da própria tabela senhas
    (retrocompatibilidade com código frontend existente)

Resposta de sucesso (201):
  {
    "ok": true,
    "avaliacao": {
      "id": 42,
      "senha_id": 10,
      "atendente_id": 3,
      "score": 4,
      "comentario": "Bom atendimento",
      "criado_em": "2026-04-07T14:30:00"
    }
  }
═══════════════════════════════════════════════════════════════
"""

import logging
from datetime import datetime

from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, validates, ValidationError, validate, EXCLUDE
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.avaliacao import Avaliacao
from app.models.senha import Senha

logger = logging.getLogger(__name__)

avaliacao_bp = Blueprint("avaliacao", __name__)


# ─────────────────────────────────────────────────────────────
# SCHEMA DE VALIDAÇÃO
# ─────────────────────────────────────────────────────────────

class AvaliacaoSchema(Schema):
    """Valida o corpo do POST /api/tickets/rate."""

    class Meta:
        unknown = EXCLUDE

    ticket_id = fields.Integer(
        required=True,
        validate=validate.Range(min=1),
        error_messages={"required": "ticket_id é obrigatório."}
    )

    score = fields.Integer(
        required=True,
        validate=validate.Range(min=1, max=5),
        error_messages={
            "required": "score é obrigatório.",
            "validator_failed": "score deve ser um inteiro entre 1 e 5."
        }
    )

    comment = fields.String(
        load_default=None,
        allow_none=True,
        validate=validate.Length(max=500)
    )

    @validates("score")
    def validar_score(self, value, **kwargs):
        if not isinstance(value, int) or not 1 <= value <= 5:
            raise ValidationError("score deve ser um inteiro entre 1 e 5.")


# ─────────────────────────────────────────────────────────────
# ENDPOINT: POST /api/tickets/rate
# ─────────────────────────────────────────────────────────────

@avaliacao_bp.route("/rate", methods=["POST"])
def avaliar_atendimento():
    """
    POST /api/tickets/rate

    Submete a avaliação de satisfação de um atendimento.

    Corpo JSON:
        {
            "ticket_id": 10,
            "score":     4,
            "comment":   "Bom atendimento"   (opcional)
        }

    Respostas:
        201 — Avaliação criada com sucesso
        400 — Dados inválidos / score fora do intervalo
        404 — Senha não encontrada
        409 — Avaliação já submetida para esta senha
        422 — Senha não está concluída (não pode ser avaliada)
    """
    # ── Validar dados de entrada ─────────────────────────────
    schema = AvaliacaoSchema()
    try:
        dados = schema.load(request.get_json(silent=True) or {})
    except ValidationError as err:
        return jsonify({
            "ok":       False,
            "message":  "Dados inválidos.",
            "detalhes": err.messages
        }), 400

    senha_id   = dados["ticket_id"]
    score      = dados["score"]
    comentario = (dados.get("comment") or "").strip() or None

    # ── Verificar se senha existe ────────────────────────────
    senha = Senha.query.get(senha_id)
    if not senha:
        return jsonify({
            "ok":      False,
            "message": f"Senha com ID {senha_id} não encontrada."
        }), 404

    # ── Verificar status da senha ────────────────────────────
    if senha.status != "concluida":
        return jsonify({
            "ok":      False,
            "message": (
                f"Não é possível avaliar uma senha com status '{senha.status}'. "
                "Só é permitido avaliar atendimentos concluídos."
            )
        }), 422

    # ── Verificar dupla avaliação (check antecipado) ─────────
    avaliacao_existente = Avaliacao.query.filter_by(senha_id=senha_id).first()
    if avaliacao_existente:
        return jsonify({
            "ok":      False,
            "message": "Esta senha já foi avaliada.",
            "avaliacao": avaliacao_existente.to_dict()
        }), 409

    # ── Criar avaliação ──────────────────────────────────────
    try:
        nova_avaliacao = Avaliacao(
            senha_id=senha_id,
            score=score,
            atendente_id=senha.atendente_id,
            comentario=comentario
        )
        db.session.add(nova_avaliacao)

        # Retrocompatibilidade: actualizar campos na tabela senhas
        senha.avaliacao_nota       = score
        senha.avaliacao_comentario = comentario
        senha.avaliacao_em         = datetime.utcnow()

        db.session.commit()

        logger.info(
            "Avaliação criada: senha=%s score=%s atendente=%s",
            senha_id, score, senha.atendente_id
        )

        return jsonify({
            "ok":        True,
            "message":   "Avaliação registada com sucesso.",
            "avaliacao": nova_avaliacao.to_dict()
        }), 201

    except IntegrityError:
        # Corrida de dados: avaliação criada entre o check e o insert
        db.session.rollback()
        return jsonify({
            "ok":      False,
            "message": "Esta senha já foi avaliada (conflito de dados)."
        }), 409

    except ValueError as err:
        db.session.rollback()
        return jsonify({"ok": False, "message": str(err)}), 400

    except Exception as exc:
        db.session.rollback()
        logger.error("Erro ao criar avaliação: %s", exc, exc_info=True)
        return jsonify({"ok": False, "message": "Erro interno do servidor."}), 500


# ─────────────────────────────────────────────────────────────
# ENDPOINT: GET /api/tickets/rate/<senha_id>
# ─────────────────────────────────────────────────────────────

@avaliacao_bp.route("/rate/<int:senha_id>", methods=["GET"])
def obter_avaliacao(senha_id: int):
    """
    GET /api/tickets/rate/<senha_id>

    Consulta a avaliação de uma senha específica.

    Resposta (200):
        { "ok": true, "avaliacao": { ... } }

    Resposta (404):
        { "ok": false, "message": "Sem avaliação para esta senha." }
    """
    avaliacao = Avaliacao.query.filter_by(senha_id=senha_id).first()
    if not avaliacao:
        return jsonify({
            "ok":      False,
            "message": f"Sem avaliação registada para a senha {senha_id}."
        }), 404

    return jsonify({"ok": True, "avaliacao": avaliacao.to_dict()}), 200