"""
Model de Serviço (ex: Secretaria Académica, Tesouraria, Biblioteca)
Baseado no MER Corrigido
"""
from app import db
from app.models.base import BaseModel


class Servico(BaseModel):
    """
    Representa um tipo de serviço oferecido no IMTSB
    
    Attributes:
        nome (str): Nome do serviço (ex: "Matricula")
        descricao (str): Descrição detalhada
        tempo_medio_minutos (int): Tempo médio de atendimento
        icone (str): Emoji ou ícone para UI (ex: "📄", "💰")
        ordem_exibicao (int): Ordem na interface (1=primeiro)
        ativo (bool): Se o serviço está disponível
    
    Relationships:
        senhas (list): Senhas emitidas para este serviço
    """
    
    __tablename__ = 'servicos'
    
    # Colunas (conforme MER corrigido)
    nome = db.Column(
        db.String(100),
        nullable=False,
        unique=True,
        comment="Nome do serviço"
    )
    
    descricao = db.Column(
        db.Text,
        nullable=True,
        comment="Descrição detalhada do serviço"
    )
    
    tempo_medio_minutos = db.Column(
        db.Integer,
        nullable=False,
        default=10,
        comment="Tempo médio de atendimento em minutos"
    )
    
    icone = db.Column(
        db.String(50),
        nullable=True,
        default='📄',
        comment="Emoji ou código de ícone para UI"
    )
    
    ordem_exibicao = db.Column(
        db.Integer,
        nullable=False,
        default=1,
        comment="Ordem de exibição na interface (1=primeiro)"
    )
    
    ativo = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Se o serviço está ativo"
    )
    
    # Relacionamentos (1:N)
    senhas = db.relationship(
        'Senha',
        backref='servico',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )
    
    def __init__(self, nome, **kwargs):
        """
        Construtor do serviço
        
        Args:
            nome (str): Nome do serviço
            **kwargs: Outros atributos opcionais
        """
        self.nome = nome
        self.descricao = kwargs.get('descricao')
        self.tempo_medio_minutos = kwargs.get('tempo_medio_minutos', 10)
        self.icone = kwargs.get('icone', '📄')
        self.ordem_exibicao = kwargs.get('ordem_exibicao', 1)
        self.ativo = kwargs.get('ativo', True)
    
    def calcular_tempo_espera_estimado(self):
        """
        Calcula tempo estimado de espera baseado na fila atual
        
        Returns:
            int: Tempo em minutos
        """
        from app.models.senha import Senha
        
        # Conta senhas aguardando + em atendimento
        senhas_pendentes = self.senhas.filter(
            Senha.status.in_(['aguardando', 'chamando', 'atendendo'])
        ).count()
        
        return senhas_pendentes * self.tempo_medio_minutos
    
    def obter_estatisticas_hoje(self):
        """
        Retorna estatísticas do serviço (hoje)
        
        Returns:
            dict: Estatísticas
        """
        from datetime import datetime, date
        from app.models.senha import Senha
        
        hoje = date.today()
        
        return {
            'total_senhas_hoje': self.senhas.filter(
                db.func.date(Senha.created_at) == hoje
            ).count(),
            'aguardando': self.senhas.filter_by(status='aguardando').count(),
            'atendendo': self.senhas.filter_by(status='atendendo').count(),
            'concluidas_hoje': self.senhas.filter(
                Senha.status == 'concluida',
                db.func.date(Senha.atendimento_concluido_em) == hoje
            ).count(),
            'tempo_espera_estimado': self.calcular_tempo_espera_estimado()
        }
    
    def to_dict(self, include_stats=False):
        """Sobrescreve método da classe base"""
        data = super().to_dict()
        
        if include_stats:
            data['estatisticas'] = self.obter_estatisticas_hoje()
        
        return data
    
    def __repr__(self):
        return f"<Servico {self.nome}>"
