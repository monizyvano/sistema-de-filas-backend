"""
Controller de Autenticação
Rotas: /api/auth/*
"""
from flask import Blueprint, request, jsonify
from marshmallow import ValidationError
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from datetime import timedelta

from app.models.atendente import Atendente  # ← ADICIONAR
from app.schemas.auth_schema import LoginSchema, RegistrarAtendenteSchema
from app.schemas.senha_schema import AtendenteSchema  # ← ADICIONAR
from app.utils.rate_limiter import rate_limit
from app import bcrypt



# Criar Blueprint
auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
@rate_limit(limit=5, window=300)  # 5 tentativas por 5 minutos
def login():
    """Login com validação e rate limiting"""
    
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
    email = dados['email']
    senha = dados['senha']
    
    atendente = Atendente.query.filter_by(email=email).first()
    
    if not atendente:
        return jsonify({'erro': 'Email ou senha incorretos'}), 401
    
    # Verificar senha com bcrypt (CORRIGIDO!)
    from app import bcrypt
    if not bcrypt.check_password_hash(atendente.senha_hash, senha):
        return jsonify({'erro': 'Email ou senha incorretos'}), 401
    
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


@auth_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    """
    POST /api/auth/register
    
    Registrar novo atendente (requer autenticação)
    
    Headers:
        Authorization: Bearer <token>
    
    Body:
        {
            "nome": "Ana Santos",
            "email": "ana@imtsb.ao",
            "senha": "senha123",
            "tipo": "atendente",
            "balcao": 4
        }
    
    Response:
        {
            "mensagem": "Atendente criado com sucesso",
            "atendente": {...}
        }
    """
    try:
        # Validar dados
        schema = RegistrarAtendenteSchema()
        data = schema.load(request.get_json())
        
        # Verificar se email já existe
        if Atendente.query.filter_by(email=data['email']).first():
            return jsonify({"erro": "Email já cadastrado"}), 400
        
        # Criar novo atendente
        novo_atendente = Atendente(
            nome=data['nome'],
            email=data['email'],
            senha=data['senha'],  # ⚠️ IMPORTANTE: Deveria usar hash!
            tipo=data.get('tipo', 'atendente'),
            balcao=data.get('balcao')
        )
        
        from app import db
        db.session.add(novo_atendente)
        db.session.commit()
        
        # Serializar resposta
        atendente_schema = AtendenteSchema()
        
        return jsonify({
            "mensagem": "Atendente criado com sucesso",
            "atendente": atendente_schema.dump(novo_atendente)
        }), 201
    
    except ValidationError as e:
        return jsonify({"erro": "Dados inválidos", "detalhes": e.messages}), 400
    except Exception as e:
        from app import db
        db.session.rollback()
        return jsonify({"erro": "Erro interno do servidor"}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def me():
    """
    GET /api/auth/me
    
    Dados do usuário logado
    
    Headers:
        Authorization: Bearer <token>
    
    Response:
        {
            "id": 1,
            "nome": "Administrador",
            "email": "admin@imtsb.ao",
            ...
        }
    """
    try:
        # Pegar ID do atendente do token JWT
        atendente_id = get_jwt_identity()
        
        # Buscar atendente
        atendente = Atendente.query.get(atendente_id)
        
        if not atendente:
            return jsonify({"erro": "Atendente não encontrado"}), 404
        
        schema = AtendenteSchema()
        return jsonify(schema.dump(atendente)), 200
    
    except Exception as e:
        return jsonify({"erro": "Erro interno do servidor"}), 500


@auth_bp.route('/health', methods=['GET'])
def health_check():
    """Health check detalhado do sistema"""
    from app import db
    import time
    
    health = {
        'status': 'healthy',
        'timestamp': time.time(),
        'service': 'API Sistema de Filas IMTSB',
        'checks': {}
    }
    
    # Check 1: Database
    try:
        db.session.execute(db.text('SELECT 1'))
        health['checks']['database'] = 'ok'
    except Exception as e:
        health['checks']['database'] = 'error'
        health['status'] = 'unhealthy'
    
    # Check 2: Cache (opcional)
    try:
        from app.services.cache_service import CacheService
        stats = CacheService.get_stats()
        health['checks']['cache'] = 'ok'
        health['cache_entries'] = stats['total_entries']
    except Exception:
        health['checks']['cache'] = 'unavailable'
    
    # Retornar status HTTP correto
    status_code = 200 if health['status'] == 'healthy' else 503
    
    return jsonify(health), status_code
