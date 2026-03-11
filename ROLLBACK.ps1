# ============================================================
# SCRIPT DE ROLLBACK - RESTAURAR BACKUP
# Sistema IMTSB - Reverter para versão anterior
# ============================================================

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  ROLLBACK - SISTEMA IMTSB" -ForegroundColor Yellow
Write-Host "  Restaurando arquivos do backup" -ForegroundColor Yellow
Write-Host "============================================================`n" -ForegroundColor Cyan

# Listar backups disponíveis
$backups = Get-ChildItem -Directory -Filter "backup_*" | Sort-Object Name -Descending

if ($backups.Count -eq 0) {
    Write-Host "❌ Nenhum backup encontrado!" -ForegroundColor Red
    Write-Host "   Não há nada para restaurar." -ForegroundColor Yellow
    exit 1
}

Write-Host "Backups disponíveis:" -ForegroundColor Green
for ($i = 0; $i -lt $backups.Count; $i++) {
    Write-Host "  [$i] $($backups[$i].Name) - $($backups[$i].CreationTime)" -ForegroundColor Cyan
}

Write-Host ""
$escolha = Read-Host "Digite o número do backup para restaurar (0-$($backups.Count - 1))"

if ($escolha -match '^\d+$' -and [int]$escolha -ge 0 -and [int]$escolha -lt $backups.Count) {
    $backupDir = $backups[[int]$escolha].Name
    
    Write-Host "`n[1/3] Restaurando arquivos de: $backupDir" -ForegroundColor Green
    
    # Restaurar fila_controller.py
    if (Test-Path "$backupDir/fila_controller.py.bak") {
        Copy-Item "$backupDir/fila_controller.py.bak" "app/controllers/fila_controller.py" -Force
        Write-Host "   ✅ fila_controller.py restaurado" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  fila_controller.py não encontrado no backup" -ForegroundColor Yellow
    }
    
    # Restaurar realtime-store.js
    if (Test-Path "$backupDir/realtime-store.js.bak") {
        Copy-Item "$backupDir/realtime-store.js.bak" "static/js/realtime-store.js" -Force
        Write-Host "   ✅ realtime-store.js restaurado" -ForegroundColor Cyan
    } else {
        Write-Host "   ⚠️  realtime-store.js não encontrado no backup" -ForegroundColor Yellow
    }
    
    Write-Host "`n[2/3] Arquivos restaurados com sucesso!" -ForegroundColor Green
    
    Write-Host "`n[3/3] Próximo passo:" -ForegroundColor Green
    Write-Host "   Reinicie o servidor:" -ForegroundColor Cyan
    Write-Host "   python run.py" -ForegroundColor White
    
    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "  ROLLBACK CONCLUÍDO!" -ForegroundColor Green
    Write-Host "============================================================`n" -ForegroundColor Cyan
    
} else {
    Write-Host "`n❌ Opção inválida!" -ForegroundColor Red
    exit 1
}
