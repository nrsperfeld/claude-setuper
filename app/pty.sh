#!/bin/bash
# Terminal invisível do app: roda "$@" dentro de um terminal de verdade (o script do macOS), com 200 colunas.
# A entrada do Node é um socket, que o script recusa; o <(cat) entrega um pipe comum no lugar.
/usr/bin/script -q /dev/null /bin/sh -c 'stty cols 200 rows 50 2>/dev/null; exec "$@"' sh "$@" < <(cat)
