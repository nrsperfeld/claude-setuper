# Keep everything up to date. Created by Claude Setuper.
# Runs every day at 1 PM (or when the computer turns on, if it was off), but only does its work once a week
# and never with the AI open. It only updates what Setuper installed and checks that everything still works.
# It only shows up for the person if a tool that was working stopped working.
#   powershell -File manter-atualizado.ps1 -Agora   # runs right now, without waiting for the week or checking whether the AI is open
param([switch]$Agora)
$ErrorActionPreference = 'Continue'
$pasta = Join-Path $env:USERPROFILE 'Claude Setuper\sentinela'
$marca = Join-Path $pasta 'ultima-vez'
$registro = Join-Path $pasta 'registro.log'
New-Item -ItemType Directory -Force -Path $pasta | Out-Null
function Log($t) { Add-Content -Path $registro -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $t) -Encoding UTF8 }

# A scheduled task doesn't see the new PATH of whoever installed things: adds the tool locations.
$extras = @("$env:ProgramFiles\nodejs", "$env:ProgramFiles\Git\cmd", "$env:ProgramFiles\GitHub CLI", "$env:APPDATA\npm", "$env:USERPROFILE\.local\bin", "$env:LOCALAPPDATA\Microsoft\WinGet\Links")
$env:Path = (@([Environment]::GetEnvironmentVariable('Path', 'User'), [Environment]::GetEnvironmentVariable('Path', 'Machine')) + $extras) -join ';'

if (-not $Agora -and (Test-Path $marca)) {
  $ultima = [datetime]::FromFileTime([int64](Get-Content $marca -Raw).Trim())
  if (((Get-Date) - $ultima).TotalDays -lt 6) { exit 0 }
}
# Updating Node while the AI is open takes down the tools it is using: it waits until tomorrow.
if (-not $Agora -and (Get-Process -Name claude -ErrorAction SilentlyContinue)) { Log 'The AI is open, leaving it for tomorrow'; exit 0 }

$ferramentas = 'node', 'npm', 'git', 'gh', 'claude', 'vercel'
function Conferir {
  $r = @{}
  foreach ($f in $ferramentas) {
    if (-not (Get-Command $f -ErrorAction SilentlyContinue)) { continue }
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d', '/c', "$f --version >nul 2>&1" -WindowStyle Hidden -PassThru
    $null = $p.Handle  # without this, PowerShell 5 loses the exit code
    if (-not $p.WaitForExit(60000)) { $p.Kill(); $r[$f] = $false } else { $r[$f] = ($p.ExitCode -eq 0) }
  }
  return $r
}
function Rodar($exe, $argumentos, $minutos) {
  $p = Start-Process -FilePath $exe -ArgumentList $argumentos -WindowStyle Hidden -PassThru -RedirectStandardOutput "$pasta\saida.txt" -RedirectStandardError "$pasta\erro.txt"
  $null = $p.Handle  # without this, PowerShell 5 loses the exit code
  if (-not $p.WaitForExit($minutos * 60000)) { $p.Kill(); Log "  $exe went past $minutos minutes and I stopped it"; return $false }
  Get-Content "$pasta\saida.txt", "$pasta\erro.txt" -ErrorAction SilentlyContinue | Select-Object -Last 5 | ForEach-Object { Log "  $_" }
  return ($p.ExitCode -eq 0)
}

Log 'starting'
$antes = Conferir
$atualizou = $false

if (Get-Command winget -ErrorAction SilentlyContinue) {
  $atualizou = Rodar 'winget' @('source', 'update', '--disable-interactivity') 10
  if ($atualizou) {
    $pacotes = @('Git.Git', 'GitHub.cli', 'OpenJS.NodeJS.LTS')
    foreach ($id in $pacotes) {
      if (-not (Rodar 'winget' @('list', '--id', $id, '-e', '--disable-interactivity', '--accept-source-agreements') 5)) { continue }
      if ($id -eq 'OpenJS.NodeJS.LTS' -and (Get-Command node -ErrorAction SilentlyContinue)) {
        # Only updates within the same major version. Jumping major versions sometimes breaks connectors.
        try {
          $atual = ((& node -p 'process.versions.node') -split '\.')[0]
          $lts = (Invoke-RestMethod 'https://nodejs.org/dist/index.json' -TimeoutSec 30 | Where-Object { $_.lts } | Select-Object -First 1).version.TrimStart('v').Split('.')[0]
          if ($lts -and $lts -ne $atual) { Log "Node $lts is the new major version; $atual stays as it is"; continue }
        } catch { Log 'could not check the Node version; left it as it is'; continue }
      }
      Log "checking $id"
      Rodar 'winget' @('upgrade', '--id', $id, '-e', '--silent', '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity') 30 | Out-Null
    }
  } else { Log 'no internet or winget did not respond; trying again tomorrow' }
}

if ((Get-Command vercel -ErrorAction SilentlyContinue) -and (Get-Command npm -ErrorAction SilentlyContinue)) {
  Log 'updating Vercel'
  Rodar 'cmd.exe' @('/d', '/c', 'npm update -g vercel --no-audit --no-fund') 15 | Out-Null
}
if (Get-Command claude -ErrorAction SilentlyContinue) {
  Log 'checking Claude Code'
  Rodar 'cmd.exe' @('/d', '/c', 'claude update') 5 | Out-Null
}

$depois = Conferir
$quebrou = @($antes.Keys | Where-Object { $antes[$_] -and -not $depois[$_] })
if ($quebrou.Count) {
  Log ('STOPPED WORKING: ' + ($quebrou -join ' '))
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $textos = $xml.GetElementsByTagName('text')
    $textos.Item(0).AppendChild($xml.CreateTextNode('Claude Setuper')) | Out-Null
    $textos.Item(1).AppendChild($xml.CreateTextNode('I updated the tools the AI uses and one of them stopped working. Run Claude Setuper again (the same installation file), and it will fix it.')) | Out-Null
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($xml))
  } catch { Log 'could not show the notice' }
} else { Log 'everything working' }

# No internet doesn't count as done: it tries again tomorrow.
if ($atualizou) { Set-Content -Path $marca -Value (Get-Date).ToFileTime() }
Log 'end'
