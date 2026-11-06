@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  echo Run setup-windows.cmd first.
  pause
  exit /b 1
)
echo.
echo Work-Mode is starting on http://127.0.0.1:3168
echo Keep this window open while using Work-Mode.
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:3168'"
call npm start
if errorlevel 1 (
  echo Work-Mode could not start. Check the error above.
  pause
)
