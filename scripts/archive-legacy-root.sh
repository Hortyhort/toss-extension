#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d)"
DEST="${ROOT_DIR}/legacy_v1/legacy-root-${STAMP}"

FILES=(
  "manifest.json"
  "background.js"
  "overlay.js"
  "options.html"
  "options.js"
  "shared.js"
  "icons"
)

mkdir -p "${DEST}"

for path in "${FILES[@]}"; do
  if [ -e "${ROOT_DIR}/${path}" ]; then
    mv "${ROOT_DIR}/${path}" "${DEST}/"
    echo "Moved ${path} -> ${DEST}"
  fi
done

echo "Legacy root artifacts archived to ${DEST}."
echo "Current extension build lives in apps/extension/build/chrome-mv3-prod."
