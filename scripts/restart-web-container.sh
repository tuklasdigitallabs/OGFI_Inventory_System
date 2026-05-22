#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${WEB_CONTAINER_NAME:-og_web}"
IMAGE_NAME="${WEB_IMAGE_NAME:-og_web}"
HOST_PORT="${WEB_HOST_PORT:-3001}"
CONTAINER_PORT="${WEB_CONTAINER_PORT:-3001}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  docker rm -f "$CONTAINER_NAME"
fi

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "$HOST_PORT:$CONTAINER_PORT" \
  "$IMAGE_NAME"

printf "Started %s from %s on port %s:%s\n" \
  "$CONTAINER_NAME" "$IMAGE_NAME" "$HOST_PORT" "$CONTAINER_PORT"
