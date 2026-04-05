@echo off
chcp 65001 >nul
echo ========================================
echo   重启摄影素材管理系统
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
echo [启动] 后端服务...
start "摄影素材管理-后端" cmd /k "cd /d D:\MySoftware\photo-manager\backend && python main.py"

echo [启动] 前端服务...
start "摄影素材管理-前端" cmd /k "cd /d D:\MySoftware\photo-manager\frontend && npm run dev"

echo.
echo ========================================
echo   重启完成
echo   后端: http://localhost:8000
echo   前端: http://localhost:5173
echo ========================================
pause
