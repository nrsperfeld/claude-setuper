#!/bin/bash
# Abre o Claude. Na primeira vez, pede pra ele se apresentar. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
cd "$HOME"
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  claude "{{apresentacao}}"
else
  claude
fi
