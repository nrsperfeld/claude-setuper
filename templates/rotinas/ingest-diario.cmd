@echo off
rem Leitura diária da pasta de entrada do segundo cérebro (CLAUDE\inbox). Criado pelo Claude Setuper.
rem Só chama o Claude quando tem arquivo novo; sem arquivo, termina na hora e não gasta nada do plano.
chcp 65001 >nul
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
set "CLAUDE_SETUPER_ROTINA=1"
set "VAULT={{vault}}"
set "DIR={{logs}}"
set "IN=%VAULT%\CLAUDE\inbox"
cd /d "%VAULT%" || exit /b 0
if not exist "%IN%" exit /b 0
where claude >nul 2>&1 || exit /b 0
if not exist "%IN%\processando" mkdir "%IN%\processando"
if not exist "%IN%\processados" mkdir "%IN%\processados"
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do set "HOJE=%%c-%%b-%%a"

rem Separa o que chegou numa subpasta, pra não misturar com o que chegar enquanto o Claude lê.
for %%f in ("%IN%\*") do if /i not "%%~nxf"=="README.md" call :mover "%%~ff" "%IN%\processando"
set "TEM="
for %%f in ("%IN%\processando\*") do set "TEM=1"
if not defined TEM exit /b 0

echo --- %date% %time% >> "%DIR%\ingest-diario.log"
claude -p --model sonnet --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" < "%DIR%\prompt-ingest.md" >> "%DIR%\ingest-diario.log" 2>&1
rem Deu errado (sem internet, sem login): os arquivos ficam em processando e entram na leitura de amanhã.
if errorlevel 1 exit /b 0
for %%f in ("%IN%\processando\*") do call :mover "%%~ff" "%IN%\processados"
exit /b 0

rem Move sem sobrescrever: se já existe um arquivo com o mesmo nome, o novo ganha a data na frente.
:mover
if exist "%~2\%~nx1" (move /y "%~1" "%~2\%HOJE%-%RANDOM%-%~nx1" >nul) else (move /y "%~1" "%~2\" >nul)
exit /b 0
