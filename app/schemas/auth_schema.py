"""
Schemas para autenticacao
"""
from marshmallow import Schema, fields, validate, validates, ValidationError


class LoginSchema(Schema):
    """
    Schema para login
    
    Fields:
        email: Email do atendente
        senha: Senha
    """
    email = fields.Email(required=True, error_messages={
        'required': 'Email eh obrigatorio',
        'invalid': 'Email invalido'
    })
    senha = fields.Str(required=True, validate=validate.Length(min=6), error_messages={
        'required': 'Senha eh obrigatoria',
        'invalid': 'Senha deve ter no minimo 6 caracteres'
    })


class RegistrarAtendenteSchema(Schema):
    """
    Schema para registrar novo atendente
    
    Fields:
        nome: Nome completo
        email: Email unico
        senha: Senha (min 6 caracteres)
        tipo: admin ou atendente
        balcao: Numero do balcao (opcional)
    """
    nome = fields.Str(required=True, validate=validate.Length(min=3), error_messages={
        'required': 'Nome eh obrigatorio'
    })
    email = fields.Email(required=True, error_messages={
        'required': 'Email eh obrigatorio',
        'invalid': 'Email invalido'
    })
    senha = fields.Str(required=True, validate=validate.Length(min=6), error_messages={
        'required': 'Senha eh obrigatoria'
    })
    tipo = fields.Str(validate=validate.OneOf(['admin', 'atendente']), missing='atendente')
    balcao = fields.Int(allow_none=True)
    
    @validates('balcao')
    def validate_balcao(self, value):
        """Valida que atendente deve ter balcao"""
        tipo = self.get_attribute({'tipo': 'atendente'}, 'tipo', None)
        if tipo == 'atendente' and not value:
            raise ValidationError('Atendente deve ter balcao definido')
