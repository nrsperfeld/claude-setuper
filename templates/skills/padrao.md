---
name: padrao
description: Registra um padrão de como a pessoa trabalha ou prefere as coisas (CLAUDE/padrões/). Use quando notar uma preferência repetida, quando a pessoa disser "eu sempre faço assim", "prefiro", "/padrao".
---

Grave uma nota nova em `$CLAUDE_SETUPER_VAULT/CLAUDE/padrões/` com o nome `<resumo curto do padrão>.md`.

Formato (sem frontmatter, sem título):
- Primeira linha: o padrão, como regra prática ("Prefere receber opções antes de uma recomendação").
- Depois: em que situação isso apareceu e como aplicar nas próximas vezes.
- Última linha: `#claude #padrão`

Um padrão por nota. Antes de criar, olhe se já existe nota parecida na pasta; se existir, acrescente uma linha no fim dela em vez de duplicar.

Depois abra `$CLAUDE_SETUPER_VAULT/CLAUDE/wiki/Como trabalhar comigo.md` e acrescente no bloco **Regras** uma linha com a regra prática e o link da nota que você acabou de criar: `- <regra> [[<nome da nota sem .md>]]`. Se já existe uma regra parecida, junte o link novo na mesma linha em vez de repetir a regra. Se a página não existir, pule este passo.

Confirme pra pessoa em uma linha.
