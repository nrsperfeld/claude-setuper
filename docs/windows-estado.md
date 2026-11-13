# Estado do Claude Setuper no Windows

Escrito em 07/11/2026, sobre a branch `redesenho`, versão 1.7.2. **O app nunca rodou num Windows.** O instalador sai e está bem formado, e o código dos ramos do Windows roda numa simulação, mas nenhuma janela, nenhum `winget` e nenhum login foram vistos num Windows de verdade. A última vez que os módulos de `src/modulos` rodaram num Windows real foi na VM, em 24/10, pelo caminho de Terminal e numa versão anterior ao redesenho.

Para gerar: `bash app/build-win.sh`. Sai `app/dist/Claude-Setuper-windows-x64.exe`, com 112 MB (387 MB depois de instalado). Leva uns 3 minutos neste Mac.

## Como o Windows vai se comportar, na ordem em que a pessoa vê

Tirando a parte marcada como testada lá embaixo, isto é o esperado pela leitura do código e pela documentação da Microsoft, não o observado.

1. **Download.** O navegador pode avisar que o arquivo não é comum. No Edge o caminho é abrir os três pontinhos e escolher Manter. Isso é da falta de reputação do arquivo.
2. **Tela azul do SmartScreen.** Aparece ao abrir, porque não há certificado: "O Windows protegeu o computador". O caminho é clicar em **Mais informações** e depois em **Executar assim mesmo**. O botão não aparece até clicar em Mais informações, então a página de download precisa mostrar isso com imagem, como decidido no desenho. O texto pronto está mais abaixo.
3. **Smart App Control.** Este é o risco sério. Num Windows 11 instalado do zero, esse recurso pode estar ligado, e aí o programa sem assinatura é bloqueado sem o botão de executar assim mesmo. A única saída é desligar o recurso nas configurações, e desligado ele não volta sem reinstalar o Windows. Para quem nunca abriu um terminal, isso é um beco sem saída. Só o certificado resolve.
4. **Instalador.** Não pede administrador. Fala português ou inglês conforme o Windows, não faz nenhuma pergunta, coloca o app em `%LOCALAPPDATA%\Programs\Claude Setuper`, cria atalho na Área de Trabalho e no menu Iniciar e aparece em Configurações, Aplicativos, para desinstalar. Desinstalar tira só o programa: a pasta `Claude Setuper`, as notas e a IA ficam.
5. **Tela do app.** Igual à do Mac, escura, mas com a moldura normal do Windows (botões de fechar e minimizar). O menu fica escondido e aparece com a tecla Alt.
6. **Permissão do Windows (UAC).** Aqui existe uma diferença importante em relação ao que o app promete: instalar não pede senha, mas Git, Node, GitHub CLI e Chrome instalam para todas as contas, e o Windows pergunta se pode. O guia avisa "Se o Windows perguntar, clica em Sim" enquanto esses instaladores rodam. Se a pessoa disser Não, ou se a conta não for administradora e ela não tiver a senha, o app para com uma frase explicando, e Tentar de novo continua de onde parou. Essa janela pode não vir para a frente e ficar piscando na barra de tarefas, e o guia diz isso.
7. **Sem nada correndo atrás das perguntas.** No Mac o download anda enquanto a pessoa responde. No Windows, primeiro as perguntas e depois a instalação, então a espera fica toda no fim.
8. **Guia sem setas.** O guia flutuante mostra o ícone do programa e o texto do passo. Não há setas e o texto não fala em setas (decisão explicada abaixo).
9. **Fim.** Não existe Maestri. O portal termina abrindo `Claude.cmd`, da Área de Trabalho: uma janela preta, com o Claude rodando, e a aula por cima. A aula pula o que só faz sentido no painel do Maestri. Da próxima vez a pessoa dá dois cliques nesse atalho, que tem o ícone genérico de arquivo `.cmd`.

### Texto para a página de download

> **O Windows vai mostrar uma tela azul dizendo que protegeu o computador.** Isso acontece com todo programa que ainda não tem certificado pago da Microsoft, e o Claude Setuper ainda não tem. Clica em **Mais informações** e depois em **Executar assim mesmo**. Se não aparecer esse botão, o seu Windows está com o Controle Inteligente de Aplicativos ligado: fala com a gente antes de mexer nisso.

## O que está verificado (rodei e vi passar)

Build e arquivo, neste Mac:

- `app/build-win.sh` roda do zero: baixa o zip `win32-x64` do Electron 44.7.0, confere a soma com o `SHASUMS256.txt` do próprio release, troca ícone e nome em JavaScript (sem Wine) e compila com `makensis 3.13` com avisos tratados como erro (`-WX`).
- `file`: `PE32 executable (GUI) Intel 80386, for MS Windows, Nullsoft Installer self-extracting archive`. O stub do NSIS é de 32 bits, e o app lá dentro é x64.
- `7zz t` passa sem erro: 322 arquivos. Extraí tudo com `7zz x` e conferi:
  - `Claude Setuper.exe` é `PE32+ x86-64`, com 7 tamanhos de ícone. Abri o de 256 px e é o ícone do Setuper, não o do Electron. O recurso de versão diz `Claude Setuper`, `Instituto ELOS`, `1.7.2`.
  - Nas 15 seções do executável, tudo fora dos recursos ficou byte a byte igual ao `electron.exe` oficial, e só o `.reloc` mudou de endereço, com o diretório do cabeçalho acompanhando. O próprio build confere isso e falha se não bater.
  - O manifesto do instalador diz `level="asInvoker"`, ou seja, não pede administrador.
  - Não vão junto `pty.sh`, `default_app.asar` nem `.DS_Store`. O caminho mais comprido tem 70 letras, com folga para o limite do Windows.
  - Os arquivos do app extraídos são idênticos aos do repositório.

Código, por simulação (`npm test`, 64 testes, os 53 antigos mais 11 novos em `test/windows.test.cjs`):

- `test/win-sim/rodar-main.mjs` executa o `app/main.js` de verdade com um Electron de mentira e `process.platform` trocado para `win32`, sem abrir janela: sobe, faz a instalação inteira com `--sem-apps`, chega na conferência, abre o atalho, começa a aula. Sem nenhuma exceção, sem Maestri, sem falar em setas. Isso pega erro de programação nos ramos do Windows. **Não diz nada sobre como o Windows reage.** O mesmo teste roda no ramo do Mac e confere que a janela continua igual.
- Instalação simulada pela linha de comando (`--plataforma win32 --sem-apps`, inclusive a partir do Setuper extraído do `.exe`): os 12 módulos terminam, nenhum `osascript`, `launchctl`, `plutil`, `sips` ou `open` entra no registro, e o atalho sai com CRLF.
- Linha de comando do terminal invisível, formato da lista de janelas com escala de 150%, aviso de UAC só nos pacotes certos, guia da Microsoft Store quando falta o winget, PATH sem quebrar em `C:\`.

## O que só foi lido ou escrito, sem rodar

Nada disto executou no sistema de verdade:

- A interface do instalador: as páginas, o português e a acentuação, os atalhos, o registro para desinstalar, o laço que espera o app fechar (`tasklist | find`), o modo silencioso e a desinstalação.
- A atualização de dentro do app: baixa `Claude-Setuper-windows-x64.exe` do release mais recente e roda com `/S`. O arquivo não existe em release nenhum ainda, e por enquanto o botão cai na página de downloads. Isso é o que está testado.
- `app/terminal.js` no Windows: os logins rodam sem terminal de verdade, com a saída num cano. Pela leitura, o `gh auth login --web` aceita isso e mostra o código e o link sem abrir o navegador sozinho (a pessoa usa os botões Copiar e Abrir a página).
- A listagem de janelas em `app/setas.js` (PowerShell e C#). **Desligada por padrão.** Nem o PowerShell nem o C# foram compilados.
- `app.getFileIcon` para os ícones de programa, `shell.openPath` no `.cmd`, `focusable: false` no guia, `windowsHide` em todos os comandos.
- Os módulos `src/modulos` no Windows: rodaram na VM em 24/10, pelo Terminal, mas mudaram desde então.
- A segunda janela da conferência (12/11): na primeira abertura, o `Claude.cmd` roda `start "Claude Setuper" /min cmd /c "...\verificar.cmd"`. O `verificar.cmd` espera a instalação soltar a trava (`Claude Setuper\.instalando`), roda `claude-setuper verificar --segunda-janela` e, se faltar alguma coisa, o comando sai com código 3 e o `.cmd` se abre de novo numa janela normal (`--aberta`) pra consertar. Só os testes de texto passaram (`test/sempre-e-verificar.test.cjs`); o `start /min`, o `errorlevel` e as aspas não rodaram em Windows nenhum.

## O que precisa de um PC físico, por ordem de risco

1. **Login do Claude sem terminal de verdade.** `claude auth login` com a saída num cano é o ponto que pode travar a instalação inteira. Se não funcionar, o caminho é o `node-pty` com ConPTY, ou abrir o login numa janela visível.
2. **SmartScreen e Smart App Control.** Baixar pelo navegador num Windows 11 limpo e ver o que aparece. Conferir também se o Defender não acusa o instalador, o que acontece às vezes com NSIS sem assinatura.
3. **UAC de verdade, com uma pessoa clicando.** A VM por SSH entra como administrador e não mostra isso. Testar: clicar em Sim, clicar em Não, e uma conta sem administrador. Ver se a janela vem para a frente.
4. **Janela preta piscando.** Nenhuma pode aparecer durante a instalação. O `windowsHide` foi posto em todos os comandos de `ctx.run`, mas instaladores chamados por eles podem abrir a sua própria.
5. **O fim do fluxo.** O atalho abre, a janela preta vem para a frente, o Claude se apresenta, os hooks da aula disparam (`node` no `settings.json`, pelo Git Bash) e o guia avança sozinho. Clicar no guia não pode tirar o foco de onde a pessoa digita. O ditado por voz e a barra do Effortless existem na aula, e não sei se funcionam no Claude do Windows.
6. **Tela pequena com escala**, como 1366x768 a 125%: o guia, a janela principal e os botões de baixo têm de caber.
7. **Pasta do usuário com acento ou espaço** (`C:\Users\José Maria`): atalho, comando `claude-setuper.cmd`, rotinas e o caminho das notas.
8. **Área de Trabalho no OneDrive.** O app pede a pasta certa ao Windows, então o atalho deve aparecer. Pelo Terminal continua indo para `~\Desktop`, como antes. As notas continuam em `~\Documents`, mesmo com o OneDrive redirecionando Documentos.
9. **Efeitos do portal**: a tela branca, a transparência e o vídeo, com placa de vídeo fraca.
10. **Windows 10**, e Windows sem o winget atualizado (o guia da Microsoft Store).
11. **Atualizar**: instalar uma versão por cima de outra, com o app aberto, e desinstalar.
12. **Setas**: abrir com `CLAUDE_SETUPER_SETAS_WIN=1` e conferir que elas apontam para o lugar certo. Só depois disso vale ligar por padrão, trocando `setasDisponiveis` em `app/setas.js`. Os textos do guia já se ajustam sozinhos, mas as proporções em `POR_FIGURA` foram pensadas para o Mac.

## Decisões que tomei e que dá para mudar

- **Setas desligadas, embora desse para fazer sem permissão.** Ler a posição das janelas no Windows (`EnumWindows`) não pede permissão nenhuma, então o motivo não é esse. É que o código nunca rodou, e uma seta no lugar errado confunde mais que nenhuma. O código está pronto atrás da variável, para testar quando houver um Windows.
- **Um `.exe` só para os dois idiomas**, em vez de dois como os `.dmg` do Mac. No Mac a diferença entre os dois é só o desenho da janela do `.dmg`, e aqui não há esse desenho. Assim não duplica 112 MB. Quem tem Windows em português de Portugal vê o instalador em inglês, e o app em português.
- **Só x64.** Em Windows ARM ele roda por emulação, sem teste.
- **O modo presente (`build-presente.sh`) continua só no Mac.**
- **O atalho continua sendo `Claude.cmd`**, sem ícone próprio. O `shell.writeShortcutLink` do Electron faria um atalho com o ícone certo, mas o `verificar` e o caminho de Terminal contam com o `.cmd`.

## Reinstalar a VM, se você decidir

**Não liguei nada.** E com os 29 GB livres de hoje eu não faria ainda: o disco da VM cresce até uns 15 a 25 GB, e em 24/10 uma VM com o disco a 99% derrubou o Chrome e apagou os logins. A regra anotada é ter pelo menos 40 GB livres. Liberar antes: as sobras `app/.cache/dmg-*` somam uns 2,4 GB, e o resto você escolhe. Com o pipeline parado, porque são 4 GB de RAM para a VM num Mac de 16 GB.

A ISO em `~/Library/Parallels/Downloads` é a build 26100, ARM64, em português. O Windows ARM roda o app x64 por emulação, então serve para ver as telas, mas não substitui o PC físico nos itens 1 a 4 acima.

1. Conferir `which qemu-system-aarch64 qemu-img` e o espaço livre.
2. Sem duplicar a ISO: `ln -s ~/Library/Parallels/Downloads/26100*.iso ~/Projects/.vm/Windows11_pt-br.iso`. O `vm.py` procura `Windows11*.iso` na pasta dele.
3. Em `~/Projects/.vm/unattend/autounattend.xml`, trocar os três `en-US` de `UILanguage` por `pt-BR`, porque a ISO só tem português. Conferir se o nome da imagem em `/IMAGE/NAME` continua sendo `Windows 11 Pro`.
4. Refazer o que foi apagado em 30/10: `hdiutil makehybrid -iso -joliet -o ~/Projects/.vm/unattend.iso ~/Projects/.vm/unattend` e `qemu-img create -f qcow2 ~/Projects/.vm/win11.qcow2 48G`. Conferir se `unattend/drivers` ainda tem os drivers virtio de ARM64, já que a `virtio-win.iso` foi apagada.
5. `python3 ~/Projects/.vm/vm.py start --install`. Sem janela no Mac: a tela sai por `vm.py shot`. Esperar o arquivo `C:\setup-ok.txt` aparecer dentro da VM, pelo `~/Projects/.vm/vm-ssh.sh`.
6. Desligar e gravar o estado limpo: `python3 test/win-vm/vm_win.py limpo`.
7. Ligar de novo, copiar o `.exe` com `scp -P 2222` e marcar como baixado da internet: `Set-Content "...exe" -Stream Zone.Identifier "[ZoneTransfer]`nZoneId=3"`.
8. Pelo SSH o programa roda sem tela. Para abrir na sessão com a tela, usar `schtasks /Create /TN teste /TR "..." /SC ONCE /ST 23:59 /IT /RU teste` e `schtasks /Run /TN teste`. Instalar primeiro com `/S` para conferir o caminho silencioso.
9. Acompanhar com `vm.py shot`. Para a instalação correr sozinha existe o `.teste-auto.json`, em `%USERPROFILE%\Claude Setuper`, que o modo roteiro das telas usa.
