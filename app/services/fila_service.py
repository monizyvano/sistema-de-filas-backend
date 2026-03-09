"""
Fila Service - VERSÃO CORRIGIDA
app/services/fila_service.py

✅ CORREÇÃO CRÍTICA:
- Finaliza senha anterior automaticamente ao chamar próxima
- Garante que concluídas sejam contabilizadas
"""

from app.models.senha import Senha
from app.extensions import db
from datetime import date
from sqlalchemy import func, and_


class FilaService:
    """Serviço para gerenciamento de filas"""

    @staticmethod
    def obter_fila(servico_id=None, tipo=None):
        """
        Obtém senhas aguardando, ordenadas por prioridade e ordem
        
        Args:
            servico_id: ID do serviço (opcional)
            tipo: 'prioritaria' ou 'normal' (opcional)
            
        Returns:
            List[Senha]: Lista de senhas aguardando
        """
        hoje = date.today()
        
        query = Senha.query.filter(
            Senha.status == 'aguardando',
            func.date(Senha.emitida_em) == hoje
        )
        
        if servico_id:
            query = query.filter(Senha.servico_id == servico_id)
        
        if tipo:
            query = query.filter(Senha.tipo == tipo)
        
        # Ordenar: prioritárias primeiro, depois por ordem de emissão
        query = query.order_by(
            Senha.tipo.desc(),  # 'prioritaria' > 'normal'
            Senha.emitida_em.asc()
        )
        
        return query.all()

    @staticmethod
    def chamar_proxima(servico_id, numero_balcao, atendente_id):
        """
        ✅ CORRIGIDO - Chama próxima senha da fila
        
        CORREÇÃO: Finaliza senha anterior ANTES de chamar nova
        
        Args:
            servico_id: ID do serviço
            numero_balcao: Número do balcão
            atendente_id: ID do atendente
            
        Returns:
            Senha: Próxima senha ou None se fila vazia
        """
        # ✅ PASSO 1: FINALIZAR SENHA ANTERIOR DESTE ATENDENTE
        senha_anterior = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            Senha.status == 'atendendo'
        ).first()
        
        if senha_anterior:
            # Marcar como concluída
            senha_anterior.finalizar()
            db.session.commit()
            
            print(f"✅ Senha anterior {senha_anterior.numero} finalizada automaticamente")
        
        # ✅ PASSO 2: BUSCAR PRÓXIMA SENHA NA FILA
        # Priorizar prioritárias, depois normais
        fila_prioritaria = FilaService.obter_fila(
            servico_id=servico_id, 
            tipo='prioritaria'
        )
        
        fila_normal = FilaService.obter_fila(
            servico_id=servico_id, 
            tipo='normal'
        )
        
        # Pegar primeira prioritária ou primeira normal
        proxima_senha = None
        
        if fila_prioritaria:
            proxima_senha = fila_prioritaria[0]
        elif fila_normal:
            proxima_senha = fila_normal[0]
        
        if not proxima_senha:
            return None
        
        # ✅ PASSO 3: INICIAR ATENDIMENTO DA NOVA SENHA
        proxima_senha.iniciar_atendimento(
            atendente_id=atendente_id,
            numero_balcao=numero_balcao
        )
        
        db.session.commit()
        
        print(f"✅ Senha {proxima_senha.numero} chamada para balcão {numero_balcao}")
        
        return proxima_senha

    @staticmethod
    def obter_estatisticas_fila(servico_id=None):
        """
        Estatísticas da fila
        
        Args:
            servico_id: ID do serviço (opcional)
            
        Returns:
            dict: Estatísticas
        """
        hoje = date.today()
        
        query_base = Senha.query.filter(
            func.date(Senha.emitida_em) == hoje
        )
        
        if servico_id:
            query_base = query_base.filter(Senha.servico_id == servico_id)
        
        # Contar por status e tipo
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
        
        # Tempo estimado (simplificado: 10min por senha na fila)
        tempo_espera_estimado = aguardando_total * 10
        
        return {
            'aguardando_total': aguardando_total,
            'aguardando_normal': aguardando_normal,
            'aguardando_prioritaria': aguardando_prioritaria,
            'atendendo': atendendo,
            'tempo_espera_estimado': tempo_espera_estimado
        }

    @staticmethod
    def obter_posicao_fila(senha_id):
        """
        Obtém posição de uma senha na fila
        
        Args:
            senha_id: ID da senha
            
        Returns:
            int: Posição na fila (1-based) ou None se não estiver aguardando
        """
        senha = Senha.query.get(senha_id)
        
        if not senha or senha.status != 'aguardando':
            return None
        
        # Buscar fila do mesmo serviço
        fila = FilaService.obter_fila(servico_id=senha.servico_id)
        
        # Encontrar posição
        for idx, s in enumerate(fila, start=1):
            if s.id == senha_id:
                return idx
        
        return None