#!/bin/bash
# Dois cliques neste arquivo abrem o Terminal e iniciam o Claude Setuper.
# Se o Mac disser que "não pode abrir porque é de um desenvolvedor não identificado":
# clique com o botão direito no arquivo → Abrir → Abrir.
clear
echo
echo "  Claude Setuper"
echo "  Vou começar a instalação. Não feche esta janela."
echo
sleep 1
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/{{REPO}}/main/install.sh)"
echo
echo "  Pode fechar esta janela."
