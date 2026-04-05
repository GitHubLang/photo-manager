@echo off
chcp 65001 >nul
title 摄影素材管理系统 - 停止
echo ========================================
echo   摄影素材管理系统 - 停止
echo ========================================
echo.

:: 查找并停止后端进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [后端] 停止进程 %%a ...
    taskkill /PID %%a /F >nul 2>&1
)

:: 查找并停止前端进程  
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo [前端] 停止进程 %%a ...
    taskkill /PID %%a /F >nul 2>&1
)

:: 清理TIME_WAIT
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   已全部停止
echo ========================================
pause
