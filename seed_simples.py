"""
seed_simples.py — SPRINT 1 (actualizado)
═══════════════════════════════════════════════════════════════
ALTERAÇÕES:
  ✅ Atendentes criados com `servico_id` correcto por balcão.

USO:  python seed_simples.py
AVISO: Apaga dados existentes de senhas, logs e atendentes.
═══════════════════════════════════════════════════════════════
"""

from app import create_app, db
from app.models.servico import Servico
from app.models.atendente import Atendente

app = create_app()

with app.app_context():
    print("🌱 A popular banco de dados...")

    # Limpar na ordem certa (FK constraints)
    try:
        from app.models.senha import Senha
        from app.models.log_actividade import LogActividade
        LogActividade.query.delete()
        Senha.query.delete()
    except Exception as e:
        print(f"⚠️  Aviso: {e}")

    Atendente.query.delete()
    Servico.query.delete()
    db.session.commit()

    # Criar serviços
    print("📋 A criar serviços...")
    s1 = Servico(nome='Secretaria Académica', descricao='Matrículas e documentos',
                 icone='📄', ordem_exibicao=1)
    s2 = Servico(nome='Tesouraria',           descricao='Pagamentos e propinas',
                 icone='💰', ordem_exibicao=2)
    s3 = Servico(nome='Direcção Pedagógica',  descricao='Assuntos académicos',
                 icone='👔', ordem_exibicao=3)
    s4 = Servico(nome='Biblioteca',           descricao='Empréstimo de livros',
                 icone='📚', ordem_exibicao=4)

    for s in [s1, s2, s3, s4]:
        db.session.add(s)

    db.session.flush()  # gera IDs sem commit

    # Criar atendentes com servico_id correcto
    print("👤 A criar atendentes...")
    atendentes = [
        Atendente(nome='Administrador Sistema', email='admin@imtsb.ao',
                  senha='admin123', tipo='admin',
                  balcao=None, servico_id=None),
        Atendente(nome='Maria Silva',   email='maria@imtsb.ao',
                  senha='senha123', tipo='atendente',
                  balcao=1, servico_id=s1.id),
        Atendente(nome='João Santos',   email='joao@imtsb.ao',
                  senha='senha123', tipo='atendente',
                  balcao=2, servico_id=s2.id),
        Atendente(nome='Ana Costa',     email='ana@imtsb.ao',
                  senha='senha123', tipo='atendente',
                  balcao=3, servico_id=s3.id),
        Atendente(nome='Carlos Lopes',  email='carlos@imtsb.ao',
                  senha='senha123', tipo='atendente',
                  balcao=4, servico_id=s4.id),
    ]

    for a in atendentes:
        db.session.add(a)

    db.session.commit()

    print(f"\n✅ Serviços: {Servico.query.count()}")
    for s in Servico.query.all():
        print(f"   {s.icone} [{s.id}] {s.nome}")

    print(f"\n✅ Atendentes: {Atendente.query.count()}")
    for a in Atendente.query.all():
        srv = f"serviço {a.servico_id}" if a.servico_id else "todos"
        print(f"   👤 {a.nome} | balcão={a.balcao} | {srv}")

    print("\n🎉 Banco populado!")
    print("  admin@imtsb.ao   / admin123")
    print("  maria@imtsb.ao   / senha123  (Secretaria — balcão 1)")
    print("  joao@imtsb.ao    / senha123  (Tesouraria — balcão 2)")
    print("  ana@imtsb.ao     / senha123  (Dir. Pedagógica — balcão 3)")
    print("  carlos@imtsb.ao  / senha123  (Biblioteca — balcão 4)")
