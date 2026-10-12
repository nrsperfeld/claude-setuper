---
name: decisao
description: Registra uma decisão no segundo cérebro (CLAUDE/decisões/). Use quando a pessoa disser "anota essa decisão", "fica decidido que", "/decisao", ou quando uma escolha feita agora precisa valer nas próximas sessões.
---

Grave uma nota nova em `$CLAUDE_SETUPER_VAULT/CLAUDE/decisões/` com o nome `AAAA-MM-DD <resumo curto>.md`.

Formato (sem frontmatter, sem título):
- Primeira linha: a decisão, em uma frase completa.
- Depois: o porquê, em uma ou duas frases, e o que fica excluído por causa dela.
- Última linha: `#claude #decisão`

Uma decisão por nota. Se a pessoa falou duas coisas, são duas notas. Se já existe uma nota sobre o mesmo assunto, não a altere: crie outra dizendo o que mudou. Confirme pra pessoa em uma linha o que foi anotado.
