#!/bin/bash
# Gera app/icone/icone.icns a partir de icone.html, fotografado pelo Chrome sem janela e com perfil descartável.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
T=$(mktemp -d)
foto() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check --user-data-dir="$T/perfil" --default-background-color=00000000 --force-device-scale-factor=1 --window-size=1024,1024 --screenshot="$2" "file://$PWD/icone.html$1" >/dev/null 2>&1; }
foto '' "$T/grande.png"
foto '?mini=1' "$T/mini.png"
S="$T/icone.iconset"; mkdir "$S"
gera() { sips -z "$2" "$2" "$1" --out "$S/$3" >/dev/null; }
gera "$T/mini.png" 16 icon_16x16.png; gera "$T/mini.png" 32 icon_16x16@2x.png; gera "$T/mini.png" 32 icon_32x32.png; gera "$T/mini.png" 64 icon_32x32@2x.png
gera "$T/grande.png" 128 icon_128x128.png; gera "$T/grande.png" 256 icon_128x128@2x.png; gera "$T/grande.png" 256 icon_256x256.png; gera "$T/grande.png" 512 icon_256x256@2x.png; gera "$T/grande.png" 512 icon_512x512.png; gera "$T/grande.png" 1024 icon_512x512@2x.png
iconutil -c icns "$S" -o icone.icns
cp "$T/grande.png" icone-1024.png
rm -rf "$T" 2>/dev/null || true
echo "pronto: app/icone/icone.icns"
