@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\stop-local.ps1"
pause
