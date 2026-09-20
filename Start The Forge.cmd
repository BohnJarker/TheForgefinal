@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo The Forge requires Node.js 22 or newer. Install it from https://nodejs.org/ and reopen this launcher.
  pause
  exit /b 1
)
powershell -NoProfile -Command "Start-Process -FilePath 'node' -ArgumentList 'serve.mjs --open' -WorkingDirectory (Get-Location).Path -WindowStyle Hidden"
