"""
Fila Controller - FIX DEFINITIVO 404
app/controllers/fila_controller.py

✅ FIX: Retorna 200 (não 404) quando não há senha aguardando
✅ Frontend recebe {"mensagem": "...", "senha": null}
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.fila_service import FilaService
from app.schemas.senha_schema import SenhaSchema

fila_bp = Blueprint('fila', __name__)
senha_schema = SenhaSchema()


@fila_bp.route('/chamar', methods=['POST'])
@jwt_required()
def chamar_proxima():
    """
    ✅ FIX DEFINITIVO: Retorna 200 quando fila vazia
    
    Chamar próxima senha da fila
    
    POST /api/filas/chamar
    Authorization: Bearer <token>
    
    Request Body:
    {
        "servico_id": 1,
        "numero_balcao": 1
    }
    
    Response 200 (COM senha):
    {
        "mensagem": "Senha chamada com sucesso",
        "senha": {
            "numero": "N003",
            "status": "atendendo",
            ...
        }
    }
    
    Response 200 (SEM senha - FILA VAZIA):
    {
        "mensagem": "Nenhuma senha aguardando",
        "senha": null
    }
    """
    try:
        # Obter atendente do JWT
        atendente_id = get_jwt_identity()
        
        # Dados do request
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
        
        # ✅ FIX CRÍTICO: Se não houver senha, retornar 200 (não 404)
        if not senha:
            print(f"[INFO] Nenhuma senha aguardando - Serviço {servico_id}")
            return jsonify({
                'mensagem': 'Nenhuma senha aguardando',
                'senha': None  # ✅ null no JSON
            }), 200  # ✅ 200, não 404!
        
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
        status = FilaService.obter_status_fila(servico_id)
        
        return jsonify({
            'servico_id': servico_id,
            'aguardando': status['aguardando'],
            'em_atendimento': status['em_atendimento'],
            'proxima_senha': status.get('proxima_senha')
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Erro ao obter status da fila: {e}")
        return jsonify({'erro': 'Erro ao obter status'}), 500


@fila_bp.route('/historico', methods=['GET'])
@jwt_required()
def obter_historico():
    """
    Obter histórico de chamadas do atendente
    
    GET /api/filas/historico?limite=10
    Authorization: Bearer <token>
    
    Response 200:
    {
        "historico": [
            {
                "numero": "N003",
                "chamada_em": "2026-03-11T02:30:00",
                "status": "concluida"
            }
        ]
    }
    """
    try:
        atendente_id = get_jwt_identity()
        limite = request.args.get('limite', 10, type=int)
        
        historico = FilaService.obter_historico_atendente(atendente_id, limite)
        
        return jsonify({
            'historico': [senha_schema.dump(s) for s in historico]
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Erro ao obter histórico: {e}")
        return jsonify({'erro': 'Erro ao obter histórico'}), 500


@fila_bp.route('/pausar', methods=['POST'])
@jwt_required()
def pausar_atendimento():
    """
    Pausar atendimento do atendente
    
    POST /api/filas/pausar
    Authorization: Bearer <token>
    
    Response 200:
    {
        "mensagem": "Atendimento pausado"
    }
    """
    try:
        atendente_id = get_jwt_identity()
        # TODO: Implementar lógica de pausa
        
        return jsonify({
            'mensagem': 'Atendimento pausado'
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Erro ao pausar atendimento: {e}")
        return jsonify({'erro': 'Erro ao pausar'}), 500


@fila_bp.route('/retomar', methods=['POST'])
@jwt_required()
def retomar_atendimento():
    """
    Retomar atendimento do atendente
    
    POST /api/filas/retomar
    Authorization: Bearer <token>
    
    Response 200:
    {
        "mensagem": "Atendimento retomado"
    }
    """
    try:
        atendente_id = get_jwt_identity()
        # TODO: Implementar lógica de retomada
        
        return jsonify({
            'mensagem': 'Atendimento retomado'
        }), 200
        
    except Exception as e:
        print(f"[ERROR] Erro ao retomar atendimento: {e}")
        return jsonify({'erro': 'Erro ao retomar'}), 500


@fila_bp.route('/estatisticas', methods=['GET'])
@jwt_required()
def obter_estatisticas_fila():
    """
    Obter estatísticas da fila
    
    GET /api/filas/estatisticas
    Authorization: Bearer <token>
    
    Response 200:
    {
        "total_aguardando": 10,
        "total_atendendo": 3,
        "tempo_medio_espera": 5.2
    }
    """
    try:
        stats = FilaService.obter_estatisticas_gerais()
        
        return jsonify(stats), 200
        
    except Exception as e:
        print(f"[ERROR] Erro ao obter estatísticas: {e}")
        return jsonify({'erro': 'Erro ao obter estatísticas'}), 500