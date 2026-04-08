"""
Seeders - Popular banco com dados iniciais
Baseado no MER Corrigido
"""
from app import db
from app.models import Servico, Atendente, Configuracao


def seed_servicos():
    """Cria serviços conforme documentação IMTSB"""
    print("\n[SERVICOS] Criando serviços...")
    
    servicos = [
        {
            'nome': 'Secretaria Académica',
            'descricao': 'Matrículas, reconfirmações, certificados, históricos escolares',
            'tempo_medio_minutos': 12,
            'icone': '📄',
            'ordem_exibicao': 1
        },
        {
            'nome': 'Tesouraria',
            'descricao': 'Pagamentos de propinas, taxas, emissão de recibos',
            'tempo_medio_minutos': 8,
            'icone': '💰',
            'ordem_exibicao': 2
        },
        {
            'nome': 'Direcção Pedagógica',
            'descricao': 'Atendimento pedagógico, transferências',
            'tempo_medio_minutos': 15,
            'icone': '👔',
            'ordem_exibicao': 3
        },
        {
            'nome': 'Biblioteca',
            'descricao': 'Empréstimos de livros, devoluções, cartão de estudante',
            'tempo_medio_minutos': 5,
            'icone': '📚',
            'ordem_exibicao': 4
        }
    ]
    
    for dados in servicos:
        existe = Servico.query.filter_by(nome=dados['nome']).first()
        if not existe:
            servico = Servico(**dados)
            servico.save()
            print(f"  ✅ {dados['icone']} {servico.nome}")
        else:
            print(f"  ⚠️  {dados['icone']} {existe.nome} (já existe)")


def seed_atendentes():
    """Cria atendentes iniciais"""
    print("\n[ATENDENTES] Criando atendentes...")
    
    atendentes = [
        {
            'nome': 'Administrador Sistema',
            'email': 'admin@imtsb.ao',
            'senha': 'admin123',  # ⚠️ TROCAR EM PRODUÇÃO!
            'tipo': 'admin',
            'balcao': None
        },
        {
            'nome': 'João da Silva',
            'email': 'joao.silva@imtsb.ao',
            'senha': 'senha123',
            'tipo': 'atendente',
            'balcao': 1
        },
        {
            'nome': 'Maria Costa',
            'email': 'maria.costa@imtsb.ao',
            'senha': 'senha123',
            'tipo': 'atendente',
            'balcao': 2
        },
        {
            'nome': 'Paulo Alves',
            'email': 'paulo.alves@imtsb.ao',
            'senha': 'senha123',
            'tipo': 'atendente',
            'balcao': 3
        }
    ]
    
    for dados in atendentes:
        existe = Atendente.query.filter_by(email=dados['email']).first()
        if not existe:
            atendente = Atendente(**dados)
            atendente.save()
            tipo_emoji = '👑' if atendente.tipo == 'admin' else '👤'
            balcao_info = f"Balcão {atendente.balcao}" if atendente.balcao else "Admin"
            print(f"  ✅ {tipo_emoji} {atendente.nome} ({balcao_info})")
        else:
            print(f"  ⚠️  {existe.nome} (já existe)")


def seed_configuracoes():
    """Cria configurações iniciais do sistema"""
    print("\n[CONFIGURACOES] Criando configuracoes...")
    
    configs = [
        {
            'chave': 'horario_abertura',
            'valor': '08:00',
            'tipo': 'string',
            'descricao': 'Horário de abertura do atendimento'
        },
        {
            'chave': 'horario_fechamento',
            'valor': '16:00',
            'tipo': 'string',
            'descricao': 'Horário de fechamento do atendimento'
        },
        {
            'chave': 'tempo_maximo_espera',
            'valor': '60',
            'tipo': 'int',
            'descricao': 'Tempo máximo de espera em minutos'
        },
        {
            'chave': 'permite_senha_prioritaria',
            'valor': 'true',
            'tipo': 'boolean',
            'descricao': 'Permite emissão de senhas prioritárias'
        },
        {
            'chave': 'numero_balcoes_ativos',
            'valor': '3',
            'tipo': 'int',
            'descricao': 'Número de balcões em operação'
        },
        {
            'chave': 'mensagem_boas_vindas',
            'valor': 'Bem-vindo ao Sistema de Filas do IMTSB!',
            'tipo': 'string',
            'descricao': 'Mensagem exibida na home'
        }
    ]
    
    for dados in configs:
        existe = Configuracao.query.filter_by(chave=dados['chave']).first()
        if not existe:
            config = Configuracao(**dados)
            config.save()
            print(f"  ✅ {config.chave} = {config.valor}")
        else:
            print(f"  ⚠️  {existe.chave} (já existe)")


def run_seeders():
    """Executa todos os seeders"""
    print("\n" + "=" * 60)
    print("🌱 POPULANDO BANCO DE DADOS")
    print("=" * 60)
    
    seed_servicos()
    seed_atendentes()
    seed_configuracoes()
    
    print("\n" + "=" * 60)
    print("✅ BANCO POPULADO COM SUCESSO!")
    print("=" * 60 + "\n")
