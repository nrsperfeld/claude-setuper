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

Dois cliques no arquivo baixado da página (`Claude Setuper.bat` no Windows, `Claude Setuper.command` no Mac), ou pelo terminal:

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/install.ps1 | iex"
```

```bash
# Mac e Linux
curl -fsSL https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/install.sh | bash
```

### Reserva para Windows (um arquivo só)

Se o caminho normal falhar numa máquina Windows, `fallback-windows.ps1` faz a instalação inteira sozinho, sem o wizard em Node. Ele baixa os templates do repositório e escreve tudo direto:

```powershell
# pergunta nome, trabalho e autonomia
powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/fallback-windows.ps1 | iex"

# sem perguntas
irm https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/fallback-windows.ps1 -OutFile setup.ps1
powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Nome "Maria" -Trabalho "tenho uma loja de roupas" -Autonomia equilibrado
```

Parâmetros: `-Pacotes escrita,negocios,pesquisa,criador,dev`, `-SemVercel`, `-SemChrome`, `-SemGitHub`, `-SemRotinas`. Com `-Teste` ele não instala nada e gera os arquivos numa pasta temporária (dá pra rodar até no Mac com `pwsh`). Ele grava `estado.json`, então o `claude-setuper doctor` funciona depois se o app em Node for instalado.

Depois:

```
claude-setuper doctor      # confere tudo e diz o que falta
claude-setuper atualizar   # versão nova sem perder o que foi editado
claude-setuper remover     # desfaz (as notas nunca são apagadas)
claude-setuper exportar    # gera um perfil sem segredos a partir do setup atual
```

Opções úteis pra quem está ajudando alguém: `--assistido` grava um relatório em `~/Claude Setuper/relatorio.txt`; `--modulos obsidian,maestri` roda só esses; `--sim` aceita os defaults.

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

## Pegadinhas conhecidas

- O Obsidian aberto não relê o `obsidian.json`. O módulo fecha e reabre o app antes de registrar o cofre.
- Na primeira abertura de um cofre com plugins da comunidade o Obsidian pede um clique de confiança. Não dá pra pular; o instalador espera e o `doctor` avisa se faltar.
- Caminhos com acento vêm do Obsidian em outra forma Unicode; toda comparação usa NFC.
- O Maestri lê `~/.maestri` só ao abrir. O módulo fecha o app se estiver rodando antes de semear o workspace.
- O arquivo `.command` não é assinado; o macOS avisa na primeira abertura (botão direito → Abrir). Assinar com conta de desenvolvedor Apple resolve. No Windows, o `.bat` dispara o SmartScreen ("Mais informações" → "Executar assim mesmo").
- No Windows o Claude Code precisa do Git Bash; o módulo base instala o Git pelo winget antes do Claude.
- A versão Windows foi exercitada só com plataforma simulada num Mac. O primeiro teste numa máquina Windows de verdade ainda está pendente.

Licença MIT.
