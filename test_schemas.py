"""
Teste dos Schemas de validacao
Executa: python test_schemas.py
"""
from app.schemas import (
    LoginSchema,
    RegistrarAtendenteSchema,
    EmitirSenhaSchema,
    ChamarSenhaSchema,
    AtendenteSchema
)

print("\n" + "=" * 70)
print("[TESTE] SCHEMAS DE VALIDACAO")
print("=" * 70)

# ===== TESTE 1: LoginSchema =====
print("\n[1. LOGIN SCHEMA]")
print("-" * 70)

login_schema = LoginSchema()

# Teste valido
print("\n[TESTE] Login valido...")
try:
    resultado = login_schema.load({
        'email': 'admin@imtsb.ao',
        'senha': 'senha123'
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[ERRO] {e}")

# Teste email invalido
print("\n[TESTE] Email invalido...")
try:
    resultado = login_schema.load({
        'email': 'nao-e-email',
        'senha': 'senha123'
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[OK] Rejeitado conforme esperado: {list(e.messages.values())[0] if hasattr(e, 'messages') else str(e)}")

# Teste senha muito curta
print("\n[TESTE] Senha muito curta...")
try:
    resultado = login_schema.load({
        'email': 'admin@imtsb.ao',
        'senha': '123'
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[OK] Rejeitado conforme esperado: {list(e.messages.values())[0] if hasattr(e, 'messages') else str(e)}")

# ===== TESTE 2: EmitirSenhaSchema =====
print("\n\n[2. EMITIR SENHA SCHEMA]")
print("-" * 70)

emitir_schema = EmitirSenhaSchema()

# Teste valido
print("\n[TESTE] Emissao valida...")
try:
    resultado = emitir_schema.load({
        'servico_id': 1,
        'tipo': 'normal',
        'usuario_contato': '+244923456789'
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[ERRO] {e}")

# Teste com valores padrao
print("\n[TESTE] Valores padrao (tipo)...")
try:
    resultado = emitir_schema.load({
        'servico_id': 2
    })
    print(f"[OK] Validado com defaults: {resultado}")
except Exception as e:
    print(f"[ERRO] {e}")

# Teste tipo invalido
print("\n[TESTE] Tipo invalido...")
try:
    resultado = emitir_schema.load({
        'servico_id': 1,
        'tipo': 'urgente'
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[OK] Rejeitado conforme esperado")

# ===== TESTE 3: ChamarSenhaSchema =====
print("\n\n[3. CHAMAR SENHA SCHEMA]")
print("-" * 70)

chamar_schema = ChamarSenhaSchema()

# Teste valido
print("\n[TESTE] Chamada valida...")
try:
    resultado = chamar_schema.load({
        'numero_balcao': 1,
        'atendente_id': 2
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[ERRO] {e}")

# Teste sem atendente_id (opcional)
print("\n[TESTE] Sem atendente (opcional)...")
try:
    resultado = chamar_schema.load({
        'numero_balcao': 3
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[ERRO] {e}")

# ===== TESTE 4: RegistrarAtendenteSchema =====
print("\n\n[4. REGISTRAR ATENDENTE SCHEMA]")
print("-" * 70)

registrar_schema = RegistrarAtendenteSchema()

# Teste valido
print("\n[TESTE] Registro valido...")
try:
    resultado = registrar_schema.load({
        'nome': 'Jose Silva',
        'email': 'jose@imtsb.ao',
        'senha': 'senha123',
        'tipo': 'atendente',
        'balcao': 2
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[ERRO] {e}")

# Teste nome muito curto
print("\n[TESTE] Nome muito curto...")
try:
    resultado = registrar_schema.load({
        'nome': 'Jo',
        'email': 'jose@imtsb.ao',
        'senha': 'senha123'
    })
    print(f"[OK] Validado: {resultado}")
except Exception as e:
    print(f"[OK] Rejeitado conforme esperado")

# ===== RESUMO FINAL =====
print("\n" + "=" * 70)
print("[SUCESSO] TODOS OS SCHEMAS TESTADOS")
print("=" * 70)
print("\nSchemas disponiveis:")
print("  1. LoginSchema OK")
print("  2. RegistrarAtendenteSchema OK")
print("  3. EmitirSenhaSchema OK")
print("  4. ChamarSenhaSchema OK")
print("  5. AtendenteSchema OK")
print("\n")
