"""
Script de Inicialização do Sistema
run.py - CORRIGIDO COM DOTENV
"""

# ✅ Carregar .env ANTES de tudo
from dotenv import load_dotenv
load_dotenv()

import os
import sys
from app import create_app, db
from app.extensions import socketio

# Criar aplicação
app = create_app()


@app.cli.command()
def init_db():
    """Inicializa banco de dados"""
    print("🔧 Criando tabelas...")
    db.create_all()
    print("✅ Tabelas criadas!")


@app.cli.command()
def seed_db():
    """Popula banco com dados iniciais"""
    from app.utils.seeders import run_seeders
    
    print("🌱 Populando banco de dados...")
    run_seeders()
    print("✅ Dados inseridos!")


@app.cli.command()
def reset_db():
    """CUIDADO: Apaga e recria todas as tabelas"""
    resposta = input("⚠️  Isso apagará TODOS os dados. Continuar? (yes/no): ")
    
    if resposta.lower() == 'yes':
        print("🗑️  Dropando tabelas...")
        db.drop_all()
        
        print("🔧 Criando tabelas...")
        db.create_all()
        
        print("🌱 Populando dados iniciais...")
        from app.utils.seeders import run_seeders
        run_seeders()
        
        print("✅ Banco resetado com sucesso!")
    else:
        print("❌ Operação cancelada")


@app.shell_context_processor
def make_shell_context():
    """Contexto para flask shell"""
    from app.models import Senha, Servico, Atendente, LogActividade, Configuracao
    
    return {
        'db': db,
        'Senha': Senha,
        'Servico': Servico,
        'Atendente': Atendente,
        'LogActividade': LogActividade,
        'Configuracao': Configuracao
    }


if __name__ == '__main__':
    # Verificar se banco está acessível
    with app.app_context():
        try:
            db.engine.connect()
            print("✅ Conexão com banco OK")
        except Exception as e:
            print(f"❌ Erro ao conectar no banco: {e}")
            print("\nVerifique:")
            print("1. MySQL está rodando?")
            print("2. Banco 'sistema_filas_imtsb' existe?")
            print("3. Credenciais em .env estão corretas?")
            print(f"4. DB_PASSWORD no .env: {os.getenv('DB_PASSWORD', 'NÃO DEFINIDA')}")
            sys.exit(1)

    # Iniciar servidor
    print("\n" + "="*60)
    print("🚀 Sistema de Filas IMTSB")
    print("="*60)
    print(f"📍 URL: http://localhost:5000")
    print(f"📚 Docs: http://localhost:5000/docs")
    print(f"🔧 Modo: {app.config['ENV']}")
    print(f"🔑 DB User: {os.getenv('DB_USER')}")
    print(f"🔑 DB Pass: {'*' * len(os.getenv('DB_PASSWORD', ''))}")
    print("="*60 + "\n")
    
    # Usar socketio.run para suportar WebSocket
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=app.config['DEBUG'],
        use_reloader=app.config['DEBUG']
    )