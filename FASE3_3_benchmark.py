# ===== FASE 3.3: BENCHMARK DE PERFORMANCE =====

"""
Benchmark completo do sistema

Testa:
- Tempo de resposta de cada endpoint
- Performance com/sem cache
- Performance com/sem índices
- Escalabilidade
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from app import create_app, db
from app.services.senha_service import SenhaService
from app.models.senha import Senha
from datetime import datetime, date
import time
import statistics


# ===== HELPERS =====

def medir_tempo(func, *args, **kwargs):
    """Mede tempo de execução de uma função"""
    inicio = time.time()
    resultado = func(*args, **kwargs)
    fim = time.time()
    tempo_ms = (fim - inicio) * 1000
    return resultado, tempo_ms


def executar_n_vezes(func, n=10, *args, **kwargs):
    """Executa função N vezes e retorna estatísticas"""
    tempos = []
    
    for _ in range(n):
        _, tempo = medir_tempo(func, *args, **kwargs)
        tempos.append(tempo)
    
    return {
        'execucoes': n,
        'media': statistics.mean(tempos),
        'mediana': statistics.median(tempos),
        'min': min(tempos),
        'max': max(tempos),
        'std_dev': statistics.stdev(tempos) if n > 1 else 0
    }


# ===== BENCHMARKS =====

def benchmark_emissao_senha(app):
    """Benchmark: Emissão de senha"""
    print("\n" + "="*70)
    print("BENCHMARK 1: EMISSÃO DE SENHA")
    print("="*70 + "\n")
    
    with app.app_context():
        # Limpar senhas de teste
        hoje = date.today()
        Senha.query.filter_by(data_emissao=hoje).delete()
        db.session.commit()
        
        print("Emitindo 100 senhas e medindo tempo...\n")
        
        stats = executar_n_vezes(
            lambda: SenhaService.emitir(servico_id=1, tipo='normal'),
            n=100
        )
        
        print(f"📊 Resultados (100 emissões):")
        print(f"   Média:   {stats['media']:.2f}ms")
        print(f"   Mediana: {stats['mediana']:.2f}ms")
        print(f"   Mínimo:  {stats['min']:.2f}ms")
        print(f"   Máximo:  {stats['max']:.2f}ms")
        print(f"   Desvio:  {stats['std_dev']:.2f}ms")
        
        # Avaliação
        if stats['media'] < 50:
            print(f"\n✅ EXCELENTE! Média < 50ms")
        elif stats['media'] < 100:
            print(f"\n✅ BOM! Média < 100ms")
        elif stats['media'] < 200:
            print(f"\n⚠️  ACEITÁVEL. Média < 200ms")
        else:
            print(f"\n❌ LENTO! Média > 200ms - otimizar!")
        
        return stats


def benchmark_estatisticas(app):
    """Benchmark: Estatísticas do dia"""
    print("\n" + "="*70)
    print("BENCHMARK 2: ESTATÍSTICAS DO DIA")
    print("="*70 + "\n")
    
    with app.app_context():
        print("Buscando estatísticas 50 vezes...\n")
        
        stats = executar_n_vezes(
            lambda: SenhaService.obter_estatisticas_hoje(),
            n=50
        )
        
        print(f"📊 Resultados (50 buscas):")
        print(f"   Média:   {stats['media']:.2f}ms")
        print(f"   Mediana: {stats['mediana']:.2f}ms")
        print(f"   Mínimo:  {stats['min']:.2f}ms")
        print(f"   Máximo:  {stats['max']:.2f}ms")
        
        # Avaliação
        if stats['media'] < 10:
            print(f"\n✅ EXCELENTE! Cache funcionando! Média < 10ms")
        elif stats['media'] < 50:
            print(f"\n✅ BOM! Média < 50ms")
        else:
            print(f"\n⚠️  Verificar cache e índices")
        
        return stats


def benchmark_fila(app):
    """Benchmark: Buscar fila"""
    print("\n" + "="*70)
    print("BENCHMARK 3: BUSCAR FILA")
    print("="*70 + "\n")
    
    with app.app_context():
        print("Buscando fila 50 vezes...\n")
        
        stats = executar_n_vezes(
            lambda: SenhaService.obter_fila(servico_id=1),
            n=50
        )
        
        print(f"📊 Resultados (50 buscas):")
        print(f"   Média:   {stats['media']:.2f}ms")
        print(f"   Mediana: {stats['mediana']:.2f}ms")
        print(f"   Mínimo:  {stats['min']:.2f}ms")
        print(f"   Máximo:  {stats['max']:.2f}ms")
        
        # Avaliação
        if stats['media'] < 20:
            print(f"\n✅ EXCELENTE! Média < 20ms")
        elif stats['media'] < 50:
            print(f"\n✅ BOM! Média < 50ms")
        else:
            print(f"\n⚠️  Verificar índices compostos")
        
        return stats


def benchmark_query_ultimo_numero(app):
    """Benchmark: Query de último número"""
    print("\n" + "="*70)
    print("BENCHMARK 4: QUERY ÚLTIMO NÚMERO (CRÍTICA)")
    print("="*70 + "\n")
    
    with app.app_context():
        hoje = date.today()
        
        print("Buscando último número 100 vezes...\n")
        
        def buscar_ultimo():
            return Senha.query.filter(
                Senha.numero.like('N%'),
                Senha.data_emissao == hoje
            ).order_by(Senha.id.desc()).first()
        
        stats = executar_n_vezes(buscar_ultimo, n=100)
        
        print(f"📊 Resultados (100 buscas):")
        print(f"   Média:   {stats['media']:.2f}ms")
        print(f"   Mediana: {stats['mediana']:.2f}ms")
        print(f"   Mínimo:  {stats['min']:.2f}ms")
        print(f"   Máximo:  {stats['max']:.2f}ms")
        
        # Avaliação
        if stats['media'] < 5:
            print(f"\n✅ PERFEITO! Índice uq_numero_data funcionando! < 5ms")
        elif stats['media'] < 10:
            print(f"\n✅ EXCELENTE! < 10ms")
        elif stats['media'] < 50:
            print(f"\n✅ BOM! < 50ms")
        else:
            print(f"\n❌ LENTO! Verificar índices!")
        
        return stats


def benchmark_escalabilidade(app):
    """Benchmark: Teste com muitos dados"""
    print("\n" + "="*70)
    print("BENCHMARK 5: ESCALABILIDADE (1000 senhas)")
    print("="*70 + "\n")
    
    with app.app_context():
        hoje = date.today()
        
        # Contar senhas existentes
        total_antes = Senha.query.filter_by(data_emissao=hoje).count()
        print(f"Senhas no banco antes: {total_antes}")
        
        # Emitir 1000 senhas
        print("\nEmitindo 1000 senhas...")
        inicio = time.time()
        
        for i in range(1000):
            SenhaService.emitir(servico_id=1, tipo='normal')
            if (i + 1) % 100 == 0:
                print(f"  {i + 1}/1000...")
        
        fim = time.time()
        tempo_total = (fim - inicio) * 1000
        tempo_medio = tempo_total / 1000
        
        print(f"\n📊 Resultados:")
        print(f"   Tempo total: {tempo_total:.2f}ms ({tempo_total/1000:.2f}s)")
        print(f"   Tempo médio: {tempo_medio:.2f}ms por senha")
        print(f"   Taxa: {1000 / (tempo_total/1000):.0f} senhas/segundo")
        
        # Testar query com muitos dados
        print("\nTestando queries com 1000+ senhas no banco...\n")
        
        stats_fila = executar_n_vezes(
            lambda: SenhaService.obter_fila(servico_id=1),
            n=20
        )
        
        print(f"   Buscar fila: {stats_fila['media']:.2f}ms")
        
        stats_stats = executar_n_vezes(
            lambda: SenhaService.obter_estatisticas_hoje(),
            n=20
        )
        
        print(f"   Estatísticas: {stats_stats['media']:.2f}ms")
        
        # Avaliação
        if stats_fila['media'] < 50 and stats_stats['media'] < 50:
            print(f"\n✅ EXCELENTE! Sistema escala bem com muitos dados!")
        else:
            print(f"\n⚠️  Performance degradou com muitos dados")
        
        return {
            'tempo_total': tempo_total,
            'tempo_medio': tempo_medio,
            'fila': stats_fila['media'],
            'estatisticas': stats_stats['media']
        }


# ===== EXECUTAR TODOS =====

def executar_todos_benchmarks():
    """Executa todos os benchmarks"""
    print("\n" + "="*70)
    print("🏁 BENCHMARK COMPLETO DO SISTEMA - FASE 3")
    print("="*70)
    
    app = create_app()
    
    resultados = {}
    
    try:
        resultados['emissao'] = benchmark_emissao_senha(app)
        resultados['estatisticas'] = benchmark_estatisticas(app)
        resultados['fila'] = benchmark_fila(app)
        resultados['ultimo_numero'] = benchmark_query_ultimo_numero(app)
        resultados['escalabilidade'] = benchmark_escalabilidade(app)
        
    except Exception as e:
        print(f"\n❌ Erro durante benchmark: {e}")
        import traceback
        traceback.print_exc()
    
    # Resumo final
    print("\n" + "="*70)
    print("📊 RESUMO FINAL")
    print("="*70 + "\n")
    
    if 'emissao' in resultados:
        print(f"Emissão de senha:     {resultados['emissao']['media']:.2f}ms")
    if 'estatisticas' in resultados:
        print(f"Estatísticas:         {resultados['estatisticas']['media']:.2f}ms")
    if 'fila' in resultados:
        print(f"Buscar fila:          {resultados['fila']['media']:.2f}ms")
    if 'ultimo_numero' in resultados:
        print(f"Último número:        {resultados['ultimo_numero']['media']:.2f}ms")
    
    if 'escalabilidade' in resultados:
        esc = resultados['escalabilidade']
        print(f"\nEscalabilidade (1000 senhas):")
        print(f"  Tempo médio emissão: {esc['tempo_medio']:.2f}ms")
        print(f"  Buscar fila:         {esc['fila']:.2f}ms")
        print(f"  Estatísticas:        {esc['estatisticas']:.2f}ms")
    
    # Avaliação geral
    print("\n" + "="*70)
    
    if (resultados.get('emissao', {}).get('media', 999) < 100 and
        resultados.get('fila', {}).get('media', 999) < 50):
        print("✅ SISTEMA PERFORMÁTICO!")
        print("   Pronto para produção!")
    else:
        print("⚠️  SISTEMA PRECISA DE OTIMIZAÇÃO")
        print("   Revise índices e cache")
    
    print("="*70 + "\n")
    
    return resultados


if __name__ == "__main__":
    executar_todos_benchmarks()
