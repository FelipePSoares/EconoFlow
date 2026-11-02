#!/usr/bin/env bash
# Is the local Expo module part of the Gradle build at all?
#
#   gradle-module-check.sh
#
# `npx expo-modules-autolinking search` finding a package proves only that its *JavaScript* is
# resolvable. For the native code to be compiled, `expoAutolinking.useExpoModules()` in
# `settings.gradle` has to have included the module as a Gradle project — and that is what this
# asks. The `android` directory inside a local module must also be laid out as a Gradle module.
set -u
. "$HOME/.android-hosts.env"
cd "${WORK_DIR:-$HOME/econoflow}" || exit 1

echo "=== Gradle projects matching econoflow"
( cd android && ./gradlew projects 2>/dev/null ) \
  | grep -i 'econoflow' | head -5 || echo "(none)"

echo
echo "=== the module's android layout"
ls modules/econoflow-log/android 2>/dev/null || echo "MISSING android/"

echo
echo "=== does it declare a Gradle build file?"
for f in modules/econoflow-log/android/build.gradle modules/econoflow-log/android/build.gradle.kts; do
  [ -f "$f" ] && echo "found $f" || echo "missing $f"
done

echo
echo "=== what a working Expo module's android dir contains"
ls node_modules/expo-file-system/android 2>/dev/null
