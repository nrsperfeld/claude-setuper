#!/bin/bash
# Abre o Claude. Na primeira vez, pede pra ele se apresentar. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
# Aula pela metade: abre o guia de novo por cima do Maestri.
[ -f "{{aulaAtiva}}" ] && open -a "{{nomeApp}}" --args --aula >/dev/null 2>&1
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  exec claude "{{apresentacao}}"
else
  exec claude
fi
