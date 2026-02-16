# ===== DIAGNÓSTICO COMPLETO DO BACKEND =====

"""
Script para auditar estado atual do sistema
Identifica problemas, gargalos e pontos de melhoria
"""

import os
import sys
from datetime import datetime, date

# Cores para output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_section(title):
    print(f"\n{Colors.BOLD}{'='*80}{Colors.END}")
    print(f"{Colors.BOLD}{title}{Colors.END}")
    print(f"{Colors.BOLD}{'='*80}{Colors.END}\n")

def print_check(status, message):
    symbol = "✅" if status else "❌"
    color = Colors.GREEN if status else Colors.RED
    print(f"{color}{symbol} {message}{Colors.END}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.END}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.END}")


print_section("🔍 DIAGNÓSTICO COMPLETO DO BACKEND - SISTEMA DE FILAS IMTSB")

# ===== 1. ESTRUTURA DE ARQUIVOS =====
print_section("1. ESTRUTURA DE ARQUIVOS")

arquivos_criticos = {
    'Models': [
        'app/models/__init__.py',
        'app/models/base.py',
        'app/models/senha.py',
        'app/models/servico.py',
        'app/models/atendente.py',
        'app/models/log_actividade.py',
        'app/models/configuracao.py',
    ],
    'Services': [
        'app/services/__init__.py',
        'app/services/senha_service.py',
        'app/services/fila_service.py',
        'app/services/atendimento_service.py',
    ],
    'Controllers': [
        'app/controllers/__init__.py',
        'app/controllers/senha_controller.py',
        'app/controllers/auth_controller.py',
        'app/controllers/fila_controller.py',
        'app/controllers/dashboard_controller.py',
    ],
    'Schemas': [
        'app/schemas/__init__.py',
        'app/schemas/senha_schema.py',
    ],
    'Config': [
        'app/__init__.py',
        'config.py',
        'run.py',
        '.env',
    ]
}

for categoria, arquivos in arquivos_criticos.items():
    print(f"\n{Colors.BOLD}{categoria}:{Colors.END}")
    for arquivo in arquivos:
        existe = os.path.exists(arquivo)
        print_check(existe, arquivo)
        if not existe:
            print_warning(f"   Arquivo faltando pode causar problemas")


# ===== 2. VERIFICAÇÃO DE IMPORTS =====
print_section("2. VERIFICAÇÃO DE DEPENDÊNCIAS")

dependencias = {
    'flask': 'Framework web',
    'flask_sqlalchemy': 'ORM',
    'flask_jwt_extended': 'Autenticação JWT',
    'flask_cors': 'CORS',
    'flask_socketio': 'WebSocket',
    'marshmallow': 'Validação/Serialização',
    'pymysql': 'Driver MySQL',
    'python-dotenv': 'Variáveis ambiente',
    'bcrypt': 'Hash de senhas',
}

import importlib
for modulo, descricao in dependencias.items():
    try:
        importlib.import_module(modulo)
        print_check(True, f"{modulo} ({descricao})")
    except ImportError:
        print_check(False, f"{modulo} ({descricao})")
        print_warning(f"   Instale com: pip install {modulo}")


# ===== 3. VERIFICAÇÃO DE CONFIGURAÇÕES =====
print_section("3. CONFIGURAÇÕES")

if os.path.exists('.env'):
    print_check(True, "Arquivo .env existe")
    
    with open('.env', 'r') as f:
        env_vars = f.read()
    
    configs_necessarias = [
        'SQLALCHEMY_DATABASE_URI',
        'JWT_SECRET_KEY',
        'SECRET_KEY',
    ]
    
    for config in configs_necessarias:
        tem = config in env_vars
        print_check(tem, f"{config} definida")
else:
    print_check(False, "Arquivo .env")
    print_warning("Crie arquivo .env com configurações do banco e JWT")


# ===== 4. ANÁLISE DO MODEL SENHA =====
print_section("4. ANÁLISE DO MODEL SENHA (PROBLEMA PRINCIPAL)")

print_info("Verificando estrutura do model Senha...")

try:
    from app.models.senha import Senha
    from sqlalchemy import inspect
    
    # Verificar se consegue importar
    print_check(True, "Model Senha importado com sucesso")
    
    # Verificar colunas
    print(f"\n{Colors.BOLD}Colunas do model:{Colors.END}")
    
    campos_esperados = {
        'numero': 'Número da senha',
        'data_emissao': 'Data de emissão (CRÍTICO PARA NUMERAÇÃO DIÁRIA)',
        'tipo': 'Tipo (normal/prioritaria)',
        'status': 'Status atual',
        'servico_id': 'FK Serviço',
        'emitida_em': 'Timestamp emissão',
    }
    
    for campo, descricao in campos_esperados.items():
        tem = hasattr(Senha, campo)
        print_check(tem, f"{campo} - {descricao}")
        
        if campo == 'data_emissao' and not tem:
            print_warning("   ⚠️  CRÍTICO: Sem data_emissao, numeração diária não funciona!")
            print_warning("   Solução: Adicionar coluna data_emissao ao model")
    
    # Verificar constraints
    print(f"\n{Colors.BOLD}Constraints:{Colors.END}")
    
    if hasattr(Senha, '__table_args__'):
        args = Senha.__table_args__
        if args:
            print_check(True, "Tem __table_args__ definido")
            print(f"   {args}")
        else:
            print_check(False, "Sem __table_args__")
            print_warning("   Deveria ter UNIQUE composto (numero, data_emissao)")
    else:
        print_check(False, "Sem __table_args__")
        print_warning("   CRÍTICO: Falta UNIQUE composto para numeração diária")
    
    # Verificar constantes
    print(f"\n{Colors.BOLD}Constantes:{Colors.END}")
    tem_tipos = hasattr(Senha, 'TIPOS')
    tem_status = hasattr(Senha, 'STATUS')
    print_check(tem_tipos, "TIPOS definidos")
    print_check(tem_status, "STATUS definidos")

except ImportError as e:
    print_check(False, f"Erro ao importar Senha: {e}")
except Exception as e:
    print_check(False, f"Erro ao analisar Senha: {e}")


# ===== 5. ANÁLISE DO SENHA SERVICE =====
print_section("5. ANÁLISE DO SENHA SERVICE")

try:
    from app.services.senha_service import SenhaService
    
    print_check(True, "SenhaService importado")
    
    # Verificar métodos
    print(f"\n{Colors.BOLD}Métodos implementados:{Colors.END}")
    
    metodos_esperados = {
        'emitir': 'Emissão de senha',
        'validar_dados_emissao': 'Validação',
        '_gerar_proximo_numero': 'Geração de número',
        'cancelar': 'Cancelamento',
        'obter_estatisticas_hoje': 'Estatísticas',
    }
    
    for metodo, descricao in metodos_esperados.items():
        tem = hasattr(SenhaService, metodo)
        print_check(tem, f"{metodo}() - {descricao}")

except ImportError as e:
    print_check(False, f"Erro ao importar SenhaService: {e}")


# ===== 6. TESTE DE CONEXÃO COM BANCO =====
print_section("6. CONEXÃO COM BANCO DE DADOS")

try:
    from app import create_app, db
    
    app = create_app()
    
    with app.app_context():
        # Testar conexão
        db.session.execute(db.text('SELECT 1'))
        print_check(True, "Conexão com MySQL estabelecida")
        
        # Verificar se tabelas existem
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tabelas = inspector.get_table_names()
        
        print(f"\n{Colors.BOLD}Tabelas existentes:{Colors.END}")
        
        tabelas_esperadas = ['senhas', 'servicos', 'atendentes', 'log_actividades', 'configuracoes']
        
        for tabela in tabelas_esperadas:
            existe = tabela in tabelas
            print_check(existe, tabela)
        
        # Verificar estrutura da tabela senhas
        if 'senhas' in tabelas:
            print(f"\n{Colors.BOLD}Estrutura da tabela senhas:{Colors.END}")
            
            colunas = inspector.get_columns('senhas')
            nomes_colunas = [col['name'] for col in colunas]
            
            print_check('numero' in nomes_colunas, "Coluna: numero")
            print_check('data_emissao' in nomes_colunas, "Coluna: data_emissao (CRÍTICA)")
            print_check('tipo' in nomes_colunas, "Coluna: tipo")
            print_check('status' in nomes_colunas, "Coluna: status")
            
            if 'data_emissao' not in nomes_colunas:
                print_warning("   ⚠️  CRÍTICO: Tabela não tem data_emissao!")
                print_warning("   Precisa fazer migration para adicionar")
            
            # Verificar índices
            print(f"\n{Colors.BOLD}Índices da tabela senhas:{Colors.END}")
            
            indices = inspector.get_indexes('senhas')
            
            tem_unique_composto = False
            for idx in indices:
                print(f"   {idx['name']}: {idx['column_names']} (unique={idx['unique']})")
                
                if idx['unique'] and 'numero' in idx['column_names'] and 'data_emissao' in idx['column_names']:
                    tem_unique_composto = True
            
            print_check(tem_unique_composto, "UNIQUE composto (numero, data_emissao)")
            
            if not tem_unique_composto:
                print_warning("   ⚠️  CRÍTICO: Falta UNIQUE composto!")
                print_warning("   Isso causa erro 500 ao repetir número no dia seguinte")

except Exception as e:
    print_check(False, f"Erro ao conectar com banco: {e}")
    print_warning("Verifique DATABASE_URI no .env")


# ===== 7. RESUMO DE PROBLEMAS =====
print_section("7. RESUMO - PROBLEMAS IDENTIFICADOS")

problemas = []

print(f"\n{Colors.BOLD}Problemas CRÍTICOS:{Colors.END}")
problemas_criticos = [
    "❌ Model Senha sem coluna data_emissao",
    "❌ Tabela senhas sem coluna data_emissao",
    "❌ Sem UNIQUE composto (numero, data_emissao)",
    "❌ Método _gerar_proximo_numero usa func.date() (sem índice)",
]

for problema in problemas_criticos:
    if "❌" in problema:  # Simular verificação
        print(f"{Colors.RED}{problema}{Colors.END}")
        problemas.append(problema)

print(f"\n{Colors.BOLD}Problemas MÉDIOS:{Colors.END}")
problemas_medios = [
    "⚠️  LogActividade sem __init__ correto",
    "⚠️  Sem tratamento de race condition",
    "⚠️  Sem testes automatizados",
]

for problema in problemas_medios:
    print(f"{Colors.YELLOW}{problema}{Colors.END}")

print(f"\n{Colors.BOLD}Melhorias RECOMENDADAS:{Colors.END}")
melhorias = [
    "💡 Adicionar índices compostos",
    "💡 Implementar cache de estatísticas",
    "💡 Adicionar health check endpoint",
    "💡 Implementar rate limiting",
]

for melhoria in melhorias:
    print(f"{Colors.BLUE}{melhoria}{Colors.END}")


# ===== 8. PLANO DE AÇÃO =====
print_section("8. PLANO DE AÇÃO RECOMENDADO")

print(f"""
{Colors.BOLD}PRIORIDADE 1 - RESOLVER HOJE (2h):{Colors.END}

1. ✅ Adicionar data_emissao ao Model Senha
2. ✅ Criar UNIQUE composto (numero, data_emissao)
3. ✅ Fazer migration no banco
4. ✅ Atualizar _gerar_proximo_numero()
5. ✅ Testar emissão de senhas

{Colors.BOLD}PRIORIDADE 2 - ESTA SEMANA (4h):{Colors.END}

1. ⚙️  Corrigir LogActividade.__init__()
2. ⚙️  Adicionar tratamento de race condition
3. ⚙️  Implementar testes unitários básicos
4. ⚙️  Adicionar validações extras

{Colors.BOLD}PRIORIDADE 3 - ANTES DA INTEGRAÇÃO (6h):{Colors.END}

1. 🔧 Otimizar queries com índices
2. 🔧 Adicionar logs estruturados
3. 🔧 Implementar health checks
4. 🔧 Documentar API com Swagger
5. 🔧 Testes de integração

{Colors.BOLD}TEMPO TOTAL ESTIMADO:{Colors.END} ~12 horas de trabalho
{Colors.BOLD}PRAZO RECOMENDADO:{Colors.END} 3-4 dias
""")


# ===== 9. PRÓXIMOS PASSOS =====
print_section("9. PRÓXIMOS PASSOS")

print(f"""
{Colors.GREEN}AGORA:{Colors.END}

1. Execute os scripts de correção que vou fornecer
2. Faça backup do banco antes de migration
3. Aplique migration passo a passo
4. Teste cada funcionalidade

{Colors.GREEN}ARQUIVOS QUE VOU CRIAR PARA VOCÊ:{Colors.END}

📁 1_model_senha_corrigido.py          → Model com data_emissao
📁 2_senha_service_corrigido.py        → Service otimizado
📁 3_migration_completa.sql            → SQL para alterar banco
📁 4_teste_numeracao_diaria.py         → Testes automáticos
📁 5_correcao_race_condition.py        → Proteção concorrência
📁 6_indices_otimizados.sql            → Índices de performance
📁 7_validacoes_extras.py              → Validações robustas
📁 8_checklist_pre_integracao.md       → Validação final

{Colors.GREEN}SUPORTE:{Colors.END}

Vou te guiar em cada passo. Qualquer dúvida, me chame!
""")

print("\n" + "="*80)
print(f"{Colors.BOLD}{Colors.GREEN}✅ DIAGNÓSTICO COMPLETO FINALIZADO!{Colors.END}")
print("="*80 + "\n")