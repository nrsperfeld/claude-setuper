---
name: retro
description: Wraps up the work session by noting where it stopped (CLAUDE/projects/). Use when the person says "let's stop here", "wrap up the session", "/retro", or at the end of any real work.
---

Do four things, in this order:

1. Update (or create) the project's note in `$CLAUDE_SETUPER_VAULT/CLAUDE/projects/<project name>.md`. The project name is the name of the working folder or what the person calls the work. Add a block at the end of the note with today's date: what was done, where it stopped, what's left, and anything the next session needs to know so it doesn't repeat work. No frontmatter, no heading. End with `#claude #project`.

2. Ask yourself: was there a decision in this session? A correction from the person? Did any idea come up? For each yes, save the note in the right folder (decisions/, feedback/, discoveries/), one per note. A correction or new pattern also gets its line in `CLAUDE/wiki/How to work with me.md`, the way the /feedback skill explains.

3. If the work touched a topic that has a page in `CLAUDE/wiki/`, update the page following `CLAUDE/wiki/SCHEMA.md`. If a topic, person or project has already appeared in three or more notes and still has no page, create the page and add it to `index.md`. If what's keeping the person busy has changed, update `overview.md`. For each page that changed, one line at the end of `CLAUDE/wiki/log.md`.

4. Tell the person, in at most five lines and with no jargon, what got done and what's left for next time.
