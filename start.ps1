# ============================================
# Sardar Pharmacy - Clean Start Script
# Run this instead of npm run dev
# ============================================

Write-Host "Stopping any running Node processes..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "Making sure MongoDB Docker container is running..." -ForegroundColor Yellow
docker compose up -d mongodb 2>&1 | Out-Null
Start-Sleep -Seconds 3

Write-Host "Clearing ports 5173 and 6000..." -ForegroundColor Yellow
npx -y kill-port 5173 5174 6000 2>&1 | Out-Null
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting Sardar Pharmacy System..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

npm run dev
