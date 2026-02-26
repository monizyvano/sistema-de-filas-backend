from datetime import date
from app.extensions import db
from app.models.base import BaseModel
from app.extensions import bcrypt


class Servico(BaseModel):

    __tablename__ = 'servicos'

    nome = db.Column(db.String(100), nullable=False, unique=True)
    descricao = db.Column(db.Text, nullable=True)

    tempo_medio_minutos = db.Column(
        db.Integer,
        nullable=False,
        default=10
    )

    icone = db.Column(
        db.String(50),
        nullable=True,
        default='📄'
    )

    ordem_exibicao = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    ativo = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        index=True
    )

    # 🔥 RELACIONAMENTO RESTAURADO
    senhas = db.relationship(
        'Senha',
        foreign_keys='Senha.servico_id',
        lazy='dynamic'
    )

    def __init__(self, nome, **kwargs):
        self.nome = nome
        self.descricao = kwargs.get('descricao')
        self.tempo_medio_minutos = kwargs.get('tempo_medio_minutos', 10)
        self.icone = kwargs.get('icone', '📄')
        self.ordem_exibicao = kwargs.get('ordem_exibicao', 1)
        self.ativo = kwargs.get('ativo', True)

    def calcular_tempo_espera_estimado(self):

        senhas_pendentes = self.senhas.filter(
            db.text("status IN ('aguardando','chamada','atendendo')")
        ).count()

        return senhas_pendentes * self.tempo_medio_minutos

    def obter_estatisticas_hoje(self):

        hoje = date.today()

        return {
            'total_senhas_hoje': self.senhas.filter(
                db.func.date(db.text("emitida_em")) == hoje
            ).count(),
            'aguardando': self.senhas.filter_by(status='aguardando').count(),
            'atendendo': self.senhas.filter_by(status='atendendo').count(),
            'concluidas_hoje': self.senhas.filter(
                db.text("status = 'concluida'")
            ).count(),
            'tempo_espera_estimado': self.calcular_tempo_espera_estimado()
        }

    def to_dict(self, include_stats=False):
        data = super().to_dict()

        if include_stats:
            data['estatisticas'] = self.obter_estatisticas_hoje()

        return data

    def __repr__(self):
        return f"<Servico {self.nome}>"