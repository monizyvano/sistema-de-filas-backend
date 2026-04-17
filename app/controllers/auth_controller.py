"""
app/controllers/auth_controller.py
═══════════════════════════════════════════════════════════════
Controller de Autenticação — SPRINT 1 (corrigido)

ALTERAÇÕES:
  ✅ Resposta de login inclui `servico_id` do atendente.
  ✅ JWT additional_claims inclui `servico_id`.
═══════════════════════════════════════════════════════════════
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity
)
from marshmallow import ValidationError
from datetime import timedelta

from app.models.atendente import Atendente
from app.schemas.auth_schema import (
    LoginSchema,
    RegistrarAtendenteSchema
)
from app.schemas.atendente_schema import AtendenteSchema

auth_bp = Blueprint('auth', __name__)


# ═══════════════════════════════════════════════════════════════
# POST /api/auth/login
# ═══════════════════════════════════════════════════════════════

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    POST /api/auth/login

    Autentica um atendente ou administrador.

    Corpo (JSON):
        { "email": "admin@imtsb.ao", "senha": "admin123" }

    Resposta (200):
        {
            "access_token": "<JWT>",
            "atendente": {
                "id": 1, "nome": "...", "email": "...",
                "tipo": "admin", "ativo": true,
                "balcao": null,
                "servico_id": null   ← SPRINT 1: novo campo
            }
        }
    """
    schema = LoginSchema()
    try:
        dados = schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'erro': 'Dados inválidos', 'detalhes': err.messages}), 400

    atendente = Atendente.query.filter_by(email=dados['email'].lower()).first()

    if not atendente:
        return jsonify({'erro': 'Email ou senha incorrectos'}), 401

    if not atendente.verificar_senha(dados['senha']):
        return jsonify({'erro': 'Email ou senha incorrectos'}), 401

    if not atendente.ativo:
        return jsonify({'erro': 'Conta inactiva. Contacte o administrador.'}), 403

    # SPRINT 1: servico_id incluído nos claims do JWT
    access_token = create_access_token(
        identity=str(atendente.id),
        expires_delta=timedelta(hours=8),
        additional_claims={
            'tipo': atendente.tipo,
            'balcao': atendente.balcao,
            'nome': atendente.nome,
            'servico_id': atendente.servico_id  # ← novo
        }
    )

    return jsonify({
        'access_token': access_token,
        'atendente': {
            'id': atendente.id,
            'nome': atendente.nome,
            'email': atendente.email,
            'tipo': atendente.tipo,
            'ativo': atendente.ativo,
            'balcao': atendente.balcao,
            'servico_id': atendente.servico_id  # ← novo
        }
    }), 200


# ═══════════════════════════════════════════════════════════════
# POST /api/auth/register
# ═══════════════════════════════════════════════════════════════

@auth_bp.route('/register', methods=['POST'])
def register():
    """POST /api/auth/register — Regista novo atendente."""
    try:
        schema = RegistrarAtendenteSchema()
        data = schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400

    if Atendente.query.filter_by(email=data['email'].lower()).first():
        return jsonify({"erro": "Email já registado"}), 400

    try:
        novo = Atendente(
            nome=data['nome'],
            email=data['email'].lower(),
            senha=data['senha'],
            tipo=data.get('tipo', 'atendente'),
            balcao=data.get('balcao'),
            servico_id=data.get('servico_id')  # SPRINT 1
        )
        from app import db
        db.session.add(novo)
        db.session.commit()

        atendente_schema = AtendenteSchema()
        return jsonify({
            "mensagem": "Atendente criado com sucesso",
            "atendente": atendente_schema.dump(novo)
        }), 201
    except Exception:
        from app.extensions import db
        db.session.rollback()
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# GET /api/auth/me
# ═══════════════════════════════════════════════════════════════

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    """GET /api/auth/me — Dados do utilizador autenticado."""
    try:
        atendente_id = int(get_jwt_identity())
        atendente = Atendente.query.get(atendente_id)
        if not atendente:
            return jsonify({"erro": "Utilizador não encontrado"}), 404
        schema = AtendenteSchema()
        return jsonify(schema.dump(atendente)), 200
    except Exception:
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# GET /api/auth/health
# ═══════════════════════════════════════════════════════════════

@auth_bp.route('/health', methods=['GET'])
def health_check():
    """Health check público."""
    return jsonify({'status': 'ok', 'servico': 'API Sistema de Filas IMTSB'}), 200
