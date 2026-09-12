@echo off
TITLE Sardar Pharmacy - Backup Generator
SET "SCRIPT_DIR=%~dp0"
CD /D "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\backup-pharmacy.ps1" -BackupType "manual"

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backup process failed.
    pause
)
