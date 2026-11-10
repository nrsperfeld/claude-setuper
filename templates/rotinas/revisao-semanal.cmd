@echo off
rem Revisão semanal do segundo cérebro. Criado pelo Claude Setuper.
chcp 65001 >nul
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
set "CLAUDE_SETUPER_ROTINA=1"
set "VAULT={{vault}}"
set "DIR={{logs}}"
cd /d "%VAULT%" || exit /b 0
where claude >nul 2>&1 || exit /b 0
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do set "HOJE=%%c-%%b-%%a"

rem Guarda uma foto das notas antes da revisão, pra dar pra voltar atrás se o Claude reescrever algo errado.
if exist ".git" (
  where git >nul 2>&1 && (
    git add -A >nul 2>&1
    git -c user.name="Claude Setuper" -c user.email="setuper@localhost" commit -q -m "Antes da revisão semanal %HOJE%" >nul 2>&1
  )
)

echo --- %date% %time% >> "%DIR%\revisao-semanal.log"
call claude -p --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" < "%DIR%\prompt-revisao.md" >> "%DIR%\revisao-semanal.log" 2>&1
