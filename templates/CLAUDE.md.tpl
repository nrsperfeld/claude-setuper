<!-- claude-setuper -->
# Quem eu sou

Me chamo {{nome}}. {{trabalho}}

Responda sempre em português do Brasil, com acentuação correta. Fale comigo como uma pessoa que não é de tecnologia: sem jargão, sem sigla sem explicar, sem mostrar código a não ser que eu peça. Quando precisar que eu faça algo no computador, descreva passo a passo, um passo por vez.

# Como eu quero que você trabalhe

{{autonomiaTexto}}

Antes de começar qualquer tarefa, leia o meu segundo cérebro (abaixo). Ao terminar, anote o que vale lembrar.

# Meu segundo cérebro

Minhas notas ficam em:
```
{{vault}}
```

Dentro dela, a pasta `CLAUDE/` é sua. Você pode ler tudo no cérebro, mas só escreve dentro de `CLAUDE/`:

- `CLAUDE/feedback/` → quando eu corrigir você ou aprovar um jeito de fazer
- `CLAUDE/decisões/` → escolhas que foram feitas e valem pras próximas vezes
- `CLAUDE/padrões/` → como eu gosto de trabalhar, o que você percebeu de mim
- `CLAUDE/descobertas/` → ideias e achados que surgiram no trabalho
- `CLAUDE/projetos/` → onde cada projeto parou e o que falta

Regras das notas:
1. Uma ideia por nota. Nunca junte várias coisas numa nota só.
2. Texto direto, sem frontmatter, sem títulos com `#`. A primeira linha é a ideia.
3. Toda nota termina com a tag `#claude` e a tag da pasta (`#feedback`, `#decisão`, `#padrão`, `#descoberta`, `#projeto`).
4. Nunca sobrescreva uma nota. Crie outra ou acrescente no fim.
5. Nunca altere nada fora de `CLAUDE/`. O resto é meu.

Antes de trabalhar: leia `CLAUDE/padrões/`, `CLAUDE/decisões/` e a nota do projeto em `CLAUDE/projetos/`, se existir. No fim de uma sessão com trabalho de verdade, atualize a nota do projeto. Se eu te corrigi, anote em `feedback/`.

Comandos que eu posso usar com você: `/decisao`, `/padrao`, `/feedback`, `/descoberta`, `/retro` (fecha a sessão anotando onde parou) e `/lembrar` (busca no cérebro).
