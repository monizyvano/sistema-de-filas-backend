"""
app/controllers/atendente_controller.py — SPRINT 3
═══════════════════════════════════════════════════════════════
CRUD completo de atendentes para o dashboard administrativo.

Rotas:
  GET    /api/atendentes/            – lista todos
  POST   /api/atendentes/            – criar novo
  PUT    /api/atendentes/:id         – editar
  DELETE /api/atendentes/:id         – desactivar
  GET    /api/atendentes/proximo-balcao – próximo balcão livre (util)

CORRECÇÕES SPRINT 3:
  ✅ Balcão automático: se balcão não é enviado OU está ocupado,
     o backend calcula automaticamente o próximo número livre.
     Elimina o erro "Balcão X já está atribuído".
  ✅ Admins nunca recebem balcão (balcao = None).
  ✅ GET /api/atendentes/proximo-balcao expõe o próximo livre.
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


# ───────────────────────────────────────────────────────────────
# HELPER INTERNO — verificar admin
# ───────────────────────────────────────────────────────────────

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


# ───────────────────────────────────────────────────────────────
# HELPER INTERNO — próximo balcão livre
# ───────────────────────────────────────────────────────────────

def _proximo_balcao_livre(excluir_id=None):
    """
    Calcula o próximo número de balcão disponível.
    Começa em 1 e incrementa até encontrar um número não utilizado
    por nenhum atendente activo.

    Args:
        excluir_id: ID do atendente a ignorar na verificação
                    (útil na edição do próprio atendente).

    Returns:
        int — próximo número de balcão livre.
    """
    query = Atendente.query.filter(
        Atendente.ativo    == True,
        Atendente.balcao.isnot(None)
    )
    if excluir_id:
        query = query.filter(Atendente.id != excluir_id)

    # Conjunto de balcões já em uso
    em_uso = {a.balcao for a in query.all()}

    candidato = 1
    while candidato in em_uso:
        candidato += 1

    return candidato


# ═══════════════════════════════════════════════════════════════
# GET /api/atendentes/proximo-balcao
# ═══════════════════════════════════════════════════════════════

@atendente_bp.route('/proximo-balcao', methods=['GET'])
@jwt_required()
def proximo_balcao():
    """
    GET /api/atendentes/proximo-balcao

    Devolve o próximo número de balcão disponível.
    Usado pelo frontend para pré-preencher o campo.

    Resposta (200):
        { "proximo_balcao": 4 }
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    return jsonify({"proximo_balcao": _proximo_balcao_livre()}), 200


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
                "id":                a.id,
                "nome":              a.nome,
                "email":             a.email,
                "tipo":              a.tipo,
                "ativo":             a.ativo,
                "balcao":            a.balcao,
                "servico_id":        a.servico_id,
                "departamento":      a.servico.nome if a.servico else "Geral",
                "atendimentos_hoje": len(senhas_c),
                "tempo_medio":       tempo_med
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
            "nome":       "João Silva",         -- obrigatório
            "email":      "joao@imtsb.ao",      -- obrigatório
            "senha":      "senha123",            -- obrigatório
            "tipo":       "atendente",           -- opcional (default: "atendente")
            "balcao":     1,                     -- opcional (auto se em conflito)
            "servico_id": 1                      -- opcional
        }

    Comportamento do balcão:
        - Se tipo = "admin"     → balcao sempre NULL (admins não têm balcão).
        - Se tipo = "atendente" e balcao não enviado → auto-atribui o próximo livre.
        - Se tipo = "atendente" e balcao enviado mas ocupado → auto-atribui próximo.
        - Se tipo = "atendente" e balcao enviado e livre → usa o valor enviado.

    Resposta (201):
        { "mensagem": "...", "atendente": {...} }
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    try:
        data = request.get_json() or {}

        # — Validações obrigatórias ─────────────────────────────
        for campo in ['nome', 'email', 'senha']:
            if not data.get(campo):
                return jsonify({"erro": f"Campo '{campo}' é obrigatório"}), 400

        # — Email duplicado ──────────────────────────────────────
        if Atendente.query.filter_by(email=data['email'].lower()).first():
            return jsonify({"erro": "Este email já está registado"}), 400

        # — Serviço existe (se fornecido) ────────────────────────
        servico_id = data.get('servico_id')
        if servico_id and not Servico.query.get(servico_id):
            return jsonify({"erro": f"Serviço ID {servico_id} não encontrado"}), 400

        # — Lógica de balcão automático ──────────────────────────
        tipo   = data.get('tipo', 'atendente')
        balcao = None  # admins nunca têm balcão

        if tipo == 'atendente':
            balcao_pedido = data.get('balcao')

            if balcao_pedido:
                # Verificar se o balcão pedido está livre
                em_uso = Atendente.query.filter_by(
                    balcao=balcao_pedido, ativo=True
                ).first()

                if em_uso:
                    # Balcão ocupado → atribuir o próximo livre automaticamente
                    balcao = _proximo_balcao_livre()
                    print(f"[INFO] Balcão {balcao_pedido} ocupado por '{em_uso.nome}'. "
                          f"Atribuído balcão {balcao} automaticamente.")
                else:
                    # Balcão pedido está livre → usar
                    balcao = balcao_pedido
            else:
                # Nenhum balcão pedido → calcular o próximo livre
                balcao = _proximo_balcao_livre()
                print(f"[INFO] Balcão não especificado. Atribuído balcão {balcao} automaticamente.")

        # — Criar atendente ──────────────────────────────────────
        novo = Atendente(
            nome       = data['nome'],
            email      = data['email'].lower(),
            senha      = data['senha'],
            tipo       = tipo,
            balcao     = balcao,
            servico_id = servico_id
        )

        db.session.add(novo)
        db.session.commit()

        print(f"[OK] Atendente '{novo.nome}' criado — balcão: {novo.balcao}")

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
        import traceback; traceback.print_exc()
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
    O mesmo comportamento de balcão automático aplica-se aqui.
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    try:
        atendente = Atendente.query.get(atendente_id)
        if not atendente:
            return jsonify({"erro": "Atendente não encontrado"}), 404

        data = request.get_json() or {}

        # — Nome ─────────────────────────────────────────────────
        if 'nome' in data and data['nome']:
            atendente.nome = data['nome']

        # — Email ────────────────────────────────────────────────
        if 'email' in data and data['email']:
            email_novo = data['email'].lower()
            existente  = Atendente.query.filter_by(email=email_novo).first()
            if existente and existente.id != atendente_id:
                return jsonify({"erro": "Email já em uso por outro atendente"}), 400
            atendente.email = email_novo

        # — Senha ────────────────────────────────────────────────
        if 'senha' in data and data['senha']:
            atendente.set_senha(data['senha'])

        # — Tipo ─────────────────────────────────────────────────
        if 'tipo' in data and data['tipo'] in ['admin', 'atendente']:
            atendente.tipo = data['tipo']

        # — Balcão (automático se em conflito) ───────────────────
        if 'balcao' in data:
            novo_balcao = data['balcao']
            if novo_balcao and atendente.tipo == 'atendente':
                outro = Atendente.query.filter(
                    Atendente.balcao == novo_balcao,
                    Atendente.ativo  == True,
                    Atendente.id     != atendente_id
                ).first()
                if outro:
                    # Conflito → próximo livre (excluindo o próprio)
                    novo_balcao = _proximo_balcao_livre(excluir_id=atendente_id)
                    print(f"[INFO] Conflito de balcão na edição. Atribuído {novo_balcao}.")
            atendente.balcao = novo_balcao

        # — Serviço ──────────────────────────────────────────────
        if 'servico_id' in data:
            sid = data['servico_id']
            if sid and not Servico.query.get(sid):
                return jsonify({"erro": f"Serviço ID {sid} não encontrado"}), 400
            atendente.servico_id = sid

        # — Ativo ────────────────────────────────────────────────
        if 'ativo' in data:
            atendente.ativo = bool(data['ativo'])
            if not atendente.ativo:
                atendente.balcao = None  # Liberta o balcão ao desactivar

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

    Desactiva atendente (ativo=False) e liberta o balcão.
    Não apaga o registo — preserva histórico de atendimentos.
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
            admins_ativos = Atendente.query.filter_by(tipo='admin', ativo=True).count()
            if admins_ativos <= 1:
                return jsonify({
                    "erro": "Não é possível remover o único administrador activo"
                }), 400

        atendente.ativo  = False
        atendente.balcao = None  # Liberta o balcão para outros

        db.session.commit()

        return jsonify({
            "mensagem": f"Atendente '{atendente.nome}' desactivado com sucesso"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao remover atendente: {e}")
        return jsonify({"erro": "Erro interno do servidor"}), 500