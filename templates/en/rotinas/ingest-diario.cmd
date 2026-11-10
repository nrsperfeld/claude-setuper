@echo off
rem Daily read of the second brain's inbox folder (CLAUDE\inbox). Created by Claude Setuper.
rem Only calls the AI when there's a new file; with no file, it ends right away and uses nothing from the plan.
chcp 65001 >nul
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
set "CLAUDE_SETUPER_ROTINA=1"
set "VAULT={{vault}}"
set "DIR={{logs}}"
set "IN=%VAULT%\CLAUDE\inbox"
cd /d "%VAULT%" || exit /b 0
if not exist "%IN%" exit /b 0
where claude >nul 2>&1 || exit /b 0
if not exist "%IN%\processing" mkdir "%IN%\processing"
if not exist "%IN%\processed" mkdir "%IN%\processed"
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do set "HOJE=%%c-%%b-%%a"

rem Moves what arrived into a subfolder, so it doesn't get mixed with what arrives while the AI is reading.
for %%f in ("%IN%\*") do if /i not "%%~nxf"=="README.md" call :mover "%%~ff" "%IN%\processing"
set "TEM="
for %%f in ("%IN%\processing\*") do set "TEM=1"
if not defined TEM exit /b 0

echo --- %date% %time% >> "%DIR%\ingest-diario.log"
claude -p --model sonnet --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" < "%DIR%\prompt-ingest.md" >> "%DIR%\ingest-diario.log" 2>&1
rem It failed (no internet, not logged in): the files stay in processing and go into tomorrow's read.
if errorlevel 1 exit /b 0
for %%f in ("%IN%\processing\*") do call :mover "%%~ff" "%IN%\processed"
exit /b 0

rem Moves without overwriting: if a file with the same name already exists, the new one gets the date in front.
:mover
if exist "%~2\%~nx1" (move /y "%~1" "%~2\%HOJE%-%RANDOM%-%~nx1" >nul) else (move /y "%~1" "%~2\" >nul)
exit /b 0
