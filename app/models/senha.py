"""
app/models/senha.py — CORRIGIDO
Problema resolvido: to_dict() usava nomes errados de colunas
  ERRADO:  self.nota_avaliacao, self.comentario_avaliacao
  CORRECTO: self.avaliacao_nota, self.avaliacao_comentario
"""

from datetime import datetime
from app.extensions import db
from app.models.base import BaseModel


class Senha(BaseModel):
    """Model para senhas de atendimento com numeração diária."""

    __tablename__ = 'senhas'

    __table_args__ = (
        # Constraint única por número + data → reinicia diariamente
        db.UniqueConstraint('numero', 'data_emissao', name='uq_numero_data'),
        {'comment': 'Senhas de atendimento com numeração diária'}
    )

    TIPOS  = ['normal', 'prioritaria']
    STATUS = ['aguardando', 'chamando', 'atendendo', 'concluida', 'cancelada']

    numero = db.Column(db.String(20), nullable=False, index=True)
    data_emissao = db.Column(
        db.Date,
        nullable=False,
        default=lambda: datetime.utcnow().date(),
        index=True
    )
    tipo = db.Column(db.String(20), nullable=False, default='normal', index=True)
    status = db.Column(db.String(20), nullable=False, default='aguardando', index=True)

    servico_id   = db.Column(db.Integer, db.ForeignKey('servicos.id'), nullable=False, index=True)
    atendente_id = db.Column(db.Integer, db.ForeignKey('atendentes.id'), nullable=True)
    utente_id    = db.Column(
        db.Integer,
        db.ForeignKey('utentes.id', ondelete='SET NULL'),
        nullable=True, index=True
    )

    numero_balcao   = db.Column(db.Integer, nullable=True)
    usuario_contato = db.Column(db.String(100), nullable=True)

    emitida_em               = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    chamada_em               = db.Column(db.DateTime, nullable=True)
    atendimento_iniciado_em  = db.Column(db.DateTime, nullable=True)
    atendimento_concluido_em = db.Column(db.DateTime, nullable=True)
    recebida_em              = db.Column(db.DateTime, nullable=True)

    tempo_espera_minutos      = db.Column(db.Integer, nullable=True)
    tempo_atendimento_minutos = db.Column(db.Integer, nullable=True)
    observacoes               = db.Column(db.Text, nullable=True)

    # Avaliação — nomes correctos das colunas no banco
    avaliacao_nota       = db.Column(db.SmallInteger, nullable=True)
    avaliacao_comentario = db.Column(db.String(500), nullable=True)
    avaliacao_em         = db.Column(db.DateTime, nullable=True)

    servico  = db.relationship('Servico',  foreign_keys=[servico_id])
    atendente = db.relationship('Atendente', foreign_keys=[atendente_id])

    def __init__(self, numero, servico_id, tipo='normal',
                 usuario_contato=None, data_emissao=None, utente_id=None):
        self.numero          = numero
        self.servico_id      = servico_id
        self.tipo            = tipo
        self.usuario_contato = usuario_contato
        self.data_emissao    = data_emissao or datetime.utcnow().date()
        self.status          = 'aguardando'
        self.emitida_em      = datetime.utcnow()
        self.utente_id       = utente_id

    def __repr__(self):
        return f'<Senha {self.numero} ({self.data_emissao}) - {self.status}>'

    def to_dict(self, include_relationships=True):
        data = {
            'id':                        self.id,
            'numero':                    self.numero,
            'data_emissao':              self.data_emissao.isoformat() if self.data_emissao else None,
            'tipo':                      self.tipo,
            'status':                    self.status,
            'servico_id':                self.servico_id,
            'atendente_id':              self.atendente_id,
            'utente_id':                 self.utente_id,
            'numero_balcao':             self.numero_balcao,
            'usuario_contato':           self.usuario_contato,
            'emitida_em':                self.emitida_em.isoformat() if self.emitida_em else None,
            'chamada_em':                self.chamada_em.isoformat() if self.chamada_em else None,
            'atendimento_iniciado_em':   self.atendimento_iniciado_em.isoformat() if self.atendimento_iniciado_em else None,
            'atendimento_concluido_em':  self.atendimento_concluido_em.isoformat() if self.atendimento_concluido_em else None,
            'recebida_em':               self.recebida_em.isoformat() if self.recebida_em else None,
            'tempo_espera_minutos':      self.tempo_espera_minutos,
            'tempo_atendimento_minutos': self.tempo_atendimento_minutos,
            'observacoes':               self.observacoes,
            # CORRIGIDO: nomes correctos das colunas
            'avaliacao_nota':            self.avaliacao_nota,
            'avaliacao_comentario':      self.avaliacao_comentario,
            'avaliacao_em':              self.avaliacao_em.isoformat() if self.avaliacao_em else None,
            'created_at':                self.created_at.isoformat() if self.created_at else None,
            'updated_at':                self.updated_at.isoformat() if self.updated_at else None,
        }

        if include_relationships:
            if self.servico:
                data['servico'] = {
                    'id':    self.servico.id,
                    'nome':  self.servico.nome,
                    'icone': self.servico.icone,
                }
            if self.atendente:
                data['atendente'] = {
                    'id':   self.atendente.id,
                    'nome': self.atendente.nome,
                }

        return data

    # ── Métodos de ciclo de vida ──────────────────────────────

    def chamar(self, numero_balcao=None):
        if self.status != 'aguardando':
            raise ValueError(f'Senha {self.numero} não está aguardando (status: {self.status})')
        self.status    = 'chamada'
        self.chamada_em = datetime.utcnow()
        if numero_balcao:
            self.numero_balcao = numero_balcao
        db.session.commit()

    def iniciar_atendimento(self, atendente_id, numero_balcao=None):
        if self.status not in ['aguardando', 'chamada']:
            raise ValueError(f'Senha {self.numero} não pode ser atendida (status: {self.status})')
        self.status                 = 'atendendo'
        self.atendente_id           = atendente_id
        self.atendimento_iniciado_em = datetime.utcnow()
        if numero_balcao:
            self.numero_balcao = numero_balcao
        if self.emitida_em:
            delta = self.atendimento_iniciado_em - self.emitida_em
            self.tempo_espera_minutos = int(delta.total_seconds() / 60)
        db.session.commit()

    def finalizar_atendimento(self, observacoes=None):
        if self.status != 'atendendo':
            raise ValueError(f'Senha {self.numero} não está em atendimento (status: {self.status})')
        self.status                  = 'concluida'
        self.atendimento_concluido_em = datetime.utcnow()
        if observacoes:
            self.observacoes = observacoes
        if self.atendimento_iniciado_em:
            delta = self.atendimento_concluido_em - self.atendimento_iniciado_em
            self.tempo_atendimento_minutos = int(delta.total_seconds() / 60)
        db.session.commit()

    def cancelar(self, motivo, atendente_id=None):
        if self.status == 'concluida':
            raise ValueError(f'Senha {self.numero} já foi concluída')
        self.status     = 'cancelada'
        self.observacoes = f'CANCELADA: {motivo}'
        if atendente_id:
            self.atendente_id = atendente_id
        db.session.commit()

    @classmethod
    def obter_por_numero_e_data(cls, numero, data_emissao=None):
        if data_emissao is None:
            data_emissao = datetime.utcnow().date()
        return cls.query.filter_by(numero=numero, data_emissao=data_emissao).first()

    @classmethod
    def obter_fila_do_dia(cls, servico_id=None, data_emissao=None):
        if data_emissao is None:
            data_emissao = datetime.utcnow().date()
        query = cls.query.filter_by(data_emissao=data_emissao, status='aguardando')
        if servico_id:
            query = query.filter_by(servico_id=servico_id)
        return query.order_by(
            db.case((cls.tipo == 'prioritaria', 0), else_=1),
            cls.emitida_em
        ).all()

    @classmethod
    def obter_por_utente(cls, utente_id, limite=10):
        return cls.query.filter_by(utente_id=utente_id)\
                        .order_by(cls.emitida_em.desc())\
                        .limit(limite).all()