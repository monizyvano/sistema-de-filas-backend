"""
app/controllers/senha_controller.py — CORRIGIDO
Fix: emitir_senha aceita campo observacoes e passa ao SenhaService.
"""

from flask import Blueprint, request, jsonify
from app.services.senha_service import SenhaService
from app.schemas.senha_schema import (
    EmitirSenhaSchema, CancelarSenhaSchema,
    IniciarAtendimentoSchema, FinalizarAtendimentoSchema, SenhaSchema
)
from app.utils.rate_limiter import rate_limit
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, get_jwt_identity

senha_bp = Blueprint('senha', __name__)


@senha_bp.route('/emitir', methods=['POST'])
@senha_bp.route('', methods=['POST'])
@rate_limit(limit=10, window=60)
def emitir_senha():
    """POST /api/senhas/emitir — Emite nova senha."""
    schema = EmitirSenhaSchema()
    try:
        dados = schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'erro': 'Dados inválidos', 'detalhes': err.messages}), 400

    # Campos extras não validados pelo schema mas aceites
    raw        = request.get_json() or {}
    observacoes = raw.get('observacoes') or None

    try:
        senha = SenhaService.emitir_senha(
            servico_id=dados['servico_id'],
            tipo=dados['tipo'],
            usuario_contato=dados.get('usuario_contato'),
            utente_id=dados.get('utente_id'),
            observacoes=observacoes
        )
        return jsonify({'mensagem': 'Senha emitida com sucesso', 'senha': senha.to_dict()}), 201
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] emitir_senha: {e}")
        return jsonify({'erro': 'Erro interno ao emitir senha'}), 500


@senha_bp.route('', methods=['GET'])
@senha_bp.route('/', methods=['GET'])
def listar_senhas():
    """GET /api/senhas — Lista senhas com filtros."""
    try:
        status       = request.args.get('status')
        servico_id   = request.args.get('servico_id',   type=int)
        atendente_id = request.args.get('atendente_id', type=int)
        page         = request.args.get('page',     default=0,  type=int)
        per_page     = request.args.get('per_page', default=15, type=int)
        per_page     = min(max(per_page, 1), 100)

        if page > 0:
            resultado = SenhaService.listar_senhas_paginado(
                status=status, servico_id=servico_id,
                atendente_id=atendente_id, page=page, per_page=per_page
            )
            schema = SenhaSchema(many=True)
            return jsonify({
                'senhas': schema.dump(resultado.items),
                'total': resultado.total, 'page': resultado.page,
                'per_page': resultado.per_page, 'total_pages': resultado.pages
            }), 200
        else:
            senhas = SenhaService.listar_senhas(
                status=status, servico_id=servico_id,
                atendente_id=atendente_id, limite=500
            )
            payload = SenhaSchema(many=True).dump(senhas)
            return jsonify({'senhas': payload, 'total': len(payload), 'page': 1, 'per_page': len(payload), 'total_pages': 1}), 200
    except Exception as e:
        print(f"[ERROR] listar_senhas: {e}")
        return jsonify({'erro': 'Erro interno ao listar senhas'}), 500


@senha_bp.route('/estatisticas', methods=['GET'])
def estatisticas():
    try:
        return jsonify(SenhaService.obter_estatisticas_hoje()), 200
    except Exception as e:
        return jsonify({'erro': 'Erro interno'}), 500


@senha_bp.route('/<int:senha_id>', methods=['GET'])
def buscar(senha_id):
    try:
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        return jsonify(SenhaSchema().dump(senha)), 200
    except Exception:
        return jsonify({"erro": "Erro interno"}), 500


@senha_bp.route('/numero/<string:numero>', methods=['GET'])
def buscar_por_numero(numero):
    try:
        senha = SenhaService.obter_por_numero(numero)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        return jsonify(SenhaSchema().dump(senha)), 200
    except Exception:
        return jsonify({"erro": "Erro interno"}), 500


@senha_bp.route('/<int:senha_id>/iniciar', methods=['PUT'])
@jwt_required()
def iniciar_atendimento(senha_id):
    try:
        data = IniciarAtendimentoSchema().load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    try:
        atendente_id = int(get_jwt_identity())
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        senha.iniciar_atendimento(atendente_id=atendente_id, numero_balcao=data.get('numero_balcao'))
        return jsonify({"mensagem": "Atendimento iniciado", "senha": SenhaSchema().dump(senha)}), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception:
        return jsonify({"erro": "Erro interno"}), 500


@senha_bp.route('/<int:senha_id>/finalizar', methods=['PUT'])
@jwt_required()
def finalizar_atendimento(senha_id):
    try:
        data = FinalizarAtendimentoSchema().load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    try:
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        senha.finalizar_atendimento(observacoes=data.get('observacoes'))
        return jsonify({"mensagem": "Atendimento finalizado", "senha": SenhaSchema().dump(senha)}), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception:
        return jsonify({"erro": "Erro interno"}), 500


@senha_bp.route('/<int:senha_id>/cancelar', methods=['DELETE'])
@jwt_required()
def cancelar_senha(senha_id):
    try:
        data = CancelarSenhaSchema().load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    try:
        atendente_id = int(get_jwt_identity())
        SenhaService.cancelar(senha_id=senha_id, motivo=data['motivo'], atendente_id=atendente_id)
        return jsonify({"mensagem": "Senha cancelada com sucesso"}), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception:
        return jsonify({"erro": "Erro interno"}), 500