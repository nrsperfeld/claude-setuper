---
name: projeto-novo
description: Cria um projeto de código do zero, com git e estrutura mínima. Use com "cria um projeto", "começa um app", "/projeto-novo".
---

Pergunte o que o projeto faz e pra quem, se não estiver claro. Escolha a tecnologia mais simples que resolve (uma página estática antes de um framework; um script antes de um serviço).

Crie a pasta em `~/Projetos/<nome>`, inicialize o git, escreva um README curto em português dizendo o que é e como rodar, e faça o primeiro commit. Se a pessoa tiver GitHub configurado, pergunte se quer criar o repositório remoto (`gh repo create --private`).

Crie também `CLAUDE.md` na raiz do projeto com: o que o projeto faz, como rodar, e as decisões técnicas tomadas. Anote o projeto em `$CLAUDE_SETUPER_VAULT/CLAUDE/projetos/<nome>.md`.
