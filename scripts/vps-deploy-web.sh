#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_URL="${APP_URL:-https://inventory.onegourmetph.com}"
API_CHALLENGE_URL="${API_CHALLENGE_URL:-https://inventory.onegourmetph.com/api/auth/altcha-challenge}"

cd "$ROOT_DIR"

./scripts/build-web-image.sh
./scripts/restart-web-container.sh

printf "\nChecking API challenge endpoint...\n"
curl -fsS "$API_CHALLENGE_URL" >/dev/null
printf "API challenge endpoint responded: %s\n" "$API_CHALLENGE_URL"

printf "\nChecking app endpoint...\n"
curl -fsS "$APP_URL" >/dev/null
printf "App endpoint responded: %s\n" "$APP_URL"
