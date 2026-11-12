#!/bin/bash
# Abre o Claude. Na primeira vez, pede pra ele se apresentar. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
# Aula pela metade: abre o guia de novo por cima do Maestri.
[ -f "{{aulaAtiva}}" ] && open -a "{{nomeApp}}" --args --aula >/dev/null 2>&1
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  # Na primeira vez, uma segunda janela confere a instalação enquanto a IA se apresenta.
  [ -f "{{conferencia}}" ] && /bin/bash "{{conferencia}}" --janela >/dev/null 2>&1 &
  exec claude "{{apresentacao}}"
else
  exec claude
fi
