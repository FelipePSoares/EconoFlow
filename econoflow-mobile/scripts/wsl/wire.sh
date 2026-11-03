#!/usr/bin/env bash
# Installs both APKs on the running emulator and re-establishes the bridges the app needs.
#
#   scripts/wsl/wire.sh            # install + reverse + screen timeout + fingerprint
#   scripts/wsl/wire.sh reverse    # only the adb reverse rules (cheap, run before every spec)
#
# The `adb reverse` rules are what makes the app's `http://localhost:7003` the host's:
# without them every request is refused and the Login screen reports bad credentials
# (RUN-E2E.md §0.1). Nothing re-creates them — `adb kill-server`, `adb root`, an emulator
# restart and a `wsl --terminate` all drop them silently.
set -uo pipefail
# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

ADB="$ANDROID_HOME/platform-tools/adb"

reverse() {
  "$ADB" reverse tcp:7003 tcp:7003 >/dev/null 2>&1
  "$ADB" reverse tcp:8081 tcp:8081 >/dev/null 2>&1
  "$ADB" shell settings put system screen_off_timeout 2147483647 >/dev/null 2>&1
  printf 'reverse: %s\n' "$("$ADB" reverse --list 2>/dev/null | tr '\n' ' ')"
}

if [ "${1:-install}" = "reverse" ]; then
  reverse
  exit 0
fi

app=android/app/build/outputs/apk/debug/app-debug.apk
test=android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
[ -f "$app" ] || { echo "missing $app — run the build first" >&2; exit 1; }
[ -f "$test" ] || { echo "missing $test — run the build first" >&2; exit 1; }

"$ADB" install -r -d "$app" || exit 1
"$ADB" install -r -d "$test" || exit 1
printf 'instrumentation: %s\n' "$("$ADB" shell pm list instrumentation | tr -d '\r' | grep Detox || echo NONE)"

reverse
# The finger the biometric spec answers with (e2e/support/biometrics.js).
"$ADB" -e emu finger touch 1 >/dev/null 2>&1
echo wired
