"""
Script para executar seeders e popular banco de dados
Executa: python run_seeders.py
"""
from app import create_app, db
from app.utils.seeders import run_seeders

if __name__ == '__main__':
    app = create_app('development')
    
    with app.app_context():
        print("\n✅ Conectado ao MySQL: sistema_filas_imtsb\n")
        
        # Listar tabelas criadas
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tabelas = inspector.get_table_names()
        
        print(f"📊 TABELAS NO BANCO ({len(tabelas)} total):")
        print("=" * 60)
        for tabela in sorted(tabelas):
            print(f"  ✓ {tabela}")
        print("=" * 60)
        
        # Executar seeders
        try:
            run_seeders()
        except Exception as e:
            print(f"\n❌ Erro ao executar seeders: {e}")
            import traceback
            traceback.print_exc()
