#!/bin/bash
# Abre o Claude. Na primeira vez, pede pra ele se apresentar. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
cd "$HOME"
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  # Na primeira vez, uma segunda janela confere a instalação enquanto a IA se apresenta.
  [ -f "{{conferencia}}" ] && /bin/bash "{{conferencia}}" --janela >/dev/null 2>&1 &
  claude "{{apresentacao}}"
else
  claude
fi
