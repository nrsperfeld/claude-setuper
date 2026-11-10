---
name: recall
description: Searches the second brain before answering. Use when the person asks "what did we decide about", "how do I like to", "where did the project stop", "/recall", or whenever the answer may already be written down.
---

Start with the wiki: read `$CLAUDE_SETUPER_VAULT/CLAUDE/wiki/index.md` and, if there's a page on the subject, read the page. Then search `$CLAUDE_SETUPER_VAULT/CLAUDE/` (all subfolders) for notes related to what the person asked. Search by words in the content and in the file names. If the Obsidian CLI is available in the folder, `obsidian search query="term"` also works to search the whole second brain.

Answer with what you found, citing the note's name in double brackets ([[name]]) so the person can open it in Obsidian. If you found nothing, say so in one line and ask if they want to write it down now.

Never make up a decision or pattern that isn't written down. If the answer brought together things that were scattered and the subject has a wiki page, save what became clear on the page (following `CLAUDE/wiki/SCHEMA.md`) and write one line at the end of `CLAUDE/wiki/log.md`: `[YYYY-MM-DD] query | <subject>`.
