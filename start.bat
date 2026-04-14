@echo off
chcp 65001 >nul
title Photo Manager - Start

echo ========================================
echo   Photo Manager System - Start
echo ========================================
echo.

:: Check backend
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [Backend] Already running on port 8000
) else (
    echo [Backend] Starting...
    cd /d D:\MySoftware\photo-manager\backend
    start "photo-backend" cmd /k "python main.py"
)

:: Check frontend
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [Frontend] Already running on port 5173
) else (
    echo [Frontend] Starting preview (build)...
    cd /d D:\MySoftware\photo-manager\frontend
    start "photo-frontend" cmd /k "npm run preview -- --host 0.0.0.0 --port 5173"
)

echo.
echo ========================================
echo   Started
echo   Backend:  http://localhost:8000
echo   Frontend: http://192.168.71.55:5173
echo ========================================
timeout /t 3 /nobreak >nul
