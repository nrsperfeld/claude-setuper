#!/bin/bash
# Gera "Segundo Cérebro do <Nome>.dmg" a partir do app montado pelo build-presente.sh.
#   bash app/dmg-presente.sh "<pasta>/Segundo Cérebro.app" <pasta-de-saída>
# Volume com o mesmo nome e o ícone do app, janela escura de 720x480 com o app à esquerda, Aplicativos à direita,
# a seta em cobre entre eles e, embaixo, o desenho de como abrir na primeira vez. Sem Finder ao vivo (dmgbuild).
set -euo pipefail
[ $# -eq 2 ] || { echo "uso: bash app/dmg-presente.sh <Segundo Cérebro.app> <pasta-de-saída>" >&2; exit 2; }
APP="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
mkdir -p "$2"; SAIDA="$(cd "$2" && pwd)"
cd "$(dirname "$0")"
AQUI="$(pwd)"
[ -f "$APP/Contents/Resources/presente/presente.json" ] || { echo "Esse app não tem presente dentro: $APP" >&2; exit 1; }
codesign --verify --deep --strict "$APP"

IFS=$'\t' read -r PESSOA NOME ROTULO SIGNO < <(node presente/info.mjs "$APP/Contents/Resources/presente")
PY=$(bash presente/python.sh)
T=$(mktemp -d "$AQUI/.cache/presente/dmg-XXXXXX")
"$PY" presente/fundo.py "$SIGNO" "$ROTULO" "$T"

DMG="$SAIDA/$ROTULO.dmg"
[ -e "$DMG" ] && mv "$DMG" "$T/anterior.dmg"
"$PY" -m dmgbuild -s presente/dmg.py -D app="$APP" -D fundo="$T/fundo.png" -D icone="$APP/Contents/Resources/electron.icns" "$ROTULO" "$DMG"
hdiutil verify "$DMG" >/dev/null
rm -rf "$T" 2>/dev/null || echo "aviso: sobrou a pasta $T (pode apagar)" >&2
echo "pronto: $DMG ($(du -h "$DMG" | cut -f1))"
