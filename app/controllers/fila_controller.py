"""
app/controllers/fila_controller.py — Sprint 4 FIXED
═══════════════════════════════════════════════════════════════
CORRECÇÕES:
  ✅ FIX 400 em /concluir: idempotente — se já concluída devolve 200
  ✅ FIX /concluir: aceita QUALQUER estado activo sem 400
  ✅ PUT /redirecionar/:id funcional com log
  ✅ Todos os endpoints anteriores mantidos
═══════════════════════════════════════════════════════════════
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.fila_service import FilaService
from app.schemas.senha_schema import SenhaSchema
from app.models.senha import Senha
from app.extensions import db
from datetime import datetime

fila_bp      = Blueprint('fila', __name__)
senha_schema = SenhaSchema()


def _log(acao, senha_id=None, atendente_id=None, descricao=None):
    """Regista log sem quebrar o fluxo principal."""
    try:
        from app.models.log_actividade import LogActividade
        db.session.add(LogActividade(
            acao=acao, senha_id=senha_id,
            atendente_id=atendente_id, descricao=descricao
        ))
    except Exception as e:
        print(f"[AVISO] Log falhou (não crítico): {e}")


# ══════════════════════════════════════════════════════════════
# POST /api/filas/chamar
# ══════════════════════════════════════════════════════════════

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


# ══════════════════════════════════════════════════════════════
# PUT /api/filas/concluir/:id  ← FIX PRINCIPAL: sem mais 400
# ══════════════════════════════════════════════════════════════

@fila_bp.route('/concluir/<int:senha_id>', methods=['PUT'])
@jwt_required()
def concluir_atendimento(senha_id):
    """
    Conclui o atendimento de uma senha.

    SPRINT 4 FIX:
    - Idempotente: se já 'concluida' devolve 200 (não 400)
    - Aceita: atendendo, chamando, chamada, aguardando
    - Só rejeita: cancelada
    """
    try:
        atendente_id = int(get_jwt_identity())

        senha = Senha.query.get(senha_id)
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404

        # Idempotente — já concluída devolve 200 sem erro
        if senha.status == 'concluida':
            return jsonify({
                'mensagem': f'Senha {senha.numero} já estava concluída',
                'senha':    senha_schema.dump(senha)
            }), 200

        # Única rejeição: já cancelada
        if senha.status == 'cancelada':
            return jsonify({
                'erro': 'Senha cancelada não pode ser concluída'
            }), 400

        # Aceita QUALQUER outro estado
        agora = datetime.utcnow()
        senha.status                   = 'concluida'
        senha.atendente_id             = atendente_id
        senha.atendimento_concluido_em = agora

        # Tempo de atendimento
        if senha.atendimento_iniciado_em:
            delta = agora - senha.atendimento_iniciado_em
            senha.tempo_atendimento_minutos = max(1, int(delta.total_seconds() / 60))
        elif senha.chamada_em:
            delta = agora - senha.chamada_em
            senha.tempo_atendimento_minutos = max(1, int(delta.total_seconds() / 60))
        else:
            senha.tempo_atendimento_minutos = 1

        # Tempo de espera
        if not senha.tempo_espera_minutos and senha.emitida_em:
            inicio = senha.atendimento_iniciado_em or senha.chamada_em or agora
            delta  = inicio - senha.emitida_em
            senha.tempo_espera_minutos = max(0, int(delta.total_seconds() / 60))

        _log('concluida', senha.id, atendente_id,
             f'Senha {senha.numero} concluída pelo atendente {atendente_id}')

        db.session.commit()
        print(f"[OK] Senha {senha.numero} concluída (atendente {atendente_id})")

        return jsonify({
            'mensagem': f'Atendimento da senha {senha.numero} concluído',
            'senha':    senha_schema.dump(senha)
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] concluir_atendimento: {e}")
        import traceback; traceback.print_exc()
        return jsonify({'erro': 'Erro interno ao concluir atendimento'}), 500


# ══════════════════════════════════════════════════════════════
# PUT /api/filas/redirecionar/:id
# ══════════════════════════════════════════════════════════════

@fila_bp.route('/redirecionar/<int:senha_id>', methods=['PUT'])
@jwt_required()
def redirecionar_senha(senha_id):
    """Redireciona a senha para outro serviço."""
    try:
        atendente_id    = int(get_jwt_identity())
        data            = request.get_json() or {}
        novo_servico_id = data.get('servico_id')
        motivo          = str(data.get('motivo', '') or 'Sem motivo').strip()[:200]

        if not novo_servico_id:
            return jsonify({'erro': 'servico_id é obrigatório'}), 400

        senha = Senha.query.get(senha_id)
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404

        if senha.status in ['concluida', 'cancelada']:
            return jsonify({
                'erro': f'Senha com status "{senha.status}" não pode ser redireccionada'
            }), 400

        from app.models.servico import Servico
        servico_destino = Servico.query.get(novo_servico_id)
        if not servico_destino:
            return jsonify({'erro': f'Serviço ID {novo_servico_id} não encontrado'}), 404
        if not servico_destino.ativo:
            return jsonify({'erro': f'Serviço "{servico_destino.nome}" está inactivo'}), 400

        servico_anterior = senha.servico.nome if senha.servico else '–'

        # Preservar formulário + adicionar nota
        obs_orig = senha.observacoes or ''
        partes   = [p for p in obs_orig.split(' | ')
                    if p.strip() and not p.startswith('REDIR:')]
        partes.insert(0,
            f"REDIR: {servico_anterior} → {servico_destino.nome} | Motivo: {motivo}"
        )
        senha.observacoes             = ' | '.join(filter(None, partes))
        senha.servico_id              = novo_servico_id
        senha.status                  = 'aguardando'
        senha.atendente_id            = None
        senha.numero_balcao           = None
        senha.chamada_em              = None
        senha.atendimento_iniciado_em = None

        _log('redirecionada', senha.id, atendente_id,
             f'Senha {senha.numero}: {servico_anterior} → {servico_destino.nome}. Motivo: {motivo}')

        db.session.commit()
        print(f"[OK] Senha {senha.numero}: {servico_anterior} → {servico_destino.nome}")

        return jsonify({
            'mensagem':        f'Senha {senha.numero} redireccionada para {servico_destino.nome}',
            'senha':           senha_schema.dump(senha),
            'servico_destino': {
                'id':    servico_destino.id,
                'nome':  servico_destino.nome,
                'icone': servico_destino.icone or '📋'
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] redirecionar_senha: {e}")
        import traceback; traceback.print_exc()
        return jsonify({'erro': 'Erro interno ao redirecionar'}), 500


# ══════════════════════════════════════════════════════════════
# GET /api/filas/status  (público, sem JWT)
# ══════════════════════════════════════════════════════════════

@fila_bp.route('/status', methods=['GET'])
def obter_status_todas_filas():
    try:
        from app.models import Servico, Senha
        servicos = Servico.query.filter_by(ativo=True).order_by(Servico.ordem_exibicao).all()
        filas, total_a, total_e = [], 0, 0
        for s in servicos:
            ag = Senha.query.filter_by(servico_id=s.id, status='aguardando').count()
            at = Senha.query.filter(
                Senha.servico_id == s.id,
                Senha.status.in_(['chamando', 'atendendo'])
            ).count()
            total_a += ag; total_e += at
            filas.append({'servico_id': s.id, 'nome': s.nome,
                          'icone': s.icone or '📋', 'aguardando': ag, 'atendendo': at})
        return jsonify({'filas': filas, 'total_aguardando': total_a, 'total_atendendo': total_e}), 200
    except Exception as e:
        print(f"[ERROR] status_filas: {e}")
        return jsonify({'erro': 'Erro ao obter status'}), 500


@fila_bp.route('/status/<int:servico_id>', methods=['GET'])
def obter_status_fila(servico_id):
    try:
        return jsonify(FilaService.obter_status_fila(servico_id)), 200
    except Exception:
        return jsonify({'erro': 'Erro ao obter status da fila'}), 500


@fila_bp.route('/painel/<int:servico_id>', methods=['GET'])
def obter_painel_fila(servico_id):
    try:
        return jsonify(FilaService.obter_painel(servico_id)), 200
    except Exception:
        return jsonify({'erro': 'Erro ao obter painel'}), 500


@fila_bp.route('/cancelar/<int:senha_id>', methods=['PUT'])
@jwt_required()
def cancelar_senha(senha_id):
    try:
        senha = FilaService.cancelar_senha(senha_id)
        if not senha:
            return jsonify({'erro': 'Senha não encontrada'}), 404
        return jsonify({'mensagem': 'Senha cancelada', 'senha': senha_schema.dump(senha)}), 200
    except Exception:
        return jsonify({'erro': 'Erro ao cancelar senha'}), 500