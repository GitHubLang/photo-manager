@echo off
title Photo Manager - Restart
chcp 65001 >nul
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
set PYTHON=C:\Users\ADMIN\AppData\Local\Programs\Python\Python311\python.exe
start "photo-backend" cmd /k "%PYTHON% -m uvicorn main:app --host 0.0.0.0 --port 8000"

:: Start frontend (preview mode on 5173)
echo [Start] Starting frontend (LAN: 5173)...
cd /d D:\MySoftware\photo-manager\frontend
start "photo-frontend" cmd /k "npm run preview -- --host 0.0.0.0 --port 5173"

echo.
echo ========================================
echo   Restart complete
echo   Backend: http://localhost:8000
echo   Frontend: http://[HOST]:5173
echo ========================================
timeout /t 5 /nobreak >nul
