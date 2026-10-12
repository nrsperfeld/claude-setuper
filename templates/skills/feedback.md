---
name: feedback
description: Registra uma correção ou aprovação da pessoa (CLAUDE/feedback/). Use sempre que a pessoa corrigir algo que você fez, disser "não é assim", "de novo não", ou aprovar explicitamente um jeito de fazer. Também com "/feedback".
---

Grave uma nota nova em `$CLAUDE_SETUPER_VAULT/CLAUDE/feedback/` com o nome `AAAA-MM-DD <resumo curto>.md`.

Formato (sem frontmatter, sem título):
- Primeira linha: o que estava errado (ou o que foi aprovado), direto.
- Depois: o que fazer em vez disso nas próximas vezes, em termos práticos.
- Última linha: `#claude #feedback`

Uma correção por nota. Não se desculpe na nota; a nota é instrução pro futuro, não pedido de desculpa. Confirme pra pessoa em uma linha o que ficou anotado.
