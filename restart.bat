@echo off
title Photo Manager - Restart
echo ========================================
echo   Photo Manager System - Restart
echo ========================================
echo.

:: Stop services
echo [Stop] Stopping existing services...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo [Wait] Waiting for ports to release...
timeout /t 5 /nobreak >nul

:: Start backend
echo [Start] Starting backend...
cd /d D:\MySoftware\photo-manager\backend
start "photo-backend" cmd /c "python main.py"

:: Start frontend
echo [Start] Starting frontend...
cd /d D:\MySoftware\photo-manager\frontend
start "photo-frontend" cmd /c "npm run dev"

echo.
echo ========================================
echo   Restart complete
echo   Backend: http://localhost:8000
echo   Frontend: http://localhost:5173
echo ========================================
pause
