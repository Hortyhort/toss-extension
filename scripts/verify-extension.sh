#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
BACKEND_DIR="$ROOT_DIR/apps/backend"
LOG_FILE="$(mktemp -t toss-backend.XXXXXX.log)"

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

is_port_open() {
  if has_cmd lsof; then
    lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  if has_cmd nc; then
    nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1
    return $?
  fi

  if has_cmd curl; then
    curl -s --max-time 1 -o /dev/null "http://127.0.0.1:$PORT/messages"
    return $?
  fi

  return 1
}

backend_pid=""

cleanup() {
  if [[ -n "${backend_pid}" ]] && kill -0 "$backend_pid" >/dev/null 2>&1; then
    kill "$backend_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

if is_port_open; then
  echo "Backend already listening on :$PORT; skipping startup."
else
  echo "Starting backend on :$PORT..."
  pnpm -C "$BACKEND_DIR" dev >"$LOG_FILE" 2>&1 &
  backend_pid=$!

  ready=0
  for _ in {1..20}; do
    if is_port_open; then
      ready=1
      break
    fi
    sleep 1
  done

  if [[ "$ready" -ne 1 ]]; then
    echo "Backend failed to start on :$PORT"
    echo "Log: $LOG_FILE"
    exit 1
  fi
fi

pnpm vitest --config "$ROOT_DIR/apps/extension/vitest.config.ts"
