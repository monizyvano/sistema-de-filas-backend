# ===== FASE 2: GUIA PASSO-A-PASSO =====

"""
Sistema de Filas IMTSB - FASE 2: Proteção Contra Race Conditions

Objetivo: Evitar duplicação de senhas em acessos simultâneos
Tempo estimado: 1-2 horas
Complexidade: Média
Risco: Baixo (apenas atualiza service, não mexe no banco)
"""

GUIA_COMPLETO = """
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  FASE 2: PROTEÇÃO CONTRA RACE CONDITIONS                    ║
║                                                              ║
║  OBJETIVO: Evitar duplicação em acessos simultâneos         ║
║  TEMPO: 1-2 horas                                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 O QUE SÃO RACE CONDITIONS?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CENÁRIO PROBLEMÁTICO:
────────────────────────────────────────────────────────────────

Tempo  │ Usuário A                │ Usuário B
───────┼──────────────────────────┼──────────────────────────
10:00  │ Clica "emitir senha"     │
10:01  │ Lê última: N005          │ Clica "emitir senha"
10:02  │                          │ Lê última: N005 (mesmo!)
10:03  │ Cria N006                │ Tenta criar N006
10:04  │ ✅ Sucesso               │ ❌ ERRO! Duplicado!

OU PIOR:

10:00  │ Clica "emitir senha"     │
10:01  │ Lê última: N005          │ Clica "emitir senha"
10:02  │                          │ Lê última: N005
10:03  │ Cria N006                │ Cria N006
10:04  │ ✅ Sucesso               │ ✅ Sucesso ← DUPLICADO! ❌


COM PROTEÇÃO (LOCKS):
────────────────────────────────────────────────────────────────

Tempo  │ Usuário A                │ Usuário B
───────┼──────────────────────────┼──────────────────────────
10:00  │ Clica "emitir senha"     │
10:01  │ 🔒 LOCK → Lê última: N005│ Clica "emitir senha"
10:02  │ Cria N006                │ ⏳ AGUARDA (bloqueado)
10:03  │ COMMIT → 🔓 UNLOCK       │
10:04  │ ✅ N006 criada           │ 🔒 LOCK → Lê última: N006
10:05  │                          │ Cria N007
10:06  │                          │ ✅ N007 criada


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 1: ATUALIZAR SENHA SERVICE (10 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1.1) Fazer backup
────────────────────────────────────────────────────────────────
cd /caminho/do/projeto
cp app/services/senha_service.py app/services/senha_service.py.backup_fase2


1.2) Abrir FASE2_1_senha_service_com_lock.py

1.3) Copiar TODO o conteúdo (Ctrl+A, Ctrl+C)

1.4) Abrir app/services/senha_service.py

1.5) Colar e substituir tudo (Ctrl+A, Ctrl+V)

1.6) Salvar (Ctrl+S)


1.7) Verificar mudanças principais:
────────────────────────────────────────────────────────────────
# Deve ter estas linhas novas:

- MAX_RETRIES = 3
- RETRY_DELAY = 0.1
- with_for_update()  ← IMPORTANTE!
- try/except IntegrityError
- try/except OperationalError


✅ Service atualizado!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 2: REINICIAR SERVIDOR (1 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2.1) Se servidor está rodando, pare (Ctrl+C)

2.2) Reinicie:

python run.py

2.3) Deve iniciar sem erros


✅ Servidor rodando com nova versão!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 3: TESTE RÁPIDO (2 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3.1) Em outro terminal, teste emissão normal:

python -c "from app import create_app; from app.services.senha_service import SenhaService; app=create_app(); app.app_context().push(); s=SenhaService.emitir(1,'normal'); print(f'✅ {s.numero}')"


3.2) Deve funcionar normalmente e mostrar: ✅ NXXX


✅ Service funcionando!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 4: TESTES DE CONCORRÊNCIA (20-30 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4.1) Executar testes:

python FASE2_2_teste_concorrencia.py


4.2) O que vai acontecer:
────────────────────────────────────────────────────────────────

TESTE 1: Sequencial (10 senhas)
   → Baseline, deve passar sempre

TESTE 2: Concorrência Leve (5 threads)
   → Primeiro teste real de concorrência
   → CRÍTICO: Não pode ter duplicados!

TESTE 3: Concorrência Pesada (20 threads)
   → Stress moderado
   → Pode ter algumas falhas (retry)
   → Mas ZERO duplicados!

TESTE 4: Mix Normal/Prioritária (15 threads)
   → Testa se N e P não se misturam
   → ZERO duplicados em cada tipo

TESTE 5: Stress (50 threads)
   → Teste extremo
   → Taxa de sucesso deve ser > 80%
   → ZERO duplicados


4.3) Resultado esperado:
────────────────────────────────────────────────────────────────

🧪 TESTES DE CONCORRÊNCIA - SISTEMA DE FILAS IMTSB
══════════════════════════════════════════════════

TESTE: 1. Emissão Sequencial (Baseline)
══════════════════════════════════════════════════
✅ Nenhum duplicado (esperado em execução sequencial)

TESTE: 2. Concorrência Leve (5 threads simultâneas)
══════════════════════════════════════════════════
   Thread  1: ✅ N001
   Thread  2: ✅ N002
   Thread  3: ✅ N003
   Thread  4: ✅ N004
   Thread  5: ✅ N005

   Tempo total: 50.23ms
   Sucessos: 5/5
   Falhas: 0/5
✅ Nenhum duplicado encontrado!
✅ Sistema protegido contra race condition!

[... outros testes ...]

📊 RESUMO DOS TESTES DE CONCORRÊNCIA
══════════════════════════════════════════════════
✅ PASSOU - Sequencial (Baseline)
✅ PASSOU - Concorrência Leve (5 threads)
✅ PASSOU - Concorrência Pesada (20 threads)
✅ PASSOU - Mix Normal/Prioritária
✅ PASSOU - Stress Test (50 threads)

Total: 5 testes
Passou: 5
Falhou: 0

✅ TODOS OS TESTES PASSARAM!
Sistema protegido contra race conditions!


4.4) Se algum teste falhou:
────────────────────────────────────────────────────────────────

SE: Teste mostra DUPLICADOS
    → Service não foi atualizado corretamente
    → Verifique se tem with_for_update() na query

SE: Muitas falhas (> 20%)
    → Pode ser problema de timeout do MySQL
    → Normal ter algumas falhas, mas não mais que 20%

SE: Erro de importação
    → Limpe cache: python -c "import shutil, pathlib; [shutil.rmtree(p, ignore_errors=True) for p in pathlib.Path('.').rglob('__pycache__')]"
    → Tente novamente


✅ Testes de concorrência passaram!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 5: TESTE VIA API (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5.1) Com servidor rodando, teste múltiplas requisições:

# Windows PowerShell:
for ($i=1; $i -le 10; $i++) { 
    Start-Job -ScriptBlock { 
        Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/senhas" -Headers @{"Content-Type"="application/json"} -Body '{"servico_id":1,"tipo":"normal"}' 
    } 
}
Get-Job | Wait-Job | Receive-Job | Select -ExpandProperty numero

# Linux/Mac:
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/senhas \\
    -H "Content-Type: application/json" \\
    -d '{"servico_id":1,"tipo":"normal"}' &
done
wait


5.2) Resultado esperado:
────────────────────────────────────────────────────────────────
10 senhas sequenciais, sem duplicados:
NXXX, NYYY, NZZZ... (todos diferentes)


✅ API funcionando com proteção!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 6: VERIFICAÇÃO NO BANCO (2 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6.1) No MySQL:

SELECT numero, data_emissao, COUNT(*) as qtd
FROM senhas
WHERE data_emissao = CURRENT_DATE
GROUP BY numero, data_emissao
HAVING COUNT(*) > 1;


6.2) Resultado esperado:
────────────────────────────────────────────────────────────────
Empty set (0.00 sec)

Se aparecer alguma linha = TEM DUPLICADO! ❌


✅ Zero duplicados no banco!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 7: VALIDAÇÃO FINAL (2 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Checklist:

□ Service tem with_for_update()
□ Service tem retry logic (MAX_RETRIES)
□ Service captura IntegrityError
□ Service captura OperationalError
□ Todos os testes de concorrência passaram
□ Zero duplicados nos testes
□ API funciona com requisições simultâneas
□ Banco não tem duplicados


Se TUDO ✅:

✅ FASE 2 COMPLETA!

Você implementou:
✓ Lock pessimista (SELECT FOR UPDATE)
✓ Retry logic (3 tentativas)
✓ Tratamento de deadlocks
✓ Proteção contra duplicação
✓ Sistema robusto para produção


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASSO 8: COMMIT DAS MUDANÇAS (3 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

git add app/services/senha_service.py

git commit -m "feat: adiciona proteção contra race conditions

- Implementa SELECT FOR UPDATE (lock pessimista)
- Adiciona retry logic (3 tentativas)
- Captura IntegrityError e OperationalError
- Testes de concorrência: 5 testes passando
- Suporta até 50 requisições simultâneas sem duplicação

TESTED: ✅ Zero duplicados em 50 threads simultâneas"

git push origin main


✅ Mudanças commitadas!


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 PARABÉNS! FASE 2 COMPLETA!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você completou:
✅ Proteção contra race conditions
✅ Lock pessimista implementado
✅ Retry logic funcionando
✅ Testes de concorrência passando
✅ Sistema robusto para produção

Próximos passos:
□ FASE 3: Otimização de performance (2-3h)
□ FASE 4: Validações e segurança (2h)
□ INTEGRAÇÃO COM FRONTEND 🔗


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEMA: Testes mostram duplicados
SOLUÇÃO:
  1. Verifique se service tem: .with_for_update()
  2. Linha deve ser:
     ultima_senha = db.session.query(Senha).filter(...).with_for_update().first()
  3. Reinicie servidor
  4. Teste novamente


PROBLEMA: Muitas falhas (> 30%)
SOLUÇÃO:
  1. Normal ter algumas falhas com locks
  2. Se > 50%, verifique timeout do MySQL:
     SET GLOBAL innodb_lock_wait_timeout = 50;
  3. Ou aumente MAX_RETRIES para 5


PROBLEMA: Erro "Deadlock found"
SOLUÇÃO:
  1. É esperado! Por isso temos retry logic
  2. Sistema tenta novamente automaticamente
  3. Se persistir, verifique isolation level


PROBLEMA: Performance muito lenta
SOLUÇÃO:
  1. Normal ser um pouco mais lento com locks
  2. Tradeoff: segurança vs velocidade
  3. 50-100ms é aceitável para emissão
  4. Se > 500ms, investigue queries


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

if __name__ == "__main__":
    print(GUIA_COMPLETO)
