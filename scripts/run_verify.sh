#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

npm run lint
npm run typecheck
npm run build
npm run verify:static

if [[ "${RUN_LINK_CHECK:-0}" == "1" ]]; then
  npm run verify:links
fi

if [[ "${RUN_PLAYWRIGHT:-0}" == "1" ]]; then
  npm run validate:playwright
fi
