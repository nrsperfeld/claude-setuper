#!/bin/bash
# Gera o .dmg do Claude Setuper a partir do app montado pelo build.sh.
#   bash app/dmg.sh <Claude Setuper.app> <arm64|x64> <pt|en> <pasta-de-saída>
set -euo pipefail
[ $# -eq 4 ] || { echo "uso: bash app/dmg.sh <app> <arm64|x64> <pt|en> <pasta-de-saída>" >&2; exit 2; }
APP="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; ARQ="$2"; IDIOMA="$3"
mkdir -p "$4"; SAIDA="$(cd "$4" && pwd)"
cd "$(dirname "$0")"; AQUI="$(pwd)"
codesign --verify --deep --strict "$APP"
PY=$(bash presente/python.sh)
T=$(mktemp -d "$AQUI/.cache/dmg-XXXXXX")
"$PY" dmg/fundo.py "$IDIOMA" "$T"
[ "$IDIOMA" = en ] && APLICATIVOS=Applications || APLICATIVOS=Aplicativos
DMG="$SAIDA/Claude-Setuper-mac-$ARQ-$IDIOMA.dmg"
[ -e "$DMG" ] && mv "$DMG" "$T/anterior.dmg"
"$PY" -m dmgbuild -s dmg/dmg.py -D app="$APP" -D fundo="$T/fundo.png" -D icone="$APP/Contents/Resources/electron.icns" -D aplicativos="$APLICATIVOS" "Claude Setuper" "$DMG"
hdiutil verify "$DMG" >/dev/null
echo "pronto: $DMG ($(du -h "$DMG" | cut -f1))"
