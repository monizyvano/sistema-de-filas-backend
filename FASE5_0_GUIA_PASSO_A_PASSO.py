# ===== FASE 5: GUIA PASSO-A-PASSO - TESTES COMPLETOS =====

"""
Sistema de Filas IMTSB - FASE 5: Testes Completos

Objetivo: Suite de testes profissional com pytest
Tempo estimado: 3-4 horas
Complexidade: Média-Alta
Risco: Baixo
"""

GUIA_COMPLETO = """
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  FASE 5: TESTES COMPLETOS                                    ║
║                                                              ║
║  OBJETIVO: Cobertura de testes profissional                  ║
║  TEMPO: 3-4 horas                                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 1: INSTALAR DEPENDÊNCIAS DE TESTE (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.1) Ativar venv:

venv\\Scripts\\activate


1.2) Instalar pytest e dependências:

pip install pytest pytest-cov pytest-flask pytest-mock faker --break-system-packages


1.3) Verificar instalação:

pytest --version


Deve mostrar: pytest 7.x.x ou superior


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 2: CRIAR ESTRUTURA DE TESTES (10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1) Criar pasta de testes:

mkdir tests
mkdir tests\\unit
mkdir tests\\integration
mkdir tests\\load


2.2) Criar arquivos de configuração:

# tests/__init__.py (vazio)
echo. > tests\\__init__.py

# tests/unit/__init__.py (vazio)
echo. > tests\\unit\\__init__.py

# tests/integration/__init__.py (vazio)
echo. > tests\\integration\\__init__.py


2.3) Criar conftest.py (fixtures compartilhadas)

Cole o código de FASE5_1_conftest.py


2.4) Criar pytest.ini (configuração)

Cole o código de FASE5_2_pytest_ini.py


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 3: TESTES UNITÁRIOS (60 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1) Criar: tests/unit/test_models.py

Testa models (Senha, Atendente, Servico)


3.2) Criar: tests/unit/test_services.py

Testa SenhaService (emitir, chamar, iniciar, finalizar)


3.3) Criar: tests/unit/test_schemas.py

Testa validações Marshmallow


3.4) Criar: tests/unit/test_rate_limiter.py

Testa rate limiting


3.5) Executar testes unitários:

pytest tests/unit/ -v


Deve mostrar todos passando (✓)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 4: TESTES DE INTEGRAÇÃO (90 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4.1) Criar: tests/integration/test_api_senhas.py

Testa endpoints /api/senhas/*


4.2) Criar: tests/integration/test_api_auth.py

Testa endpoints /api/auth/*


4.3) Criar: tests/integration/test_api_filas.py

Testa endpoints /api/filas/*


4.4) Criar: tests/integration/test_fluxo_completo.py

Testa fluxo: emitir → chamar → iniciar → finalizar


4.5) Executar testes de integração:

pytest tests/integration/ -v


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 5: TESTES DE CARGA (30 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5.1) Criar: tests/load/test_performance.py

Testa performance com muitas requisições


5.2) Executar:

pytest tests/load/ -v


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 6: COVERAGE REPORT (10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6.1) Executar todos os testes com coverage:

pytest --cov=app --cov-report=html --cov-report=term


6.2) Ver relatório no terminal


6.3) Abrir relatório HTML:

start htmlcov\\index.html


Meta: Coverage > 80%


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 7: EXECUTAR TODOS OS TESTES (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

pytest -v --cov=app --cov-report=term-missing


Resultado esperado:
- Total: 50+ testes
- Passou: 50+
- Falhou: 0
- Coverage: > 80%


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 8: COMMIT DAS MUDANÇAS (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

git add tests/
git add pytest.ini
git add .coveragerc

git commit -m "feat: implementa FASE 5 - Suite de Testes Completa

Testes Unitários:
- test_models.py (Senha, Atendente, Servico)
- test_services.py (SenhaService)
- test_schemas.py (Validações Marshmallow)
- test_rate_limiter.py (Rate limiting)

Testes de Integração:
- test_api_senhas.py (endpoints /api/senhas/*)
- test_api_auth.py (endpoints /api/auth/*)
- test_api_filas.py (endpoints /api/filas/*)
- test_fluxo_completo.py (fluxo end-to-end)

Testes de Carga:
- test_performance.py (stress testing)

Coverage:
- > 80% de cobertura de código
- Relatório HTML gerado

TESTED:
✅ 50+ testes passando
✅ Coverage > 80%
✅ Testes unitários, integração e carga
✅ CI/CD ready"

git push origin main


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CHECKLIST FINAL - FASE 5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

□ pytest instalado
□ Estrutura tests/ criada
□ conftest.py configurado
□ pytest.ini criado
□ Testes unitários criados (4 arquivos)
□ Testes de integração criados (4 arquivos)
□ Testes de carga criados (1 arquivo)
□ Todos os testes passando
□ Coverage > 80%
□ Relatório HTML gerado
□ Mudanças commitadas


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 FASE 5 COMPLETA!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Conquistou:
✅ Suite de testes profissional
✅ 50+ testes automatizados
✅ Coverage > 80%
✅ Testes unitários, integração e carga
✅ CI/CD ready
✅ Relatórios detalhados

Próximas fases:
□ FASE 6: Logs e Observabilidade (1-2h)
□ FASE 7: Documentação Swagger (1-2h)

Backend: 85% completo! 🚀


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

if __name__ == "__main__":
    print(GUIA_COMPLETO)
