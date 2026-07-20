@echo off
title Satisfactory Manager
cd /d "%~dp0"
npm start
if errorlevel 1 (
  echo.
  echo Avvio fallito. Controlla che Node.js e npm siano installati e che le dipendenze siano state installate ^(npm install^).
  pause
)
