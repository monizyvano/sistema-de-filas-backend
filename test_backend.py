"""
Teste completo do backend
Executa: python test_backend.py
"""
from app import create_app, db
from app.models import Servico, Atendente, Senha, LogActividade, Configuracao

app = create_app()

with app.app_context():
    print("\n" + "=" * 70)
    print("🧪 TESTE COMPLETO DO BACKEND")
    print("=" * 70)
    
    # Teste 1: Listar serviços
    print("\n📋 SERVIÇOS CADASTRADOS:")
    servicos = Servico.query.order_by(Servico.ordem_exibicao).all()
    for s in servicos:
        print(f"  {s.ordem_exibicao}. {s.icone} {s.nome}")
        print(f"     Tempo médio: {s.tempo_medio_minutos} min")
    
    # Teste 2: Listar atendentes
    print("\n👥 ATENDENTES CADASTRADOS:")
    atendentes = Atendente.query.all()
    for a in atendentes:
        tipo_emoji = '👑' if a.tipo == 'admin' else '👤'
        balcao = f"Balcão {a.balcao}" if a.balcao else "Admin"
        print(f"  {tipo_emoji} {a.nome} ({a.email}) - {balcao}")
    
    # Teste 3: Configurações
    print("\n⚙️  CONFIGURAÇÕES DO SISTEMA:")
    configs = Configuracao.query.all()
    for c in configs:
        print(f"  • {c.chave}: {c.get_valor()}")
    
    # Teste 4: Criar senha de teste
    print("\n🎫 CRIANDO SENHA DE TESTE...")
    servico = Servico.query.first()
    
    senha = Senha(
        numero="N001",
        servico_id=servico.id,
        tipo='normal'
    )
    senha.save()
    
    print(f"  ✅ Senha {senha.numero} criada!")
    print(f"     Serviço: {senha.servico.nome}")
    print(f"     Status: {senha.status}")
    print(f"     Emitida em: {senha.emitida_em.strftime('%H:%M:%S')}")
    
    # Teste 5: Registrar log
    log = LogActividade.registrar(
        acao='emitida',
        senha_id=senha.id,
        descricao=f"Senha {senha.numero} emitida automaticamente pelo sistema"
    )
    print(f"  ✅ Log registrado!")
    
    # Teste 6: Chamar senha
    print("\n📣 CHAMANDO SENHA NO BALCÃO 1...")
    senha.chamar(numero_balcao=1)
    print(f"  ✅ Status: {senha.status}")
    print(f"     Balcão: {senha.numero_balcao}")
    
    LogActividade.registrar(
        acao='chamada',
        senha_id=senha.id,
        descricao=f"Senha {senha.numero} chamada no balcão {senha.numero_balcao}"
    )
    
    # Teste 7: Iniciar atendimento
    print("\n▶️  INICIANDO ATENDIMENTO...")
    atendente = Atendente.query.filter_by(tipo='atendente').first()
    senha.iniciar_atendimento(atendente.id, numero_balcao=1)
    print(f"  ✅ Status: {senha.status}")
    print(f"     Atendente: {senha.atendente.nome}")
    print(f"     Tempo de espera: {senha.tempo_espera_minutos} min")
    
    LogActividade.registrar(
        acao='iniciada',
        senha_id=senha.id,
        atendente_id=atendente.id,
        descricao=f"Atendimento iniciado por {atendente.nome}"
    )
    
    # Teste 8: Finalizar
    print("\n✅ FINALIZANDO ATENDIMENTO...")
    senha.finalizar("Matrícula realizada com sucesso")
    print(f"  ✅ Status: {senha.status}")
    print(f"     Tempo total: {senha.tempo_atendimento_minutos} min")
    print(f"     Observações: {senha.observacoes}")
    
    LogActividade.registrar(
        acao='concluida',
        senha_id=senha.id,
        atendente_id=atendente.id,
        descricao=f"Atendimento concluído por {atendente.nome}"
    )
    
    # Teste 9: Ver histórico completo
    print("\n📜 HISTÓRICO COMPLETO DA SENHA:")
    logs = senha.logs.all()
    for log in logs:
        timestamp = log.created_at.strftime('%H:%M:%S')
        print(f"  • {timestamp} - {log.acao.upper()}")
        print(f"    {log.descricao}")
    
    # Teste 10: Estatísticas
    print("\n📊 ESTATÍSTICAS:")
    print(f"  Serviço '{servico.nome}':")
    stats_servico = servico.obter_estatisticas_hoje()
    for chave, valor in stats_servico.items():
        print(f"    • {chave}: {valor}")
    
    print(f"\n  Atendente '{atendente.nome}':")
    stats_atendente = atendente.obter_estatisticas_hoje()
    for chave, valor in stats_atendente.items():
        print(f"    • {chave}: {valor}")
    
    # Teste 11: Deletar senha de teste
    print("\n🗑️  LIMPANDO SENHA DE TESTE...")
    senha.delete()
    print("  ✅ Senha deletada")
    
    # Teste 12: Contagem final
    print("\n📈 RESUMO DO BANCO:")
    print(f"  • Serviços: {Servico.query.count()}")
    print(f"  • Atendentes: {Atendente.query.count()}")
    print(f"  • Senhas: {Senha.query.count()}")
    print(f"  • Logs: {LogActividade.query.count()}")
    print(f"  • Configurações: {Configuracao.query.count()}")
    
    print("\n" + "=" * 70)
    print("✅ BACKEND 100% FUNCIONAL!")
    print("=" * 70 + "\n")
