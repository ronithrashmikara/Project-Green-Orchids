@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Project Green - one-click launcher
echo ============================================

echo Starting API server (port 5000)...
start "Project Green API" cmd /k "cd /d ""%~dp0apps\api"" && node src\index.js"

where stripe >nul 2>&1
if errorlevel 1 (
  echo Stripe CLI was not found. Install it and run: stripe listen --forward-to localhost:5000/api/payments/stripe/webhook
) else (
  echo Starting Stripe webhook listener...
  start "Project Green Stripe Webhook" cmd /k "stripe listen --forward-to localhost:5000/api/payments/stripe/webhook"
)

echo Building and starting Web app (port 3000)...
rem next dev OOMs on this box compiling all routes; build once then next start is stable.
start "Project Green Web" cmd /k "cd /d ""%~dp0apps\web"" && set NODE_OPTIONS=--max-old-space-size=4096 && npm run build && npx next start -p 3000"

echo Waiting for http://localhost:3000 to come up...
:waitloop
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('localhost',3000); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  timeout /t 3 /nobreak >nul
  goto waitloop
)

echo Web app is up. Opening browser...
start "" "http://localhost:3000"

endlocal
