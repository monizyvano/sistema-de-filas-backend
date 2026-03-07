"""
Script para corrigir senhas no banco
fix_passwords.py
"""

from app import create_app, db
from app.models import Atendente
from flask_bcrypt import Bcrypt

app = create_app()
bcrypt = Bcrypt(app)

with app.app_context():
    # Senha correta
    senha_correta = "Admin123"
    
    # Gerar hash
    hash_correto = bcrypt.generate_password_hash(senha_correta).decode('utf-8')
    
    print(f"🔑 Hash gerado: {hash_correto}")
    
    # Atualizar todos os atendentes
    atendentes = Atendente.query.all()
    
    for atendente in atendentes:
        atendente.senha_hash = hash_correto
        print(f"✅ Atualizado: {atendente.email}")
    
    db.session.commit()
    
    print("\n✅ Todas as senhas atualizadas!")
    print(f"📧 Emails: admin@imtsb.ao, joao@imtsb.ao, maria@imtsb.ao, paulo@imtsb.ao")
    print(f"🔐 Senha: Admin123")
    
    # Testar login
    print("\n🧪 Testando login do admin...")
    admin = Atendente.query.filter_by(email='admin@imtsb.ao').first()
    
    if admin.verificar_senha(senha_correta):
        print("✅ TESTE PASSOU! Senha está correta!")
    else:
        print("❌ TESTE FALHOU! Algo ainda está errado.")