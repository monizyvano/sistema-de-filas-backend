"""
Model de Log de Atividades (auditoria completa)
Conforme MER Corrigido
"""
from app import db
from app.models.base import BaseModel


class LogActividade(BaseModel):
    """
    Registra todas as ações importantes do sistema
    
    Attributes:
        senha_id (int): FK para Senha (opcional)
        atendente_id (int): FK para Atendente (opcional)
        acao (str): emitida, chamada, iniciada, concluida, cancelada
        descricao (str): Descrição detalhada
        ip_address (str): IP de origem
        user_agent (str): Navegador/dispositivo
    """
    
    __tablename__ = 'log_actividades'
    
    # Colunas
    senha_id = db.Column(
        db.Integer,
        db.ForeignKey('senhas.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
        comment="Senha relacionada"
    )
    
    atendente_id = db.Column(
        db.Integer,
        db.ForeignKey('atendentes.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
        comment="Atendente que realizou a ação"
    )
    
    acao = db.Column(
        db.String(50),
        nullable=False,
        index=True,
        comment="Tipo de ação (emitida, chamada, iniciada, concluida, cancelada)"
    )
    
    descricao = db.Column(
        db.Text,
        nullable=True,
        comment="Descrição detalhada da ação"
    )
    
    ip_address = db.Column(
        db.String(45),
        nullable=True,
        comment="Endereço IP de origem"
    )
    
    user_agent = db.Column(
        db.String(255),
        nullable=True,
        comment="Navegador/dispositivo"
    )
    
    # senha -> backref de Senha
    # atendente -> backref de Atendente
    
    def __init__(self, acao, **kwargs):
        """Construtor do log"""
        self.acao = acao
        self.senha_id = kwargs.get('senha_id')
        self.atendente_id = kwargs.get('atendente_id')
        self.descricao = kwargs.get('descricao')
        self.ip_address = kwargs.get('ip_address')
        self.user_agent = kwargs.get('user_agent')
    
    @staticmethod
    def registrar(acao, senha_id=None, atendente_id=None, descricao=None, **kwargs):
        """
        Método estático para registrar log facilmente
        
        Args:
            acao (str): Tipo de ação
            senha_id (int): ID da senha
            atendente_id (int): ID do atendente
            descricao (str): Descrição
            **kwargs: ip_address, user_agent
        
        Returns:
            LogActividade: Log criado
        """
        log = LogActividade(
            acao=acao,
            senha_id=senha_id,
            atendente_id=atendente_id,
            descricao=descricao,
            ip_address=kwargs.get('ip_address'),
            user_agent=kwargs.get('user_agent')
        )
        return log.save()
    
    def __repr__(self):
        return f"<Log {self.acao}>"
