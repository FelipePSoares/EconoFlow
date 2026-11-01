#!/usr/bin/env bash
# The full cycle for a local native module: sync, build, install, launch, read the trail.
#
#   native-cycle.sh [seconds]
#
# Everything in one place because the parts failed independently all evening: the source not
# syncing, the module not building, the module building but not registering.
set -u
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAIT="${1:-35}"

echo "########## 1. sync"
bash "$HERE/sync.sh" | tail -1

echo "########## 2. Gradle sees the module?"
bash "$HERE/gradle-module-check.sh" 2>/dev/null | sed -n '1,6p'

echo "########## 3. build"
bash "$HERE/build-apk.sh" | grep -E 'BUILD|app-debug|result' | head -5

echo "########## 4. is it in the APK?"
bash "$HERE/apk-module-check.sh" econoflowlog 2>/dev/null | grep -E 'FOUND|NOT FOUND'

echo "########## 5. install + launch, no harness"
adb install -r android/app/build/outputs/apk/debug/app-debug.apk 2>&1 | tail -1
adb reverse tcp:7003 tcp:7003 >/dev/null
adb reverse tcp:8081 tcp:8081 >/dev/null
adb logcat -c
adb shell am force-stop pt.econoflow.mobile
adb shell am start -a android.intent.action.VIEW -d econoflow://e2e/open >/dev/null 2>&1
sleep "$WAIT"

echo "########## 6. did the module register?"
adb logcat -d 2>/dev/null | grep -F 'Expo Modules v2 installed' | tail -1

echo "########## 7. the trail"
adb logcat -d 2>/dev/null | grep -F 'EconoFlowTrace' | head -20
echo "--- count: $(adb logcat -d 2>/dev/null | grep -c 'EconoFlowTrace')"
