#!/bin/bash
# Devolve o python com Pillow e dmgbuild (ambiente próprio em app/.cache/venv-presente, criado na primeira vez).
# Neste Mac o PyPI às vezes falha: tenta o espelho com PIP_INDEX_ALTERNATIVO.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
V="$AQUI/.cache/venv-presente"
if ! "$V/bin/python" -c "import PIL, dmgbuild" 2>/dev/null; then
  mkdir -p "$AQUI/.cache"
  PY=$(command -v python3.13 || command -v python3)
  "$PY" -m venv "$V" >&2
  "$V/bin/pip" install -q --disable-pip-version-check Pillow dmgbuild >&2 \
    || "$V/bin/pip" install -q --disable-pip-version-check --index-url "${PIP_INDEX_ALTERNATIVO:-https://pypi.tuna.tsinghua.edu.cn/simple}" Pillow dmgbuild >&2
fi
echo "$V/bin/python"
