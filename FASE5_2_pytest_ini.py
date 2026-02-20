# ===== FASE 5.2: PYTEST.INI - CONFIGURAÇÃO =====

"""
pytest.ini

Configuração do pytest na raiz do projeto
"""

PYTEST_INI = """
[pytest]
# Diretórios de teste
testpaths = tests

# Padrão de arquivos de teste
python_files = test_*.py
python_classes = Test*
python_functions = test_*

# Opções padrão
addopts = 
    -v
    --strict-markers
    --tb=short
    --disable-warnings

# Markers personalizados
markers =
    unit: Testes unitários
    integration: Testes de integração
    load: Testes de carga
    slow: Testes lentos (> 1s)
    
# Configuração de coverage
[coverage:run]
source = app
omit = 
    */tests/*
    */venv/*
    */__pycache__/*
    */migrations/*

[coverage:report]
precision = 2
show_missing = True
skip_covered = False
"""

# ===== .COVERAGERC (OPCIONAL) =====

COVERAGERC = """
[run]
source = app
omit =
    */tests/*
    */venv/*
    */__pycache__/*
    */migrations/*
    app/__init__.py

[report]
precision = 2
exclude_lines =
    pragma: no cover
    def __repr__
    raise AssertionError
    raise NotImplementedError
    if __name__ == .__main__.:
    if TYPE_CHECKING:
"""

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║  FASE 5.2 - PYTEST.INI + COVERAGERC                          ║
╚══════════════════════════════════════════════════════════════╝

CRIAR ARQUIVOS NA RAIZ DO PROJETO:
────────────────────────────────────────────────────────────────

1. pytest.ini
────────────────────────────────────────────────────────────────
""" + PYTEST_INI + """

2. .coveragerc (opcional)
────────────────────────────────────────────────────────────────
""" + COVERAGERC + """

PRÓXIMO: FASE5_3_test_models.py
    """)
