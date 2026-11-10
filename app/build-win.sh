#!/bin/bash
# Monta o instalador do Windows a partir do Mac, com o Electron oficial e o NSIS: app/dist/Claude-Setuper-windows-x64.exe
#   bash app/build-win.sh
# Por usuário, sem pedir administrador. O mesmo arquivo fala português e inglês: o instalador segue o idioma do Windows,
# e o app, como no Mac, segue o idioma do sistema e tem a troca de idioma na primeira tela.
# Sem certificado: baixado pelo navegador, o Windows mostra a tela azul do SmartScreen (ver docs/windows-estado.md).
set -euo pipefail
cd "$(dirname "$0")"
ELECTRON=$(node -p "require('./package.json').devDependencies.electron")
VERSAO=$(node -p "require('../package.json').version")
REGISTRO="${NPM_REGISTRY:-https://registry.yarnpkg.com}" # neste Mac o registry.npmjs.org é bloqueado
SAIDA="$PWD/dist/Claude-Setuper-windows-x64.exe"
mkdir -p .cache dist

command -v makensis >/dev/null || HOMEBREW_NO_AUTO_UPDATE=1 brew install makensis

# O zip fica guardado no cache, ao lado dos de Mac, e é conferido com a lista de somas do próprio release.
ZIP=".cache/electron-v$ELECTRON-win32-x64.zip"
if [ ! -f "$ZIP" ]; then
  gh release download "v$ELECTRON" -R electron/electron -p "electron-v$ELECTRON-win32-x64.zip" -D .cache
  T_SOMAS=$(mktemp -d)
  gh release download "v$ELECTRON" -R electron/electron -p SHASUMS256.txt -D "$T_SOMAS"
  ESPERADO=$(grep "electron-v$ELECTRON-win32-x64.zip" "$T_SOMAS/SHASUMS256.txt" | cut -d' ' -f1)
  rm -rf "$T_SOMAS"
  OBTIDO=$(shasum -a 256 "$ZIP" | cut -d' ' -f1)
  [ -n "$ESPERADO" ] && [ "$ESPERADO" = "$OBTIDO" ] || { rm -f "$ZIP"; echo "o zip do Electron não bate com a soma do release" >&2; exit 1; }
fi

# Só pra montar: troca ícone e nome do executável em JavaScript puro, sem Wine.
FERRAMENTAS="$PWD/.cache/ferramentas-win"
if [ ! -d "$FERRAMENTAS/node_modules/resedit" ]; then
  mkdir -p "$FERRAMENTAS"
  (cd "$FERRAMENTAS" && npm install resedit@2.0.3 --no-save --no-audit --no-fund --silent --registry="$REGISTRO")
fi

T=$(mktemp -d "$PWD/.cache/win-XXXXXX")
trap 'rm -rf "$T"' EXIT
APP="$T/app"
mkdir "$APP"
ditto -x -k "$ZIP" "$APP"
mv "$APP/electron.exe" "$APP/Claude Setuper.exe"
R="$APP/resources"
rm -f "$R/default_app.asar"

# O app (telas) e, dentro dele, o Setuper inteiro: os mesmos módulos do instalador de Terminal. O pty.sh é só do Mac.
mkdir -p "$R/app/setuper"
cp main.js preload.cjs ui-app.js terminal.js aula.js setas.js windows.js package.json "$R/app/"
cp -R tela "$R/app/"
cp -R ../src ../templates ../bin ../package.json "$R/app/setuper/"
(cd "$R/app/setuper" && npm install --omit=dev --no-audit --no-fund --silent --registry="$REGISTRO")
find "$APP" -name .DS_Store -delete

# Ícone: os tamanhos pequenos saem do desenho próprio pra tamanho pequeno que já está no .icns do Mac.
iconutil -c iconset icone/icone.icns -o "$T/icone.iconset"
ICO="$T/icone.ico"
sips -z 24 24 "$T/icone.iconset/icon_32x32.png" --out "$T/24.png" >/dev/null
sips -z 48 48 "$T/icone.iconset/icon_32x32@2x.png" --out "$T/48.png" >/dev/null
node win/gerar-ico.mjs "$ICO" "$T/icone.iconset/icon_16x16.png" "$T/24.png" "$T/icone.iconset/icon_32x32.png" "$T/48.png" \
  "$T/icone.iconset/icon_32x32@2x.png" "$T/icone.iconset/icon_128x128.png" "$T/icone.iconset/icon_256x256.png"
node win/marcar-exe.mjs "$FERRAMENTAS" "$APP/Claude Setuper.exe" "$ICO" "$VERSAO"

# O NSIS não instala arquivo com caminho acima de 260 letras. O caminho do usuário soma até uns 90.
MAIOR=$(cd "$APP" && find . -type f | awk '{ if (length($0) > m) m = length($0) } END { print m }')
[ "$MAIOR" -le 160 ] || { echo "caminho comprido demais pro Windows: $MAIOR letras" >&2; exit 1; }

# Grava ao lado e só troca no fim: se o NSIS falhar, o instalador anterior continua lá.
nice -n 10 makensis -V2 -WX -INPUTCHARSET UTF8 "-DORIGEM=$APP" "-DVERSAO=$VERSAO" "-DICONE=$ICO" "-DSAIDA=$T/saida.exe" win/instalador.nsi
mv -f "$T/saida.exe" "$SAIDA"
echo "pronto: app/dist/$(basename "$SAIDA") ($(du -h "$SAIDA" | cut -f1)), $(file -b "$SAIDA")"
