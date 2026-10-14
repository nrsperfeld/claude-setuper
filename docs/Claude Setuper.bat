@echo off
rem Dois cliques neste arquivo iniciam o Claude Setuper.
rem Se o Windows mostrar "O Windows protegeu o computador": clique em "Mais informações" e depois em "Executar assim mesmo".
chcp 65001 >nul
title Claude Setuper
echo.
echo   Claude Setuper
echo   Vou comecar a instalacao. Nao feche esta janela.
echo.
set "SCRIPT=%USERPROFILE%\claude-setuper.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/nrsperfeld/claude-setuper/v1.1.2/fallback-windows.ps1' -OutFile '%SCRIPT%'"
if not exist "%SCRIPT%" (
  echo   Nao consegui baixar o instalador. Confere a internet e tenta de novo.
  pause >nul
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
echo.
echo   Pode fechar esta janela.
pause >nul
