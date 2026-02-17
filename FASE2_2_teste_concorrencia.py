# ===== FASE 2: TESTE DE CONCORRÊNCIA =====

"""
Teste de race conditions com threads simultâneas

Simula múltiplos usuários emitindo senhas ao mesmo tempo
Verifica se não há duplicação

Execute: python FASE2_2_teste_concorrencia.py
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from app import create_app, db
from app.models.senha import Senha
from app.services.senha_service import SenhaService
from datetime import datetime, date
import threading
import time
from collections import Counter


# Cores
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_test(name):
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}TESTE: {name}{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")


def print_success(msg):
    print(f"{Colors.GREEN}✅ {msg}{Colors.END}")


def print_error(msg):
    print(f"{Colors.RED}❌ {msg}{Colors.END}")


def print_info(msg):
    print(f"{Colors.BLUE}ℹ️  {msg}{Colors.END}")


def print_warning(msg):
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.END}")


# ===== FUNÇÕES AUXILIARES =====

def emitir_senha_thread(app, servico_id, tipo, resultados, thread_id):
    """
    Função executada por cada thread
    
    Tenta emitir uma senha e guarda o resultado
    """
    with app.app_context():
        try:
            senha = SenhaService.emitir(servico_id=servico_id, tipo=tipo)
            resultados.append({
                'thread_id': thread_id,
                'numero': senha.numero,
                'sucesso': True,
                'erro': None
            })
            print(f"   Thread {thread_id:2d}: ✅ {senha.numero}")
            
        except Exception as e:
            resultados.append({
                'thread_id': thread_id,
                'numero': None,
                'sucesso': False,
                'erro': str(e)
            })
            print(f"   Thread {thread_id:2d}: ❌ Erro: {str(e)[:50]}")


# ===== TESTES =====

def teste_1_sequencial():
    """Teste 1: Emissão sequencial (baseline)"""
    print_test("1. Emissão Sequencial (Baseline)")
    
    app = create_app()
    
    with app.app_context():
        # Limpar senhas de hoje
        hoje = date.today()
        Senha.query.filter_by(data_emissao=hoje).delete()
        db.session.commit()
        
        print_info("Emitindo 10 senhas sequencialmente...")
        
        numeros = []
        for i in range(10):
            senha = SenhaService.emitir(servico_id=1, tipo='normal')
            numeros.append(senha.numero)
            print(f"   {i+1:2d}. {senha.numero}")
        
        # Verificar se não há duplicados
        duplicados = [n for n, count in Counter(numeros).items() if count > 1]
        
        if duplicados:
            print_error(f"DUPLICADOS encontrados: {duplicados}")
            return False
        else:
            print_success("Nenhum duplicado (esperado em execução sequencial)")
            return True


def teste_2_concorrencia_leve():
    """Teste 2: Concorrência leve (5 threads)"""
    print_test("2. Concorrência Leve (5 threads simultâneas)")
    
    app = create_app()
    
    with app.app_context():
        # Limpar senhas de hoje
        hoje = date.today()
        Senha.query.filter_by(data_emissao=hoje).delete()
        db.session.commit()
    
    print_info("Iniciando 5 threads simultâneas...")
    
    resultados = []
    threads = []
    
    # Criar 5 threads
    for i in range(5):
        thread = threading.Thread(
            target=emitir_senha_thread,
            args=(app, 1, 'normal', resultados, i+1)
        )
        threads.append(thread)
    
    # Iniciar todas ao mesmo tempo
    inicio = time.time()
    for thread in threads:
        thread.start()
    
    # Aguardar todas terminarem
    for thread in threads:
        thread.join()
    
    tempo_total = (time.time() - inicio) * 1000
    
    print(f"\n   Tempo total: {tempo_total:.2f}ms")
    
    # Análise dos resultados
    sucessos = [r for r in resultados if r['sucesso']]
    falhas = [r for r in resultados if not r['sucesso']]
    
    print(f"\n   Sucessos: {len(sucessos)}/{len(resultados)}")
    print(f"   Falhas: {len(falhas)}/{len(resultados)}")
    
    # Verificar duplicados
    numeros = [r['numero'] for r in sucessos]
    duplicados = [n for n, count in Counter(numeros).items() if count > 1]
    
    if duplicados:
        print_error(f"❌ DUPLICADOS encontrados: {duplicados}")
        print_error("Sistema NÃO protegido contra race condition!")
        return False
    else:
        print_success("✅ Nenhum duplicado encontrado!")
        print_success("Sistema protegido contra race condition!")
        return True


def teste_3_concorrencia_pesada():
    """Teste 3: Concorrência pesada (20 threads)"""
    print_test("3. Concorrência Pesada (20 threads simultâneas)")
    
    app = create_app()
    
    with app.app_context():
        hoje = date.today()
        Senha.query.filter_by(data_emissao=hoje).delete()
        db.session.commit()
    
    print_info("Iniciando 20 threads simultâneas...")
    
    resultados = []
    threads = []
    
    for i in range(20):
        thread = threading.Thread(
            target=emitir_senha_thread,
            args=(app, 1, 'normal', resultados, i+1)
        )
        threads.append(thread)
    
    inicio = time.time()
    for thread in threads:
        thread.start()
    
    for thread in threads:
        thread.join()
    
    tempo_total = (time.time() - inicio) * 1000
    
    print(f"\n   Tempo total: {tempo_total:.2f}ms")
    print(f"   Tempo médio por thread: {tempo_total/20:.2f}ms")
    
    sucessos = [r for r in resultados if r['sucesso']]
    falhas = [r for r in resultados if not r['sucesso']]
    
    print(f"\n   Sucessos: {len(sucessos)}/{len(resultados)}")
    print(f"   Falhas: {len(falhas)}/{len(resultados)}")
    
    if falhas:
        print_warning(f"Algumas threads falharam (pode ser normal com locks)")
        for f in falhas[:3]:  # Mostrar primeiras 3
            print(f"     - Thread {f['thread_id']}: {f['erro'][:60]}")
    
    numeros = [r['numero'] for r in sucessos]
    duplicados = [n for n, count in Counter(numeros).items() if count > 1]
    
    if duplicados:
        print_error(f"❌ DUPLICADOS: {duplicados}")
        return False
    else:
        print_success("✅ Nenhum duplicado!")
        
        if len(sucessos) >= 18:  # Pelo menos 90% de sucesso
            print_success("✅ Taxa de sucesso adequada!")
            return True
        else:
            print_warning(f"⚠️  Taxa de sucesso baixa: {len(sucessos)}/20")
            return False


def teste_4_misto_normal_prioritaria():
    """Teste 4: Mix de normais e prioritárias simultâneas"""
    print_test("4. Mix: Normais e Prioritárias Simultâneas")
    
    app = create_app()
    
    with app.app_context():
        hoje = date.today()
        Senha.query.filter_by(data_emissao=hoje).delete()
        db.session.commit()
    
    print_info("10 threads normais + 5 threads prioritárias...")
    
    resultados = []
    threads = []
    
    # 10 normais
    for i in range(10):
        thread = threading.Thread(
            target=emitir_senha_thread,
            args=(app, 1, 'normal', resultados, i+1)
        )
        threads.append(thread)
    
    # 5 prioritárias
    for i in range(5):
        thread = threading.Thread(
            target=emitir_senha_thread,
            args=(app, 1, 'prioritaria', resultados, i+11)
        )
        threads.append(thread)
    
    inicio = time.time()
    for thread in threads:
        thread.start()
    
    for thread in threads:
        thread.join()
    
    tempo_total = (time.time() - inicio) * 1000
    print(f"\n   Tempo total: {tempo_total:.2f}ms")
    
    sucessos = [r for r in resultados if r['sucesso']]
    
    # Separar normais e prioritárias
    normais = [r['numero'] for r in sucessos if r['numero'] and r['numero'].startswith('N')]
    prioritarias = [r['numero'] for r in sucessos if r['numero'] and r['numero'].startswith('P')]
    
    print(f"\n   Normais criadas: {len(normais)}")
    print(f"   Prioritárias criadas: {len(prioritarias)}")
    
    # Verificar duplicados em cada tipo
    dup_normais = [n for n, count in Counter(normais).items() if count > 1]
    dup_prioritarias = [n for n, count in Counter(prioritarias).items() if count > 1]
    
    if dup_normais or dup_prioritarias:
        print_error(f"❌ DUPLICADOS!")
        if dup_normais:
            print_error(f"   Normais: {dup_normais}")
        if dup_prioritarias:
            print_error(f"   Prioritárias: {dup_prioritarias}")
        return False
    else:
        print_success("✅ Nenhum duplicado em normais ou prioritárias!")
        return True


def teste_5_stress():
    """Teste 5: Stress test (50 threads)"""
    print_test("5. Stress Test (50 threads)")
    
    app = create_app()
    
    with app.app_context():
        hoje = date.today()
        Senha.query.filter_by(data_emissao=hoje).delete()
        db.session.commit()
    
    print_info("Iniciando 50 threads simultâneas...")
    print_warning("Este teste pode demorar 5-10 segundos...")
    
    resultados = []
    threads = []
    
    for i in range(50):
        thread = threading.Thread(
            target=emitir_senha_thread,
            args=(app, 1, 'normal', resultados, i+1)
        )
        threads.append(thread)
    
    inicio = time.time()
    for thread in threads:
        thread.start()
    
    for thread in threads:
        thread.join()
    
    tempo_total = (time.time() - inicio) * 1000
    
    print(f"\n   Tempo total: {tempo_total:.2f}ms")
    print(f"   Tempo médio: {tempo_total/50:.2f}ms por thread")
    
    sucessos = [r for r in resultados if r['sucesso']]
    falhas = [r for r in resultados if not r['sucesso']]
    
    print(f"\n   Sucessos: {len(sucessos)}/50")
    print(f"   Falhas: {len(falhas)}/50")
    
    numeros = [r['numero'] for r in sucessos]
    duplicados = [n for n, count in Counter(numeros).items() if count > 1]
    
    if duplicados:
        print_error(f"❌ DUPLICADOS: {duplicados}")
        return False
    else:
        print_success("✅ ZERO duplicados em 50 threads!")
        
        taxa_sucesso = len(sucessos) / 50 * 100
        print(f"\n   Taxa de sucesso: {taxa_sucesso:.1f}%")
        
        if taxa_sucesso >= 80:
            print_success("✅ Sistema robusto!")
            return True
        else:
            print_warning("⚠️  Taxa de sucesso abaixo de 80%")
            return False


# ===== EXECUTAR TODOS OS TESTES =====

def executar_todos():
    """Executa todos os testes de concorrência"""
    
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}🧪 TESTES DE CONCORRÊNCIA - SISTEMA DE FILAS IMTSB{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}")
    
    testes = [
        ("Sequencial (Baseline)", teste_1_sequencial),
        ("Concorrência Leve (5 threads)", teste_2_concorrencia_leve),
        ("Concorrência Pesada (20 threads)", teste_3_concorrencia_pesada),
        ("Mix Normal/Prioritária", teste_4_misto_normal_prioritaria),
        ("Stress Test (50 threads)", teste_5_stress),
    ]
    
    resultados = []
    for nome, teste_func in testes:
        try:
            resultado = teste_func()
            resultados.append((nome, resultado))
        except Exception as e:
            print_error(f"Erro crítico no teste '{nome}': {e}")
            resultados.append((nome, False))
    
    # Resumo
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}📊 RESUMO DOS TESTES DE CONCORRÊNCIA{Colors.END}")
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
        print(f"{Colors.GREEN}Sistema protegido contra race conditions!{Colors.END}")
    else:
        print(f"{Colors.RED}{Colors.BOLD}❌ ALGUNS TESTES FALHARAM!{Colors.END}")
        print(f"{Colors.RED}Sistema pode ter problemas de concorrência.{Colors.END}")
    
    print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")
    
    return falhou == 0


if __name__ == "__main__":
    sucesso = executar_todos()
    sys.exit(0 if sucesso else 1)
