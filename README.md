# Claude Setuper

Instala e configura o Claude Code do zero, em português, pra quem não é de tecnologia. Em uns 10 minutos a pessoa sai com:

- **Claude Code** instalado e logado, com `CLAUDE.md` já dizendo quem ela é e como gosta de trabalhar, permissões no nível que ela escolheu.
- **Segundo cérebro no Obsidian**: cofre montado, plugins instalados, pasta `CLAUDE/` com feedback, decisões, padrões, descobertas e projetos. Hooks fazem o Claude ler o cérebro ao começar e anotar ao terminar.
- **Maestri** (Mac) aberto no fim com o Claude se apresentando e notas explicativas do lado. No Windows e no Linux, um atalho "Claude" na Área de Trabalho e o Claude aberto ao lado do cofre.
- **GitHub** (uma ou duas contas), **Chrome** (extensão do Claude) e **Vercel** (publicar sites).
- **Pacotes de comandos** por tipo de uso (escrita, negócios, pesquisa, conteúdo, programação) e **ferramentas conectadas** (Notion, Figma, Canva...).
- **Rotinas**: revisão semanal do cérebro e backup diário das notas.

Página pra mandar pra pessoa: `https://nrsperfeld.github.io/claude-setuper/`

## Instalar

No Windows, dois cliques no `Claude Setuper.bat` baixado da página. No Mac, a linha do Terminal abaixo (o `.command` baixado pelo navegador é bloqueado no macOS 15 e mais novos, porque não tem assinatura da Apple):

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/install.ps1 | iex"
```

```bash
# Mac e Linux
curl -fsSL https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/install.sh | bash
```

### Windows: plano B, o script único

O `.bat` da página baixa e roda o `install.ps1`, o mesmo assistente em Node do Mac (com perfis, idade e familiaridade). Se o Node não subir numa máquina, o `fallback-windows.ps1` faz a instalação inteira sem o wizard, mas sem os perfis. Pelo terminal (PowerShell comum, sem administrador):

```powershell
irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/fallback-windows.ps1 -OutFile "$env:USERPROFILE\claude-setuper.ps1"; powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\claude-setuper.ps1"

# sem perguntas
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\claude-setuper.ps1" -Nome "Maria" -Trabalho "tenho uma loja de roupas" -Autonomia equilibrado
```

Como ele se comporta: cada passo roda isolado (um erro não derruba o resto), as respostas e os passos concluídos ficam em `Claude Setuper\estado.json` (rodar de novo continua de onde parou), e no fim ele imprime a conferência completa. Parâmetros: `-Doctor` (só confere), `-Desde N`, `-Refazer`, `-Pacotes ...`, `-SemVercel -SemChrome -SemGitHub -SemRotinas`, `-Teste` (gera os arquivos numa pasta temporária sem instalar nada; roda até no Mac com `pwsh`). Erros das ferramentas (winget, npm, schtasks) aparecem em cinza na tela e ficam no `registro-fallback.log`.

Por que não `irm | iex`: não aceita parâmetros, esconde a linha do erro e depende do cache do GitHub. Por isso os links apontam pra tag de versão, não pra `main`.

Depois:

```
claude-setuper doctor      # confere tudo e diz o que falta
claude-setuper atualizar   # versão nova sem perder o que foi editado
claude-setuper remover     # desfaz (as notas nunca são apagadas)
claude-setuper exportar    # gera um perfil sem segredos a partir do setup atual
```

Opções úteis pra quem está ajudando alguém: `--assistido` grava um relatório em `~/Claude Setuper/relatorio.txt`; `--modulos obsidian,maestri` roda só esses; `--sim` aceita os defaults.

## Perfis (pra quem é)

Logo depois do nome, o Setuper pergunta pra que a pessoa vai usar o Claude, a idade e como ela se dá com tecnologia e com IA. O perfil escolhido muda a pergunta sobre o trabalho, os pacotes que já vêm marcados, os passos que entram (o estudante não instala GitHub nem Vercel) e o que vai pro CLAUDE.md. A familiaridade define quanto o Claude explica; abaixo de 18 anos some a opção "nunca pede licença" e entram cuidados com dados pessoais.

Perfis: `dia-a-dia` (o generalista), `empresario`, `marketing`, `video`, `estudante`, `elos`. Cada um é um arquivo em `templates/perfis/`. Pra mandar o link pra uma turma inteira já com o perfil escolhido:

```bash
curl -fsSL https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/install.sh | bash -s -- --perfil estudante
```

## Como funciona por dentro

Um CLI em Node (`src/`) com um wizard de três perguntas e dez módulos que rodam em ordem. Cada módulo tem `verificar`, `instalar` e `remover`, e tudo é idempotente: rodar de novo nunca duplica hook nem sobrescreve o que a pessoa editou (JSONs são mesclados, arquivos de texto só são criados se faltarem).

| Módulo | O que faz |
|---|---|
| `base` | Xcode CLT, Homebrew, Node, git, Claude Code, login |
| `nucleo` | `CLAUDE.md`, `settings.json` por nível de autonomia, hooks e skills do segundo cérebro |
| `obsidian` | instala o app, monta o cofre, baixa Dataview e Templater da release, registra no `obsidian.json` |
| `github` | `gh`, uma ou duas contas, `includeIf` por pasta |
| `chrome` | Chrome (se faltar) e a extensão Claude |
| `vercel` | CLI, login e skill `/publicar` |
| `pacotes` | skills por tipo de uso |
| `mcps` | catálogo em `templates/mcps/catalogo.json` via `claude mcp add` |
| `rotinas` | launchd (Mac) ou cron (Linux) |
| `maestri` | (Mac) instala o app e semeia `~/.maestri` com o workspace "Meu Claude" |
| `atalho` | (Windows e Linux) atalho "Claude" na Área de Trabalho que abre o Claude com a saudação |

No Windows, os aplicativos vêm pelo `winget` (Git, Node, GitHub CLI, Obsidian, Chrome), o Claude Code pelo `install.ps1` oficial, e as rotinas pelo Agendador de Tarefas (`schtasks`). Os hooks são Node puro e rodam igual nos três sistemas.

Os textos que a pessoa vê estão em `templates/`. É ali que se mexe pra mudar a voz.

## Testar sem mexer na sua máquina

```bash
npm install
node bin/claude-setuper.js --sim --sem-apps --home ./.setuper-test/home
node bin/claude-setuper.js doctor --home ./.setuper-test/home
```

`--home` aponta uma "casa" falsa; `--sem-apps` não instala nada, só escreve os arquivos; `--dry-run` nem escreve; `--plataforma win32` exercita os ramos do Windows em outro sistema (só a lógica, não os comandos).

## Testar num Mac zerado (VM)

```bash
python3 test/mac-vm/vm.py rodar                    # generalista
python3 test/mac-vm/vm.py rodar --perfil estudante # um perfil
```

Clona uma VM macOS limpa do tart (`tahoe-limpo`), roda o `curl | bash` num terminal de verdade respondendo como uma pessoa, simula o clique das ferramentas da Apple, encerra os logins que precisam de conta real e roda o `doctor` num Terminal novo. Uns 15 a 20 minutos por rodada; log em `test/mac-vm/logs/`. Toda mudança no Setuper passa por aqui antes de ir pra alguém.

## Pegadinhas conhecidas

- O Obsidian aberto não relê o `obsidian.json`. O módulo fecha e reabre o app antes de registrar o cofre.
- Na primeira abertura de um cofre com plugins da comunidade o Obsidian pede um clique de confiança. Não dá pra pular; o instalador espera e o `doctor` avisa se faltar.
- Caminhos com acento vêm do Obsidian em outra forma Unicode; toda comparação usa NFC.
- O Maestri lê `~/.maestri` só ao abrir. O módulo fecha o app se estiver rodando antes de semear o workspace.
- O arquivo `.command` não é assinado; o macOS avisa na primeira abertura (botão direito → Abrir). Assinar com conta de desenvolvedor Apple resolve. No Windows, o `.bat` dispara o SmartScreen ("Mais informações" → "Executar assim mesmo").
- No Windows o Claude Code precisa do Git Bash; o módulo base instala o Git pelo winget antes do Claude.
- Validado de ponta a ponta numa VM Windows 11 ARM64 (QEMU) em 14/10/2026: 16/16 itens da conferência final em verde com `-SemLogin -SemGitHub -SemVercel -SemChrome`. Bugs achados só lá: BOM, parâmetro `$args`, leitura de JSON sem `-Encoding UTF8`, Obsidian aberto pelo winget sobrescrevendo o registro.
- Os hooks leem a entrada de forma assíncrona e ignoram BOM: no Windows, `readFileSync(0)` e o pipe do PowerShell 5.1 (que prefixa BOM) derrubavam a leitura em silêncio.
- Os `.ps1` precisam de BOM UTF-8: o Windows PowerShell 5.1 lê UTF-8 sem BOM como ANSI e quebra o parse (achado na VM de teste em 14/10/2026). Não tirar o BOM ao editar.
- Lições do primeiro Windows real (13/10/2026): função PowerShell com o mesmo nome de um programa chama a si mesma (`Winget` × `winget`); a fonte `msstore` do winget pode falhar por certificado, então todo install vai com `--source winget`; o instalador oficial do Claude liga `Set-StrictMode` e precisa rodar em processo separado; `.local\bin` e a pasta do npm precisam ser gravados no PATH do usuário; e rodar como Administrador atrapalha.

Licença MIT.
