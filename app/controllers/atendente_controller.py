"""
Atendente Controller - VERSÃO COMPLETA
app/controllers/atendente_controller.py

✅ Listar todos os atendentes
✅ Adicionar novo atendente
✅ Remover atendente
✅ Apenas admin pode acessar
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.atendente import Atendente
from app.extensions import db, bcrypt
from marshmallow import ValidationError

atendente_bp = Blueprint('atendente', __name__)


@atendente_bp.route('/', methods=['GET'])
@jwt_required()
def listar_atendentes():
    """
    ✅ Listar todos os atendentes
    
    GET /api/atendentes
    
    Returns:
        [
            {
                "id": int,
                "nome": str,
                "email": str,
                "departamento": str,
                "numero_balcao": int,
                "atendimentos_hoje": int,
                "tempo_medio": int
            }
        ]
    """
    try:
        # Verificar se é admin
        user_id = int(get_jwt_identity())
        user = Atendente.query.get(user_id)
        
        if not user or user.role != 'admin':
            return jsonify({"erro": "Acesso negado"}), 403
        
        # Buscar todos os atendentes (exceto admins)
        atendentes = Atendente.query.filter(
            Atendente.role.in_(['trabalhador', 'atendente'])
        ).all()
        
        # Montar resposta com estatísticas
        resultado = []
        for atendente in atendentes:
            # TODO: Buscar estatísticas reais do banco
            resultado.append({
                'id': atendente.id,
                'nome': atendente.nome,
                'email': atendente.email,
                'departamento': atendente.departamento,
                'numero_balcao': atendente.numero_balcao,
                'atendimentos_hoje': 0,  # TODO: Calcular do banco
                'tempo_medio': 0  # TODO: Calcular do banco
            })
        
        return jsonify(resultado), 200
        
    except Exception as e:
        print(f"❌ Erro ao listar atendentes: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@atendente_bp.route('/', methods=['POST'])
@jwt_required()
def adicionar_atendente():
    """
    ✅ Adicionar novo atendente
    
    POST /api/atendentes
    Body: {
        "nome": "João Silva",
        "email": "joao@imtsb.ao",
        "senha": "senha123",
        "departamento": "Balcão 1 - Secretaria",
        "numero_balcao": 1
    }
    
    Returns:
        {
            "mensagem": "Atendente adicionado com sucesso",
            "atendente": {...}
        }
    """
    try:
        # Verificar se é admin
        user_id = int(get_jwt_identity())
        user = Atendente.query.get(user_id)
        
        if not user or user.role != 'admin':
            return jsonify({"erro": "Acesso negado. Apenas administradores podem adicionar atendentes"}), 403
        
        # Validar dados
        data = request.get_json()
        
        nome = data.get('nome')
        email = data.get('email')
        senha = data.get('senha')
        departamento = data.get('departamento')
        numero_balcao = data.get('numero_balcao', 1)
        
        if not nome or not email or not senha:
            return jsonify({"erro": "Nome, email e senha são obrigatórios"}), 400
        
        # Verificar se email já existe
        if Atendente.query.filter_by(email=email).first():
            return jsonify({"erro": "Email já cadastrado"}), 400
        
        # Criar novo atendente
        novo_atendente = Atendente(
            nome=nome,
            email=email,
            departamento=departamento,
            numero_balcao=numero_balcao,
            role='trabalhador'
        )
        
        # Hash da senha
        novo_atendente.senha_hash = bcrypt.generate_password_hash(senha).decode('utf-8')
        
        # Salvar
        db.session.add(novo_atendente)
        db.session.commit()
        
        return jsonify({
            "mensagem": "Atendente adicionado com sucesso",
            "atendente": {
                "id": novo_atendente.id,
                "nome": novo_atendente.nome,
                "email": novo_atendente.email,
                "departamento": novo_atendente.departamento,
                "numero_balcao": novo_atendente.numero_balcao
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao adicionar atendente: {e}")
        return jsonify({"erro": f"Erro ao adicionar atendente: {str(e)}"}), 500


@atendente_bp.route('/<int:atendente_id>', methods=['DELETE'])
@jwt_required()
def remover_atendente(atendente_id):
    """
    ✅ Remover atendente
    
    DELETE /api/atendentes/:id
    
    Returns:
        {
            "mensagem": "Atendente removido com sucesso"
        }
    """
    try:
        # Verificar se é admin
        user_id = int(get_jwt_identity())
        user = Atendente.query.get(user_id)
        
        if not user or user.role != 'admin':
            return jsonify({"erro": "Acesso negado"}), 403
        
        # Buscar atendente
        atendente = Atendente.query.get(atendente_id)
        
        if not atendente:
            return jsonify({"erro": "Atendente não encontrado"}), 404
        
        # Não permitir remover admin
        if atendente.role == 'admin':
            return jsonify({"erro": "Não é possível remover administradores"}), 400
        
        # Remover
        db.session.delete(atendente)
        db.session.commit()
        
        return jsonify({"mensagem": "Atendente removido com sucesso"}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao remover atendente: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


@atendente_bp.route('/<int:atendente_id>', methods=['PUT'])
@jwt_required()
def atualizar_atendente(atendente_id):
    """
    ✅ Atualizar dados do atendente
    
    PUT /api/atendentes/:id
    Body: {
        "nome": "...",
        "departamento": "...",
        "numero_balcao": 2
    }
    """
    try:
        # Verificar se é admin
        user_id = int(get_jwt_identity())
        user = Atendente.query.get(user_id)
        
        if not user or user.role != 'admin':
            return jsonify({"erro": "Acesso negado"}), 403
        
        # Buscar atendente
        atendente = Atendente.query.get(atendente_id)
        
        if not atendente:
            return jsonify({"erro": "Atendente não encontrado"}), 404
        
        # Atualizar dados
        data = request.get_json()
        
        if 'nome' in data:
            atendente.nome = data['nome']
        if 'departamento' in data:
            atendente.departamento = data['departamento']
        if 'numero_balcao' in data:
            atendente.numero_balcao = data['numero_balcao']
        
        db.session.commit()
        
        return jsonify({
            "mensagem": "Atendente atualizado com sucesso",
            "atendente": {
                "id": atendente.id,
                "nome": atendente.nome,
                "email": atendente.email,
                "departamento": atendente.departamento,
                "numero_balcao": atendente.numero_balcao
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao atualizar atendente: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500
