# Script de monitoreo para Windows PowerShell
# Ejecutar: .\scripts\monitor.ps1

Write-Host "🔍 Monitoreo de Tiendita" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# 1. Estado de contenedores
Write-Host "📦 Estado de Contenedores:" -ForegroundColor Yellow
Write-Host "---------------------------"
docker compose ps
Write-Host ""

# 2. Health check
Write-Host "🏥 Health Check:" -ForegroundColor Yellow
Write-Host "----------------"
$healthUrl = "http://localhost:4321/api/health"
try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Aplicación saludable" -ForegroundColor Green
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
    } else {
        Write-Host "❌ Aplicación no responde correctamente (HTTP $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ No se pudo conectar a la aplicación" -ForegroundColor Red
    Write-Host $_.Exception.Message
}
Write-Host ""

# 3. Uso de recursos
Write-Host "💻 Uso de Recursos:" -ForegroundColor Yellow
Write-Host "-------------------"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>$null
Write-Host ""

# 4. Espacio en disco
Write-Host "💾 Espacio en Disco:" -ForegroundColor Yellow
Write-Host "--------------------"
Get-PSDrive C | Select-Object Used, Free, @{Name="Total";Expression={$_.Used + $_.Free}} | Format-Table
Write-Host ""

# 5. Últimos errores
Write-Host "🚨 Últimos Errores (últimas 10 líneas):" -ForegroundColor Yellow
Write-Host "----------------------------------------"
docker compose logs --tail=50 app 2>$null | Select-String -Pattern "error" -CaseSensitive:$false | Select-Object -Last 10
Write-Host ""

# 6. Logs de nginx
Write-Host "🌐 Últimos Logs de Nginx (últimas 5 líneas):" -ForegroundColor Yellow
Write-Host "---------------------------------------------"
docker compose logs --tail=5 nginx 2>$null
Write-Host ""

Write-Host "✅ Monitoreo completado" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "  - Ver logs en tiempo real: docker compose logs -f app"
Write-Host "  - Ver solo errores: docker compose logs app | Select-String -Pattern error"
Write-Host "  - Reiniciar app: docker compose restart app"
