#!/bin/bash
# Claude Setuper — instalador de uma linha.
#   curl -fsSL https://raw.githubusercontent.com/{{REPO}}/main/install.sh | bash
# Garante o mínimo (Xcode CLT, Homebrew, Node), baixa o Setuper e entrega pro wizard em português.
set -e

REPO="${CLAUDE_SETUPER_REPO:-{{REPO}}}"
DEST="$HOME/Claude Setuper/app"

bold()  { printf '\033[1m%s\033[0m\n' "$1"; }
passo() { printf '\n\033[36m▸\033[0m %s\n' "$1"; }
ok()    { printf '\033[32m✓\033[0m %s\n' "$1"; }

clear 2>/dev/null || true
bold "Claude Setuper"
echo "Vou preparar o seu computador. Leva alguns minutos e eu aviso sempre que precisar de você."

SO="$(uname -s)"
if [ "$SO" != "Darwin" ] && [ "$SO" != "Linux" ]; then
  echo "Por enquanto o Claude Setuper funciona no Mac e no Linux."; exit 1
fi

if [ "$SO" = "Darwin" ]; then
  if ! xcode-select -p >/dev/null 2>&1; then
    passo "O Mac vai abrir uma janela pedindo pra instalar as \"ferramentas de linha de comando\"."
    echo "  Clica em Instalar, aceita o contrato e espera terminar (3 a 10 minutos). Eu fico aqui."
    xcode-select --install >/dev/null 2>&1 || true
    until xcode-select -p >/dev/null 2>&1; do sleep 5; done
    ok "Ferramentas da Apple instaladas"
  fi

  if ! command -v brew >/dev/null 2>&1 && [ ! -x /opt/homebrew/bin/brew ] && [ ! -x /usr/local/bin/brew ]; then
    passo "Agora o Homebrew, que instala programas pelo Terminal."
    echo "  O Mac vai pedir a sua senha (a mesma de ligar o computador). Ela não aparece enquanto você digita."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  for b in /opt/homebrew/bin /usr/local/bin; do [ -x "$b/brew" ] && eval "$($b/brew shellenv)"; done
  ok "Homebrew pronto"

  if ! command -v node >/dev/null 2>&1; then
    passo "Instalando o Node (uns 2 minutos, é normal)."
    brew install node >/dev/null
  fi
  if ! command -v git >/dev/null 2>&1; then brew install git >/dev/null; fi
else
  if ! command -v node >/dev/null 2>&1; then
    passo "Instalando o Node."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - >/dev/null
    sudo apt-get install -y nodejs >/dev/null
  fi
  if ! command -v git >/dev/null 2>&1; then sudo apt-get install -y git >/dev/null; fi
fi
ok "Node $(node -v) pronto"

passo "Baixando o Claude Setuper."
mkdir -p "$(dirname "$DEST")"
if [ -d "$DEST/.git" ]; then
  git -C "$DEST" pull -q --ff-only || true
else
  rm -rf "$DEST"
  git clone -q --depth 1 "https://github.com/$REPO.git" "$DEST"
fi
(cd "$DEST" && npm install --silent --no-audit --no-fund >/dev/null 2>&1)
npm link --silent >/dev/null 2>&1 || ln -sf "$DEST/bin/claude-setuper.js" "$(npm prefix -g)/bin/claude-setuper" 2>/dev/null || true
ok "Claude Setuper baixado"

exec node "$DEST/bin/claude-setuper.js" "$@" < /dev/tty
