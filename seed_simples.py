from app import create_app, db
from app.models.servico import Servico
from app.models.atendente import Atendente

app = create_app()

with app.app_context():
    print("🌱 Populando banco...")
    
    # Limpar dados antigos
    Servico.query.delete()
    Atendente.query.delete()
    db.session.commit()
    
    # Criar serviços
    servicos = [
        Servico(nome='Secretaria Académica', descricao='Matrículas e documentos', icone='📄', ordem_exibicao=1),
        Servico(nome='Tesouraria', descricao='Pagamentos', icone='💰', ordem_exibicao=2),
        Servico(nome='Direcção Pedagógica', descricao='Assuntos académicos', icone='👔', ordem_exibicao=3),
        Servico(nome='Biblioteca', descricao='Empréstimo de livros', icone='📚', ordem_exibicao=4),
    ]
    
    for s in servicos:
        db.session.add(s)
    
    # Criar atendentes
    atendentes = [
        Atendente(nome='Administrador Sistema', email='admin@imtsb.ao', senha='admin123', tipo='admin'),
        Atendente(nome='Maria Silva', email='maria@imtsb.ao', senha='senha123', tipo='atendente', balcao=1),
        Atendente(nome='João Santos', email='joao@imtsb.ao', senha='senha123', tipo='atendente', balcao=2),
        Atendente(nome='Ana Costa', email='ana@imtsb.ao', senha='senha123', tipo='atendente', balcao=3),
    ]
    
    for a in atendentes:
        db.session.add(a)
    
    db.session.commit()
    
    print("✅ Serviços criados:", Servico.query.count())
    print("✅ Atendentes criados:", Atendente.query.count())
    print("✅ Banco populado com sucesso!")