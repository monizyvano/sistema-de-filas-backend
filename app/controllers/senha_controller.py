"""
Senha Controller - FIX ERROS 500
app/controllers/senha_controller.py

✅ Corrigir chamadas ao service
✅ Filtros corretos
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.senha_service import SenhaService
from app.schemas.senha_schema import SenhaSchema
from datetime import date

senha_bp = Blueprint('senha', __name__)
senha_schema = SenhaSchema()
senhas_schema = SenhaSchema(many=True)


@senha_bp.route('/', methods=['POST'])
@senha_bp.route('/emitir', methods=['POST'])
def emitir_senha():
    """
    ✅ Emitir nova senha
    
    POST /api/senhas/emitir
    Body: {
        "servico_id": 1,
        "tipo": "normal",
        "usuario_contato": "email@example.com"
    }
    """
    try:
        data = request.get_json()
        
        servico_id = data.get('servico_id')
        tipo = data.get('tipo', 'normal')
        usuario_contato = data.get('usuario_contato')
        
        if not servico_id:
            return jsonify({'erro': 'servico_id é obrigatório'}), 400
        
        # Emitir senha
        senha = SenhaService.emitir(
            servico_id=servico_id,
            tipo=tipo,
            usuario_contato=usuario_contato
        )
        
        return jsonify({
            'mensagem': 'Senha emitida com sucesso',
            'senha': senha_schema.dump(senha)
        }), 201
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Emitir senha: {e}")
        return jsonify({'erro': 'Erro ao emitir senha'}), 500


@senha_bp.route('/', methods=['GET'])
def listar_senhas():
    """
    ✅ FIX CRÍTICO - Listar senhas com filtros
    
    GET /api/senhas/?status=aguardando
    GET /api/senhas/?atendente_id=13&status=concluida
    """
    try:
        # Pegar parâmetros query
        atendente_id = request.args.get('atendente_id', type=int)
        status = request.args.get('status')
        servico_id = request.args.get('servico_id', type=int)
        
        print(f"\n[INFO] Listar senhas - Filtros:")
        print(f"  atendente_id: {atendente_id}")
        print(f"  status: {status}")
        print(f"  servico_id: {servico_id}\n")
        
        # Chamar service
        senhas = SenhaService.listar_senhas(
            atendente_id=atendente_id,
            status=status,
            servico_id=servico_id
        )
        
        return jsonify({
            'senhas': senhas_schema.dump(senhas),
            'total': len(senhas)
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Listar senhas: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'erro': 'Erro ao listar senhas'}), 500


@senha_bp.route('/<int:senha_id>', methods=['GET'])
def obter_senha(senha_id):
    """Buscar senha por ID"""
    try:
        senha = SenhaService.obter_por_id(senha_id)
        
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404
        
        return jsonify(senha_schema.dump(senha)), 200
        
    except Exception as e:
        print(f"[ERROR] Obter senha: {e}")
        return jsonify({'erro': 'Erro ao buscar senha'}), 500


@senha_bp.route('/numero/<string:numero>', methods=['GET'])
def obter_senha_por_numero(numero):
    """Buscar senha por número"""
    try:
        senha = SenhaService.obter_por_numero(numero)
        
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404
        
        return jsonify(senha_schema.dump(senha)), 200
        
    except Exception as e:
        print(f"[ERROR] Obter senha por número: {e}")
        return jsonify({'erro': 'Erro ao buscar senha'}), 500


@senha_bp.route('/estatisticas', methods=['GET'])
def obter_estatisticas():
    """
    ✅ Estatísticas gerais do dia
    
    GET /api/senhas/estatisticas
    """
    try:
        stats = SenhaService.obter_estatisticas_hoje()
        return jsonify(stats), 200
        
    except Exception as e:
        print(f"[ERROR] Estatísticas: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'erro': 'Erro ao obter estatísticas'}), 500


@senha_bp.route('/<int:senha_id>/cancelar', methods=['PUT', 'DELETE'])
@jwt_required()
def cancelar_senha(senha_id):
    """Cancelar uma senha"""
    try:
        atendente_id = int(get_jwt_identity())
        data = request.get_json() or {}
        motivo = data.get('motivo', 'Cancelada pelo atendente')
        
        senha = SenhaService.cancelar(senha_id, motivo, atendente_id)
        
        return jsonify({
            'mensagem': 'Senha cancelada com sucesso',
            'senha': senha_schema.dump(senha)
        }), 200
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Cancelar senha: {e}")
        return jsonify({'erro': 'Erro ao cancelar senha'}), 500


@senha_bp.route('/<int:senha_id>/observacoes', methods=['PUT'])
@jwt_required()
def atualizar_observacoes(senha_id):
    """Atualizar observações da senha"""
    try:
        data = request.get_json()
        observacoes = data.get('observacoes', '')
        
        senha = SenhaService.atualizar_observacoes(senha_id, observacoes)
        
        return jsonify({
            'mensagem': 'Observações atualizadas',
            'senha': senha_schema.dump(senha)
        }), 200
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Atualizar observações: {e}")
        return jsonify({'erro': 'Erro ao atualizar observações'}), 500