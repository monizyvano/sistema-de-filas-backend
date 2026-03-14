from app.models.senha import Senha
from app.extensions import db
from datetime import date
from sqlalchemy import func, case


class FilaService:
    """Serviço para gerenciamento de filas"""

    @staticmethod
    def obter_fila(servico_id=None, tipo=None):
        """Obtém senhas aguardando, ordenadas por prioridade e emissão."""
        query = Senha.query.filter(Senha.status == 'aguardando')

        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)

        if tipo:
            query = query.filter(Senha.tipo == tipo)

        query = query.order_by(
            case((Senha.tipo == 'prioritaria', 0), else_=1),
            Senha.emitida_em.asc()
        )

        return query.all()

    @staticmethod
    def _buscar_proxima_senha(servico_id=None):
        """Busca a próxima senha aguardando (prioritária primeiro)."""
        query = Senha.query.filter(Senha.status == 'aguardando')
        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)

        return query.order_by(
            case((Senha.tipo == 'prioritaria', 0), else_=1),
            Senha.emitida_em.asc()
        ).first()

    @staticmethod
    def chamar_proxima(servico_id, atendente_id, numero_balcao):
        """Chama próxima senha da fila do serviço; fallback para fila geral."""
        senha_anterior = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            Senha.status == 'atendendo'
        ).first()

        if senha_anterior:
            senha_anterior.finalizar()
            db.session.commit()

        proxima_senha = FilaService._buscar_proxima_senha(servico_id=servico_id)

        # Fallback: se não houver nesse serviço, pega da fila global
        if not proxima_senha:
            proxima_senha = FilaService._buscar_proxima_senha(servico_id=None)

        if not proxima_senha:
            return None

        proxima_senha.iniciar_atendimento(
            atendente_id=atendente_id,
            numero_balcao=numero_balcao
        )

        db.session.commit()
        return proxima_senha

    @staticmethod
    def obter_estatisticas_fila(servico_id=None):
        """Estatísticas da fila (dia atual)."""
        hoje = date.today()
        query_base = Senha.query.filter(func.date(Senha.emitida_em) == hoje)

        if servico_id:
            query_base = query_base.filter(Senha.servico_id == servico_id)

        aguardando_total = query_base.filter(Senha.status == 'aguardando').count()

        aguardando_normal = query_base.filter(
            Senha.status == 'aguardando',
            Senha.tipo == 'normal'
        ).count()

        aguardando_prioritaria = query_base.filter(
            Senha.status == 'aguardando',
            Senha.tipo == 'prioritaria'
        ).count()

        atendendo = query_base.filter(Senha.status == 'atendendo').count()
        tempo_espera_estimado = aguardando_total * 10

        return {
            'aguardando_total': aguardando_total,
            'aguardando_normal': aguardando_normal,
            'aguardando_prioritaria': aguardando_prioritaria,
            'atendendo': atendendo,
            'tempo_espera_estimado': tempo_espera_estimado,
        }

    @staticmethod
    def obter_posicao_fila(senha_id):
        """Obtém posição de uma senha na fila."""
        senha = Senha.query.get(senha_id)

        if not senha or senha.status != 'aguardando':
            return None

        fila = FilaService.obter_fila(servico_id=senha.servico_id)

        for idx, s in enumerate(fila, start=1):
            if s.id == senha_id:
                return idx

        return None

    @staticmethod
    def obter_status_fila(servico_id):
        """Retorna status simplificado da fila de um serviço."""
        aguardando = Senha.query.filter(
            Senha.servico_id == servico_id,
            Senha.status == 'aguardando'
        ).count()

        em_atendimento = Senha.query.filter(
            Senha.servico_id == servico_id,
            Senha.status == 'atendendo'
        ).count()

        proxima = FilaService._buscar_proxima_senha(servico_id=servico_id)

        return {
            'servico_id': servico_id,
            'aguardando': aguardando,
            'em_atendimento': em_atendimento,
            'proxima_senha': proxima.numero if proxima else None,
        }

    @staticmethod
    def obter_painel(servico_id):
        """Dados para painel público."""
        atual = Senha.query.filter(
            Senha.servico_id == servico_id,
            Senha.status == 'atendendo'
        ).order_by(Senha.chamada_em.desc()).first()

        proximas = Senha.query.filter(
            Senha.servico_id == servico_id,
            Senha.status == 'aguardando'
        ).order_by(
            case((Senha.tipo == 'prioritaria', 0), else_=1),
            Senha.emitida_em.asc()
        ).limit(5).all()

        return {
            'senha_atual': atual.numero if atual else None,
            'balcao': atual.numero_balcao if atual else None,
            'proximas': [s.numero for s in proximas],
        }

    @staticmethod
    def concluir_atendimento(senha_id, atendente_id):
        """Conclui atendimento de uma senha em atendimento pelo atendente."""
        senha = Senha.query.get(senha_id)
        if not senha:
            return None

        if senha.atendente_id != atendente_id:
            raise ValueError('Senha não pertence ao atendente logado')

        if senha.status != 'atendendo':
            raise ValueError('Apenas senhas em atendimento podem ser concluídas')

        senha.finalizar()
        db.session.commit()
        return senha

    @staticmethod
    def cancelar_senha(senha_id, atendente_id, motivo=None):
        """Cancela senha (aguardando/atendendo) e registra observação."""
        senha = Senha.query.get(senha_id)
        if not senha:
            return None

        if senha.status not in ['aguardando', 'atendendo']:
            raise ValueError('Senha não pode ser cancelada neste status')

        senha.status = 'cancelada'
        senha.atendente_id = atendente_id
        if motivo:
            senha.observacoes = motivo
        db.session.commit()
        return senha
