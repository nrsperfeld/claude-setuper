@echo off
rem Abre o Claude. Na primeira vez, pede pra ele se apresentar. Criado pelo Claude Setuper.
chcp 65001 >nul
title Claude
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
set "MARCADOR={{marcador}}"
cd /d "%USERPROFILE%"
if exist "%MARCADOR%" goto normal
type nul > "%MARCADOR%"
claude "Oi! Eu sou {{nome}}. Acabei de instalar você com o Claude Setuper. Se apresenta pra mim em poucas linhas, em português simples e sem termos técnicos: quem você é, o que você consegue fazer por alguém que trabalha com isto: {{trabalho}}, e como o meu segundo cérebro (as notas no Obsidian) funciona entre a gente. No fim, me propõe uma tarefa pequena e útil pra gente fazer agora em um minuto, relacionada ao meu trabalho."
goto fim
:normal
claude
:fim
echo.
echo  Pode fechar esta janela. Pra voltar, dois cliques no "Claude" da Area de Trabalho.
pause >nul
