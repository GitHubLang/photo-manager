@echo off
title Photo Manager - Stop
echo ========================================
echo   Photo Manager System - Stop
echo ========================================
echo.

:: Kill backend
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [Backend] Stopping PID %%a ...
    taskkill /PID %%a /F >nul 2>&1
)

:: Kill frontend
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo [Frontend] Stopping PID %%a ...
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   All services stopped
echo ========================================
pause
