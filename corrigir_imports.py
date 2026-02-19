import os
import glob

print("🔍 BUSCANDO TODOS OS CONTROLLERS...\n")

# Encontrar TODOS os arquivos .py em app/controllers/
arquivos = glob.glob('app/controllers/*.py')

print(f"📁 Encontrados {len(arquivos)} arquivos:\n")
for arq in arquivos:
    print(f"   - {arq}")

print("\n🔧 CORRIGINDO IMPORTS...\n")

# Substituições
substituicoes = {
    'from app.schemas import LoginSchema': 'from app.schemas.auth_schema import LoginSchema',
    'from app.schemas import RegistrarAtendenteSchema': 'from app.schemas.auth_schema import RegistrarAtendenteSchema',
    'from app.schemas import SenhaSchema': 'from app.schemas.senha_schema import SenhaSchema',
    'from app.schemas import AtendenteSchema': 'from app.schemas.senha_schema import AtendenteSchema',
    'from app.schemas import ServicoSchema': 'from app.schemas.senha_schema import ServicoSchema',
    'from app.schemas import LoginSchema, RegistrarAtendenteSchema, AtendenteSchema': 
        'from app.schemas.auth_schema import LoginSchema, RegistrarAtendenteSchema\nfrom app.schemas.senha_schema import AtendenteSchema',
}

total_corrigido = 0

for arquivo in arquivos:
    try:
        with open(arquivo, 'r', encoding='utf-8') as f:
            conteudo = f.read()
        
        conteudo_original = conteudo
        corrigido = False
        
        for antigo, novo in substituicoes.items():
            if antigo in conteudo:
                conteudo = conteudo.replace(antigo, novo)
                print(f"✅ {os.path.basename(arquivo)}: Corrigido import")
                corrigido = True
        
        if conteudo != conteudo_original:
            with open(arquivo, 'w', encoding='utf-8') as f:
                f.write(conteudo)
            total_corrigido += 1
        elif corrigido:
            print(f"⏭️  {os.path.basename(arquivo)}: Já correto")
            
    except Exception as e:
        print(f"❌ Erro em {arquivo}: {e}")

print(f"\n✅ CONCLUÍDO! {total_corrigido} arquivos corrigidos!")
print("\n🧹 Limpando cache Python...")

# Limpar cache
import shutil
import pathlib

for p in pathlib.Path('.').rglob('__pycache__'):
    shutil.rmtree(p, ignore_errors=True)
    
print("✅ Cache limpo!")
print("\n🚀 Agora execute: python run.py")