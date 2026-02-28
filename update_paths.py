# update_paths.py - Atualizar caminhos automaticamente

import os
import re

def update_html_paths(templates_dir):
    """Atualiza caminhos em arquivos HTML"""
    
    for filename in os.listdir(templates_dir):
        if not filename.endswith('.html'):
            continue
        
        filepath = os.path.join(templates_dir, filename)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Substituir caminhos relativos por /static/
        content = re.sub(r'href="css/', r'href="/static/css/', content)
        content = re.sub(r'src="js/', r'src="/static/js/', content)
        content = re.sub(r'src="image/', r'src="/static/image/', content)
        content = re.sub(r'url\(["\']*image/', r'url(/static/image/', content)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f'✅ Atualizado: {filename}')

if __name__ == '__main__':
    templates_dir = 'templates'
    update_html_paths(templates_dir)
    print('\n🎉 Todos caminhos atualizados!')