@echo off
TITLE Sardar Pharmacy - Starting Application...
:: Determine batch script directory safely
SET "SCRIPT_DIR=%~dp0"
CD /D "%SCRIPT_DIR%"

:: Launch PowerShell launcher with execution policy bypass
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\start-pharmacy.ps1"

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Sardar Pharmacy launcher encountered an issue.
    pause
)
