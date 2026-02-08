"""
Schemas para atendentes
"""
from marshmallow import Schema, fields, validate


class AtendenteSchema(Schema):
    """
    Schema para atendente (resposta)
    
    Fields:
        id: ID do atendente
        nome: Nome completo
        email: Email
        tipo: admin ou atendente
        balcao: Numero do balcao
        ativo: Se esta ativo
        ultimo_login: Data do ultimo login
    """
    id = fields.Int(dump_only=True)
    nome = fields.Str()
    email = fields.Str()
    tipo = fields.Str()
    balcao = fields.Int(allow_none=True)
    ativo = fields.Bool()
    ultimo_login = fields.DateTime(allow_none=True)


class ListarAtendentesSchema(Schema):
    """
    Schema para listar atendentes
    
    Fields:
        id: ID do atendente
        nome: Nome completo
        email: Email
        tipo: admin ou atendente
        balcao: Numero do balcao
        ativo: Se esta ativo
    """
    id = fields.Int()
    nome = fields.Str()
    email = fields.Str()
    tipo = fields.Str()
    balcao = fields.Int(allow_none=True)
    ativo = fields.Bool()
