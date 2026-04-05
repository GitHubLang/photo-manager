@echo off
chcp 65001 >nul
echo ========================================
echo   停止摄影素材管理系统
echo ========================================
echo.

:: 停止后端
echo [停止] 后端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo [已停止] 后端进程 %%a
)

:: 停止前端
echo [停止] 前端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo [已停止] 前端进程 %%a
)

echo.
echo ========================================
echo   已全部停止
echo ========================================
pause
