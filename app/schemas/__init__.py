"""
Inicialização dos Schemas
"""
from app.schemas.auth_schema import LoginSchema, RegistrarAtendenteSchema
from app.schemas.senha_schema import (
    EmitirSenhaSchema,
    CancelarSenhaSchema,
    IniciarAtendimentoSchema,
    FinalizarAtendimentoSchema,
)

__all__ = [
    'LoginSchema',
    'RegistrarAtendenteSchema',
    'EmitirSenhaSchema',
    'CancelarSenhaSchema',
    'IniciarAtendimentoSchema',
    'FinalizarAtendimentoSchema',
]
