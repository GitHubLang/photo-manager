@echo off
chcp 65001 >nul
title 摄影素材管理系统 - 重启
echo ========================================
echo   摄影素材管理系统 - 重启
echo ========================================
echo.

:: 先停止
echo [停止] 现有服务...

:: 查找并停止后端进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: 查找并停止前端进程  
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: 等待端口释放
timeout /t 5 /nobreak >nul

:: 启动后端
echo [启动] 后端服务...
cd /d D:\MySoftware\photo-manager\backend
start "photo-backend" cmd /c "python main.py"

:: 启动前端
echo [启动] 前端服务...
cd /d D:\MySoftware\photo-manager\frontend
start "photo-frontend" cmd /c "npm run dev"

echo.
echo ========================================
echo   重启完成
echo   后端: http://localhost:8000
echo   前端: http://localhost:5173
echo ========================================
pause
