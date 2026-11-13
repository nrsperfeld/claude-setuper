@echo off
rem Segunda janela do primeiro dia: confere se ficou tudo instalado e instala o que faltar. Criado pelo Claude Setuper.
rem Nasce minimizada, pra nao tirar a conversa com a IA da frente. Se faltar alguma coisa, abre de novo na frente (--aberta).
chcp 65001 >nul
title Claude Setuper
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;%PATH%"
set "BIN={{setuperBin}}"
set "TRAVA={{trava}}"
if "%~1"=="--aberta" goto aberta
rem Instalacao ainda rodando: espera terminar, no maximo 5 minutos.
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
echo  Pode fechar esta janela.
pause >nul
exit /b 0
:sem
echo  Nao achei o Claude Setuper pra fazer a conferencia. Abre o Claude Setuper de novo que ele confere tudo.
timeout /t 60 >nul
