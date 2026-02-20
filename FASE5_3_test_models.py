# ===== FASE 5.3: TESTES UNITÁRIOS - MODELS =====

"""
tests/unit/test_models.py

Testes dos models (Senha, Atendente, Servico)
"""

TEST_MODELS = """
import pytest
from datetime import datetime, date
from app.models.senha import Senha
from app.models.atendente import Atendente
from app.models.servico import Servico


class TestSenhaModel:
    '''Testes do model Senha'''
    
    def test_criar_senha(self, db_session, servico):
        '''Deve criar senha com sucesso'''
        senha = Senha(
            numero='N001',
            tipo='normal',
            status='aguardando',
            servico_id=servico.id,
            data_emissao=date.today()
        )
        db_session.session.add(senha)
        db_session.session.commit()
        
        assert senha.id is not None
        assert senha.numero == 'N001'
        assert senha.tipo == 'normal'
        assert senha.status == 'aguardando'
    
    
    def test_senha_to_dict(self, senha):
        '''Deve converter senha para dict'''
        dados = senha.to_dict()
        
        assert 'id' in dados
        assert 'numero' in dados
        assert 'tipo' in dados
        assert 'status' in dados
        assert dados['numero'] == 'N001'
    
    
    def test_senha_unique_numero_data(self, db_session, servico):
        '''Não deve permitir número duplicado no mesmo dia'''
        # Criar primeira senha
        senha1 = Senha(
            numero='N001',
            tipo='normal',
            status='aguardando',
            servico_id=servico.id,
            data_emissao=date.today()
        )
        db_session.session.add(senha1)
        db_session.session.commit()
        
        # Tentar criar segunda com mesmo número e data
        senha2 = Senha(
            numero='N001',
            tipo='normal',
            status='aguardando',
            servico_id=servico.id,
            data_emissao=date.today()
        )
        db_session.session.add(senha2)
        
        with pytest.raises(Exception):  # IntegrityError
            db_session.session.commit()
    
    
    def test_senha_tipos_validos(self, db_session, servico):
        '''Deve aceitar tipos válidos'''
        senha_normal = Senha(
            numero='N001',
            tipo='normal',
            status='aguardando',
            servico_id=servico.id,
            data_emissao=date.today()
        )
        
        senha_prioritaria = Senha(
            numero='P001',
            tipo='prioritaria',
            status='aguardando',
            servico_id=servico.id,
            data_emissao=date.today()
        )
        
        db_session.session.add_all([senha_normal, senha_prioritaria])
        db_session.session.commit()
        
        assert senha_normal.tipo == 'normal'
        assert senha_prioritaria.tipo == 'prioritaria'


class TestAtendenteModel:
    '''Testes do model Atendente'''
    
    def test_criar_atendente(self, db_session, app):
        '''Deve criar atendente com sucesso'''
        from app import bcrypt
        
        with app.app_context():
            atendente = Atendente(
                nome='João Silva',
                email='joao@test.com',
                senha_hash=bcrypt.generate_password_hash('senha123').decode('utf-8'),
                tipo='atendente',
                balcao=1
            )
            db_session.session.add(atendente)
            db_session.session.commit()
            
            assert atendente.id is not None
            assert atendente.nome == 'João Silva'
            assert atendente.email == 'joao@test.com'
    
    
    def test_atendente_email_unico(self, db_session, atendente):
        '''Não deve permitir email duplicado'''
        atendente2 = Atendente(
            nome='Outro',
            email='atendente@test.com',  # Email duplicado
            senha_hash='hash',
            tipo='atendente',
            balcao=2
        )
        db_session.session.add(atendente2)
        
        with pytest.raises(Exception):  # IntegrityError
            db_session.session.commit()
    
    
    def test_atendente_senha_hasheada(self, atendente, app):
        '''Senha deve estar hasheada com bcrypt'''
        from app import bcrypt
        
        with app.app_context():
            # Senha hash deve começar com $2b$ (bcrypt)
            assert atendente.senha_hash.startswith('$2b$')
            
            # Deve validar senha correta
            assert bcrypt.check_password_hash(atendente.senha_hash, 'senha123')
            
            # Deve rejeitar senha incorreta
            assert not bcrypt.check_password_hash(atendente.senha_hash, 'errada')


class TestServicoModel:
    '''Testes do model Servico'''
    
    def test_criar_servico(self, db_session):
        '''Deve criar serviço com sucesso'''
        servico = Servico(
            nome='Tesouraria',
            descricao='Pagamentos',
            icone='💰',
            ordem_exibicao=1,
            ativo=True
        )
        db_session.session.add(servico)
        db_session.session.commit()
        
        assert servico.id is not None
        assert servico.nome == 'Tesouraria'
        assert servico.ativo is True
    
    
    def test_servico_ordenacao(self, db_session):
        '''Deve respeitar ordem de exibição'''
        s1 = Servico(nome='S1', icone='📄', ordem_exibicao=2, ativo=True)
        s2 = Servico(nome='S2', icone='💰', ordem_exibicao=1, ativo=True)
        s3 = Servico(nome='S3', icone='👔', ordem_exibicao=3, ativo=True)
        
        db_session.session.add_all([s1, s2, s3])
        db_session.session.commit()
        
        servicos = Servico.query.order_by(Servico.ordem_exibicao).all()
        
        assert servicos[0].nome == 'S2'
        assert servicos[1].nome == 'S1'
        assert servicos[2].nome == 'S3'
"""

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 5.3 - TESTES UNITÁRIOS DOS MODELS                      ║
╚══════════════════════════════════════════════════════════════╝

CRIAR ARQUIVO:
────────────────────────────────────────────────────────────────
tests/unit/test_models.py

Cole o código acima (TEST_MODELS)

TESTES INCLUÍDOS:
────────────────────────────────────────────────────────────────
TestSenhaModel:
  ✅ test_criar_senha
  ✅ test_senha_to_dict
  ✅ test_senha_unique_numero_data
  ✅ test_senha_tipos_validos

TestAtendenteModel:
  ✅ test_criar_atendente
  ✅ test_atendente_email_unico
  ✅ test_atendente_senha_hasheada

TestServicoModel:
  ✅ test_criar_servico
  ✅ test_servico_ordenacao

TOTAL: 9 testes unitários

EXECUTAR:
────────────────────────────────────────────────────────────────
pytest tests/unit/test_models.py -v

PRÓXIMO: FASE5_4_test_api_senhas.py
    """)
    
    print(TEST_MODELS)
