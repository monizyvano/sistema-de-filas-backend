"""
app/controllers/atendente_controller.py — SPRINT 3 FIXED
═══════════════════════════════════════════════════════════════
BUGS CORRIGIDOS:

  BUG-1  linha 193: `atendente_bp.route(...)` sem `@`
         → rota POST nunca registada + erro silencioso de importação
         FIX: adicionado `@atendente_bp.route('/', methods=['POST'])`

  BUG-2  linha 139: `avaliacao_media * 0.35` onde avaliacao_media
         é `decimal.Decimal` (PyMySQL) e 0.35 é `float`
         → TypeError: unsupported operand type(s) for *: 'Decimal' and 'float'
         → Causa directa do HTTP 500
         FIX: `float()` explícito em todos os scalars do score

  BUG-3  linha 135: `redirecionamentos = redir.scalar()` sem `or 0`
         → None quando não há logs → `None * 0.08` → TypeError
         FIX: `redir.scalar() or 0`

  BUG-4  listar_atendentes devolve só id/nome/balcao + métricas
         → frontend acede a .email, .tipo, .ativo, .departamento
         → campos apareciam como undefined na tabela
         FIX: incluir todos os campos esperados pelo dashadm.js

  BUG-5  comentário errado "# 🏆 TOP 3" acima de criar_atendente
         FIX: comentário corrigido

Rotas:
  GET    /api/atendentes/               – lista todos com métricas
  POST   /api/atendentes/               – criar novo atendente
  PUT    /api/atendentes/:id            – editar atendente
  DELETE /api/atendentes/:id            – desactivar atendente
  GET    /api/atendentes/top            – top 3 por score
  GET    /api/atendentes/proximo-balcao – próximo balcão livre
═══════════════════════════════════════════════════════════════
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.atendente import Atendente
from app.models.senha import Senha
from app.models.log_actividade import LogActividade
from app.extensions import db

from datetime import date, timedelta
from sqlalchemy import func, case

atendente_bp = Blueprint('atendente', __name__)


# ─────────────────────────────────────────────
# 🔐 ADMIN CHECK
# ─────────────────────────────────────────────
def _verificar_admin():
    user_id = int(get_jwt_identity())
    user = Atendente.query.get(user_id)

    if not user or user.tipo != 'admin':
        return None, jsonify({"erro": "Acesso negado"}), 403

    return user, None, None


# ─────────────────────────────────────────────
# 📅 PERÍODO
# ─────────────────────────────────────────────
def _calcular_intervalo(periodo, data_de=None, data_ate=None):
    hoje = date.today()

    if periodo == 'hoje':
        return hoje, hoje

    if periodo == 'semana':
        inicio = hoje - timedelta(days=hoje.weekday())
        return inicio, hoje

    if periodo == 'mes':
        return hoje.replace(day=1), hoje

    if periodo == 'intervalo':
        try:
            di = date.fromisoformat(data_de) if data_de else None
            da = date.fromisoformat(data_ate) if data_ate else hoje
            return di, da
        except Exception:
            return None, hoje

    return None, None  # todos


# ─────────────────────────────────────────────
# 📊 MÉTRICAS — corrigidas (BUG-2 e BUG-3)
# ─────────────────────────────────────────────
def _calcular_metricas(atendente_id, data_inicio, data_fim):
    """
    Calcula métricas de um atendente para o período indicado.

    Retorna dict com:
      total_atendimentos, atendimentos_periodo, tempo_medio,
      avaliacao_media, avaliacao_count, taxa_conclusao,
      redirecionamentos, score
    """

    filtro_data = []
    if data_inicio:
        filtro_data.append(Senha.data_emissao >= data_inicio)
    if data_fim:
        filtro_data.append(Senha.data_emissao <= data_fim)

    # ── Totais base ──────────────────────────────────────────
    base = db.session.query(Senha).filter(
        Senha.atendente_id == atendente_id,
        *filtro_data
    )

    total      = base.count()
    concluidas = db.session.query(Senha).filter(
        Senha.atendente_id == atendente_id,
        Senha.status == 'concluida',
        *filtro_data
    ).count()

    taxa = (concluidas / total * 100) if total > 0 else 0.0

    # ── Tempo médio ───────────────────────────────────────────
    # BUG-2 FIX: float() converte Decimal do PyMySQL para float nativo
    _tempo_raw = db.session.query(
        func.avg(Senha.tempo_atendimento_minutos)
    ).filter(
        Senha.atendente_id == atendente_id,
        Senha.status == 'concluida',
        *filtro_data
    ).scalar()
    tempo_medio = float(_tempo_raw or 0)

    # ── Avaliação (usa campo avaliacao_nota na tabela senhas) ─
    # BUG-2 FIX: float() no scalar de avg()
    _aval_raw = db.session.query(
        func.avg(Senha.avaliacao_nota)
    ).filter(
        Senha.atendente_id == atendente_id,
        Senha.avaliacao_nota.isnot(None),
        Senha.avaliacao_nota > 0,
        *filtro_data
    ).scalar()
    avaliacao_media = float(_aval_raw or 0)

    avaliacao_count = db.session.query(
        func.count(Senha.id)
    ).filter(
        Senha.atendente_id == atendente_id,
        Senha.avaliacao_nota.isnot(None),
        Senha.avaliacao_nota > 0,
        *filtro_data
    ).scalar() or 0

    # ── Redirecionamentos ─────────────────────────────────────
    # BUG-3 FIX: garantir `or 0` para não obter None
    redir_q = db.session.query(func.count(LogActividade.id)).filter(
        LogActividade.atendente_id == atendente_id,
        LogActividade.acao == 'redirecionada'
    )
    if data_inicio:
        redir_q = redir_q.filter(
            func.date(LogActividade.created_at) >= data_inicio
        )
    if data_fim:
        redir_q = redir_q.filter(
            func.date(LogActividade.created_at) <= data_fim
        )
    redirecionamentos = redir_q.scalar() or 0

    # ── Score composto ────────────────────────────────────────
    # BUG-2 FIX: todas as variáveis agora são float — sem mistura Decimal/float
    score = (
        (avaliacao_media * 20.0) * 0.35 +
        float(taxa)              * 0.25 +
        float(total)             * 0.20 +
        (1.0 / (tempo_medio + 1.0)) * 100.0 * 0.12 +
        float(redirecionamentos) * 0.08
    )

    return {
        "total_atendimentos":   total,
        "atendimentos_periodo": concluidas,
        "atendimentos_hoje":    concluidas,   # alias p/ compatibilidade dashadm.js
        "tempo_medio":          round(tempo_medio, 2),
        "avaliacao_media":      round(avaliacao_media, 2),
        "avaliacao_count":      avaliacao_count,
        "taxa_conclusao":       round(float(taxa), 2),
        "redirecionamentos":    redirecionamentos,
        "score":                round(score, 2),
    }


# ─────────────────────────────────────────────
# 📋 LISTAR ATENDENTES — BUG-4 corrigido
# ─────────────────────────────────────────────
@atendente_bp.route('/', methods=['GET'])
@jwt_required()
def listar_atendentes():
    """
    GET /api/atendentes/

    Query params:
      periodo  — hoje | semana | mes | intervalo (default: hoje)
      data_de  — YYYY-MM-DD (usado com periodo=intervalo)
      data_ate — YYYY-MM-DD (usado com periodo=intervalo)

    Resposta: lista de atendentes com métricas e score.
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    periodo  = request.args.get('periodo', 'hoje')
    data_de  = request.args.get('data_de')
    data_ate = request.args.get('data_ate')

    data_inicio, data_fim = _calcular_intervalo(periodo, data_de, data_ate)

    try:
        atendentes = Atendente.query.filter_by(ativo=True).all()
    except Exception as e:
        print(f"[ERROR] listar_atendentes query: {e}")
        return jsonify({"erro": "Erro ao carregar atendentes"}), 500

    resultado = []
    for a in atendentes:
        try:
            metricas = _calcular_metricas(a.id, data_inicio, data_fim)
        except Exception as e:
            print(f"[WARN] _calcular_metricas atendente {a.id}: {e}")
            # Incluir com métricas zeradas em vez de crashar tudo
            metricas = {
                "total_atendimentos":   0,
                "atendimentos_periodo": 0,
                "atendimentos_hoje":    0,
                "tempo_medio":          0.0,
                "avaliacao_media":      0.0,
                "avaliacao_count":      0,
                "taxa_conclusao":       0.0,
                "redirecionamentos":    0,
                "score":               0.0,
            }

        # BUG-4 FIX: incluir todos os campos que o dashadm.js consome
        resultado.append({
            "id":          a.id,
            "nome":        a.nome,
            "email":       a.email,
            "balcao":      a.balcao,
            "tipo":        a.tipo,
            "ativo":       a.ativo,
            "departamento": (a.servico.nome if getattr(a, 'servico', None) else "Geral"),
            **metricas,
        })

    return jsonify(resultado)


# ─────────────────────────────────────────────
# ➕ CRIAR ATENDENTE — BUG-1 corrigido
# ─────────────────────────────────────────────
@atendente_bp.route('/', methods=['POST'])   # BUG-1 FIX: `@` adicionado
@jwt_required()
def criar_atendente():
    """
    POST /api/atendentes/

    Body JSON:
      { "nome", "email", "senha", "tipo", "servico_id" }

    Resposta (201):
      { "mensagem": "...", "atendente": {...} }
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    data = request.get_json(silent=True) or {}

    nome       = str(data.get('nome',  '')).strip()
    email      = str(data.get('email', '')).strip().lower()
    senha      = str(data.get('senha', ''))
    tipo       = data.get('tipo', 'atendente')
    servico_id = data.get('servico_id')

    if not nome or not email or not senha:
        return jsonify({"erro": "nome, email e senha são obrigatórios"}), 400
    if len(senha) < 6:
        return jsonify({"erro": "senha mínimo 6 caracteres"}), 400
    if tipo not in ('admin', 'atendente'):
        return jsonify({"erro": "tipo deve ser 'admin' ou 'atendente'"}), 400

    if Atendente.query.filter_by(email=email).first():
        return jsonify({"erro": "Email já registado"}), 409

    try:
        novo = Atendente(
            nome=nome,
            email=email,
            senha=senha,
            tipo=tipo,
            servico_id=servico_id,
            ativo=True
        )
        db.session.add(novo)
        db.session.commit()
        return jsonify({
            "mensagem":  "Atendente criado com sucesso",
            "atendente": novo.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] criar_atendente: {e}")
        return jsonify({"erro": "Erro interno ao criar atendente"}), 500


# ─────────────────────────────────────────────
# ✏️  EDITAR ATENDENTE
# ─────────────────────────────────────────────
@atendente_bp.route('/<int:atendente_id>', methods=['PUT'])
@jwt_required()
def editar_atendente(atendente_id):
    """
    PUT /api/atendentes/:id

    Body JSON (campos opcionais):
      { "nome", "email", "tipo", "balcao", "servico_id", "ativo" }
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    a = Atendente.query.get(atendente_id)
    if not a:
        return jsonify({"erro": "Atendente não encontrado"}), 404

    data = request.get_json(silent=True) or {}

    if 'nome'       in data: a.nome       = str(data['nome']).strip()
    if 'email'      in data: a.email      = str(data['email']).strip().lower()
    if 'tipo'       in data: a.tipo       = data['tipo']
    if 'balcao'     in data: a.balcao     = data['balcao']
    if 'servico_id' in data: a.servico_id = data['servico_id']
    if 'ativo'      in data: a.ativo      = bool(data['ativo'])

    # Nova senha (opcional)
    nova_senha = (data.get('senha') or '').strip()
    if nova_senha:
        if len(nova_senha) < 6:
            return jsonify({"erro": "senha mínimo 6 caracteres"}), 400
        a.set_senha(nova_senha)

    try:
        db.session.commit()
        return jsonify({
            "mensagem":  "Atendente actualizado",
            "atendente": a.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] editar_atendente {atendente_id}: {e}")
        return jsonify({"erro": "Erro interno"}), 500


# ─────────────────────────────────────────────
# 🗑️  DESACTIVAR ATENDENTE
# ─────────────────────────────────────────────
@atendente_bp.route('/<int:atendente_id>', methods=['DELETE'])
@jwt_required()
def desactivar_atendente(atendente_id):
    """
    DELETE /api/atendentes/:id

    Não apaga — apenas marca ativo=False.
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    a = Atendente.query.get(atendente_id)
    if not a:
        return jsonify({"erro": "Atendente não encontrado"}), 404

    # Não permite desactivar o próprio utilizador
    caller_id = int(get_jwt_identity())
    if a.id == caller_id:
        return jsonify({"erro": "Não pode desactivar a sua própria conta"}), 400

    try:
        a.ativo = False
        db.session.commit()
        return jsonify({"mensagem": f"Atendente '{a.nome}' desactivado"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"[ERROR] desactivar_atendente {atendente_id}: {e}")
        return jsonify({"erro": "Erro interno"}), 500


# ─────────────────────────────────────────────
# 🏆 TOP 3 POR SCORE
# ─────────────────────────────────────────────
@atendente_bp.route('/top', methods=['GET'])
@jwt_required()
def top_atendentes():
    """
    GET /api/atendentes/top

    Query params:
      periodo — hoje | semana | mes (default: hoje)
      n       — quantos lugares (default: 3, máx: 10)

    Resposta:
      { "top_1": {...}, "top_2": {...}, "top_3": {...} }
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    periodo  = request.args.get('periodo', 'hoje')
    data_de  = request.args.get('data_de')
    data_ate = request.args.get('data_ate')
    n_top    = min(int(request.args.get('n', 3) or 3), 10)

    data_inicio, data_fim = _calcular_intervalo(periodo, data_de, data_ate)

    atendentes = Atendente.query.filter_by(ativo=True, tipo='atendente').all()

    lista = []
    for a in atendentes:
        try:
            m = _calcular_metricas(a.id, data_inicio, data_fim)
            lista.append({
                "id":          a.id,
                "nome":        a.nome,
                "email":       a.email,
                "balcao":      a.balcao,
                "departamento": (a.servico.nome if getattr(a, 'servico', None) else "Geral"),
                **m,
            })
        except Exception as e:
            print(f"[WARN] top_atendentes metricas {a.id}: {e}")
            continue

    ordenados = sorted(lista, key=lambda x: x.get('score', 0), reverse=True)

    # Formato legado (top_1, top_2, top_3) + lista completa
    resposta = {f"top_{i+1}": ordenados[i] if i < len(ordenados) else None
                for i in range(n_top)}
    resposta["ranking"] = ordenados
    return jsonify(resposta)


# ─────────────────────────────────────────────
# 🔢 PRÓXIMO BALCÃO LIVRE
# ─────────────────────────────────────────────
@atendente_bp.route('/proximo-balcao', methods=['GET'])
@jwt_required()
def proximo_balcao():
    """
    GET /api/atendentes/proximo-balcao

    Devolve o próximo número de balcão não atribuído.
    Útil ao criar novos atendentes.

    Resposta: { "proximo_balcao": 4 }
    """
    _, erro, codigo = _verificar_admin()
    if erro:
        return erro, codigo

    ocupados = {
        a.balcao
        for a in Atendente.query.filter(
            Atendente.ativo   == True,
            Atendente.balcao.isnot(None)
        ).all()
    }

    proximo = 1
    while proximo in ocupados:
        proximo += 1

    return jsonify({"proximo_balcao": proximo})