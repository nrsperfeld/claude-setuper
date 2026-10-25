#!/bin/bash
# Roda dentro da VM, depois da instalação: confere a primeira semana guiada, o cardápio e o pedido de ajuda.
#   python3 test/mac-vm/vm.py script test/mac-vm/ativacao-teste.sh
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
C="$HOME/.claude"
titulo() { printf '\n[ativação] %s\n' "$*"; }

titulo "configuração da primeira semana"
cat "$C/setuper-ativacao.json" 2>/dev/null | head -20 || echo "NÃO existe"

titulo "hook registrado no settings.json"
grep -c "ativacao.cjs" "$C/settings.json"

titulo "cardápio"
CARD=$(node -p "require('$C/setuper-ativacao.json').cardapio" 2>/dev/null)
[ -f "$CARD" ] && { echo "ok: $CARD"; head -6 "$CARD"; } || echo "NÃO existe: $CARD"

titulo "nota O que pedir do Maestri (tem que ser do perfil)"
cat "$(ls -d "$HOME"/.maestri/workspaces/*/notes 2>/dev/null | head -1)/o-que-pedir.md" 2>/dev/null || echo "sem Maestri"

titulo "CLAUDE.md cita o cardápio"
grep -c "Cardápio do Claude" "$C/CLAUDE.md"

titulo "primeira mensagem (abrir-claude.sh)"
grep -o 'exec claude ".\{0,200\}' "$HOME/Claude Setuper/abrir-claude.sh" | head -1

titulo "hook no dia seguinte: tem que sugerir a missão 1"
AMANHA=$(( ($(date +%s) + 86400) * 1000 ))
echo '{"source":"startup"}' | CLAUDE_SETUPER_AGORA=$AMANHA node "$C/hooks/ativacao.cjs"; echo
echo '{"source":"startup"}' | CLAUDE_SETUPER_AGORA=$AMANHA node "$C/hooks/ativacao.cjs"; echo "(segunda abertura no mesmo dia: nada acima desta linha)"
rm -f "$C/setuper-ativacao-estado.json"

titulo "pedir ajuda pelo Terminal"
# O comando claude-setuper vem do GitHub (versão publicada); aqui vale a cópia que está dentro do app em teste.
APP=$(ls -d "/Applications/Claude Setuper.app" "$HOME/Applications/Claude Setuper.app" 2>/dev/null | head -1)
node "$APP/Contents/Resources/app/setuper/bin/claude-setuper.js" pedir-ajuda </dev/null 2>&1 | tail -2
F="$HOME/Desktop/Claude Setuper - pedido de ajuda.txt"
[ -f "$F" ] && { echo "ok: $(wc -l < "$F") linhas"; grep -ciE "gho_|sk-ant|\"senha\":\"[^[]" "$F" | sed 's/^/segredos encontrados: /'; sed -n 4,7p "$F"; } || echo "NÃO gerou"
