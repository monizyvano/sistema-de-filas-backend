"""
FilaService - Lógica de gerenciamento de filas
Responsável por: ordenação, próxima senha, estatísticas
"""
from datetime import datetime
from app import db
from app.models import Senha, Servico, LogActividade
from sqlalchemy import func, case


class FilaService:
    """
    Service para gerenciar filas
    
    Methods:
        obter_fila(): Lista senhas na fila de um serviço
        proxima_senha(): Obtém próxima senha a ser chamada
        chamar_proxima(): Chama próxima senha
        calcular_tempo_espera(): Estima tempo de espera
    """
    
    @staticmethod
    def obter_fila(servico_id=None, status='aguardando'):
        """
        Obtém fila de senhas
        
        Args:
            servico_id (int): ID do serviço (None = todos)
            status (str): Status das senhas
        
        Returns:
            list[Senha]: Senhas ordenadas (prioritárias primeiro, depois FIFO)
        
        Example:
            >>> fila = FilaService.obter_fila(servico_id=1)
            >>> for senha in fila:
            ...     print(f"{senha.numero} - {senha.tipo}")
            P001 - prioritaria
            P002 - prioritaria
            N001 - normal
            N002 - normal
        """
        query = Senha.query.filter_by(status=status)
        
        # Filtrar por serviço se especificado
        if servico_id:
            query = query.filter_by(servico_id=servico_id)
        
        # Ordenar: prioritárias primeiro, depois por ordem de chegada (FIFO)
        # Usar CASE para mapear tipo para número (prioritaria=1, normal=0)
        query = query.order_by(
            case(
                (Senha.tipo == 'prioritaria', 1),
                else_=0
            ).desc(),
            Senha.created_at.asc()
        )
        
        return query.all()
    
    @staticmethod
    def proxima_senha(servico_id=None):
        """
        Obtém próxima senha a ser atendida (sem chamar)
        
        Args:
            servico_id (int): ID do serviço
        
        Returns:
            Senha: Próxima senha ou None
        """
        fila = FilaService.obter_fila(servico_id, status='aguardando')
        return fila[0] if fila else None
    
    @staticmethod
    def chamar_proxima(servico_id, numero_balcao, atendente_id=None):
        """
        Chama próxima senha da fila
        
        Args:
            servico_id (int): ID do serviço
            numero_balcao (int): Número do balcão
            atendente_id (int): ID do atendente (opcional)
        
        Returns:
            Senha: Senha chamada
        
        Raises:
            ValueError: Se não há senhas na fila
        """
        senha = FilaService.proxima_senha(servico_id)
        
        if not senha:
            raise ValueError(f"Não há senhas aguardando para o serviço {servico_id}")
        
        # Chamar senha
        senha.chamar(numero_balcao)
        
        # Registrar log
        LogActividade.registrar(
            acao='chamada',
            senha_id=senha.id,
            atendente_id=atendente_id,
            descricao=f"Senha {senha.numero} chamada no balcão {numero_balcao}"
        )
        
        return senha
    
    @staticmethod
    def calcular_tempo_espera(servico_id):
        """
        Calcula tempo estimado de espera para nova senha
        
        Args:
            servico_id (int): ID do serviço
        
        Returns:
            int: Tempo estimado em minutos
        
        Logic:
            tempo_espera = senhas_na_fila * tempo_medio_atendimento
        """
        servico = Servico.query.get(servico_id)
        if not servico:
            return 0
        
        # Contar senhas aguardando + atendendo
        senhas_pendentes = Senha.query.filter(
            Senha.servico_id == servico_id,
            Senha.status.in_(['aguardando', 'atendendo'])
        ).count()
        
        return senhas_pendentes * servico.tempo_medio_minutos
    
    @staticmethod
    def obter_estatisticas_fila(servico_id=None):
        """
        Estatísticas da fila em tempo real
        
        Args:
            servico_id (int): ID do serviço (None = geral)
        
        Returns:
            dict: Estatísticas
        """
        query = Senha.query
        
        if servico_id:
            query = query.filter_by(servico_id=servico_id)
        
        return {
            'aguardando_total': query.filter_by(status='aguardando').count(),
            'aguardando_normal': query.filter_by(
                status='aguardando',
                tipo='normal'
            ).count(),
            'aguardando_prioritaria': query.filter_by(
                status='aguardando',
                tipo='prioritaria'
            ).count(),
            'atendendo': query.filter_by(status='atendendo').count(),
            'tempo_espera_estimado': FilaService.calcular_tempo_espera(servico_id) if servico_id else 0
        }
    
    @staticmethod
    def obter_posicao_na_fila(senha_id):
        """
        Calcula posição de uma senha na fila
        
        Args:
            senha_id (int): ID da senha
        
        Returns:
            int: Posição (1 = próxima)
        """
        senha = Senha.query.get(senha_id)
        if not senha or senha.status != 'aguardando':
            return None
        
        fila = FilaService.obter_fila(senha.servico_id, status='aguardando')
        
        for posicao, senha_fila in enumerate(fila, start=1):
            if senha_fila.id == senha_id:
                return posicao
        
        return None
