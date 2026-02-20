import pytest
from app import create_app, db
from app.models.atendente import Atendente
from app.models.servico import Servico
from app.models.senha import Senha
from datetime import date


@pytest.fixture(scope='session')
def app():
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture(scope='function')
def client(app):
    return app.test_client()


@pytest.fixture(scope='function')
def db_session(app):
    with app.app_context():
        Senha.query.delete()
        Atendente.query.delete()
        Servico.query.delete()
        db.session.commit()
        yield db
        db.session.rollback()


@pytest.fixture
def servico(db_session):
    servico = Servico(
        nome='Secretaria Academica',
        descricao='Servico de teste',
        icone='📄',
        ordem_exibicao=1,
        ativo=True
    )
    db_session.session.add(servico)
    db_session.session.commit()
    return servico


@pytest.fixture
def atendente(db_session, app):
    from app import bcrypt
    with app.app_context():
        atendente = Atendente(
            nome='Atendente Teste',
            email='atendente@test.com',
            senha=bcrypt.generate_password_hash('senha123').decode('utf-8'),
            tipo='atendente',
            balcao=1,
            ativo=True
        )
        db_session.session.add(atendente)
        db_session.session.commit()
        return atendente


@pytest.fixture
def senha(db_session, servico):
    senha = Senha(
        numero='N001',
        tipo='normal',
        servico_id=servico.id,
        data_emissao=date.today()
    )
    db_session.session.add(senha)
    db_session.session.commit()
    return senha
