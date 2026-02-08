"""
Schemas para senhas
"""
from marshmallow import Schema, fields, validate, validates_schema, ValidationError


class EmitirSenhaSchema(Schema):
    """
    Schema para emitir senha
    
    Fields:
        servico_id: ID do servico
        tipo: normal ou prioritaria
        usuario_contato: Telefone opcional
    """
    servico_id = fields.Int(required=True, error_messages={
        'required': 'Servico eh obrigatorio'
    })
    tipo = fields.Str(
        validate=validate.OneOf(['normal', 'prioritaria']),
        missing='normal',
        error_messages={
            'validator_failed': 'Tipo deve ser "normal" ou "prioritaria"'
        }
    )
    usuario_contato = fields.Str(allow_none=True, validate=validate.Length(max=20))


class CancelarSenhaSchema(Schema):
    """Schema para cancelar senha"""
    motivo = fields.Str(required=True, validate=validate.Length(min=3), error_messages={
        'required': 'Motivo eh obrigatorio'
    })


class IniciarAtendimentoSchema(Schema):
    """Schema para iniciar atendimento"""
    numero_balcao = fields.Int(required=True, error_messages={
        'required': 'Numero do balcao eh obrigatorio'
    })


class FinalizarAtendimentoSchema(Schema):
    """Schema para finalizar atendimento"""
    observacoes = fields.Str(allow_none=True)


class SenhaSchema(Schema):
    """
    Schema de saida (resposta da API)
    """
    id = fields.Int()
    numero = fields.Str()
    tipo = fields.Str()
    status = fields.Str()
    servico_id = fields.Int()
    atendente_id = fields.Int()
    numero_balcao = fields.Int()
    usuario_contato = fields.Str()
    emitida_em = fields.DateTime()
    chamada_em = fields.DateTime()
    atendimento_iniciado_em = fields.DateTime()
    atendimento_concluido_em = fields.DateTime()
    tempo_espera_minutos = fields.Int()
    tempo_atendimento_minutos = fields.Int()
    observacoes = fields.Str()
    created_at = fields.DateTime()
    
    # Relacionamentos
    servico = fields.Nested('ServicoSchema', only=['id', 'nome', 'icone'])
    atendente = fields.Nested('AtendenteSchema', only=['id', 'nome', 'balcao'])


class ServicoSchema(Schema):
    """Schema de servico"""
    id = fields.Int()
    nome = fields.Str()
    descricao = fields.Str()
    tempo_medio_minutos = fields.Int()
    icone = fields.Str()
    ordem_exibicao = fields.Int()
    ativo = fields.Bool()


class AtendenteSchema(Schema):
    """Schema de atendente (sem senha_hash)"""
    id = fields.Int()
    nome = fields.Str()
    email = fields.Email()
    tipo = fields.Str()
    balcao = fields.Int()
    ativo = fields.Bool()
    ultimo_login = fields.DateTime()
