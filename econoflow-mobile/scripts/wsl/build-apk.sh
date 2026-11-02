#!/usr/bin/env bash
# Builds the debug APK (with the Detox androidTest APK) in the Linux working copy.
#
#   build-apk.sh
#
# Separate from `run-in-wsl.sh build` because that one re-runs `expo prebuild`, which wipes and
# regenerates `android/`. When only JavaScript or a local module's Kotlin changed, this is the
# cheaper, safer path: Gradle keeps its caches and the module is picked up by autolinking.
set -u
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1
LOG=/tmp/build-apk.log

echo "=== building (log: $LOG)"
( cd android && ./gradlew assembleDebug assembleDebugAndroidTest \
    -PreactNativeArchitectures=x86_64 ) > "$LOG" 2>&1
status=$?

echo "=== result: $status"
grep -E 'BUILD SUCCESSFUL|BUILD FAILED|error:|e: ' "$LOG" | head -12

if [ "$status" -ne 0 ]; then
  echo "=== tail"
  tail -25 "$LOG"
  exit "$status"
fi

ls -la android/app/build/outputs/apk/debug/app-debug.apk \
       android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk 2>/dev/null
