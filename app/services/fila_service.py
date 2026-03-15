"""
app/services/fila_service.py — SPRINT 1 (fix crítico)
═══════════════════════════════════════════════════════════════
CORRECÇÕES NESTA VERSÃO:
  ✅ FIX 1: chamar_proxima usa try/except no finalizar anterior
     — não quebra se senha estiver em estado inesperado.
  ✅ FIX 2: obter_fila filtra por data (hoje) — elimina senhas
     de dias anteriores que ficavam presas em 'aguardando'.
  ✅ FIX 3: um único db.session.commit() no fim — evita
     double-commit que causava estados inconsistentes.
  ✅ FIX 4: finalizar_anterior aceita 'chamando' E 'atendendo'.
═══════════════════════════════════════════════════════════════
"""

from app.models.senha import Senha
from app.extensions import db
from datetime import date, datetime, timedelta
from sqlalchemy import func, case, or_


class FilaService:
    """Serviço para gerenciamento de filas."""

    # ═══════════════════════════════════════════════════════════
    # Obter fila
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def obter_fila(servico_id=None, tipo=None):
        """
        Senhas aguardando de HOJE, ordenadas por prioridade e emissão.

        FIX: filtro de data adicionado — antes buscava senhas de
        qualquer data, causando que senhas antigas reaparecessem.
        """
        hoje  = date.today()
        ontem = hoje - timedelta(days=1)

        # Aceita senhas emitidas hoje ou ontem (margem para turno nocturno)
        query = Senha.query.filter(
            Senha.status == 'aguardando',
            or_(
                func.date(Senha.emitida_em) == hoje,
                func.date(Senha.emitida_em) == ontem
            )
        )

        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)

        if tipo:
            query = query.filter(Senha.tipo == tipo)

        # Prioritárias primeiro; dentro do mesmo tipo, FIFO por emissão
        return query.order_by(
            case((Senha.tipo == 'prioritaria', 0), else_=1),
            Senha.emitida_em.asc()
        ).all()

    # ═══════════════════════════════════════════════════════════
    # Buscar próxima (uso interno)
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def _buscar_proxima_senha(servico_id=None):
        """
        Próxima senha aguardando de hoje.
        Prioritárias primeiro; FIFO dentro do mesmo tipo.
        """
        hoje  = date.today()
        ontem = hoje - timedelta(days=1)

        query = Senha.query.filter(
            Senha.status == 'aguardando',
            or_(
                func.date(Senha.emitida_em) == hoje,
                func.date(Senha.emitida_em) == ontem
            )
        )

        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)

        return query.order_by(
            case((Senha.tipo == 'prioritaria', 0), else_=1),
            Senha.emitida_em.asc()
        ).first()

    # ═══════════════════════════════════════════════════════════
    # Chamar próxima — método principal (CORRIGIDO)
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def chamar_proxima(servico_id, atendente_id, numero_balcao):
        """
        Chama a próxima senha da fila.

        Fluxo:
          1. Finalizar senha anterior do atendente (se existir)
          2. Buscar próxima do serviço; fallback para fila geral
          3. Marcar como 'atendendo'
          4. Um único commit no final

        FIX CRÍTICO: o finalizar anterior está dentro de try/except
        — se a senha anterior estiver num estado inesperado (ex:
        'chamando'), não quebra o fluxo principal.

        Returns:
            Senha | None
        """
        # ── 1. Finalizar senha anterior do atendente ──────────────
        # Procura senhas em 'atendendo' OU 'chamando' deste atendente
        senha_anterior = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            Senha.status.in_(['atendendo', 'chamando'])
        ).first()

        if senha_anterior:
            try:
                # Se estiver em 'chamando', promover para 'atendendo' primeiro
                if senha_anterior.status == 'chamando':
                    senha_anterior.status = 'atendendo'
                    senha_anterior.atendimento_iniciado_em = datetime.utcnow()

                # Finalizar (marca como 'concluida')
                senha_anterior.status = 'concluida'
                senha_anterior.atendimento_concluido_em = datetime.utcnow()

                # Calcular tempo de atendimento
                if senha_anterior.atendimento_iniciado_em:
                    delta = (senha_anterior.atendimento_concluido_em
                             - senha_anterior.atendimento_iniciado_em)
                    senha_anterior.tempo_atendimento_minutos = max(
                        1, int(delta.total_seconds() / 60)
                    )

                print(f"[FilaService] Senha {senha_anterior.numero} "
                      f"→ concluida (auto-finalizada)")

            except Exception as e:
                # Não deixar erro no anterior impedir chamar próxima
                print(f"[FilaService] Aviso ao finalizar anterior: {e}")
                db.session.rollback()

        # ── 2. Buscar próxima senha ───────────────────────────────
        proxima = FilaService._buscar_proxima_senha(servico_id=servico_id)

        # Fallback: se não houver no serviço específico, fila geral
        if not proxima:
            proxima = FilaService._buscar_proxima_senha(servico_id=None)

        if not proxima:
            # Não há senhas — commit das alterações anteriores e sai
            try:
                db.session.commit()
            except Exception:
                db.session.rollback()
            return None

        # ── 3. Marcar próxima como 'atendendo' ────────────────────
        proxima.status                  = 'atendendo'
        proxima.atendente_id            = atendente_id
        proxima.numero_balcao           = numero_balcao
        proxima.chamada_em              = datetime.utcnow()
        proxima.atendimento_iniciado_em = datetime.utcnow()

        # Calcular tempo de espera
        if proxima.emitida_em:
            delta = proxima.atendimento_iniciado_em - proxima.emitida_em
            proxima.tempo_espera_minutos = max(0, int(delta.total_seconds() / 60))

        # ── 4. Um único commit para todas as alterações ───────────
        try:
            db.session.commit()
            print(f"[FilaService] Senha {proxima.numero} → atendendo "
                  f"| Balcão {numero_balcao} | Atendente {atendente_id}")
        except Exception as e:
            db.session.rollback()
            print(f"[FilaService] ERRO ao commit chamar_proxima: {e}")
            raise

        return proxima

    # ═══════════════════════════════════════════════════════════
    # Estatísticas de fila
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def obter_estatisticas_fila(servico_id=None):
        """Estatísticas da fila do dia actual."""
        hoje = date.today()

        query_base = Senha.query.filter(
            func.date(Senha.emitida_em) == hoje
        )

        if servico_id:
            query_base = query_base.filter(Senha.servico_id == servico_id)

        aguardando_total      = query_base.filter(Senha.status == 'aguardando').count()
        aguardando_normal     = query_base.filter(
            Senha.status == 'aguardando', Senha.tipo == 'normal').count()
        aguardando_prioritaria = query_base.filter(
            Senha.status == 'aguardando', Senha.tipo == 'prioritaria').count()
        atendendo             = query_base.filter(Senha.status == 'atendendo').count()

        return {
            'aguardando_total':        aguardando_total,
            'aguardando_normal':       aguardando_normal,
            'aguardando_prioritaria':  aguardando_prioritaria,
            'atendendo':               atendendo,
            'tempo_espera_estimado':   aguardando_total * 10
        }

    # ═══════════════════════════════════════════════════════════
    # Posição na fila
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def obter_posicao_fila(senha_id):
        """Posição de uma senha na fila (1-based) ou None."""
        senha = Senha.query.get(senha_id)
        if not senha or senha.status != 'aguardando':
            return None

        fila = FilaService.obter_fila(servico_id=senha.servico_id)
        for idx, s in enumerate(fila, start=1):
            if s.id == senha_id:
                return idx
        return None

    # ═══════════════════════════════════════════════════════════
    # Status da fila (painel público)
    # ═══════════════════════════════════════════════════════════

    @staticmethod
    def obter_status_fila(servico_id):
        """Status resumido de uma fila para painel público."""
        aguardando    = Senha.query.filter(
            Senha.servico_id == servico_id,
            Senha.status == 'aguardando'
        ).count()
        em_atendimento = Senha.query.filter(
            Senha.servico_id == servico_id,
            Senha.status == 'atendendo'
        ).count()
        proxima = FilaService._buscar_proxima_senha(servico_id=servico_id)

        return {
            'servico_id':    servico_id,
            'aguardando':    aguardando,
            'em_atendimento': em_atendimento,
            'proxima_senha': proxima.numero if proxima else None
        }

    @staticmethod
    def obter_painel(servico_id):
        """Dados completos para painel público."""
        fila   = FilaService.obter_fila(servico_id=servico_id)
        status = FilaService.obter_status_fila(servico_id=servico_id)
        return {**status, 'fila': [s.to_dict() for s in fila[:10]]}
