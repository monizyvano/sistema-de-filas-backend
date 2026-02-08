"""
DEMO COMPLETA - Sistema de Filas IMTSB
Executar: python demo_completa.py
"""
import requests
import time

BASE_URL = 'http://localhost:5000/api'

print("\n" + "="*70)
print("🎓 DEMO: SISTEMA DE GERENCIAMENTO DE FILAS - IMTSB")
print("="*70)

# ===== 1. LOGIN =====
print("\n\n🔐 PASSO 1: LOGIN DE ATENDENTE")
print("-" * 70)
response = requests.post(f'{BASE_URL}/auth/login', json={
    "email": "admin@imtsb.ao",
    "senha": "admin123"
})
print(f"✅ Status: {response.status_code}")
data = response.json()
print(f"✅ Atendente logado: {data['atendente']['nome']}")
TOKEN = data['access_token']
print(f"✅ Token JWT gerado (válido por 1 hora)")
time.sleep(2)

# ===== 2. EMITIR SENHAS =====
print("\n\n🎫 PASSO 2: EMITIR SENHAS")
print("-" * 70)
print("Emitindo 2 senhas normais e 1 prioritária...\n")

senhas_emitidas = []

for i in range(2):
    response = requests.post(f'{BASE_URL}/senhas', json={
        "servico_id": 1,
        "tipo": "normal"
    })
    senha = response.json()['senha']
    senhas_emitidas.append(senha['id'])
    print(f"  ✅ {senha['numero']} (normal)")
    time.sleep(0.5)

# Prioritária
response = requests.post(f'{BASE_URL}/senhas', json={
    "servico_id": 1,
    "tipo": "prioritaria"
})
senha = response.json()['senha']
senhas_emitidas.append(senha['id'])
print(f"  ⭐ {senha['numero']} (PRIORITÁRIA) ← Emitida por último!")
time.sleep(0.5)

# Mais uma normal
response = requests.post(f'{BASE_URL}/senhas', json={
    "servico_id": 1,
    "tipo": "normal"
})
senha = response.json()['senha']
senhas_emitidas.append(senha['id'])
print(f"  ✅ {senha['numero']} (normal)")
time.sleep(2)

# ===== 3. VER FILA =====
print("\n\n📊 PASSO 3: VISUALIZAR FILA (ORDENADA INTELIGENTEMENTE)")
print("-" * 70)
response = requests.get(f'{BASE_URL}/filas/1')
fila = response.json()['fila']

print("Ordem na fila:\n")
for i, s in enumerate(fila, 1):
    emoji = "⭐" if s['tipo'] == 'prioritaria' else "📄"
    print(f"  {i}º. {emoji} {s['numero']} ({s['tipo']})")

print(f"\n💡 Reparem: Prioritária vai PRIMEIRO mesmo tendo sido emitida por último!")
print(f"   Total na fila: {len(fila)} senhas")
time.sleep(3)

# ===== 4. CHAMAR PRÓXIMA =====
print("\n\n📣 PASSO 4: CHAMAR PRÓXIMA SENHA")
print("-" * 70)
headers = {'Authorization': f'Bearer {TOKEN}'}

response = requests.post(f'{BASE_URL}/filas/chamar', 
    json={"servico_id": 1, "numero_balcao": 1},
    headers=headers
)
senha_chamada = response.json()['senha']
print(f"✅ Senha chamada: {senha_chamada['numero']}")
print(f"📍 Balcão: {senha_chamada['numero_balcao']}")
print(f"📊 Status: {senha_chamada['status']}")
time.sleep(2)

# ===== 5. INICIAR ATENDIMENTO =====
print("\n\n▶️  PASSO 5: INICIAR ATENDIMENTO")
print("-" * 70)
senha_id = senha_chamada['id']

response = requests.put(f'{BASE_URL}/senhas/{senha_id}/iniciar',
    json={"numero_balcao": 1},
    headers=headers
)
senha = response.json()['senha']
print(f"✅ Atendimento iniciado")
print(f"⏱️  Tempo de espera: {senha['tempo_espera_minutos']} minutos")
print(f"👤 Atendente: {senha['atendente']['nome']}")
time.sleep(2)

# ===== 6. FINALIZAR =====
print("\n\n✅ PASSO 6: FINALIZAR ATENDIMENTO")
print("-" * 70)

response = requests.put(f'{BASE_URL}/senhas/{senha_id}/finalizar',
    json={"observacoes": "Matrícula realizada com sucesso"},
    headers=headers
)
senha = response.json()['senha']
print(f"✅ Atendimento concluído")
print(f"⏱️  Duração: {senha['tempo_atendimento_minutos']} minutos")
print(f"📊 Status final: {senha['status']}")
time.sleep(2)

# ===== 7. ESTATÍSTICAS =====
print("\n\n📊 PASSO 7: ESTATÍSTICAS EM TEMPO REAL")
print("-" * 70)

response = requests.get(f'{BASE_URL}/dashboard/estatisticas', headers=headers)
stats = response.json()

print(f"Total emitidas hoje: {stats['senhas']['total_emitidas']}")
print(f"Aguardando: {stats['senhas']['aguardando']}")
print(f"Atendendo: {stats['senhas']['atendendo']}")
print(f"Concluídas: {stats['senhas']['concluidas']}")

# ===== 8. LOGS =====
print("\n\n📜 PASSO 8: LOGS DE AUDITORIA")
print("-" * 70)

response = requests.get(f'{BASE_URL}/dashboard/logs?limite=5', headers=headers)
logs = response.json()

print("Últimas ações registradas:\n")
for log in logs[:5]:
    print(f"  • {log['acao'].upper()}: {log['descricao']}")

# ===== CONCLUSÃO =====
print("\n" + "="*70)
print("✅ DEMO CONCLUÍDA COM SUCESSO!")
print("="*70)
print("\n💡 O QUE FOI DEMONSTRADO:")
print("  ✅ Login com JWT")
print("  ✅ Emissão automática de senhas (N001, P001...)")
print("  ✅ Fila inteligente (prioritárias primeiro)")
print("  ✅ Fluxo completo de atendimento")
print("  ✅ Estatísticas em tempo real")
print("  ✅ Sistema de logs (auditoria)")
print("\n🔄 PRÓXIMO PASSO: Integração com frontend HTML/JS\n")

# Limpar senhas de teste
print("🧹 Limpando senhas de teste...")
for sid in senhas_emitidas:
    try:
        requests.delete(f'{BASE_URL}/senhas/{sid}/cancelar',
            json={"motivo": "Teste de demonstração"},
            headers=headers
        )
    except:
        pass

print("✅ Limpeza concluída!\n")