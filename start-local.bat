@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\start-local.ps1"
pause
