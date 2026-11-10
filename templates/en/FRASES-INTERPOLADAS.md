Frases com ${...} no código, que não dá para achar por chave exata. A chave sugerida abaixo já está em src/idiomas/en.json: é só trocar o template literal por t(chave, { variáveis }).
Gerado em 07/11/2026, sobre o código daquele momento. Os números de linha andam conforme o código muda.

src/wizard.js:47
  pt: "Que bom te ver de novo, {nome}. Posso usar as mesmas respostas da outra vez?"
  en: "Good to see you again, {nome}. Can I use the same answers as last time?"

src/wizard.js:154
  pt: "Pronto, {nome}. Agora é comigo. Vai aparecendo na tela o que estou fazendo."
  en: "All set, {nome}. I'll take it from here. You'll see on the screen what I'm doing as I go."

src/cli.js:20
  pt: "\nClaude Setuper {versao}\n\n  claude-setuper                 instala (ou continua de onde parou)\n  claude-setuper doctor          confere se está tudo funcionando\n  claude-setuper atualizar       puxa a versão nova sem perder o que você editou\n  claude-setuper remover         desfaz a instalação (pergunta antes de cada coisa)\n  claude-setuper exportar        gera um perfil a partir do setup atual\n  claude-setuper pedir-ajuda     cria na Mesa um arquivo pra mandar pra quem te ajuda\n\nOpções:\n  --perfil <id>     já escolhe o público (dia-a-dia, empresario, marketing, video, estudante, elos)\n  --modulos a,b,c   só esses módulos ({modulos})\n  --sim             aceita os defaults sem perguntar\n  --dry-run         mostra o que faria sem mexer em nada\n  --home <pasta>    usa outra pasta como \"casa\" (pra testes)\n  --sem-apps        não instala aplicativos, só escreve arquivos (pra testes)\n  --assistido       grava um relatório pra quem está te ajudando\n  --presente <pasta> instala um segundo cérebro pronto (presente.json + cofre/)\n  --idioma pt|en    idioma de tudo que é instalado\n"
  en: "\nClaude Setuper {versao}\n\n  claude-setuper                 installs (or continues where it stopped)\n  claude-setuper doctor          checks that everything is working\n  claude-setuper atualizar       gets the new version without losing what you edited\n  claude-setuper remover         undoes the installation (asks before each thing)\n  claude-setuper exportar        generates a profile from your current setup\n  claude-setuper pedir-ajuda     creates a file on your Desktop to send to whoever helps you\n\nOptions:\n  --perfil <id>     chooses the audience right away (dia-a-dia, empresario, marketing, video, estudante, elos)\n  --modulos a,b,c   only these modules ({modulos})\n  --sim             accepts the defaults without asking\n  --dry-run         shows what it would do without changing anything\n  --home <folder>   uses another folder as \"home\" (for tests)\n  --sem-apps        does not install apps, only writes files (for tests)\n  --assistido       saves a report for whoever is helping you\n  --presente <folder> installs a ready-made second brain (presente.json + cofre/)\n  --idioma pt|en    language of everything that gets installed\n"

src/cli.js:67
  pt: "versão {versao}"
  en: "version {versao}"

src/cli.js:80
  pt: "No seu sistema estes não se aplicam e vou pular: {lista}"
  en: "These don't apply to your system, so I'll skip them: {lista}"

src/cli.js:99
  pt: "{modulo}: não deu certo ({erro}). Sem essa parte o resto não funciona, então parei aqui. Confere a internet e rode de novo: eu continuo de onde parei."
  en: "{modulo}: that didn't work ({erro}). The rest doesn't work without this part, so I stopped here. Check your internet and run this again, and I'll pick up where I stopped."

src/cli.js:104
  pt: "{modulo}: não deu certo agora ({erro}). Sigo com o resto e te mostro no fim."
  en: "{modulo}: that didn't work right now ({erro}). I'll carry on with the rest and show you at the end."

src/cli.js:111
  pt: "Terminei, mas uma parte ficou pendente: {lista}."
  en: "I finished, but one part is still pending: {lista}."

src/cli.js:111
  pt: "Terminei, mas {n} partes ficaram pendentes: {lista}."
  en: "I finished, but {n} parts are still pending: {lista}."

src/cli.js:112
  pt: "Rode {comando} pra ver o que falta, ou rode o instalador de novo que ele continua de onde parou."
  en: "Run {comando} to see what is missing, or run the installer again and it will pick up where it stopped."

src/cli.js:127
  pt: "Pronto, {nome}. O Maestri está abrindo com a IA e as suas notas do lado."
  en: "All set, {nome}. Maestri is opening with the AI and your notes beside it."

src/cli.js:128
  pt: "Pronto, {nome}. A IA está no Maestri, com as suas notas do lado."
  en: "All set, {nome}. The AI is in Maestri, with your notes beside it."

src/cli.js:130
  pt: "Pronto, {nome}. A IA está abrindo numa janela nova, e deixei um atalho \"Claude\" na sua Área de Trabalho pra próxima vez."
  en: "All set, {nome}. The AI is opening in a new window. Its name is Claude, and I left a \"Claude\" shortcut on your Desktop for next time."

src/cli.js:131
  pt: "Pronto, {nome}. Abra o Terminal e digite {comando} pra começar."
  en: "All set, {nome}. Open Terminal and type {comando} to get started."

src/cli.js:140
  pt: "Criei o arquivo \"{arquivo}\" em {pasta}. Manda ele pra quem te ajudou com a instalação (pelo WhatsApp ou por e-mail). Ele não tem senha nem código de login."
  en: "I created the file \"{arquivo}\" in {pasta}. Send it to whoever helped you with the installation (by text or email). It has no passwords or login codes."

src/cli.js:145
  pt: "Claude Setuper {versao} — relatório"
  en: "Claude Setuper {versao}: report"

src/cli.js:146
  pt: "Data: {data}"
  en: "Date: {data}"

src/cli.js:147
  pt: "Sistema: {sistema}"
  en: "System: {sistema}"

src/cli.js:148
  pt: "Nome: {nome} | Autonomia: {autonomia}"
  en: "Name: {nome} | Autonomy: {autonomia}"

src/cli.js:156
  pt: "Relatório salvo em {caminho}. Manda pra quem está te ajudando."
  en: "Report saved at {caminho}. Send it to whoever is helping you."

src/ajuda.js:69
  pt: "Gerado em {data}"
  en: "Generated on {data}"

src/ajuda.js:71
  pt: "Versão do Setuper: {versao}"
  en: "Setuper version: {versao}"

src/ajuda.js:72
  pt: "Sistema: {sistema} {versaoSistema} ({arquitetura})"
  en: "System: {sistema} {versaoSistema} ({arquitetura})"

src/ajuda.js:73
  pt: "Pessoa: {nome} | perfil: {perfil} | idade: {idade} | tecnologia: {tecnologia} | IA: {ia}"
  en: "Person: {nome} | profile: {perfil} | age: {idade} | technology: {tecnologia} | AI: {ia}"

src/ajuda.js:79
  pt: "{marca} {id} em {data}"
  en: "{marca} {id} on {data}"

src/doctor.js:36
  pt: "{n} item precisa de atenção. Rode {comando} de novo que eu tento resolver, ou siga a dica ao lado de cada um."
  en: "{n} item needs attention. Run {comando} again and I will try to fix it, or follow the tip next to it."

src/doctor.js:36
  pt: "{n} itens precisam de atenção. Rode {comando} de novo que eu tento resolver, ou siga a dica ao lado de cada um."
  en: "{n} items need attention. Run {comando} again and I will try to fix them, or follow the tip next to each one."

src/modulos/base.js:133
  pt: "{min} minutos"
  en: "{min} minutes"

src/modulos/base.js:135
  pt: "Esperando a Apple terminar de instalar. Já faz {quanto}, costuma levar de 3 a 10 minutos."
  en: "Waiting for Apple to finish installing. It has been {quanto}, and it usually takes 3 to 10 minutes."

src/modulos/base.js:136
  pt: "Esperando a janela da Apple. Se ela não estiver na frente, procure nas outras janelas abertas. Já faz {quanto}."
  en: "Waiting for the Apple window. If it isn't in front, look behind your other open windows. It has been {quanto}."

src/modulos/chrome.js:39
  pt: "instale em {loja}"
  en: "install it from {loja}"

src/modulos/chrome.js:69
  pt: "Se o Chrome não abrir nessa página, abre este link nele: {loja}"
  en: "If Chrome doesn't open on that page, open this link in it: {loja}"

src/modulos/github.js:20
  pt: "Conta conectada: {contas}"
  en: "Connected account: {contas}"

src/modulos/github.js:20
  pt: "Contas conectadas: {contas}"
  en: "Connected accounts: {contas}"

src/modulos/github.js:70
  pt: "Conta do GitHub já conectada: {contas}"
  en: "GitHub account already connected: {contas}"

src/modulos/github.js:88
  pt: "Vou abrir o navegador pra conectar {qual} do GitHub"
  en: "I'll open your browser to connect {qual} on GitHub"

src/modulos/github.js:152
  pt: "Segunda conta pronta: tudo que ficar em {pasta} usa a conta {login}"
  en: "Second account ready: everything inside {pasta} uses the {login} account"

src/modulos/maestri.js:156
  pt: "Tem mais no \"Cardápio do Claude\", {onde}. Ou pergunta pra ela: \"o que mais eu posso te pedir?\""
  en: "There's more in the \"Claude menu\", {onde}. Or ask the AI: \"what else can I ask you to do?\""

src/modulos/mcps.js:28
  pt: "Ferramenta {m}"
  en: "Tool {m}"

src/modulos/mcps.js:47
  pt: "Ligando {nome}"
  en: "Connecting {nome}"

src/modulos/mcps.js:63
  pt: "{nome}: fica pra depois, precisa da sua conta do GitHub conectada. {depois}"
  en: "{nome}: this waits until later, because it needs your GitHub account connected. {depois}"

src/modulos/mcps.js:73
  pt: "Faz isso em {nomes}. Escolhe a sua conta do Google e, quando ele perguntar se o Claude pode acessar, clica em Permitir. Faltou algum? Você volta nessa mesma página."
  en: "Do this for {nomes}. Choose your Google account and, when it asks if Claude, your AI, can have access, click Allow. Missed one? You can come back to this same page."

src/modulos/mcps.js:76
  pt: "Vou abrir a página de conectores do Claude pra ligar {nomes}"
  en: "I'll open the Claude connectors page to connect {nomes}"

src/modulos/mcps.js:78
  pt: "Pra cada um ({nomes}): clica nele, depois em Conectar, e escolhe a sua conta do Google."
  en: "For each one ({nomes}): click it, then click Connect, and choose your Google account."

src/modulos/mcps.js:83
  pt: "Terminou de ligar {nomes}?"
  en: "Did you finish connecting {nomes}?"

src/modulos/mcps.js:84
  pt: "{nomes}: ligado no claude.ai. Se faltar algum, é só voltar em claude.ai > Configurações > Conectores."
  en: "{nomes}: connected on claude.ai. If one is missing, just go back to claude.ai > Settings > Connectors."

src/modulos/nucleo.js:69
  pt: ", tenho {idade} anos"
  en: ", I am {idade} years old"

src/modulos/nucleo.js:79
  pt: "# Cardápio do Claude\n\nQuando eu perguntar o que dá pra te pedir, ou parecer que não sei por onde começar, abra o Cardápio do Claude em `{cardapio}` e sugira 2 ou 3 pedidos que combinem com o momento, não a lista inteira.\n"
  en: "# Claude menu\n\nWhen I ask what I can ask you to do, or it seems like I don't know where to start, open the Claude menu at `{cardapio}` and suggest 2 or 3 requests that fit the moment, not the whole list.\n"

src/modulos/nucleo.js:80
  pt: "# Prints de tela\n\nMeus prints de tela ficam em `{prints}`. Quando eu falar \"olha o print\" ou \"vê a tela\", leia o arquivo mais recente dessa pasta. Se eu arrastar um print e o caminho começar com `/var/folders/`, você não vai conseguir ler: pegue o mais recente da pasta de prints.\n"
  en: "# Screenshots\n\nMy screenshots are in `{prints}`. When I say \"look at the screenshot\" or \"look at the screen\", read the most recent file in that folder. If I drag in a screenshot and the path starts with `/var/folders/`, you won't be able to read it: take the most recent one from the screenshots folder.\n"

src/modulos/nucleo.js:137
  pt: "Achei uma chave da API da Anthropic {chave}. Com ela, o Claude cobra pelo uso avulso em vez de usar a sua assinatura, e o Gmail e a Agenda não conectam. Se não foi de propósito, peça pra quem te ajuda tirar."
  en: "I found an Anthropic API key {chave}. With it, Claude charges by usage instead of using your subscription, and Gmail and Calendar won't connect. If that wasn't on purpose, ask whoever helps you to remove it."

src/modulos/nucleo.js:180
  pt: "CLAUDE.md antes de {agora}.md"
  en: "CLAUDE.md before {agora}.md"

src/modulos/pacotes.js:28
  pt: "Pacote {nome}"
  en: "{nome} pack"

src/modulos/pacotes.js:36
  pt: "Pacotes instalados: {lista}"
  en: "Packs installed: {lista}"

src/modulos/semBrew.js:24
  pt: "não consegui baixar ({status})"
  en: "I couldn't download it ({status})"

src/modulos/semBrew.js:36
  pt: "Baixando {nome}: {veio} de {total} MB ({pct}%)"
  en: "Downloading {nome}: {veio} of {total} MB ({pct}%)"

src/modulos/semBrew.js:36
  pt: "Baixando {nome}: {veio} MB até agora"
  en: "Downloading {nome}: {veio} MB so far"

src/modulos/semBrew.js:50
  pt: "Copiando o {nome} pra pasta Aplicativos: {pct}%"
  en: "Copying {nome} to the Applications folder: {pct}%"

src/modulos/semBrew.js:67
  pt: "não achei o aplicativo do {cask}"
  en: "I couldn't find the {cask} app"

src/modulos/semBrew.js:73
  pt: "o {nome}"
  en: "{nome}"

src/modulos/semBrew.js:74
  pt: "Copiando o {nome} pra pasta Aplicativos"
  en: "Copying {nome} to the Applications folder"

src/modulos/semBrew.js:91
  pt: "Conferindo se o {nome} ficou certo"
  en: "Checking that {nome} came out right"

src/modulos/semBrew.js:96
  pt: "o {nome} não funciona em Mac com processador Intel"
  en: "{nome} doesn't work on Macs with Intel processors"

src/modulos/semBrew.js:144
  pt: "não sei instalar {pacote} sem o Homebrew"
  en: "I don't know how to install {pacote} without Homebrew"

src/modulos/vercel.js:17
  pt: "Login na Vercel: {quem}"
  en: "Vercel login: {quem}"

src/modulos/vercel.js:44
  pt: "Você já está logado na Vercel como {quem}"
  en: "You're already logged in to Vercel as {quem}"

src/modulos/wiki.js:44
  pt: " Como {nome} tem menos de 18 anos, a wiki não guarda dados pessoais de ninguém: endereço, documento, telefone, foto ou senha."
  en: " Because {nome} is under 18, the wiki doesn't keep anyone's personal data: addresses, documents, phone numbers, photos or passwords."

src/modulos/wiki.js:46
  pt: "Na instalação, {nome} contou: \"{trabalho}\". Ainda não tem mais nada anotado sobre o momento atual."
  en: "During the installation, {nome} said: \"{trabalho}\". Nothing else has been noted yet about what's going on right now."

src/cuidados.js:14
  pt: "no arquivo {f} da sua pasta pessoal"
  en: "in the {f} file in your home folder"

src/cuidados.js:43
  pt: "achei ANTHROPIC_API_KEY {chave}. Com ela o Claude cobra pela API e os conectores do claude.ai somem. Se não foi de propósito, apague essa linha e abra o Terminal de novo"
  en: "I found ANTHROPIC_API_KEY {chave}. With it, Claude charges through the API and the claude.ai connectors disappear. If that wasn't on purpose, delete that line and open Terminal again"

src/cuidados.js:48
  pt: "outras ferramentas de memória instaladas ({lista}) disputam com o segundo cérebro. Se não usa, dá pra tirar"
  en: "other memory tools that are installed ({lista}) compete with the second brain. If you don't use them, you can remove them"

src/remover.js:16
  pt: "Remover \"{nome}\"?"
  en: "Remove \"{nome}\"?"

src/remover.js:25
  pt: "{nome} removido"
  en: "{nome} removed"

src/remover.js:53
  pt: "As notas continuam em {vault}. Só tirei o cofre da lista do Obsidian."
  en: "Your notes are still at {vault}. I only took them off the list in Obsidian."

src/exportar.js:30
  pt: "Perfil exportado em {dest}"
  en: "Profile exported to {dest}"

src/ui.js:68
  pt: "Não consegui: {fazendo}"
  en: "I couldn't finish: {fazendo}"

app/ui-app.js:65
  pt: "Não consegui: {fazendo}"
  en: "I couldn't finish: {fazendo}"

Pontos no código que dependem do texto em português e precisam de ajuste quando a frase passar por t():
- app/tela/app.js:229 tira ", é normal" do fim de estado.demora com regex. Em inglês o texto termina em ", which is normal" (chaves "uns 2 minutos, é normal"). Sugestão: tirar o trecho antes de traduzir, ou incluir os dois no regex.
- app/tela/app.js:381 testa ev.texto.startsWith('Terminei'). Em inglês a frase começa com "I finished". Só afeta o modo roteiro dos testes.
- src/modulos/mcps.js:70 troca a última vírgula por " e $1" na lista de nomes. Em inglês: " and $1" (a chave " e $1" está em en.json).
- src/modulos/github.js:67 e :79 passam "a sua conta" e "a segunda conta" como {qual}. As duas chaves estão em en.json; precisam passar por t() antes de entrar na frase.
- src/cli.js:111 e src/doctor.js:36 montam plural com pedaços. As chaves sugeridas acima trazem a frase inteira, uma para singular e outra para plural.
- src/modulos/semBrew.js:73 passa `o ${nome}` e :107 e :124 passam "as ferramentas de base" e "o GitHub" para baixar(), que monta "Baixando {nome}".
- toLocaleString('pt-BR') em src/cli.js:146 e src/ajuda.js:69: em inglês, usar 'en-US'.
