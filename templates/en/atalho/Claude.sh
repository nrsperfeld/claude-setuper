#!/bin/bash
# Opens the AI. The first time, it asks the AI to introduce itself. Created by Claude Setuper.
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
cd "$HOME"
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  claude "{{apresentacao}}"
else
  claude
fi
