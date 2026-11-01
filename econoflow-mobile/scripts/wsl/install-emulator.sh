#!/usr/bin/env bash
# Installs the Android emulator and an API 35 system image into the WSL SDK, and creates the
# AVD the Detox config expects (Pixel_7_API_35), headless.
#
# Separate from setup.sh because the image is ~1.5 GB and only the Detox run needs it.
set -euo pipefail

# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"
SDK_DIR="$ANDROID_HOME"
AVD_NAME="${AVD_NAME:-Pixel_7_API_35}"
IMAGE="system-images;android-35;google_apis;x86_64"

sdkmanager --install "emulator" "$IMAGE"
yes | sdkmanager --licenses >/dev/null 2>&1 || true

if ! avdmanager list avd 2>/dev/null | grep -q "Name: $AVD_NAME"; then
  printf 'no\n' | avdmanager create avd \
    -n "$AVD_NAME" -k "$IMAGE" -d pixel_7 --force
fi
avdmanager list avd | sed -n '/Name:/p;/Path:/p'

# The spec answers the biometric prompt over the emulator console, with fingerprint 1.
ADB="$SDK_DIR/platform-tools/adb"
"$SDK_DIR/emulator/emulator" -version | head -1
echo "adb: $ADB"
