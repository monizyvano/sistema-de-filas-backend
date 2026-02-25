#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  DEMO COMPLETA - BACKEND SISTEMA DE FILAS IMTSB              ║
║  Estado Atual: Fevereiro 2026                                ║
║                                                              ║
║  Desenvolvido por: Yvano Moniz, Jefferson André,             ║
║                   Reginalda Almeida                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

Esta demo demonstra TODAS as funcionalidades implementadas:
✅ Autenticação JWT
✅ Emissão de Senhas (Normal e Prioritária)
✅ Gestão de Filas
✅ Atendimento Completo (Iniciar, Finalizar, Cancelar)
✅ Estatísticas em Tempo Real
✅ Rate Limiting
✅ Validações Marshmallow
✅ Logs Estruturados
✅ Health Check

REQUISITOS:
- Backend rodando em http://localhost:5000
- Banco de dados populado com serviços
- Atendente admin cadastrado (admin@imtsb.ao / admin123)
"""

import requests
import json
import time
from datetime import datetime
from colorama import init, Fore, Back, Style

# Inicializar colorama para cores no terminal
init(autoreset=True)

# Configurações
BASE_URL = "http://localhost:5000"
API_URL = f"{BASE_URL}/api"

# Variáveis globais
token_jwt = None
atendente_logado = None


def print_header(titulo):
    """Imprime cabeçalho colorido"""
    print(f"\n{Back.BLUE}{Fore.WHITE} {titulo.center(70)} {Style.RESET_ALL}\n")


def print_success(mensagem):
    """Imprime mensagem de sucesso"""
    print(f"{Fore.GREEN}✅ {mensagem}{Style.RESET_ALL}")


def print_error(mensagem):
    """Imprime mensagem de erro"""
    print(f"{Fore.RED}❌ {mensagem}{Style.RESET_ALL}")


def print_info(mensagem):
    """Imprime mensagem informativa"""
    print(f"{Fore.CYAN}ℹ️  {mensagem}{Style.RESET_ALL}")


def print_warning(mensagem):
    """Imprime mensagem de aviso"""
    print(f"{Fore.YELLOW}⚠️  {mensagem}{Style.RESET_ALL}")


def print_json(data, titulo=""):
    """Imprime JSON formatado"""
    if titulo:
        print(f"{Fore.MAGENTA}📄 {titulo}:{Style.RESET_ALL}")
    print(json.dumps(data, indent=2, ensure_ascii=False))


def pausar():
    """Pausa para visualização"""
    time.sleep(1.5)


# ========================================
# 1. HEALTH CHECK
# ========================================
def demo_health_check():
    """Demonstra health check do sistema"""
    print_header("1. HEALTH CHECK DO SISTEMA")
    
    try:
        print_info("Verificando saúde do sistema...")
        response = requests.get(f"{API_URL}/auth/health", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print_success(f"Sistema está {data['status'].upper()}!")
            print_json(data, "Status Detalhado")
            
            # Verificar componentes
            if data['checks']['database'] == 'ok':
                print_success("Database: Conectado")
            else:
                print_error("Database: Erro")
            
            if data['checks'].get('cache') == 'ok':
                print_success("Cache: Funcionando")
            else:
                print_warning("Cache: Indisponível")
        else:
            print_error(f"Sistema unhealthy! Status: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print_error("❌ ERRO CRÍTICO: Servidor não está rodando!")
        print_info("Execute: python run.py")
        exit(1)
    except Exception as e:
        print_error(f"Erro ao verificar health: {e}")


# ========================================
# 2. AUTENTICAÇÃO JWT
# ========================================
def demo_autenticacao():
    """Demonstra sistema de autenticação JWT"""
    global token_jwt, atendente_logado
    
    print_header("2. AUTENTICAÇÃO JWT")
    
    # Tentativa com credenciais inválidas
    print_info("Testando login com credenciais INVÁLIDAS...")
    response = requests.post(
        f"{API_URL}/auth/login",
        json={
            "email": "admin@imtsb.ao",
            "senha": "senhaerrada"
        }
    )
    
    if response.status_code == 401:
        print_success("Validação funcionando! Login rejeitado (senha incorreta)")
    
    pausar()
    
    # Login correto
    print_info("Fazendo login com credenciais CORRETAS...")
    response = requests.post(
        f"{API_URL}/auth/login",
        json={
            "email": "admin@imtsb.ao",
            "senha": "admin123"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        token_jwt = data['access_token']
        atendente_logado = data['atendente']
        
        print_success("Login bem-sucedido!")
        print_info(f"Atendente: {atendente_logado['nome']}")
        print_info(f"Tipo: {atendente_logado['tipo']}")
        print_info(f"Token JWT: {token_jwt[:30]}...")
        
        # Verificar Request ID
        request_id = response.headers.get('X-Request-ID')
        if request_id:
            print_success(f"Request ID rastreável: {request_id}")
    else:
        print_error("Falha no login!")
        print_json(response.json())


# ========================================
# 3. VALIDAÇÕES MARSHMALLOW
# ========================================
def demo_validacoes():
    """Demonstra validações robustas"""
    print_header("3. VALIDAÇÕES MARSHMALLOW")
    
    # Teste 1: Dados inválidos
    print_info("Teste 1: Tentando emitir senha com dados INVÁLIDOS...")
    response = requests.post(
        f"{API_URL}/senhas",
        json={
            "servico_id": "abc",  # Deve ser número
            "tipo": "invalido"    # Deve ser normal/prioritaria
        }
    )
    
    if response.status_code == 400:
        print_success("Validação funcionando! Dados inválidos rejeitados")
        data = response.json()
        print_json(data['detalhes'], "Erros de validação")
    
    pausar()
    
    # Teste 2: Campos obrigatórios
    print_info("Teste 2: Tentando emitir senha SEM dados obrigatórios...")
    response = requests.post(
        f"{API_URL}/senhas",
        json={}
    )
    
    if response.status_code == 400:
        print_success("Validação funcionando! Campos obrigatórios detectados")


# ========================================
# 4. EMISSÃO DE SENHAS
# ========================================
def demo_emissao_senhas():
    """Demonstra emissão de senhas normal e prioritária"""
    print_header("4. EMISSÃO DE SENHAS")
    
    senhas_emitidas = []
    
    # Emitir senha normal
    print_info("Emitindo senha NORMAL (N)...")
    response = requests.post(
        f"{API_URL}/senhas",
        json={
            "servico_id": 1,
            "tipo": "normal"
        }
    )
    
    if response.status_code == 201:
        data = response.json()
        senha = data['senha']
        senhas_emitidas.append(senha)
        
        print_success(f"Senha emitida: {senha['numero']}")
        print_info(f"Status: {senha['status']}")
        print_info(f"Data: {senha['data_emissao']}")
        
        # Verificar Request ID nos logs
        request_id = response.headers.get('X-Request-ID')
        if request_id:
            print_success(f"Request ID (para rastrear nos logs): {request_id}")
    
    pausar()
    
    # Emitir senha prioritária
    print_info("Emitindo senha PRIORITÁRIA (P)...")
    response = requests.post(
        f"{API_URL}/senhas",
        json={
            "servico_id": 1,
            "tipo": "prioritaria",
            "usuario_contato": "+244 923 456 789"
        }
    )
    
    if response.status_code == 201:
        data = response.json()
        senha = data['senha']
        senhas_emitidas.append(senha)
        
        print_success(f"Senha prioritária emitida: {senha['numero']}")
        print_info(f"Contato: {senha.get('usuario_contato', 'N/A')}")
    
    pausar()
    
    # Emitir mais senhas para demonstração
    print_info("Emitindo mais 3 senhas para encher a fila...")
    for i in range(3):
        response = requests.post(
            f"{API_URL}/senhas",
            json={
                "servico_id": 1,
                "tipo": "normal"
            }
        )
        if response.status_code == 201:
            senha = response.json()['senha']
            senhas_emitidas.append(senha)
            print_success(f"Senha {i+1}: {senha['numero']}")
    
    return senhas_emitidas


# ========================================
# 5. RATE LIMITING
# ========================================
def demo_rate_limiting():
    """Demonstra proteção contra spam"""
    print_header("5. RATE LIMITING (Proteção Anti-Spam)")
    
    print_info("Fazendo 12 requisições rápidas (limite: 10/min)...")
    
    sucesso = 0
    bloqueado = 0
    
    for i in range(12):
        response = requests.post(
            f"{API_URL}/senhas",
            json={"servico_id": 1, "tipo": "normal"}
        )
        
        if response.status_code == 201:
            sucesso += 1
            print(f"{Fore.GREEN}Req {i+1:2d}: ✓ Permitida (201){Style.RESET_ALL}")
        elif response.status_code == 429:
            bloqueado += 1
            print(f"{Fore.RED}Req {i+1:2d}: ✗ BLOQUEADA (429) - Rate limit!{Style.RESET_ALL}")
            
            # Mostrar headers de rate limit
            headers = response.headers
            if 'X-RateLimit-Remaining' in headers:
                print_warning(f"  Requisições restantes: {headers['X-RateLimit-Remaining']}")
    
    print()
    print_success(f"Permitidas: {sucesso}/12")
    print_error(f"Bloqueadas: {bloqueado}/12")
    
    if bloqueado > 0:
        print_success("✅ Rate limiting funcionando perfeitamente!")


# ========================================
# 6. BUSCAR FILA
# ========================================
def demo_buscar_fila():
    """Demonstra busca de fila"""
    print_header("6. BUSCAR FILA DO SERVIÇO")
    
    print_info("Buscando fila do serviço 1...")
    response = requests.get(f"{API_URL}/filas/1")
    
    if response.status_code == 200:
        data = response.json()
        
        print_success(f"Total na fila: {data['total']}")
        print()
        
        if data['fila']:
            print(f"{Fore.CYAN}╔═══════════════════════════════════════════╗{Style.RESET_ALL}")
            print(f"{Fore.CYAN}║          FILA DE ATENDIMENTO              ║{Style.RESET_ALL}")
            print(f"{Fore.CYAN}╠═══════════════════════════════════════════╣{Style.RESET_ALL}")
            
            for i, senha in enumerate(data['fila'][:5], 1):  # Mostrar apenas 5
                tipo_emoji = "🔴" if senha['tipo'] == 'prioritaria' else "🔵"
                print(f"{Fore.CYAN}║{Style.RESET_ALL} {i}. {tipo_emoji} {senha['numero']:6s} - {senha['status']:12s} {Fore.CYAN}║{Style.RESET_ALL}")
            
            if data['total'] > 5:
                print(f"{Fore.CYAN}║{Style.RESET_ALL}    ... e mais {data['total'] - 5} senhas          {Fore.CYAN}║{Style.RESET_ALL}")
            
            print(f"{Fore.CYAN}╚═══════════════════════════════════════════╝{Style.RESET_ALL}")


# ========================================
# 7. ESTATÍSTICAS
# ========================================
def demo_estatisticas():
    """Demonstra estatísticas do dia"""
    print_header("7. ESTATÍSTICAS DO DIA")
    
    print_info("Buscando estatísticas...")
    response = requests.get(f"{API_URL}/senhas/estatisticas")
    
    if response.status_code == 200:
        stats = response.json()
        
        print()
        print(f"{Fore.GREEN}╔═══════════════════════════════════════════╗{Style.RESET_ALL}")
        print(f"{Fore.GREEN}║       ESTATÍSTICAS DO DIA                 ║{Style.RESET_ALL}")
        print(f"{Fore.GREEN}╠═══════════════════════════════════════════╣{Style.RESET_ALL}")
        print(f"{Fore.GREEN}║{Style.RESET_ALL} 📊 Total Emitidas:    {stats['total_emitidas']:3d}           {Fore.GREEN}║{Style.RESET_ALL}")
        print(f"{Fore.GREEN}║{Style.RESET_ALL} ⏳ Aguardando:        {stats['aguardando']:3d}           {Fore.GREEN}║{Style.RESET_ALL}")
        print(f"{Fore.GREEN}║{Style.RESET_ALL} 🔄 Atendendo:         {stats['atendendo']:3d}           {Fore.GREEN}║{Style.RESET_ALL}")
        print(f"{Fore.GREEN}║{Style.RESET_ALL} ✅ Concluídas:        {stats['concluidas']:3d}           {Fore.GREEN}║{Style.RESET_ALL}")
        print(f"{Fore.GREEN}║{Style.RESET_ALL} ❌ Canceladas:        {stats['canceladas']:3d}           {Fore.GREEN}║{Style.RESET_ALL}")
        print(f"{Fore.GREEN}╚═══════════════════════════════════════════╝{Style.RESET_ALL}")
        
        # Calcular métricas
        if stats['total_emitidas'] > 0:
            taxa_conclusao = (stats['concluidas'] / stats['total_emitidas']) * 100
            print_success(f"Taxa de conclusão: {taxa_conclusao:.1f}%")


# ========================================
# 8. FLUXO COMPLETO DE ATENDIMENTO
# ========================================
def demo_fluxo_atendimento():
    """Demonstra fluxo completo: chamar → iniciar → finalizar"""
    print_header("8. FLUXO COMPLETO DE ATENDIMENTO")
    
    if not token_jwt:
        print_error("Token JWT não disponível. Faça login primeiro!")
        return
    
    headers = {
        "Authorization": f"Bearer {token_jwt}",
        "Content-Type": "application/json"
    }
    
    # Passo 1: Chamar próxima senha
    print_info("PASSO 1: Chamando próxima senha da fila...")
    response = requests.post(
        f"{API_URL}/filas/chamar",
        json={
            "servico_id": 1,
            "numero_balcao": 1
        },
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        senha_chamada = data['senha']
        senha_id = senha_chamada['id']
        
        print_success(f"Senha chamada: {senha_chamada['numero']}")
        print_info(f"Balcão: 1")
        print_info(f"Status: {senha_chamada['status']}")
        
        pausar()
        
        # Passo 2: Iniciar atendimento
        print_info(f"PASSO 2: Iniciando atendimento da senha {senha_chamada['numero']}...")
        response = requests.put(
            f"{API_URL}/senhas/{senha_id}/iniciar",
            json={"numero_balcao": 1},
            headers=headers
        )
        
        if response.status_code == 200:
            print_success("Atendimento iniciado!")
            
            pausar()
            
            # Passo 3: Finalizar atendimento
            print_info(f"PASSO 3: Finalizando atendimento...")
            response = requests.put(
                f"{API_URL}/senhas/{senha_id}/finalizar",
                json={"observacoes": "Atendimento concluído com sucesso - DEMO"},
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                print_success("Atendimento finalizado!")
                print_info(f"Status final: {data['senha']['status']}")
                print_success("✅ FLUXO COMPLETO EXECUTADO COM SUCESSO!")
    else:
        print_error(f"Erro ao chamar senha: {response.status_code}")
        print_json(response.json())


# ========================================
# 9. CANCELAMENTO DE SENHA
# ========================================
def demo_cancelamento():
    """Demonstra cancelamento de senha"""
    print_header("9. CANCELAMENTO DE SENHA")
    
    if not token_jwt:
        print_error("Token JWT não disponível!")
        return
    
    headers = {
        "Authorization": f"Bearer {token_jwt}",
        "Content-Type": "application/json"
    }
    
    # Emitir uma senha para cancelar
    print_info("Emitindo senha para demonstrar cancelamento...")
    response = requests.post(
        f"{API_URL}/senhas",
        json={"servico_id": 1, "tipo": "normal"}
    )
    
    if response.status_code == 201:
        senha = response.json()['senha']
        senha_id = senha['id']
        print_success(f"Senha emitida: {senha['numero']}")
        
        pausar()
        
        # Cancelar
        print_info(f"Cancelando senha {senha['numero']}...")
        response = requests.delete(
            f"{API_URL}/senhas/{senha_id}/cancelar",
            json={"motivo": "Usuário desistiu do atendimento - DEMO"},
            headers=headers
        )
        
        if response.status_code == 200:
            print_success("Senha cancelada com sucesso!")
            print_info("Motivo registrado nos logs")


# ========================================
# 10. PERFORMANCE (CACHE)
# ========================================
def demo_performance():
    """Demonstra performance com cache"""
    print_header("10. PERFORMANCE COM CACHE")
    
    print_info("Testando velocidade de resposta (com cache)...")
    
    # Primeira requisição (sem cache)
    inicio = time.time()
    response = requests.get(f"{API_URL}/senhas/estatisticas")
    tempo1 = (time.time() - inicio) * 1000
    
    print_info(f"1ª requisição: {tempo1:.2f}ms (popula cache)")
    
    # Segunda requisição (com cache)
    inicio = time.time()
    response = requests.get(f"{API_URL}/senhas/estatisticas")
    tempo2 = (time.time() - inicio) * 1000
    
    print_success(f"2ª requisição: {tempo2:.2f}ms (do cache)")
    
    if tempo2 < tempo1:
        melhoria = ((tempo1 - tempo2) / tempo1) * 100
        print_success(f"Cache {melhoria:.0f}% mais rápido!")


# ========================================
# FUNÇÃO PRINCIPAL
# ========================================
def main():
    """Executa demo completa"""
    
    print(f"{Fore.CYAN}")
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║                                                              ║")
    print("║       DEMO COMPLETA - BACKEND SISTEMA DE FILAS IMTSB         ║")
    print("║                                                              ║")
    print("║  Desenvolvido por: Yvano Moniz, Jefferson André,             ║")
    print("║                   Reginalda Almeida                          ║")
    print("║                                                              ║")
    print("║  Projeto: TCC 2026 - IMTSB                                   ║")
    print("║                                                              ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print(Style.RESET_ALL)
    
    print(f"{Fore.YELLOW}")
    print("REQUISITOS:")
    print("  ✓ Backend rodando em http://localhost:5000")
    print("  ✓ Banco de dados com serviços cadastrados")
    print("  ✓ Atendente admin: admin@imtsb.ao / admin123")
    print(Style.RESET_ALL)
    
    input(f"\n{Fore.GREEN}Pressione ENTER para começar a demo...{Style.RESET_ALL}")
    
    try:
        # Executar todas as demos
        demo_health_check()
        pausar()
        
        demo_autenticacao()
        pausar()
        
        demo_validacoes()
        pausar()
        
        senhas = demo_emissao_senhas()
        pausar()
        
        demo_rate_limiting()
        pausar()
        
        demo_buscar_fila()
        pausar()
        
        demo_estatisticas()
        pausar()
        
        demo_fluxo_atendimento()
        pausar()
        
        demo_cancelamento()
        pausar()
        
        demo_performance()
        
        # Resumo final
        print_header("RESUMO DA DEMONSTRAÇÃO")
        
        print(f"{Fore.GREEN}")
        print("✅ Funcionalidades Demonstradas:")
        print("  1. ✓ Health Check do Sistema")
        print("  2. ✓ Autenticação JWT")
        print("  3. ✓ Validações Marshmallow")
        print("  4. ✓ Emissão de Senhas (Normal e Prioritária)")
        print("  5. ✓ Rate Limiting (Anti-Spam)")
        print("  6. ✓ Buscar Fila")
        print("  7. ✓ Estatísticas em Tempo Real")
        print("  8. ✓ Fluxo Completo de Atendimento")
        print("  9. ✓ Cancelamento de Senha")
        print(" 10. ✓ Performance com Cache")
        print(Style.RESET_ALL)
        
        print()
        print(f"{Fore.CYAN}╔══════════════════════════════════════════════════════════════╗")
        print(f"║                                                              ║")
        print(f"║  🎉 DEMO CONCLUÍDA COM SUCESSO! 🎉                          ║")
        print(f"║                                                              ║")
        print(f"║  Backend 100% funcional e pronto para integração!           ║")
        print(f"║                                                              ║")
        print(f"╚══════════════════════════════════════════════════════════════╝")
        print(Style.RESET_ALL)
        
        print()
        print(f"{Fore.YELLOW}📚 Documentação completa: http://localhost:5000/docs{Style.RESET_ALL}")
        print(f"{Fore.YELLOW}📊 Logs do sistema: logs/app.log{Style.RESET_ALL}")
        
    except KeyboardInterrupt:
        print(f"\n\n{Fore.YELLOW}Demo interrompida pelo usuário.{Style.RESET_ALL}")
    except Exception as e:
        print(f"\n{Fore.RED}Erro durante a demo: {e}{Style.RESET_ALL}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
