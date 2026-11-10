#!/bin/bash
# Daily read of the second brain's inbox folder (CLAUDE/inbox). Created by Claude Setuper.
# Only calls the AI when there's a new file; with no file, it ends right away and uses nothing from the plan.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
export CLAUDE_SETUPER_ROTINA=1
VAULT="{{vault}}"
DIR="{{logs}}"
IN="$VAULT/CLAUDE/inbox"
cd "$VAULT" || exit 0
[ -d "$IN" ] || exit 0
command -v claude >/dev/null || exit 0
mkdir -p "$IN/processing" "$IN/processed"

# Moves without overwriting: if a file with the same name already exists, the new one gets the date and time in front.
mover() {
  local dest="$2/$(basename "$1")"
  [ -e "$dest" ] && dest="$2/$(date +%Y-%m-%d-%H%M%S)-$(basename "$1")"
  mv "$1" "$dest"
}

# Moves what arrived into a subfolder, so it doesn't get mixed with what arrives while the AI is reading.
for f in "$IN"/*; do
  [ -f "$f" ] && [ "$(basename "$f")" != "README.md" ] && mover "$f" "$IN/processing"
done
ls -A "$IN/processing" | grep -v '^\.' | grep -q . || exit 0

echo "--- $(date)" >> "$DIR/ingest-diario.log"
claude -p --model sonnet --permission-mode acceptEdits --tools "Read,Write,Edit,Glob,Grep" < "$DIR/prompt-ingest.md" >> "$DIR/ingest-diario.log" 2>&1
ST=$?
echo "exit=$ST" >> "$DIR/ingest-diario.log"
# It failed (no internet, not logged in): the files stay in processing and go into tomorrow's read.
[ $ST = 0 ] || exit 0
for f in "$IN/processing"/*; do
  [ -f "$f" ] && mover "$f" "$IN/processed"
done
exit 0
