# ===== FASE 4.4: TESTES DE VALIDAÇÃO =====

"""
Testes automatizados para schemas e rate limiting

Execute: python FASE4_4_teste_validacoes.py
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from app.schemas.senha_schema import (
    EmitirSenhaSchema,
    LoginSchema,
    CancelarSenhaSchema
)
from app.utils.rate_limiter import RateLimiter
from marshmallow import ValidationError


# Colors
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")


def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")


def print_test(name):
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}TESTE: {name}{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")


# ===== TESTES DE SCHEMAS =====

def teste_schema_emissao_valido():
    """Teste 1: Schema de emissão com dados válidos"""
    print_test("1. Schema Emissão - Dados Válidos")
    
    schema = EmitirSenhaSchema()
    
    dados = {
        'servico_id': 1,
        'tipo': 'normal',
        'usuario_contato': 'João Silva'
    }
    
    try:
        resultado = schema.load(dados)
        print(f"   Dados validados: {resultado}")
        print_success("Schema aceita dados válidos")
        return True
    except ValidationError as e:
        print_error(f"Schema rejeitou dados válidos: {e.messages}")
        return False


def teste_schema_emissao_invalido():
    """Teste 2: Schema de emissão com dados inválidos"""
    print_test("2. Schema Emissão - Dados Inválidos")
    
    schema = EmitirSenhaSchema()
    
    casos_invalidos = [
        ({}, "Campos obrigatórios faltando"),
        ({'servico_id': 'abc', 'tipo': 'normal'}, "servico_id não é número"),
        ({'servico_id': 1, 'tipo': 'invalido'}, "Tipo inválido"),
        ({'servico_id': -1, 'tipo': 'normal'}, "servico_id negativo"),
        ({'servico_id': 1, 'tipo': 'normal', 'usuario_contato': 'x'*101}, "Contato muito longo"),
        ({'servico_id': 1, 'tipo': 'normal', 'usuario_contato': '<script>alert("xss")</script>'}, "XSS attempt"),
    ]
    
    passou = True
    for dados, descricao in casos_invalidos:
        try:
            schema.load(dados)
            print_error(f"❌ Schema aceitou: {descricao}")
            passou = False
        except ValidationError:
            print_success(f"Schema rejeitou: {descricao}")
    
    return passou


def teste_schema_login_valido():
    """Teste 3: Schema de login com dados válidos"""
    print_test("3. Schema Login - Dados Válidos")
    
    schema = LoginSchema()
    
    dados = {
        'email': 'admin@imtsb.ao',
        'senha': 'senha123'
    }
    
    try:
        resultado = schema.load(dados)
        print_success("Schema aceita login válido")
        return True
    except ValidationError as e:
        print_error(f"Schema rejeitou login válido: {e.messages}")
        return False


def teste_schema_login_invalido():
    """Teste 4: Schema de login com dados inválidos"""
    print_test("4. Schema Login - Dados Inválidos")
    
    schema = LoginSchema()
    
    casos_invalidos = [
        ({'email': 'emailinvalido', 'senha': '123'}, "Email sem @"),
        ({'email': 'test@test.com', 'senha': 'ab'}, "Senha muito curta"),
        ({'email': 'test@test.com'}, "Senha faltando"),
        ({'senha': '123456'}, "Email faltando"),
    ]
    
    passou = True
    for dados, descricao in casos_invalidos:
        try:
            schema.load(dados)
            print_error(f"Schema aceitou: {descricao}")
            passou = False
        except ValidationError:
            print_success(f"Schema rejeitou: {descricao}")
    
    return passou


def teste_schema_cancelar():
    """Teste 5: Schema de cancelamento"""
    print_test("5. Schema Cancelamento")
    
    schema = CancelarSenhaSchema()
    
    # Válido
    try:
        resultado = schema.load({'motivo': 'Usuário não compareceu'})
        print_success("Schema aceita motivo válido")
    except ValidationError as e:
        print_error(f"Rejeitou válido: {e.messages}")
        return False
    
    # Inválido: motivo muito curto
    try:
        schema.load({'motivo': 'abc'})
        print_error("Schema aceitou motivo muito curto")
        return False
    except ValidationError:
        print_success("Schema rejeitou motivo muito curto")
    
    # Inválido: motivo faltando
    try:
        schema.load({})
        print_error("Schema aceitou sem motivo")
        return False
    except ValidationError:
        print_success("Schema rejeitou sem motivo")
    
    return True


# ===== TESTES DE RATE LIMITING =====

def teste_rate_limit_normal():
    """Teste 6: Rate limiting - requisições normais"""
    print_test("6. Rate Limiting - Requisições Normais")
    
    RateLimiter._requests.clear()
    
    # 5 requisições (limite 10)
    for i in range(5):
        allowed, info = RateLimiter.is_allowed(
            ip='192.168.1.100',
            limit=10,
            window=60
        )
        
        if not allowed:
            print_error(f"Bloqueou requisição {i+1}/5")
            return False
    
    print_success("Permitiu 5 requisições dentro do limite de 10")
    return True


def teste_rate_limit_excedido():
    """Teste 7: Rate limiting - exceder limite"""
    print_test("7. Rate Limiting - Exceder Limite")
    
    RateLimiter._requests.clear()
    
    # 15 requisições (limite 10)
    bloqueado = False
    for i in range(15):
        allowed, info = RateLimiter.is_allowed(
            ip='192.168.1.101',
            limit=10,
            window=60
        )
        
        if not allowed:
            bloqueado = True
            print_success(f"Bloqueou requisição {i+1}/15 (limite: 10)")
            break
    
    if not bloqueado:
        print_error("Não bloqueou após exceder limite")
        return False
    
    return True


def teste_rate_limit_ips_independentes():
    """Teste 8: Rate limiting - IPs independentes"""
    print_test("8. Rate Limiting - IPs Independentes")
    
    RateLimiter._requests.clear()
    
    # IP 1: 10 requisições
    for i in range(10):
        RateLimiter.is_allowed(ip='192.168.1.102', limit=10, window=60)
    
    # IP 2: deve poder fazer 10 também
    allowed, info = RateLimiter.is_allowed(
        ip='192.168.1.103',
        limit=10,
        window=60
    )
    
    if not allowed:
        print_error("IP 2 foi bloqueado pelo limite do IP 1")
        return False
    
    print_success("IPs têm limites independentes")
    return True


def teste_rate_limit_reset():
    """Teste 9: Rate limiting - reset manual"""
    print_test("9. Rate Limiting - Reset Manual")
    
    RateLimiter._requests.clear()
    
    # Exceder limite
    for i in range(15):
        RateLimiter.is_allowed(ip='192.168.1.104', limit=10, window=60)
    
    # Verificar que está bloqueado
    allowed_antes, _ = RateLimiter.is_allowed(ip='192.168.1.104', limit=10, window=60)
    
    if allowed_antes:
        print_error("Não bloqueou após 15 requisições")
        return False
    
    # Reset
    RateLimiter.reset(ip='192.168.1.104')
    
    # Verificar que desbloqueou
    allowed_depois, _ = RateLimiter.is_allowed(ip='192.168.1.104', limit=10, window=60)
    
    if not allowed_depois:
        print_error("Reset não desbloqueou")
        return False
    
    print_success("Reset manual funcionou")
    return True


def teste_rate_limit_headers():
    """Teste 10: Rate limiting - info nos headers"""
    print_test("10. Rate Limiting - Headers Informativos")
    
    RateLimiter._requests.clear()
    
    allowed, info = RateLimiter.is_allowed(
        ip='192.168.1.105',
        limit=100,
        window=60
    )
    
    # Verificar campos no info
    campos_obrigatorios = ['limit', 'remaining', 'reset']
    
    for campo in campos_obrigatorios:
        if campo not in info:
            print_error(f"Campo '{campo}' faltando no info")
            return False
    
    print(f"   Limit: {info['limit']}")
    print(f"   Remaining: {info['remaining']}")
    print(f"   Reset: {info['reset']}")
    
    print_success("Info contém todos os campos necessários")
    return True


# ===== EXECUTAR TODOS =====

def executar_todos():
    """Executa todos os testes"""
    
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}🧪 TESTES DE VALIDAÇÃO E SEGURANÇA - FASE 4{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}")
    
    testes = [
        ("Schema Emissão Válido", teste_schema_emissao_valido),
        ("Schema Emissão Inválido", teste_schema_emissao_invalido),
        ("Schema Login Válido", teste_schema_login_valido),
        ("Schema Login Inválido", teste_schema_login_invalido),
        ("Schema Cancelamento", teste_schema_cancelar),
        ("Rate Limit Normal", teste_rate_limit_normal),
        ("Rate Limit Excedido", teste_rate_limit_excedido),
        ("Rate Limit IPs Independentes", teste_rate_limit_ips_independentes),
        ("Rate Limit Reset", teste_rate_limit_reset),
        ("Rate Limit Headers", teste_rate_limit_headers),
    ]
    
    resultados = []
    for nome, teste_func in testes:
        try:
            resultado = teste_func()
            resultados.append((nome, resultado))
        except Exception as e:
            print_error(f"Erro no teste '{nome}': {e}")
            resultados.append((nome, False))
    
    # Resumo
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}📊 RESUMO DOS TESTES{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")
    
    total = len(resultados)
    passou = sum(1 for _, r in resultados if r)
    falhou = total - passou
    
    for nome, resultado in resultados:
        status = f"{Colors.GREEN}✅ PASSOU{Colors.END}" if resultado else f"{Colors.RED}❌ FALHOU{Colors.END}"
        print(f"{status} - {nome}")
    
    print(f"\n{Colors.BOLD}Total: {total} testes{Colors.END}")
    print(f"{Colors.GREEN}Passou: {passou}{Colors.END}")
    print(f"{Colors.RED}Falhou: {falhou}{Colors.END}")
    
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    
    if falhou == 0:
        print(f"{Colors.GREEN}{Colors.BOLD}✅ TODOS OS TESTES PASSARAM!{Colors.END}")
        print(f"{Colors.GREEN}Sistema com validações robustas!{Colors.END}")
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ ALGUNS TESTES FALHARAM!{Colors.END}")
        print(f"{Colors.RED}Revise as implementações.{Colors.END}")
    
    print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")
    
    return falhou == 0


if __name__ == "__main__":
    sucesso = executar_todos()
    sys.exit(0 if sucesso else 1)
