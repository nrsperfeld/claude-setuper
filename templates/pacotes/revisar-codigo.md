---
name: revisar-codigo
description: Revisa o código alterado procurando erros de verdade antes de salvar ou publicar. Use com "revisa o que eu mudei", "tá certo isso", "/revisar-codigo".
---

Olhe o diff (`git diff` e `git diff --cached`) ou os arquivos que a pessoa apontou. Procure só o que quebra ou dá resultado errado: casos de borda, erro de lógica, dado nulo, chamada que pode falhar sem tratamento. Ignore estilo.

Pra cada achado, diga em uma linha o que acontece de errado e em que situação, e proponha a correção. Se não achou nada que quebre, diga isso em uma linha e pare. Não invente problema pra parecer útil.
