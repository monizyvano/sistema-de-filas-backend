"""
app/controllers/senha_controller.py
═══════════════════════════════════════════════════════════════
Controller de Senhas — SPRINT 1 (corrigido)

ALTERAÇÕES:
  ✅ GET /api/senhas aceita `page` e `per_page`.
  ✅ Resposta inclui metadados de paginação.
  ✅ Sem paginação: limite de segurança de 500 registos.
═══════════════════════════════════════════════════════════════
"""

from flask import Blueprint, request, jsonify
from app.services.senha_service import SenhaService
from app.schemas.senha_schema import (
    EmitirSenhaSchema,
    CancelarSenhaSchema,
    IniciarAtendimentoSchema,
    FinalizarAtendimentoSchema,
    SenhaSchema
)
from app.utils.rate_limiter import rate_limit
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, get_jwt_identity

senha_bp = Blueprint('senha', __name__)


# ═══════════════════════════════════════════════════════════════
# POST /api/senhas  (alias: /emitir)
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('/emitir', methods=['POST'])
@senha_bp.route('', methods=['POST'])
@rate_limit(limit=10, window=60)
def emitir_senha():
    """
    POST /api/senhas | POST /api/senhas/emitir
    Emite nova senha de atendimento.
    """
    schema = EmitirSenhaSchema()
    try:
        dados = schema.load(request.get_json() or {})
    except ValidationError as err:
        return jsonify({'erro': 'Dados inválidos', 'detalhes': err.messages}), 400

    try:
        senha = SenhaService.emitir_senha(
            servico_id=dados['servico_id'],
            tipo=dados['tipo'],
            usuario_contato=dados.get('usuario_contato'),
            utente_id=dados.get('utente_id')
        )
        return jsonify({
            'mensagem': 'Senha emitida com sucesso',
            'senha': senha.to_dict()
        }), 201
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Emitir senha: {e}")
        return jsonify({'erro': 'Erro interno ao emitir senha'}), 500


# ═══════════════════════════════════════════════════════════════
# GET /api/senhas
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('', methods=['GET'])
@senha_bp.route('/', methods=['GET'])
def listar_senhas():
    """
    GET /api/senhas

    Query params:
        status      – aguardando | atendendo | concluida | cancelada
        servico_id  – ID do serviço
        atendente_id – ID do atendente
        page        – Página (default: 0 = sem paginação)
        per_page    – Registos por página (default: 15, máx: 100)

    Resposta:
        {
            "senhas": [...],
            "total": 120,
            "page": 1,
            "per_page": 15,
            "total_pages": 8
        }
    """
    try:
        status       = request.args.get('status')
        servico_id   = request.args.get('servico_id', type=int)
        atendente_id = request.args.get('atendente_id', type=int)
        page         = request.args.get('page', default=0, type=int)
        per_page     = request.args.get('per_page', default=15, type=int)

        per_page = min(max(per_page, 1), 100)

        if page > 0:
            resultado = SenhaService.listar_senhas_paginado(
                status=status,
                servico_id=servico_id,
                atendente_id=atendente_id,
                page=page,
                per_page=per_page
            )
            schema  = SenhaSchema(many=True)
            return jsonify({
                'senhas':      schema.dump(resultado.items),
                'total':       resultado.total,
                'page':        resultado.page,
                'per_page':    resultado.per_page,
                'total_pages': resultado.pages
            }), 200
        else:
            senhas  = SenhaService.listar_senhas(
                status=status,
                servico_id=servico_id,
                atendente_id=atendente_id,
                limite=500
            )
            schema  = SenhaSchema(many=True)
            payload = schema.dump(senhas)
            return jsonify({
                'senhas':      payload,
                'total':       len(payload),
                'page':        1,
                'per_page':    len(payload),
                'total_pages': 1
            }), 200

    except Exception as e:
        print(f"[ERROR] Listar senhas: {e}")
        return jsonify({'erro': 'Erro interno ao listar senhas'}), 500


# ═══════════════════════════════════════════════════════════════
# GET /api/senhas/estatisticas
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('/estatisticas', methods=['GET'])
def estatisticas():
    """GET /api/senhas/estatisticas — KPIs do dia (público)."""
    try:
        stats = SenhaService.obter_estatisticas_hoje()
        return jsonify(stats), 200
    except Exception as e:
        print(f"[ERROR] Estatísticas: {e}")
        return jsonify({'erro': 'Erro interno'}), 500


# ═══════════════════════════════════════════════════════════════
# GET /api/senhas/:id
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('/<int:senha_id>', methods=['GET'])
def buscar(senha_id):
    """GET /api/senhas/:id — Busca senha por ID."""
    try:
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        return jsonify(SenhaSchema().dump(senha)), 200
    except Exception:
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# GET /api/senhas/numero/:numero
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('/numero/<string:numero>', methods=['GET'])
def buscar_por_numero(numero):
    """GET /api/senhas/numero/:numero — Busca senha de hoje pelo número."""
    try:
        senha = SenhaService.obter_por_numero(numero)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        return jsonify(SenhaSchema().dump(senha)), 200
    except Exception:
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# PUT /api/senhas/:id/iniciar
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('/<int:senha_id>/iniciar', methods=['PUT'])
@jwt_required()
def iniciar_atendimento(senha_id):
    """PUT /api/senhas/:id/iniciar — Inicia atendimento."""
    try:
        data = IniciarAtendimentoSchema().load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400

    try:
        atendente_id = int(get_jwt_identity())
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404

        senha.iniciar_atendimento(
            atendente_id=atendente_id,
            numero_balcao=data['numero_balcao']
        )
        return jsonify({
            "mensagem": "Atendimento iniciado",
            "senha": SenhaSchema().dump(senha)
        }), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception:
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# PUT /api/senhas/:id/finalizar
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('/<int:senha_id>/finalizar', methods=['PUT'])
@jwt_required()
def finalizar_atendimento(senha_id):
    """PUT /api/senhas/:id/finalizar — Finaliza atendimento."""
    try:
        data = FinalizarAtendimentoSchema().load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400

    try:
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404

        senha.finalizar_atendimento(observacoes=data.get('observacoes'))
        return jsonify({
            "mensagem": "Atendimento finalizado",
            "senha": SenhaSchema().dump(senha)
        }), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception:
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# DELETE /api/senhas/:id/cancelar
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('/<int:senha_id>/cancelar', methods=['DELETE'])
@jwt_required()
def cancelar_senha(senha_id):
    """DELETE /api/senhas/:id/cancelar — Cancela senha aguardando."""
    try:
        data = CancelarSenhaSchema().load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400

    try:
        atendente_id = int(get_jwt_identity())
        SenhaService.cancelar(
            senha_id=senha_id,
            motivo=data['motivo'],
            atendente_id=atendente_id
        )
        return jsonify({"mensagem": "Senha cancelada com sucesso"}), 200
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception:
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# PUT /api/senhas/:id/avaliar
# ═══════════════════════════════════════════════════════════════

@senha_bp.route('/<int:senha_id>/avaliar', methods=['PUT'])
def avaliar_senha(senha_id):
    """PUT /api/senhas/:id/avaliar — Utente avalia atendimento (1-5 estrelas)."""
    try:
        data = request.get_json() or {}
        nota = data.get('nota')
        comentario = data.get('comentario', '')

        if nota is None or not isinstance(nota, int) or nota < 1 or nota > 5:
            return jsonify({"erro": "Nota deve ser um inteiro entre 1 e 5"}), 400

        if comentario and len(comentario) > 500:
            return jsonify({"erro": "Comentario muito longo (max 500 caracteres)"}), 400

        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha nao encontrada"}), 404

        if senha.status != 'concluida':
            return jsonify({"erro": "Apenas senhas concluidas podem ser avaliadas"}), 400

        senha.avaliar(nota=nota, comentario=comentario if comentario else None)

        return jsonify({
            "mensagem": "Avaliacao registada com sucesso",
            "senha": SenhaSchema().dump(senha)
        }), 200

    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception:
        return jsonify({"erro": "Erro interno do servidor"}), 500
