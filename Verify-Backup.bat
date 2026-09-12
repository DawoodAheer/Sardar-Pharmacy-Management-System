@echo off
TITLE Sardar Pharmacy - Backup Verifier
SET "SCRIPT_DIR=%~dp0"
CD /D "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\verify-backup.ps1"

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backup verification failed.
    pause
)
