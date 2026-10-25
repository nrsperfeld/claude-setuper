# App do Claude Setuper para Mac

Aprovado pelo Nathan em 24/10/2026, em três partes, na conversa. Ele pediu pra seguir até o fim sem novas aprovações.

## Objetivo

Uma pessoa leiga instala o Claude no Mac sozinha, do começo ao fim, sem ver o Terminal depois de colar uma linha e sem travar em nenhuma tela. A ELOS não tem conta de desenvolvedor da Apple: o app sai sem assinatura paga.

## Restrições

- Sem Developer ID: app baixado pelo navegador é bloqueado no macOS 15/26 com aviso de malware. Baixado por `curl` no Terminal não recebe quarentena e abre direto. Por isso a entrada é a mesma linha de hoje (`curl ... install.sh | bash`).
- Os 11 módulos de instalação (`src/modulos`) continuam um só código para Terminal (Mac, Linux, Windows) e app. O app troca só a camada de tela (`ui`) e a execução de comandos interativos (`runVisivel`).
- O instalador de Terminal continua igual e vira plano B no Mac (`CLAUDE_SETUPER_TERMINAL=1`, ou quando o download do app falha).

## Parte 1: experiência e arquitetura

1. A linha do Terminal baixa o app (zip, arm64 ou x64 conforme `uname -m`), põe em `/Applications` (ou `~/Applications` sem permissão), abre e diz "Pode fechar esta janela".
2. Perguntas uma por tela, com botões: as mesmas do `wizard.js` (nome, perfil, idade, tecnologia, IA, trabalho, autonomia, pacotes, ferramentas, escolher módulos).
3. Tela de instalação: lista dos passos com ✓, frase do que está acontecendo, "ver detalhes" com o registro técnico.
4. Quando precisa da pessoa, um cartão grande (equivalente ao ✋): senha pela janela nativa do Mac (`SUDO_ASKPASS` com `osascript`), logins com botão "Abrir o navegador" e código grande com "Copiar", ferramentas da Apple com instrução do clique.
5. Tela final: "Abrir o Claude" e a conferência (os `verificar()` dos módulos), com o que falta.

Por dentro: Electron 44.7.0 com o Node embutido. O processo principal importa `src/cli.js` e chama a mesma `instalar(ctx)`; `ui` recebe uma implementação que conversa com a janela por IPC (`app/ui-app.js`). `runVisivel` roda o comando dentro de `/usr/bin/script` (um terminal invisível, que resolve o `kqueue` do Bun), lê link, código e "Press Enter" da saída e mostra no cartão.

## Parte 2: empacotar, baixar, atualizar

- Código em `app/` no mesmo repositório. `app/build.sh` monta `Claude Setuper.app` a partir do Electron oficial (arm64 e x64), copia `src/`, `templates/`, `bin/` e dependências, assina ad-hoc (`codesign -s -`) e gera `dist/Claude-Setuper-mac-<arq>.zip`.
- Publicação nos Releases do GitHub do Setuper; a linha baixa de `releases/latest/download/`.
- Ao abrir, o app compara a própria versão com `package.json` do `main`; se houver nova, mostra "Atualizar", que baixa o zip, troca o app e reabre.
- O app instala o comando `claude-setuper` (clone em `~/Claude Setuper/app`, link em `~/.local/bin`), então `doctor` e `atualizar` seguem funcionando no Terminal.
- Abrir o app de novo: tela inicial com "Continuar a instalação" e "Só conferir".

## Parte 3: testes

- `test/mac-vm/vm.py rodar-app`: VM macOS limpa (tart), zip local entregue por `CLAUDE_SETUPER_APP_URL=file://...`, a mesma linha do Terminal abre o app na sessão gráfica.
- Modo roteiro só para teste: com `~/Claude Setuper/.teste-auto.json` o app responde as telas sozinho (nome Teste, idade, o resto no padrão) e salva um print de cada tela em `~/Claude Setuper/telas/`. A senha da VM vem desse arquivo para o askpass.
- O vigia de logins da VM encerra os logins depois de 20 s, como no teste de Terminal. No fim, `claude-setuper doctor` num Terminal novo e os prints copiados para o Mac.
- Os testes de Terminal passam a usar `CLAUDE_SETUPER_TERMINAL=1`, para continuar cobrindo o plano B.

## Fora do escopo

Windows continua no `.bat` + `install.ps1`. Atualização silenciosa automática e DMG ficam para quando houver conta da Apple.
