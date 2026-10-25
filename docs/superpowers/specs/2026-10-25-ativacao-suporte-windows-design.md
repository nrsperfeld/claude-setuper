# Claude Setuper 1.6 a 1.8: ativação, suporte e app no Windows

Data: 25-10-2026. Autorizado pelo Nathan a desenhar e implementar sem aprovação etapa por etapa
("desenha toda a arquitetura e vai implementando, user-friendly e funcional"). Assinatura Apple/Windows fica pra depois.

## Por quê

A instalação já é boa. Quem nunca usou IA perde o fio depois dela: abre o Claude, não sabe o que pedir, fecha e não volta.
O sucesso medido é a pessoa fazer uma tarefa real e útil na primeira conversa e voltar nos dias seguintes.

## 1. Ativação (1.6)

### Primeira vitória, na primeira conversa
A primeira mensagem que o Setuper manda pro Claude (`apresentacao` em `src/perfis.js`, usada pelo Maestri no Mac e pelo
atalho no Windows) deixa de ser "se apresenta e me propõe algo" e passa a conduzir uma tarefa real do perfil, já na
primeira resposta. Cada perfil ganha `primeiraVitoria` no JSON: o que o Claude pede, o que faz e onde guarda o resultado.

- dia-a-dia: organizar a pasta Downloads. O Claude mostra o plano antes, só cria pastas e move (nunca apaga),
  e guarda a lista do que mudou de lugar numa nota, pra poder desfazer.
- empresario: a pessoa arrasta uma planilha ou PDF da empresa (ou conta os números do mês) e recebe o que importa
  ali e uma recomendação, com a conta feita.
- marketing: a pessoa diz o próximo post ou campanha e recebe 3 versões no tom dela.
- video: a pessoa diz o tema do próximo vídeo e recebe título e roteiro de 30 segundos.
- estudante: a pessoa diz a próxima prova e recebe um plano de estudo e 5 perguntas pra testar (sem dar a resposta antes).
- elos: a pessoa diz a tarefa mais chata da semana e o Claude transforma num comando reutilizável.

Regras comuns: apresentação em no máximo 2 linhas, uma pergunta por vez, resultado salvo como nota no segundo cérebro
(quando houver) e, no fim, uma frase dizendo que amanhã ele sugere outra coisa.

### Primeira semana guiada
Hook novo `templates/hooks/ativacao.cjs` no SessionStart (só em `source: startup`), independente do cofre.
Lê `~/.claude/setuper-ativacao.json` (escrito pelo núcleo: data da instalação, perfil, missões, caminho do cardápio)
e guarda o próprio estado em `~/.claude/setuper-ativacao-estado.json`.
- Em cada dia novo de uso, nas duas primeiras semanas, injeta a próxima missão do perfil (6 no total, `semana` no JSON)
  como contexto: "na primeira resposta, depois de atender o pedido, sugira em uma frase a missão de hoje".
  Conta dias de uso, não de calendário: quem some três dias continua de onde parou.
- Nunca mais de uma sugestão por dia. Depois das 6, para.

### Cardápio de pedidos por profissão
`templates/cardapio/<perfil>.md`: 15 a 20 pedidos prontos, agrupados por situação, em português de gente.
Instalado como nota "Cardápio do Claude" na raiz do cofre (ou em `~/Claude Setuper/` sem cofre), substitui a nota
genérica "O que pedir" do Maestri e é citado no `CLAUDE.md`: quando a pessoa perguntar o que dá pra pedir, o Claude usa ele.

## 2. Suporte e valor (1.7)

### Resumo da semana
O mesmo hook de ativação, a cada 7 dias (a partir do 7º dia depois da instalação), conta nos registros do Claude Code
(`~/.claude/projects/**/*.jsonl` alterados nos últimos 7 dias): conversas, pedidos da pessoa, arquivos criados ou
editados, e notas novas no cérebro. Injeta como contexto pra primeira resposta do dia mostrar em até 3 linhas, junto com
uma sugestão do cardápio. Sem estimativa de horas economizadas: não temos como medir, então não inventamos número.
Sem janela, sem notificação: aparece onde a pessoa já está.

### Pedir ajuda
`src/ajuda.js`: gera "Claude Setuper - pedido de ajuda.txt" na Mesa (Área de Trabalho) com versão, sistema, perfil,
conferência completa (✓/✗ com dica), estado dos passos e o fim do registro, sem senha nem código de login.
- App: botão "Pedir ajuda" na tela final, na tela de falha e no rodapé. Gera o arquivo, mostra no Finder e explica
  "manda esse arquivo pra quem instalou o Claude pra você".
- Terminal (Mac e Windows): `claude-setuper ajuda` faz o mesmo.

## 3. App no Windows (1.8, desenho)

O que já é igual nos dois: perguntas, módulos, sentinela, telas (`app/tela`). O que muda:
- Terminal invisível: o Mac usa `script` (pty.sh). No Windows o equivalente é o ConPTY. Candidato: `@lydell/node-pty`,
  que traz binários N-API prontos pra win32-x64 e win32-arm64 (funciona no Electron sem compilar). Usar a 1.2.0-beta.15
  (08-08-2026); a beta.18 saiu em 24-10-2026, nova demais. É o risco principal e precisa de spike na VM antes de tudo:
  `claude auth login`, `gh auth login --web` e `vercel login` rodando dentro dele, com link e código extraídos.
- Senha: não existe; quando o winget pede elevação, aparece o UAC do próprio Windows.
- Empacotamento: zip com o Electron oficial de Windows, baixado e extraído pelo PowerShell do `.bat`
  (extraído assim não ganha a marca da internet, então o SmartScreen não bloqueia o .exe).
- Atualização: igual ao Mac, conferindo a versão do `main`.
Ordem: spike do ConPTY na VM, empacotamento, `.bat` novo com plano B no instalador atual.

## 4. Roteiro do teste com 5 leigos
`docs/teste-com-leigos.md`: quem chamar, o que dizer, o que observar em silêncio, as 5 perguntas do final e uma
planilha simples de onde travou. Cópia no `_INBOX` pro Nathan conduzir.

## Testes
- Unitário rápido dos hooks com `--home` falso: dias de uso, uma missão por dia, resumo da semana com registros falsos.
- Instalação completa nas VMs (Mac pelo app, Windows pelo instalador), uma de cada vez.
- `claude-setuper ajuda` nas duas VMs, conferindo que o arquivo não tem senha nem código.
