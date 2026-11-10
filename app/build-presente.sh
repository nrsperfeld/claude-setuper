#!/bin/bash
# Monta o "Segundo Cérebro.app" (Apple Silicon) de uma pessoa: o Claude Setuper com a pasta presente/ dentro.
#   bash app/build-presente.sh <pasta-presente> <pasta-de-saída>
# A pasta presente tem presente.json, cofre/ e, de preferência, signo.png (senão usa a variável SIGNO).
# Sai em <pasta-de-saída>/Segundo Cérebro.app, com ícone próprio, bundle id com.elos.segundocerebro.<pessoa>
# e assinatura ad-hoc. Depois, o .dmg sai com app/dmg-presente.sh.
set -euo pipefail
[ $# -eq 2 ] || { echo "uso: bash app/build-presente.sh <pasta-presente> <pasta-de-saída>" >&2; exit 2; }
PRESENTE="$(cd "$1" && pwd)"
mkdir -p "$2"; SAIDA="$(cd "$2" && pwd)"
cd "$(dirname "$0")"
AQUI="$(pwd)"

IFS=$'\t' read -r PESSOA NOME ROTULO SIGNO_PRESENTE < <(node presente/info.mjs "$PRESENTE")
SIGNO="${SIGNO_PRESENTE:-${SIGNO:-}}"
[ -n "$SIGNO" ] && [ -f "$SIGNO" ] || { echo "Falta o signo: ponha signo.png na pasta presente ou rode com SIGNO=<arquivo.png>" >&2; exit 1; }

ELECTRON=$(node -p "require('./package.json').devDependencies.electron")
VERSAO=$(node -p "require('../package.json').version")
REGISTRO="${NPM_REGISTRY:-https://registry.yarnpkg.com}" # neste Mac o registry.npmjs.org é bloqueado
NOME_APP="Segundo Cérebro"
mkdir -p .cache/presente
ZIP=".cache/electron-v$ELECTRON-darwin-arm64.zip"
[ -f "$ZIP" ] || gh release download "v$ELECTRON" -R electron/electron -p "electron-v$ELECTRON-darwin-arm64.zip" -D .cache

T=$(mktemp -d "$AQUI/.cache/presente/montagem-XXXXXX")
ditto -x -k "$ZIP" "$T"
APP="$T/$NOME_APP.app"
mv "$T/Electron.app" "$APP"
R="$APP/Contents/Resources"
rm -f "$R/default_app.asar"

# As telas e, dentro delas, o Setuper inteiro (os mesmos módulos do instalador de Terminal).
mkdir -p "$R/app/setuper"
cp main.js preload.cjs ui-app.js terminal.js aula.js setas.js windows.js pty.sh "$R/app/"
cp -R tela "$R/app/"
node -e "const p=require('./package.json'); p.productName='$NOME_APP'; p.name='segundo-cerebro'; require('fs').writeFileSync('$R/app/package.json', JSON.stringify(p,null,2)+'\n')"
cp -R ../src ../templates ../bin ../package.json "$R/app/setuper/"
(cd "$R/app/setuper" && npm install --omit=dev --no-audit --no-fund --silent --registry="$REGISTRO")
chmod +x "$R/app/pty.sh"

# O presente: presente.json, cofre/ e o signo, sem lixo de sistema nem o histórico de quem montou.
rsync -a --exclude .DS_Store --exclude .git --exclude '._*' "$PRESENTE/" "$R/presente/"
[ -f "$R/presente/signo.png" ] || [ -f "$R/presente/signo.svg" ] || cp "$SIGNO" "$R/presente/signo.png"

# Ícone: o signo em cobre sobre o quadrado escuro, gerado na hora em todos os tamanhos.
PY=$(bash presente/python.sh)
"$PY" presente/icone.py "$SIGNO" "$R/electron.icns"

P="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName $NOME_APP" "$P"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName $NOME_APP" "$P"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.elos.segundocerebro.$PESSOA" "$P"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSAO" "$P"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSAO" "$P"
/usr/libexec/PlistBuddy -c "Add :LSApplicationCategoryType string public.app-category.productivity" "$P" 2>/dev/null || true

xattr -cr "$APP"
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP"

# Troca o app anterior (se tiver) pelo novo; o antigo vai pra uma pasta ao lado, nunca é sobrescrito no meio.
DEST="$SAIDA/$NOME_APP.app"
if [ -e "$DEST" ]; then mv "$DEST" "$T/anterior.app"; fi
mv "$APP" "$DEST"
rm -rf "$T" 2>/dev/null || echo "aviso: sobrou a pasta de montagem $T (pode apagar)" >&2
echo "pronto: $DEST ($ROTULO, com.elos.segundocerebro.$PESSOA, $(du -sh "$DEST" | cut -f1))"
