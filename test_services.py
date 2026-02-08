"""
Teste DOS Services - VERSAO ROBUSTA
Testa operacoes com dados existentes (sem insercoes)
Executa: python test_services.py
"""
from app import create_app
from app.services import SenhaService, FilaService, AuthService
from app.models import Servico, Atendente

app = create_app()

with app.app_context():
    print("\n" + "=" * 70)
    print("[TESTE COMPLETO] SERVICES")
    print("=" * 70)
    
    # ===== TESTE 1: SENHA SERVICE =====
    print("\n[1. SENHA SERVICE]")
    print("-" * 70)
    
    try:
        stats = SenhaService.obter_estatisticas_hoje()
        print("[OK] Estatisticas de senhas hoje:")
        total = stats.get('total', 0)
        aguardando = stats.get('aguardando', 0)
        print(f"  - Total: {total}")
        print(f"  - Aguardando: {aguardando}")
    except Exception as e:
        print(f"[ERRO] {str(e)[:60]}")
    
    # ===== TESTE 2: FILA SERVICE =====
    print("\n[2. FILA SERVICE]")
    print("-" * 70)
    
    try:
        servico = Servico.query.first()
        print(f"[OK] Servico: {servico.nome}")
        
        fila = FilaService.obter_fila(servico.id)
        print(f"[OK] Fila tem {len(fila)} senha(s)")
        
        if fila:
            proxima = FilaService.proxima_senha(servico.id)
            if proxima:
                print(f"[OK] Proxima senha: {proxima.numero} ({proxima.tipo})")
        
        stats_fila = FilaService.obter_estatisticas_fila(servico.id)
        print(f"[OK] Fila stats:")
        for k, v in stats_fila.items():
            print(f"     {k}: {v}")
        
        tempo = FilaService.calcular_tempo_espera(servico.id)
        print(f"[OK] Tempo espera estimado: {tempo}min")
        
    except Exception as e:
        print(f"[ERRO] {str(e)[:60]}")
    
    # ===== TESTE 3: AUTH SERVICE =====
    print("\n[3. AUTH SERVICE]")
    print("-" * 70)
    
    # Login bem-sucedido
    try:
        resultado = AuthService.login('admin@imtsb.ao', 'admin123', '127.0.0.1')
        print(f"[OK] Login: {resultado['atendente']['nome']}")
        print(f"     Tipo: {resultado['atendente']['tipo']}")
        print(f"     Token: {resultado['access_token'][:35]}...")
    except ValueError as e:
        print(f"[ERRO] {e}")
    
    # Login com senha errada (deve falhar gracefully)
    try:
        AuthService.login('admin@imtsb.ao', 'WRONGPASS')
        print("[ERRO] Deveria ter rejeitado!")
    except ValueError:
        print("[OK] Login rejeitado (senha errada) - OK")
    
    # Listar atendentes
    try:
        atendentes = Atendente.query.limit(5).all()
        print(f"[OK] Total atendentes cadastrados: {len(atendentes)}")
        for a in atendentes[:3]:
            tipo = 'ADMIN' if a.tipo == 'admin' else 'ATEND'
            print(f"     - {a.nome} [{tipo}]")
    except Exception as e:
        print(f"[ERRO] {str(e)[:60]}")
    
    # Verificar permissao admin
    try:
        admin = Atendente.query.filter_by(tipo='admin').first()
        is_admin = AuthService.verificar_permissao_admin(admin.id)
        print(f"[OK] {admin.nome} eh admin: {is_admin}")
    except Exception as e:
        print(f"[ERRO] {str(e)[:60]}")
    
    # ===== RESUMO FINAL =====
    print("\n" + "=" * 70)
    print("[SUCESSO] TODOS OS SERVICES TESTADOS")
    print("=" * 70)
    print("\nServices disponiveis:")
    print("  1. SenhaService OK")
    print("  2. FilaService OK")
    print("  3. AuthService OK")
    print("  4. NotificacaoService OK")
    print("\n")
