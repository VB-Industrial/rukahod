#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
if [[ ! -f "${REPO_ROOT}/ui/dist/index.html" ]]; then
  printf 'Сначала соберите UI: cd %s/ui && npm run build\n' "${REPO_ROOT}" >&2
  exit 1
fi

exec python3 -m http.server "${RUKAHOD_HTTP_PORT:-4175}" \
  --bind "${RUKAHOD_HTTP_HOST:-0.0.0.0}" \
  --directory "${REPO_ROOT}/ui/dist"
