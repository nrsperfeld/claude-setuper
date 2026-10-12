@echo off
rem Revisão semanal do segundo cérebro. Criado pelo Claude Setuper.
chcp 65001 >nul
set "PATH=%USERPROFILE%\.local\bin;%APPDATA%\npm;C:\Program Files\nodejs;C:\Program Files\Git\cmd;%PATH%"
set "VAULT={{vault}}"
cd /d "%VAULT%" || exit /b 0
where claude >nul 2>&1 || exit /b 0
for /f "tokens=1-3 delims=/" %%a in ("%date:~-10%") do set "HOJE=%%c-%%b-%%a"
claude -p --permission-mode acceptEdits --allowedTools "Read,Write,Glob,Grep" "Faça a revisão semanal do segundo cérebro em %VAULT%\CLAUDE. Leia tudo que foi criado ou alterado nos últimos 7 dias nas pastas feedback, decisões, padrões, descobertas e projetos. Escreva UMA nota nova em %VAULT%\CLAUDE\descobertas\ chamada 'Revisão da semana %HOJE%.md' com: o que se repetiu (padrões que estão virando regra), decisões que podem estar se contradizendo, projetos parados há mais de uma semana, e uma sugestão de foco pra semana que vem. Linguagem simples, sem título, sem frontmatter, terminando com #claude #descoberta. Não altere nenhuma outra nota." >> "{{logs}}\revisao-semanal.log" 2>&1
