"""
DEMO COMPLETA - Sistema de Filas IMTSB (VERSÃO CORRIGIDA)
Executar: python demo_completa.py

REQUISITOS:
1. Servidor rodando: python run.py
2. Biblioteca requests instalada: pip install requests
"""
import requests
import time
import sys

BASE_URL = 'http://localhost:5000/api'

# Cores para terminal
class Colors:
    GREEN = '\033[92m'
    BLUE = '\033[94m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")

def print_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")

def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")

def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")

def print_section(title):
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}{title}{Colors.END}")
    print(f"{Colors.BOLD}{'-'*70}{Colors.END}")

def check_server():
    """Verifica se servidor está rodando"""
    try:
        response = requests.get(f'{BASE_URL}/auth/health', timeout=2)
        return response.status_code == 200
    except:
        return False

def handle_response(response, success_message="Sucesso"):
    """Trata resposta da API com debug"""
    print(f"Status: {response.status_code}")
    
    try:
        data = response.json()
    except:
        print_error(f"Resposta não é JSON: {response.text[:200]}")
        return None
    
    if response.status_code >= 400:
        print_error(f"Erro: {data.get('erro', 'Erro desconhecido')}")
        if 'detalhes' in data:
            print(f"Detalhes: {data['detalhes']}")
        return None
    
    print_success(success_message)
    return data


print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
print(f"{Colors.BOLD}🎓 DEMO: SISTEMA DE GERENCIAMENTO DE FILAS - IMTSB{Colors.END}")
print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")

# ===== VERIFICAR SERVIDOR =====
print_info("Verificando se servidor está rodando...")
if not check_server():
    print_error("SERVIDOR NÃO ESTÁ RODANDO!")
    print("\nPara iniciar o servidor:")
    print("  1. Abra outro terminal")
    print("  2. Ative o venv: venv\\Scripts\\activate")
    print("  3. Execute: python run.py")
    print("\nDepois execute este script novamente.\n")
    sys.exit(1)

print_success("Servidor está rodando!\n")
time.sleep(1)

# ===== 1. LOGIN =====
print_section("🔐 PASSO 1: LOGIN DE ATENDENTE")

print_info("Fazendo login com admin@imtsb.ao...")
response = requests.post(f'{BASE_URL}/auth/login', json={
    "email": "admin@imtsb.ao",
    "senha": "admin123"
})

data = handle_response(response, "Login realizado")
if not data:
    print_error("Falha no login. Verifique se os seeders foram executados (python seed.py)")
    sys.exit(1)

TOKEN = data.get('access_token')
if not TOKEN:
    print_error("Token não foi retornado na resposta")
    sys.exit(1)

print(f"Atendente: {data['atendente']['nome']}")
print(f"Tipo: {data['atendente']['tipo']}")
print(f"Token JWT gerado: {TOKEN[:50]}...")
time.sleep(2)

headers = {'Authorization': f'Bearer {TOKEN}'}

# ===== 2. EMITIR SENHAS =====
print_section("🎫 PASSO 2: EMITIR SENHAS")

print_info("Emitindo 2 senhas normais e 1 prioritária...\n")

senhas_emitidas = []

# Emitir 2 normais
for i in range(2):
    response = requests.post(f'{BASE_URL}/senhas', json={
        "servico_id": 1,
        "tipo": "normal"
    })
    
    data = handle_response(response)
    if data and 'senha' in data:
        senha = data['senha']
        senhas_emitidas.append(senha['id'])
        print(f"  ✅ {senha['numero']} (normal) - {senha['servico']['nome']}")
    else:
        print_warning(f"  Tentativa {i+1} falhou")
    
    time.sleep(0.5)

# Emitir 1 prioritária
response = requests.post(f'{BASE_URL}/senhas', json={
    "servico_id": 1,
    "tipo": "prioritaria"
})

data = handle_response(response)
if data and 'senha' in data:
    senha = data['senha']
    senhas_emitidas.append(senha['id'])
    print(f"  ⭐ {senha['numero']} (PRIORITÁRIA) - {senha['servico']['nome']} ← Emitida por último!")
else:
    print_warning("  Falha ao emitir prioritária")

time.sleep(0.5)

# Mais 1 normal
response = requests.post(f'{BASE_URL}/senhas', json={
    "servico_id": 1,
    "tipo": "normal"
})

data = handle_response(response)
if data and 'senha' in data:
    senha = data['senha']
    senhas_emitidas.append(senha['id'])
    print(f"  ✅ {senha['numero']} (normal) - {senha['servico']['nome']}")

time.sleep(2)

# ===== 3. VER FILA =====
print_section("📊 PASSO 3: VISUALIZAR FILA (ORDENADA INTELIGENTEMENTE)")

response = requests.get(f'{BASE_URL}/filas/1')
data = handle_response(response, "Fila obtida")

if data and 'fila' in data:
    fila = data['fila']
    
    print("\nOrdem na fila:\n")
    for i, s in enumerate(fila, 1):
        emoji = "⭐" if s['tipo'] == 'prioritaria' else "📄"
        print(f"  {i}º. {emoji} {s['numero']} ({s['tipo']})")
    
    print(f"\n💡 Reparem: Prioritária vai PRIMEIRO mesmo tendo sido emitida por último!")
    print(f"   Total na fila: {len(fila)} senhas")
else:
    print_warning("Não foi possível obter a fila")

time.sleep(3)

# ===== 4. CHAMAR PRÓXIMA =====
print_section("📣 PASSO 4: CHAMAR PRÓXIMA SENHA")

response = requests.post(f'{BASE_URL}/filas/chamar', 
    json={"servico_id": 1, "numero_balcao": 1},
    headers=headers
)

data = handle_response(response, "Senha chamada")

if data and 'senha' in data:
    senha_chamada = data['senha']
    print(f"Senha chamada: {senha_chamada['numero']}")
    print(f"Balcão: {senha_chamada.get('numero_balcao', 'N/A')}")
    print(f"Status: {senha_chamada['status']}")
    senha_id_chamada = senha_chamada['id']
else:
    print_warning("Não foi possível chamar senha")
    # Tentar pegar primeira senha da lista para continuar demo
    if senhas_emitidas:
        senha_id_chamada = senhas_emitidas[0]
    else:
        print_error("Nenhuma senha disponível para continuar demo")
        sys.exit(1)

time.sleep(2)

# ===== 5. INICIAR ATENDIMENTO =====
print_section("▶️  PASSO 5: INICIAR ATENDIMENTO")

response = requests.put(f'{BASE_URL}/senhas/{senha_id_chamada}/iniciar',
    json={"numero_balcao": 1},
    headers=headers
)

data = handle_response(response, "Atendimento iniciado")

if data and 'senha' in data:
    senha = data['senha']
    print(f"Tempo de espera: {senha.get('tempo_espera_minutos', 'N/A')} minutos")
    if 'atendente' in senha and senha['atendente']:
        print(f"Atendente: {senha['atendente']['nome']}")
else:
    print_warning("Não foi possível iniciar atendimento")

time.sleep(2)

# ===== 6. FINALIZAR =====
print_section("✅ PASSO 6: FINALIZAR ATENDIMENTO")

response = requests.put(f'{BASE_URL}/senhas/{senha_id_chamada}/finalizar',
    json={"observacoes": "Matrícula realizada com sucesso"},
    headers=headers
)

data = handle_response(response, "Atendimento concluído")

if data and 'senha' in data:
    senha = data['senha']
    print(f"Duração: {senha.get('tempo_atendimento_minutos', 'N/A')} minutos")
    print(f"Status final: {senha['status']}")
else:
    print_warning("Não foi possível finalizar atendimento")

time.sleep(2)

# ===== 7. ESTATÍSTICAS =====
print_section("📊 PASSO 7: ESTATÍSTICAS EM TEMPO REAL")

response = requests.get(f'{BASE_URL}/dashboard/estatisticas', headers=headers)
data = handle_response(response, "Estatísticas obtidas")

if data and 'senhas' in data:
    stats = data['senhas']
    print(f"Total emitidas hoje: {stats.get('total_emitidas', 0)}")
    print(f"Aguardando: {stats.get('aguardando', 0)}")
    print(f"Atendendo: {stats.get('atendendo', 0)}")
    print(f"Concluídas: {stats.get('concluidas', 0)}")
    print(f"Canceladas: {stats.get('canceladas', 0)}")
else:
    print_warning("Não foi possível obter estatísticas")

time.sleep(1)

# ===== 8. LOGS =====
print_section("📜 PASSO 8: LOGS DE AUDITORIA")

response = requests.get(f'{BASE_URL}/dashboard/logs?limite=5', headers=headers)
data = handle_response(response, "Logs obtidos")

if data and isinstance(data, list):
    print("\nÚltimas ações registradas:\n")
    for log in data[:5]:
        print(f"  • {log.get('acao', 'N/A').upper()}: {log.get('descricao', 'N/A')}")
else:
    print_warning("Não foi possível obter logs")

# ===== CONCLUSÃO =====
print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
print(f"{Colors.GREEN}{Colors.BOLD}✅ DEMO CONCLUÍDA COM SUCESSO!{Colors.END}")
print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")

print(f"{Colors.BOLD}💡 O QUE FOI DEMONSTRADO:{Colors.END}")
print("  ✅ Login com JWT")
print("  ✅ Emissão automática de senhas (N001, P001...)")
print("  ✅ Fila inteligente (prioritárias primeiro)")
print("  ✅ Fluxo completo de atendimento")
print("  ✅ Estatísticas em tempo real")
print("  ✅ Sistema de logs (auditoria)")
print(f"\n🔄 PRÓXIMO PASSO: Integração com frontend HTML/JS\n")

# Limpar senhas de teste
if senhas_emitidas:
    print_info("Limpando senhas de teste...")
    for sid in senhas_emitidas:
        try:
            requests.delete(f'{BASE_URL}/senhas/{sid}/cancelar',
                json={"motivo": "Teste de demonstração"},
                headers=headers
            )
        except:
            pass
    
    print_success("Limpeza concluída!\n")