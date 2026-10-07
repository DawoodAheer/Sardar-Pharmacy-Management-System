# =====================================================================
# Sardar Medical Store - Safe Shutdown Script (PowerShell)
# =====================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir\..").Path

Set-Location $ProjectRoot

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "         Sardar Medical Store SAFE SHUTDOWN               " -ForegroundColor Red
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Project Location: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

Write-Host "Stopping Docker containers safely..." -ForegroundColor Yellow

# IMPORTANT: docker compose stop stops containers without removing them or volume data
try {
    docker compose stop
    Write-Host ""
    Write-Host "[OK] All Sardar Medical Store services stopped successfully!" -ForegroundColor Green
    Write-Host "[DATA SAFE] Your MongoDB database and file uploads are preserved." -ForegroundColor Cyan
    Write-Host "You can restart the application anytime using 'Start-Sardar-Pharmacy.bat'." -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Error stopping containers: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to close this console window..." -ForegroundColor Gray
try { $null = [Console]::ReadKey() } catch {}
