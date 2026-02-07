"""
Classe base para todos os models
Implementa funcionalidades comuns usando POO
"""
from datetime import datetime
from app import db


class BaseModel(db.Model):
    """
    Classe abstrata base para todos os models
    
    Attributes:
        id (int): Chave primária
        created_at (datetime): Data de criação
        updated_at (datetime): Data de atualização
    """
    
    __abstract__ = True  # Não cria tabela no BD
    
    # Colunas comuns a todas as tabelas
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        comment="Data de criação do registro"
    )
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        comment="Data da última atualização"
    )
    
    def save(self):
        """
        Salva ou atualiza o objeto no banco de dados
        
        Returns:
            self: Objeto salvo
        
        Example:
            >>> senha = Senha(numero="N001")
            >>> senha.save()
        """
        try:
            db.session.add(self)
            db.session.commit()
            return self
        except Exception as e:
            db.session.rollback()
            raise e
    
    def delete(self):
        """
        Remove o objeto do banco de dados
        
        Returns:
            bool: True se removido com sucesso
        
        Example:
            >>> senha.delete()
        """
        try:
            db.session.delete(self)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise e
    
    def to_dict(self, exclude: list = None):
        """
        Converte objeto para dicionário (útil para JSON)
        
        Args:
            exclude (list): Campos a excluir
        
        Returns:
            dict: Representação do objeto
        
        Example:
            >>> senha.to_dict(exclude=['senha_hash'])
        """
        exclude = exclude or []
        
        data = {}
        for column in self.__table__.columns:
            if column.name not in exclude:
                value = getattr(self, column.name)
                
                # Converter datetime para string ISO
                if isinstance(value, datetime):
                    value = value.isoformat()
                
                data[column.name] = value
        
        return data
    
    def __repr__(self):
        """Representação amigável do objeto"""
        return f"<{self.__class__.__name__} {self.id}>"
