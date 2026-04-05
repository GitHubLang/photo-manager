@echo off
chcp 65001 >nul
echo ========================================
echo   摄影素材管理系统
echo ========================================
echo.

:: 检查进程
netstat -ano | findstr ":8000" >nul
if %errorlevel%==0 (
    echo [检测] 后端已在运行
) else (
    echo [启动] 后端服务...
    start "摄影素材管理-后端" cmd /c "cd /d D:\MySoftware\photo-manager\backend && python main.py"
)

netstat -ano | findstr ":5173" >nul
if %errorlevel%==0 (
    echo [检测] 前端已在运行
) else (
    echo [启动] 前端服务...
    start "摄影素材管理-前端" cmd /c "cd /d D:\MySoftware\photo-manager\frontend && npm run dev"
)

echo.
echo ========================================
echo   服务地址
echo ========================================
echo   后端: http://localhost:8000
echo   前端: http://localhost:5173
echo   API文档: http://localhost:8000/docs
echo ========================================
echo.
pause
