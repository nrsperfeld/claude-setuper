Claude dashboard

Everything the AI has written down, newest first. This note updates itself.

Projects (where each one stopped)

```dataview
TABLE WITHOUT ID file.link AS "Project", dateformat(file.mtime, "MM/dd/yyyy") AS "Updated"
FROM "CLAUDE/projects"
WHERE file.name != "README"
SORT file.mtime DESC
```

Decisions

```dataview
LIST
FROM "CLAUDE/decisions"
WHERE file.name != "README"
SORT file.mtime DESC
LIMIT 15
```

Patterns (how you like things)

```dataview
LIST
FROM "CLAUDE/patterns"
WHERE file.name != "README"
SORT file.mtime DESC
```

Corrections the AI has already learned

```dataview
LIST
FROM "CLAUDE/feedback"
WHERE file.name != "README"
SORT file.mtime DESC
LIMIT 15
```

Discoveries

```dataview
LIST
FROM "CLAUDE/discoveries"
WHERE file.name != "README"
SORT file.mtime DESC
LIMIT 15
```

Wiki (one page per person, project or topic)

```dataview
TABLE WITHOUT ID file.link AS "Page", dateformat(file.mtime, "MM/dd/yyyy") AS "Updated"
FROM "CLAUDE/wiki"
WHERE file.name != "SCHEMA" AND file.name != "log"
SORT file.mtime DESC
```

Saved sources

```dataview
LIST
FROM "CLAUDE/sources"
WHERE file.name != "README"
SORT file.mtime DESC
LIMIT 15
```
