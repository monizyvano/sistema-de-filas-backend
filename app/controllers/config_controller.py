from flask import Blueprint, jsonify
from app.models.servico import Servico

# Criar Blueprint
config_bp = Blueprint('config', __name__)


@config_bp.route('/config', methods=['GET'])
def get_frontend_config():
    """
    Retorna configurações para o frontend
    ---
    tags:
      - Configuração
    responses:
      200:
        description: Configurações retornadas com sucesso
        schema:
          type: object
          properties:
            api_url:
              type: string
              example: http://localhost:5000
            ws_url:
              type: string
              example: ws://localhost:5000
            servicos:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                  nome:
                    type: string
                  icone:
                    type: string
            rate_limits:
              type: object
              properties:
                emitir_senha:
                  type: string
                  example: "10/min"
                login:
                  type: string
                  example: "5/5min"
            features:
              type: object
              properties:
                notificacoes:
                  type: boolean
                websocket:
                  type: boolean
                relatorios:
                  type: boolean
    """
    try:
        # Buscar serviços ativos
        servicos = Servico.query.filter_by(ativo=True).order_by(Servico.ordem_exibicao).all()
        
        config = {
            'api_url': 'http://localhost:5000',
            'ws_url': 'ws://localhost:5000',
            'servicos': [
                {
                    'id': s.id,
                    'nome': s.nome,
                    'descricao': s.descricao,
                    'icone': s.icone,
                    'ordem': s.ordem_exibicao
                }
                for s in servicos
            ],
            'rate_limits': {
                'emitir_senha': '10/min',
                'login': '5/5min',
                'consultas': '30/min'
            },
            'features': {
                'notificacoes': False,  # Ainda não implementado
                'websocket': True,      # SocketIO configurado
                'relatorios': True,     # Estatísticas disponíveis
                'prioridade': True,     # Senhas prioritárias funcionando
                'cancelamento': True    # Cancelamento com motivo
            },
            'versao': '1.0.0',
            'ambiente': 'development'
        }
        
        return jsonify(config), 200
        
    except Exception as e:
        return jsonify({'erro': 'Erro ao buscar configurações'}), 500


@config_bp.route('/servicos-ativos', methods=['GET'])
def get_servicos_ativos():
    """
    Retorna apenas lista de serviços ativos (simplificado)
    ---
    tags:
      - Configuração
    responses:
      200:
        description: Lista de serviços ativos
    """
    try:
        servicos = Servico.query.filter_by(ativo=True).order_by(Servico.ordem_exibicao).all()
        
        return jsonify({
            'servicos': [s.to_dict() for s in servicos]
        }), 200
        
    except Exception as e:
        return jsonify({'erro': 'Erro ao buscar serviços'}), 500