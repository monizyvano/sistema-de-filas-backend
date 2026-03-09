"""
Controller de Senhas - VERSÃO COMPLETA
app/controllers/senha_controller.py

✅ Todas as rotas necessárias
✅ GET /api/senhas - Listar senhas (com filtros opcionais)
✅ POST /api/senhas/emitir - Emitir nova senha
✅ GET /api/senhas/estatisticas - Estatísticas do dia
✅ GET /api/senhas/:id - Buscar senha específica
✅ Compatível com frontend existente
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

# Criar Blueprint
senha_bp = Blueprint('senha', __name__)


@senha_bp.route('/', methods=['GET'])
def listar_senhas():
    """
    ✅ ROTA ADICIONADA - Listar senhas com filtros opcionais
    
    GET /api/senhas
    GET /api/senhas?usuario_id=5
    GET /api/senhas?status=aguardando
    GET /api/senhas?servico_id=1
    
    Response:
        {
            "total": 10,
            "senhas": [...]
        }
    """
    try:
        # Pegar filtros da query string
        usuario_id = request.args.get('usuario_id', type=int)
        status = request.args.get('status')
        servico_id = request.args.get('servico_id', type=int)
        
        # Buscar senhas (service deve implementar filtros)
        senhas = SenhaService.listar_senhas(
            usuario_id=usuario_id,
            status=status,
            servico_id=servico_id
        )
        
        schema = SenhaSchema(many=True)
        
        return jsonify({
            'total': len(senhas),
            'senhas': schema.dump(senhas)
        }), 200
        
    except Exception as e:
        return jsonify({'erro': 'Erro ao listar senhas'}), 500


@senha_bp.route('/emitir', methods=['POST'])
@senha_bp.route('/', methods=['POST'])  # Alias para compatibilidade
@rate_limit(limit=10, window=60)
def emitir_senha():
    """
    Emite nova senha
    
    POST /api/senhas/emitir
    Body: {
        "servico_id": 1,
        "tipo": "normal",
        "usuario_contato": "923456789"
    }
    """
    
    # Validar dados de entrada
    schema = EmitirSenhaSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    # Emitir senha
    try:
        senha = SenhaService.emitir(
            servico_id=dados['servico_id'],
            tipo=dados['tipo'],
            usuario_contato=dados.get('usuario_contato')
        )
        
        senha_schema = SenhaSchema()
        
        return jsonify({
            'mensagem': 'Senha emitida com sucesso',
            'senha': senha_schema.dump(senha)
        }), 201
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        return jsonify({'erro': 'Erro interno ao emitir senha'}), 500


@senha_bp.route('/<int:senha_id>', methods=['GET'])
def buscar(senha_id):
    """
    Buscar senha por ID
    
    GET /api/senhas/5
    """
    try:
        senha = SenhaService.obter_por_id(senha_id)
        
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        
        schema = SenhaSchema()
        return jsonify(schema.dump(senha)), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/numero/<string:numero>', methods=['GET'])
def buscar_por_numero(numero):
    """
    Buscar senha por número
    
    GET /api/senhas/numero/N001
    """
    try:
        senha = SenhaService.obter_por_numero(numero.upper())
        
        if not senha:
            return jsonify({"erro": f"Senha {numero} não encontrada"}), 404
        
        schema = SenhaSchema()
        return jsonify(schema.dump(senha)), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/<int:senha_id>/cancelar', methods=['DELETE'])
@jwt_required()
def cancelar(senha_id):
    """
    Cancelar senha (requer autenticação)
    
    DELETE /api/senhas/5/cancelar
    """
    try:
        schema = CancelarSenhaSchema()
        data = schema.load(request.get_json())
        
        atendente_id = get_jwt_identity()
        
        senha = SenhaService.cancelar(
            senha_id=senha_id,
            motivo=data['motivo'],
            atendente_id=atendente_id
        )
        
        senha_schema = SenhaSchema()
        
        return jsonify({
            "mensagem": "Senha cancelada com sucesso",
            "senha": senha_schema.dump(senha)
        }), 200
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/<int:senha_id>/iniciar', methods=['PUT'])
@jwt_required()
def iniciar_atendimento(senha_id):
    """
    Iniciar atendimento
    
    PUT /api/senhas/5/iniciar
    """
    try:
        schema = IniciarAtendimentoSchema()
        data = schema.load(request.get_json())
        
        atendente_id = int(get_jwt_identity())
        
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        
        senha.iniciar_atendimento(
            atendente_id=atendente_id,
            numero_balcao=data['numero_balcao']
        )
        
        senha_schema = SenhaSchema()
        
        return jsonify({
            "mensagem": "Atendimento iniciado",
            "senha": senha_schema.dump(senha)
        }), 200
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/<int:senha_id>/finalizar', methods=['PUT'])
@jwt_required()
def finalizar_atendimento(senha_id):
    """
    Finalizar atendimento
    
    PUT /api/senhas/5/finalizar
    """
    try:
        schema = FinalizarAtendimentoSchema()
        data = schema.load(request.get_json())
        
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        
        senha.finalizar(observacoes=data.get('observacoes'))
        
        senha_schema = SenhaSchema()
        
        return jsonify({
            "mensagem": "Atendimento finalizado",
            "senha": senha_schema.dump(senha)
        }), 200
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except ValueError as e:
        return jsonify({"erro": str(e)}), 400
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/estatisticas', methods=['GET'])
def estatisticas():
    """
    Estatísticas de senhas do dia
    
    GET /api/senhas/estatisticas
    
    Response:
        {
            "total_emitidas": 42,
            "aguardando": 5,
            "atendendo": 2,
            "concluidas": 35,
            "canceladas": 0,
            "tempo_medio_espera": 12
        }
    """
    try:
        stats = SenhaService.obter_estatisticas_hoje()
        return jsonify(stats), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@senha_bp.route('/hoje', methods=['GET'])
def obter_senhas_hoje():
    """
    Obter todas as senhas emitidas hoje
    
    GET /api/senhas/hoje
    """
    try:
        senhas = SenhaService.obter_senhas_hoje()
        schema = SenhaSchema(many=True)
        
        from datetime import datetime
        
        return jsonify({
            'data': datetime.now().strftime('%Y-%m-%d'),
            'quantidade': len(senhas),
            'senhas': schema.dump(senhas)
        }), 200
        
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500