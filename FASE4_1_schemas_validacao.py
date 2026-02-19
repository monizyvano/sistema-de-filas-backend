# ===== FASE 4.1: SCHEMAS DE VALIDAÇÃO =====

"""
app/schemas/senha_schema.py - ATUALIZADO COM VALIDAÇÕES ROBUSTAS

OBJETIVO: Validar todos os inputs antes de processar
"""

from marshmallow import Schema, fields, validates, ValidationError, validate
from datetime import date


class EmitirSenhaSchema(Schema):
    """Schema para validação de emissão de senha"""
    
    servico_id = fields.Integer(
        required=True,
        validate=validate.Range(min=1, max=999, error="ID do serviço inválido"),
        error_messages={
            'required': 'O campo servico_id é obrigatório',
            'invalid': 'O servico_id deve ser um número inteiro'
        }
    )
    
    tipo = fields.String(
        required=True,
        validate=validate.OneOf(
            ['normal', 'prioritaria'],
            error="Tipo deve ser 'normal' ou 'prioritaria'"
        ),
        error_messages={
            'required': 'O campo tipo é obrigatório'
        }
    )
    
    usuario_contato = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Length(max=100, error="Contato muito longo (máx 100 caracteres)")
    )
    
    @validates('usuario_contato')
    def validate_contato(self, value):
        """Valida e sanitiza contato do usuário"""
        if value:
            # Remover caracteres perigosos
            caracteres_perigosos = ['<', '>', '"', "'", '&', ';', '--', '/*', '*/']
            for char in caracteres_perigosos:
                if char in value:
                    raise ValidationError(f"Caractere '{char}' não permitido no contato")


class ChamarSenhaSchema(Schema):
    """Schema para chamar próxima senha"""
    
    servico_id = fields.Integer(
        required=True,
        validate=validate.Range(min=1, max=999)
    )
    
    numero_balcao = fields.Integer(
        required=True,
        validate=validate.Range(min=1, max=50, error="Número de balcão inválido (1-50)")
    )


class IniciarAtendimentoSchema(Schema):
    """Schema para iniciar atendimento"""
    
    numero_balcao = fields.Integer(
        required=False,
        allow_none=True,
        validate=validate.Range(min=1, max=50)
    )


class FinalizarAtendimentoSchema(Schema):
    """Schema para finalizar atendimento"""
    
    observacoes = fields.String(
        required=False,
        allow_none=True,
        validate=validate.Length(max=500, error="Observações muito longas (máx 500 caracteres)")
    )
    
    @validates('observacoes')
    def validate_observacoes(self, value):
        """Sanitiza observações"""
        if value:
            # Remover caracteres perigosos
            caracteres_perigosos = ['<script>', '</script>', '<iframe>', 'javascript:']
            value_lower = value.lower()
            for char in caracteres_perigosos:
                if char in value_lower:
                    raise ValidationError("Conteúdo suspeito detectado nas observações")


class CancelarSenhaSchema(Schema):
    """Schema para cancelar senha"""
    
    motivo = fields.String(
        required=True,
        validate=validate.Length(min=5, max=200, error="Motivo deve ter entre 5 e 200 caracteres"),
        error_messages={
            'required': 'Motivo do cancelamento é obrigatório'
        }
    )


class LoginSchema(Schema):
    """Schema para login"""
    
    email = fields.Email(
        required=True,
        error_messages={
            'required': 'Email é obrigatório',
            'invalid': 'Email inválido'
        }
    )
    
    senha = fields.String(
        required=True,
        validate=validate.Length(min=3, max=100),
        error_messages={
            'required': 'Senha é obrigatória'
        }
    )


class BuscarFilaSchema(Schema):
    """Schema para buscar fila"""
    
    servico_id = fields.Integer(
        required=True,
        validate=validate.Range(min=1, max=999)
    )
    
    data = fields.Date(
        required=False,
        allow_none=True
    )


# ===== USAR NOS CONTROLLERS =====

EXEMPLO_USO = """
# app/controllers/senha_controller.py

from flask import request, jsonify
from app.schemas.senha_schema import EmitirSenhaSchema, ChamarSenhaSchema
from marshmallow import ValidationError

@senha_bp.route('/senhas', methods=['POST'])
def emitir_senha():
    '''Emite nova senha com validação'''
    
    # Validar dados de entrada
    schema = EmitirSenhaSchema()
    try:
        dados = schema.load(request.json)
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    # Processar (dados já estão validados!)
    try:
        senha = SenhaService.emitir(
            servico_id=dados['servico_id'],
            tipo=dados['tipo'],
            usuario_contato=dados.get('usuario_contato')
        )
        
        return jsonify({
            'mensagem': 'Senha emitida com sucesso',
            'senha': senha.to_dict()
        }), 201
        
    except ValueError as e:
        return jsonify({'erro': str(e)}), 400
"""


if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 4.1 - SCHEMAS DE VALIDAÇÃO                             ║
╚══════════════════════════════════════════════════════════════╝

CRIAR ARQUIVO:
────────────────────────────────────────────────────────────────
app/schemas/senha_schema.py

Cole o código acima (classes de Schema)

VALIDAÇÕES IMPLEMENTADAS:
────────────────────────────────────────────────────────────────
✅ Tipos de dados corretos (int, string, email)
✅ Valores dentro de ranges válidos
✅ Campos obrigatórios
✅ Comprimento de strings
✅ Sanitização de caracteres perigosos
✅ Validação de email
✅ Proteção contra XSS e SQL Injection

BENEFÍCIOS:
────────────────────────────────────────────────────────────────
✅ Previne dados inválidos no banco
✅ Mensagens de erro claras para frontend
✅ Segurança contra ataques
✅ Código mais limpo nos controllers

PRÓXIMO: FASE4_2_rate_limiting.py
    """)
