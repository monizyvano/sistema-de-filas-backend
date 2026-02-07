"""
Inicialização dos Models
Importa todos os models conforme MER Corrigido
"""
from app.models.base import BaseModel
from app.models.servico import Servico
from app.models.senha import Senha
from app.models.atendente import Atendente
from app.models.log_actividade import LogActividade
from app.models.configuracao import Configuracao

__all__ = [
    'BaseModel',
    'Servico',
    'Senha',
    'Atendente',
    'LogActividade',
    'Configuracao'
]
