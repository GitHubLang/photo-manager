@echo off
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
    start "photo-backend" cmd /c "python main.py"
)

:: Check frontend
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [Frontend] Already running on port 5173
) else (
    echo [Frontend] Starting...
    cd /d D:\MySoftware\photo-manager\frontend
    start "photo-frontend" cmd /c "npm run dev"
)

echo.
echo ========================================
echo   Started
echo   Backend: http://localhost:8000
echo   Frontend: http://localhost:5173
echo ========================================
timeout /t 3 /nobreak >nul
