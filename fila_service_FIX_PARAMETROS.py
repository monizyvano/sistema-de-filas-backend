"""
Fila Service - FIX ORDEM DE PARÂMETROS
app/services/fila_service.py

✅ FIX 1: Ordem correta dos parâmetros em chamar_proxima()
✅ FIX 2: Filtro de data mais permissivo
✅ FIX 3: Debug logs adicionados
"""

from app.models.senha import Senha
from app.extensions import db
from datetime import date, datetime, timedelta
from sqlalchemy import func, and_, or_


class FilaService:
    """Serviço para gerenciamento de filas"""

    @staticmethod
    def obter_fila(servico_id=None, tipo=None):
        """
        ✅ FIX: Filtro de data mais permissivo
        
        Obtém senhas aguardando, ordenadas por prioridade e ordem
        
        Args:
            servico_id: ID do serviço (opcional)
            tipo: 'prioritaria' ou 'normal' (opcional)
            
        Returns:
            List[Senha]: Lista de senhas aguardando
        """
        hoje = date.today()
        ontem = hoje - timedelta(days=1)
        
        # ✅ FIX: Aceita senhas de hoje OU com emitida_em NULL
        query = Senha.query.filter(
            Senha.status == 'aguardando',
            or_(
                func.date(Senha.emitida_em) >= ontem,
                Senha.emitida_em.is_(None)
            )
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
        
        senhas = query.all()
        
        print(f"\n[DEBUG obter_fila]")
        print(f"  Serviço: {servico_id}")
        print(f"  Tipo: {tipo}")
        print(f"  Senhas encontradas: {len(senhas)}")
        for s in senhas:
            print(f"    - {s.numero} (status={s.status}, emitida_em={s.emitida_em})")
        
        return senhas

    @staticmethod
    def chamar_proxima(servico_id, atendente_id, numero_balcao):
        """
        ✅ FIX CRÍTICO: Ordem correta dos parâmetros!
        
        ANTES: chamar_proxima(servico_id, numero_balcao, atendente_id)
        AGORA: chamar_proxima(servico_id, atendente_id, numero_balcao)
        
        Chama próxima senha da fila
        
        CORREÇÃO: Finaliza senha anterior ANTES de chamar nova
        
        Args:
            servico_id: ID do serviço
            atendente_id: ID do atendente ← FIX!
            numero_balcao: Número do balcão ← FIX!
            
        Returns:
            Senha: Próxima senha ou None se fila vazia
        """
        print(f"\n{'='*60}")
        print(f"[chamar_proxima] PARÂMETROS RECEBIDOS:")
        print(f"  servico_id: {servico_id}")
        print(f"  atendente_id: {atendente_id}")
        print(f"  numero_balcao: {numero_balcao}")
        print(f"{'='*60}\n")
        
        # ✅ PASSO 1: FINALIZAR SENHA ANTERIOR DESTE ATENDENTE
        senha_anterior = Senha.query.filter(
            Senha.atendente_id == atendente_id,
            Senha.status == 'atendendo'
        ).first()
        
        if senha_anterior:
            print(f"[INFO] Finalizando senha anterior: {senha_anterior.numero}")
            senha_anterior.finalizar()
            db.session.commit()
            print(f"✅ Senha {senha_anterior.numero} finalizada automaticamente")
        
        # ✅ PASSO 2: BUSCAR PRÓXIMA SENHA NA FILA
        # Priorizar prioritárias, depois normais
        print(f"\n[INFO] Buscando senhas prioritárias...")
        fila_prioritaria = FilaService.obter_fila(
            servico_id=servico_id, 
            tipo='prioritaria'
        )
        
        print(f"[INFO] Buscando senhas normais...")
        fila_normal = FilaService.obter_fila(
            servico_id=servico_id, 
            tipo='normal'
        )
        
        # Pegar primeira prioritária ou primeira normal
        proxima_senha = None
        
        if fila_prioritaria:
            proxima_senha = fila_prioritaria[0]
            print(f"[INFO] Senha prioritária encontrada: {proxima_senha.numero}")
        elif fila_normal:
            proxima_senha = fila_normal[0]
            print(f"[INFO] Senha normal encontrada: {proxima_senha.numero}")
        else:
            print(f"[WARNING] Nenhuma senha encontrada na fila!")
            return None
        
        # ✅ PASSO 3: INICIAR ATENDIMENTO DA NOVA SENHA
        print(f"\n[INFO] Iniciando atendimento...")
        print(f"  Senha: {proxima_senha.numero}")
        print(f"  Atendente ID: {atendente_id}")
        print(f"  Balcão: {numero_balcao}")
        
        proxima_senha.iniciar_atendimento(
            atendente_id=atendente_id,
            numero_balcao=numero_balcao
        )
        
        db.session.commit()
        
        print(f"✅ Senha {proxima_senha.numero} chamada para balcão {numero_balcao}")
        print(f"{'='*60}\n")
        
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
        ontem = hoje - timedelta(days=1)
        
        # ✅ FIX: Filtro mais permissivo
        query_base = Senha.query.filter(
            or_(
                func.date(Senha.emitida_em) >= ontem,
                Senha.emitida_em.is_(None)
            )
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

    @staticmethod
    def obter_historico_atendente(atendente_id, limite=10):
        """
        Obtém histórico de senhas atendidas por um atendente
        
        Args:
            atendente_id: ID do atendente
            limite: Número máximo de registros
            
        Returns:
            List[Senha]: Últimas senhas atendidas
        """
        return Senha.query.filter(
            Senha.atendente_id == atendente_id,
            Senha.status.in_(['atendendo', 'concluida'])
        ).order_by(
            Senha.atendimento_iniciado_em.desc()
        ).limit(limite).all()

    @staticmethod
    def obter_status_fila(servico_id):
        """
        Obtém status resumido de uma fila
        
        Args:
            servico_id: ID do serviço
            
        Returns:
            dict: Status da fila
        """
        stats = FilaService.obter_estatisticas_fila(servico_id)
        fila = FilaService.obter_fila(servico_id)
        
        proxima_senha = None
        if fila:
            proxima_senha = fila[0].numero
        
        return {
            'aguardando': stats['aguardando_total'],
            'em_atendimento': stats['atendendo'],
            'proxima_senha': proxima_senha
        }

    @staticmethod
    def obter_estatisticas_gerais():
        """
        Estatísticas gerais de todas as filas
        
        Returns:
            dict: Estatísticas consolidadas
        """
        hoje = date.today()
        ontem = hoje - timedelta(days=1)
        
        total_aguardando = Senha.query.filter(
            Senha.status == 'aguardando',
            or_(
                func.date(Senha.emitida_em) >= ontem,
                Senha.emitida_em.is_(None)
            )
        ).count()
        
        total_atendendo = Senha.query.filter(
            Senha.status == 'atendendo'
        ).count()
        
        # Tempo médio de espera (últimas 24h)
        senhas_atendidas = Senha.query.filter(
            Senha.status.in_(['atendendo', 'concluida']),
            Senha.tempo_espera_minutos.isnot(None),
            or_(
                func.date(Senha.emitida_em) >= ontem,
                Senha.emitida_em.is_(None)
            )
        ).all()
        
        tempo_medio_espera = 0
        if senhas_atendidas:
            tempos = [s.tempo_espera_minutos for s in senhas_atendidas if s.tempo_espera_minutos]
            if tempos:
                tempo_medio_espera = round(sum(tempos) / len(tempos), 1)
        
        return {
            'total_aguardando': total_aguardando,
            'total_atendendo': total_atendendo,
            'tempo_medio_espera': tempo_medio_espera
        }
