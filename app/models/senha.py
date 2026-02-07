"""
Model de Senha (Token de atendimento)
✨ NÚCLEO DO SISTEMA - Mescla Senha + Atendimento conforme MER
"""
from datetime import datetime
from app import db
from app.models.base import BaseModel


class Senha(BaseModel):
    """
    Representa uma senha/token de atendimento
    ✨ Inclui TODO o ciclo: emissão → chamada → atendimento → conclusão
    
    Attributes:
        numero (str): Número único (ex: "N001", "P005")
        tipo (str): normal, prioritaria
        status (str): aguardando, chamando, atendendo, concluida, cancelada
        servico_id (int): FK para Servico
        atendente_id (int): FK para Atendente (quem atendeu)
        numero_balcao (int): Número do balcão (1, 2, 3, 4)
        usuario_contato (str): Telefone OPCIONAL (para notificações futuras)
        
        # Timestamps do fluxo completo
        emitida_em (datetime): Quando foi emitida
        chamada_em (datetime): Quando foi chamada
        atendimento_iniciado_em (datetime): Início do atendimento
        atendimento_concluido_em (datetime): Fim do atendimento
        
        # Métricas (calculadas automaticamente)
        tempo_espera_minutos (int): Tempo de espera
        tempo_atendimento_minutos (int): Duração do atendimento
        
        observacoes (str): Notas do atendente
    
    Relationships:
        servico (Servico): Serviço solicitado
        atendente (Atendente): Quem atendeu
        logs (list): Histórico de ações
    """
    
    __tablename__ = 'senhas'
    
    # Enums
    TIPOS = ['normal', 'prioritaria']
    STATUS = ['aguardando', 'chamando', 'atendendo', 'concluida', 'cancelada']
    
    # Colunas principais
    numero = db.Column(
        db.String(20),
        nullable=False,
        unique=True,
        index=True,
        comment="Número único da senha (ex: N001, P005)"
    )
    
    tipo = db.Column(
        db.Enum(*TIPOS),
        nullable=False,
        default='normal',
        index=True,
        comment="Tipo: normal ou prioritaria"
    )
    
    status = db.Column(
        db.Enum(*STATUS),
        nullable=False,
        default='aguardando',
        index=True,
        comment="Status atual da senha"
    )
    
    # Foreign Keys
    servico_id = db.Column(
        db.Integer,
        db.ForeignKey('servicos.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
        comment="Serviço solicitado"
    )
    
    atendente_id = db.Column(
        db.Integer,
        db.ForeignKey('atendentes.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
        comment="Atendente que realizou o atendimento"
    )
    
    # Informações do atendimento
    numero_balcao = db.Column(
        db.Integer,
        nullable=True,
        comment="Número do balcão (1, 2, 3, 4...)"
    )
    
    usuario_contato = db.Column(
        db.String(20),
        nullable=True,
        comment="Telefone do utente (OPCIONAL, para SMS futuro)"
    )
    
    # ⏰ TIMESTAMPS DO FLUXO COMPLETO
    emitida_em = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        index=True,
        comment="Momento da emissão"
    )
    
    chamada_em = db.Column(
        db.DateTime,
        nullable=True,
        comment="Momento em que foi chamada"
    )
    
    atendimento_iniciado_em = db.Column(
        db.DateTime,
        nullable=True,
        comment="Início do atendimento"
    )
    
    atendimento_concluido_em = db.Column(
        db.DateTime,
        nullable=True,
        comment="Fim do atendimento"
    )
    
    # 📊 MÉTRICAS CALCULADAS
    tempo_espera_minutos = db.Column(
        db.Integer,
        nullable=True,
        comment="Tempo de espera em minutos (calculado)"
    )
    
    tempo_atendimento_minutos = db.Column(
        db.Integer,
        nullable=True,
        comment="Duração do atendimento em minutos (calculado)"
    )
    
    observacoes = db.Column(
        db.Text,
        nullable=True,
        comment="Observações do atendente"
    )
    
    # Relacionamentos
    # servico -> backref de Servico
    # atendente -> backref de Atendente
    
    logs = db.relationship(
        'LogActividade',
        backref='senha',
        lazy='dynamic',
        cascade='all, delete-orphan',
        order_by='LogActividade.created_at.desc()'
    )
    
    def __init__(self, numero, servico_id, tipo='normal', **kwargs):
        """
        Construtor da senha
        
        Args:
            numero (str): Número da senha
            servico_id (int): ID do serviço
            tipo (str): Tipo de senha (normal/prioritaria)
            **kwargs: usuario_contato (opcional)
        """
        self.numero = numero
        self.servico_id = servico_id
        self.tipo = tipo
        self.status = 'aguardando'
        self.emitida_em = datetime.utcnow()
        self.usuario_contato = kwargs.get('usuario_contato')
    
    def chamar(self, numero_balcao=None):
        """
        Muda status para 'chamando'
        
        Args:
            numero_balcao (int): Número do balcão que chamou
        
        Returns:
            self: Senha atualizada
        """
        if self.status != 'aguardando':
            raise ValueError(f"Senha {self.numero} não está aguardando")
        
        self.status = 'chamando'
        self.chamada_em = datetime.utcnow()
        
        if numero_balcao:
            self.numero_balcao = numero_balcao
        
        return self.save()
    
    def iniciar_atendimento(self, atendente_id, numero_balcao=None):
        """
        Inicia o atendimento
        
        Args:
            atendente_id (int): ID do atendente
            numero_balcao (int): Número do balcão
        
        Returns:
            self: Senha atualizada
        """
        if self.status not in ['chamando', 'aguardando']:
            raise ValueError(f"Senha {self.numero} não pode iniciar atendimento")
        
        self.status = 'atendendo'
        self.atendente_id = atendente_id
        self.atendimento_iniciado_em = datetime.utcnow()
        
        if numero_balcao:
            self.numero_balcao = numero_balcao
        
        if not self.chamada_em:
            self.chamada_em = datetime.utcnow()
        
        # Calcular tempo de espera
        self._calcular_tempo_espera()
        
        return self.save()
    
    def finalizar(self, observacoes=None):
        """
        Finaliza o atendimento
        
        Args:
            observacoes (str): Observações finais
        
        Returns:
            self: Senha atualizada
        """
        if self.status != 'atendendo':
            raise ValueError(f"Senha {self.numero} não está em atendimento")
        
        self.status = 'concluida'
        self.atendimento_concluido_em = datetime.utcnow()
        
        if observacoes:
            self.observacoes = observacoes
        
        # Calcular tempo de atendimento
        self._calcular_tempo_atendimento()
        
        return self.save()
    
    def cancelar(self, motivo=None):
        """
        Cancela a senha
        
        Args:
            motivo (str): Motivo do cancelamento
        
        Returns:
            self: Senha atualizada
        """
        self.status = 'cancelada'
        
        if motivo:
            self.observacoes = f"Cancelada: {motivo}"
        
        return self.save()
    
    def _calcular_tempo_espera(self):
        """Calcula e salva tempo de espera (privado)"""
        if self.atendimento_iniciado_em and self.emitida_em:
            delta = self.atendimento_iniciado_em - self.emitida_em
            self.tempo_espera_minutos = int(delta.total_seconds() / 60)
    
    def _calcular_tempo_atendimento(self):
        """Calcula e salva tempo de atendimento (privado)"""
        if self.atendimento_concluido_em and self.atendimento_iniciado_em:
            delta = self.atendimento_concluido_em - self.atendimento_iniciado_em
            self.tempo_atendimento_minutos = int(delta.total_seconds() / 60)
    
    def to_dict(self):
        """Sobrescreve método da classe base"""
        data = super().to_dict()
        
        # Adicionar relacionamentos
        data['servico'] = {
            'id': self.servico.id,
            'nome': self.servico.nome,
            'icone': self.servico.icone
        } if self.servico else None
        
        data['atendente'] = {
            'id': self.atendente.id,
            'nome': self.atendente.nome,
            'balcao': self.atendente.balcao
        } if self.atendente else None
        
        return data
    
    def __repr__(self):
        return f"<Senha {self.numero} - {self.status}>"
