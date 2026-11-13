@echo off
rem Second window on day one: checks that everything is installed and installs whatever is missing. Created by Claude Setuper.
rem Starts minimized, so the conversation with the AI stays in front. If something is missing, it opens again in front (--aberta).
chcp 65001 >nul
title Claude Setuper
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;%PATH%"
set "BIN={{setuperBin}}"
set "TRAVA={{trava}}"
if "%~1"=="--aberta" goto aberta
rem Installation still running: wait for it to finish, 5 minutes at most.
set /a N=0
:espera
if not exist "%TRAVA%" goto conferir
if %N% geq 60 goto conferir
set /a N+=1
timeout /t 5 /nobreak >nul
goto espera
:conferir
if not exist "%BIN%" goto sem
node "%BIN%" verificar --segunda-janela{{opcoes}}
if errorlevel 3 if not errorlevel 4 goto reabrir
timeout /t 60 >nul
exit /b 0
:reabrir
start "Claude Setuper" cmd /c ""{{conferencia}}" --aberta"
exit /b 0
:aberta
node "%BIN%" verificar{{opcoes}}
echo.
echo  You can close this window.
pause >nul
exit /b 0
:sem
echo  I could not find Claude Setuper to run the check. Open Claude Setuper again and it will check everything.
timeout /t 60 >nul
