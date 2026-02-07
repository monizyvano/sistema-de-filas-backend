"""
Script para criar banco de dados e aplicar migrations
Execute: python setup_db.py
"""
import os
from app import create_app, db
from app.models import (
    BaseModel, Servico, Senha, Atendente, 
    LogActividade, Configuracao
)

def setup_database():
    """Cria as tabelas e dados iniciais"""
    
    app = create_app('development')
    
    with app.app_context():
        print("🔄 Criando tabelas...")
        db.create_all()
        print("✅ Tabelas criadas com sucesso!")
        
        print("\n📝 Adicionando configurações padrão...")
        
        # Configurações padrão
        configs_padrao = [
            ('horario_abertura', '08:00', 'string', 'Horário de abertura'),
            ('horario_fechamento', '16:00', 'string', 'Horário de fechamento'),
            ('tempo_medio_atendimento', '10', 'int', 'Tempo médio em minutos'),
            ('permite_senha_prioritaria', 'true', 'boolean', 'Habilita senhas prioritárias'),
            ('numero_balcoes', '4', 'int', 'Quantidade de balcões'),
        ]
        
        for chave, valor, tipo, descricao in configs_padrao:
            config = Configuracao.query.filter_by(chave=chave).first()
            if not config:
                config = Configuracao(chave, valor, tipo, descricao)
                db.session.add(config)
                print(f"  ✓ Adicionado: {chave}")
        
        db.session.commit()
        print("\n✅ Banco de dados configurado com sucesso!")

if __name__ == '__main__':
    try:
        setup_database()
    except Exception as e:
        print(f"❌ Erro: {e}")
        print("\n⚠️  Certifique-se de que:")
        print("  1. MySQL está instalado e em execução")
        print("  2. Banco 'sistema_filas_imtsb' foi criado")
        print("  3. Variáveis de ambiente em .env estão corretas")
