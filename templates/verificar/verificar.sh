#!/bin/bash
# Segunda janela do primeiro dia: confere se ficou tudo instalado e instala o que faltar. Criado pelo Claude Setuper.
#   sem argumento: faz a conferência nesta janela.    --janela: abre uma janela nova do terminal com a conferência.
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
EU="{{conferencia}}"
if [ "$1" = "--janela" ]; then
  # No Mac, abrir o arquivo pelo Terminal não pede a permissão de controlar outro app, que o osascript pediria.
  # O -g deixa a janela atrás: quem fica na frente é a conversa com a IA.
  if [ "$(uname -s)" = "Darwin" ]; then /usr/bin/open -g -a Terminal "$EU"
  else x-terminal-emulator -e /bin/bash "$EU"; fi
  exit 0
fi
# Instalação ainda rodando (o arquivo guarda o número do processo dela): espera terminar, no máximo 10 minutos.
TRAVA="{{trava}}"
N=0
while [ -f "$TRAVA" ] && kill -0 "$(cat "$TRAVA" 2>/dev/null)" 2>/dev/null && [ $N -lt 120 ]; do
  [ $N -eq 0 ] && echo "Esperando a instalação terminar pra conferir tudo. Pode continuar conversando com a IA na outra janela."
  N=$((N + 1))
  sleep 5
done
if command -v node >/dev/null 2>&1 && [ -f "{{setuperBin}}" ]; then
  node "{{setuperBin}}" verificar --segunda-janela{{opcoes}}
else
  echo "Não achei o Claude Setuper pra fazer a conferência. Abre o Claude Setuper de novo que ele confere tudo."
fi
echo
[ "$(uname -s)" = "Darwin" ] || read -r -p "Pode fechar esta janela. " _
