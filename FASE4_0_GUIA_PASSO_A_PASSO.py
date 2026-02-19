# ===== FASE 4: GUIA PASSO-A-PASSO =====

"""
Sistema de Filas IMTSB - FASE 4: Validações e Segurança

Objetivo: Proteger API contra inputs inválidos e ataques
Tempo estimado: 1-2 horas
Complexidade: Média
Risco: Baixo
"""

GUIA_COMPLETO = """
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  FASE 4: VALIDAÇÕES E SEGURANÇA                              ║
║                                                              ║
║  OBJETIVO: API robusta e protegida                           ║
║  TEMPO: 1-2 horas                                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 1: INSTALAR MARSHMALLOW (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.1) Ativar venv:

venv\\Scripts\\activate


1.2) Instalar marshmallow:

pip install marshmallow --break-system-packages


1.3) Verificar instalação:

python -c "import marshmallow; print(f'✅ Marshmallow {marshmallow.__version__}')"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 2: CRIAR SCHEMAS DE VALIDAÇÃO (15 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1) Criar pasta schemas:

mkdir app\\schemas


2.2) Criar arquivo: app/schemas/__init__.py

(deixar vazio)


2.3) Criar arquivo: app/schemas/senha_schema.py

Cole o código de FASE4_1_schemas_validacao.py


2.4) Testar import:

python -c "from app.schemas.senha_schema import EmitirSenhaSchema; print('✅ Schema OK')"


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 3: CRIAR RATE LIMITER (10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1) Criar pasta utils (se não existir):

mkdir app\\utils


3.2) Verificar __init__.py:

Se não existir: echo. > app\\utils\\__init__.py


3.3) Criar arquivo: app/utils/rate_limiter.py

Cole o código de FASE4_2_rate_limiting.py


3.4) Testar:

python FASE4_2_rate_limiting.py

Deve mostrar:
✅ TODOS OS TESTES PASSARAM!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 4: ATUALIZAR SENHA CONTROLLER (20 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4.1) Fazer backup:

copy app\\controllers\\senha_controller.py app\\controllers\\senha_controller.py.backup


4.2) Abrir: app/controllers/senha_controller.py


4.3) Adicionar imports NO TOPO:

from app.schemas.senha_schema import (
    EmitirSenhaSchema, 
    ChamarSenhaSchema,
    IniciarAtendimentoSchema,
    FinalizarAtendimentoSchema,
    CancelarSenhaSchema
)
from app.utils.rate_limiter import rate_limit
from marshmallow import ValidationError


4.4) Atualizar rota /senhas [POST]:

ANTES:
@senha_bp.route('/senhas', methods=['POST'])
def emitir_senha():
    dados = request.json
    ...

DEPOIS:
@senha_bp.route('/senhas', methods=['POST'])
@rate_limit(limit=10, window=60)
def emitir_senha():
    schema = EmitirSenhaSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    ...


4.5) Repetir para todas as rotas

Use FASE4_3_aplicar_validacoes.py como referência


4.6) Salvar arquivo


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 5: ATUALIZAR AUTH CONTROLLER (10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5.1) Fazer backup:

copy app\\controllers\\auth_controller.py app\\controllers\\auth_controller.py.backup


5.2) Abrir: app/controllers/auth_controller.py


5.3) Adicionar imports:

from app.schemas.senha_schema import LoginSchema
from app.utils.rate_limiter import rate_limit
from marshmallow import ValidationError


5.4) Atualizar rota /login:

ANTES:
@auth_bp.route('/login', methods=['POST'])
def login():
    dados = request.json
    email = dados.get('email')
    ...

DEPOIS:
@auth_bp.route('/login', methods=['POST'])
@rate_limit(limit=5, window=300)  # 5 tentativas por 5 minutos
def login():
    schema = LoginSchema()
    try:
        dados = schema.load(request.json or {})
    except ValidationError as err:
        return jsonify({
            'erro': 'Dados inválidos',
            'detalhes': err.messages
        }), 400
    
    email = dados['email']
    senha = dados['senha']
    ...


5.5) Salvar arquivo


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 6: TESTAR SERVIDOR (10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6.1) Limpar cache:

python -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').rglob('__pycache__')]"


6.2) Iniciar servidor:

python run.py


6.3) Testar emissão VÁLIDA:

python -c "import requests; r=requests.post('http://localhost:5000/api/senhas', json={'servico_id':1,'tipo':'normal'}); print(r.status_code, r.json())"

Deve retornar: 201 com dados da senha


6.4) Testar emissão INVÁLIDA:

python -c "import requests; r=requests.post('http://localhost:5000/api/senhas', json={'tipo':'invalido'}); print(r.status_code, r.json())"

Deve retornar: 400 com erro de validação


6.5) Testar rate limiting:

# Fazer 15 requisições seguidas
for /L %i in (1,1,15) do @python -c "import requests; r=requests.post('http://localhost:5000/api/senhas', json={'servico_id':1,'tipo':'normal'}); print('%i:', r.status_code)"

Deve bloquear após 10ª requisição (429 Too Many Requests)


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 7: EXECUTAR TESTES AUTOMATIZADOS (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7.1) Executar testes:

python FASE4_4_teste_validacoes.py


7.2) Resultado esperado:

🧪 TESTES DE VALIDAÇÃO E SEGURANÇA - FASE 4
══════════════════════════════════════════════════

TESTE: 1. Schema Emissão - Dados Válidos
══════════════════════════════════════════════════
✅ Schema aceita dados válidos

[... outros testes ...]

📊 RESUMO DOS TESTES
══════════════════════════════════════════════════
✅ PASSOU - Schema Emissão Válido
✅ PASSOU - Schema Emissão Inválido
✅ PASSOU - Schema Login Válido
✅ PASSOU - Schema Login Inválido
✅ PASSOU - Schema Cancelamento
✅ PASSOU - Rate Limit Normal
✅ PASSOU - Rate Limit Excedido
✅ PASSOU - Rate Limit IPs Independentes
✅ PASSOU - Rate Limit Reset
✅ PASSOU - Rate Limit Headers

Total: 10 testes
Passou: 10
Falhou: 0

✅ TODOS OS TESTES PASSARAM!
Sistema com validações robustas!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 8: COMMIT DAS MUDANÇAS (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

git add app/schemas/
git add app/utils/rate_limiter.py
git add app/controllers/senha_controller.py
git add app/controllers/auth_controller.py

git commit -m "feat: implementa FASE 4 - Validações e Segurança

Schemas Marshmallow:
- EmitirSenhaSchema (validação de inputs)
- LoginSchema (email + senha)
- CancelarSenhaSchema, IniciarAtendimentoSchema, etc
- Sanitização de caracteres perigosos
- Proteção contra XSS e SQL Injection

Rate Limiting:
- 10 req/min para emissão
- 5 req/5min para login (anti brute-force)
- 30 req/min para consultas
- Headers informativos (X-RateLimit-*)

Melhorias:
- Mensagens de erro padronizadas
- Validação antes de processar
- Proteção contra spam/DDoS
- Código mais limpo e seguro

TESTED:
✅ 10/10 testes de validação passando
✅ Rate limiting funcionando
✅ Schemas rejeitam dados inválidos"

git push origin main


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ CHECKLIST FINAL - FASE 4
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

□ Marshmallow instalado
□ Schemas criados em app/schemas/
□ Rate limiter criado em app/utils/
□ senha_controller.py atualizado com validações
□ auth_controller.py atualizado com validações
□ Servidor reiniciado sem erros
□ Emissão válida funciona
□ Emissão inválida retorna 400
□ Rate limiting bloqueia após limite
□ 10/10 testes de validação passando
□ Mudanças commitadas


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 FASE 4 COMPLETA!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Conquistou:
✅ Validação robusta de todos os inputs
✅ Proteção contra XSS e SQL Injection
✅ Rate limiting para prevenir spam
✅ Proteção contra brute force no login
✅ Mensagens de erro padronizadas
✅ Sistema pronto para produção

Próximas fases:
□ FASE 5: Testes Completos (3-4h)
□ FASE 6: Logs e Observabilidade (1-2h)
□ FASE 7: Documentação Swagger (1-2h)

Backend: 60% completo! 🚀


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEMA: Erro "No module named 'marshmallow'"
SOLUÇÃO:
  pip install marshmallow --break-system-packages


PROBLEMA: ValidationError não é capturado
SOLUÇÃO:
  Verificar se import está correto:
  from marshmallow import ValidationError


PROBLEMA: Rate limiting não funciona
SOLUÇÃO:
  1. Verificar se decorator está ANTES da função:
     @rate_limit(limit=10, window=60)
     def minha_rota():
  2. Importar: from app.utils.rate_limiter import rate_limit


PROBLEMA: Servidor retorna 500 após adicionar validações
SOLUÇÃO:
  1. Ver erro no terminal
  2. Verificar imports dos schemas
  3. Limpar __pycache__
  4. Reiniciar servidor


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

if __name__ == "__main__":
    print(GUIA_COMPLETO)
