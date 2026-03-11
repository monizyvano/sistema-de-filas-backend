"""
Fila Controller - CORRIGIDO
app/controllers/fila_controller.py

✅ Rota /api/filas/chamar CORRIGIDA
✅ Método POST funcionando
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.fila_service import FilaService
from app.schemas.senha_schema import SenhaSchema
from app.utils.logger import get_logger

logger = get_logger(__name__)

fila_bp = Blueprint('fila', __name__, url_prefix='/api/filas')
senha_schema = SenhaSchema()


@fila_bp.route('/chamar', methods=['POST'])
@jwt_required()
def chamar_proxima():
    """
    ✅ ROTA CORRIGIDA - Chamar próxima senha da fila
    
    POST /api/filas/chamar
    Headers: Authorization: Bearer <token>
    Body: {
        "servico_id": 1,
        "numero_balcao": 1
    }
    
    Response 200: {
        "mensagem": "Senha chamada com sucesso",
        "senha": { ... }
    }
    
    Response 404: {
        "erro": "Nenhuma senha aguardando"
    }
    """
    try:
        atendente_id = get_jwt_identity()
        data = request.get_json()
        
        servico_id = data.get('servico_id')
        numero_balcao = data.get('numero_balcao')
        
        if not servico_id:
            return jsonify({'erro': 'servico_id é obrigatório'}), 400
        
        if not numero_balcao:
            return jsonify({'erro': 'numero_balcao é obrigatório'}), 400
        
        # Chamar próxima senha
        senha = FilaService.chamar_proxima(
            servico_id=servico_id,
            atendente_id=atendente_id,
            numero_balcao=numero_balcao
        )
        
        if not senha:
            logger.warning(f"Nenhuma senha aguardando - Serviço {servico_id}")
            return jsonify({
                'erro': 'Nenhuma senha aguardando',
                'mensagem': 'Não há senhas na fila para este serviço'
            }), 404
        
        logger.info(f"Senha {senha.numero} chamada - Balcão {numero_balcao} - Atendente {atendente_id}")
        
        return jsonify({
            'mensagem': 'Senha chamada com sucesso',
            'senha': senha_schema.dump(senha)
        }), 200
        
    except ValueError as e:
        logger.error(f"Erro de validação ao chamar senha: {e}")
        return jsonify({'erro': str(e)}), 400
    except Exception as e:
        logger.error(f"Erro ao chamar próxima senha: {e}")
        return jsonify({'erro': 'Erro ao chamar senha'}), 500


@fila_bp.route('/status/<int:servico_id>', methods=['GET'])
def obter_status_fila(servico_id):
    """
    Obter status da fila de um serviço
    
    GET /api/filas/status/1
    Response: {
        "servico_id": 1,
        "aguardando": 5,
        "em_atendimento": 2,
        "proxima_senha": "N006"
    }
    """
    try:
        status = FilaService.obter_status_fila(servico_id)
        
        return jsonify(status), 200
        
    except Exception as e:
        logger.error(f"Erro ao obter status da fila {servico_id}: {e}")
        return jsonify({'erro': 'Erro ao obter status da fila'}), 500


@fila_bp.route('/painel/<int:servico_id>', methods=['GET'])
def obter_painel_fila(servico_id):
    """
    Obter dados para painel de exibição (TV/Monitor)
    
    GET /api/filas/painel/1
    Response: {
        "senha_atual": "N005",
        "balcao": 1,
        "proximas": ["N006", "N007", "N008"]
    }
    """
    try:
        painel = FilaService.obter_painel(servico_id)
        
        return jsonify(painel), 200
        
    except Exception as e:
        logger.error(f"Erro ao obter painel da fila {servico_id}: {e}")
        return jsonify({'erro': 'Erro ao obter painel'}), 500
