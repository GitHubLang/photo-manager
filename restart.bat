@echo off
chcp 65001 >nul
title Photo Manager - Restart

set PYTHON=C:\Users\ADMIN\AppData\Local\Programs\Python\Python311\python.exe

echo ========================================
echo   Photo Manager Restart Script
echo ========================================
echo.

echo [Stop] Stopping existing services...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo Stopping PID %%a (backend)
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Stopping PID %%a (frontend)
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174" ^| findstr "LISTENING"') do (
    echo Stopping PID %%a (old frontend)
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5175" ^| findstr "LISTENING"') do (
    echo Stopping PID %%a (old frontend)
    taskkill /PID %%a /F >nul 2>&1
)

echo [Wait] Waiting for ports to be released...
timeout /t 3 /nobreak >nul

echo [Check] Checking Python dependencies...
%PYTHON% -c "import fastapi" 2>nul
if %errorlevel% neq 0 (
    echo [Install] fastapi not found, installing...
    %PYTHON% -m pip install fastapi uvicorn python-multipart aiofiles
)

echo [Start] Starting backend...
cd /d D:\MySoftware\photo-manager\backend
start "photo-backend" cmd /k "python main.py"

echo [Wait] Waiting for backend to be ready...
:wait_backend
timeout /t 2 /nobreak >nul
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% neq 0 goto wait_backend
echo [Ready] Backend is ready

echo [Start] Starting frontend...
cd /d D:\MySoftware\photo-manager\frontend
start "photo-frontend" cmd /k "npm run preview -- --host 0.0.0.0 --port 5173"

echo.
echo ========================================
echo   Restart Complete
echo   Backend:  http://localhost:8000
echo   Frontend: http://192.168.71.55:5173
echo ========================================
pause
