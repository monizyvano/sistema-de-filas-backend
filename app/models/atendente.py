"""
app/models/atendente.py
═══════════════════════════════════════════════════════════════
Model Atendente - SPRINT 1 (corrigido)

ALTERAÇÕES NESTA VERSÃO:
  ✅ Adicionado campo `servico_id` (nullable) — resolve o TODO
     do callNext que enviava servico_id fixo = 1.
     NULL significa "atende todos os serviços" (útil para admin).
═══════════════════════════════════════════════════════════════
"""

from app.extensions import db, bcrypt
from app.models.base import BaseModel


class Atendente(BaseModel):
    """
    Representa os funcionários (atendentes e administradores).

    Atributos principais:
        nome        – Nome completo
        email       – Email único (usado no login)
        senha_hash  – Hash bcrypt da palavra-passe
        ativo       – Conta activa ou suspensa
        tipo        – 'admin' | 'atendente'
        balcao      – Número do balcão atribuído (nullable)
        servico_id  – Serviço principal do atendente (nullable = todos)
    """

    __tablename__ = "atendentes"

    nome = db.Column(
        db.String(100),
        nullable=False,
        comment="Nome completo do funcionário"
    )

    email = db.Column(
        db.String(120),
        unique=True,
        nullable=False,
        comment="Email de acesso ao sistema"
    )

    senha_hash = db.Column(
        db.String(200),
        nullable=False,
        comment="Hash bcrypt da palavra-passe"
    )

    ativo = db.Column(
        db.Boolean,
        default=True,
        comment="Conta activa (True) ou suspensa (False)"
    )

    tipo = db.Column(
        db.String(20),
        nullable=False,
        default='atendente',
        comment="Tipo: 'admin' ou 'atendente'"
    )

    balcao = db.Column(
        db.Integer,
        nullable=True,
        comment="Número do balcão físico (ex: 1, 2, 3)"
    )

    # SPRINT 1: campo novo — resolve o TODO do callNext
    # NULL = o atendente pode atender qualquer serviço (caso do admin)
    servico_id = db.Column(
        db.Integer,
        db.ForeignKey('servicos.id', ondelete='SET NULL'),
        nullable=True,
        comment="Serviço principal (NULL = todos os serviços)"
    )

    servico = db.relationship(
        'Servico',
        foreign_keys=[servico_id],
        lazy='select'
    )

    # ═══════════════════════════════════════════════════════════
    # Inicialização
    # ═══════════════════════════════════════════════════════════

    def __init__(self, **kwargs):
        """
        Aceita 'senha' em texto simples e converte para hash.
        """
        senha = kwargs.pop("senha", None)
        super().__init__(**kwargs)
        if senha:
            self.set_senha(senha)

    # ═══════════════════════════════════════════════════════════
    # Métodos de palavra-passe
    # ═══════════════════════════════════════════════════════════

    def set_senha(self, senha: str):
        """Gera e armazena o hash bcrypt da senha."""
        self.senha_hash = bcrypt.generate_password_hash(senha).decode("utf-8")

    def verificar_senha(self, senha: str) -> bool:
        """Compara texto simples com o hash armazenado."""
        return bcrypt.check_password_hash(self.senha_hash, senha)

    # ═══════════════════════════════════════════════════════════
    # Serialização
    # ═══════════════════════════════════════════════════════════

    def to_dict(self, exclude=None):
        """Devolve dict sem expor o hash da senha."""
        exclude = list(exclude or [])
        exclude.append("senha_hash")
        data = super().to_dict(exclude=exclude)
        data['servico_id'] = self.servico_id
        return data

    def __repr__(self):
        return f"<Atendente id={self.id} nome='{self.nome}' tipo='{self.tipo}'>"
