#!/bin/bash
# Keep everything up to date. Created by Claude Setuper.
# Runs every day at 1 PM (or when the Mac wakes up, if it was asleep), but only does its work once a week
# and never with the AI open. It only updates what Setuper installed and checks that everything still works.
# It only shows up for the person if a tool that was working stopped working.
#   bash manter-atualizado.sh --agora   # runs right now, without waiting for the week or checking whether the AI is open
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export HOMEBREW_NO_ENV_HINTS=1
PASTA="$HOME/Claude Setuper/sentinela"
MARCA="$PASTA/ultima-vez"
mkdir -p "$PASTA"
exec >>"$PASTA/registro.log" 2>&1
log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
# The Mac doesn't have the timeout command: perl cuts off anything that hangs.
limite() { perl -e 'alarm shift; exec @ARGV or exit 127' "$@"; }

AGORA=0; [ "$1" = "--agora" ] && AGORA=1
if [ $AGORA = 0 ] && [ -f "$MARCA" ] && [ $(( $(date +%s) - $(cat "$MARCA") )) -lt $(( 6 * 24 * 3600 )) ]; then exit 0; fi
# Updating Node while the AI is open takes down the tools it is using: it waits until tomorrow.
if [ $AGORA = 0 ] && pgrep -f '(^|/)claude( |$)' >/dev/null; then log "The AI is open, leaving it for tomorrow"; exit 0; fi

FERRAMENTAS="node npm git gh claude vercel"
conferir() {
  for f in $FERRAMENTAS; do
    command -v "$f" >/dev/null 2>&1 || continue
    if limite 60 "$f" --version >/dev/null 2>&1 </dev/null; then echo "$f:ok"; else echo "$f:failed"; fi
  done
}

log "starting"
ANTES="$(conferir)"
ATUALIZOU=0

if command -v brew >/dev/null 2>&1; then
  if limite 600 brew update --quiet; then
    ATUALIZOU=1
    for f in gh git node; do
      brew list --formula "$f" >/dev/null 2>&1 || continue
      if [ "$f" = node ] && command -v node >/dev/null 2>&1; then
        # Only updates within the same major version. Jumping major versions sometimes breaks connectors.
        ATUAL=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)
        NOVA=$(brew info --json=v2 node | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).formulae[0].versions.stable.split(".")[0]))' 2>/dev/null)
        if [ -n "$NOVA" ] && [ "$ATUAL" != "$NOVA" ]; then log "Node $NOVA is a new major version; $ATUAL stays as it is"; continue; fi
      fi
      log "checking $f"
      limite 1800 brew upgrade --formula "$f" || log "couldn't update $f"
    done
  else
    log "no internet or Homebrew didn't respond; I'll try tomorrow"
  fi
fi

if command -v vercel >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
  log "updating Vercel"
  limite 900 npm update -g vercel --no-audit --no-fund || log "couldn't update Vercel"
fi
if command -v claude >/dev/null 2>&1; then
  log "checking Claude Code"
  limite 300 claude update </dev/null || log "couldn't update Claude Code"
fi

DEPOIS="$(conferir)"
QUEBROU=""
for linha in $ANTES; do
  f=${linha%%:*}
  [ "${linha#*:}" = ok ] && ! echo "$DEPOIS" | grep -qx "$f:ok" && QUEBROU="$QUEBROU $f"
done

if [ -n "$QUEBROU" ]; then
  log "STOPPED WORKING:$QUEBROU"
  if [ -d "/Applications/Claude Setuper.app" ] || [ -d "$HOME/Applications/Claude Setuper.app" ]; then
    R=$(osascript -e 'display dialog "I updated the tools the AI uses and one of them stopped working. Open Claude Setuper and click Just Check, and it will show you what to do." with title "Claude Setuper" buttons {"Later", "Open Claude Setuper"} default button 2 with icon caution giving up after 3600' 2>/dev/null)
    case "$R" in *"Open Claude Setuper"*) open -a "Claude Setuper" ;; esac
  else
    osascript -e 'display dialog "I updated the tools the AI uses and one of them stopped working. Open Terminal and type claude-setuper doctor, or ask whoever installed the AI for you to help." with title "Claude Setuper" buttons {"Got It"} default button 1 with icon caution giving up after 3600' >/dev/null 2>&1
  fi
else
  log "everything working"
fi
# No internet doesn't count as done: it tries again tomorrow.
[ $ATUALIZOU = 1 ] && date +%s > "$MARCA"
log "end"
