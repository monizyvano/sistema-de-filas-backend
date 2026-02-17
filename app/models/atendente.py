"""
Model de Atendente (funcionário do IMTSB)
Conforme MER Corrigido - inclui campo 'tipo' e 'balcao'
"""
from datetime import datetime
from app import db, bcrypt
from app.models.base import BaseModel


class Atendente(BaseModel):
    """
    Representa um atendente/funcionário do IMTSB
    
    Attributes:
        nome (str): Nome completo
        email (str): Email (login único)
        senha_hash (str): Senha criptografada (bcrypt)
        tipo (str): admin ou atendente
        balcao (int): Número do balcão (1, 2, 3) ou NULL se admin
        ativo (bool): Se está ativo no sistema
        ultimo_login (datetime): Data do último login
    
    Relationships:
        senhas_atendidas (list): Senhas que atendeu
        logs (list): Logs de ações
    """
    
    __tablename__ = 'atendentes'
    
    # Enums
    TIPOS = ['admin', 'atendente']
    
    # Colunas
    nome = db.Column(
        db.String(150),
        nullable=False,
        comment="Nome completo do atendente"
    )
    
    email = db.Column(
        db.String(150),
        nullable=False,
        unique=True,
        index=True,
        comment="Email (usado para login)"
    )
    
    senha_hash = db.Column(
        db.String(255),
        nullable=False,
        comment="Senha criptografada com bcrypt"
    )
    
    tipo = db.Column(
        db.Enum(*TIPOS),
        nullable=False,
        default='atendente',
        index=True,
        comment="Tipo: admin ou atendente"
    )
    
    balcao = db.Column(
        db.Integer,
        nullable=True,
        comment="Número do balcão (1, 2, 3) ou NULL se admin"
    )
    
    ativo = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        index=True,
        comment="Se o atendente está ativo"
    )
    
    ultimo_login = db.Column(
        db.DateTime,
        nullable=True,
        comment="Data do último login"
    )
    
    # Relacionamentos
    #COMENTE ou DELETE a linha:
    '''senhas_atendidas = db.relationship(
        'Senha',
        backref='atendente',
        lazy='dynamic',
        foreign_keys='Senha.atendente_id'
    )'''
    
    logs = db.relationship(
        'LogActividade',
        backref='atendente',
        lazy='dynamic',
        foreign_keys='LogActividade.atendente_id'
    )
    
    def __init__(self, nome, email, senha, tipo='atendente', **kwargs):
        """
        Construtor do atendente
        
        Args:
            nome (str): Nome completo
            email (str): Email
            senha (str): Senha em texto plano (será criptografada)
            tipo (str): admin ou atendente
            **kwargs: balcao (opcional)
        """
        self.nome = nome
        self.email = email.lower()
        self.set_senha(senha)
        self.tipo = tipo
        self.balcao = kwargs.get('balcao')
        self.ativo = kwargs.get('ativo', True)
    
    def set_senha(self, senha):
        """
        Criptografa e define a senha
        
        Args:
            senha (str): Senha em texto plano
        """
        self.senha_hash = bcrypt.generate_password_hash(senha).decode('utf-8')
    
    def verificar_senha(self, senha):
        """
        Verifica se a senha está correta
        
        Args:
            senha (str): Senha a verificar
        
        Returns:
            bool: True se correta
        """
        return bcrypt.check_password_hash(self.senha_hash, senha)
    
    def registrar_login(self):
        """Atualiza timestamp do último login"""
        self.ultimo_login = datetime.utcnow()
        return self.save()
    
    def obter_estatisticas_hoje(self):
        """
        Retorna estatísticas de atendimento (hoje)
        
        Returns:
            dict: Estatísticas
        """
        from datetime import date
        from app.models.senha import Senha
        
        hoje = date.today()
        
        senhas_hoje = self.senhas_atendidas.filter(
            db.func.date(Senha.atendimento_concluido_em) == hoje,
            Senha.status == 'concluida'
        ).all()
        
        if not senhas_hoje:
            return {
                'atendimentos_hoje': 0,
                'tempo_medio_atendimento': 0
            }
        
        tempos = [s.tempo_atendimento_minutos for s in senhas_hoje if s.tempo_atendimento_minutos]
        tempo_medio = sum(tempos) / len(tempos) if tempos else 0
        
        return {
            'atendimentos_hoje': len(senhas_hoje),
            'tempo_medio_atendimento': round(tempo_medio, 1)
        }
    
    def to_dict(self, include_stats=False):
        """
        Sobrescreve método da classe base
        
        Args:
            include_stats (bool): Se deve incluir estatísticas
        """
        data = super().to_dict(exclude=['senha_hash'])
        
        if include_stats:
            data['estatisticas'] = self.obter_estatisticas_hoje()
        
        return data
    
    def __repr__(self):
        return f"<Atendente {self.nome} - Balcão {self.balcao}>"
