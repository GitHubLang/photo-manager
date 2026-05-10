@echo off
chcp 65001 >nul
echo 停止前端服务...

:: 查找并终止 node 进程（运行在 5173 端口的 vite）
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo 终止 PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

:: 也尝试杀掉 node 进程（preview/server 模式）
for /f "tokens=1" %%a in ('wmic process where "name='node.exe'" get processid 2^>nul ^| findstr /r "[0-9]"') do (
    :: 这个方法太粗暴，可能会误杀其他 node 进程
)

echo 停止完成。
pause
