#!/bin/bash
# Opens the AI. The first time, it asks the AI to introduce itself. Created by Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
# Lesson left unfinished: opens the guide again on top of Maestri.
[ -f "{{aulaAtiva}}" ] && open -a "{{nomeApp}}" --args --aula >/dev/null 2>&1
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  # The first time, a second window checks the installation while the AI introduces itself.
  [ -f "{{conferencia}}" ] && /bin/bash "{{conferencia}}" --janela >/dev/null 2>&1 &
  exec claude "{{apresentacao}}"
else
  exec claude
fi
