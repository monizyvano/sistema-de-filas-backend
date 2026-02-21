"""
Controller de Senhas
Rotas: /api/senhas/*
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


@senha_bp.route('/senhas', methods=['POST'])
@rate_limit(limit=10, window=60)  # 10 emissões por minuto
def emitir_senha():
    """Emite nova senha com validação"""
    
    # Validar dados de entrada
    schema = EmitirSenhaSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    # Emitir senha (dados já validados)
    try:
        senha = SenhaService.emitir(
            servico_id=dados['servico_id'],
            tipo=dados['tipo'],
            usuario_contato=dados.get('usuario_contato')
        )
        
        return jsonify({
            'mensagem': 'Senha emitida com sucesso',
            'senha': senha.to_dict()
        }), 201
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        return jsonify({'erro': 'Erro interno ao emitir senha'}), 500


@senha_bp.route('/<int:senha_id>', methods=['GET'])
def buscar(senha_id):
    """Buscar senha por ID
    ---
    tags:
      - Senhas
    parameters:
      - in: path
        name: senha_id
        required: true
        type: integer
        description: ID da senha
        example: 1
    responses:
      200:
        description: Senha encontrada
        schema:
          type: object
          properties:
            id:
              type: integer
              example: 1
            numero:
              type: string
              example: N001
            tipo:
              type: string
              example: normal
            status:
              type: string
              example: aguardando
            servico_id:
              type: integer
              example: 1
            data_emissao:
              type: string
              format: date
              example: "2026-02-21"
      404:
        description: Senha não encontrada
      500:
        description: Erro interno do servidor
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
    GET /api/senhas/numero/:numero
    
    Buscar senha por número (ex: N042)
    
    Response:
        {
            "numero": "N042",
            "status": "aguardando",
            ...
        }
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
    DELETE /api/senhas/:id/cancelar
    
    Cancelar senha (requer autenticação)
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "motivo": "Desistência do utente"
        }
    
    Response:
        {
            "mensagem": "Senha cancelada com sucesso",
            "senha": {...}
        }
    """
    try:
        # Validar dados
        schema = CancelarSenhaSchema()
        data = schema.load(request.get_json())
        
        # Pegar atendente logado
        atendente_id = get_jwt_identity()
        
        # Cancelar senha
        senha = SenhaService.cancelar(
            senha_id=senha_id,
            motivo=data['motivo'],
            atendente_id=atendente_id
        )
        
        # Serializar resposta
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
    """Iniciar atendimento de uma senha
    ---
    tags:
      - Senhas
    security:
      - Bearer: []
    parameters:
      - in: path
        name: senha_id
        required: true
        type: integer
        description: ID da senha
        example: 1
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - numero_balcao
          properties:
            numero_balcao:
              type: integer
              example: 1
              description: Número do balcão de atendimento
    responses:
      200:
        description: Atendimento iniciado com sucesso
        schema:
          type: object
          properties:
            mensagem:
              type: string
              example: Atendimento iniciado
            senha:
              type: object
              description: Dados da senha atualizada
      400:
        description: Dados inválidos
      401:
        description: Não autorizado (JWT inválido)
      404:
        description: Senha não encontrada
      500:
        description: Erro interno do servidor
    """
    try:
        # Validar dados
        schema = IniciarAtendimentoSchema()
        data = schema.load(request.get_json())
        
        # Pegar atendente logado
        atendente_id = get_jwt_identity()
        
        # Buscar senha
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        
        # Iniciar atendimento
        senha.iniciar_atendimento(
            atendente_id=atendente_id,
            numero_balcao=data['numero_balcao']
        )
        
        # Serializar resposta
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
    PUT /api/senhas/:id/finalizar
    
    Finalizar atendimento de uma senha
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "observacoes": "Atendimento realizado com sucesso"
        }
    
    Response:
        {
            "mensagem": "Atendimento finalizado",
            "senha": {...}
        }
    """
    try:
        # Validar dados
        schema = FinalizarAtendimentoSchema()
        data = schema.load(request.get_json())
        
        # Buscar senha
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            return jsonify({"erro": "Senha não encontrada"}), 404
        
        # Finalizar atendimento
        senha.finalizar(observacoes=data.get('observacoes'))
        
        # Serializar resposta
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
    """Estatísticas de senhas do dia
    ---
    tags:
      - Senhas
    responses:
      200:
        description: Estatísticas retornadas com sucesso
        schema:
          type: object
          properties:
            total_emitidas:
              type: integer
              example: 42
              description: Total de senhas emitidas hoje
            aguardando:
              type: integer
              example: 5
              description: Senhas aguardando atendimento
            atendendo:
              type: integer
              example: 2
              description: Senhas em atendimento
            concluidas:
              type: integer
              example: 35
              description: Senhas finalizadas
            canceladas:
              type: integer
              example: 0
              description: Senhas canceladas
      500:
        description: Erro interno do servidor
    """
    try:
        stats = SenhaService.obter_estatisticas_hoje()
        return jsonify(stats), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500
