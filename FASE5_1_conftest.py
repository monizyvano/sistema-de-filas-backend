# ===== FASE 5.1: CONFTEST.PY - FIXTURES COMPARTILHADAS =====

"""
tests/conftest.py

Fixtures compartilhadas para todos os testes
"""

CONFTEST_COMPLETO = """
import pytest
from app import create_app, db
from app.models.atendente import Atendente
from app.models.servico import Servico
from app.models.senha import Senha
from datetime import date


@pytest.fixture(scope='session')
def app():
    '''Cria aplicação de teste'''
    app = create_app('testing')
    
    with app.app_context():
        # Criar todas as tabelas
        db.create_all()
        
        yield app
        
        # Limpar após todos os testes
        db.drop_all()


@pytest.fixture(scope='function')
def client(app):
    '''Cliente de teste para fazer requisições'''
    return app.test_client()


@pytest.fixture(scope='function')
def db_session(app):
    '''Sessão de banco de dados para cada teste'''
    with app.app_context():
        # Limpar dados antes de cada teste
        Senha.query.delete()
        Atendente.query.delete()
        Servico.query.delete()
        db.session.commit()
        
        yield db
        
        # Rollback após o teste
        db.session.rollback()


@pytest.fixture
def servico(db_session):
    '''Cria um serviço de teste'''
    servico = Servico(
        nome='Secretaria Académica',
        descricao='Serviço de teste',
        icone='📄',
        ordem_exibicao=1,
        ativo=True
    )
    db_session.session.add(servico)
    db_session.session.commit()
    return servico


@pytest.fixture
def atendente(db_session, app):
    '''Cria um atendente de teste'''
    from app import bcrypt
    
    with app.app_context():
        atendente = Atendente(
            nome='Atendente Teste',
            email='atendente@test.com',
            senha_hash=bcrypt.generate_password_hash('senha123').decode('utf-8'),
            tipo='atendente',
            balcao=1,
            ativo=True
        )
        db_session.session.add(atendente)
        db_session.session.commit()
        return atendente


@pytest.fixture
def admin(db_session, app):
    '''Cria um admin de teste'''
    from app import bcrypt
    
    with app.app_context():
        admin = Atendente(
            nome='Admin Teste',
            email='admin@test.com',
            senha_hash=bcrypt.generate_password_hash('admin123').decode('utf-8'),
            tipo='admin',
            balcao=None,
            ativo=True
        )
        db_session.session.add(admin)
        db_session.session.commit()
        return admin


@pytest.fixture
def senha(db_session, servico):
    '''Cria uma senha de teste'''
    senha = Senha(
        numero='N001',
        tipo='normal',
        status='aguardando',
        servico_id=servico.id,
        data_emissao=date.today()
    )
    db_session.session.add(senha)
    db_session.session.commit()
    return senha


@pytest.fixture
def auth_headers(client, atendente):
    '''Retorna headers com token JWT válido'''
    response = client.post('/api/auth/login', json={
        'email': 'atendente@test.com',
        'senha': 'senha123'
    })
    
    token = response.json['access_token']
    
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }


@pytest.fixture
def admin_headers(client, admin):
    '''Retorna headers com token JWT de admin'''
    response = client.post('/api/auth/login', json={
        'email': 'admin@test.com',
        'senha': 'admin123'
    })
    
    token = response.json['access_token']
    
    return {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
"""

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 5.1 - CONFTEST.PY (FIXTURES)                           ║
╚══════════════════════════════════════════════════════════════╝

CRIAR ARQUIVO:
────────────────────────────────────────────────────────────────
tests/conftest.py

Cole o código acima (CONFTEST_COMPLETO)

FIXTURES DISPONÍVEIS:
────────────────────────────────────────────────────────────────
✅ app - Aplicação Flask de teste
✅ client - Cliente HTTP para requisições
✅ db_session - Sessão de banco limpa
✅ servico - Serviço de teste criado
✅ atendente - Atendente de teste criado
✅ admin - Admin de teste criado
✅ senha - Senha de teste criada
✅ auth_headers - Headers com JWT de atendente
✅ admin_headers - Headers com JWT de admin

USO NOS TESTES:
────────────────────────────────────────────────────────────────
def test_exemplo(client, servico, auth_headers):
    response = client.post('/api/senhas', 
        json={'servico_id': servico.id, 'tipo': 'normal'},
        headers=auth_headers
    )
    assert response.status_code == 201

PRÓXIMO: FASE5_2_pytest_ini.py
    """)
    
    print(CONFTEST_COMPLETO)
