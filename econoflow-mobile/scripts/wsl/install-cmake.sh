#!/usr/bin/env bash
#
# Installs CMake into the WSL Android SDK, without sudo.
#
# `sdkmanager --install "cmake;3.30.4"` reports "Failed to find package": the SDK's CMake
# packages depend on its obsolete `cmake;3.6.4111459` base package, and the recent SDK
# repository no longer lists versions the old-style package search can resolve. The official
# zip is still published at the same URL `sdkmanager` would use, so this installs it by hand:
#
#   $ANDROID_HOME/cmake/<version>/bin/cmake
#
# which is exactly where the Android Gradle plugin looks for it. (The React Native build pins
# 3.22.1 in android/build.gradle and `plugins/with-detox-android.js` selects 3.30.4 — both are
# installed here so either build path works.)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
[ -f "$HOME/.android-hosts.env" ] && . "$HOME/.android-hosts.env"
SDK_DIR="${ANDROID_HOME:?source ~/.android-hosts.env first}"
VERSIONS=("${@:-3.30.4 3.22.1}")

for version in ${VERSIONS[*]}; do
  if [ -x "$SDK_DIR/cmake/$version/bin/cmake" ]; then
    echo "cmake $version already installed"
    continue
  fi
  echo "Installing cmake $version"
  mkdir -p "$SDK_DIR/cmake/$version"
  python3 "$HERE/boxdl.py" \
    "https://dl.google.com/android/repository/cmake-${version}-linux.zip" \
    "$SDK_DIR/cmake/$version" --strip 1
  "$SDK_DIR/cmake/$version/bin/cmake" --version | head -1
done
