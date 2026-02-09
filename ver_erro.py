"""
Script para identificar o erro 500 detalhado
Execute: python ver_erro.py
"""
import requests
import json

print("\n🔍 TESTANDO EMISSÃO DE SENHA COM DETALHES...\n")

# Teste básico
response = requests.post('http://localhost:5000/api/senhas', json={
    "servico_id": 1,
    "tipo": "normal"
})

print(f"Status: {response.status_code}")
print(f"Headers: {dict(response.headers)}\n")

try:
    data = response.json()
    print(f"Resposta JSON:")
    print(json.dumps(data, indent=2, ensure_ascii=False))
except:
    print(f"Resposta RAW:")
    print(response.text)

print("\n" + "="*70)
print("AGORA VERIFIQUE O TERMINAL DO SERVIDOR (onde está rodando python run.py)")
print("Lá deve aparecer o TRACEBACK completo do erro!")
print("="*70 + "\n")

print("Se o servidor não mostra o erro completo, adicione isso no run.py:")
print("""
# No run.py, mude de:
app = create_app()

# Para:
app = create_app()
app.config['DEBUG'] = True  # ← Adicione esta linha
""")