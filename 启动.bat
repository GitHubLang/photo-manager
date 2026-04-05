@echo off
chcp 65001 >nul
title 摄影素材管理系统 - 启动
echo ========================================
echo   摄影素材管理系统 - 启动
echo ========================================
echo.

:: 检查后端是否运行
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [后端] 已在运行 (端口8000)
) else (
    echo [后端] 启动中...
    cd /d D:\MySoftware\photo-manager\backend
    start "photo-backend" cmd /c "python main.py"
)

:: 检查前端是否运行
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [前端] 已在运行 (端口5173)
) else (
    echo [前端] 启动中...
    cd /d D:\MySoftware\photo-manager\frontend
    start "photo-frontend" cmd /c "npm run dev"
)

echo.
echo ========================================
echo   启动完成
echo   后端: http://localhost:8000
echo   前端: http://localhost:5173
echo ========================================
echo.
timeout /t 3 /nobreak >nul
