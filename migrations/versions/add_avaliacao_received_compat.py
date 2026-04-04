"""Adicionar avaliacao, recebida_em e acções novas ao log.

Revision ID: c4d5e6f7a8b9
Revises: 9d1c4c6a7b2e
Create Date: 2026-04-01
"""

from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7a8b9"
down_revision = "9d1c4c6a7b2e"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("senhas") as batch_op:
        batch_op.add_column(sa.Column("avaliacao_nota", sa.SmallInteger(), nullable=True, comment="Nota do utente (1-5)"))
        batch_op.add_column(sa.Column("avaliacao_comentario", sa.String(length=500), nullable=True, comment="Comentário opcional do utente"))
        batch_op.add_column(sa.Column("avaliacao_em", sa.DateTime(), nullable=True, comment="Data/hora da avaliação"))
        batch_op.add_column(sa.Column("recebida_em", sa.DateTime(), nullable=True, comment="Confirmação do utente de ter sido chamado"))

    with op.batch_alter_table("senhas") as batch_op:
        batch_op.create_index("ix_senhas_avaliacao_nota", ["avaliacao_nota"], unique=False)


def downgrade():
    with op.batch_alter_table("senhas") as batch_op:
        batch_op.drop_index("ix_senhas_avaliacao_nota")
        batch_op.drop_column("recebida_em")
        batch_op.drop_column("avaliacao_em")
        batch_op.drop_column("avaliacao_comentario")
        batch_op.drop_column("avaliacao_nota")
