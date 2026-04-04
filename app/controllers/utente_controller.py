"""
app/controllers/utente_controller.py
═══════════════════════════════════════════════════════════════
Controller do Utente — Sprint 2
"""

from flask import Blueprint, request, jsonify
from marshmallow import Schema, fields, validates, ValidationError, validate

from app.models.utente import Utente

utente_bp = Blueprint('utente', __name__)


class RegistarUtenteSchema(Schema):
    """Valida o corpo do POST /api/utentes/registar."""

    nome = fields.String(
        required=True,
        validate=validate.Length(min=2, max=150),
        error_messages={
            'required': 'O nome é obrigatório',
            'invalid': 'Nome inválido'
        }
    )
    telefone = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Length(max=20),
        load_default=None
    )
    email = fields.Email(
        required=False,
        allow_none=True,
        load_default=None
    )

    @validates('nome')
    def validar_nome(self, valor, **kwargs):
        if not valor or not valor.strip():
            raise ValidationError('O nome não pode estar vazio')
        for char in ['<', '>', '"', "'", ';']:
            if char in valor:
                raise ValidationError(f"Caracter '{char}' não permitido no nome")

    @validates('telefone')
    def validar_telefone(self, valor, **kwargs):
        if valor:
            digitos = ''.join(filter(str.isdigit, valor))
            if len(digitos) < 9:
                raise ValidationError('Telefone demasiado curto (mínimo 9 dígitos)')


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
            'nome': utente.nome,
            'criado': criado,
            'mensagem': 'Registo criado com sucesso' if criado else 'Utente identificado com sucesso'
        }), 201 if criado else 200
    except Exception as exc:
        print(f"❌ Erro em /api/utentes/registar: {exc}")
        return jsonify({'erro': 'Erro interno do servidor'}), 500


@utente_bp.route('/<int:utente_id>', methods=['GET'])
def consultar_utente(utente_id):
    """Consulta dados básicos de um utente por ID."""
    try:
        utente = Utente.query.get(utente_id)
        if not utente or not utente.ativo:
            return jsonify({'erro': 'Utente não encontrado'}), 404
        return jsonify(utente.to_dict()), 200
    except Exception as exc:
        print(f"❌ Erro em GET /api/utentes/{utente_id}: {exc}")
        return jsonify({'erro': 'Erro interno do servidor'}), 500


@utente_bp.route('/<int:utente_id>/historico', methods=['GET'])
def historico_utente(utente_id):
    """Retorna o histórico recente de senhas do utente."""
    try:
        utente = Utente.query.get(utente_id)
        if not utente or not utente.ativo:
            return jsonify({'erro': 'Utente não encontrado'}), 404

        limite = min(request.args.get('limite', 10, type=int) or 10, 50)
        senhas = utente.senhas.limit(limite).all()

        lista_senhas = [
            {
                'id': s.id,
                'numero': s.numero,
                'tipo': s.tipo,
                'status': s.status,
                'servico': s.servico.nome if s.servico else None,
                'balcao': s.numero_balcao,
                'emitida_em': s.emitida_em.isoformat() if s.emitida_em else None,
                'concluida_em': s.atendimento_concluido_em.isoformat() if s.atendimento_concluido_em else None,
                'tempo_espera_minutos': s.tempo_espera_minutos,
            }
            for s in senhas
        ]

        return jsonify({
            'utente': utente.to_dict(),
            'total_senhas': utente.senhas.count(),
            'senhas': lista_senhas,
        }), 200
    except Exception as exc:
        print(f"❌ Erro em GET /api/utentes/{utente_id}/historico: {exc}")
        return jsonify({'erro': 'Erro interno do servidor'}), 500
