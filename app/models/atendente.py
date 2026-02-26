"""
Model Atendente
Representa funcionários que realizam atendimentos
"""

from app.extensions import db, bcrypt
from app.models.base import BaseModel


class Atendente(BaseModel):
    __tablename__ = "atendentes"

    nome = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(200), nullable=False)
    ativo = db.Column(db.Boolean, default=True)
    tipo = db.Column(db.String(20),nullable=False,default='atendente',comment="Tipo: admin ou atendente")
    balcao = db.Column(db.Integer,nullable=True,comment="Número do balcão do atendente"
)
    # ================= MÉTODOS =================

    def set_senha(self, senha: str):
        """Gera hash da senha"""
        self.senha_hash = bcrypt.generate_password_hash(senha).decode("utf-8")

    def verificar_senha(self, senha: str) -> bool:
        """Verifica senha"""
        return bcrypt.check_password_hash(self.senha_hash, senha)

    def to_dict(self, exclude=None):
        """Evita expor senha_hash"""
        exclude = exclude or []
        exclude.append("senha_hash")
        return super().to_dict(exclude=exclude)

    def __repr__(self):
        return f"<Atendente {self.nome}>"