@echo off
TITLE Sardar Medical Store - Copy Backup to External Drive
SET "SCRIPT_DIR=%~dp0"
CD /D "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\copy-backup.ps1"

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Copy to external drive failed.
    pause
)
