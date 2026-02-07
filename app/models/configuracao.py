"""
Model de Configurações do Sistema
Conforme MER Corrigido - permite mudar settings sem alterar código
"""
from app import db
from app.models.base import BaseModel


class Configuracao(BaseModel):
    """
    Armazena configurações do sistema
    
    Attributes:
        chave (str): Nome da configuração (ex: horario_abertura)
        valor (str): Valor da configuração
        tipo (str): string, int, boolean
        descricao (str): Descrição para documentação
    
    Examples:
        horario_abertura = "08:00"
        horario_fechamento = "16:00"
        permite_senha_prioritaria = "true"
    """
    
    __tablename__ = 'configuracoes'
    
    # Enums
    TIPOS = ['string', 'int', 'boolean']
    
    # Colunas
    chave = db.Column(
        db.String(100),
        nullable=False,
        unique=True,
        index=True,
        comment="Nome único da configuração"
    )
    
    valor = db.Column(
        db.Text,
        nullable=False,
        comment="Valor da configuração (sempre string, converter depois)"
    )
    
    tipo = db.Column(
        db.Enum(*TIPOS),
        nullable=False,
        default='string',
        comment="Tipo do valor: string, int ou boolean"
    )
    
    descricao = db.Column(
        db.Text,
        nullable=True,
        comment="Descrição da configuração"
    )
    
    def __init__(self, chave, valor, tipo='string', descricao=None):
        """Construtor da configuração"""
        self.chave = chave
        self.valor = str(valor)
        self.tipo = tipo
        self.descricao = descricao
    
    def get_valor(self):
        """
        Retorna valor convertido para o tipo correto
        
        Returns:
            str|int|bool: Valor tipado
        """
        if self.tipo == 'int':
            return int(self.valor)
        elif self.tipo == 'boolean':
            return self.valor.lower() in ['true', '1', 'yes', 'sim']
        else:
            return self.valor
    
    def set_valor(self, novo_valor):
        """
        Define novo valor (converte para string)
        
        Args:
            novo_valor: Novo valor
        """
        self.valor = str(novo_valor)
        return self.save()
    
    @staticmethod
    def obter(chave, padrao=None):
        """
        Método estático para obter configuração facilmente
        
        Args:
            chave (str): Nome da configuração
            padrao: Valor padrão se não existir
        
        Returns:
            str|int|bool: Valor da configuração
        """
        config = Configuracao.query.filter_by(chave=chave).first()
        return config.get_valor() if config else padrao
    
    @staticmethod
    def definir(chave, valor, tipo='string', descricao=None):
        """
        Método estático para definir configuração
        
        Args:
            chave (str): Nome da configuração
            valor: Valor
            tipo (str): Tipo (string/int/boolean)
            descricao (str): Descrição
        
        Returns:
            Configuracao: Configuração criada/atualizada
        """
        config = Configuracao.query.filter_by(chave=chave).first()
        
        if config:
            config.set_valor(valor)
        else:
            config = Configuracao(chave, valor, tipo, descricao)
            config.save()
        
        return config
    
    def __repr__(self):
        return f"<Configuracao {self.chave}={self.valor}>"
