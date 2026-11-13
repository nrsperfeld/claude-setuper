@echo off
rem Opens the AI. The first time, it asks the AI to introduce itself. Created by Claude Setuper.
chcp 65001 >nul
title Claude
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
set "MARCADOR={{marcador}}"
cd /d "%USERPROFILE%"
if exist "%MARCADOR%" goto normal
type nul > "%MARCADOR%"
rem The first time, a second window (minimized) checks the installation while the AI introduces itself.
if exist "{{conferencia}}" start "Claude Setuper" /min cmd /c ""{{conferencia}}""
claude "{{apresentacao}}"
goto fim
:normal
claude
:fim
echo.
echo  You can close this window. To come back, double-click "Claude" on your Desktop.
pause >nul
