import requests

# 1. Login
print("1. Fazendo login...")
r_login = requests.post('http://localhost:5000/api/auth/login', json={
    'email': 'admin@imtsb.ao',
    'senha': 'admin123'
})

if r_login.status_code != 200:
    print(f"❌ Erro no login: {r_login.status_code}")
    exit()

token = r_login.json()['access_token']
print(f"✅ Login OK! Token: {token[:30]}...")

# 2. Chamar senha
print("\n2. Chamando próxima senha...")
r_chamar = requests.post('http://localhost:5000/api/filas/chamar', 
    json={
        'servico_id': 1,
        'numero_balcao': 1
    },
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
)

print(f"Status: {r_chamar.status_code}")
print(f"Resposta: {r_chamar.json()}")

if r_chamar.status_code == 200:
    print("\n✅ SUCESSO! Senha chamada!")
elif r_chamar.status_code == 422:
    print("\n❌ Erro 422 ainda presente")
    print("Detalhes:", r_chamar.json())
else:
    print(f"\n⚠️ Erro {r_chamar.status_code}")