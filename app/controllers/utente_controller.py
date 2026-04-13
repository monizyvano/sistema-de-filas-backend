"""
app/controllers/utente_controller.py — CORRIGIDO
Adicionado: POST /api/utentes/identificar (login de cliente sem senha)
"""

from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, validates, ValidationError, validate
from app.models.utente import Utente

utente_bp = Blueprint('utente', __name__)


class RegistarUtenteSchema(Schema):
    nome     = fields.String(required=True, validate=validate.Length(min=2, max=150))
    telefone = fields.String(required=False, allow_none=True, validate=validate.Length(max=20), load_default=None)
    email    = fields.Email(required=False, allow_none=True, load_default=None)

    @validates('nome')
    def validar_nome(self, valor, **kwargs):
        if not valor or not valor.strip():
            raise ValidationError('Nome não pode estar vazio')

    @validates('telefone')
    def validar_telefone(self, valor, **kwargs):
        if valor:
            digitos = ''.join(filter(str.isdigit, valor))
            if len(digitos) < 9:
                raise ValidationError('Telefone demasiado curto (mínimo 9 dígitos)')


# ── POST /api/utentes/registar ───────────────────────────────

@utente_bp.route('/registar', methods=['POST'])
def registar_utente():
    """Cria um novo utente ou reaproveita um existente."""
    schema = RegistarUtenteSchema()
    try:
        dados = schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'erro': 'Dados inválidos', 'detalhes': err.messages}), 400

    try:
        utente, criado = Utente.encontrar_ou_criar(
            nome=dados['nome'],
            telefone=dados.get('telefone'),
            email=dados.get('email')
        )
        return jsonify({
            'utente_id': utente.id,
            'id':        utente.id,
            'nome':      utente.nome,
            'email':     utente.email,
            'telefone':  utente.telefone,
            'criado':    criado,
            'mensagem':  'Registo criado' if criado else 'Utente já existe'
        }), 201 if criado else 200
    except Exception as exc:
        print(f"❌ Erro /utentes/registar: {exc}")
        return jsonify({'erro': 'Erro interno do servidor'}), 500


# ── POST /api/utentes/identificar ────────────────────────────

@utente_bp.route('/identificar', methods=['POST'])
def identificar_utente():
    """
    POST /api/utentes/identificar

    Login de cliente — sem senha.
    Identifica pelo email OU telefone.

    Corpo: { "email": "..." } ou { "telefone": "9..." }

    Resposta 200:
        { "utente_id": 1, "nome": "...", "email": "...", "telefone": "..." }
    Resposta 404:
        { "erro": "Conta não encontrada. Faça o cadastro." }
    """
    dados = request.get_json() or {}
    email    = (dados.get('email')    or '').strip().lower()
    telefone = (dados.get('telefone') or '').strip()

    if not email and not telefone:
        return jsonify({'erro': 'Indique email ou telefone.'}), 400

    utente = None

    if email:
        utente = Utente.query.filter_by(email=email, ativo=True).first()

    if not utente and telefone:
        utente = Utente.query.filter_by(telefone=telefone, ativo=True).first()

    if not utente:
        return jsonify({'erro': 'Conta não encontrada. Faça o cadastro.'}), 404

    return jsonify({
        'utente_id': utente.id,
        'id':        utente.id,
        'nome':      utente.nome,
        'email':     utente.email,
        'telefone':  utente.telefone
    }), 200


# ── GET /api/utentes/:id ──────────────────────────────────────

@utente_bp.route('/<int:utente_id>', methods=['GET'])
def consultar_utente(utente_id):
    try:
        utente = Utente.query.get(utente_id)
        if not utente or not utente.ativo:
            return jsonify({'erro': 'Utente não encontrado'}), 404
        return jsonify(utente.to_dict()), 200
    except Exception as exc:
        return jsonify({'erro': 'Erro interno do servidor'}), 500


# ── GET /api/utentes/:id/historico ────────────────────────────

@utente_bp.route('/<int:utente_id>/historico', methods=['GET'])
def historico_utente(utente_id):
    try:
        utente = Utente.query.get(utente_id)
        if not utente or not utente.ativo:
            return jsonify({'erro': 'Utente não encontrado'}), 404

        limite = min(request.args.get('limite', 10, type=int) or 10, 50)
        senhas = utente.senhas.limit(limite).all()

        return jsonify({
            'utente': utente.to_dict(),
            'total_senhas': utente.senhas.count(),
            'senhas': [{
                'id':          s.id,
                'numero':      s.numero,
                'tipo':        s.tipo,
                'status':      s.status,
                'servico':     s.servico.nome if s.servico else None,
                'balcao':      s.numero_balcao,
                'emitida_em':  s.emitida_em.isoformat() if s.emitida_em else None,
                'concluida_em': s.atendimento_concluido_em.isoformat() if s.atendimento_concluido_em else None,
            } for s in senhas]
        }), 200
    except Exception as exc:
        return jsonify({'erro': 'Erro interno do servidor'}), 500