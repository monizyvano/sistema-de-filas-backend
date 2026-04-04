"""add utentes and link senhas

Revision ID: 9d1c4c6a7b2e
Revises: e1befa2ab1b0
Create Date: 2026-03-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '9d1c4c6a7b2e'
down_revision = 'e1befa2ab1b0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'utentes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('nome', sa.String(length=150), nullable=False, comment='Nome completo ou nome de identificação do utente'),
        sa.Column('telefone', sa.String(length=20), nullable=True, comment='Número de telefone — campo principal de deduplicação'),
        sa.Column('email', sa.String(length=150), nullable=True, comment='Endereço de email opcional'),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.true(), comment='Registo activo (True) ou arquivado (False)'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('utentes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_utentes_ativo'), ['ativo'], unique=False)
        batch_op.create_index(batch_op.f('ix_utentes_email'), ['email'], unique=False)
        batch_op.create_index(batch_op.f('ix_utentes_telefone'), ['telefone'], unique=False)

    with op.batch_alter_table('senhas', schema=None) as batch_op:
        batch_op.add_column(sa.Column('utente_id', sa.Integer(), nullable=True, comment='FK para utentes — nullable para compatibilidade retroactiva'))
        batch_op.create_index(batch_op.f('ix_senhas_utente_id'), ['utente_id'], unique=False)
        batch_op.create_foreign_key('fk_senhas_utentes', 'utentes', ['utente_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('senhas', schema=None) as batch_op:
        batch_op.drop_constraint('fk_senhas_utentes', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_senhas_utente_id'))
        batch_op.drop_column('utente_id')

    with op.batch_alter_table('utentes', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_utentes_telefone'))
        batch_op.drop_index(batch_op.f('ix_utentes_email'))
        batch_op.drop_index(batch_op.f('ix_utentes_ativo'))

    op.drop_table('utentes')
