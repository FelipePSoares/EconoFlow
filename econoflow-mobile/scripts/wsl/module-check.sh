#!/usr/bin/env bash
# Is the local `econoflow-log` module visible to Expo autolinking, and does the app build with
# it? Run this before spending a build cycle on the whole app.
#
#   module-check.sh
set -u
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

echo "=== the module's files"
ls modules/econoflow-log 2>/dev/null || echo "MISSING modules/econoflow-log"

echo
echo "=== is it a dependency?"
grep -n 'econoflow-log' package.json

echo
echo "=== autolinking sees it?"
npx expo-modules-autolinking search --platform android 2>/dev/null \
  | grep -i 'econoflow' || echo "(not found by autolinking)"

echo
echo "=== the native module declares the right name"
grep -n 'Name(' modules/econoflow-log/android/src/main/java/expo/modules/econoflowlog/EconoFlowLogModule.kt 2>/dev/null
