@echo off
chcp 65001 >nul
title Photo Manager - Restart

set PYTHON=C:\Users\ADMIN\AppData\Local\Programs\Python\Python311\python.exe

echo ========================================
echo   Photo Manager 重启脚本
echo ========================================
echo.

:: 停止现有服务
echo [停止] 停止现有服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo 停止 PID %%a (backend)
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo 停止 PID %%a (frontend)
    taskkill /PID %%a /F >nul 2>&1
)

echo [等待] 等待端口释放...
timeout /t 3 /nobreak >nul

:: 检查并安装依赖
echo [检查] 检查 Python 依赖...
%PYTHON% -c "import fastapi" 2>nul
if %errorlevel% neq 0 (
    echo [安装] fastapi 未安装，正在安装...
    %PYTHON% -m pip install fastapi uvicorn python-multipart aiofiles
)

:: 启动后端
echo [启动] 启动后端...
cd /d D:\MySoftware\photo-manager\backend
start "photo-backend" cmd /k "%PYTHON% main.py"

:: 等待后端就绪
echo [等待] 等待后端启动...
:wait_backend
timeout /t 2 /nobreak >nul
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% neq 0 goto wait_backend
echo [就绪] 后端已就绪

:: 启动前端
echo [启动] 启动前端...
cd /d D:\MySoftware\photo-manager\frontend
start "photo-frontend" cmd /k "npm run dev -- --host"

echo.
echo ========================================
echo   重启完成
echo   后端: http://localhost:8000
echo   前端: http://192.168.71.55:5173
echo ========================================
pause
