@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Work-Mode needs Node.js 22 or newer.
  echo Install it from https://nodejs.org/ then open this file again.
  pause
  exit /b 1
)
echo Installing Work-Mode...
call npm install
if errorlevel 1 goto :failed
echo Installing the browser...
call npx playwright install chromium
if errorlevel 1 goto :failed
if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Your local .env file has been created.
  echo Add your OPENAI_API_KEY on the first line, after the = sign.
  echo Do not share the key or upload this file to GitHub.
  notepad .env
)
echo.
echo Setup finished. Double-click start-windows.cmd next.
pause
exit /b 0
:failed
echo Setup failed. Please copy the error message before closing.
pause
exit /b 1
