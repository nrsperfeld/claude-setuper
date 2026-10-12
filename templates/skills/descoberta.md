---
name: descoberta
description: Registra um insight ou achado que surgiu no trabalho (CLAUDE/descobertas/). Use quando algo não óbvio apareceu, quando a pessoa disser "interessante isso", "anota essa ideia", "/descoberta".
---

Grave uma nota nova em `$CLAUDE_SETUPER_VAULT/CLAUDE/descobertas/` com o nome `<resumo curto da ideia>.md`.

Formato (sem frontmatter, sem título):
- Primeira linha: a ideia, em uma frase completa que se sustenta sozinha.
- Depois: de onde ela veio e o que ela muda, se muda algo.
- Última linha: `#claude #descoberta`

Uma ideia por nota. Se houver uma nota relacionada, cite o nome dela entre colchetes duplos, assim: [[nome da nota]]. Confirme pra pessoa em uma linha.
