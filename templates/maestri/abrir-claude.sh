#!/bin/bash
# Abre o Claude. Na primeira vez, pede pra ele se apresentar. Criado pelo Claude Setuper.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
MARCADOR="{{marcador}}"
if [ ! -f "$MARCADOR" ]; then
  touch "$MARCADOR"
  exec claude "Oi! Eu sou {{nome}}. Acabei de instalar você com o Claude Setuper. Se apresenta pra mim em poucas linhas, em português simples e sem termos técnicos: quem você é, o que você consegue fazer por alguém que trabalha com isto: '{{trabalho}}', e como o meu segundo cérebro (as notas no Obsidian) funciona entre a gente. No fim, me propõe uma tarefa pequena e útil pra gente fazer agora em um minuto, relacionada ao meu trabalho."
else
  exec claude
fi
