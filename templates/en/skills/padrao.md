---
name: pattern
description: Records a pattern in how the person works or prefers things (CLAUDE/patterns/). Use when you notice a repeated preference, when the person says "I always do it this way", "I prefer", "/pattern".
---

Save a new note in `$CLAUDE_SETUPER_VAULT/CLAUDE/patterns/` named `<short summary of the pattern>.md`.

Format (no frontmatter, no heading):
- First line: the pattern, as a practical rule ("Prefers to see options before a recommendation").
- Then: in what situation it came up and how to apply it from now on.
- Last line: `#claude #pattern`

One pattern per note. Before creating it, check whether a similar note already exists in the folder; if so, add a line at the end of it instead of duplicating.

Then open `$CLAUDE_SETUPER_VAULT/CLAUDE/wiki/How to work with me.md` and add to the **Rules** block a line with the practical rule and a link to the note you just created: `- <rule> [[<note name without .md>]]`. If a similar rule already exists, add the new link to that same line instead of repeating the rule. If the page doesn't exist, skip this step.

Confirm to the person in one line.
