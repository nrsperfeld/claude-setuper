#!/bin/bash
# Monta o "Claude Setuper.app" (Apple Silicon e Intel) a partir do Electron oficial e gera os zips em app/dist.
#   bash app/build.sh            # os dois
#   bash app/build.sh arm64      # só um
# Sem conta de desenvolvedor da Apple: assinatura ad-hoc (codesign -s -). Baixado pelo Terminal, abre sem aviso.
set -euo pipefail
cd "$(dirname "$0")"
ELECTRON=$(node -p "require('./package.json').devDependencies.electron")
VERSAO=$(node -p "require('../package.json').version")
REGISTRO="${NPM_REGISTRY:-https://registry.yarnpkg.com}" # neste Mac o registry.npmjs.org é bloqueado
mkdir -p .cache dist

for ARQ in "${@:-arm64 x64}"; do
  for A in $ARQ; do
    ZIP=".cache/electron-v$ELECTRON-darwin-$A.zip"
    [ -f "$ZIP" ] || gh release download "v$ELECTRON" -R electron/electron -p "electron-v$ELECTRON-darwin-$A.zip" -D .cache
    T=$(mktemp -d)
    ditto -x -k "$ZIP" "$T"
    APP="$T/Claude Setuper.app"
    mv "$T/Electron.app" "$APP"
    R="$APP/Contents/Resources"
    rm -f "$R/default_app.asar"

    # O app (telas) e, dentro dele, o Setuper inteiro: os mesmos módulos do instalador de Terminal.
    mkdir -p "$R/app/setuper"
    cp main.js preload.cjs ui-app.js terminal.js pty.sh package.json "$R/app/"
    cp -R tela "$R/app/"
    cp -R ../src ../templates ../bin ../package.json "$R/app/setuper/"
    (cd "$R/app/setuper" && npm install --omit=dev --no-audit --no-fund --silent --registry="$REGISTRO")
    chmod +x "$R/app/pty.sh"
    cp icone/icone.icns "$R/electron.icns"

    P="$APP/Contents/Info.plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleName Claude Setuper" "$P"
    /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Claude Setuper" "$P"
    /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier br.com.institutoelos.claudesetuper" "$P"
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSAO" "$P"
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSAO" "$P"

    codesign --force --deep --sign - "$APP"
    codesign --verify --deep --strict "$APP"
    rm -f "dist/Claude-Setuper-mac-$A.zip"
    (cd "$T" && ditto -c -k --keepParent "Claude Setuper.app" "$OLDPWD/dist/Claude-Setuper-mac-$A.zip")
    echo "pronto: app/dist/Claude-Setuper-mac-$A.zip ($(du -h "dist/Claude-Setuper-mac-$A.zip" | cut -f1))"
  done
done
