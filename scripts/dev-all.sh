#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PYTHON="python3"
if [ -x ".venv/bin/python" ]; then
  PYTHON=".venv/bin/python"
fi

SEARXNG_URL_DEFAULT="http://34.44.216.89:8080"
VITE_SCRAPER_URL_DEFAULT="http://127.0.0.1:8787"

export SEARXNG_URL="${SEARXNG_URL:-$SEARXNG_URL_DEFAULT}"
export VITE_SCRAPER_URL="${VITE_SCRAPER_URL:-$VITE_SCRAPER_URL_DEFAULT}"

if ! "$PYTHON" - <<'PY' >/dev/null 2>&1
import importlib.util
raise SystemExit(0 if importlib.util.find_spec("uvicorn") else 1)
PY
then
  echo "uvicorn is not installed for $PYTHON."
  echo "Run: $PYTHON -m pip install -r server/requirements.txt"
  exit 1
fi

# Start backend
echo "Using SEARXNG_URL=$SEARXNG_URL"
echo "Using VITE_SCRAPER_URL=$VITE_SCRAPER_URL"

"$PYTHON" -m uvicorn server.app:app --reload --host 0.0.0.0 --port 8787 &
backend_pid=$!

# Ensure we clean up child processes on exit
cleanup() {
  kill "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT

# Start frontend (blocks)
npm run dev
