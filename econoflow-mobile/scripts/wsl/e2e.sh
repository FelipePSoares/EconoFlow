#!/usr/bin/env bash
# Runs the Detox suite in this distro against the emulator that is already up.
#
#   scripts/wsl/e2e.sh                      # the whole suite
#   scripts/wsl/e2e.sh e2e/auth/02-login.e2e.js   # one spec
#
# What it does before the run, and why:
#   * stops Gradle/Kotlin daemons — a run with those alive starved the emulator of memory;
#   * clears the app's data, so the device starts like a fresh install (the specs create the
#     PIN and the biometric answer they need). The test APK is reinstalled afterwards: a
#     `pm clear` of the app can take the separately-installed instrumentation with it;
#   * re-establishes the `adb reverse` bridges the app depends on (API + Metro);
#   * attaches Detox to the running emulator (`DETOX_CI=1`), since it cannot boot this AVD.
set -uo pipefail
# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}"

[ -f android/local.properties ] || printf 'sdk.dir=%s\n' "$ANDROID_HOME" > android/local.properties
( cd android && ./gradlew --stop >/dev/null 2>&1 )
pkill -f KotlinCompileDaemon >/dev/null 2>&1

adb shell pm clear pt.econoflow.mobile >/dev/null 2>&1
adb install -r -d android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk >/dev/null 2>&1
adb shell settings put system screen_off_timeout 2147483647 >/dev/null 2>&1
adb reverse tcp:7003 tcp:7003 >/dev/null
adb reverse tcp:8081 tcp:8081 >/dev/null

printf 'device: %s\n' "$(adb devices | sed -n '2p')"
printf 'metro:  %s\n' "$(curl -s --max-time 3 http://127.0.0.1:8081/status)"
printf 'api:    %s\n' "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:7003/api/health/live)"

export DETOX_CI=1
export DETOX_CI_ADB="$(adb devices | sed -n '2p' | cut -f1)"
npx detox test -c android.emu.debug --reuse "$@"
