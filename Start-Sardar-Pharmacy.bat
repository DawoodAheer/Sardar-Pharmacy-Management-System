@echo off
TITLE Sardar Medical Store - Starting Application...
:: Determine batch script directory safely
SET "SCRIPT_DIR=%~dp0"
CD /D "%SCRIPT_DIR%"

:: Auto-pull latest updates from GitHub if Git is installed
WHERE git >nul 2>nul
IF %ERRORLEVEL% EQU 0 (
    echo [INFO] Checking for latest updates from GitHub...
    git pull --quiet origin main >nul 2>nul
)

:: Launch PowerShell launcher with execution policy bypass
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\start-pharmacy.ps1"

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Sardar Medical Store launcher encountered an issue.
    pause
)
