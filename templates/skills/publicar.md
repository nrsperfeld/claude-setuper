---
name: publicar
description: Coloca uma página ou site na internet usando a Vercel. Use quando a pessoa disser "publica isso", "coloca no ar", "quero um link pra mostrar", "/publicar".
---

1. Se o site ainda não existe, crie uma pasta nova em `~/Projetos/<nome-do-site>` com um `index.html` completo (HTML, CSS e JS num arquivo só, responsivo, em português). Mostre pra pessoa antes de publicar, em linguagem simples, o que a página tem.
2. Publique com `vercel deploy --prod --yes` dentro da pasta. Na primeira vez a Vercel pergunta o nome do projeto: aceite o padrão.
3. Pegue a URL final da saída do comando e entregue pra pessoa em uma linha: "Está no ar: <url>".
4. Anote em `$CLAUDE_SETUPER_VAULT/CLAUDE/projetos/<nome-do-site>.md` a URL, a data e o que a página faz (sem título, terminando com `#claude #projeto`).

Pra atualizar um site que já existe, edite os arquivos e rode o mesmo comando. Nunca apague um projeto na Vercel sem a pessoa pedir.
