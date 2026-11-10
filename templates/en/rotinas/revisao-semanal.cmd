@echo off
rem Weekly review of the second brain. Created by Claude Setuper.
chcp 65001 >nul
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
set "CLAUDE_SETUPER_ROTINA=1"
set "VAULT={{vault}}"
set "DIR={{logs}}"
cd /d "%VAULT%" || exit /b 0
where claude >nul 2>&1 || exit /b 0
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do set "HOJE=%%c-%%b-%%a"

rem Saves a snapshot of the notes before the review, so you can go back if the AI rewrites something wrong.
if exist ".git" (
  where git >nul 2>&1 && (
    git add -A >nul 2>&1
    git -c user.name="Claude Setuper" -c user.email="setuper@localhost" commit -q -m "Before the weekly review %HOJE%" >nul 2>&1
  )
)

echo --- %date% %time% >> "%DIR%\revisao-semanal.log"
claude -p --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" < "%DIR%\prompt-revisao.md" >> "%DIR%\revisao-semanal.log" 2>&1
