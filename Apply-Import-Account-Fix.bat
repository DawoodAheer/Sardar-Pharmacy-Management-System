@echo off
TITLE Sardar Medical Store - Import Account Repair
CD /D "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\apply-import-account-fix.ps1"
IF ERRORLEVEL 1 (
    echo Repair or startup failed. Keep this window's message for support.
    pause
    exit /b 1
)
echo Repair complete. Sign out, sign in, and retry your Excel import.
pause
