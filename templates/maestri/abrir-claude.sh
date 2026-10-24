#!/bin/bash
# Abre o Claude. Na primeira vez, pede pra ele se apresentar. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  exec claude "{{apresentacao}}"
else
  exec claude
fi
