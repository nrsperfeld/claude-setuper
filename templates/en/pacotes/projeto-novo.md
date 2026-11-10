---
name: new-project
description: Creates a code project from scratch, with git and a minimal structure. Use with "create a project", "start an app", "/new-project".
---

Ask what the project does and who it's for, if it isn't clear. Choose the simplest technology that solves it (a static page before a framework; a script before a service).

Create the folder at `~/Projects/<name>`, initialize git, write a short README in English saying what it is and how to run it, and make the first commit. If the person has GitHub set up, ask if they want to create the remote repository (`gh repo create --private`).

Also create `CLAUDE.md` at the root of the project with: what the project does, how to run it, and the technical decisions made. Note the project in `$CLAUDE_SETUPER_VAULT/CLAUDE/projects/<name>.md`.
