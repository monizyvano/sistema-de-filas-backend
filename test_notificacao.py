"""
Teste do NotificacaoService
"""
from app import create_app
from app.services.notificacao_service import NotificacaoService
from app.services.fila_service import FilaService
from app.models import Senha

app = create_app()

with app.app_context():
    try:
        # Obter senhas existentes na fila
        fila = FilaService.obter_fila(servico_id=1)
        
        if not fila:
            print("ERRO: Nenhuma senha na fila para testar")
        else:
            senha = fila[0]
            print(f"[TESTE] Testando com senha existente: {senha.numero}")
            
            # Adicionar contato ao usuário (simulando)
            senha.usuario_contato = "+244923456789"
            senha.save()
            print(f"[OK] Contato adicionado: {senha.usuario_contato}")
            
            # Testar notificação de chamada
            print("\n[TESTE] Notificacao de chamada...")
            resultado = NotificacaoService.notificar_senha_chamada(senha.id)
            print(f"[RESULTADO] {'Enviado OK' if resultado else 'Falhou'}")
            
            # Testar notificação de próximo atendimento
            print("\n[TESTE] Notificacao de proximo atendimento...")
            resultado = NotificacaoService.notificar_proximo_atendimento(senha.id)
            print(f"[RESULTADO] {'Enviado OK' if resultado else 'Nao notificado (nao esta nos proximos 3)'}")
            
            print("\n[SUCESSO] NOTIFICACAO SERVICE TESTADO COM SUCESSO!")
        
    except Exception as e:
        print(f'[ERRO] {e}')
        import traceback
        traceback.print_exc()
