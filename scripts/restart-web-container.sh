#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${WEB_CONTAINER_NAME:-og_web}"
IMAGE_NAME="${WEB_IMAGE_NAME:-og_web}"
HOST_PORT="${WEB_HOST_PORT:-3001}"
CONTAINER_PORT="${WEB_CONTAINER_PORT:-3001}"
WEB_NETWORK="${WEB_NETWORK:-og-inventory_default}"
WEB_NETWORK_ALIAS="${WEB_NETWORK_ALIAS:-web}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME"
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "$HOST_PORT:$CONTAINER_PORT" \
  "$IMAGE_NAME"

if docker network inspect "$WEB_NETWORK" >/dev/null 2>&1; then
  docker network connect --alias "$WEB_NETWORK_ALIAS" "$WEB_NETWORK" "$CONTAINER_NAME"
fi

printf "Started %s from %s on port %s:%s\n" \
  "$CONTAINER_NAME" "$IMAGE_NAME" "$HOST_PORT" "$CONTAINER_PORT"
