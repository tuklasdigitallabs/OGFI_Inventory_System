#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_URL="${NEXT_PUBLIC_API_URL:-https://inventory.onegourmetph.com/api}"
IMAGE_NAME="${WEB_IMAGE_NAME:-og_web}"

docker build \
  -f "$ROOT_DIR/apps/web/Dockerfile" \
  --build-arg "NEXT_PUBLIC_API_URL=$API_URL" \
  -t "$IMAGE_NAME" \
  "$ROOT_DIR"

printf "Built %s with NEXT_PUBLIC_API_URL=%s\n" "$IMAGE_NAME" "$API_URL"
