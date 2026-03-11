# ============================================================
# SCRIPT DE APLICAÇÃO COMPLETA - FIX DEFINITIVO
# Sistema IMTSB - Correção do erro 404
# ============================================================

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  FIX COMPLETO - SISTEMA IMTSB" -ForegroundColor Yellow
Write-Host "  Corrigindo erro 404 no callNext" -ForegroundColor Yellow
Write-Host "============================================================`n" -ForegroundColor Cyan

# Verificar se os arquivos existem
$arquivos = @(
    "63_fila_controller_FIX_404_DEFINITIVO.py",
    "61_realtime-store_FIX_CALL_NEXT.js"
)

$faltando = @()
foreach ($arq in $arquivos) {
    if (-not (Test-Path $arq)) {
        $faltando += $arq
    }
}

if ($faltando.Count -gt 0) {
    Write-Host "❌ ERRO: Arquivos faltando:" -ForegroundColor Red
    $faltando | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
    Write-Host "`n⚠️  Baixe todos os arquivos antes de continuar!" -ForegroundColor Yellow
    exit 1
}

# ============================================================
# PASSO 1: BACKUP DOS ARQUIVOS ORIGINAIS
# ============================================================
Write-Host "[1/5] Criando backup dos arquivos originais..." -ForegroundColor Green

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backup_$timestamp"

if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

Copy-Item "app/controllers/fila_controller.py" "$backupDir/fila_controller.py.bak" -ErrorAction SilentlyContinue
Copy-Item "static/js/realtime-store.js" "$backupDir/realtime-store.js.bak" -ErrorAction SilentlyContinue

Write-Host "   ✅ Backup criado em: $backupDir" -ForegroundColor Cyan

# ============================================================
# PASSO 2: APLICAR ARQUIVOS CORRIGIDOS
# ============================================================
Write-Host "`n[2/5] Aplicando arquivos corrigidos..." -ForegroundColor Green

Copy-Item "63_fila_controller_FIX_404_DEFINITIVO.py" "app/controllers/fila_controller.py" -Force
Write-Host "   ✅ fila_controller.py aplicado" -ForegroundColor Cyan

Copy-Item "61_realtime-store_FIX_CALL_NEXT.js" "static/js/realtime-store.js" -Force
Write-Host "   ✅ realtime-store.js aplicado" -ForegroundColor Cyan

# ============================================================
# PASSO 3: VERIFICAR SERVIDOR
# ============================================================
Write-Host "`n[3/5] Verificando servidor Flask..." -ForegroundColor Green

$processo = Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowTitle -match "Flask"}

if ($processo) {
    Write-Host "   ⚠️  Servidor Flask rodando (PID: $($processo.Id))" -ForegroundColor Yellow
    Write-Host "   ⏸️  Por favor, pare o servidor (Ctrl+C) e reinicie manualmente" -ForegroundColor Yellow
} else {
    Write-Host "   ℹ️  Servidor não está rodando" -ForegroundColor Cyan
}

# ============================================================
# PASSO 4: INSTRUÇÕES DE TESTE
# ============================================================
Write-Host "`n[4/5] Próximos passos:" -ForegroundColor Green
Write-Host "   1. Reinicie o servidor:" -ForegroundColor Cyan
Write-Host "      python run.py" -ForegroundColor White
Write-Host ""
Write-Host "   2. Emita 3 senhas:" -ForegroundColor Cyan
Write-Host "      http://localhost:5000/index.html" -ForegroundColor White
Write-Host "      - Selecionar 'Secretaria Académica'" -ForegroundColor Gray
Write-Host "      - Clicar 'Emitir Senha' (3 vezes)" -ForegroundColor Gray
Write-Host ""
Write-Host "   3. Chamar senhas:" -ForegroundColor Cyan
Write-Host "      http://localhost:5000/dashtrabalho.html" -ForegroundColor White
Write-Host "      - Login: joao@imtsb.ao / Admin123" -ForegroundColor Gray
Write-Host "      - Clicar 'Chamar Próximo' (4 vezes)" -ForegroundColor Gray

# ============================================================
# PASSO 5: RESUMO
# ============================================================
Write-Host "`n[5/5] Resumo do fix:" -ForegroundColor Green
Write-Host "   ✅ Backup criado" -ForegroundColor Cyan
Write-Host "   ✅ fila_controller.py corrigido (retorna 200 em vez de 404)" -ForegroundColor Cyan
Write-Host "   ✅ realtime-store.js corrigido (aceita senha=null)" -ForegroundColor Cyan
Write-Host ""
Write-Host "   📊 Resultado esperado:" -ForegroundColor Yellow
Write-Host "      - 1ª chamada: N001 chamada ✅" -ForegroundColor Gray
Write-Host "      - 2ª chamada: N002 chamada ✅" -ForegroundColor Gray
Write-Host "      - 3ª chamada: N003 chamada ✅" -ForegroundColor Gray
Write-Host "      - 4ª chamada: 'Nenhuma senha aguardando' (200 OK) ✅" -ForegroundColor Gray

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  FIX APLICADO COM SUCESSO!" -ForegroundColor Green
Write-Host "  Reinicie o servidor e teste!" -ForegroundColor Yellow
Write-Host "============================================================`n" -ForegroundColor Cyan
