# Claude Setuper — instalador para Windows.
#   powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/install.ps1 | iex"
# Garante o mínimo (winget, Git, Node), baixa o Setuper e entrega pro wizard em português.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Repo = if ($env:CLAUDE_SETUPER_REPO) { $env:CLAUDE_SETUPER_REPO } else { 'nrsperfeld/claude-setuper' }
$Dest = Join-Path $env:USERPROFILE 'Claude Setuper\app'

function Passo($t) { Write-Host ""; Write-Host "▸ $t" -ForegroundColor Cyan }
function Ok($t)    { Write-Host "✓ $t" -ForegroundColor Green }
function AtualizarPath {
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
  foreach ($p in @("$env:ProgramFiles\nodejs", "$env:ProgramFiles\Git\cmd", "$env:ProgramFiles\GitHub CLI", "$env:APPDATA\npm", "$env:USERPROFILE\.local\bin", "$env:LOCALAPPDATA\Microsoft\WinGet\Links")) {
    if (($env:Path -split ';') -notcontains $p) { $env:Path = "$p;$env:Path" }
  }
}
function Tem($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function InstalarWinget($id) { & winget.exe install -e --id $id --source winget --silent --accept-source-agreements --accept-package-agreements --disable-interactivity | Out-Null; AtualizarPath }

Clear-Host
Write-Host "Claude Setuper" -ForegroundColor White
Write-Host "Vou preparar o seu computador. Leva alguns minutos e eu aviso sempre que precisar de você."

if (-not (Tem 'winget.exe')) {
  Passo "Preciso do 'Instalador de Aplicativo' da Microsoft, que vem no Windows 10 e 11."
  Write-Host "  Vou abrir a Microsoft Store. Clica em Instalar (ou Atualizar), fecha a loja e roda este instalador de novo."
  Start-Process 'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'
  Read-Host "  Aperta Enter pra fechar"
  exit 1
}
Ok "winget pronto"

if (-not (Tem 'git')) { Passo "Instalando o Git (uns 2 minutos, é normal)."; InstalarWinget 'Git.Git' }
Ok "Git pronto"

if (-not (Tem 'node')) { Passo "Instalando o Node (uns 2 minutos, é normal)."; InstalarWinget 'OpenJS.NodeJS.LTS' }
AtualizarPath
if (-not (Tem 'node')) { Write-Host "O Node não apareceu no caminho. Fecha esta janela, abre de novo e roda o instalador outra vez."; Read-Host "Enter pra fechar"; exit 1 }
Ok "Node $(node -v) pronto"

Passo "Baixando o Claude Setuper."
New-Item -ItemType Directory -Force -Path (Split-Path $Dest) | Out-Null
if (Test-Path (Join-Path $Dest '.git')) {
  git -C $Dest pull -q --ff-only 2>$null
} else {
  if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
  git clone -q --depth 1 "https://github.com/$Repo.git" $Dest
}
Push-Location $Dest
npm install --silent --no-audit --no-fund 2>$null | Out-Null
npm link --silent 2>$null | Out-Null
Pop-Location
Ok "Claude Setuper baixado"

# Windows Terminal mostra os acentos e os símbolos direito; o cmd antigo nem sempre.
$wt = Get-Command wt -ErrorAction SilentlyContinue
if ($wt -and -not $env:WT_SESSION) {
  Start-Process wt -ArgumentList "node `"$Dest\bin\claude-setuper.js`" $args"
  Write-Host "Abri o instalador numa janela nova. Pode fechar esta."
} else {
  & node "$Dest\bin\claude-setuper.js" @args
}
