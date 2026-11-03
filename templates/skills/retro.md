---
name: retro
description: Fecha a sessão de trabalho anotando onde parou (CLAUDE/projetos/). Use quando a pessoa disser "vamos parar por aqui", "fecha a sessão", "/retro", ou no fim de qualquer trabalho de verdade.
---

Faça quatro coisas, nesta ordem:

1. Atualize (ou crie) a nota do projeto em `$CLAUDE_SETUPER_VAULT/CLAUDE/projetos/<nome do projeto>.md`. O nome do projeto é o nome da pasta de trabalho ou o que a pessoa chama o trabalho. Acrescente no fim da nota um bloco com a data de hoje: o que foi feito, onde parou, o que falta, e qualquer coisa que a próxima sessão precisa saber pra não repetir trabalho. Sem frontmatter, sem título. Termine com `#claude #projeto`.

2. Pergunte a si mesmo: houve decisão nesta sessão? Houve correção da pessoa? Surgiu alguma ideia? Para cada sim, grave a nota na pasta certa (decisões/, feedback/, descobertas/), uma por nota. Correção ou padrão novo também ganha a sua linha em `CLAUDE/wiki/Como trabalhar comigo.md`, do jeito que a skill /feedback explica.

3. Se o trabalho mexeu num assunto que tem página em `CLAUDE/wiki/`, atualize a página seguindo `CLAUDE/wiki/SCHEMA.md`. Se um assunto, pessoa ou projeto já apareceu em três notas ou mais e ainda não tem página, crie a página e ponha no `index.md`. Se mudou o que ocupa a pessoa agora, atualize o `overview.md`. Para cada página que mudou, uma linha no fim de `CLAUDE/wiki/log.md`.

4. Diga pra pessoa, em no máximo cinco linhas e sem jargão, o que ficou feito e o que fica pra próxima.
