# Redesenho da experiência do Claude Setuper

Aprovado pelo Nathan em 06/11/2026 em duas páginas: o desenho (https://claude.ai/artifact/SNN5frGBA9LhyKa4CUXvzi) e a revisão item por item (https://claude.ai/artifact/8NQ55W2Q7jimPpX64h7u8v, coleção `revisao`). Este arquivo junta o que ficou decidido e resolve o que as respostas mudaram no desenho.

## Objetivo

O app é a entrada de uma pessoa leiga na IA avançada: interface simples, com cara de Apple e sensação de abrir um portal, sem Terminal, e sem travar em nada que seja opcional.

## Decisões do Nathan

- Conta da Apple: não pagar agora. O DMG sai com assinatura ad-hoc e abre pelo caminho de Ajustes, Privacidade e Segurança, com o desenho na janela do DMG e na página de download (mesmo caminho já desenhado em `app/presente/fundo.py`).
- Certificado do Windows: lançar com a tela azul guiada na página de download, e comprar depois.
- Consertos do GitHub e do Effortless: não saem na versão atual, entram no redesenho.
- Ordem: Mac primeiro, já em português e inglês. Windows em seguida, com as mesmas telas.
- Vídeo: botão Pular aparece depois de 15 segundos.
- Gravação do vídeo: pelo Claude, na VM, depois de liberar disco.
- Disco: o Claude levanta as duplicatas e o Nathan aprova a lista antes de ir para a Lixeira.
- Inglês: quem escolhe inglês recebe tudo em inglês, nomes de pasta do segundo cérebro inclusive.

## Ajustes pedidos na revisão

- Guias (pedido posterior): os popups mostram o ícone do programa que precisa ser olhado e setas óbvias até cada região da tela.
- Perguntas (`i-perguntas`): mantém todas as perguntas atuais. Elas acontecem enquanto o app baixa o que precisa, para a pessoa não ficar parada. Isso substitui as 3 perguntas das pranchas 3 a 5, e a pergunta "Quero escolher o que vai ser instalado" continua existindo.
- Espera (`i-exemplo`): deixar explícito que o pedido mostrado é um exemplo.

## O que muda no fluxo por causa do ajuste das perguntas

O item `i-ordem-apple` (pedido da Apple depois de clicar em instalar) continua valendo, e o baixar enquanto pergunta depende das ferramentas da Apple no Mac com Homebrew. Por isso a ordem fica:

1. Abertura com o anel.
2. O que muda, com um exemplo.
3. Tudo pronto para começar: o que vai ser instalado e o que deixar à mão, com o plano pago. O nome ainda não é conhecido, então a tela não usa nome.
4. Clique em instalar: guia flutuante da Apple. A pessoa clica em Instalar e Concordo na janela da Apple e avisa no guia.
5. As perguntas, com uma faixa discreta mostrando o que está sendo preparado. Em segundo plano correm as ferramentas da Apple, Claude Code, Homebrew e os downloads adiantados.
6. Instalação com o anel, na porcentagem real. Senha do computador e login do Claude são guias flutuantes.
7. O anel fecha, vídeo de abertura, Maestri com a aula.

A senha do Homebrew pode aparecer enquanto a pessoa responde uma pergunta. A janela de senha e o guia ficam na frente, e a pergunta espera atrás. O que depende da resposta das perguntas (módulos de cada perfil) só instala depois delas; o que é baixado antes é só download, sem instalar nada que o perfil não peça.

## Arquitetura

- `app/tela/`: reescrita com a identidade aprovada (`estilo.css` a partir de `setuper.css` do desenho). Sem coluna de etapas, uma coisa por vez, sempre escuro. O `aoEvento` e o modo roteiro dos testes da VM continuam.
- `app/guia/`: janela nova do guia flutuante, sempre acima de tudo, em todos os espaços e em tela cheia. Recebe `pausa`, `link`, `codigo`. Tem passos, ações, pular e o botão de concluir. Prints reais entram por `app/guia/prints/<idioma>/<id>.png` quando existirem; enquanto isso, o desenho esquemático.
- `app/setas.js` e `app/tela/setas.*`: janela transparente, que não recebe cliques, com setas até o lugar da tela. A posição das janelas vem do `CGWindowListCopyWindowInfo` (via `osascript -l JavaScript`), que não pede permissão. Janela que não abriu ou está atrás de outra manda a seta pro Dock. O guia mostra o ícone real do programa, lido do `.icns` do app (`app.getFileIcon` derruba o Electron 44 no Mac). As posições dentro de cada janela são proporções a calibrar com a instalação real. No Windows entra na fase 8.
- `src/i18n.js` e `src/idiomas/en.json`: o texto em português é a chave. `t('Frase', {nome})`. Template em inglês fica em `templates/en/`, com o mesmo caminho relativo, e `ctx.template` escolhe. Teste procura texto sem tradução.
- `src/modulos/base.js`: `adiantarPreparo(ctx)` roda em segundo plano durante as perguntas. `instalar` espera ele terminar e continua idempotente.
- `src/modulos/github.js`, `chrome.js`, `vercel.js`, `mcps.js`: saem do caminho principal no app e viram opcionais no fim da aula, chamados por módulo a partir do guia. Terminal continua igual.
- `templates/hooks/aula.cjs`: hook que escreve eventos em `~/.claude/setuper-aula-eventos.jsonl` (mensagem enviada, permissão, sessão nova). O guia lê esse arquivo.
- `src/modulos/effortless.js`: grava `setupDone: true` em `plugins/store/effortless_effortless-<sha256("effortless@effortless")[:12]>.json`, mesclando com o que existir, e a conferência checa.

## Fases

1. Tela nova e fluxo de boas-vindas, em português e com `t()` desde o começo.
2. Guia flutuante e preparo durante as perguntas.
3. GitHub com pular, opcionais no fim, Effortless.
4. Fim com anel, vídeo (com lugar reservado até a gravação), aula e hooks, retomada.
5. Inglês completo: catálogo, templates, pastas.
6. DMG, ícone, página de download.
7. Disco, VM, prints reais, gravação do vídeo, teste em máquina zerada.
8. Windows: terminal invisível, EXE, VM refeita.

## Fora do escopo agora

Assinatura paga, certificado do Windows, publicar qualquer versão, mexer na branch `presente`.
