"""
Inicialização dos Schemas
"""
from app.schemas.auth_schema import LoginSchema, RegistrarAtendenteSchema
from app.schemas.senha_schema import (
    EmitirSenhaSchema,
    CancelarSenhaSchema,
    IniciarAtendimentoSchema,
    FinalizarAtendimentoSchema,
    SenhaSchema,
    ServicoSchema,
    AtendenteSchema,
)

__all__ = [
    'LoginSchema',
    'RegistrarAtendenteSchema',
    'EmitirSenhaSchema',
    'CancelarSenhaSchema',
    'IniciarAtendimentoSchema',
    'FinalizarAtendimentoSchema',
    'SenhaSchema',
    'ServicoSchema',
    'AtendenteSchema'
]
