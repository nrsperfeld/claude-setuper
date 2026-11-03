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

# No Mac, o git só existe de verdade com as ferramentas da Apple; sem elas, chamar o git abre uma janela pedindo pra instalar.
tem_git() {
  if [ "$(uname)" = "Darwin" ]; then xcode-select -p >/dev/null 2>&1 || [ -x /opt/homebrew/bin/git ] || [ -x /usr/local/bin/git ]
  else command -v git >/dev/null; fi
}

# Histórico das notas (guarda cada versão das páginas que o Claude reescreve) e backup remoto, se existir.
if [ -d .git ] && tem_git; then
  git add -A >/dev/null 2>&1
  git -c user.name="Claude Setuper" -c user.email="setuper@localhost" commit -q -m "Backup $(date '+%Y-%m-%d %H:%M')" >/dev/null 2>&1
  git remote get-url origin >/dev/null 2>&1 && git push -q origin HEAD >/dev/null 2>&1
fi
