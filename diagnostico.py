"""
SCRIPT DE DIAGNÓSTICO - Sistema de Filas IMTSB
Identifica problemas na API antes da apresentação

Executar: python diagnostico.py
"""
import requests
import json

BASE_URL = 'http://localhost:5000/api'

print("\n" + "="*70)
print("🔍 DIAGNÓSTICO DO SISTEMA")
print("="*70 + "\n")

# ===== TESTE 1: SERVIDOR =====
print("1️⃣  Verificando se servidor está rodando...")
try:
    response = requests.get(f'{BASE_URL}/auth/health', timeout=2)
    if response.status_code == 200:
        print("   ✅ Servidor rodando!")
        print(f"   Resposta: {response.json()}\n")
    else:
        print(f"   ❌ Servidor retornou status {response.status_code}")
        print(f"   Resposta: {response.text}\n")
        exit(1)
except Exception as e:
    print(f"   ❌ SERVIDOR NÃO ESTÁ RODANDO!")
    print(f"   Erro: {e}\n")
    print("   SOLUÇÃO:")
    print("   1. Abra outro terminal")
    print("   2. Ative venv: venv\\Scripts\\activate")
    print("   3. Execute: python run.py")
    print("   4. Depois rode este script novamente\n")
    exit(1)

# ===== TESTE 2: LOGIN =====
print("2️⃣  Testando login...")
try:
    response = requests.post(f'{BASE_URL}/auth/login', json={
        "email": "admin@imtsb.ao",
        "senha": "admin123"
    })
    
    print(f"   Status: {response.status_code}")
    
    try:
        data = response.json()
        print(f"   Resposta JSON: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
    except:
        print(f"   ⚠️  Resposta não é JSON!")
        print(f"   Resposta raw: {response.text[:500]}")
    
    if response.status_code == 200:
        if 'access_token' in data:
            print("   ✅ Login funcionando!")
            TOKEN = data['access_token']
        else:
            print("   ⚠️  Login OK mas sem token!")
    else:
        print(f"   ❌ Login falhou!")
        if response.status_code == 404:
            print("   PROBLEMA: Endpoint /api/auth/login não existe!")
            print("   SOLUÇÃO: Verificar se blueprints estão registrados")
        elif 'erro' in data:
            print(f"   Erro: {data['erro']}")
            if "não encontrado" in str(data['erro']).lower():
                print("   SOLUÇÃO: Executar seeders - python seed.py")
    print()
    
except Exception as e:
    print(f"   ❌ Erro ao testar login: {e}\n")
    exit(1)

# ===== TESTE 3: EMITIR SENHA =====
print("3️⃣  Testando emissão de senha...")
try:
    response = requests.post(f'{BASE_URL}/senhas', json={
        "servico_id": 1,
        "tipo": "normal"
    })
    
    print(f"   Status: {response.status_code}")
    
    try:
        data = response.json()
        print(f"   Chaves na resposta: {list(data.keys())}")
        
        if 'senha' in data:
            print(f"   ✅ Senha emitida: {data['senha']['numero']}")
        elif 'mensagem' in data:
            print(f"   Mensagem: {data['mensagem']}")
            # Verificar se senha está em outro lugar
            for key, value in data.items():
                if isinstance(value, dict) and 'numero' in value:
                    print(f"   ⚠️  Senha encontrada em '{key}': {value['numero']}")
        else:
            print(f"   ⚠️  Resposta inesperada!")
            print(f"   JSON completo: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
        
        if response.status_code != 201:
            print(f"   ⚠️  Status deveria ser 201 (Created), mas é {response.status_code}")
    
    except:
        print(f"   ⚠️  Resposta não é JSON!")
        print(f"   Resposta raw: {response.text[:500]}")
    
    print()
    
except Exception as e:
    print(f"   ❌ Erro ao emitir senha: {e}\n")

# ===== TESTE 4: LISTAR SERVIÇOS =====
print("4️⃣  Testando listagem de serviços...")
try:
    response = requests.get(f'{BASE_URL}/servicos')
    
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            print(f"   ✅ {len(data)} serviços encontrados")
            for s in data:
                print(f"      - {s.get('icone', '?')} {s.get('nome', 'N/A')}")
        else:
            print(f"   ⚠️  Resposta não é lista!")
    else:
        print(f"   ❌ Falha ao listar serviços")
        try:
            print(f"   Erro: {response.json()}")
        except:
            print(f"   Resposta: {response.text[:200]}")
    
    print()
    
except Exception as e:
    print(f"   ❌ Erro: {e}\n")

# ===== TESTE 5: VER FILA =====
print("5️⃣  Testando visualização de fila...")
try:
    response = requests.get(f'{BASE_URL}/filas/1')
    
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   Chaves: {list(data.keys())}")
        
        if 'fila' in data:
            print(f"   ✅ {data.get('total', len(data['fila']))} senhas na fila")
        else:
            print(f"   ⚠️  Chave 'fila' não encontrada!")
    else:
        print(f"   ❌ Falha")
    
    print()
    
except Exception as e:
    print(f"   ❌ Erro: {e}\n")

# ===== TESTE 6: BANCO DE DADOS =====
print("6️⃣  Verificando banco de dados...")
try:
    response = requests.get(f'{BASE_URL}/servicos')
    if response.status_code == 200:
        servicos = response.json()
        if len(servicos) == 0:
            print("   ⚠️  Nenhum serviço cadastrado!")
            print("   SOLUÇÃO: Executar seeders - python seed.py\n")
        else:
            print(f"   ✅ Banco tem dados ({len(servicos)} serviços)\n")
    else:
        print("   ⚠️  Não foi possível verificar\n")
except:
    print("   ⚠️  Não foi possível verificar\n")

# ===== RESUMO =====
print("="*70)
print("📊 RESUMO DO DIAGNÓSTICO")
print("="*70)
print("\nSe todos os testes passaram (✅), o sistema está OK!")
print("\nSe algum teste falhou (❌), siga as soluções indicadas.\n")

print("COMANDOS ÚTEIS:")
print("  python run.py          → Iniciar servidor")
print("  python seed.py         → Popular banco de dados")
print("  python test_api.py     → Testar endpoints")
print("  python demo_completa_corrigido.py → Demo para apresentação\n")