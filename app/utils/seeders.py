"""
app/utils/seeders.py — CORRIGIDO
Senha do admin: Admin123 (com A maiúsculo — consistente com o banco actual)
"""
from app.extensions import db
from app.models.servico import Servico
from app.models.atendente import Atendente
from app.models.configuracao import Configuracao


def seed_servicos():
    print("\n[SERVICOS] A criar serviços...")
    servicos = [
        { 'nome': 'Secretaria Académica', 'descricao': 'Matrículas, reconfirmações, certificados, históricos escolares', 'tempo_medio_minutos': 12, 'icone': '📄', 'ordem_exibicao': 1 },
        { 'nome': 'Tesouraria',           'descricao': 'Pagamentos de propinas, taxas, emissão de recibos',             'tempo_medio_minutos':  8, 'icone': '💰', 'ordem_exibicao': 2 },
        { 'nome': 'Direcção Pedagógica',  'descricao': 'Atendimento pedagógico, transferências, orientação',            'tempo_medio_minutos': 15, 'icone': '👔', 'ordem_exibicao': 3 },
        { 'nome': 'Biblioteca',           'descricao': 'Empréstimo de livros',                                          'tempo_medio_minutos':  5, 'icone': '📚', 'ordem_exibicao': 4 },
        { 'nome': 'Apoio ao Cliente',     'descricao': 'Informações gerais, dúvidas, suporte',                          'tempo_medio_minutos': 10, 'icone': '📞', 'ordem_exibicao': 5 },
    ]
    for dados in servicos:
        if not Servico.query.filter_by(nome=dados['nome']).first():
            Servico(**dados).save()
            print(f"  ✅ {dados['icone']} {dados['nome']}")
        else:
            print(f"  ⚠️  {dados['nome']} (já existe)")


def seed_atendentes():
    print("\n[ATENDENTES] A criar atendentes...")

    # NOTA: senha Admin123 (A maiúsculo) — consistente com o banco actual
    atendentes = [
        { 'nome': 'Administrador Sistema', 'email': 'admin@imtsb.ao',         'senha': 'Admin123', 'tipo': 'admin',     'balcao': None },
        { 'nome': 'João da Silva',         'email': 'joao.silva@imtsb.ao',    'senha': 'Admin123', 'tipo': 'atendente', 'balcao': 1 },
        { 'nome': 'Maria Costa',           'email': 'maria.costa@imtsb.ao',   'senha': 'Admin123', 'tipo': 'atendente', 'balcao': 2 },
        { 'nome': 'Paulo Alves',           'email': 'paulo.alves@imtsb.ao',   'senha': 'Admin123', 'tipo': 'atendente', 'balcao': 3 },
    ]
    for dados in atendentes:
        if not Atendente.query.filter_by(email=dados['email']).first():
            Atendente(**dados).save()
            emoji = '👑' if dados['tipo'] == 'admin' else '👤'
            print(f"  ✅ {emoji} {dados['nome']}")
        else:
            print(f"  ⚠️  {dados['nome']} (já existe)")


def seed_configuracoes():
    print("\n[CONFIGURACOES] A criar configurações...")
    configs = [
        { 'chave': 'horario_abertura',       'valor': '08:00', 'tipo': 'string',  'descricao': 'Horário de abertura' },
        { 'chave': 'horario_fechamento',      'valor': '16:00', 'tipo': 'string',  'descricao': 'Horário de encerramento' },
        { 'chave': 'tempo_maximo_espera',     'valor': '60',    'tipo': 'int',     'descricao': 'Tempo máximo de espera em minutos' },
        { 'chave': 'permite_senha_prioritaria','valor': 'true', 'tipo': 'boolean', 'descricao': 'Permite senhas prioritárias' },
        { 'chave': 'numero_balcoes_ativos',   'valor': '3',     'tipo': 'int',     'descricao': 'Balcões em operação' },
        { 'chave': 'mensagem_boas_vindas',    'valor': 'Bem-vindo ao Sistema de Filas do IMTSB!', 'tipo': 'string', 'descricao': 'Mensagem da home' },
    ]
    for dados in configs:
        if not Configuracao.query.filter_by(chave=dados['chave']).first():
            Configuracao(**dados).save()
            print(f"  ✅ {dados['chave']}")
        else:
            print(f"  ⚠️  {dados['chave']} (já existe)")


def run_seeders():
    print("\n" + "="*50)
    print("🌱 POPULAR BANCO DE DADOS — IMTSB")
    print("="*50)
    seed_servicos()
    seed_atendentes()
    seed_configuracoes()
    print("\n" + "="*50)
    print("✅ BANCO POPULADO!")
    print("="*50)
    print("\nCredenciais de acesso:")
    print("  Admin:     admin@imtsb.ao       / Admin123")
    print("  Balcão 1:  joao.silva@imtsb.ao  / Admin123")
    print("  Balcão 2:  maria.costa@imtsb.ao / Admin123")
    print("  Balcão 3:  paulo.alves@imtsb.ao / Admin123")