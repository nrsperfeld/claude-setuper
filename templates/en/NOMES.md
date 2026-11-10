Nomes em inglês que dependem do código. O que já está em src/idiomas/nomes.js foi seguido à risca. O que falta ligar está nas seções abaixo.

Regra de texto: a versão em inglês diz "the AI" (it). "Claude" aparece só como nome da IA, na conta, no login, no nome de arquivo combinado e em comandos.

Comandos que já estão em nomes.js (skills)
decisao=decision, padrao=pattern, descoberta=discovery, lembrar=recall, guardar=save, publicar=publish. feedback e retro ficam iguais.

Comandos dos pacotes, que ainda NÃO estão em nomes.js
A pasta da skill é que vira o comando. Hoje src/modulos/pacotes.js grava em skills/<nome em português>/SKILL.md, então é preciso acrescentar estes nomes em skills e usar ctx.skill(s) em pacotes.js (verificar, instalar e remover).
analise-negocio=business-analysis
campanha=campaign
copy=copy
cortes=clips
email=email
estudar=study
numeros=numbers
pesquisar=research
planilha=spreadsheet
post=post
projeto-novo=new-project
proposta=proposal
redacao=essay
resumir=summarize
reuniao=meeting
revisar-codigo=review-code
revisar=polish (não usei /review porque o Claude Code já tem um comando com esse nome)
roteiro=script
titulo-video=video-title
voz-elos=elos-voice

Pastas da wiki por perfil (já vêm em templates/en/perfis/*.json)
pessoas=people, assuntos=topics, clientes=clients, produtos=products, matérias=subjects, canais=channels.
Só pessoas e assuntos estão em nomes.js, e é o que src/modulos/wiki.js usa como padrão. Os outros só aparecem pelo JSON do perfil.

Pastas e arquivos que o texto em inglês já usa e o código ainda escreve em português
CLAUDE/inbox/processados=CLAUDE/inbox/processed e CLAUDE/inbox/processando=CLAUDE/inbox/processing. As rotinas em inglês já usam os dois nomes; falta src/modulos/wiki.js:57 criar processed.
~/Projetos=~/Projects. Os comandos /new-project e /publish usam ~/Projects; falta src/modulos/github.js:73 e :142.
relatorio.txt=report.txt. templates/en/maestri/se-algo-der-errado.md cita report.txt; falta src/cli.js:154.
Documentos/Segundo Cérebro=Documents/Second Brain. Falta src/wizard.js, src/modulos/nucleo.js e src/modulos/obsidian.js, no caminho padrão.
Pictures/Prints=Pictures/Screenshots. As frases em inglês dizem Pictures > Screenshots; falta src/modulos/nucleo.js:207.
Repositório de backup segundo-cerebro=second-brain. Falta src/modulos/rotinas.js:83.
CLAUDE.md antes de <data>.md=CLAUDE.md before <date>.md. A chave está em en.json; falta src/modulos/nucleo.js.
Claude Setuper - pedido de ajuda.txt=Claude Setuper - help request.txt. A chave está em en.json; falta src/ajuda.js:9.
Backups das notas: os scripts em inglês gravam notes-<data> no lugar de notas-<data>. Nada no código lê esse nome.

Ficaram iguais de propósito
Nomes internos que o código escreve e lê: memoria/MEMORIA.md, prompt-ingest.md, prompt-revisao.md, ingest-diario.log, revisao-semanal.log, setuper-ativacao*.json, registro.log, ultima-vez, a pasta sentinela e os campos missoes, cardapio e vault.
Subcomandos e opções da linha de comando (atualizar, remover, exportar, pedir-ajuda, --modulos, --perfil e o resto): os textos em inglês citam o nome que funciona hoje. Se quiser nomes em inglês, sugiro update, remove, export, get-help e --modules, mantendo os antigos como apelido.
Os eventos do hook aula.cjs (mensagem, permissao, sessao-*), porque o guia lê esses valores.

Nomes de arquivo combinados que ainda dizem Claude, porque foi o que você pediu: Claude dashboard.md, Claude note.md e Claude menu.md. Se quiser seguir a regra nova até neles, a troca é em nomes.js, nos hooks e nos templates.
