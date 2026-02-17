from app import create_app, db
from app.services.senha_service import SenhaService

app = create_app()

with app.app_context():
    print("\n🧪 TESTE RÁPIDO DE NUMERAÇÃO DIÁRIA\n")
    
    # Verificar se tem serviços
    from app.models.servico import Servico
    servicos = Servico.query.all()
    print(f"✅ Serviços no banco: {len(servicos)}")
    for s in servicos:
        print(f"   - ID {s.id}: {s.nome}")
    
    if len(servicos) == 0:
        print("❌ Nenhum serviço encontrado! Execute: python seed_simples.py")
        exit(1)
    
    print("\n📋 TESTE 1: Emitir 5 senhas normais")
    for i in range(5):
        senha = SenhaService.emitir(servico_id=1, tipo='normal')
        print(f"   ✅ {senha.numero} - {senha.data_emissao}")
    
    print("\n📋 TESTE 2: Emitir 3 senhas prioritárias")
    for i in range(3):
        senha = SenhaService.emitir(servico_id=1, tipo='prioritaria')
        print(f"   ⭐ {senha.numero} - {senha.data_emissao}")
    
    print("\n📋 TESTE 3: Ver todas as senhas criadas")
    from app.models.senha import Senha
    senhas = Senha.query.filter_by(data_emissao=senha.data_emissao).all()
    print(f"   Total de senhas hoje: {len(senhas)}")
    for s in senhas:
        print(f"   {s.numero} ({s.tipo}) - {s.status}")
    
    print("\n✅ TESTE COMPLETO! Sistema funcionando!")