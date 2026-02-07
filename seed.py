"""
Script para popular banco de dados
Executa: python seed.py
"""
from app import create_app, db
from app.utils.seeders import run_seeders

# Criar app
app = create_app()

# Executar seeders dentro do contexto
with app.app_context():
    run_seeders()
