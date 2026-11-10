---
name: decision
description: Records a decision in the second brain (CLAUDE/decisions/). Use when the person says "note this decision", "it's decided that", "/decision", or when a choice made now needs to apply in future sessions.
---

Save a new note in `$CLAUDE_SETUPER_VAULT/CLAUDE/decisions/` named `YYYY-MM-DD <short summary>.md`.

Format (no frontmatter, no heading):
- First line: the decision, in one complete sentence.
- Then: the reason, in one or two sentences, and what gets ruled out because of it.
- Last line: `#claude #decision`

One decision per note. If the person said two things, that's two notes. If there's already a note on the same subject, don't change it: create another one saying what changed. Confirm to the person in one line what was noted.
