#!/bin/bash
# Weekly review of the second brain. Created by Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
export CLAUDE_SETUPER_ROTINA=1
VAULT="{{vault}}"
DIR="{{logs}}"
cd "$VAULT" || exit 0
command -v claude >/dev/null || exit 0

# On a Mac, git only really exists with the Apple tools; without them, calling git opens a window asking to install them.
tem_git() {
  if [ "$(uname)" = "Darwin" ]; then xcode-select -p >/dev/null 2>&1 || [ -x /opt/homebrew/bin/git ] || [ -x /usr/local/bin/git ]
  else command -v git >/dev/null; fi
}

# Saves a snapshot of the notes before the review, so you can go back if the AI rewrites something wrong.
if [ -d .git ] && tem_git; then
  git add -A >/dev/null 2>&1
  git -c user.name="Claude Setuper" -c user.email="setuper@localhost" commit -q -m "Before the weekly review $(date '+%Y-%m-%d')" >/dev/null 2>&1
fi

echo "--- $(date)" >> "$DIR/revisao-semanal.log"
claude -p --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" < "$DIR/prompt-revisao.md" >> "$DIR/revisao-semanal.log" 2>&1
