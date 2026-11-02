#!/usr/bin/env bash
# The API stack (Postgres + MinIO + the app) inside this WSL distro — no Windows, no Docker
# Desktop. The stack is the untouched docker-compose.dev.yml of the repository copy.
#
#   scripts/wsl/stack.sh up      # build and start, wait until the API answers
#   scripts/wsl/stack.sh logs    # follow the app's log
#   scripts/wsl/stack.sh down    # stop, keep the data
#   scripts/wsl/stack.sh reset   # stop and drop the data (a fresh seeded database)
set -euo pipefail

REPO="${REPO:-$HOME/econoflow-repo}"
COMPOSE=(-f docker-compose.dev.yml)
cd "$REPO"

case "${1:-up}" in
  up)
    docker compose "${COMPOSE[@]}" up --build -d
    echo "waiting for the API on localhost:7003..."
    for _ in $(seq 1 120); do
      if curl -fsS --max-time 2 http://localhost:7003/api/health/live >/dev/null 2>&1; then
        echo "API is up"
        docker compose "${COMPOSE[@]}" ps
        exit 0
      fi
      sleep 5
    done
    echo "API did not answer in time; last log lines:" >&2
    docker compose "${COMPOSE[@]}" logs --tail 40 app >&2
    exit 1
    ;;
  logs)  docker compose "${COMPOSE[@]}" logs -f app ;;
  down)  docker compose "${COMPOSE[@]}" down ;;
  reset) docker compose "${COMPOSE[@]}" down -v ;;
  ps)    docker compose "${COMPOSE[@]}" ps ;;
  *)     echo "usage: $0 {up|logs|down|reset|ps}" >&2; exit 2 ;;
esac
