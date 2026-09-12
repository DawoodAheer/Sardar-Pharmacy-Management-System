@echo off
TITLE Sardar Pharmacy - Database Restore Utility
SET "SCRIPT_DIR=%~dp0"
CD /D "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\restore-pharmacy.ps1"

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Restore process failed.
    pause
)
