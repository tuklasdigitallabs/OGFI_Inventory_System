#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VPS_HOST="${VPS_HOST:?Set VPS_HOST, for example VPS_HOST=your.server.ip}"
VPS_USER="${VPS_USER:-root}"
VPS_PATH="${VPS_PATH:-/opt/og-inventory}"
SSH_TARGET="$VPS_USER@$VPS_HOST"

ssh "$SSH_TARGET" "mkdir -p '$VPS_PATH/apps/web' '$VPS_PATH/scripts'"

rsync -av "$ROOT_DIR/apps/web/Dockerfile" "$SSH_TARGET:$VPS_PATH/apps/web/Dockerfile"
rsync -av \
  "$ROOT_DIR/scripts/build-web-image.sh" \
  "$ROOT_DIR/scripts/restart-web-container.sh" \
  "$ROOT_DIR/scripts/vps-deploy-web.sh" \
  "$SSH_TARGET:$VPS_PATH/scripts/"

ssh "$SSH_TARGET" "cd '$VPS_PATH' && chmod +x scripts/*.sh && ./scripts/vps-deploy-web.sh"
