#!/usr/bin/env bash
#
# Runs one stage of the Android build / Detox suite inside WSL2, so the native build happens
# where the Windows 260-character path limit does not exist (see ../setup.md).
#
#   ./scripts/wsl/run-in-wsl.sh sync   # copy the checkout + node_modules into ~/econoflow
#   ./scripts/wsl/run-in-wsl.sh build  # prebuild, apply the Detox wiring, assemble both APKs
#   ./scripts/wsl/run-in-wsl.sh test   # install the APKs and run the Detox suite (Metro needed)
#
# The build happens in a **Linux copy** (`~/econoflow`), never on the `/mnt/d` mount: gradle
# and CMake are far slower on that filesystem, and the checkout is a working tree that
# should stay where the editor is. Windows stays the working tree — this copies what is there.
#
# The emulator runs on Windows (there is no nested Android emulator in this machine), and
# `adb` in WSL reaches it through the Windows adb server (Docker Desktop forwards the
# loopback port between the two).
set -euo pipefail

REPO_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"   # …/econoflow-mobile, Windows side
WORK_DIR="${WORK_DIR:-$HOME/econoflow}"

# shellcheck source=/dev/null
[ -f "$HOME/.android-hosts.env" ] && . "$HOME/.android-hosts.env"

say() { printf '\n==> %s\n' "$*"; }

adb_connect() {
  # `adb` is the SDK's, and the server it starts talks to the one Windows already runs.
  adb start-server >/dev/null 2>&1 || true
  adb wait-for-device
  printf 'device: %s\n' "$(adb devices | sed -n '2p')"
}

sync_checkout() {
  say "Syncing the checkout into $WORK_DIR"
  mkdir -p "$WORK_DIR"
  rsync -a --delete \
    --exclude node_modules \
    --exclude android \
    --exclude .git \
    --exclude e2e/artifacts \
    "$REPO_SRC/" "$WORK_DIR/"

  say "Syncing node_modules (Linux copies of the native prebuilds)"
  mkdir -p "$WORK_DIR/node_modules"
  rsync -a --delete "$REPO_SRC/node_modules/" "$WORK_DIR/node_modules/"
}

build_apks() {
  cd "$WORK_DIR"
  say "expo prebuild"
  npx expo prebuild -p android --no-install
  say "Detox wiring"
  node scripts/apply-detox-android.js
  say "assembleDebug + assembleDebugAndroidTest (x86_64)"
  ( cd android && ./gradlew assembleDebug assembleDebugAndroidTest -PreactNativeArchitectures=x86_64 )
  say "APKs"
  ls -la android/app/build/outputs/apk/debug/app-debug.apk \
         android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
}

detox_test() {
  cd "$WORK_DIR"
  adb_connect
  # The stack is on the Windows side: its 7003 is what `adb reverse` publishes into the
  # device, and Metro (started on Windows) is the 8081 the debug JS bundle is loaded from.
  adb reverse tcp:7003 tcp:7003 >/dev/null
  adb reverse tcp:8081 tcp:8081 >/dev/null
  say "Detox: $*"
  DETOX_CI=1 DETOX_CI_ADB="${DETOX_CI_ADB:-$(adb devices | sed -n '2p' | cut -f1)}" \
    npx detox test -c android.emu.debug --reuse "$@"
}

case "${1:-}" in
  sync)  sync_checkout ;;
  build) build_apks ;;
  test)  shift; detox_test "$@" ;;
  *)     echo "usage: $0 {sync|build|test [detox args...]}" >&2; exit 2 ;;
esac
