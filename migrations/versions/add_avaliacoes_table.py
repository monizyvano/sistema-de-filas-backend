"""
migrations/versions/add_avaliacoes_table.py
═══════════════════════════════════════════════════════════════
Migration: Criar tabela 'avaliacoes'

Aplica:   flask db upgrade
Reverte:  flask db downgrade

Nota: Se não usas Alembic, podes executar o SQL directo
na secção EQUIVALENT SQL abaixo.
═══════════════════════════════════════════════════════════════
"""

"""add_avaliacoes_table

Revision ID: a1b2c3d4e5f6
Revises: ec25a1fe7c86
Create Date: 2026-05-04 00:00:00.000000
"""

# ─── EQUIVALENT SQL (MySQL) ────────────────────────────────
# Se preferires executar directamente na base de dados:
#
# CREATE TABLE `avaliacoes` (
#   `id`            INT          NOT NULL AUTO_INCREMENT,
#   `senha_id`      INT          NOT NULL UNIQUE,
#   `atendente_id`  INT          NULL,
#   `score`         TINYINT      NOT NULL  COMMENT 'Nota de 1 a 5',
#   `comentario`    VARCHAR(500) NULL,
#   `created_at`    DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP,
#   `updated_at`    DATETIME     NOT NULL  DEFAULT CURRENT_TIMESTAMP
#                                         ON UPDATE CURRENT_TIMESTAMP,
#   PRIMARY KEY (`id`),
#   UNIQUE KEY `uq_avaliacoes_senha_id` (`senha_id`),
#   KEY `ix_avaliacoes_atendente_id` (`atendente_id`),
#   CONSTRAINT `fk_aval_senha`
#     FOREIGN KEY (`senha_id`)
#     REFERENCES `senhas` (`id`)
#     ON DELETE CASCADE,
#   CONSTRAINT `fk_aval_atendente`
#     FOREIGN KEY (`atendente_id`)
#     REFERENCES `atendentes` (`id`)
#     ON DELETE SET NULL,
#   CONSTRAINT `chk_score` CHECK (`score` BETWEEN 1 AND 5)
# ) ENGINE=InnoDB
#   DEFAULT CHARSET=utf8mb4
#   COLLATE=utf8mb4_0900_ai_ci
#   COMMENT='Avaliações de satisfação do atendimento';
# ─────────────────────────────────────────────────────────

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "ec25a1fe7c86"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "avaliacoes",
        sa.Column("id",           sa.Integer(),     nullable=False,  autoincrement=True),
        sa.Column("senha_id",     sa.Integer(),     nullable=False),
        sa.Column("atendente_id", sa.Integer(),     nullable=True),
        sa.Column("score",        sa.SmallInteger(), nullable=False),
        sa.Column("comentario",   sa.String(500),   nullable=True),
        sa.Column("created_at",   sa.DateTime(),    nullable=False),
        sa.Column("updated_at",   sa.DateTime(),    nullable=False),

        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("senha_id",     name="uq_avaliacoes_senha_id"),
        sa.ForeignKeyConstraint(
            ["senha_id"],     ["senhas.id"],     ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["atendente_id"], ["atendentes.id"], ondelete="SET NULL"
        ),
    )
    op.create_index("ix_avaliacoes_atendente_id", "avaliacoes", ["atendente_id"])


def downgrade() -> None:
    op.drop_index("ix_avaliacoes_atendente_id", table_name="avaliacoes")
    op.drop_table("avaliacoes")