from datetime import datetime, date
from app import db, bcrypt
from app.models.base import BaseModel


class Atendente(BaseModel):

    __tablename__ = 'atendentes'

    TIPOS = ['admin', 'atendente']

    nome = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), nullable=False, unique=True, index=True)
    senha_hash = db.Column(db.String(255), nullable=False)

    tipo = db.Column(
        db.Enum(*TIPOS),
        nullable=False,
        default='atendente',
        index=True
    )

    balcao = db.Column(db.Integer, nullable=True)

    ativo = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        index=True
    )

    ultimo_login = db.Column(db.DateTime, nullable=True)

    # 🔥 RELACIONAMENTO RESTAURADO
    senhas_atendidas = db.relationship(
        'Senha',
        foreign_keys='Senha.atendente_id',
        lazy='dynamic'
    )

    logs = db.relationship(
        'LogActividade',
        foreign_keys='LogActividade.atendente_id',
        lazy='dynamic'
    )

    def __init__(self, nome, email, senha, tipo='atendente', **kwargs):
        self.nome = nome
        self.email = email.lower()
        self.set_senha(senha)
        self.tipo = tipo
        self.balcao = kwargs.get('balcao')
        self.ativo = kwargs.get('ativo', True)

    def set_senha(self, senha):
        self.senha_hash = bcrypt.generate_password_hash(senha).decode('utf-8')

    def verificar_senha(self, senha):
        return bcrypt.check_password_hash(self.senha_hash, senha)

    def registrar_login(self):
        self.ultimo_login = datetime.utcnow()
        return self.save()

    def obter_estatisticas_hoje(self):

        hoje = date.today()

        senhas_hoje = self.senhas_atendidas.filter(
            db.func.date(db.text("atendimento_concluido_em")) == hoje,
            db.text("status = 'concluida'")
        ).all()

        if not senhas_hoje:
            return {
                'atendimentos_hoje': 0,
                'tempo_medio_atendimento': 0
            }

        tempos = [
            s.tempo_atendimento_minutos
            for s in senhas_hoje
            if s.tempo_atendimento_minutos
        ]

        tempo_medio = sum(tempos) / len(tempos) if tempos else 0

        return {
            'atendimentos_hoje': len(senhas_hoje),
            'tempo_medio_atendimento': round(tempo_medio, 1)
        }

    def to_dict(self, include_stats=False):
        data = super().to_dict(exclude=['senha_hash'])

        if include_stats:
            data['estatisticas'] = self.obter_estatisticas_hoje()

        return data

    def __repr__(self):
        return f"<Atendente {self.nome} - Balcão {self.balcao}>"