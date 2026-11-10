#!/bin/bash
# Daily backup of the notes. Created by Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
VAULT="{{vault}}"
DEST="$HOME/Claude Setuper/backups"
mkdir -p "$DEST"
cd "$VAULT" || exit 0

# Compressed local copy (keeps the last 14).
tar -czf "$DEST/notes-$(date +%Y-%m-%d).tgz" --exclude='.obsidian/plugins' --exclude='.git' . 2>/dev/null
ls -t "$DEST"/notes-*.tgz 2>/dev/null | tail -n +15 | xargs rm -f 2>/dev/null

# On a Mac, git only really exists with the Apple tools; without them, calling git opens a window asking to install them.
tem_git() {
  if [ "$(uname)" = "Darwin" ]; then xcode-select -p >/dev/null 2>&1 || [ -x /opt/homebrew/bin/git ] || [ -x /usr/local/bin/git ]
  else command -v git >/dev/null; fi
}

# Note history (keeps every version of the pages the AI rewrites) and remote backup, if there is one.
if [ -d .git ] && tem_git; then
  git add -A >/dev/null 2>&1
  git -c user.name="Claude Setuper" -c user.email="setuper@localhost" commit -q -m "Backup $(date '+%Y-%m-%d %H:%M')" >/dev/null 2>&1
  git remote get-url origin >/dev/null 2>&1 && git push -q origin HEAD >/dev/null 2>&1
fi
