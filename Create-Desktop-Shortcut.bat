@echo off
TITLE Sardar Pharmacy - Create Desktop Shortcut
SET "SCRIPT_DIR=%~dp0"
CD /D "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\create-shortcut.ps1"

IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Shortcut creation failed.
    pause
)
