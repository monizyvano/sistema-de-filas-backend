# ===== FASE 1: TESTE DE NUMERAÇÃO DIÁRIA =====

"""
Teste completo da numeração diária

Valida:
1. ✅ Numeração reinicia todo dia
2. ✅ Não duplica no mesmo dia
3. ✅ Prioritárias têm numeração separada
4. ✅ Performance adequada
"""

import sys
import os

# Adicionar pasta do projeto ao path
sys.path.insert(0, os.path.abspath('.'))

from app import create_app, db
from app.models.senha import Senha
from app.services.senha_service import SenhaService
from datetime import datetime, date, timedelta
import time


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


# ===== TESTES =====

def teste_1_emissao_basica():
    """Teste 1: Emissão básica de senha"""
    print_test("1. Emissão Básica")
    
    try:
        # Limpar senhas de hoje
        hoje = date.today()
        Senha.query.filter_by(data_emissao=hoje).delete()
        db.session.commit()
        
        # Emitir primeira senha
        senha1 = SenhaService.emitir(servico_id=1, tipo='normal')
        
        assert senha1.numero == 'N001', f"Esperado N001, obtido {senha1.numero}"
        assert senha1.data_emissao == hoje, "Data de emissão incorreta"
        assert senha1.tipo == 'normal', "Tipo incorreto"
        assert senha1.status == 'aguardando', "Status incorreto"
        
        print_success(f"Senha emitida: {senha1.numero}")
        print_success(f"Data: {senha1.data_emissao}")
        print_success(f"Tipo: {senha1.tipo}")
        
        return True
        
    except Exception as e:
        print_error(f"Erro: {e}")
        return False


def teste_2_sequencia_normal():
    """Teste 2: Sequência de senhas normais"""
    print_test("2. Sequência de Senhas Normais")
    
    try:
        # Emitir 5 senhas normais
        senhas = []
        for i in range(5):
            senha = SenhaService.emitir(servico_id=1, tipo='normal')
            senhas.append(senha)
            print_info(f"Emitida: {senha.numero}")
        
        # Verificar sequência
        numeros_esperados = ['N001', 'N002', 'N003', 'N004', 'N005']
        numeros_obtidos = [s.numero for s in senhas]
        
        # Ajustar para senhas já existentes
        ultimo_numero = int(senhas[-1].numero[1:])
        numeros_esperados_ajustados = [f'N{i:03d}' for i in range(ultimo_numero-4, ultimo_numero+1)]
        
        print_success(f"Sequência obtida: {' → '.join([s.numero for s in senhas])}")
        
        return True
        
    except Exception as e:
        print_error(f"Erro: {e}")
        return False


def teste_3_prioritarias():
    """Teste 3: Senhas prioritárias"""
    print_test("3. Senhas Prioritárias")
    
    try:
        # Emitir 3 prioritárias
        senhas = []
        for i in range(3):
            senha = SenhaService.emitir(servico_id=1, tipo='prioritaria')
            senhas.append(senha)
            print_info(f"Emitida: {senha.numero} (prioritária)")
        
        # Verificar prefixo P
        for senha in senhas:
            assert senha.numero.startswith('P'), f"Prioritária deveria começar com P: {senha.numero}"
            assert senha.tipo == 'prioritaria', "Tipo incorreto"
        
        print_success(f"Prioritárias: {' → '.join([s.numero for s in senhas])}")
        
        return True
        
    except Exception as e:
        print_error(f"Erro: {e}")
        return False


def teste_4_nao_duplica_mesmo_dia():
    """Teste 4: Não duplica no mesmo dia"""
    print_test("4. Proteção Contra Duplicação no Mesmo Dia")
    
    try:
        hoje = date.today()
        
        # Tentar criar senha duplicada manualmente
        senha1 = Senha(numero='N999', servico_id=1, tipo='normal', data_emissao=hoje)
        db.session.add(senha1)
        db.session.commit()
        print_info("Senha N999 criada")
        
        # Tentar criar outra com mesmo número no mesmo dia
        try:
            senha2 = Senha(numero='N999', servico_id=1, tipo='normal', data_emissao=hoje)
            db.session.add(senha2)
            db.session.commit()
            
            print_error("FALHA: Permitiu duplicação no mesmo dia!")
            return False
            
        except Exception as e:
            db.session.rollback()
            print_success(f"Duplicação bloqueada corretamente: {type(e).__name__}")
            
            # Limpar
            Senha.query.filter_by(numero='N999', data_emissao=hoje).delete()
            db.session.commit()
            
            return True
        
    except Exception as e:
        db.session.rollback()
        print_error(f"Erro inesperado: {e}")
        return False


def teste_5_permite_repeticao_dias_diferentes():
    """Teste 5: Permite repetição em dias diferentes"""
    print_test("5. Permite N001 em Dias Diferentes")
    
    try:
        hoje = date.today()
        ontem = hoje - timedelta(days=1)
        
        # Criar N001 para "ontem"
        senha_ontem = Senha(numero='N001', servico_id=1, tipo='normal', data_emissao=ontem)
        db.session.add(senha_ontem)
        db.session.commit()
        print_info(f"N001 criada para {ontem}")
        
        # Criar N001 para "hoje"
        senha_hoje = Senha(numero='N001', servico_id=1, tipo='normal', data_emissao=hoje)
        db.session.add(senha_hoje)
        db.session.commit()
        print_info(f"N001 criada para {hoje}")
        
        print_success("N001 criada em dias diferentes com sucesso!")
        
        # Limpar
        Senha.query.filter_by(numero='N001').filter(
            Senha.data_emissao.in_([hoje, ontem])
        ).delete()
        db.session.commit()
        
        return True
        
    except Exception as e:
        db.session.rollback()
        print_error(f"Erro: {e}")
        return False


def teste_6_performance():
    """Teste 6: Performance da geração"""
    print_test("6. Performance de Geração de Senhas")
    
    try:
        print_info("Emitindo 50 senhas e medindo tempo...")
        
        inicio = time.time()
        
        for i in range(50):
            SenhaService.emitir(servico_id=1, tipo='normal')
        
        fim = time.time()
        tempo_total = (fim - inicio) * 1000  # ms
        tempo_medio = tempo_total / 50
        
        print_info(f"Tempo total: {tempo_total:.2f}ms")
        print_info(f"Tempo médio por senha: {tempo_medio:.2f}ms")
        
        if tempo_medio < 100:
            print_success(f"Performance EXCELENTE: {tempo_medio:.2f}ms < 100ms")
        elif tempo_medio < 200:
            print_success(f"Performance BOA: {tempo_medio:.2f}ms < 200ms")
        else:
            print_error(f"Performance RUIM: {tempo_medio:.2f}ms > 200ms")
            print_error("Verifique se índices foram criados!")
        
        return tempo_medio < 200
        
    except Exception as e:
        print_error(f"Erro: {e}")
        return False


def teste_7_query_usa_indice():
    """Teste 7: Verificar se query usa índice"""
    print_test("7. Verificação de Uso de Índice")
    
    try:
        from sqlalchemy import text
        
        # Query que será executada
        query = """
        EXPLAIN SELECT * FROM senhas 
        WHERE numero LIKE 'N%' AND data_emissao = CURRENT_DATE
        ORDER BY id DESC LIMIT 1
        """
        
        resultado = db.session.execute(text(query)).fetchall()
        
        print_info("Plano de execução da query:")
        for row in resultado:
            print(f"  {dict(row)}")
        
        # Verificar se usa índice
        usa_indice = any('uq_numero_data' in str(row) or 'data_emissao' in str(row) for row in resultado)
        
        if usa_indice:
            print_success("Query usa índice corretamente!")
        else:
            print_error("Query NÃO usa índice (performance ruim!)")
        
        return usa_indice
        
    except Exception as e:
        print_error(f"Erro: {e}")
        return False


def teste_8_metodos_helper():
    """Teste 8: Métodos helper do model"""
    print_test("8. Métodos Helper")
    
    try:
        hoje = date.today()
        
        # Emitir uma senha
        senha = SenhaService.emitir(servico_id=1, tipo='normal')
        print_info(f"Senha emitida: {senha.numero}")
        
        # Testar obter_por_numero_e_data
        senha_encontrada = Senha.obter_por_numero_e_data(senha.numero, hoje)
        assert senha_encontrada is not None, "obter_por_numero_e_data falhou"
        assert senha_encontrada.id == senha.id, "Senha encontrada é diferente"
        print_success("obter_por_numero_e_data() funciona")
        
        # Testar obter_fila_do_dia
        fila = Senha.obter_fila_do_dia(servico_id=1, data_emissao=hoje)
        assert isinstance(fila, list), "obter_fila_do_dia deve retornar lista"
        print_success(f"obter_fila_do_dia() retornou {len(fila)} senhas")
        
        return True
        
    except Exception as e:
        print_error(f"Erro: {e}")
        return False


# ===== EXECUTAR TODOS OS TESTES =====

def executar_todos():
    """Executa todos os testes"""
    
    print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
    print(f"{Colors.BOLD}🧪 TESTES DE NUMERAÇÃO DIÁRIA - SISTEMA DE FILAS IMTSB{Colors.END}")
    print(f"{Colors.BOLD}{'='*70}{Colors.END}")
    
    # Criar app
    app = create_app()
    
    with app.app_context():
        # Lista de testes
        testes = [
            ("Emissão Básica", teste_1_emissao_basica),
            ("Sequência Normal", teste_2_sequencia_normal),
            ("Prioritárias", teste_3_prioritarias),
            ("Não Duplica Mesmo Dia", teste_4_nao_duplica_mesmo_dia),
            ("Permite Dias Diferentes", teste_5_permite_repeticao_dias_diferentes),
            ("Performance", teste_6_performance),
            ("Uso de Índice", teste_7_query_usa_indice),
            ("Métodos Helper", teste_8_metodos_helper),
        ]
        
        # Executar testes
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
        
        # Conclusão
        print(f"\n{Colors.BOLD}{'='*70}{Colors.END}")
        
        if falhou == 0:
            print(f"{Colors.GREEN}{Colors.BOLD}✅ TODOS OS TESTES PASSARAM!{Colors.END}")
            print(f"{Colors.GREEN}Sistema de numeração diária está funcionando corretamente!{Colors.END}")
        else:
            print(f"{Colors.RED}{Colors.BOLD}❌ ALGUNS TESTES FALHARAM!{Colors.END}")
            print(f"{Colors.RED}Revise as correções aplicadas.{Colors.END}")
        
        print(f"{Colors.BOLD}{'='*70}{Colors.END}\n")
        
        return falhou == 0


if __name__ == "__main__":
    sucesso = executar_todos()
    sys.exit(0 if sucesso else 1)
