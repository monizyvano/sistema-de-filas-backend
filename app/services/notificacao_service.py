"""
NotificacaoService - Envio de notificações
Responsável por: SMS, emails (futuro)
"""
from app.models import Senha, Configuracao


class NotificacaoService:
    """
    Service para notificações
    
    Methods:
        notificar_senha_chamada(): Envia SMS quando senha é chamada
        notificar_proximo_atendimento(): Avisa próximos da fila
    
    Note:
        Implementação de SMS será feita posteriormente
        usando API de SMS (exemplo: Twilio, Africa's Talking)
    """
    
    @staticmethod
    def notificar_senha_chamada(senha_id):
        """
        Notifica utente que senha foi chamada (SMS)
        
        Args:
            senha_id (int): ID da senha
        
        Returns:
            bool: True se enviado
        
        Note:
            Requer integração com API de SMS (futuro)
        """
        senha = Senha.query.get(senha_id)
        
        # Verificar se tem contato
        if not senha or not senha.usuario_contato:
            return False
        
        # TODO: Implementar envio de SMS
        # Exemplo com Twilio:
        # client.messages.create(
        #     to=senha.usuario_contato,
        #     from_='+244...',
        #     body=f'Sua senha {senha.numero} foi chamada no balcão {senha.numero_balcao}!'
        # )
        
        print(f"[SMS simulado] Senha {senha.numero} chamada -> {senha.usuario_contato}")
        
        return True
    
    @staticmethod
    def notificar_proximo_atendimento(senha_id):
        """
        Avisa utente que está próximo de ser chamado
        
        Args:
            senha_id (int): ID da senha
        
        Returns:
            bool: True se enviado
        """
        from app.services.fila_service import FilaService
        
        senha = Senha.query.get(senha_id)
        if not senha or not senha.usuario_contato:
            return False
        
        # Verificar posição na fila
        posicao = FilaService.obter_posicao_na_fila(senha_id)
        
        # Notificar apenas se está entre os próximos 3
        if posicao and posicao <= 3:
            # TODO: Implementar SMS
            print(f"[SMS simulado] Voce esta em {posicao}o lugar -> {senha.usuario_contato}")
            return True
        
        return False
