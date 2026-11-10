---
name: publish
description: Puts a page or site on the internet using Vercel. Use when the person says "publish this", "put it online", "I want a link to show people", "/publish".
---

1. If the site doesn't exist yet, create a new folder at `~/Projects/<site-name>` with a complete `index.html` (HTML, CSS and JS in one file, responsive, in English). Before publishing, tell the person in simple language what the page has.
2. Publish with `vercel deploy --prod --yes` inside the folder. The first time, Vercel asks for the project name: accept the default.
3. Take the final URL from the command's output and give it to the person in one line: "It's live: <url>".
4. Note in `$CLAUDE_SETUPER_VAULT/CLAUDE/projects/<site-name>.md` the URL, the date and what the page does (no heading, ending with `#claude #project`).

To update an existing site, edit the files and run the same command. Never delete a project on Vercel unless the person asks.
