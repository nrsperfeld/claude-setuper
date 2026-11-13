@echo off
rem Abre o Claude. Na primeira vez, pede pra ele se apresentar. Criado pelo Claude Setuper.
chcp 65001 >nul
title Claude
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
set "MARCADOR={{marcador}}"
cd /d "%USERPROFILE%"
if exist "%MARCADOR%" goto normal
type nul > "%MARCADOR%"
rem Na primeira vez, uma segunda janela (minimizada) confere a instalacao enquanto a IA se apresenta.
if exist "{{conferencia}}" start "Claude Setuper" /min cmd /c ""{{conferencia}}""
claude "{{apresentacao}}"
goto fim
:normal
claude
:fim
echo.
echo  Pode fechar esta janela. Pra voltar, dois cliques no "Claude" da Area de Trabalho.
pause >nul
