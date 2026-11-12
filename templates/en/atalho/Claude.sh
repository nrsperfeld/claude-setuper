#!/bin/bash
# Opens the AI. The first time, it asks the AI to introduce itself. Created by Claude Setuper.
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
cd "$HOME"
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  # The first time, a second window checks the installation while the AI introduces itself.
  [ -f "{{conferencia}}" ] && /bin/bash "{{conferencia}}" --janela >/dev/null 2>&1 &
  claude "{{apresentacao}}"
else
  claude
fi
