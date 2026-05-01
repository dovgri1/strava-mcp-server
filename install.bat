@echo off
echo Downloading latest installer...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/dovgri1/strava-mcp-server/main/install.ps1' -OutFile '%~dp0install.ps1' -UseBasicParsing"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
