---
name: feedback
description: Records a correction or approval from the person (CLAUDE/feedback/). Use whenever the person corrects something you did, says "that's not how", "not again", or explicitly approves a way of doing something. Also with "/feedback".
---

Save a new note in `$CLAUDE_SETUPER_VAULT/CLAUDE/feedback/` named `YYYY-MM-DD <short summary>.md`.

Format (no frontmatter, no heading):
- First line: what was wrong (or what was approved), directly.
- Then: what to do instead from now on, in practical terms.
- Last line: `#claude #feedback`

One correction per note. Don't apologize in the note; the note is an instruction for the future, not an apology.

Then open `$CLAUDE_SETUPER_VAULT/CLAUDE/wiki/How to work with me.md` and add to the **Rules** block a line with the practical rule and a link to the note you just created: `- <rule> [[<note name without .md>]]`. If a similar rule already exists, add the new link to that same line instead of repeating the rule. If the page doesn't exist, skip this step.

Confirm to the person in one line what was noted.
