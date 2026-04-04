"""
app/models/utente.py
═══════════════════════════════════════════════════════════════
Model do Utente (cliente do serviço de atendimento).

Sprint 2: entidade mínima mas correcta para o TCC.
"""

from app.extensions import db
from app.models.base import BaseModel


class Utente(BaseModel):
    """Representa o cidadão/cliente que solicita atendimento."""

    __tablename__ = 'utentes'

    nome = db.Column(
        db.String(150),
        nullable=False,
        comment='Nome completo ou nome de identificação do utente'
    )

    telefone = db.Column(
        db.String(20),
        nullable=True,
        index=True,
        comment='Número de telefone — campo principal de deduplicação'
    )

    email = db.Column(
        db.String(150),
        nullable=True,
        index=True,
        comment='Endereço de email opcional'
    )

    ativo = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        index=True,
        comment='Registo activo (True) ou arquivado (False)'
    )

    senhas = db.relationship(
        'Senha',
        foreign_keys='Senha.utente_id',
        backref='utente',
        lazy='dynamic',
        order_by='desc(Senha.emitida_em)'
    )

    def __init__(self, nome, telefone=None, email=None):
        self.nome = nome.strip()
        self.telefone = telefone.strip() if telefone else None
        self.email = email.strip().lower() if email else None
        self.ativo = True

    @classmethod
    def encontrar_ou_criar(cls, nome, telefone=None, email=None):
        """Reaproveita utente existente ou cria novo registo."""
        if telefone:
            telefone_limpo = telefone.strip()
            existente = cls.query.filter_by(telefone=telefone_limpo, ativo=True).first()
            if existente:
                return existente, False

        if email:
            email_limpo = email.strip().lower()
            existente = cls.query.filter_by(email=email_limpo, ativo=True).first()
            if existente:
                return existente, False

        novo = cls(nome=nome, telefone=telefone, email=email)
        novo.save()
        return novo, True

    @classmethod
    def buscar_por_telefone(cls, telefone):
        if not telefone:
            return None
        return cls.query.filter_by(telefone=telefone.strip(), ativo=True).first()

    def to_dict(self, include_senhas=False):
        dados = {
            'id': self.id,
            'nome': self.nome,
            'telefone': self.telefone,
            'email': self.email,
            'ativo': self.ativo,
            'criado_em': self.created_at.isoformat() if self.created_at else None,
        }

        if include_senhas:
            ultimas = self.senhas.limit(10).all()
            dados['senhas_recentes'] = [
                {
                    'id': s.id,
                    'numero': s.numero,
                    'tipo': s.tipo,
                    'status': s.status,
                    'emitida_em': s.emitida_em.isoformat() if s.emitida_em else None,
                    'servico': s.servico.nome if s.servico else None,
                }
                for s in ultimas
            ]

        return dados

    def __repr__(self):
        return f"<Utente id={self.id} nome='{self.nome}' tel='{self.telefone}'>"
