@echo off
rem Dois cliques neste arquivo iniciam o Claude Setuper.
rem Se o Windows mostrar "O Windows protegeu o computador": clique em "Mais informações" e depois em "Executar assim mesmo".
chcp 65001 >nul
title Claude Setuper
echo.
echo   Claude Setuper
echo   Vou comecar a instalacao. Nao feche esta janela.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/install.ps1 | iex"
echo.
echo   Pode fechar esta janela.
pause >nul
