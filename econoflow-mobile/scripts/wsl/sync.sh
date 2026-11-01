#!/usr/bin/env bash
# Copies the Windows working tree into the Linux working copy (`~/econoflow`) the Detox run
# uses. Fast on purpose: node_modules and the generated Android project are never re-copied —
# only the source, the specs, the scripts and the local modules move.
set -euo pipefail
SRC="${SRC:-/mnt/d/Sources/EconoFlow/econoflow-mobile}"
DST="${DST:-$HOME/econoflow}"

mkdir -p "$DST/e2e/artifacts"

# `/android` is anchored on purpose. A bare `--exclude android` matches *every* directory by
# that name, which silently dropped `modules/econoflow-log/android` — so a local native module
# never reached the build, and the app kept running without it (#1116).
rsync -a --delete \
  --exclude /node_modules --exclude /android --exclude /.git \
  --exclude '/e2e/artifacts' --exclude /.expo --exclude '*.log' \
  "$SRC/" "$DST/"

if [ ! -d "$DST/node_modules" ]; then
  echo "copying node_modules (first run only, ~10 min)"
  rsync -a "$SRC/node_modules/" "$DST/node_modules/"
fi

# `file:` dependencies are symlinked by npm; re-point them at the freshly synced copy, or
# Metro and Gradle keep reading the Windows path (which does not exist under Linux).
for local_module in "$DST"/node_modules/econoflow-*; do
  [ -e "$local_module" ] || continue
  name="$(basename "$local_module")"
  if [ -d "$DST/modules/$name" ]; then
    ln -sfn "$DST/modules/$name" "$DST/node_modules/$name"
  fi
done

if [ ! -f "$DST/.env.local" ] || ! grep -q 'EXPO_PUBLIC_API_URL=http://localhost:7003' "$DST/.env.local"; then
  printf 'EXPO_PUBLIC_API_URL=http://localhost:7003\n' > "$DST/.env.local"
fi
echo "synced -> $DST"
ls "$DST/e2e/auth"
