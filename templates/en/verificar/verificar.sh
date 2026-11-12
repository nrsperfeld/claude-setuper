#!/bin/bash
# Second window on day one: checks that everything is installed and installs whatever is missing. Created by Claude Setuper.
#   no argument: runs the check in this window.    --janela: opens a new terminal window with the check.
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
EU="{{conferencia}}"
if [ "$1" = "--janela" ]; then
  # On a Mac, opening the file with Terminal doesn't ask for permission to control another app, which osascript would.
  # The -g keeps the window behind: the conversation with the AI stays in front.
  if [ "$(uname -s)" = "Darwin" ]; then /usr/bin/open -g -a Terminal "$EU"
  else x-terminal-emulator -e /bin/bash "$EU"; fi
  exit 0
fi
# Installation still running (the file holds its process number): wait for it to finish, 10 minutes at most.
TRAVA="{{trava}}"
N=0
while [ -f "$TRAVA" ] && kill -0 "$(cat "$TRAVA" 2>/dev/null)" 2>/dev/null && [ $N -lt 120 ]; do
  [ $N -eq 0 ] && echo "Waiting for the installation to finish before checking everything. You can keep talking to the AI in the other window."
  N=$((N + 1))
  sleep 5
done
if command -v node >/dev/null 2>&1 && [ -f "{{setuperBin}}" ]; then
  node "{{setuperBin}}" verificar --segunda-janela{{opcoes}}
else
  echo "I couldn't find Claude Setuper to run the check. Open Claude Setuper again and it will check everything."
fi
echo
[ "$(uname -s)" = "Darwin" ] || read -r -p "You can close this window. " _
