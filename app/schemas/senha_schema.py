"""
app/schemas/senha_schema.py — CORRIGIDO
FIX CRÍTICO: EmitirSenhaSchema tinha unknown=RAISE (padrão marshmallow).
Campos como 'observacoes' enviados pelo service-form.js causavam 400.
Solução: Meta.unknown = EXCLUDE em todos os schemas de entrada.
"""

from marshmallow import Schema, fields, validates, ValidationError, validate, EXCLUDE
from datetime import date


class EmitirSenhaSchema(Schema):
    class Meta:
        unknown = EXCLUDE  # ← FIX: ignorar campos desconhecidos

    servico_id = fields.Integer(
        required=True,
        validate=validate.Range(min=1, max=999),
        error_messages={'required': 'servico_id é obrigatório'}
    )
    tipo = fields.String(
        required=True,
        validate=validate.OneOf(['normal', 'prioritaria']),
        error_messages={'required': 'tipo é obrigatório'}
    )
    usuario_contato = fields.String(required=False, allow_none=True,
        validate=validate.Length(max=100), load_default=None)
    utente_id = fields.Integer(required=False, allow_none=True,
        validate=validate.Range(min=1, max=999999), load_default=None)

    @validates('usuario_contato')
    def validate_contato(self, value):
        if value:
            for c in ['<', '>', '"', "'", ';']:
                if c in value:
                    raise ValidationError(f"Caracter '{c}' não permitido")


class ChamarSenhaSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    servico_id    = fields.Integer(required=True, validate=validate.Range(min=1, max=999))
    numero_balcao = fields.Integer(required=True, validate=validate.Range(min=1, max=50))


class IniciarAtendimentoSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    numero_balcao = fields.Integer(required=False, allow_none=True,
        validate=validate.Range(min=1, max=50))


class FinalizarAtendimentoSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    observacoes = fields.String(required=False, allow_none=True,
        validate=validate.Length(max=500))


class CancelarSenhaSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    motivo = fields.String(required=True,
        validate=validate.Length(min=3, max=200),
        error_messages={'required': 'Motivo é obrigatório'})


class LoginSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    email = fields.Email(required=True)
    senha = fields.String(required=True, validate=validate.Length(min=3, max=100))


class BuscarFilaSchema(Schema):
    class Meta:
        unknown = EXCLUDE

    servico_id = fields.Integer(required=True, validate=validate.Range(min=1, max=999))
    data       = fields.Date(required=False, allow_none=True)


class SenhaSchema(Schema):
    id                        = fields.Int()
    numero                    = fields.Str()
    tipo                      = fields.Str()
    status                    = fields.Str()
    servico_id                = fields.Int()
    atendente_id              = fields.Int()
    utente_id                 = fields.Int(allow_none=True)
    numero_balcao             = fields.Int()
    usuario_contato           = fields.Str()
    emitida_em                = fields.DateTime()
    chamada_em                = fields.DateTime()
    atendimento_iniciado_em   = fields.DateTime()
    atendimento_concluido_em  = fields.DateTime()
    tempo_espera_minutos      = fields.Int()
    tempo_atendimento_minutos = fields.Int()
    observacoes               = fields.Str()
    created_at                = fields.DateTime()
    servico = fields.Method("get_servico")
    atendente = fields.Method("get_atendente")

    def get_servico(self, obj):
        s = getattr(obj, 'servico', None)
        if s: return {'id': s.id, 'nome': s.nome, 'icone': s.icone}
        return None

    def get_atendente(self, obj):
        a = getattr(obj, 'atendente', None)
        if a: return {'id': a.id, 'nome': a.nome}
        return None


class ServicoSchema(Schema):
    id        = fields.Int()
    nome      = fields.Str()
    descricao = fields.Str()
    icone     = fields.Str()
    ativo     = fields.Bool()


class AtendenteSchema(Schema):
    id     = fields.Int()
    nome   = fields.Str()
    email  = fields.Email()
    tipo   = fields.Str()
    balcao = fields.Int()