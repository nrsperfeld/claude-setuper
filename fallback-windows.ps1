<#
Claude Setuper — versão de reserva para Windows (um arquivo só, sem o wizard em Node).
Faz a instalação inteira direto do PowerShell. Use quando o caminho normal (.bat + install.ps1) não funcionar.

Rodar (pergunta nome, trabalho e autonomia):
  powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/fallback-windows.ps1 | iex"

Rodar sem perguntas (baixa o arquivo e passa os parâmetros):
  irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/fallback-windows.ps1 -OutFile setup.ps1
  powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Nome "Maria" -Trabalho "tenho uma loja de roupas" -Autonomia equilibrado

Parâmetros: -Nome, -Trabalho, -Autonomia (cauteloso | equilibrado | confiante), -Pacotes (escrita,negocios,pesquisa,criador,dev),
            -SemVercel, -SemChrome, -SemGitHub, -SemRotinas, -Teste (não instala nada nem faz login; só gera os arquivos numa pasta de teste)
#>
[CmdletBinding()]
param(
  [string]$Nome,
  [string]$Trabalho,
  [ValidateSet('cauteloso', 'equilibrado', 'confiante', '')][string]$Autonomia = '',
  [string]$Pacotes = 'escrita,negocios,pesquisa',
  [switch]$SemVercel, [switch]$SemChrome, [switch]$SemGitHub, [switch]$SemRotinas,
  [switch]$Teste, [string]$PastaTeste
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$Repo = 'nrsperfeld/claude-setuper'
$Utf8 = New-Object System.Text.UTF8Encoding $false

# ---------- casa (real ou de teste) ----------
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
$Vault = Join-Path (Join-Path $Home_ 'Documents') 'Segundo Cérebro'
$Desktop = Join-Path $Home_ 'Desktop'
New-Item -ItemType Directory -Force -Path $PastaSetuper | Out-Null
$Log = Join-Path $PastaSetuper 'registro-fallback.log'
try { Start-Transcript -Path $Log -Append | Out-Null } catch {}

# ---------- utilidades ----------
function Passo($t) { Write-Host ""; Write-Host "▸ $t" -ForegroundColor Cyan }
function Ok($t)    { Write-Host "  ✓ $t" -ForegroundColor Green }
function Aviso($t) { Write-Host "  ! $t" -ForegroundColor Yellow }
function Pausa($titulo, $linhas) {
  Write-Host ""; Write-Host "  ✋ $titulo" -ForegroundColor Yellow
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
function AtualizarPath {
  try { $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User') } catch {}
  foreach ($p in @("$env:ProgramFiles\nodejs", "$env:ProgramFiles\Git\cmd", "$env:ProgramFiles\Git\bin", "$env:ProgramFiles\GitHub CLI", "$env:APPDATA\npm", "$env:USERPROFILE\.local\bin", "$env:LOCALAPPDATA\Microsoft\WinGet\Links")) {
    if ($p -and (($env:Path -split ';') -notcontains $p)) { $env:Path = "$p;$env:Path" }
  }
}
function InstalarWinget($id, $nome) {
  if ($Teste) { return }
  Passo "Instalando $nome (pode levar uns minutos, é normal)."
  & winget.exe install -e --id $id --silent --accept-source-agreements --accept-package-agreements --disable-interactivity | Out-Null
  AtualizarPath
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

# ---------- templates (vêm do repositório, pra ter uma fonte só) ----------
$TplDir = Join-Path $PastaSetuper 'templates'
function BaixarTemplates {
  if (Test-Path (Join-Path $TplDir 'CLAUDE.md.tpl')) { return }
  Passo "Baixando os textos e modelos do Claude Setuper."
  $zip = Join-Path $PastaSetuper 'setuper.zip'
  Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/$Repo/zip/refs/heads/main" -OutFile $zip
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

# ---------- começo ----------
Clear-Host
Write-Host "Claude Setuper (versão de reserva para Windows)" -ForegroundColor White
if ($Teste) { Write-Host "MODO DE TESTE: nada é instalado; arquivos vão para $Home_" -ForegroundColor Yellow }
Write-Host "Vou preparar o seu Claude. Leva uns 10 minutos e eu aviso toda vez que precisar de você."
Write-Host ""

if (-not $Nome) { $Nome = Read-Host "Como você quer que o Claude te chame?" }
if (-not $Nome) { $Nome = $env:USERNAME }
if (-not $Trabalho) { $Trabalho = Read-Host "Com o que você trabalha? Conta em uma frase" }
if (-not $Autonomia) {
  Write-Host "Como você prefere que o Claude trabalhe?"
  Write-Host "  1) Me pergunta antes de cada coisa"
  Write-Host "  2) Faz o básico sozinho e me pergunta no que importa (recomendado)"
  Write-Host "  3) Faz tudo e me avisa no fim"
  $op = Read-Host "Digite 1, 2 ou 3"
  $Autonomia = @{ '1' = 'cauteloso'; '2' = 'equilibrado'; '3' = 'confiante' }[$op]
  if (-not $Autonomia) { $Autonomia = 'equilibrado' }
}
$AutonomiaTexto = @{
  cauteloso   = 'Pergunte antes de qualquer ação que altere arquivos ou rode comandos. Prefira explicar o que vai fazer e esperar o ok.'
  equilibrado = 'Faça o básico sozinho (ler, escrever, organizar) e pergunte só no que for difícil de desfazer ou que mude a direção do trabalho.'
  confiante   = 'Faça o trabalho inteiro sem pedir confirmação, e no fim conte o que fez, em linguagem simples.'
}[$Autonomia]
$TrabalhoSeguro = (($Trabalho -replace '["''`$%&|<>^!\\]', ' ') -replace '\s+', ' ').Trim()
if (-not $TrabalhoSeguro) { $TrabalhoSeguro = 'o meu trabalho do dia a dia' }
$Vars = @{
  nome = $Nome; trabalho = $Trabalho; trabalhoSeguro = $TrabalhoSeguro; autonomia = $Autonomia; autonomiaTexto = $AutonomiaTexto
  vault = $Vault; data = (Get-Date).ToString('dd/MM/yyyy'); comoAbrir = 'pelo atalho "Claude" na sua Área de Trabalho'
}
Ok "Pronto, $Nome. Agora é comigo."

# ---------- 1. base ----------
Passo "1/9  Base da máquina"
if (-not $Teste) {
  if (-not (Tem 'winget.exe')) {
    Pausa "Preciso do 'Instalador de Aplicativo' da Microsoft" @('Vou abrir a Microsoft Store. Clica em Instalar (ou Atualizar), fecha a loja e roda este script de novo.')
    Start-Process 'ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'
    Read-Host "Aperta Enter pra fechar"; exit 1
  }
  if (-not (Tem 'git')) { InstalarWinget 'Git.Git' 'o Git' } else { Ok "Git já está instalado" }
  if (-not (Test-Path "$env:ProgramFiles\Git\bin\bash.exe") -and -not (Tem 'bash')) { InstalarWinget 'Git.Git' 'o Git Bash' }
  if (-not (Tem 'node')) { InstalarWinget 'OpenJS.NodeJS.LTS' 'o Node' } else { Ok "Node já está instalado" }
  AtualizarPath
  if (-not (Tem 'node')) { Aviso "O Node não entrou no caminho. Fecha esta janela, abre de novo e roda o script outra vez."; exit 1 }
  if (-not (Tem 'claude')) {
    Passo "Instalando o Claude Code."
    try { Invoke-Expression (Invoke-RestMethod -UseBasicParsing 'https://claude.ai/install.ps1') } catch { Aviso "Instalador oficial falhou, tentando pelo npm." }
    AtualizarPath
    if (-not (Tem 'claude')) { npm install -g @anthropic-ai/claude-code | Out-Null; AtualizarPath }
  } else { Ok "Claude Code já está instalado" }
  if (-not (Tem 'claude')) { Aviso "Não consegui instalar o Claude Code. Veja o registro em $Log"; exit 1 }
  if (Logado) { Ok "Você já está logado no Claude" }
  else {
    Pausa "Vou abrir o navegador pra você entrar na sua conta do Claude" @('Entra com o e-mail que você usa no Claude. Se não tem conta, cria ali mesmo.', 'Depois volta pra cá, eu continuo sozinho.')
    claude auth login
    if (Esperar { Logado } 600) { Ok "Login no Claude feito" } else { Aviso "Não confirmei o login. Dá pra fazer depois com: claude auth login" }
  }
}
BaixarTemplates

# ---------- 2. núcleo ----------
Passo "2/9  Ensinando o Claude quem você é"
$claudeMd = Join-Path $ClaudeDir 'CLAUDE.md'
if (Test-Path $claudeMd) {
  $atual = [System.IO.File]::ReadAllText($claudeMd, $Utf8)
  if ($atual -notlike '*<!-- claude-setuper -->*') { Escrever $claudeMd ($atual + "`n`n" + (Tpl 'CLAUDE.md.tpl')) }
} else { Escrever $claudeMd (Tpl 'CLAUDE.md.tpl') }

$allow = @{
  cauteloso   = @('Read', 'Glob', 'Grep', 'LS', 'WebSearch')
  equilibrado = @('Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'WebSearch', 'WebFetch', 'Bash(git:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)', 'Bash(npm:*)', 'Bash(node:*)', 'Bash(python3:*)', 'Bash(start:*)', 'Bash(obsidian:*)')
  confiante   = @('Read', 'Edit', 'Write', 'MultiEdit', 'Glob', 'Grep', 'LS', 'Bash', 'WebSearch', 'WebFetch')
}[$Autonomia]
$modo = @{ cauteloso = 'default'; equilibrado = 'acceptEdits'; confiante = 'auto' }[$Autonomia]
$hooksDir = Join-Path $ClaudeDir 'hooks'
foreach ($h in @('cerebro-inicio.cjs', 'cerebro-fim.cjs', 'cerebro-nota.cjs')) { Escrever (Join-Path $hooksDir $h) (Tpl "hooks/$h") }
$settingsPath = Join-Path $ClaudeDir 'settings.json'
$settings = $null
if (Test-Path $settingsPath) { try { $settings = Get-Content $settingsPath -Raw | ConvertFrom-Json } catch { $settings = $null } }
if ($settings) { Copy-Item $settingsPath "$settingsPath.antes-do-setuper" -Force }
$novo = [ordered]@{
  permissions = [ordered]@{ allow = $allow; deny = @('Bash(rm -rf:*)', 'Bash(git push --force:*)', 'Read(.env)', 'Read(.env.*)', 'Edit(.env)', 'Edit(.env.*)', 'Write(.env)', 'Write(.env.*)'); defaultMode = $modo }
  hooks = [ordered]@{
    SessionStart = @(@{ hooks = @(@{ type = 'command'; command = "node `"$(Posix (Join-Path $hooksDir 'cerebro-inicio.cjs'))`""; timeout = 10 }) })
    Stop         = @(@{ hooks = @(@{ type = 'command'; command = "node `"$(Posix (Join-Path $hooksDir 'cerebro-fim.cjs'))`""; timeout = 10 }) })
    PostToolUse  = @(@{ matcher = 'Write|Edit'; hooks = @(@{ type = 'command'; command = "node `"$(Posix (Join-Path $hooksDir 'cerebro-nota.cjs'))`""; timeout = 10 }) })
  }
  env = [ordered]@{ CLAUDE_SETUPER_VAULT = $Vault }
}
if ($settings) {
  # Mantém o que a pessoa já tinha e acrescenta o nosso.
  foreach ($p in $settings.PSObject.Properties) { if (-not $novo.Contains($p.Name)) { $novo[$p.Name] = $p.Value } }
  if ($settings.env) { foreach ($p in $settings.env.PSObject.Properties) { if (-not $novo.env.Contains($p.Name)) { $novo.env[$p.Name] = $p.Value } } }
}
Escrever $settingsPath (Json $novo)
foreach ($s in @('decisao', 'padrao', 'feedback', 'descoberta', 'retro', 'lembrar')) { Escrever (Join-Path (Join-Path (Join-Path $ClaudeDir 'skills') $s) 'SKILL.md') (Tpl "skills/$s.md") }
EscreverSeFaltar (Join-Path (Join-Path $ClaudeDir 'memoria') 'MEMORIA.md') (Tpl 'memoria/MEMORIA.md')
Ok "CLAUDE.md, permissões, hooks e comandos do segundo cérebro no lugar"

# ---------- 3. Obsidian ----------
Passo "3/9  Segundo cérebro (Obsidian)"
$obsExe = @((Join-Path $LocalAppData 'Programs\Obsidian\Obsidian.exe'), (Join-Path $LocalAppData 'Obsidian\Obsidian.exe'), "$env:ProgramFiles\Obsidian\Obsidian.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $obsExe) { InstalarWinget 'Obsidian.Obsidian' 'o Obsidian, o seu segundo cérebro' } else { Ok "Obsidian já está instalado" }
$pastas = [ordered]@{ feedback = 'feedback'; 'decisões' = 'decisão'; 'padrões' = 'padrão'; descobertas = 'descoberta'; projetos = 'projeto' }
foreach ($p in $pastas.Keys) {
  $d = Join-Path (Join-Path $Vault 'CLAUDE') $p
  New-Item -ItemType Directory -Force -Path $d | Out-Null
  EscreverSeFaltar (Join-Path $d 'README.md') (Tpl 'vault/README-pasta.md' @{ pasta = $p; tag = $pastas[$p] })
}
foreach ($p in @('1. PROJETOS', '2. ÁREAS', '3. RECURSOS', '4. ARQUIVO', 'TEMPLATES', '_anexos')) { New-Item -ItemType Directory -Force -Path (Join-Path $Vault $p) | Out-Null }
EscreverSeFaltar (Join-Path $Vault 'Comece aqui.md') (Tpl 'vault/Comece aqui.md')
EscreverSeFaltar (Join-Path $Vault 'Painel do Claude.md') (Tpl 'vault/Painel do Claude.md')
EscreverSeFaltar (Join-Path (Join-Path $Vault 'TEMPLATES') 'Nota do Claude.md') (Tpl 'vault/template-nota.md')
EscreverSeFaltar (Join-Path (Join-Path (Join-Path $Vault 'CLAUDE') 'padrões') 'Como falar comigo.md') (Tpl 'vault/padrao-inicial.md')
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
      if ($a) { Invoke-WebRequest -UseBasicParsing $a.browser_download_url -OutFile (Join-Path $dest $f) }
    }
    Ok "Plugin $($pl.id) baixado"
  } catch { Aviso "Não consegui baixar o plugin $($pl.id): $($_.Exception.Message)" }
}
$cfgObs = Join-Path (Join-Path $AppData 'obsidian') 'obsidian.json'
$reg = $null
if (Test-Path $cfgObs) { try { $reg = Get-Content $cfgObs -Raw | ConvertFrom-Json } catch {} }
$vaults = [ordered]@{}
$vid = $null
if ($reg -and $reg.vaults) {
  foreach ($p in $reg.vaults.PSObject.Properties) {
    $v = @{ path = $p.Value.path; ts = $p.Value.ts }
    if ($p.Value.path.Normalize() -eq $Vault.Normalize()) { $vid = $p.Name }
    $vaults[$p.Name] = $v
  }
}
if (-not $vid) { $vid = -join ((1..16) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) }) }
$vaults[$vid] = @{ path = $Vault; ts = [int64]((Get-Date).ToUniversalTime() - (Get-Date '1970-01-01')).TotalMilliseconds; open = $true }
$regNovo = [ordered]@{ vaults = $vaults }
if ($reg) { foreach ($p in $reg.PSObject.Properties) { if ($p.Name -ne 'vaults') { $regNovo[$p.Name] = $p.Value } } }
if (-not $regNovo.Contains('cli')) { $regNovo['cli'] = $true }
Escrever $cfgObs (Json $regNovo)
Ok "Cofre montado em $Vault e registrado no Obsidian"

# ---------- 4. GitHub ----------
Passo "4/9  GitHub"
if ($SemGitHub) { Aviso "Pulado a pedido (-SemGitHub)" }
elseif (-not $Teste) {
  if (-not (Tem 'gh')) { InstalarWinget 'GitHub.cli' 'a ferramenta do GitHub' } else { Ok "Ferramenta do GitHub já instalada" }
  $status = (gh auth status 2>&1 | Out-String)
  if ($status -notmatch 'Logged in') {
    $tem = Read-Host "Você já tem uma conta no GitHub? (s/n)"
    if ($tem -notmatch '^[sS]') {
      Pausa "Vou abrir a página pra criar sua conta no GitHub" @('É de graça. Usa o seu e-mail principal.', 'Quando terminar de criar, volta aqui e aperta Enter.')
      Start-Process 'https://github.com/signup'; Read-Host "Criou? Aperta Enter"
    }
    Pausa "Vou abrir o navegador pra conectar o GitHub" @('Vai aparecer um código de 8 letras aqui. Copia ele.', 'No navegador, cola o código, Continuar, Autorizar. Depois volta pra cá.')
    gh auth login --hostname github.com --git-protocol https --web --skip-ssh-key
  } else { Ok "GitHub já conectado" }
  try {
    $login = (gh api user --jq '.login' 2>$null)
    if ($login -and -not (git config --global user.name)) {
      $u = gh api user | ConvertFrom-Json
      $nomeGit = if ($u.name) { $u.name } else { $login }
      $email = if ($u.email) { $u.email } else { "$($u.id)+$login@users.noreply.github.com" }
      git config --global user.name $nomeGit; git config --global user.email $email
    }
    git config --global init.defaultBranch main
    gh auth setup-git 2>$null
    New-Item -ItemType Directory -Force -Path (Join-Path $Home_ 'Projetos') | Out-Null
    Ok "git configurado"
  } catch { Aviso "GitHub ficou pela metade: $($_.Exception.Message)" }
}

# ---------- 5. Chrome ----------
Passo "5/9  Claude no Chrome"
if ($SemChrome) { Aviso "Pulado a pedido (-SemChrome)" }
elseif (-not $Teste) {
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", (Join-Path $LocalAppData 'Google\Chrome\Application\chrome.exe')) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $chrome) { InstalarWinget 'Google.Chrome' 'o Google Chrome' } else { Ok "Chrome já está instalado" }
  $extId = 'fcoeoabgfenejglbffodgkkbkcdhcgfn'
  $perfis = Join-Path $LocalAppData 'Google\Chrome\User Data'
  $temExt = (Test-Path $perfis) -and ((Get-ChildItem $perfis -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName "Extensions\$extId") }).Count -gt 0)
  if ($temExt) { Ok "Extensão do Claude já está no Chrome" }
  else {
    Pausa "O Chrome vai abrir na página da extensão do Claude" @('Clica em "Usar no Chrome" (ou "Adicionar ao Chrome") e confirma.', 'Depois clica no ícone do Claude na barra do Chrome e entra com a sua conta. Eu espero.')
    Start-Process "https://chromewebstore.google.com/detail/$extId"
    $ok = Esperar { (Test-Path $perfis) -and ((Get-ChildItem $perfis -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName "Extensions\$extId") }).Count -gt 0) } 600
    if ($ok) { Ok "Extensão instalada" } else { Aviso "Não vi a extensão aparecer. Dá pra instalar depois pelo mesmo link." }
  }
}

# ---------- 6. Vercel ----------
Passo "6/9  Vercel (publicar sites)"
Escrever (Join-Path (Join-Path (Join-Path $ClaudeDir 'skills') 'publicar') 'SKILL.md') (Tpl 'skills/publicar.md')
if ($SemVercel) { Aviso "Pulado a pedido (-SemVercel)" }
elseif (-not $Teste) {
  if (-not (Tem 'vercel')) { Passo "Instalando a ferramenta da Vercel."; npm install -g vercel | Out-Null; AtualizarPath }
  $quem = (vercel whoami 2>&1 | Out-String)
  if ($quem -match 'Error|not') {
    Pausa "Vou abrir o navegador pra conectar a Vercel" @('Escolhe "Continue with GitHub" e autoriza (cria a conta ali se não tiver).', 'Depois volta pra cá.')
    vercel login
  } else { Ok "Vercel já conectada" }
}

# ---------- 7. pacotes ----------
Passo "7/9  Comandos do seu tipo de trabalho"
$mapa = @{ escrita = @('revisar', 'email'); negocios = @('proposta', 'reuniao', 'planilha'); pesquisa = @('pesquisar', 'resumir'); criador = @('post', 'roteiro'); dev = @('projeto-novo', 'revisar-codigo') }
$escolhidos = @()
foreach ($p in ($Pacotes -split ',')) { $p = $p.Trim(); if ($mapa.ContainsKey($p)) { $escolhidos += $p; foreach ($s in $mapa[$p]) { Escrever (Join-Path (Join-Path (Join-Path $ClaudeDir 'skills') $s) 'SKILL.md') (Tpl "pacotes/$s.md") } } }
Ok ("Pacotes: " + ($escolhidos -join ', '))

# ---------- 8. rotinas ----------
Passo "8/9  Rotinas (revisão semanal e backup diário)"
if ($SemRotinas) { Aviso "Pulado a pedido (-SemRotinas)" }
else {
  $rotDir = Join-Path $PastaSetuper 'rotinas'
  foreach ($r in @(@{ id = 'revisao-semanal'; hora = '09:00'; sc = @('/SC', 'WEEKLY', '/D', 'MON') }, @{ id = 'backup-diario'; hora = '21:00'; sc = @('/SC', 'DAILY') })) {
    $script = Join-Path $rotDir "$($r.id).cmd"
    Escrever $script (Tpl "rotinas/$($r.id).cmd" @{ vault = $Vault; logs = $rotDir })
    if (-not $Teste) { schtasks /Create /F /TN "Claude Setuper\$($r.id)" /TR "`"$script`"" /ST $r.hora @($r.sc) | Out-Null }
  }
  Ok "Rotinas agendadas"
}

# ---------- 9. atalho e abertura ----------
Passo "9/9  Atalho do Claude na Área de Trabalho"
New-Item -ItemType Directory -Force -Path $Desktop | Out-Null
$atalho = Join-Path $Desktop 'Claude.cmd'
Escrever $atalho (Tpl 'atalho/Claude.cmd' @{ marcador = (Join-Path $ClaudeDir '.setuper-saudou'); trabalho = $TrabalhoSeguro })
Ok "Atalho criado: $atalho"

# estado, pra o `claude-setuper doctor` funcionar se o app em Node for instalado depois
$mods = [ordered]@{}
foreach ($m in @('base', 'nucleo', 'obsidian', 'github', 'chrome', 'vercel', 'pacotes', 'rotinas', 'atalho')) { $mods[$m] = @{ ok = $true; em = (Get-Date).ToString('o') } }
Escrever (Join-Path $PastaSetuper 'estado.json') (Json ([ordered]@{ modulos = $mods; versao = 'fallback'; respostas = @{ nome = $Nome; trabalho = $Trabalho; autonomia = $Autonomia; vault = $Vault; pacotes = $escolhidos; mcps = @() } }))

if (-not $Teste) {
  Pausa "O Obsidian vai abrir e perguntar se você confia nos plugins" @('Clica em "Confiar no autor e habilitar plugins". São o Dataview e o Templater, os dois mais usados. Pode confiar.')
  Get-Process Obsidian -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Start-Process "obsidian://open?path=$([uri]::EscapeDataString($Vault))&file=$([uri]::EscapeDataString('Comece aqui'))"
  Start-Sleep -Seconds 4
  Start-Process $atalho
}

Write-Host ""
Write-Host "Pronto, $Nome. O Claude está abrindo numa janela nova e o seu segundo cérebro está no Obsidian." -ForegroundColor Green
Write-Host "Da próxima vez, dois cliques no 'Claude' da Área de Trabalho. Registro desta instalação: $Log"
try { Stop-Transcript | Out-Null } catch {}
