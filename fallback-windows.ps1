<#
Claude Setuper - instalador para Windows num arquivo so (sem o wizard em Node).
Faz a instalacao inteira direto do PowerShell, passo a passo, e confere tudo no fim.

Rodar (baixa e executa; pergunta nome, trabalho e autonomia na primeira vez):
  irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/fallback-windows.ps1 -OutFile "$env:USERPROFILE\claude-setuper.ps1"; powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\claude-setuper.ps1"

Rodar sem perguntas:
  powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\claude-setuper.ps1" -Nome "Maria" -Trabalho "tenho uma loja de roupas" -Autonomia equilibrado

Parametros:
  -Nome, -Trabalho, -Autonomia (cauteloso | equilibrado | confiante | livre), -Pacotes (escrita,negocios,pesquisa,criador,dev)
  -SemVercel -SemChrome -SemGitHub -SemRotinas    pula essas partes
  -SemLogin                                       nao para no login do Claude (a pessoa faz depois com: claude auth login)
  -Desde N                                        comeca do passo N (1 a 9)
  -Refazer                                        ignora o que ja esta marcado como feito e roda tudo de novo
  -Doctor                                         so confere o que esta instalado e sai
  -Teste [-PastaTeste X]                          nao instala nada; gera os arquivos numa pasta de teste

Ele lembra das respostas e dos passos concluidos em "%USERPROFILE%\Claude Setuper\estado.json".
Rodar de novo continua de onde parou. Registro completo em "%USERPROFILE%\Claude Setuper\registro-fallback.log".
#>
[CmdletBinding()]
param(
  [string]$Nome,
  [string]$Trabalho,
  [ValidateSet('cauteloso', 'equilibrado', 'confiante', 'livre', '')][string]$Autonomia = '',
  [string]$Pacotes = '',
  [switch]$SemVercel, [switch]$SemChrome, [switch]$SemGitHub, [switch]$SemRotinas, [switch]$SemLogin,
  [int]$Desde = 1, [switch]$Refazer, [switch]$Doctor,
  [switch]$Teste, [string]$PastaTeste, [string]$SimularErro
)

$ErrorActionPreference = 'Continue'
Set-StrictMode -Off
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$Versao = '1.1.4'
$Repo = 'nrsperfeld/claude-setuper'
$Utf8 = New-Object System.Text.UTF8Encoding $false

# ============================================================ casa (real ou de teste)
if ($Teste) {
  if (-not $PastaTeste) { $PastaTeste = Join-Path ([System.IO.Path]::GetTempPath()) 'claude-setuper-teste' }
  $Home_ = $PastaTeste
  $AppData = Join-Path $Home_ 'AppData\Roaming'
  $LocalAppData = Join-Path $Home_ 'AppData\Local'
} else {
  $Home_ = $env:USERPROFILE
  $AppData = $env:APPDATA
  $LocalAppData = $env:LOCALAPPDATA
}
$ClaudeDir = Join-Path $Home_ '.claude'
$PastaSetuper = Join-Path $Home_ 'Claude Setuper'
$Vault = Join-Path (Join-Path $Home_ 'Documents') "Segundo C$([char]0x00E9)rebro"
$Desktop = Join-Path $Home_ 'Desktop'
$RotDir = Join-Path $PastaSetuper 'rotinas'
$TplDir = Join-Path $PastaSetuper 'templates'
$EstadoPath = Join-Path $PastaSetuper 'estado.json'
New-Item -ItemType Directory -Force -Path $PastaSetuper | Out-Null
$Log = Join-Path $PastaSetuper 'registro-fallback.log'
try { Start-Transcript -Path $Log -Append | Out-Null } catch {}

# ============================================================ utilidades
function Passo($t) { Write-Host ""; Write-Host "$([char]0x25B8) $t" -ForegroundColor Cyan }
function Ok($t)    { Write-Host "  $([char]0x2713) $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  ! $t" -ForegroundColor Yellow }
function Cinza($t) { Write-Host "    $t" -ForegroundColor DarkGray }
function Pausa($titulo, $linhas) {
  Write-Host ""; Write-Host "  $([char]0x270B) $titulo" -ForegroundColor Yellow
  foreach ($l in $linhas) { Write-Host "     $l" }
}
function Tem($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Escrever($caminho, $texto) {
  $dir = Split-Path $caminho
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [System.IO.File]::WriteAllText($caminho, $texto, $Utf8)
}
function EscreverSeFaltar($caminho, $texto) { if (-not (Test-Path $caminho)) { Escrever $caminho $texto } }
function Json($obj) { return ($obj | ConvertTo-Json -Depth 20) }
function Posix($p) { return ($p -replace '\\', '/') }
function Ultimas($texto, $n) { return ((($texto -split "`r?`n") | Where-Object { $_.Trim() } | Select-Object -Last $n) -join ' | ') }

# Roda um programa, guarda a saida e, se falhar, mostra as ultimas linhas. Devolve $true/$false.
function Rodar($nome, $cmd, [string[]]$argumentos, [switch]$Mostrar) {
  # ($args e variavel automatica do PowerShell; usar esse nome como parametro engolia os argumentos)
  if ($Teste) { return $true }
  try {
    $saida = (& $cmd @argumentos 2>&1 | Out-String)
    $codigo = $LASTEXITCODE
  } catch { $saida = $_.Exception.Message; $codigo = 1 }
  if ($Mostrar -or $codigo -ne 0) { Cinza "$nome $([char]0x2192) c$([char]0x00F3)digo $codigo. $(Ultimas $saida 2)" }
  return ($codigo -eq 0)
}
function GravarPathUsuario($pasta) {
  try {
    $atual = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    if (($atual -split ';') -notcontains $pasta) { [System.Environment]::SetEnvironmentVariable('Path', ($atual.TrimEnd(';') + ';' + $pasta), 'User') }
  } catch {}
}
function AtualizarPath {
  try { $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User') } catch {}
  foreach ($p in @("$env:ProgramFiles\nodejs", "$env:ProgramFiles\Git\cmd", "$env:ProgramFiles\Git\bin", "$env:ProgramFiles\GitHub CLI", "$env:APPDATA\npm", "$env:USERPROFILE\.local\bin", "$env:LOCALAPPDATA\Microsoft\WinGet\Links")) {
    if ($p -and (($env:Path -split ';') -notcontains $p)) { $env:Path = "$p;$env:Path" }
  }
}
function InstalarWinget($id, $nome) {
  if ($Teste) { return $true }
  Passo "Instalando $nome (pode levar uns minutos, $([char]0x00E9) normal)."
  $saida = (& winget.exe install -e --id $id --source winget --silent --accept-source-agreements --accept-package-agreements 2>&1 | Out-String)
  $codigo = $LASTEXITCODE
  AtualizarPath
  if ($codigo -ne 0 -and $saida -notmatch "already installed|j$([char]0x00E1) est$([char]0x00E1) instalado") { Aviso "winget n$([char]0x00E3)o conseguiu ($codigo): $(Ultimas $saida 2)"; return $false }
  Cinza (Ultimas $saida 1)
  return $true
}
function BaixarArquivo($url, $destino) { Invoke-WebRequest -UseBasicParsing $url -OutFile $destino -Headers @{ 'User-Agent' = 'claude-setuper' } }
function InstalarNodeDireto {
  Passo "Baixando o Node direto do site oficial."
  try {
    $lista = Invoke-RestMethod -UseBasicParsing 'https://nodejs.org/dist/index.json' -Headers @{ 'User-Agent' = 'claude-setuper' }
    $lts = $lista | Where-Object { $_.lts } | Select-Object -First 1
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $arq = Join-Path $PastaSetuper "node-$($lts.version)-$arch.msi"
    BaixarArquivo "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-$arch.msi" $arq
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$arq`" /qn /norestart" -Wait -PassThru
    if ($p.ExitCode -ne 0) { Cinza "msiexec $([char]0x2192) c$([char]0x00F3)digo $($p.ExitCode)" }
    AtualizarPath
    return (Test-Path "$env:ProgramFiles\nodejs\node.exe")
  } catch { Aviso "Falhou o Node direto: $($_.Exception.Message)"; return $false }
}
function InstalarGitDireto {
  Passo "Baixando o Git direto do site oficial."
  try {
    $rel = Invoke-RestMethod -UseBasicParsing 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers @{ 'User-Agent' = 'claude-setuper' }
    $padrao = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { '^Git-.*-arm64\.exe$' } else { '^Git-.*-64-bit\.exe$' }
    $a = $rel.assets | Where-Object { $_.name -match $padrao } | Select-Object -First 1
    if (-not $a) { $a = $rel.assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1 }
    $arq = Join-Path $PastaSetuper $a.name
    BaixarArquivo $a.browser_download_url $arq
    $p = Start-Process $arq -ArgumentList '/VERYSILENT /NORESTART /NOCANCEL /SP-' -Wait -PassThru
    if ($p.ExitCode -ne 0) { Cinza "instalador do Git $([char]0x2192) c$([char]0x00F3)digo $($p.ExitCode)" }
    AtualizarPath
    return (Test-Path "$env:ProgramFiles\Git\cmd\git.exe")
  } catch { Aviso "Falhou o Git direto: $($_.Exception.Message)"; return $false }
}
function Esperar($cond, $segundos) {
  if ($Teste) { return $true }
  $fim = (Get-Date).AddSeconds($segundos)
  while ((Get-Date) -lt $fim) { if (& $cond) { return $true }; Start-Sleep -Seconds 3 }
  return $false
}
function Logado {
  if (-not (Tem 'claude')) { return $false }
  try { $j = (claude auth status 2>$null | Out-String | ConvertFrom-Json); return ($j.loggedIn -eq $true) } catch { return $false }
}
function ObsidianExe { return (@((Join-Path $LocalAppData 'Programs\Obsidian\Obsidian.exe'), (Join-Path $LocalAppData 'Obsidian\Obsidian.exe'), "$env:ProgramFiles\Obsidian\Obsidian.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1) }
function ChromeExe { return (@("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", (Join-Path $LocalAppData 'Google\Chrome\Application\chrome.exe')) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1) }
$ExtId = 'fcoeoabgfenejglbffodgkkbkcdhcgfn'
function ExtensaoChrome {
  $perfis = Join-Path $LocalAppData 'Google\Chrome\User Data'
  if (-not (Test-Path $perfis)) { return $false }
  return ((Get-ChildItem $perfis -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName "Extensions\$ExtId") }).Count -gt 0)
}
function Elevado {
  try { return ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) } catch { return $false }
}

# ============================================================ estado (respostas + passos feitos)
$Estado = $null
if (Test-Path $EstadoPath) { try { $Estado = Get-Content $EstadoPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $Estado = $null } }
$Resp = @{}
$Feitos = @{}
if ($Estado) {
  if ($Estado.respostas) { foreach ($p in $Estado.respostas.PSObject.Properties) { $Resp[$p.Name] = $p.Value } }
  if ($Estado.modulos) { foreach ($p in $Estado.modulos.PSObject.Properties) { $Feitos[$p.Name] = $p.Value } }
}
function SalvarEstado {
  $mods = [ordered]@{}
  foreach ($k in $Feitos.Keys) { $mods[$k] = $Feitos[$k] }
  Escrever $EstadoPath (Json ([ordered]@{ versao = "fallback-$Versao"; respostas = $Resp; modulos = $mods }))
}

# ============================================================ templates
function BaixarTemplates {
  if (Test-Path (Join-Path $TplDir 'CLAUDE.md.tpl')) { return }
  Passo "Baixando os textos e modelos do Claude Setuper."
  $zip = Join-Path $PastaSetuper 'setuper.zip'
  BaixarArquivo "https://codeload.github.com/$Repo/zip/refs/heads/main" $zip
  $tmp = Join-Path $PastaSetuper 'setuper-zip'
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $origem = Get-ChildItem $tmp -Directory | Select-Object -First 1
  if (Test-Path $TplDir) { Remove-Item -Recurse -Force $TplDir }
  Copy-Item -Recurse (Join-Path $origem.FullName 'templates') $TplDir
  Remove-Item -Recurse -Force $tmp, $zip -ErrorAction SilentlyContinue
}
$Vars = @{}
function Tpl($rel, $extras) {
  $txt = [System.IO.File]::ReadAllText((Join-Path $TplDir $rel), $Utf8)
  $todas = @{} + $Vars
  if ($extras) { foreach ($k in $extras.Keys) { $todas[$k] = $extras[$k] } }
  foreach ($k in $todas.Keys) { $txt = $txt.Replace('{{' + $k + '}}', [string]$todas[$k]) }
  return ($txt -replace '\{\{\w+\}\}', '')
}

# ============================================================ doctor (conferencia)
function Conferir {
  $itens = New-Object System.Collections.ArrayList
  function add($item, $ok, $dica) { [void]$itens.Add([pscustomobject]@{ item = $item; ok = [bool]$ok; dica = $dica }) }
  AtualizarPath
  add 'winget' (Tem 'winget.exe') 'instale o "Instalador de Aplicativo" pela Microsoft Store'
  add 'git' (Tem 'git') 'rode: winget install -e --id Git.Git --source winget'
  add 'Node' (Tem 'node') 'rode o instalador de novo com -Desde 1 -Refazer'
  add 'Claude Code' (Tem 'claude') 'rode: irm https://claude.ai/install.ps1 | iex'
  if (-not $SemLogin) { add 'Login no Claude' (Logado) 'rode: claude auth login' }
  $pathUser = [string][System.Environment]::GetEnvironmentVariable('Path', 'User')
  add "PATH do usu$([char]0x00E1)rio tem .local\bin" (($pathUser -split ';') -contains "$env:USERPROFILE\.local\bin") 'rode o instalador de novo com -Desde 1 -Refazer'
  $md = Join-Path $ClaudeDir 'CLAUDE.md'
  add 'CLAUDE.md' ((Test-Path $md) -and ((Get-Content $md -Raw -Encoding UTF8 -ErrorAction SilentlyContinue) -like '*claude-setuper*')) 'rode com -Desde 2 -Refazer'
  $settingsOk = $false
  try { $s = Get-Content (Join-Path $ClaudeDir 'settings.json') -Raw -Encoding UTF8 | ConvertFrom-Json; $settingsOk = [bool]($s.hooks.SessionStart) -and [bool]($s.env.CLAUDE_SETUPER_VAULT) } catch {}
  add 'settings.json com hooks e cofre' $settingsOk 'rode com -Desde 2 -Refazer'
  $hooksOk = $true
  foreach ($h in @('cerebro-inicio.cjs', 'cerebro-fim.cjs', 'cerebro-nota.cjs')) { if (-not (Test-Path (Join-Path (Join-Path $ClaudeDir 'hooks') $h))) { $hooksOk = $false } }
  add "Hooks do segundo c$([char]0x00E9)rebro" $hooksOk 'rode com -Desde 2 -Refazer'
  add "Skills do c$([char]0x00E9)rebro (/decisao, /retro...)" (Test-Path (Join-Path $ClaudeDir 'skills\retro\SKILL.md')) 'rode com -Desde 2 -Refazer'
  add 'Obsidian instalado' ([bool](ObsidianExe)) 'rode: winget install -e --id Obsidian.Obsidian --source winget'
  add 'Cofre com pasta CLAUDE/' (Test-Path (Join-Path $Vault 'CLAUDE\projetos')) 'rode com -Desde 3 -Refazer'
  add 'Plugins Dataview e Templater baixados' ((Test-Path (Join-Path $Vault '.obsidian\plugins\dataview\main.js')) -and (Test-Path (Join-Path $Vault '.obsidian\plugins\templater-obsidian\main.js'))) 'rode com -Desde 3 -Refazer'
  $reg = $false
  try { $o = Get-Content (Join-Path (Join-Path $AppData 'obsidian') 'obsidian.json') -Raw -Encoding UTF8 | ConvertFrom-Json; foreach ($v in $o.vaults.PSObject.Properties) { if ($v.Value.path -eq $Vault) { $reg = $true } } } catch {}
  add 'Cofre registrado no Obsidian' $reg 'rode com -Desde 3 -Refazer'
  if (-not $SemGitHub) {
    add 'GitHub CLI (gh)' (Tem 'gh') 'rode com -Desde 4 -Refazer'
    $ghOk = $false; if (Tem 'gh') { $ghOk = ((gh auth status 2>&1 | Out-String) -match 'Logged in') }
    add 'GitHub conectado' $ghOk 'rode: gh auth login --web'
  }
  if (-not $SemChrome) {
    add 'Google Chrome' ([bool](ChromeExe)) 'rode com -Desde 5 -Refazer'
    add "Extens$([char]0x00E3)o Claude no Chrome" (ExtensaoChrome) "instale em https://chromewebstore.google.com/detail/$ExtId"
  }
  if (-not $SemVercel) {
    add 'Vercel CLI' (Tem 'vercel') 'rode com -Desde 6 -Refazer'
    $vOk = $false; if (Tem 'vercel') { $q = (vercel whoami 2>&1 | Out-String); $vOk = ($q -and $q -notmatch 'Error|not') }
    add 'Vercel conectada' $vOk 'rode: vercel login'
  }
  if (-not $SemVercel) { add 'Skill /publicar' (Test-Path (Join-Path $ClaudeDir 'skills\publicar\SKILL.md')) 'rode com -Desde 6 -Refazer' }
  if (-not $SemRotinas) {
    foreach ($r in @('revisao-semanal', 'backup-diario')) {
      $t = $false
      if ($Teste) { $t = Test-Path (Join-Path $RotDir "$r.cmd") } else { $null = (schtasks /Query /TN "Claude Setuper\$r" 2>&1); $t = ($LASTEXITCODE -eq 0) }
      add "Tarefa agendada: $r" $t 'rode com -Desde 8 -Refazer'
    }
  }
  add "Atalho `"Claude`" na $([char]0x00C1)rea de Trabalho" (Test-Path (Join-Path $Desktop 'Claude.cmd')) 'rode com -Desde 9 -Refazer'
  return $itens
}
function MostrarDoctor {
  Write-Host ""; Write-Host "Confer$([char]0x00EA)ncia final" -ForegroundColor White
  $itens = Conferir
  $faltam = 0
  foreach ($i in $itens) {
    if ($i.ok) { Write-Host "  $([char]0x2713) $($i.item)" -ForegroundColor Green }
    else { $faltam++; Write-Host "  $([char]0x2717) $($i.item)  $([char]0x2192) $($i.dica)" -ForegroundColor Red }
  }
  Write-Host ""
  if ($faltam -eq 0) { Write-Host "Tudo no lugar." -ForegroundColor Green } else { Write-Host "$faltam item(ns) pedem aten$([char]0x00E7)$([char]0x00E3)o. A dica ao lado diz o que fazer." -ForegroundColor Yellow }
  return $faltam
}

# ============================================================ comeco
Clear-Host
Write-Host "Claude Setuper $Versao (instalador para Windows)" -ForegroundColor White
if ($Teste) { Write-Host "MODO DE TESTE: nada $([char]0x00E9) instalado; arquivos v$([char]0x00E3)o para $Home_" -ForegroundColor Yellow }

if ($Doctor) { $n = MostrarDoctor; try { Stop-Transcript | Out-Null } catch {}; exit $n }

if ((Elevado) -and -not $Teste) {
  Pausa "Esta janela est$([char]0x00E1) como Administrador" @(
    "O instalador funciona melhor numa janela comum, porque instala tudo na sua conta de usu$([char]0x00E1)rio.",
    'Recomendo fechar, abrir o PowerShell normal (sem "Executar como administrador") e rodar de novo.',
    'Se quiser seguir assim mesmo, aperta Enter. Pra sair, fecha a janela.')
  Read-Host | Out-Null
}

Write-Host "Vou preparar o seu Claude. Leva uns 10 minutos e eu aviso toda vez que precisar de voc$([char]0x00EA)."
Write-Host ""

# respostas: parametro > estado salvo > pergunta
if ($Nome) { $Resp.nome = $Nome }
if (-not $Resp.nome) { $Resp.nome = Read-Host "Como voc$([char]0x00EA) quer que o Claude te chame?" }
if (-not $Resp.nome) { $Resp.nome = $env:USERNAME }
if ($Trabalho) { $Resp.trabalho = $Trabalho }
if (-not $Resp.trabalho) { $Resp.trabalho = Read-Host "Com o que voc$([char]0x00EA) trabalha? Conta em uma frase" }
if ($Autonomia) { $Resp.autonomia = $Autonomia }
if (-not $Resp.autonomia) {
  Write-Host "Como voc$([char]0x00EA) prefere que o Claude trabalhe?"
  Write-Host "  1) Me pergunta antes de cada coisa"
  Write-Host "  2) Faz o b$([char]0x00E1)sico sozinho e me pergunta no que importa"
  Write-Host "  3) Faz tudo e me avisa no fim"
  Write-Host "  4) Nunca me pede licen$([char]0x00E7)a pra nada (recomendado)"
  $op = Read-Host "Digite 1, 2, 3 ou 4"
  $Resp.autonomia = @{ '1' = 'cauteloso'; '2' = 'equilibrado'; '3' = 'confiante'; '4' = 'livre' }[$op]
  if (-not $Resp.autonomia) { $Resp.autonomia = 'livre' }
}
if ($Pacotes) { $Resp.pacotes = $Pacotes }
if (-not $Resp.pacotes) { $Resp.pacotes = 'escrita,negocios,pesquisa' }
$Resp.vault = $Vault
SalvarEstado

$AutonomiaTexto = @{
  cauteloso   = "Pergunte antes de qualquer a$([char]0x00E7)$([char]0x00E3)o que altere arquivos ou rode comandos. Prefira explicar o que vai fazer e esperar o ok."
  equilibrado = "Fa$([char]0x00E7)a o b$([char]0x00E1)sico sozinho (ler, escrever, organizar) e pergunte s$([char]0x00F3) no que for dif$([char]0x00ED)cil de desfazer ou que mude a dire$([char]0x00E7)$([char]0x00E3)o do trabalho."
  confiante   = "Fa$([char]0x00E7)a o trabalho inteiro sem pedir confirma$([char]0x00E7)$([char]0x00E3)o, e no fim conte o que fez, em linguagem simples."
  livre       = "Fa$([char]0x00E7)a o trabalho inteiro sem pedir confirma$([char]0x00E7)$([char]0x00E3)o, e no fim conte o que fez, em linguagem simples. Antes de apagar qualquer coisa, fa$([char]0x00E7)a uma c$([char]0x00F3)pia."
}[$Resp.autonomia]
$TrabalhoSeguro = (($Resp.trabalho -replace '["''`$%&|<>^!\\]', ' ') -replace '\s+', ' ').Trim()
if (-not $TrabalhoSeguro) { $TrabalhoSeguro = 'o meu trabalho do dia a dia' }
$Vars = @{
  nome = $Resp.nome; trabalho = $Resp.trabalho; trabalhoSeguro = $TrabalhoSeguro; autonomia = $Resp.autonomia; autonomiaTexto = $AutonomiaTexto
  vault = $Vault; data = (Get-Date).ToString('dd/MM/yyyy'); comoAbrir = "pelo atalho `"Claude`" na sua $([char]0x00C1)rea de Trabalho"
}
Ok "Pronto, $($Resp.nome). Agora $([char]0x00E9) comigo."

# ============================================================ os passos
$Passos = @()

$Passos += @{ id = 'base'; n = 1; nome = "Base da m$([char]0x00E1)quina"; acao = {
  if ($Teste) { return }
  if (-not (Tem 'winget.exe')) {
    Pausa "Preciso do 'Instalador de Aplicativo' da Microsoft" @('Vou abrir a Microsoft Store. Clica em Instalar (ou Atualizar), fecha a loja e roda este script de novo.')
    Start-Process 'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'
    throw "winget n$([char]0x00E3)o est$([char]0x00E1) dispon$([char]0x00ED)vel"
  }
  AtualizarPath
  if (-not (Tem 'git')) { $null = InstalarWinget 'Git.Git' 'o Git'; if (-not (Tem 'git')) { $null = InstalarGitDireto } }
  if (-not (Tem 'git')) { throw "n$([char]0x00E3)o consegui instalar o Git, que o Claude Code exige" }
  Ok "Git pronto ($(git --version))"
  if (-not (Tem 'node')) { $null = InstalarWinget 'OpenJS.NodeJS.LTS' 'o Node'; if (-not (Tem 'node') -and -not (Test-Path "$env:ProgramFiles\nodejs\node.exe")) { $null = InstalarNodeDireto } }
  AtualizarPath
  if (-not (Tem 'node')) { throw "o Node foi instalado mas esta janela ainda n$([char]0x00E3)o o enxerga: fecha a janela, abre de novo e roda o mesmo comando" }
  Ok "Node pronto ($(node -v))"
  if (-not (Tem 'claude')) {
    Passo "Instalando o Claude Code."
    # Em processo separado: o instalador oficial liga Set-StrictMode e isso nao pode vazar pra ca.
    $null = Rodar 'instalador do Claude' 'powershell.exe' @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex')
    Set-StrictMode -Off
    AtualizarPath
    if (-not (Tem 'claude')) { Aviso "Instalador oficial n$([char]0x00E3)o deixou o claude no caminho; tentando pelo npm."; $null = Rodar 'npm' 'npm.cmd' @('install', '-g', '@anthropic-ai/claude-code'); AtualizarPath }
  }
  foreach ($pasta in @("$env:USERPROFILE\.local\bin", "$env:APPDATA\npm")) { if (Test-Path $pasta) { GravarPathUsuario $pasta } }
  if (-not (Tem 'claude')) { throw "n$([char]0x00E3)o consegui instalar o Claude Code" }
  Ok "Claude Code pronto ($(claude --version 2>$null))"
  if (Logado) { Ok "Voc$([char]0x00EA) j$([char]0x00E1) est$([char]0x00E1) logado no Claude" }
  elseif ($SemLogin) { Aviso "Login do Claude pulado (-SemLogin). Depois: claude auth login" }
  else {
    Pausa "Vou abrir o navegador pra voc$([char]0x00EA) entrar na sua conta do Claude" @("Entra com o e-mail que voc$([char]0x00EA) usa no Claude. Se n$([char]0x00E3)o tem conta, cria ali mesmo.", "Depois volta pra c$([char]0x00E1), eu continuo sozinho.")
    claude auth login
    if (Esperar { Logado } 600) { Ok "Login no Claude feito" } else { throw "o login no Claude n$([char]0x00E3)o foi conclu$([char]0x00ED)do (rode depois: claude auth login)" }
  }
} }

$Passos += @{ id = 'nucleo'; n = 2; nome = "Ensinando o Claude quem voc$([char]0x00EA) $([char]0x00E9)"; acao = {
  BaixarTemplates
  $claudeMd = Join-Path $ClaudeDir 'CLAUDE.md'
  if (Test-Path $claudeMd) {
    $atual = [System.IO.File]::ReadAllText($claudeMd, $Utf8)
    if ($atual -notlike '*<!-- claude-setuper -->*') { Escrever $claudeMd ($atual + "`n`n" + (Tpl 'CLAUDE.md.tpl')) }
  } else { Escrever $claudeMd (Tpl 'CLAUDE.md.tpl') }

  $allow = @{
    cauteloso   = @('Read', 'Glob', 'Grep', 'LS', 'WebSearch')
    equilibrado = @('Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'WebSearch', 'WebFetch', 'Bash(git:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)', 'Bash(npm:*)', 'Bash(node:*)', 'Bash(python3:*)', 'Bash(start:*)', 'Bash(obsidian:*)')
    confiante   = @('Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'Bash', 'WebSearch', 'WebFetch')
    livre       = @('Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'Bash', 'WebSearch', 'WebFetch')
  }[$Resp.autonomia]
  $modo = @{ cauteloso = 'default'; equilibrado = 'acceptEdits'; confiante = 'auto'; livre = 'bypassPermissions' }[$Resp.autonomia]
  $hooksDir = Join-Path $ClaudeDir 'hooks'
  foreach ($h in @('cerebro-inicio.cjs', 'cerebro-fim.cjs', 'cerebro-nota.cjs')) { Escrever (Join-Path $hooksDir $h) (Tpl "hooks/$h") }
  $settingsPath = Join-Path $ClaudeDir 'settings.json'
  $settings = $null
  if (Test-Path $settingsPath) { try { $settings = Get-Content $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { $settings = $null } }
  if ($settings) { Copy-Item $settingsPath "$settingsPath.antes-do-setuper" -Force }
  $novo = [ordered]@{
    permissions = [ordered]@{ allow = $allow; deny = @('Bash(rm -rf:*)', 'Bash(sudo:*)', 'Bash(wget:*)', 'Read(.env)', 'Read(.env.*)', 'Edit(.env)', 'Edit(.env.*)', 'Read(appsettings.Production.json)', 'Edit(appsettings.Production.json)'); defaultMode = $modo }
    hooks = [ordered]@{
      SessionStart = @(@{ hooks = @(@{ type = 'command'; command = "node `"$(Posix (Join-Path $hooksDir 'cerebro-inicio.cjs'))`""; timeout = 10 }) })
      Stop         = @(@{ hooks = @(@{ type = 'command'; command = "node `"$(Posix (Join-Path $hooksDir 'cerebro-fim.cjs'))`""; timeout = 10 }) })
      PostToolUse  = @(@{ matcher = 'Write|Edit'; hooks = @(@{ type = 'command'; command = "node `"$(Posix (Join-Path $hooksDir 'cerebro-nota.cjs'))`""; timeout = 10 }) })
    }
    env = [ordered]@{ CLAUDE_SETUPER_VAULT = $Vault }
  }
  if ($settings) {
    foreach ($p in $settings.PSObject.Properties) { if (-not $novo.Contains($p.Name)) { $novo[$p.Name] = $p.Value } }
    $envAntigo = $settings.PSObject.Properties['env']
    if ($envAntigo -and $envAntigo.Value) { foreach ($p in $envAntigo.Value.PSObject.Properties) { if (-not $novo['env'].Contains($p.Name)) { $novo['env'][$p.Name] = $p.Value } } }
  }
  if ($Resp.autonomia -eq 'livre') { $novo['skipDangerousModePermissionPrompt'] = $true }
  Escrever $settingsPath (Json $novo)
  foreach ($s in @('decisao', 'padrao', 'feedback', 'descoberta', 'retro', 'lembrar')) { Escrever (Join-Path (Join-Path (Join-Path $ClaudeDir 'skills') $s) 'SKILL.md') (Tpl "skills/$s.md") }
  EscreverSeFaltar (Join-Path (Join-Path $ClaudeDir 'memoria') 'MEMORIA.md') (Tpl 'memoria/MEMORIA.md')
  Ok "CLAUDE.md, permiss$([char]0x00F5)es, hooks e comandos do segundo c$([char]0x00E9)rebro no lugar"
} }

$Passos += @{ id = 'obsidian'; n = 3; nome = "Segundo c$([char]0x00E9)rebro (Obsidian)"; acao = {
  BaixarTemplates
  if (ObsidianExe) { Ok "Obsidian j$([char]0x00E1) est$([char]0x00E1) instalado" } elseif (-not $Teste) { if (-not (InstalarWinget 'Obsidian.Obsidian' "o Obsidian, o seu segundo c$([char]0x00E9)rebro")) { Aviso "O app n$([char]0x00E3)o instalou agora; o cofre fica pronto mesmo assim" } }
  # O instalador abre o Obsidian sozinho e ele reescreveria o obsidian.json por cima do nosso registro.
  if (-not $Teste) { Start-Sleep -Seconds 3; Get-Process Obsidian -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue }
  $pastas = [ordered]@{ feedback = 'feedback'; "decis$([char]0x00F5)es" = "decis$([char]0x00E3)o"; "padr$([char]0x00F5)es" = "padr$([char]0x00E3)o"; descobertas = 'descoberta'; projetos = 'projeto' }
  foreach ($p in $pastas.Keys) {
    $d = Join-Path (Join-Path $Vault 'CLAUDE') $p
    New-Item -ItemType Directory -Force -Path $d | Out-Null
    EscreverSeFaltar (Join-Path $d 'README.md') (Tpl 'vault/README-pasta.md' @{ pasta = $p; tag = $pastas[$p] })
  }
  foreach ($p in @('1. PROJETOS', "2. $([char]0x00C1)REAS", '3. RECURSOS', '4. ARQUIVO', 'TEMPLATES', '_anexos')) { New-Item -ItemType Directory -Force -Path (Join-Path $Vault $p) | Out-Null }
  EscreverSeFaltar (Join-Path $Vault 'Comece aqui.md') (Tpl 'vault/Comece aqui.md')
  EscreverSeFaltar (Join-Path $Vault 'Painel do Claude.md') (Tpl 'vault/Painel do Claude.md')
  EscreverSeFaltar (Join-Path (Join-Path $Vault 'TEMPLATES') 'Nota do Claude.md') (Tpl 'vault/template-nota.md')
  EscreverSeFaltar (Join-Path (Join-Path (Join-Path $Vault 'CLAUDE') "padr$([char]0x00F5)es") 'Como falar comigo.md') (Tpl 'vault/padrao-inicial.md')
  $obs = Join-Path $Vault '.obsidian'
  EscreverSeFaltar (Join-Path $obs 'app.json') (Json @{ attachmentFolderPath = '_anexos'; newFileLocation = 'root'; useMarkdownLinks = $false; alwaysUpdateLinks = $true; showUnsupportedFiles = $false })
  EscreverSeFaltar (Join-Path $obs 'appearance.json') (Json @{ theme = 'obsidian'; baseFontSize = 16; accentColor = '#c8873c'; showViewHeader = $true })
  EscreverSeFaltar (Join-Path $obs 'core-plugins.json') (Json ([ordered]@{ 'file-explorer' = $true; 'global-search' = $true; switcher = $true; graph = $true; backlink = $true; canvas = $true; 'outgoing-link' = $true; 'tag-pane' = $true; properties = $true; 'page-preview' = $true; 'daily-notes' = $false; templates = $true; 'note-composer' = $true; 'command-palette' = $true; 'editor-status' = $true; bookmarks = $true; outline = $true; 'word-count' = $true; 'file-recovery' = $true; footnotes = $false; 'slash-command' = $false; 'markdown-importer' = $false; 'zk-prefixer' = $false; 'random-note' = $false; slides = $false; 'audio-recorder' = $false; workspaces = $false; publish = $false; sync = $false; webviewer = $false; bases = $true }))
  EscreverSeFaltar (Join-Path $obs 'templates.json') (Json @{ folder = 'TEMPLATES'; dateFormat = 'YYYY-MM-DD'; timeFormat = 'HH:mm' })
  EscreverSeFaltar (Join-Path $obs 'hotkeys.json') '{}'
  Escrever (Join-Path $obs 'community-plugins.json') (Json @('dataview', 'templater-obsidian'))
  EscreverSeFaltar (Join-Path (Join-Path (Join-Path $obs 'plugins') 'templater-obsidian') 'data.json') (Json @{ templates_folder = 'TEMPLATES'; trigger_on_file_creation = $false })
  foreach ($pl in @(@{ repo = 'blacksmithgu/obsidian-dataview'; id = 'dataview' }, @{ repo = 'SilentVoid13/Templater'; id = 'templater-obsidian' })) {
    $dest = Join-Path (Join-Path $obs 'plugins') $pl.id
    if (Test-Path (Join-Path $dest 'main.js')) { continue }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    try {
      $rel = Invoke-RestMethod -UseBasicParsing "https://api.github.com/repos/$($pl.repo)/releases/latest" -Headers @{ 'User-Agent' = 'claude-setuper' }
      foreach ($f in @('main.js', 'manifest.json', 'styles.css')) {
        $a = $rel.assets | Where-Object { $_.name -eq $f } | Select-Object -First 1
        if ($a) { BaixarArquivo $a.browser_download_url (Join-Path $dest $f) }
      }
      Ok "Plugin $($pl.id) baixado"
    } catch { Aviso "N$([char]0x00E3)o consegui baixar o plugin $($pl.id): $($_.Exception.Message)" }
  }
  $cfgObs = Join-Path (Join-Path $AppData 'obsidian') 'obsidian.json'
  $reg = $null
  if (Test-Path $cfgObs) { try { $reg = Get-Content $cfgObs -Raw -Encoding UTF8 | ConvertFrom-Json } catch {} }
  $vaults = [ordered]@{}
  $vid = $null
  if ($reg -and $reg.vaults) {
    foreach ($p in $reg.vaults.PSObject.Properties) {
      $vaults[$p.Name] = @{ path = $p.Value.path; ts = $p.Value.ts }
      if ($p.Value.path.Normalize() -eq $Vault.Normalize()) { $vid = $p.Name }
    }
  }
  if (-not $vid) { $vid = -join ((1..16) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) }) }
  $vaults[$vid] = @{ path = $Vault; ts = [int64]((Get-Date).ToUniversalTime() - (Get-Date '1970-01-01')).TotalMilliseconds; open = $true }
  $regNovo = [ordered]@{ vaults = $vaults }
  if ($reg) { foreach ($p in $reg.PSObject.Properties) { if ($p.Name -ne 'vaults') { $regNovo[$p.Name] = $p.Value } } }
  if (-not $regNovo.Contains('cli')) { $regNovo['cli'] = $true }
  Escrever $cfgObs (Json $regNovo)
  Ok "Cofre montado em $Vault e registrado no Obsidian"
} }

$Passos += @{ id = 'github'; n = 4; nome = 'GitHub'; pular = $SemGitHub; acao = {
  if ($Teste) { return }
  if (-not (Tem 'gh')) { if (-not (InstalarWinget 'GitHub.cli' 'a ferramenta do GitHub')) { throw "n$([char]0x00E3)o consegui instalar o gh" } }
  $status = (gh auth status 2>&1 | Out-String)
  if ($status -notmatch 'Logged in') {
    $tem = Read-Host "Voc$([char]0x00EA) j$([char]0x00E1) tem uma conta no GitHub? (s/n)"
    if ($tem -notmatch '^[sS]') {
      Pausa "Vou abrir a p$([char]0x00E1)gina pra criar sua conta no GitHub" @("$([char]0x00C9) de gra$([char]0x00E7)a. Usa o seu e-mail principal.", 'Quando terminar de criar, volta aqui e aperta Enter.')
      Start-Process 'https://github.com/signup'; Read-Host "Criou? Aperta Enter" | Out-Null
    }
    Pausa "Vou abrir o navegador pra conectar o GitHub" @("Vai aparecer um c$([char]0x00F3)digo de 8 letras aqui. Copia ele.", "No navegador, cola o c$([char]0x00F3)digo, Continuar, Autorizar. Depois volta pra c$([char]0x00E1).")
    gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key
    if ((gh auth status 2>&1 | Out-String) -notmatch 'Logged in') { throw "o login no GitHub n$([char]0x00E3)o foi conclu$([char]0x00ED)do (rode depois: gh auth login --web)" }
  } else { Ok "GitHub j$([char]0x00E1) conectado" }
  $login = (gh api user --jq '.login' 2>$null)
  if ($login -and -not (git config --global user.name)) {
    $u = gh api user | ConvertFrom-Json
    $nomeGit = if ($u.name) { $u.name } else { $login }
    $email = if ($u.email) { $u.email } else { "$($u.id)+$login@users.noreply.github.com" }
    git config --global user.name $nomeGit; git config --global user.email $email
  }
  git config --global init.defaultBranch main
  $null = Rodar 'gh auth setup-git' 'gh' @('auth', 'setup-git')
  New-Item -ItemType Directory -Force -Path (Join-Path $Home_ 'Projetos') | Out-Null
  Ok "git configurado como $login"
} }

$Passos += @{ id = 'chrome'; n = 5; nome = 'Claude no Chrome'; pular = $SemChrome; acao = {
  if ($Teste) { return }
  if (-not (ChromeExe)) { if (-not (InstalarWinget 'Google.Chrome' 'o Google Chrome')) { throw "n$([char]0x00E3)o consegui instalar o Chrome" } } else { Ok "Chrome j$([char]0x00E1) est$([char]0x00E1) instalado" }
  if (ExtensaoChrome) { Ok "Extens$([char]0x00E3)o do Claude j$([char]0x00E1) est$([char]0x00E1) no Chrome"; return }
  Pausa "O Chrome vai abrir na p$([char]0x00E1)gina da extens$([char]0x00E3)o do Claude" @('Clica em "Usar no Chrome" (ou "Adicionar ao Chrome") e confirma.', "Depois clica no $([char]0x00ED)cone do Claude na barra do Chrome e entra com a sua conta. Eu espero at$([char]0x00E9) 10 minutos.")
  Start-Process "https://chromewebstore.google.com/detail/$ExtId"
  if (Esperar { ExtensaoChrome } 600) { Ok "Extens$([char]0x00E3)o instalada" } else { Aviso "N$([char]0x00E3)o vi a extens$([char]0x00E3)o aparecer. D$([char]0x00E1) pra instalar depois pelo mesmo link; n$([char]0x00E3)o trava o resto." }
} }

$Passos += @{ id = 'vercel'; n = 6; nome = 'Vercel (publicar sites)'; pular = $SemVercel; acao = {
  BaixarTemplates
  Escrever (Join-Path (Join-Path (Join-Path $ClaudeDir 'skills') 'publicar') 'SKILL.md') (Tpl 'skills/publicar.md')
  if ($Teste) { return }
  if (-not (Tem 'vercel')) { Passo "Instalando a ferramenta da Vercel."; if (-not (Rodar 'npm' 'npm.cmd' @('install', '-g', 'vercel'))) { throw "n$([char]0x00E3)o consegui instalar a Vercel pelo npm" }; AtualizarPath }
  $quem = (vercel whoami 2>&1 | Out-String)
  if ($quem -match 'Error|not') {
    Pausa "Vou abrir o navegador pra conectar a Vercel" @("Escolhe `"Continue with GitHub`" e autoriza (cria a conta ali se n$([char]0x00E3)o tiver).", "Depois volta pra c$([char]0x00E1).")
    vercel login
    $quem = (vercel whoami 2>&1 | Out-String)
    if ($quem -match 'Error|not') { Aviso "Login na Vercel n$([char]0x00E3)o confirmado. D$([char]0x00E1) pra fazer depois com: vercel login" } else { Ok "Vercel conectada" }
  } else { Ok "Vercel j$([char]0x00E1) conectada ($(Ultimas $quem 1))" }
} }

$Passos += @{ id = 'pacotes'; n = 7; nome = 'Comandos do seu tipo de trabalho'; acao = {
  BaixarTemplates
  $mapa = @{ escrita = @('revisar', 'email'); negocios = @('proposta', 'reuniao', 'planilha'); pesquisa = @('pesquisar', 'resumir'); criador = @('post', 'roteiro'); dev = @('projeto-novo', 'revisar-codigo') }
  $escolhidos = @()
  foreach ($p in ($Resp.pacotes -split ',')) { $p = $p.Trim(); if ($mapa.ContainsKey($p)) { $escolhidos += $p; foreach ($s in $mapa[$p]) { Escrever (Join-Path (Join-Path (Join-Path $ClaudeDir 'skills') $s) 'SKILL.md') (Tpl "pacotes/$s.md") } } }
  Ok ("Pacotes: " + ($escolhidos -join ', '))
} }

$Passos += @{ id = 'rotinas'; n = 8; nome = "Rotinas (revis$([char]0x00E3)o semanal e backup di$([char]0x00E1)rio)"; pular = $SemRotinas; acao = {
  BaixarTemplates
  # A revisao semanal le o pedido pro Claude de um arquivo ao lado do script (linha de comando comprida nao cabe no cmd).
  foreach ($pr in @('prompt-revisao.md', 'prompt-ingest.md')) { if (Test-Path (Join-Path $TplDir "rotinas/$pr")) { Escrever (Join-Path $RotDir $pr) (Tpl "rotinas/$pr" @{ vault = $Vault }) } }
  foreach ($r in @(@{ id = 'revisao-semanal'; hora = '09:00'; sc = @('/SC', 'WEEKLY', '/D', 'MON') }, @{ id = 'backup-diario'; hora = '21:00'; sc = @('/SC', 'DAILY') })) {
    $script = Join-Path $RotDir "$($r.id).cmd"
    Escrever $script (Tpl "rotinas/$($r.id).cmd" @{ vault = $Vault; logs = $RotDir })
    if (-not $Teste) { if (-not (Rodar "schtasks $($r.id)" 'schtasks' (@('/Create', '/F', '/TN', "Claude Setuper\$($r.id)", '/TR', "`"$script`"", '/ST', $r.hora) + $r.sc))) { $falhouAgenda = $true; Aviso "N$([char]0x00E3)o consegui agendar $($r.id); o arquivo ficou em $script" } }
  }
  if ($falhouAgenda) { throw "uma das tarefas n$([char]0x00E3)o foi agendada (veja a linha em cinza acima)" }
  Ok "Rotinas agendadas"
} }

$Passos += @{ id = 'atalho'; n = 9; nome = "Atalho do Claude na $([char]0x00C1)rea de Trabalho"; acao = {
  BaixarTemplates
  New-Item -ItemType Directory -Force -Path $Desktop | Out-Null
  $atalho = Join-Path $Desktop 'Claude.cmd'
  Escrever $atalho (Tpl 'atalho/Claude.cmd' @{ marcador = (Join-Path $ClaudeDir '.setuper-saudou'); trabalho = $TrabalhoSeguro })
  Ok "Atalho criado: $atalho"
} }

# ============================================================ execucao
$falhas = @()
foreach ($p in $Passos) {
  Passo "$($p.n)/9  $($p.nome)"
  if ($p.pular) { Aviso "Pulado a pedido"; continue }
  if ($p.n -lt $Desde) { Aviso "Pulado (-Desde $Desde)"; continue }
  if (-not $Refazer -and $Feitos[$p.id] -and $Feitos[$p.id].ok) { Ok "J$([char]0x00E1) feito antes; pulando (use -Refazer pra repetir)"; continue }
  try {
    if ($SimularErro -eq $p.id) { throw 'erro simulado pra teste' }
    & $p.acao
    $Feitos[$p.id] = @{ ok = $true; em = (Get-Date).ToString('o') }
  } catch {
    $msg = $_.Exception.Message
    $Feitos[$p.id] = @{ ok = $false; em = (Get-Date).ToString('o'); erro = $msg }
    $falhas += "$($p.nome): $msg"
    Aviso "N$([char]0x00E3)o deu certo agora: $msg"
    Aviso "Sigo com o resto. No fim eu mostro o que ficou pendente."
  }
  SalvarEstado
}

# ============================================================ abertura final
$baseFalhou = ($falhas | Where-Object { $_ -like 'Base*' }).Count -gt 0
if (-not $Teste -and -not $baseFalhou) {
  if (ObsidianExe) {
    Pausa "O Obsidian vai abrir e perguntar se voc$([char]0x00EA) confia nos plugins" @("Clica em `"Confiar no autor e habilitar plugins`". S$([char]0x00E3)o o Dataview e o Templater, os dois mais usados. Pode confiar.")
    Get-Process Obsidian -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    try { Start-Process "obsidian://open?path=$([uri]::EscapeDataString($Vault))&file=$([uri]::EscapeDataString('Comece aqui'))" -ErrorAction Stop } catch {}
    Start-Sleep -Seconds 4
  }
  $atalho = Join-Path $Desktop 'Claude.cmd'
  if (Test-Path $atalho) { try { Start-Process $atalho -ErrorAction Stop } catch { Aviso "N$([char]0x00E3)o consegui abrir o Claude daqui (sess$([char]0x00E3)o sem $([char]0x00E1)rea de trabalho). Dois cliques no atalho da $([char]0x00C1)rea de Trabalho resolvem." } }
}

$faltam = MostrarDoctor
Write-Host ""
if ($falhas.Count) {
  Write-Host "Ficou pendente:" -ForegroundColor Yellow
  foreach ($f in $falhas) { Write-Host "  $([char]0x2022) $f" -ForegroundColor Yellow }
  Write-Host "Rode o mesmo comando de novo: ele pula o que j$([char]0x00E1) est$([char]0x00E1) feito e tenta s$([char]0x00F3) o que faltou." -ForegroundColor Yellow
} else {
  Write-Host "Pronto, $($Resp.nome). O Claude est$([char]0x00E1) abrindo numa janela nova e o seu segundo c$([char]0x00E9)rebro est$([char]0x00E1) no Obsidian." -ForegroundColor Green
  Write-Host "Da pr$([char]0x00F3)xima vez, dois cliques no 'Claude' da $([char]0x00C1)rea de Trabalho."
}
Write-Host "Registro: $Log"
try { Stop-Transcript | Out-Null } catch {}
