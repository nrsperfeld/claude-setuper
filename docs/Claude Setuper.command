#!/bin/bash
# Dois cliques neste arquivo abrem o Terminal e iniciam o Claude Setuper.
# No macOS 15 e mais novos, o Mac bloqueia este arquivo se ele veio do navegador.
# O caminho principal agora é a linha do Terminal, na página do Setuper.
clear
echo
echo "  Claude Setuper"
echo "  Vou começar a instalação. Não feche esta janela."
echo
sleep 1
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/nrsperfeld/claude-setuper/main/install.sh)"
echo
echo "  Pode fechar esta janela."
