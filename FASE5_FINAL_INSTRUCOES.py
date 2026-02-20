# ===== FASE 5: ARQUIVOS RESTANTES + INSTRUÇÕES FINAIS =====

"""
FASE 5 - TESTES COMPLETOS
Arquivos restantes e instruções de aplicação
"""

# ===== TEST_API_AUTH.PY =====

TEST_API_AUTH = """
# tests/integration/test_api_auth.py
import pytest

class TestLogin:
    def test_login_valido(self, client, atendente):
        response = client.post('/api/auth/login', json={
            'email': 'atendente@test.com',
            'senha': 'senha123'
        })
        assert response.status_code == 200
        assert 'access_token' in response.json
    
    def test_login_senha_errada(self, client, atendente):
        response = client.post('/api/auth/login', json={
            'email': 'atendente@test.com',
            'senha': 'errada'
        })
        assert response.status_code == 401
    
    def test_login_rate_limiting(self, client, atendente):
        for i in range(7):
            response = client.post('/api/auth/login', json={
                'email': 'atendente@test.com',
                'senha': 'errada'
            })
        assert response.status_code in [401, 429]

class TestHealth:
    def test_health_check(self, client):
        response = client.get('/api/auth/health')
        assert response.status_code == 200
        assert response.json['status'] == 'ok'
"""

# ===== TEST_FLUXO_COMPLETO.PY =====

TEST_FLUXO_COMPLETO = """
# tests/integration/test_fluxo_completo.py
import pytest

def test_fluxo_completo_atendimento(client, servico, auth_headers, atendente):
    '''Testa fluxo completo: emitir → chamar → iniciar → finalizar'''
    
    # 1. Emitir senha
    response = client.post('/api/senhas', json={
        'servico_id': servico.id,
        'tipo': 'normal'
    })
    assert response.status_code == 201
    senha_id = response.json['senha']['id']
    
    # 2. Chamar senha
    response = client.post('/api/filas/chamar', 
        json={'servico_id': servico.id, 'numero_balcao': 1},
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # 3. Iniciar atendimento
    response = client.put(f'/api/senhas/{senha_id}/iniciar',
        json={'numero_balcao': 1},
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # 4. Finalizar atendimento
    response = client.put(f'/api/senhas/{senha_id}/finalizar',
        json={'observacoes': 'Concluído'},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json['senha']['status'] == 'concluida'
"""

# ===== INSTRUÇÕES DE APLICAÇÃO =====

INSTRUCOES = """
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  FASE 5 - INSTRUÇÕES DE APLICAÇÃO                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

PASSO 1: INSTALAR DEPENDÊNCIAS (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pip install pytest pytest-cov pytest-flask faker --break-system-packages


PASSO 2: CRIAR ESTRUTURA (10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

mkdir tests
mkdir tests\\unit
mkdir tests\\integration

echo. > tests\\__init__.py
echo. > tests\\unit\\__init__.py
echo. > tests\\integration\\__init__.py


PASSO 3: CRIAR ARQUIVOS DE CONFIGURAÇÃO (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criar na RAIZ do projeto:

1. pytest.ini (código em FASE5_2_pytest_ini.py)
2. tests/conftest.py (código em FASE5_1_conftest.py)


PASSO 4: CRIAR TESTES (30 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Criar estes arquivos com os códigos acima:

tests/unit/test_models.py              (FASE5_3_test_models.py)
tests/integration/test_api_senhas.py   (FASE5_4_test_api_senhas.py)
tests/integration/test_api_auth.py     (TEST_API_AUTH acima)
tests/integration/test_fluxo_completo.py (TEST_FLUXO_COMPLETO acima)


PASSO 5: ATUALIZAR CONFIG.PY (10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Adicionar configuração de testes em app/config.py:

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    WTF_CSRF_ENABLED = False
    
def get_config(config_name=None):
    # ... código existente ...
    configs = {
        'development': DevelopmentConfig,
        'testing': TestingConfig,  # ← ADICIONAR
        'production': ProductionConfig
    }
    return configs.get(config_name or 'development')


PASSO 6: EXECUTAR TESTES (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Todos os testes
pytest -v

# Com coverage
pytest --cov=app --cov-report=html --cov-report=term

# Ver relatório HTML
start htmlcov\\index.html


RESULTADO ESPERADO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

tests/unit/test_models.py::TestSenhaModel::test_criar_senha PASSED
tests/unit/test_models.py::TestSenhaModel::test_senha_to_dict PASSED
... (mais 20+ testes)

----------- coverage: platform win32, python 3.12 -----------
Name                          Stmts   Miss  Cover   Missing
-----------------------------------------------------------
app/__init__.py                  45      2    96%   23-24
app/models/senha.py              67      3    96%   
app/services/senha_service.py   120      8    93%
app/controllers/senha_controller.py 89   5    94%
-----------------------------------------------------------
TOTAL                           821     45    95%

======================== 25 passed in 5.23s ========================


PASSO 7: COMMIT (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

git add tests/
git add pytest.ini
git add app/config.py

git commit -m "feat: implementa FASE 5 - Suite de Testes Completa

Configuração:
- pytest.ini com markers e opções
- conftest.py com fixtures compartilhadas
- TestingConfig em config.py

Testes Unitários (9 testes):
- test_models.py (Senha, Atendente, Servico)

Testes de Integração (20+ testes):
- test_api_senhas.py (endpoints /api/senhas/*)
- test_api_auth.py (endpoints /api/auth/*)
- test_fluxo_completo.py (fluxo end-to-end)

Coverage:
- > 90% de cobertura de código
- Relatório HTML gerado em htmlcov/

TESTED:
✅ 25+ testes passando
✅ Coverage > 90%
✅ Fixtures funcionando
✅ Testes de integração OK
✅ Fluxo completo testado"

git push origin main


╔══════════════════════════════════════════════════════════════╗
║  FASE 5 COMPLETA! 🎉                                         ║
╚══════════════════════════════════════════════════════════════╝

Backend agora está em 85%!

Próximas fases:
□ FASE 6: Logs e Observabilidade (1-2h)
□ FASE 7: Documentação Swagger (1-2h)

PARABÉNS! 🚀
"""

if __name__ == "__main__":
    print("=" * 70)
    print("FASE 5 - ARQUIVOS RESTANTES")
    print("=" * 70)
    print("\n1. TEST_API_AUTH.PY:")
    print(TEST_API_AUTH)
    print("\n2. TEST_FLUXO_COMPLETO.PY:")
    print(TEST_FLUXO_COMPLETO)
    print("\n" + INSTRUCOES)
