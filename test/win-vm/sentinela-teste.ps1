# Roda dentro da VM, depois da instalação: confere o sentinela do jeito que ele roda de verdade (pelo Agendador).
$ErrorActionPreference = 'Continue'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$S = Join-Path $env:USERPROFILE 'Claude Setuper\sentinela'
$reg = Join-Path $S 'registro.log'
function Titulo($t) { Write-Output "`n[sentinela] $t" }
function Fins { if (Test-Path $reg) { @(Select-String -Path $reg -Pattern ' fim$').Count } else { 0 } }
function PeloAgendador($nome) {
  $antes = Fins
  Start-ScheduledTask -TaskPath '\Claude Setuper\' -TaskName $nome
  for ($i = 0; $i -lt 360; $i++) { if ((Fins) -gt $antes) { return }; Start-Sleep 5 }
  Write-Output 'não terminou em 30 minutos'
}

Titulo 'agendado no Agendador de Tarefas'
$t = Get-ScheduledTask -TaskPath '\Claude Setuper\' -TaskName 'manter-atualizado'
"estado: $($t.State); quando ligar depois do horário: $($t.Settings.StartWhenAvailable); na bateria: $(-not $t.Settings.DisallowStartIfOnBatteries)"

Titulo 'Vercel antiga de propósito'
cmd /c 'npm install -g vercel@41.0.0 --no-audit --no-fund >nul 2>&1'
"antes: $(cmd /c 'vercel --version 2>nul' | Select-Object -Last 1)"

Titulo 'primeira rodada, pelo Agendador (como às 13h)'
Remove-Item (Join-Path $S 'ultima-vez') -ErrorAction SilentlyContinue
PeloAgendador 'manter-atualizado'
Get-Content $reg -Tail 25
"depois: $(cmd /c 'vercel --version 2>nul' | Select-Object -Last 1)"
if (Test-Path (Join-Path $S 'ultima-vez')) { 'marca da semana: gravada' } else { 'marca da semana: NÃO gravada' }

Titulo 'segunda rodada no mesmo dia: não pode fazer nada'
$n1 = (Get-Content $reg).Count
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $S 'manter-atualizado.ps1')
$n2 = (Get-Content $reg).Count
if ($n1 -eq $n2) { 'ok: saiu sem fazer nada' } else { "ERRO: rodou de novo ($n1 -> $n2 linhas)" }

Titulo 'com o Claude aberto: fica pra amanhã'
Remove-Item (Join-Path $S 'ultima-vez') -ErrorAction SilentlyContinue
Copy-Item "$env:SystemRoot\System32\PING.EXE" "$env:TEMP\claude.exe" -Force
$falso = Start-Process "$env:TEMP\claude.exe" -ArgumentList '-n', '120', '127.0.0.1' -WindowStyle Hidden -PassThru
Start-Sleep 1
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $S 'manter-atualizado.ps1')
Get-Content $reg -Tail 1
Stop-Process -Id $falso.Id -Force

Titulo 'uma ferramenta quebra durante a atualização: tem que avisar'
$bin = Join-Path $env:USERPROFILE '.local\bin'
New-Item -ItemType Directory -Force -Path $bin | Out-Null
Set-Content (Join-Path $bin 'quebra.cmd') '@exit /b 0' -Encoding ASCII
$T = 'C:\sentinela-teste'
New-Item -ItemType Directory -Force -Path $T | Out-Null
$codigo = Get-Content (Join-Path $S 'manter-atualizado.ps1') -Raw -Encoding UTF8
$codigo = $codigo.Replace("`$ferramentas = 'node'", "`$ferramentas = 'quebra', 'node'").Replace("`$depois = Conferir", "Set-Content '$bin\quebra.cmd' '@exit /b 1' -Encoding ASCII; `$depois = Conferir")
[IO.File]::WriteAllText("$T\script.ps1", $codigo, (New-Object Text.UTF8Encoding $true))
$a = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$T\script.ps1`" -Agora"
Register-ScheduledTask -TaskName 'teste' -TaskPath '\Claude Setuper\' -Action $a -Force | Out-Null
PeloAgendador 'teste'
Select-String -Path $reg -Pattern 'PAROU|aviso' | Select-Object -Last 2 | ForEach-Object { $_.Line }
Unregister-ScheduledTask -TaskName 'teste' -TaskPath '\Claude Setuper\' -Confirm:$false
Remove-Item (Join-Path $bin 'quebra.cmd') -ErrorAction SilentlyContinue
