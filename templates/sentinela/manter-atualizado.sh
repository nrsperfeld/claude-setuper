#!/bin/bash
# Manter tudo atualizado. Criado pelo Claude Setuper.
# Roda todo dia às 13h (ou quando o Mac acordar, se estava dormindo), mas só trabalha uma vez por semana
# e nunca com o Claude aberto. Atualiza só o que o Setuper instalou e confere se tudo continua funcionando.
# Só aparece pra pessoa se alguma ferramenta que funcionava parou de funcionar.
#   bash manter-atualizado.sh --agora   # roda já, sem esperar a semana nem conferir se o Claude está aberto
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOMEBREW_NO_ENV_HINTS=1
PASTA="$HOME/Claude Setuper/sentinela"
MARCA="$PASTA/ultima-vez"
mkdir -p "$PASTA"
exec >>"$PASTA/registro.log" 2>&1
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
# O Mac não tem o comando timeout: o perl corta qualquer coisa que travar.
limite() { perl -e 'alarm shift; exec @ARGV or exit 127' "$@"; }

AGORA=0; [ "$1" = "--agora" ] && AGORA=1
if [ $AGORA = 0 ] && [ -f "$MARCA" ] && [ $(( $(date +%s) - $(cat "$MARCA") )) -lt $(( 6 * 24 * 3600 )) ]; then exit 0; fi
# Atualizar o Node com o Claude aberto derruba as ferramentas que ele está usando: fica pra amanhã.
if [ $AGORA = 0 ] && pgrep -f '(^|/)claude( |$)' >/dev/null; then log "o Claude está aberto, fica pra amanhã"; exit 0; fi

FERRAMENTAS="node npm git gh claude vercel"
conferir() {
  for f in $FERRAMENTAS; do
    command -v "$f" >/dev/null 2>&1 || continue
    if limite 60 "$f" --version >/dev/null 2>&1 </dev/null; then echo "$f:ok"; else echo "$f:falhou"; fi
  done
}

log "começando"
ANTES="$(conferir)"
ATUALIZOU=0

if command -v brew >/dev/null 2>&1; then
  if limite 600 brew update --quiet; then
    ATUALIZOU=1
    for f in gh git node; do
      brew list --formula "$f" >/dev/null 2>&1 || continue
      if [ "$f" = node ] && command -v node >/dev/null 2>&1; then
        # Só atualizações dentro da mesma versão grande. Pular de versão grande às vezes quebra conectores.
        ATUAL=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)
        NOVA=$(brew info --json=v2 node | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).formulae[0].versions.stable.split(".")[0]))' 2>/dev/null)
        if [ -n "$NOVA" ] && [ "$ATUAL" != "$NOVA" ]; then log "Node $NOVA é uma versão grande nova; o $ATUAL fica como está"; continue; fi
      fi
      log "conferindo $f"
      limite 1800 brew upgrade --formula "$f" || log "não consegui atualizar $f"
    done
  else
    log "sem internet ou o Homebrew não respondeu; tento amanhã"
  fi
fi

if command -v vercel >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  log "atualizando a Vercel"
  limite 900 npm update -g vercel --no-audit --no-fund || log "não consegui atualizar a Vercel"
fi
if command -v claude >/dev/null 2>&1; then
  log "conferindo o Claude Code"
  limite 300 claude update </dev/null || log "não consegui atualizar o Claude Code"
fi

DEPOIS="$(conferir)"
QUEBROU=""
for linha in $ANTES; do
  f=${linha%%:*}
  [ "${linha#*:}" = ok ] && ! echo "$DEPOIS" | grep -qx "$f:ok" && QUEBROU="$QUEBROU $f"
done

if [ -n "$QUEBROU" ]; then
  log "PAROU DE FUNCIONAR:$QUEBROU"
  if [ -d "/Applications/Claude Setuper.app" ] || [ -d "$HOME/Applications/Claude Setuper.app" ]; then
    R=$(osascript -e 'display dialog "Atualizei as ferramentas do Claude e uma delas parou de funcionar. Abra o Claude Setuper e clique em Só conferir, que ele mostra o que fazer." with title "Claude Setuper" buttons {"Depois", "Abrir o Claude Setuper"} default button 2 with icon caution giving up after 3600' 2>/dev/null)
    case "$R" in *"Abrir o Claude Setuper"*) open -a "Claude Setuper" ;; esac
  else
    osascript -e 'display dialog "Atualizei as ferramentas do Claude e uma delas parou de funcionar. Abra o Terminal e digite claude-setuper doctor, ou peça ajuda a quem instalou o Claude pra você." with title "Claude Setuper" buttons {"Entendi"} default button 1 with icon caution giving up after 3600' >/dev/null 2>&1
  fi
else
  log "tudo funcionando"
fi
# Sem internet não conta como feito: tenta de novo amanhã.
[ $ATUALIZOU = 1 ] && date +%s > "$MARCA"
log "fim"
