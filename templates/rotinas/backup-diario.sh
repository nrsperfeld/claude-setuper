#!/bin/bash
# Backup diário das notas. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
VAULT="{{vault}}"
DEST="$HOME/Claude Setuper/backups"
mkdir -p "$DEST"
cd "$VAULT" || exit 0

# Cópia local compactada (guarda as últimas 14).
tar -czf "$DEST/notas-$(date +%Y-%m-%d).tgz" --exclude='.obsidian/plugins' --exclude='.git' . 2>/dev/null
ls -t "$DEST"/notas-*.tgz 2>/dev/null | tail -n +15 | xargs rm -f 2>/dev/null

# Backup remoto, se existir.
if [ -d .git ] && git remote get-url origin >/dev/null 2>&1; then
  git add -A >/dev/null 2>&1
  git -c user.name="Claude Setuper" -c user.email="setuper@localhost" commit -q -m "Backup $(date +%Y-%m-%d %H:%M)" >/dev/null 2>&1
  git push -q origin HEAD >/dev/null 2>&1
fi
