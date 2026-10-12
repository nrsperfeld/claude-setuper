@echo off
rem Backup diário das notas. Criado pelo Claude Setuper.
set "PATH=C:\Program Files\Git\cmd;%PATH%"
set "VAULT={{vault}}"
set "DEST=%USERPROFILE%\Claude Setuper\backups"
if not exist "%DEST%" mkdir "%DEST%"
cd /d "%VAULT%" || exit /b 0
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do set "HOJE=%%c-%%b-%%a"

rem Cópia local compactada (guarda as últimas 14).
powershell -NoProfile -Command "Compress-Archive -Path '%VAULT%\*' -DestinationPath '%DEST%\notas-%HOJE%.zip' -Force" >nul 2>&1
powershell -NoProfile -Command "Get-ChildItem '%DEST%\notas-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force" >nul 2>&1

rem Backup remoto, se existir.
if exist ".git" (
  git remote get-url origin >nul 2>&1 && (
    git add -A >nul 2>&1
    git -c user.name="Claude Setuper" -c user.email="setuper@localhost" commit -q -m "Backup %HOJE%" >nul 2>&1
    git push -q origin HEAD >nul 2>&1
  )
)
