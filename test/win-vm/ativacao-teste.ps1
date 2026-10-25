# Roda dentro da VM, depois da instalação: confere a primeira semana guiada, o cardápio e o pedido de ajuda.
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$C = Join-Path $env:USERPROFILE '.claude'
function Titulo($t) { Write-Output "`n[ativação] $t" }

Titulo 'configuração da primeira semana'
Get-Content (Join-Path $C 'setuper-ativacao.json') -TotalCount 12 -Encoding UTF8

Titulo 'hook registrado no settings.json'
@(Select-String -Path (Join-Path $C 'settings.json') -Pattern 'ativacao.cjs').Count

Titulo 'cardápio'
$card = (Get-Content (Join-Path $C 'setuper-ativacao.json') -Raw -Encoding UTF8 | ConvertFrom-Json).cardapio
if (Test-Path -LiteralPath $card) { "ok: $card"; Get-Content -LiteralPath $card -TotalCount 5 -Encoding UTF8 } else { "NÃO existe: $card" }

Titulo 'primeira mensagem do atalho'
Get-ChildItem -Path $env:USERPROFILE -Recurse -Depth 3 -Filter 'Claude.cmd' -ErrorAction SilentlyContinue | Select-Object -First 1 | ForEach-Object { Select-String -Path $_.FullName -Pattern '^claude "' | Select-Object -First 1 | ForEach-Object { $_.Line.Substring(0, [Math]::Min(220, $_.Line.Length)) } }

Titulo 'hook no dia seguinte: tem que sugerir a missão 1'
$amanha = [int64](([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) + 86400000)
$env:CLAUDE_SETUPER_AGORA = "$amanha"
cmd /c "echo {""source"":""startup""} | node ""$C\hooks\ativacao.cjs"""
''
cmd /c "echo {""source"":""startup""} | node ""$C\hooks\ativacao.cjs"""
'(segunda abertura no mesmo dia: nada acima desta linha)'
Remove-Item Env:CLAUDE_SETUPER_AGORA
Remove-Item (Join-Path $C 'setuper-ativacao-estado.json') -ErrorAction SilentlyContinue

Titulo 'pedir ajuda pelo Terminal'
cmd /c 'claude-setuper pedir-ajuda < nul' 2>&1 | Select-Object -Last 2
$f = Get-ChildItem -Path $env:USERPROFILE -Recurse -Depth 3 -Filter 'Claude Setuper - pedido de ajuda.txt' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($f) { "ok: $($f.FullName), $((Get-Content $f.FullName).Count) linhas"; Get-Content $f.FullName -TotalCount 7 -Encoding UTF8 | Select-Object -Last 4 } else { 'NÃO gerou' }
