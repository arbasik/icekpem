
@echo off
cd /d "%~dp0"
echo Запуск программы...
set NODE_ENV=development
call npm run electron
pause
