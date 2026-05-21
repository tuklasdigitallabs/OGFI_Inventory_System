#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CMD_EXE="/mnt/c/Windows/System32/cmd.exe"
NPM_CMD="C:\\nvm4w\\nodejs\\npm.cmd"
NPX_CMD="C:\\nvm4w\\nodejs\\npx.cmd"

run_cmd() {
  local label="$1"
  local command="$2"

  printf "\n==> %s\n" "$label"
  "$CMD_EXE" /C "cd /D \"$(wslpath -w "$ROOT_DIR")\" && $command"
}

usage() {
  cat <<'USAGE'
Usage: ./scripts/run-checks.sh [command]

Commands:
  api-build    Build the API
  web-type     Type-check the web app
  web-build    Build the web app
  api-dev      Start the API dev server
  web-dev      Start the web dev server
  all          Run api-build, web-type, and web-build

Default: all
USAGE
}

case "${1:-all}" in
  api-build)
    run_cmd "API build" "\"$NPM_CMD\" run api:build"
    ;;
  web-type)
    run_cmd "Web typecheck" "cd apps\\web && \"$NPX_CMD\" tsc --noEmit"
    ;;
  web-build)
    run_cmd "Web build" "\"$NPM_CMD\" run web:build"
    ;;
  api-dev)
    run_cmd "API dev server" "\"$NPM_CMD\" run api:dev"
    ;;
  web-dev)
    run_cmd "Web dev server" "\"$NPM_CMD\" run web:dev"
    ;;
  all)
    run_cmd "API build" "\"$NPM_CMD\" run api:build"
    run_cmd "Web typecheck" "cd apps\\web && \"$NPX_CMD\" tsc --noEmit"
    run_cmd "Web build" "\"$NPM_CMD\" run web:build"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
