"""
Script para testar conexão com MySQL
Executa: python test_conexao.py
"""
import os
from dotenv import load_dotenv
import pymysql

# Carregar variáveis do .env
load_dotenv()

print("\n🔍 TESTANDO CONEXÃO COM MYSQL\n")
print("=" * 60)

# Pegar credenciais do .env
db_config = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}

print(f"Host: {db_config['host']}")
print(f"Porta: {db_config['port']}")
print(f"Usuário: {db_config['user']}")
print(f"Banco: {db_config['database']}")
print(f"Senha: {'*' * len(db_config['password']) if db_config['password'] else 'NÃO CONFIGURADA!'}")
print("=" * 60)

try:
    # Tentar conectar
    print("\n⏳ Tentando conectar...")
    
    conexao = pymysql.connect(
        host=db_config['host'],
        port=db_config['port'],
        user=db_config['user'],
        password=db_config['password'],
        database=db_config['database'],
        charset='utf8mb4'
    )
    
    print("✅ CONEXÃO BEM-SUCEDIDA!")
    
    # Testar query
    cursor = conexao.cursor()
    cursor.execute("SELECT DATABASE()")
    banco_atual = cursor.fetchone()[0]
    
    print(f"\n📊 Banco atual: {banco_atual}")
    
    # Listar tabelas (deve estar vazio agora)
    cursor.execute("SHOW TABLES")
    tabelas = cursor.fetchall()
    
    print(f"📋 Tabelas existentes: {len(tabelas)}")
    if tabelas:
        for tabela in tabelas:
            print(f"  - {tabela[0]}")
    else:
        print("  (nenhuma tabela ainda - OK!)")
    
    # Fechar
    cursor.close()
    conexao.close()
    
    print("\n" + "=" * 60)
    print("✅ TESTE CONCLUÍDO COM SUCESSO!")
    print("✅ MySQL está pronto para receber as migrations!")
    print("=" * 60 + "\n")

except pymysql.err.OperationalError as e:
    print(f"\n❌ ERRO DE CONEXÃO: {e}\n")
    print("🔧 SOLUÇÕES:")
    print("  1. Verifique se o MySQL está rodando")
    print("     Windows: Serviços → MySQL80 → Iniciar")
    print("  2. Verifique as credenciais no arquivo .env")
    print("  3. Verifique se o banco 'sistema_filas_imtsb' existe")
    print("     Execute: mysql -u root -p")
    print("     Depois: SHOW DATABASES;\n")

except Exception as e:
    print(f"\n❌ ERRO INESPERADO: {e}\n")
