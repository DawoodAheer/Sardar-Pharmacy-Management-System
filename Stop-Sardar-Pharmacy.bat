@echo off
TITLE Sardar Pharmacy - Safe Shutdown
SET "SCRIPT_DIR=%~dp0"
CD /D "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\stop-pharmacy.ps1"

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Shutdown script encountered an issue.
    pause
)
