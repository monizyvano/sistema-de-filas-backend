"""
CONVERTER ENCODING - UTF-8
Localização: converter_utf8.py (raiz do projeto)

Converte todos arquivos HTML de ISO-8859-1/Windows-1252 para UTF-8
"""

import os
import glob

def convert_to_utf8(file_path):
    """Converte arquivo para UTF-8"""
    
    # Tentar diferentes encodings
    encodings = ['iso-8859-1', 'windows-1252', 'latin1', 'cp1252']
    
    for encoding in encodings:
        try:
            # Ler com encoding antigo
            with open(file_path, 'r', encoding=encoding) as f:
                content = f.read()
            
            # Salvar em UTF-8
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f'✅ Convertido: {file_path} ({encoding} → UTF-8)')
            return True
            
        except UnicodeDecodeError:
            continue
        except Exception as e:
            print(f'❌ Erro em {file_path}: {e}')
            return False
    
    print(f'⚠️  Não foi possível converter: {file_path}')
    return False

def main():
    """Converter todos HTML para UTF-8"""
    
    print('🔄 Convertendo arquivos HTML para UTF-8...\n')
    
    # Encontrar todos HTML
    html_files = glob.glob('templates/**/*.html', recursive=True)
    html_files += glob.glob('templates/*.html')
    
    if not html_files:
        print('❌ Nenhum arquivo HTML encontrado em templates/')
        return
    
    print(f'📁 Encontrados {len(html_files)} arquivos HTML\n')
    
    success = 0
    failed = 0
    
    for file_path in html_files:
        if convert_to_utf8(file_path):
            success += 1
        else:
            failed += 1
    
    print(f'\n📊 RESUMO:')
    print(f'   ✅ Convertidos: {success}')
    print(f'   ❌ Falhas: {failed}')
    print(f'\n🎉 Conversão concluída!')
    print(f'⚠️  Reinicie o servidor Flask agora!')

if __name__ == '__main__':
    main()
