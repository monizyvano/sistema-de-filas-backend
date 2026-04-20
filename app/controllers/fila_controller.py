"""
app/controllers/fila_controller.py — CORRIGIDO
Fix: /api/filas/concluir/:id usava FilaService.concluir_atendimento
     que não existe → 500. Agora faz a lógica directamente.
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.fila_service import FilaService
from app.schemas.senha_schema import SenhaSchema
from app.models.senha import Senha
from app.extensions import db
from datetime import datetime

fila_bp    = Blueprint('fila', __name__)
senha_schema = SenhaSchema()


# ── POST /api/filas/chamar ───────────────────────────────────

@fila_bp.route('/chamar', methods=['POST'])
@jwt_required()
def chamar_proxima():
    """Chama a próxima senha da fila."""
    try:
        atendente_id  = int(get_jwt_identity())
        data          = request.get_json() or {}
        servico_id    = data.get('servico_id')
        numero_balcao = data.get('numero_balcao')

        if not servico_id:
            return jsonify({'erro': 'servico_id é obrigatório'}), 400
        if not numero_balcao:
            return jsonify({'erro': 'numero_balcao é obrigatório'}), 400

        senha = FilaService.chamar_proxima(
            servico_id=servico_id,
            atendente_id=atendente_id,
            numero_balcao=numero_balcao
        )

        if not senha:
            return jsonify({
                'erro': 'Nenhuma senha aguardando',
                'mensagem': 'Não há senhas na fila para este serviço'
            }), 404

        return jsonify({
            'mensagem': 'Senha chamada com sucesso',
            'senha':    senha_schema.dump(senha)
        }), 200

    except Exception as e:
        print(f"[ERROR] chamar_proxima: {e}")
        import traceback; traceback.print_exc()
        return jsonify({'erro': 'Erro ao chamar senha'}), 500


# ── PUT /api/filas/concluir/:id ──────────────────────────────

@fila_bp.route('/concluir/<int:senha_id>', methods=['PUT'])
@jwt_required()
def concluir_atendimento(senha_id):
    """
    Conclui o atendimento de uma senha.
    Lógica directa — não depende de FilaService.concluir_atendimento.
    """
    try:
        atendente_id = int(get_jwt_identity())

        senha = Senha.query.get(senha_id)
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404

        # Aceitar qualquer estado activo (robustez)
        if senha.status not in ['atendendo', 'chamada', 'chamando', 'aguardando']:
            return jsonify({
                'erro': f'Senha já está {senha.status}',
                'mensagem': 'Não é possível concluir esta senha'
            }), 400

        agora = datetime.utcnow()

        senha.status                  = 'concluida'
        senha.atendente_id            = atendente_id
        senha.atendimento_concluido_em = agora

        # Calcular tempo de atendimento
        if senha.atendimento_iniciado_em:
            delta = agora - senha.atendimento_iniciado_em
            senha.tempo_atendimento_minutos = max(1, int(delta.total_seconds() / 60))
        elif senha.chamada_em:
            delta = agora - senha.chamada_em
            senha.tempo_atendimento_minutos = max(1, int(delta.total_seconds() / 60))

        # Calcular tempo de espera (se ainda não calculado)
        if not senha.tempo_espera_minutos and senha.emitida_em:
            inicio = senha.atendimento_iniciado_em or senha.chamada_em or agora
            delta  = inicio - senha.emitida_em
            senha.tempo_espera_minutos = max(0, int(delta.total_seconds() / 60))

        db.session.commit()

        print(f"[OK] Senha {senha.numero} concluída pelo atendente {atendente_id}")

        return jsonify({
            'mensagem': f'Atendimento da senha {senha.numero} concluído com sucesso',
            'senha':    senha_schema.dump(senha)
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] concluir_atendimento: {e}")
        import traceback; traceback.print_exc()
        return jsonify({'erro': 'Erro interno ao concluir atendimento'}), 500


# ── GET /api/filas/status/:servico_id ────────────────────────

@fila_bp.route('/status/<int:servico_id>', methods=['GET'])
def obter_status_fila(servico_id):
    try:
        return jsonify(FilaService.obter_status_fila(servico_id)), 200
    except Exception as e:
        return jsonify({'erro': 'Erro ao obter status da fila'}), 500


# ── GET /api/filas/painel/:servico_id ────────────────────────

@fila_bp.route('/painel/<int:servico_id>', methods=['GET'])
def obter_painel_fila(servico_id):
    try:
        return jsonify(FilaService.obter_painel(servico_id)), 200
    except Exception as e:
        return jsonify({'erro': 'Erro ao obter painel'}), 500
    
# ── GET /api/filas/status  (PÚBLICO, sem JWT) ────────────────
 
@fila_bp.route('/status', methods=['GET'])
def obter_status_todas_filas():
    """
    GET /api/filas/status
 
    Devolve o número de senhas aguardando por cada serviço activo.
    Rota pública — não requer JWT.
    Usada pelo dashboard admin e ecrã de TV para tempo real.
 
    Resposta (200):
        {
            "filas": [
                {
                    "servico_id":   1,
                    "nome":         "Secretaria Académica",
                    "icone":        "📄",
                    "aguardando":   3,
                    "atendendo":    1
                },
                ...
            ],
            "total_aguardando": 7,
            "total_atendendo":  2
        }
    """
    try:
        from app.models import Servico, Senha
        from sqlalchemy import func
 
        servicos = Servico.query.filter_by(ativo=True).order_by(Servico.ordem_exibicao).all()
 
        filas   = []
        total_a = 0
        total_e = 0
 
        for s in servicos:
            aguardando = Senha.query.filter_by(
                servico_id=s.id,
                status='aguardando'
            ).count()
 
            atendendo = Senha.query.filter(
                Senha.servico_id == s.id,
                Senha.status.in_(['chamando', 'atendendo'])
            ).count()
 
            total_a += aguardando
            total_e += atendendo
 
            filas.append({
                "servico_id":  s.id,
                "nome":        s.nome,
                "icone":       s.icone or "📋",
                "aguardando":  aguardando,
                "atendendo":   atendendo
            })
 
        return jsonify({
            "filas":             filas,
            "total_aguardando":  total_a,
            "total_atendendo":   total_e
        }), 200
 
    except Exception as e:
        print(f"[ERROR] obter_status_todas_filas: {e}")
        return jsonify({'erro': 'Erro ao obter status das filas'}), 500


# ── PUT /api/filas/cancelar/:id ──────────────────────────────

@fila_bp.route('/cancelar/<int:senha_id>', methods=['PUT'])
@jwt_required()
def cancelar_senha(senha_id):
    try:
        senha = FilaService.cancelar_senha(senha_id)
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404
        return jsonify({
            'mensagem': 'Senha cancelada com sucesso',
            'senha':    senha_schema.dump(senha)
        }), 200
    except Exception as e:
        return jsonify({'erro': 'Erro ao cancelar senha'}), 500