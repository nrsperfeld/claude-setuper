---
name: lembrar
description: Busca no segundo cérebro antes de responder. Use quando a pessoa perguntar "o que a gente decidiu sobre", "como eu gosto de", "onde parou o projeto", "/lembrar", ou sempre que a resposta pode já estar anotada.
---

Comece pela wiki: leia `$CLAUDE_SETUPER_VAULT/CLAUDE/wiki/index.md` e, se tiver uma página sobre o assunto, leia a página. Depois procure em `$CLAUDE_SETUPER_VAULT/CLAUDE/` (todas as subpastas) por notas relacionadas ao que a pessoa perguntou. Use busca por palavras no conteúdo e no nome dos arquivos. Se a pasta tiver o Obsidian CLI disponível, `obsidian search query="termo"` também serve pra procurar no cérebro inteiro.

Responda com o que encontrou, citando o nome da nota entre colchetes duplos ([[nome]]) pra pessoa conseguir abrir no Obsidian. Se não encontrou nada, diga isso em uma linha e pergunte se quer anotar agora.

Nunca invente uma decisão ou um padrão que não está escrito. Se a resposta juntou coisas que estavam espalhadas e o assunto tem página na wiki, grave o que ficou claro na página (seguindo `CLAUDE/wiki/SCHEMA.md`) e escreva uma linha no fim de `CLAUDE/wiki/log.md`: `[AAAA-MM-DD] consulta | <assunto>`.
