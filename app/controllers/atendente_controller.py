"""
app/controllers/atendente_controller.py — SPRINT 2
═══════════════════════════════════════════════════════════════
CRUD completo de atendentes para o dashboard administrativo.

Rotas:
  GET    /api/atendentes/        – lista todos
  POST   /api/atendentes/        – criar novo
  PUT    /api/atendentes/:id     – editar
  DELETE /api/atendentes/:id     – remover (desactivar)

CORRECÇÕES vs versão anterior:
  ✅ Usa `atendente.tipo` (não `.role` que não existe no model)
  ✅ Usa `atendente.balcao` (não `.numero_balcao`)
  ✅ Inclui `servico_id` na criação e edição
  ✅ DELETE desactiva conta (ativo=False) em vez de apagar
     para preservar histórico de atendimentos
═══════════════════════════════════════════════════════════════
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.atendente import Atendente
from app.models.servico import Servico
from app.extensions import db
from datetime import date
from sqlalchemy import func
from app.models.senha import Senha

atendente_bp = Blueprint('atendente', __name__)


def _verificar_admin():
    """
    Verifica se o utilizador autenticado é administrador.
    Devolve (atendente, erro_json, codigo_http).
    Se não for admin, erro_json não é None.
    """
    user_id = int(get_jwt_identity())
    user    = Atendente.query.get(user_id)

    if not user or user.tipo != 'admin':
        return None, jsonify({"erro": "Acesso negado. Apenas administradores."}), 403

    return user, None, None


# ═══════════════════════════════════════════════════════════════
# GET /api/atendentes/
# ═══════════════════════════════════════════════════════════════

@atendente_bp.route('/', methods=['GET'])
@jwt_required()
def listar_atendentes():
    """
    GET /api/atendentes/

    Lista todos os atendentes com estatísticas do dia.
    Apenas administradores.

    Resposta (200):
        [
            {
                "id": 9, "nome": "Atendente Secretaria",
                "email": "worker1@teste.com",
                "tipo": "atendente", "ativo": true,
                "balcao": 1, "servico_id": 1,
                "departamento": "Secretaria Académica",
                "atendimentos_hoje": 5, "tempo_medio": 8
            },
            ...
        ]
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    try:
        hoje       = date.today()
        atendentes = Atendente.query.order_by(Atendente.nome).all()

        resultado = []
        for a in atendentes:
            # Estatísticas do dia
            senhas_c = Senha.query.filter(
                Senha.atendente_id == a.id,
                Senha.status       == 'concluida',
                func.date(Senha.atendimento_concluido_em) == hoje
            ).all()

            tempos    = [s.tempo_atendimento_minutos for s in senhas_c
                         if s.tempo_atendimento_minutos]
            tempo_med = round(sum(tempos) / len(tempos)) if tempos else 0

            resultado.append({
                "id":               a.id,
                "nome":             a.nome,
                "email":            a.email,
                "tipo":             a.tipo,
                "ativo":            a.ativo,
                "balcao":           a.balcao,
                "servico_id":       a.servico_id,
                "departamento":     a.servico.nome if a.servico else "Geral",
                "atendimentos_hoje": len(senhas_c),
                "tempo_medio":      tempo_med
            })

        return jsonify(resultado), 200

    except Exception as e:
        print(f"❌ Erro ao listar atendentes: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# POST /api/atendentes/
# ═══════════════════════════════════════════════════════════════

@atendente_bp.route('/', methods=['POST'])
@jwt_required()
def criar_atendente():
    """
    POST /api/atendentes/

    Cria novo atendente. Apenas administradores.

    Corpo (JSON):
        {
            "nome":       "João Silva",
            "email":      "joao@imtsb.ao",
            "senha":      "senha123",
            "tipo":       "atendente",   -- opcional, default "atendente"
            "balcao":     1,             -- opcional
            "servico_id": 1              -- opcional
        }

    Resposta (201):
        { "mensagem": "...", "atendente": {...} }
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    try:
        data = request.get_json() or {}

        # Validações obrigatórias
        campos_obrigatorios = ['nome', 'email', 'senha']
        for campo in campos_obrigatorios:
            if not data.get(campo):
                return jsonify({"erro": f"Campo '{campo}' é obrigatório"}), 400

        # Email duplicado
        if Atendente.query.filter_by(email=data['email'].lower()).first():
            return jsonify({"erro": "Este email já está registado"}), 400

        # Balcão já em uso (se fornecido)
        balcao = data.get('balcao')
        if balcao:
            balcao_usado = Atendente.query.filter_by(
                balcao=balcao, ativo=True
            ).first()
            if balcao_usado:
                return jsonify({
                    "erro": f"Balcão {balcao} já está atribuído a {balcao_usado.nome}"
                }), 400

        # Serviço existe (se fornecido)
        servico_id = data.get('servico_id')
        if servico_id and not Servico.query.get(servico_id):
            return jsonify({"erro": f"Serviço ID {servico_id} não encontrado"}), 400

        novo = Atendente(
            nome=data['nome'],
            email=data['email'].lower(),
            senha=data['senha'],
            tipo=data.get('tipo', 'atendente'),
            balcao=balcao,
            servico_id=servico_id
        )

        db.session.add(novo)
        db.session.commit()

        return jsonify({
            "mensagem":  "Atendente criado com sucesso",
            "atendente": {
                "id":         novo.id,
                "nome":       novo.nome,
                "email":      novo.email,
                "tipo":       novo.tipo,
                "balcao":     novo.balcao,
                "servico_id": novo.servico_id
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao criar atendente: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# PUT /api/atendentes/:id
# ═══════════════════════════════════════════════════════════════

@atendente_bp.route('/<int:atendente_id>', methods=['PUT'])
@jwt_required()
def editar_atendente(atendente_id):
    """
    PUT /api/atendentes/:id

    Edita atendente existente. Apenas administradores.

    Corpo (JSON — todos os campos opcionais):
        {
            "nome":       "Novo Nome",
            "email":      "novo@email.com",
            "senha":      "novaSenha",
            "tipo":       "admin",
            "balcao":     2,
            "servico_id": 2,
            "ativo":      true
        }
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    try:
        atendente = Atendente.query.get(atendente_id)
        if not atendente:
            return jsonify({"erro": "Atendente não encontrado"}), 404

        data = request.get_json() or {}

        # Actualizar campos fornecidos
        if 'nome' in data and data['nome']:
            atendente.nome = data['nome']

        if 'email' in data and data['email']:
            email_novo = data['email'].lower()
            # Verificar duplicado (excluindo o próprio)
            existente = Atendente.query.filter_by(email=email_novo).first()
            if existente and existente.id != atendente_id:
                return jsonify({"erro": "Email já em uso por outro atendente"}), 400
            atendente.email = email_novo

        if 'senha' in data and data['senha']:
            atendente.set_senha(data['senha'])

        if 'tipo' in data and data['tipo'] in ['admin', 'atendente']:
            atendente.tipo = data['tipo']

        if 'balcao' in data:
            balcao = data['balcao']
            if balcao:
                # Verificar se balcão está livre
                outro = Atendente.query.filter(
                    Atendente.balcao == balcao,
                    Atendente.ativo  == True,
                    Atendente.id     != atendente_id
                ).first()
                if outro:
                    return jsonify({
                        "erro": f"Balcão {balcao} já atribuído a {outro.nome}"
                    }), 400
            atendente.balcao = balcao

        if 'servico_id' in data:
            sid = data['servico_id']
            if sid and not Servico.query.get(sid):
                return jsonify({"erro": f"Serviço ID {sid} não encontrado"}), 400
            atendente.servico_id = sid

        if 'ativo' in data:
            atendente.ativo = bool(data['ativo'])

        db.session.commit()

        return jsonify({
            "mensagem":  "Atendente actualizado com sucesso",
            "atendente": {
                "id":         atendente.id,
                "nome":       atendente.nome,
                "email":      atendente.email,
                "tipo":       atendente.tipo,
                "ativo":      atendente.ativo,
                "balcao":     atendente.balcao,
                "servico_id": atendente.servico_id
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao editar atendente: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500


# ═══════════════════════════════════════════════════════════════
# DELETE /api/atendentes/:id
# ═══════════════════════════════════════════════════════════════

@atendente_bp.route('/<int:atendente_id>', methods=['DELETE'])
@jwt_required()
def remover_atendente(atendente_id):
    """
    DELETE /api/atendentes/:id

    Desactiva atendente (ativo=False).
    Não apaga o registo para preservar histórico.
    Apenas administradores.
    """
    user, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    try:
        atendente = Atendente.query.get(atendente_id)
        if not atendente:
            return jsonify({"erro": "Atendente não encontrado"}), 404

        # Não pode remover a si próprio
        if atendente.id == user.id:
            return jsonify({"erro": "Não pode remover a sua própria conta"}), 400

        # Não pode remover o único admin
        if atendente.tipo == 'admin':
            admins_ativos = Atendente.query.filter_by(
                tipo='admin', ativo=True
            ).count()
            if admins_ativos <= 1:
                return jsonify({
                    "erro": "Não é possível remover o único administrador activo"
                }), 400

        atendente.ativo  = False
        atendente.balcao = None  # Liberta o balcão

        db.session.commit()

        return jsonify({
            "mensagem": f"Atendente '{atendente.nome}' desactivado com sucesso"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao remover atendente: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500
