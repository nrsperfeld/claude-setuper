#!/bin/bash
# Roda dentro da VM, depois da instalação: confere o sentinela do jeito que ele roda de verdade (pelo launchd).
#   ssh admin@VM 'bash -s' < test/mac-vm/sentinela-teste.sh
S="$HOME/Claude Setuper/sentinela"
U=$(id -u)
ROTULO=com.claude-setuper.manter-atualizado
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
titulo() { printf '\n[sentinela] %s\n' "$*"; }
fins() { local n; n=$(grep -c ' fim$' "$S/registro.log" 2>/dev/null); echo "${n:-0}"; }
# Dispara pelo launchd e espera o "fim" aparecer no registro.
pelo_launchd() {
  local antes; antes=$(fins)
  launchctl kickstart -k "gui/$U/$1"
  for i in $(seq 1 360); do
    [ "$(fins)" -gt "$antes" ] && return 0
    pgrep -x osascript >/dev/null && return 0
    sleep 5
  done
  echo "não terminou em 30 minutos"
}

titulo "agendado no launchd"
launchctl print "gui/$U/$ROTULO" 2>&1 | grep -E 'state|path|program' | head -4

titulo "Vercel antiga de propósito"
npm install -g vercel@41.0.0 --no-audit --no-fund >/dev/null 2>&1
echo "antes: $(vercel --version 2>/dev/null | tail -1)"

titulo "primeira rodada, pelo launchd (como às 13h)"
rm -f "$S/ultima-vez"
pelo_launchd $ROTULO
tail -20 "$S/registro.log"
echo "depois: $(vercel --version 2>/dev/null | tail -1)"
[ -f "$S/ultima-vez" ] && echo "marca da semana: gravada" || echo "marca da semana: NÃO gravada"

titulo "segunda rodada no mesmo dia: não pode fazer nada"
N1=$(wc -l < "$S/registro.log")
bash "$S/manter-atualizado.sh"
N2=$(wc -l < "$S/registro.log")
[ "$N1" = "$N2" ] && echo "ok: saiu sem fazer nada" || echo "ERRO: rodou de novo ($N1 -> $N2 linhas)"

titulo "com o Claude aberto: fica pra amanhã"
rm -f "$S/ultima-vez"
(exec -a claude sleep 120 &)
sleep 1
bash "$S/manter-atualizado.sh"
tail -1 "$S/registro.log"
pkill -f '^claude 120'

titulo "uma ferramenta quebra durante a atualização: tem que avisar"
mkdir -p "$HOME/.local/bin"
printf '#!/bin/sh\nexit 0\n' > "$HOME/.local/bin/quebra"; chmod +x "$HOME/.local/bin/quebra"
T=/tmp/sentinela-teste
mkdir -p $T
sed -e 's/^FERRAMENTAS="/FERRAMENTAS="quebra /' \
    -e 's|^DEPOIS=|chmod -x "$HOME/.local/bin/quebra"; DEPOIS=|' "$S/manter-atualizado.sh" > $T/script.sh
sed -e "s|$ROTULO|$ROTULO.teste|" -e "s|<string>$S/manter-atualizado.sh</string>|<string>$T/script.sh</string><string>--agora</string>|" \
    "$HOME/Library/LaunchAgents/$ROTULO.plist" > $T/teste.plist
grep -c quebra $T/script.sh; grep -c -- '--agora' $T/teste.plist
launchctl bootstrap "gui/$U" $T/teste.plist && echo "tarefa de teste carregada"
pelo_launchd $ROTULO.teste
sleep 3
tail -8 "$S/registro.log"
tail -5 $T/../sentinela-teste.log 2>/dev/null; tail -5 "$S/manter-atualizado.log" 2>/dev/null
pgrep -x osascript >/dev/null && echo "janela de aviso: aberta" || echo "janela de aviso: NÃO apareceu"
screencapture -x /tmp/aviso.png 2>/dev/null
pkill -x osascript
launchctl bootout "gui/$U/$ROTULO.teste" 2>/dev/null
rm -f "$HOME/.local/bin/quebra"
