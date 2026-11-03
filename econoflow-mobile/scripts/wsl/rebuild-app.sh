#!/usr/bin/env bash
# Rebuilds the dev stack's application image from the working tree in this repo.
#
# `docker compose build` does not work here: the Dockerfile's restore step needs the private
# Gitea NuGet credentials and Compose does not forward them to the build in this setup. The
# token is read out of `.env` and passed two ways — as the documented BuildKit secret
# (`--secret id=gitea_nuget_token,src=...`) AND as the build arg the Dockerfile also accepts.
#
#   scripts/rebuild-app.sh          # build, then recreate the app container
#   scripts/rebuild-app.sh build    # only build
set -uo pipefail
cd "$HOME/econoflow-repo" || exit 1

# awk rather than `grep '^KEY='`: this file is driven from an agent whose shell layer can
# reshape `^` in an inline pattern, and an empty token is exactly how the build failed
# silently before (the Dockerfile then reports "No Gitea NuGet token").
read_pair() { awk -F= -v k="$1" '$1 == k { sub(/^[^=]*=/, ""); gsub(/\r/, ""); print; exit }' .env; }
token=$(read_pair GITEA_NUGET_TOKEN)
user=$(read_pair GITEA_NUGET_USERNAME)

if [ -z "$token" ]; then
  echo "no GITEA_NUGET_TOKEN in $HOME/econoflow-repo/.env" >&2
  exit 1
fi
printf '%s' "$token" > /tmp/gitea_token
chmod 600 /tmp/gitea_token
echo "token: ${#token} chars, user: ${user:-none}"

# The compose service's image name, so the rebuilt image is the one the stack runs.
image=$(docker compose -f docker-compose.dev.yml config --format json 2>/dev/null \
  | sed -n 's/.*"image": "\([^"]*\)".*/\1/p' | head -n 1)
[ -n "${image:-}" ] || image=econoflow-dev-app

echo "building $image"
DOCKER_BUILDKIT=1 docker build \
  --secret id=gitea_nuget_token,src=/tmp/gitea_token \
  --build-arg GITEA_NUGET_USERNAME="$user" \
  --build-arg GITEA_NUGET_TOKEN="$token" \
  --build-arg RUNTIME_ID=linux-x64 \
  -t "$image" \
  -f Dockerfile . || { echo "build failed" >&2; exit 1; }

[ "${1:-restart}" = "build" ] && exit 0

docker compose -f docker-compose.dev.yml up -d --no-build app
echo "app recreated"
