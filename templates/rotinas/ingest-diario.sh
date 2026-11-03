#!/bin/bash
# Leitura diária da pasta de entrada do segundo cérebro (CLAUDE/inbox). Criado pelo Claude Setuper.
# Só chama o Claude quando tem arquivo novo; sem arquivo, termina na hora e não gasta nada do plano.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
export CLAUDE_SETUPER_ROTINA=1
VAULT="{{vault}}"
DIR="{{logs}}"
IN="$VAULT/CLAUDE/inbox"
cd "$VAULT" || exit 0
[ -d "$IN" ] || exit 0
command -v claude >/dev/null || exit 0
mkdir -p "$IN/processando" "$IN/processados"

# Move sem sobrescrever: se já existe um arquivo com o mesmo nome, o novo ganha a data e a hora na frente.
mover() {
  local dest="$2/$(basename "$1")"
  [ -e "$dest" ] && dest="$2/$(date +%Y-%m-%d-%H%M%S)-$(basename "$1")"
  mv "$1" "$dest"
}

# Separa o que chegou numa subpasta, pra não misturar com o que chegar enquanto o Claude lê.
for f in "$IN"/*; do
  [ -f "$f" ] && [ "$(basename "$f")" != "README.md" ] && mover "$f" "$IN/processando"
done
ls -A "$IN/processando" | grep -v '^\.' | grep -q . || exit 0

echo "--- $(date)" >> "$DIR/ingest-diario.log"
claude -p --model sonnet --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" < "$DIR/prompt-ingest.md" >> "$DIR/ingest-diario.log" 2>&1
ST=$?
echo "saída=$ST" >> "$DIR/ingest-diario.log"
# Deu errado (sem internet, sem login): os arquivos ficam em processando e entram na leitura de amanhã.
[ $ST = 0 ] || exit 0
for f in "$IN/processando"/*; do
  [ -f "$f" ] && mover "$f" "$IN/processados"
done
exit 0
