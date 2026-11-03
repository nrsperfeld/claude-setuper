#!/bin/bash
# Revisão semanal do segundo cérebro. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
export CLAUDE_SETUPER_ROTINA=1
VAULT="{{vault}}"
DIR="{{logs}}"
cd "$VAULT" || exit 0
command -v claude >/dev/null || exit 0

# No Mac, o git só existe de verdade com as ferramentas da Apple; sem elas, chamar o git abre uma janela pedindo pra instalar.
tem_git() {
  if [ "$(uname)" = "Darwin" ]; then xcode-select -p >/dev/null 2>&1 || [ -x /opt/homebrew/bin/git ] || [ -x /usr/local/bin/git ]
  else command -v git >/dev/null; fi
}

# Guarda uma foto das notas antes da revisão, pra dar pra voltar atrás se o Claude reescrever algo errado.
if [ -d .git ] && tem_git; then
  git add -A >/dev/null 2>&1
  git -c user.name="Claude Setuper" -c user.email="setuper@localhost" commit -q -m "Antes da revisão semanal $(date '+%Y-%m-%d')" >/dev/null 2>&1
fi

echo "--- $(date)" >> "$DIR/revisao-semanal.log"
claude -p --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" < "$DIR/prompt-revisao.md" >> "$DIR/revisao-semanal.log" 2>&1
