Painel do Claude

Tudo o que o Claude anotou, do mais recente pro mais antigo. Esta nota se atualiza sozinha.

Projetos (onde cada um parou)

```dataview
TABLE WITHOUT ID file.link AS "Projeto", dateformat(file.mtime, "dd/MM/yyyy") AS "Atualizado"
FROM "CLAUDE/projetos"
WHERE file.name != "README"
SORT file.mtime DESC
```

Decisões

```dataview
LIST
FROM "CLAUDE/decisões"
WHERE file.name != "README"
SORT file.mtime DESC
LIMIT 15
```

Padrões (como você gosta das coisas)

```dataview
LIST
FROM "CLAUDE/padrões"
WHERE file.name != "README"
SORT file.mtime DESC
```

Correções que o Claude já aprendeu

```dataview
LIST
FROM "CLAUDE/feedback"
WHERE file.name != "README"
SORT file.mtime DESC
LIMIT 15
```

Descobertas

```dataview
LIST
FROM "CLAUDE/descobertas"
WHERE file.name != "README"
SORT file.mtime DESC
LIMIT 15
```
