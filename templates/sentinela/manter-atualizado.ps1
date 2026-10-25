# Manter tudo atualizado. Criado pelo Claude Setuper.
# Roda todo dia às 13h (ou quando o computador ligar, se estava desligado), mas só trabalha uma vez por semana
# e nunca com o Claude aberto. Atualiza só o que o Setuper instalou e confere se tudo continua funcionando.
# Só aparece pra pessoa se alguma ferramenta que funcionava parou de funcionar.
#   powershell -File manter-atualizado.ps1 -Agora   # roda já, sem esperar a semana nem conferir se o Claude está aberto
param([switch]$Agora)
$ErrorActionPreference = 'Continue'
$pasta = Join-Path $env:USERPROFILE 'Claude Setuper\sentinela'
$marca = Join-Path $pasta 'ultima-vez'
$registro = Join-Path $pasta 'registro.log'
New-Item -ItemType Directory -Force -Path $pasta | Out-Null
function Log($t) { Add-Content -Path $registro -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $t) -Encoding UTF8 }

# Tarefa agendada não vê o PATH novo de quem instalou: acrescenta os lugares das ferramentas.
$extras = @("$env:ProgramFiles\nodejs", "$env:ProgramFiles\Git\cmd", "$env:ProgramFiles\GitHub CLI", "$env:APPDATA\npm", "$env:USERPROFILE\.local\bin", "$env:LOCALAPPDATA\Microsoft\WinGet\Links")
$env:Path = (@([Environment]::GetEnvironmentVariable('Path', 'User'), [Environment]::GetEnvironmentVariable('Path', 'Machine')) + $extras) -join ';'

if (-not $Agora -and (Test-Path $marca)) {
  $ultima = [datetime]::FromFileTime([int64](Get-Content $marca -Raw).Trim())
  if (((Get-Date) - $ultima).TotalDays -lt 6) { exit 0 }
}
# Atualizar o Node com o Claude aberto derruba as ferramentas que ele está usando: fica pra amanhã.
if (-not $Agora -and (Get-Process -Name claude -ErrorAction SilentlyContinue)) { Log 'o Claude está aberto, fica pra amanhã'; exit 0 }

$ferramentas = 'node', 'npm', 'git', 'gh', 'claude', 'vercel'
function Conferir {
  $r = @{}
  foreach ($f in $ferramentas) {
    if (-not (Get-Command $f -ErrorAction SilentlyContinue)) { continue }
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList '/d', '/c', "$f --version >nul 2>&1" -WindowStyle Hidden -PassThru
    $null = $p.Handle  # sem isso o PowerShell 5 perde o código de saída
    if (-not $p.WaitForExit(60000)) { $p.Kill(); $r[$f] = $false } else { $r[$f] = ($p.ExitCode -eq 0) }
  }
  return $r
}
function Rodar($exe, $argumentos, $minutos) {
  $p = Start-Process -FilePath $exe -ArgumentList $argumentos -WindowStyle Hidden -PassThru -RedirectStandardOutput "$pasta\saida.txt" -RedirectStandardError "$pasta\erro.txt"
  $null = $p.Handle  # sem isso o PowerShell 5 perde o código de saída
  if (-not $p.WaitForExit($minutos * 60000)) { $p.Kill(); Log "  $exe passou de $minutos minutos e parei"; return $false }
  Get-Content "$pasta\saida.txt", "$pasta\erro.txt" -ErrorAction SilentlyContinue | Select-Object -Last 5 | ForEach-Object { Log "  $_" }
  return ($p.ExitCode -eq 0)
}

Log 'começando'
$antes = Conferir
$atualizou = $false

if (Get-Command winget -ErrorAction SilentlyContinue) {
  $atualizou = Rodar 'winget' @('source', 'update', '--disable-interactivity') 10
  if ($atualizou) {
    $pacotes = @('Git.Git', 'GitHub.cli', 'OpenJS.NodeJS.LTS')
    foreach ($id in $pacotes) {
      if (-not (Rodar 'winget' @('list', '--id', $id, '-e', '--disable-interactivity', '--accept-source-agreements') 5)) { continue }
      if ($id -eq 'OpenJS.NodeJS.LTS' -and (Get-Command node -ErrorAction SilentlyContinue)) {
        # Só atualizações dentro da mesma versão grande. Pular de versão grande às vezes quebra conectores.
        try {
          $atual = ((& node -p 'process.versions.node') -split '\.')[0]
          $lts = (Invoke-RestMethod 'https://nodejs.org/dist/index.json' -TimeoutSec 30 | Where-Object { $_.lts } | Select-Object -First 1).version.TrimStart('v').Split('.')[0]
          if ($lts -and $lts -ne $atual) { Log "Node $lts é a versão grande nova; o $atual fica como está"; continue }
        } catch { Log 'não consegui conferir a versão do Node; deixei como está'; continue }
      }
      Log "conferindo $id"
      Rodar 'winget' @('upgrade', '--id', $id, '-e', '--silent', '--source', 'winget', '--accept-source-agreements', '--accept-package-agreements', '--disable-interactivity') 30 | Out-Null
    }
  } else { Log 'sem internet ou o winget não respondeu; tento amanhã' }
}

if ((Get-Command vercel -ErrorAction SilentlyContinue) -and (Get-Command npm -ErrorAction SilentlyContinue)) {
  Log 'atualizando a Vercel'
  Rodar 'cmd.exe' @('/d', '/c', 'npm update -g vercel --no-audit --no-fund') 15 | Out-Null
}
if (Get-Command claude -ErrorAction SilentlyContinue) {
  Log 'conferindo o Claude Code'
  Rodar 'cmd.exe' @('/d', '/c', 'claude update') 5 | Out-Null
}

$depois = Conferir
$quebrou = @($antes.Keys | Where-Object { $antes[$_] -and -not $depois[$_] })
if ($quebrou.Count) {
  Log ('PAROU DE FUNCIONAR: ' + ($quebrou -join ' '))
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $textos = $xml.GetElementsByTagName('text')
    $textos.Item(0).AppendChild($xml.CreateTextNode('Claude Setuper')) | Out-Null
    $textos.Item(1).AppendChild($xml.CreateTextNode('Atualizei as ferramentas do Claude e uma delas parou de funcionar. Rode o Claude Setuper de novo (o mesmo arquivo da instalação), que ele conserta.')) | Out-Null
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($xml))
  } catch { Log 'não consegui mostrar o aviso' }
} else { Log 'tudo funcionando' }

# Sem internet não conta como feito: tenta de novo amanhã.
if ($atualizou) { Set-Content -Path $marca -Value (Get-Date).ToFileTime() }
Log 'fim'
