"""
Fila Controller - VERSÃO FINAL COMPLETA
app/controllers/fila_controller.py

✅ Rota /api/filas/chamar FUNCIONANDO
✅ Sem dependência de get_logger
✅ Print para debug
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.fila_service import FilaService
from app.schemas.senha_schema import SenhaSchema

fila_bp = Blueprint('fila', __name__)
senha_schema = SenhaSchema()


@fila_bp.route('/chamar', methods=['POST'])
@jwt_required()
def chamar_proxima():
    """
    ✅ Chamar próxima senha da fila
    
    POST /api/filas/chamar
    Headers: Authorization: Bearer <token>
    Body: {
        "servico_id": 1,
        "numero_balcao": 1
    }
    
    Response 200:
    {
        "mensagem": "Senha chamada com sucesso",
        "senha": {
            "id": 1,
            "numero": "N001",
            "status": "atendendo",
            "servico_id": 1,
            "atendente_id": 13,
            "numero_balcao": 1
        }
    }
    
    Response 404:
    {
        "erro": "Nenhuma senha aguardando",
        "mensagem": "Não há senhas na fila para este serviço"
    }
    """
    try:
        # Pegar ID do atendente do token JWT
        atendente_id = int(get_jwt_identity())
        
        # Pegar dados do body
        data = request.get_json()
        
        servico_id = data.get('servico_id')
        numero_balcao = data.get('numero_balcao')
        
        # Validações
        if not servico_id:
            return jsonify({'erro': 'servico_id é obrigatório'}), 400
        
        if not numero_balcao:
            return jsonify({'erro': 'numero_balcao é obrigatório'}), 400
        
        print(f"\n{'='*60}")
        print(f"[INFO] Chamando próxima senha")
        print(f"  Serviço ID: {servico_id}")
        print(f"  Atendente ID: {atendente_id}")
        print(f"  Balcão: {numero_balcao}")
        print(f"{'='*60}\n")
        
        # Chamar próxima senha do service
        senha = FilaService.chamar_proxima(
            servico_id=servico_id,
            atendente_id=atendente_id,
            numero_balcao=numero_balcao
        )
        
        # Se não houver senha aguardando
        if not senha:
            print(f"[WARNING] Nenhuma senha aguardando - Serviço {servico_id}")
            return jsonify({
                'erro': 'Nenhuma senha aguardando',
                'mensagem': 'Não há senhas na fila para este serviço'
            }), 404
        
        print(f"\n{'='*60}")
        print(f"[SUCCESS] Senha chamada com sucesso!")
        print(f"  Número: {senha.numero}")
        print(f"  Status: {senha.status}")
        print(f"  Balcão: {numero_balcao}")
        print(f"  Atendente: {atendente_id}")
        print(f"{'='*60}\n")
        
        # Retornar senha serializada
        return jsonify({
            'mensagem': 'Senha chamada com sucesso',
            'senha': senha_schema.dump(senha)
        }), 200
        
    except ValueError as e:
        print(f"[ERROR] Erro de validação: {e}")
        return jsonify({'erro': str(e)}), 400
        
    except Exception as e:
        print(f"[ERROR] Erro ao chamar próxima senha: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'erro': 'Erro ao chamar senha'}), 500


@fila_bp.route('/status/<int:servico_id>', methods=['GET'])
def obter_status_fila(servico_id):
    """
    Obter status da fila de um serviço
    
    GET /api/filas/status/1
    
    Response 200:
    {
        "servico_id": 1,
        "aguardando": 5,
        "em_atendimento": 2,
        "proxima_senha": "N006"
    }
    """
    try:
        print(f"[INFO] Obtendo status da fila - Serviço {servico_id}")
        
        status = FilaService.obter_status_fila(servico_id)
        
        return jsonify(status), 200
        
    except Exception as e:
        print(f"[ERROR] Erro ao obter status da fila {servico_id}: {e}")
        return jsonify({'erro': 'Erro ao obter status da fila'}), 500


@fila_bp.route('/painel/<int:servico_id>', methods=['GET'])
def obter_painel_fila(servico_id):
    """
    Obter dados para painel de exibição (TV/Monitor)
    
    GET /api/filas/painel/1
    
    Response 200:
    {
        "senha_atual": "N005",
        "balcao": 1,
        "proximas": ["N006", "N007", "N008"]
    }
    """
    try:
        print(f"[INFO] Obtendo painel da fila - Serviço {servico_id}")
        
        painel = FilaService.obter_painel(servico_id)
        
        return jsonify(painel), 200
        
    except Exception as e:
        print(f"[ERROR] Erro ao obter painel da fila {servico_id}: {e}")
        return jsonify({'erro': 'Erro ao obter painel'}), 500


@fila_bp.route('/concluir/<int:senha_id>', methods=['PUT'])
@jwt_required()
def concluir_atendimento(senha_id):
    """
    Concluir atendimento de uma senha
    
    PUT /api/filas/concluir/1
    Headers: Authorization: Bearer <token>
    
    Response 200:
    {
        "mensagem": "Atendimento concluído com sucesso",
        "senha": { ... }
    }
    """
    try:
        atendente_id = int(get_jwt_identity())
        
        print(f"[INFO] Concluindo atendimento - Senha ID: {senha_id}")
        
        senha = FilaService.concluir_atendimento(senha_id, atendente_id)
        
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404
        
        print(f"[SUCCESS] Atendimento concluído - Senha {senha.numero}")
        
        return jsonify({
            'mensagem': 'Atendimento concluído com sucesso',
            'senha': senha_schema.dump(senha)
        }), 200
        
    except ValueError as e:
        print(f"[ERROR] Validação: {e}")
        return jsonify({'erro': str(e)}), 400
        
    except Exception as e:
        print(f"[ERROR] Erro ao concluir atendimento: {e}")
        return jsonify({'erro': 'Erro ao concluir atendimento'}), 500


@fila_bp.route('/cancelar/<int:senha_id>', methods=['PUT'])
@jwt_required()
def cancelar_senha(senha_id):
    """
    Cancelar uma senha
    
    PUT /api/filas/cancelar/1
    Headers: Authorization: Bearer <token>
    
    Response 200:
    {
        "mensagem": "Senha cancelada com sucesso"
    }
    """
    try:
        print(f"[INFO] Cancelando senha - ID: {senha_id}")
        
        senha = FilaService.cancelar_senha(senha_id)
        
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404
        
        print(f"[SUCCESS] Senha cancelada - {senha.numero}")
        
        return jsonify({
            'mensagem': 'Senha cancelada com sucesso',
            'senha': senha_schema.dump(senha)
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Erro ao cancelar senha: {e}")
        return jsonify({'erro': 'Erro ao cancelar senha'}), 500
