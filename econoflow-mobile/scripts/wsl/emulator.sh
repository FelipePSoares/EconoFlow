#!/usr/bin/env bash
# Starts (or stops) the headless Android emulator inside WSL, under KVM, and waits until
# the device is usable. Everything the Detox run touches then lives in this distro.
#
#   scripts/wsl/emulator.sh start     # background, headless, waits for boot
#   scripts/wsl/emulator.sh stop
#   scripts/wsl/emulator.sh status
set -euo pipefail

# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"
AVD_NAME="${AVD_NAME:-Pixel_7_API_35}"
LOG="$HOME/emulator.log"
ADB="$ANDROID_HOME/platform-tools/adb"

case "${1:-start}" in
  start)
    if "$ANDROID_HOME/platform-tools/adb" devices | grep -q "emulator-"; then
      echo "an emulator is already attached"
      "$ADB" devices
      exit 0
    fi
    echo "starting $AVD_NAME headless (log: $LOG)"
    # `-no-window` is what makes it headless: no display server is needed. `-gpu swiftshader_indirect`
    # renders in software, since there is no GPU to use. `-no-snapshot` starts from a known state
    # every run, which the specs need; they rely on a device that boots the same way each time.
    nohup "$ANDROID_HOME/emulator/emulator" -avd "$AVD_NAME" \
      -no-window -no-audio -no-boot-anim -no-snapshot \
      -gpu swiftshader_indirect -accel on -memory 4096 \
      >"$LOG" 2>&1 &
    "$ADB" start-server >/dev/null
    echo "waiting for the device..."
    "$ADB" wait-for-device
    for _ in $(seq 1 120); do
      if [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
        echo "booted: $("$ADB" devices | sed -n '2p')"
        exit 0
      fi
      sleep 5
    done
    echo "emulator did not finish booting; last log lines:" >&2
    tail -30 "$LOG" >&2
    exit 1
    ;;
  stop)
    "$ADB" emu kill >/dev/null 2>&1 || true
    echo stopped
    ;;
  status)
    "$ADB" devices
    ;;
  *)
    echo "usage: $0 {start|stop|status}" >&2
    exit 2
    ;;
esac
