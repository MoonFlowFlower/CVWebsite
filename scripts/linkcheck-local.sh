#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=".tmp-linkcheck-root"
PORT="4173"
HOST="127.0.0.1"
BASE_PATH="CVWebsite"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi

  rm -rf "$ROOT_DIR"
}

trap cleanup EXIT

if [[ -x "/mnt/c/Program Files/nodejs/node.exe" ]]; then
  export PATH="/mnt/c/Program Files/nodejs:$PATH"
fi

rm -rf "$ROOT_DIR"
mkdir -p "$ROOT_DIR/$BASE_PATH"
cp -a out/. "$ROOT_DIR/$BASE_PATH/"

# Git Bash on Windows only ships `python`; WSL/CI ship `python3`.
PYTHON_BIN="$(command -v python3 || command -v python)"
"$PYTHON_BIN" -m http.server "$PORT" --bind "$HOST" --directory "$ROOT_DIR" >/dev/null 2>&1 &
SERVER_PID=$!

sleep 1

# python's http.server is single-threaded: keep concurrency low or it drops
# connections (reported as status [0]).
npx linkinator "http://$HOST:$PORT/$BASE_PATH/" --recurse --concurrency 4 --skip "https://moonflowflower.github.io/.*"
