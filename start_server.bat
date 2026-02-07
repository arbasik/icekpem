@echo off
cd /d "%~dp0"
echo Запуск сервера разработки...
call npm run dev
pause
