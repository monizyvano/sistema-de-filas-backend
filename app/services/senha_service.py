"""
app/services/senha_service.py — SPRINT 1 (corrigido)
═══════════════════════════════════════════════════════════════
ALTERAÇÕES:
  ✅ Novo método `listar_senhas_paginado()` — paginação server-side.
  ✅ `listar_senhas()` aceita parâmetro `limite` (default 500).
═══════════════════════════════════════════════════════════════
"""

from datetime import datetime, date
from sqlalchemy import func, or_
from app.extensions import db
from app.models.senha import Senha
from app.models.log_actividade import LogActividade


class SenhaService:
    """
    Service principal para gestão de senhas.
    """

    # ─────────────────────────────────────────────────────────
    # Emissão
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def emitir_senha(servico_id: int, tipo: str = 'normal',
                     usuario_contato: str = None, utente_id: int = None,
                     observacoes: str = None) -> Senha:
        """
        Cria e persiste uma nova senha de atendimento.
        Numeração diária: N001, N002, ... reinicia a cada dia.
        Prioritárias usam prefixo 'P'.

        Args:
            observacoes: Dados do formulário do utente
                         (ex: "SERVIÇO: Tesouraria | Tipo de pagamento: Propinas | ...")
        """
        hoje    = datetime.utcnow().date()
        prefixo = 'P' if tipo == 'prioritaria' else 'N'

        contagem = Senha.query.filter(
            Senha.data_emissao == hoje,
            Senha.numero.like(f'{prefixo}%')
        ).count()

        numero = f"{prefixo}{str(contagem + 1).zfill(3)}"

        senha = Senha(
            numero=numero,
            servico_id=servico_id,
            tipo=tipo,
            usuario_contato=usuario_contato,
            data_emissao=hoje,
            utente_id=utente_id
        )

        # ✅ FIX: observacoes definido após __init__ (o modelo não aceita no construtor)
        if observacoes:
            senha.observacoes = observacoes

        db.session.add(senha)
        db.session.commit()
        db.session.refresh(senha)

        print(f"\n[SenhaService] Emitida: {senha.numero} | "
              f"Serviço: {servico_id} | Tipo: {tipo} | "
              f"Obs: {'✅' if observacoes else '—'}")
        return senha

    # ─────────────────────────────────────────────────────────
    # Listagem — sem paginação
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def listar_senhas(atendente_id: int = None, status: str = None,
                      servico_id: int = None, limite: int = 500):
        """
        Lista senhas com filtros opcionais.
        SPRINT 1: parâmetro `limite` adicionado (default 500).
        """
        query = Senha.query

        if atendente_id:
            query = query.filter(Senha.atendente_id == atendente_id)
        if status:
            query = query.filter(Senha.status == status)
        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)

        return query.order_by(Senha.created_at.desc()).limit(limite).all()

    # ─────────────────────────────────────────────────────────
    # Listagem — com paginação (SPRINT 1 — método novo)
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def listar_senhas_paginado(atendente_id: int = None, status: str = None,
                                servico_id: int = None, page: int = 1,
                                per_page: int = 15):
        """
        Lista senhas com paginação server-side.
        Usa Flask-SQLAlchemy .paginate().

        Objecto retornado tem:
            .items       – lista de Senha da página actual
            .total       – total de registos
            .page        – página actual
            .per_page    – registos por página
            .pages       – total de páginas
        """
        query = Senha.query

        if atendente_id:
            query = query.filter(Senha.atendente_id == atendente_id)
        if status:
            query = query.filter(Senha.status == status)
        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)

        query = query.order_by(Senha.created_at.desc())

        # error_out=False → não lança 404 se página sem resultados
        return query.paginate(page=page, per_page=per_page, error_out=False)

    # ─────────────────────────────────────────────────────────
    # Consulta por ID / Número
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def obter_por_id(senha_id: int) -> Senha:
        """Devolve senha por ID ou None."""
        return Senha.query.get(senha_id)

    @staticmethod
    def obter_por_numero(numero: str) -> Senha:
        """Devolve senha de hoje pelo número (ex: N042)."""
        hoje = date.today()
        return Senha.query.filter(
            Senha.numero == numero,
            func.date(Senha.emitida_em) == hoje
        ).first()

    # ─────────────────────────────────────────────────────────
    # Cancelamento
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def cancelar(senha_id: int, motivo: str, atendente_id: int) -> Senha:
        """
        Cancela uma senha com estado 'aguardando'.
        Raises ValueError se não existir ou não estiver aguardando.
        """
        senha = SenhaService.obter_por_id(senha_id)
        if not senha:
            raise ValueError("Senha não encontrada")
        if senha.status != 'aguardando':
            raise ValueError("Apenas senhas aguardando podem ser canceladas")

        senha.status = 'cancelada'
        if motivo:
            senha.observacoes = motivo

        try:
            log = LogActividade(
                acao='cancelada',
                senha_id=senha.id,
                atendente_id=atendente_id,
                descricao=f'Senha {senha.numero} cancelada. Motivo: {motivo}'
            )
            db.session.add(log)
        except Exception:
            pass  # log não deve impedir o cancelamento

        db.session.commit()
        db.session.refresh(senha)
        return senha

    # ─────────────────────────────────────────────────────────
    # Estatísticas — dia actual
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def obter_estatisticas_hoje(data: date = None) -> dict:
        """
        Estatísticas do dia (ou de uma data específica).
        """
        if data is None:
            data = datetime.utcnow().date()

        query_base = Senha.query.filter(
            or_(
                Senha.data_emissao == data,
                func.date(Senha.emitida_em) == data
            )
        )

        total_emitidas = query_base.count()
        aguardando     = query_base.filter(Senha.status == 'aguardando').count()
        atendendo      = query_base.filter(Senha.status == 'atendendo').count()
        concluidas     = query_base.filter(Senha.status == 'concluida').count()
        canceladas     = query_base.filter(Senha.status == 'cancelada').count()

        senhas_atendidas = query_base.filter(
            Senha.status.in_(['atendendo', 'concluida']),
            Senha.atendimento_iniciado_em.isnot(None)
        ).all()

        tempos = [s.tempo_espera_minutos for s in senhas_atendidas
                  if s.tempo_espera_minutos]
        tempo_medio_espera = round(sum(tempos) / len(tempos), 1) if tempos else 0

        return {
            'data': data.isoformat(),
            'total_emitidas': total_emitidas,
            'aguardando': aguardando,
            'atendendo': atendendo,
            'concluidas': concluidas,
            'canceladas': canceladas,
            'tempo_medio_espera': tempo_medio_espera
        }

    # ─────────────────────────────────────────────────────────
    # Estatísticas — por atendente
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def obter_estatisticas_trabalhador(atendente_id: int) -> dict:
        """Estatísticas do dia para um atendente específico."""
        hoje = datetime.utcnow().date()

        senhas_hoje = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            or_(
                Senha.data_emissao == hoje,
                func.date(Senha.emitida_em) == hoje
            )
        ).all()

        atendidos = [s for s in senhas_hoje if s.status == 'concluida']
        tempos    = [s.tempo_atendimento_minutos for s in atendidos
                     if s.tempo_atendimento_minutos]
        tempo_medio = round(sum(tempos) / len(tempos), 1) if tempos else 0

        return {
            'atendidos_hoje': len(atendidos),
            'tempo_medio_atendimento': tempo_medio
        }