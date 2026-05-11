"""
app/models/avaliacao.py
═══════════════════════════════════════════════════════════════
Modelo de Avaliação de Atendimento

Tabela separada de avaliações para permitir:
  - Consultas analíticas eficientes
  - Histórico de avaliações por atendente
  - Prevenção de dupla avaliação via UNIQUE constraint
  - JOIN directo com senhas e atendentes

Campos:
  id           — PK auto-increment
  senha_id     — FK → senhas.id (CASCADE DELETE)
  atendente_id — FK → atendentes.id (SET NULL ao desactivar)
  score        — Nota de 1 a 5 (TINYINT, CHECK 1-5)
  comentario   — Texto livre opcional (max 500 chars)
  criado_em    — Timestamp de criação (imutável)
═══════════════════════════════════════════════════════════════
"""

from datetime import datetime

from app.extensions import db
from app.models.base import BaseModel


class Avaliacao(BaseModel):
    """
    Representa a avaliação de satisfação dada pelo utente
    após um atendimento concluído.

    Regras de negócio:
      - Só pode existir UMA avaliação por senha (UNIQUE senha_id)
      - Só é permitida para senhas com status 'concluida'
      - score obrigatório entre 1 e 5
      - comentario opcional (máx 500 caracteres)
    """

    __tablename__ = "avaliacoes"

    # ── Chaves estrangeiras ─────────────────────────────────
    senha_id = db.Column(
        db.Integer,
        db.ForeignKey("senhas.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,        # ← previne dupla avaliação ao nível da BD
        index=True,
        comment="FK → senhas.id — uma avaliação por senha"
    )

    atendente_id = db.Column(
        db.Integer,
        db.ForeignKey("atendentes.id", ondelete="SET NULL"),
        nullable=True,      # nullable: atendente pode ser desactivado
        index=True,
        comment="FK → atendentes.id — quem atendeu"
    )

    # ── Conteúdo da avaliação ───────────────────────────────
    score = db.Column(
        db.SmallInteger,
        nullable=False,
        comment="Nota de satisfação: 1 (péssimo) a 5 (excelente)"
    )

    comentario = db.Column(
        db.String(500),
        nullable=True,
        comment="Comentário livre do utente (opcional)"
    )

    # ── Relações ────────────────────────────────────────────
    senha = db.relationship(
        "Senha",
        foreign_keys=[senha_id],
        backref=db.backref("avaliacao_obj", uselist=False, lazy="select"),
        lazy="select"
    )

    atendente = db.relationship(
        "Atendente",
        foreign_keys=[atendente_id],
        backref=db.backref("avaliacoes", lazy="dynamic"),
        lazy="select"
    )

    # ── Construtor ──────────────────────────────────────────
    def __init__(self, senha_id: int, score: int,
                 atendente_id: int = None, comentario: str = None):
        """
        Cria uma nova avaliação.

        Args:
            senha_id     — ID da senha concluída
            score        — Nota de 1 a 5
            atendente_id — ID do atendente (extraído automaticamente da senha)
            comentario   — Texto livre (opcional)

        Raises:
            ValueError — se score fora de [1, 5]
        """
        if not 1 <= score <= 5:
            raise ValueError(f"Score inválido: {score}. Deve ser entre 1 e 5.")

        self.senha_id     = senha_id
        self.atendente_id = atendente_id
        self.score        = score
        self.comentario   = (comentario or "").strip()[:500] or None

    # ── Serialização ────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "id":           self.id,
            "senha_id":     self.senha_id,
            "atendente_id": self.atendente_id,
            "score":        self.score,
            "comentario":   self.comentario,
            "criado_em":    self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Avaliacao senha={self.senha_id} score={self.score}>"