#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ "${1:-}" == setup ]]; then
  if ! command -v uv >/dev/null; then
    echo "Install uv and make it available on PATH." >&2
    exit 1
  fi
  uv sync --project backend --frozen --extra aws --extra rabbitmq
fi

if [[ ! -x backend/.venv/bin/python ]]; then
  echo "Run ./scripts/dev.sh setup first." >&2
  exit 1
fi
exec backend/.venv/bin/python scripts/dev.py "$@"
