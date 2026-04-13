@echo off
chcp 65001 >nul
title photo-manager frontend rebuild

echo ==========================================
echo  重建前端
echo ============================================
echo.

cd /d "%~dp0"

echo [1] 清理旧构建文件...
del /q dist\assets\index-*.js 2>nul
del /q dist\assets\index-*.css 2>nul
echo     完成

echo.
echo [2] 执行 npm run build...
call npm run build
if errorlevel 1 (
    echo.
    echo [错误] 构建失败！按任意键退出...
    pause >nul
    exit /b 1
)

echo.
echo [3] 启动 preview (新的命令行窗口)...
start "photo-manager preview" cmd /k "npm run preview"

echo.
echo 构建完成，preview 已在新窗口启动。
echo 访问 http://192.168.71.55:4173 查看（局域网）。
echo.
pause
