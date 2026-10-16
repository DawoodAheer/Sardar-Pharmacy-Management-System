@echo off
TITLE Sardar Medical Store - Reset Business Data
CD /D "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\reset-pharmacy-data.ps1"
pause
