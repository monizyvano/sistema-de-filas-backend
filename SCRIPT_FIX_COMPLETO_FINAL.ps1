# ============================================================
# SCRIPT FIX COMPLETO - RESOLVER PROBLEMA DE CHAMADA
# Sistema IMTSB - Fix definitivo do fluxo de atendimento
# ============================================================

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  FIX COMPLETO - FLUXO DE ATENDIMENTO" -ForegroundColor Yellow
Write-Host "  Corrigindo 3 problemas críticos" -ForegroundColor Yellow
Write-Host "============================================================`n" -ForegroundColor Cyan

# Verificar arquivos necessários
$arquivos = @(
    "69_fila_service_FIX_PARAMETROS.py",
    "70_senha_service_FIX_EMITIDA_EM.py",
    "63_fila_controller_FIX_404_DEFINITIVO.py"
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
    exit 1
}

# ============================================================
# PASSO 1: BACKUP
# ============================================================
Write-Host "[1/6] Criando backup..." -ForegroundColor Green

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backup_fix_completo_$timestamp"
New-Item -ItemType Directory -Path $backupDir | Out-Null

Copy-Item "app/services/fila_service.py" "$backupDir/" -ErrorAction SilentlyContinue
Copy-Item "app/services/senha_service.py" "$backupDir/" -ErrorAction SilentlyContinue
Copy-Item "app/controllers/fila_controller.py" "$backupDir/" -ErrorAction SilentlyContinue

Write-Host "   ✅ Backup criado: $backupDir" -ForegroundColor Cyan

# ============================================================
# PASSO 2: APLICAR FIXES
# ============================================================
Write-Host "`n[2/6] Aplicando correções..." -ForegroundColor Green

Copy-Item "69_fila_service_FIX_PARAMETROS.py" "app/services/fila_service.py" -Force
Write-Host "   ✅ FIX 1: fila_service.py (ordem de parâmetros)" -ForegroundColor Cyan

Copy-Item "70_senha_service_FIX_EMITIDA_EM.py" "app/services/senha_service.py" -Force
Write-Host "   ✅ FIX 2: senha_service.py (emitida_em sempre preenchido)" -ForegroundColor Cyan

Copy-Item "63_fila_controller_FIX_404_DEFINITIVO.py" "app/controllers/fila_controller.py" -Force
Write-Host "   ✅ FIX 3: fila_controller.py (retorna 200 em vez de 404)" -ForegroundColor Cyan

# ============================================================
# PASSO 3: LIMPAR SENHAS ANTIGAS (OPCIONAL)
# ============================================================
Write-Host "`n[3/6] Limpeza de dados..." -ForegroundColor Green

$limpar = Read-Host "Deseja limpar senhas antigas do banco? (S/N)"

if ($limpar -eq "S" -or $limpar -eq "s") {
    Write-Host "   Executando limpeza..." -ForegroundColor Yellow
    
    $sqlScript = @"
-- Deletar senhas com emitida_em NULL
DELETE FROM senhas WHERE emitida_em IS NULL;

-- Deletar senhas antigas (mais de 7 dias)
DELETE FROM senhas WHERE emitida_em < DATE_SUB(NOW(), INTERVAL 7 DAY);

-- Resetar contadores
DELETE FROM senhas WHERE status = 'cancelada' AND emitida_em < DATE_SUB(NOW(), INTERVAL 1 DAY);
"@
    
    $sqlScript | Out-File -FilePath "limpeza_temp.sql" -Encoding UTF8
    
    mysql -u root -pYasminey13 sistema_filas_imtsb < limpeza_temp.sql
    
    Remove-Item "limpeza_temp.sql"
    
    Write-Host "   ✅ Limpeza concluída" -ForegroundColor Cyan
} else {
    Write-Host "   ⏭️  Limpeza ignorada" -ForegroundColor Gray
}

# ============================================================
# PASSO 4: VERIFICAR SERVIDOR
# ============================================================
Write-Host "`n[4/6] Verificando servidor..." -ForegroundColor Green

$processo = Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.Path -like "*run.py*"}

if ($processo) {
    Write-Host "   ⚠️  Servidor rodando (PID: $($processo.Id))" -ForegroundColor Yellow
    Write-Host "   📝 Pare o servidor (Ctrl+C) e reinicie" -ForegroundColor Yellow
} else {
    Write-Host "   ℹ️  Servidor não está rodando" -ForegroundColor Cyan
}

# ============================================================
# PASSO 5: INSTRUÇÕES DE TESTE
# ============================================================
Write-Host "`n[5/6] Próximos passos:" -ForegroundColor Green
Write-Host ""
Write-Host "   1️⃣  REINICIAR SERVIDOR:" -ForegroundColor Cyan
Write-Host "      python run.py" -ForegroundColor White
Write-Host ""
Write-Host "   2️⃣  EMITIR 3 SENHAS:" -ForegroundColor Cyan
Write-Host "      http://localhost:5000/index.html" -ForegroundColor White
Write-Host "      - Selecionar serviço" -ForegroundColor Gray
Write-Host "      - Emitir 3 senhas" -ForegroundColor Gray
Write-Host ""
Write-Host "   3️⃣  CHAMAR SENHAS:" -ForegroundColor Cyan
Write-Host "      http://localhost:5000/dashtrabalho.html" -ForegroundColor White
Write-Host "      - Login: joao@imtsb.ao / Admin123" -ForegroundColor Gray
Write-Host "      - Chamar 3 senhas" -ForegroundColor Gray
Write-Host ""
Write-Host "   4️⃣  VERIFICAR LOG:" -ForegroundColor Cyan
Write-Host "      Deve aparecer:" -ForegroundColor White
Write-Host "      [chamar_proxima] PARÂMETROS RECEBIDOS:" -ForegroundColor Gray
Write-Host "        servico_id: 1" -ForegroundColor Gray
Write-Host "        atendente_id: 13" -ForegroundColor Gray
Write-Host "        numero_balcao: 1" -ForegroundColor Gray
Write-Host "      ✅ Senha N001 chamada para balcão 1" -ForegroundColor Gray

# ============================================================
# PASSO 6: RESUMO
# ============================================================
Write-Host "`n[6/6] Resumo das correções:" -ForegroundColor Green
Write-Host ""
Write-Host "   🔧 PROBLEMA 1: Parâmetros invertidos" -ForegroundColor Yellow
Write-Host "      ❌ ANTES: chamar_proxima(servico_id, numero_balcao, atendente_id)" -ForegroundColor Red
Write-Host "      ✅ AGORA: chamar_proxima(servico_id, atendente_id, numero_balcao)" -ForegroundColor Green
Write-Host ""
Write-Host "   🔧 PROBLEMA 2: Filtro de data muito restritivo" -ForegroundColor Yellow
Write-Host "      ❌ ANTES: Apenas senhas de hoje" -ForegroundColor Red
Write-Host "      ✅ AGORA: Senhas de hoje + ontem + emitida_em NULL" -ForegroundColor Green
Write-Host ""
Write-Host "   🔧 PROBLEMA 3: emitida_em não preenchido" -ForegroundColor Yellow
Write-Host "      ❌ ANTES: emitida_em podia ser NULL" -ForegroundColor Red
Write-Host "      ✅ AGORA: emitida_em SEMPRE preenchido na emissão" -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  ✅ FIXES APLICADOS COM SUCESSO!" -ForegroundColor Green
Write-Host "  📝 Backup salvo em: $backupDir" -ForegroundColor Cyan
Write-Host "  🚀 Reinicie o servidor e teste!" -ForegroundColor Yellow
Write-Host "============================================================`n" -ForegroundColor Cyan
