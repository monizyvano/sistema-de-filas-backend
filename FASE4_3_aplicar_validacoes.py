# ===== FASE 4.3: APLICAR VALIDAÇÕES NOS CONTROLLERS =====

"""
Atualizar controllers para usar schemas e rate limiting

ARQUIVOS A MODIFICAR:
- app/controllers/senha_controller.py
- app/controllers/auth_controller.py
"""

# ===== SENHA CONTROLLER ATUALIZADO =====

SENHA_CONTROLLER_COMPLETO = """
# app/controllers/senha_controller.py - VERSÃO COM VALIDAÇÕES

from flask import Blueprint, request, jsonify
from app.services.senha_service import SenhaService
from app.schemas.senha_schema import (
    EmitirSenhaSchema, 
    ChamarSenhaSchema,
    IniciarAtendimentoSchema,
    FinalizarAtendimentoSchema,
    CancelarSenhaSchema
)
from app.utils.rate_limiter import rate_limit
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, get_jwt_identity

senha_bp = Blueprint('senha', __name__)


@senha_bp.route('/senhas', methods=['POST'])
@rate_limit(limit=10, window=60)  # 10 emissões por minuto
def emitir_senha():
    '''Emite nova senha com validação robusta'''
    
    # Validar JSON de entrada
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
        
        return jsonify({
            'mensagem': 'Senha emitida com sucesso',
            'senha': senha.to_dict()
        }), 201
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        return jsonify({'erro': 'Erro interno ao emitir senha'}), 500


@senha_bp.route('/filas/chamar', methods=['POST'])
@jwt_required()
@rate_limit(limit=30, window=60)
def chamar_proxima_senha():
    '''Chama próxima senha da fila'''
    
    # Validar dados
    schema = ChamarSenhaSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    # Obter ID do atendente do JWT
    atendente_id = get_jwt_identity()
    
    try:
        senha = SenhaService.chamar_proxima(
            servico_id=dados['servico_id'],
            atendente_id=atendente_id,
            numero_balcao=dados['numero_balcao']
        )
        
        if not senha:
            return jsonify({
                'mensagem': 'Nenhuma senha na fila',
                'senha': None
            }), 200
        
        return jsonify({
            'mensagem': 'Senha chamada com sucesso',
            'senha': senha.to_dict()
        }), 200
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        return jsonify({'erro': 'Erro ao chamar senha'}), 500


@senha_bp.route('/senhas/<int:senha_id>/iniciar', methods=['PUT'])
@jwt_required()
@rate_limit(limit=50, window=60)
def iniciar_atendimento(senha_id):
    '''Inicia atendimento de uma senha'''
    
    # Validar dados
    schema = IniciarAtendimentoSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    atendente_id = get_jwt_identity()
    
    try:
        senha = SenhaService.iniciar_atendimento(
            senha_id=senha_id,
            atendente_id=atendente_id,
            numero_balcao=dados.get('numero_balcao')
        )
        
        return jsonify({
            'mensagem': 'Atendimento iniciado',
            'senha': senha.to_dict()
        }), 200
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        return jsonify({'erro': 'Erro ao iniciar atendimento'}), 500


@senha_bp.route('/senhas/<int:senha_id>/finalizar', methods=['PUT'])
@jwt_required()
@rate_limit(limit=50, window=60)
def finalizar_atendimento(senha_id):
    '''Finaliza atendimento de uma senha'''
    
    # Validar dados
    schema = FinalizarAtendimentoSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    atendente_id = get_jwt_identity()
    
    try:
        senha = SenhaService.finalizar_atendimento(
            senha_id=senha_id,
            atendente_id=atendente_id,
            observacoes=dados.get('observacoes')
        )
        
        return jsonify({
            'mensagem': 'Atendimento finalizado',
            'senha': senha.to_dict()
        }), 200
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        return jsonify({'erro': 'Erro ao finalizar atendimento'}), 500


@senha_bp.route('/senhas/<int:senha_id>/cancelar', methods=['POST'])
@jwt_required()
@rate_limit(limit=20, window=60)
def cancelar_senha(senha_id):
    '''Cancela uma senha'''
    
    # Validar dados
    schema = CancelarSenhaSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    atendente_id = get_jwt_identity()
    
    try:
        senha = SenhaService.cancelar(
            senha_id=senha_id,
            motivo=dados['motivo'],
            atendente_id=atendente_id
        )
        
        return jsonify({
            'mensagem': 'Senha cancelada',
            'senha': senha.to_dict()
        }), 200
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        return jsonify({'erro': 'Erro ao cancelar senha'}), 500


@senha_bp.route('/filas/<int:servico_id>', methods=['GET'])
@rate_limit(limit=30, window=60)
def buscar_fila(servico_id):
    '''Busca fila de um serviço'''
    
    try:
        fila = SenhaService.obter_fila(servico_id=servico_id)
        
        return jsonify({
            'servico_id': servico_id,
            'total': len(fila),
            'fila': [senha.to_dict(include_relationships=False) for senha in fila]
        }), 200
        
    except Exception as e:
        return jsonify({'erro': 'Erro ao buscar fila'}), 500


@senha_bp.route('/servicos', methods=['GET'])
@rate_limit(limit=100, window=60)
def listar_servicos():
    '''Lista todos os serviços ativos'''
    
    try:
        from app.models.servico import Servico
        
        servicos = Servico.query.filter_by(ativo=True).order_by(
            Servico.ordem_exibicao
        ).all()
        
        return jsonify([{
            'id': s.id,
            'nome': s.nome,
            'descricao': s.descricao,
            'icone': s.icone,
            'ativo': s.ativo
        } for s in servicos]), 200
        
    except Exception as e:
        return jsonify({'erro': 'Erro ao listar serviços'}), 500
"""


# ===== AUTH CONTROLLER ATUALIZADO =====

AUTH_CONTROLLER_COMPLETO = """
# app/controllers/auth_controller.py - VERSÃO COM VALIDAÇÕES

from flask import Blueprint, request, jsonify
from app.models.atendente import Atendente
from app.schemas.senha_schema import LoginSchema
from app.utils.rate_limiter import rate_limit
from flask_jwt_extended import create_access_token
from marshmallow import ValidationError
from datetime import timedelta

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
@rate_limit(limit=5, window=300)  # 5 tentativas por 5 minutos (anti brute-force)
def login():
    '''Login de atendente com validação'''
    
    # Validar dados
    schema = LoginSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    # Buscar atendente
    atendente = Atendente.query.filter_by(email=dados['email']).first()
    
    if not atendente or atendente.senha != dados['senha']:
        return jsonify({
            'erro': 'Email ou senha incorretos'
        }), 401
    
    # Gerar token JWT
    access_token = create_access_token(
        identity=atendente.id,
        expires_delta=timedelta(hours=8)
    )
    
    return jsonify({
        'access_token': access_token,
        'atendente': {
            'id': atendente.id,
            'nome': atendente.nome,
            'email': atendente.email,
            'tipo': atendente.tipo,
            'balcao': atendente.balcao
        }
    }), 200


@auth_bp.route('/health', methods=['GET'])
def health_check():
    '''Health check sem rate limit (para monitoramento)'''
    return jsonify({
        'status': 'ok',
        'servico': 'API Sistema de Filas IMTSB'
    }), 200
"""


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 4.3 - APLICAR VALIDAÇÕES NOS CONTROLLERS              ║
╚══════════════════════════════════════════════════════════════╝

PASSO 1: Atualizar senha_controller.py
────────────────────────────────────────────────────────────────
1. Abra: app/controllers/senha_controller.py
2. Adicione imports no topo:

from app.schemas.senha_schema import (
    EmitirSenhaSchema, 
    ChamarSenhaSchema,
    IniciarAtendimentoSchema,
    FinalizarAtendimentoSchema,
    CancelarSenhaSchema
)
from app.utils.rate_limiter import rate_limit
from marshmallow import ValidationError

3. Adicione @rate_limit e validações em cada rota
4. Use o código acima como referência


PASSO 2: Atualizar auth_controller.py
────────────────────────────────────────────────────────────────
1. Abra: app/controllers/auth_controller.py
2. Adicione imports:

from app.schemas.senha_schema import LoginSchema
from app.utils.rate_limiter import rate_limit
from marshmallow import ValidationError

3. Adicione @rate_limit(limit=5, window=300) no login
4. Use o código acima como referência


VALIDAÇÕES APLICADAS:
────────────────────────────────────────────────────────────────
✅ /senhas [POST]           → Schema + 10 req/min
✅ /filas/chamar [POST]     → Schema + JWT + 30 req/min
✅ /senhas/X/iniciar [PUT]  → Schema + JWT + 50 req/min
✅ /senhas/X/finalizar [PUT]→ Schema + JWT + 50 req/min
✅ /senhas/X/cancelar [POST]→ Schema + JWT + 20 req/min
✅ /filas/X [GET]           → 30 req/min
✅ /servicos [GET]          → 100 req/min
✅ /login [POST]            → Schema + 5 req/5min (anti brute-force)

BENEFÍCIOS:
────────────────────────────────────────────────────────────────
✅ Todos os inputs validados antes de processar
✅ Mensagens de erro claras e padronizadas
✅ Proteção contra spam e DDoS
✅ Proteção contra brute force no login
✅ Headers informativos (X-RateLimit-*)
✅ Código mais limpo e seguro

PRÓXIMO: FASE4_4_teste_validacoes.py
    """)
