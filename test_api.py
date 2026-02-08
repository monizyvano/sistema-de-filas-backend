"""
Teste manual da API
Executa: python test_api.py
"""
import requests
import json

BASE_URL = "http://localhost:5000/api"

print("\n" + "=" * 70)
print("🧪 TESTANDO API REST")
print("=" * 70)

# ===== TESTE 1: HEALTH CHECK =====
print("\n✅ TESTE 1: Health Check")
response = requests.get(f"{BASE_URL}/auth/health")
print(f"Status: {response.status_code}")
print(f"Resposta: {response.json()}")

# ===== TESTE 2: LOGIN =====
print("\n🔐 TESTE 2: Login")
login_data = {
    "email": "admin@imtsb.ao",
    "senha": "admin123"
}
response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
print(f"Status: {response.status_code}")
resultado = response.json()
print(f"Atendente: {resultado.get('atendente', {}).get('nome')}")

# Salvar token para próximos requests
token = resultado.get('access_token')
headers = {"Authorization": f"Bearer {token}"}

# ===== TESTE 3: EMITIR SENHA =====
print("\n🎫 TESTE 3: Emitir Senha")
senha_data = {
    "servico_id": 1,
    "tipo": "normal"
}
response = requests.post(f"{BASE_URL}/senhas", json=senha_data)
print(f"Status: {response.status_code}")
senha = response.json().get('senha')
print(f"Senha emitida: {senha.get('numero')}")
senha_id = senha.get('id')

# ===== TESTE 4: LISTAR SERVIÇOS =====
print("\n🏢 TESTE 4: Listar Serviços")
response = requests.get(f"{BASE_URL}/servicos")
print(f"Status: {response.status_code}")
servicos = response.json()
print(f"Total de serviços: {len(servicos)}")
for s in servicos:
    print(f"  • {s['icone']} {s['nome']}")

# ===== TESTE 5: VER FILA =====
print("\n📊 TESTE 5: Ver Fila")
response = requests.get(f"{BASE_URL}/filas/1")
print(f"Status: {response.status_code}")
fila_data = response.json()
print(f"Total na fila: {fila_data['total']}")

# ===== TESTE 6: CHAMAR PRÓXIMA =====
print("\n📣 TESTE 6: Chamar Próxima Senha")
chamar_data = {
    "servico_id": 1,
    "numero_balcao": 1
}
response = requests.post(f"{BASE_URL}/filas/chamar", json=chamar_data, headers=headers)
print(f"Status: {response.status_code}")
if response.status_code == 200:
    senha_chamada = response.json().get('senha')
    print(f"Senha chamada: {senha_chamada.get('numero')}")

# ===== TESTE 7: ESTATÍSTICAS =====
print("\n📊 TESTE 7: Estatísticas Dashboard")
response = requests.get(f"{BASE_URL}/dashboard/estatisticas", headers=headers)
print(f"Status: {response.status_code}")
stats = response.json()
print(f"Senhas emitidas hoje: {stats['senhas']['total_emitidas']}")

print("\n" + "=" * 70)
print("✅ TESTES CONCLUÍDOS!")
print("=" * 70 + "\n")
