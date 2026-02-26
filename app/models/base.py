"""
Classe base para todos os models
Implementa funcionalidades comuns usando POO
"""
from datetime import datetime
from app.extensions import db


class BaseModel(db.Model):
    """
    Classe abstrata base para todos os models
    """

    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    def save(self):
        try:
            db.session.add(self)
            db.session.commit()
            return self
        except Exception as e:
            db.session.rollback()
            raise e

    def delete(self):
        try:
            db.session.delete(self)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise e

    def to_dict(self, exclude: list = None):
        exclude = exclude or []

        data = {}
        for column in self.__table__.columns:
            if column.name not in exclude:
                value = getattr(self, column.name)

                if isinstance(value, datetime):
                    value = value.isoformat()

                data[column.name] = value

        return data

    def __repr__(self):
        return f"<{self.__class__.__name__} {self.id}>"