#!/usr/bin/env bash
# Starts the headless emulator the Detox suite runs against, and leaves it running.
#
#   scripts/wsl/boot.sh            # start (if needed) and wait for boot
#   scripts/wsl/boot.sh status     # one line: is qemu up, is the device attached, is it booted
#
# Written as a file on purpose: `wsl -- bash -lc '...'` from PowerShell loses the quoting
# (a sourced env file's quotes, globs, `$(...)`), so nothing complicated goes inline.
set -uo pipefail
# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"

AVD_NAME="${AVD_NAME:-Pixel_7_API_35}"
LOG="$HOME/emulator.log"

status() {
  local up attached booted
  up=$(pgrep -f qemu-system-x86_64 >/dev/null && echo UP || echo DOWN)
  attached=$("$ANDROID_HOME/platform-tools/adb" devices 2>/dev/null | sed -n '2p' | tr -s '\t' ' ' | sed 's/ *$//')
  booted=$("$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  printf 'qemu=%s device=%s booted=%s\n' "$up" "${attached:-none}" "${booted:-none}"
}

if [ "${1:-start}" = "status" ]; then
  status
  exit 0
fi

if pgrep -f qemu-system-x86_64 >/dev/null; then
  echo "already running"
  status
  exit 0
fi

echo "starting $AVD_NAME headless (log: $LOG)"
"$ANDROID_HOME/platform-tools/adb" start-server >/dev/null 2>&1
setsid nohup "$ANDROID_HOME/emulator/emulator" -avd "$AVD_NAME" \
  -no-window -no-audio -no-boot-anim -no-snapshot \
  -gpu swiftshader_indirect -memory 4096 -cores 4 \
  >"$LOG" 2>&1 < /dev/null &
disown || true

for i in $(seq 1 60); do
  booted=$("$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [ "$booted" = "1" ]; then
    echo "booted after ~$((i * 5))s"
    status
    exit 0
  fi
  sleep 5
done

echo "did not finish booting; last log lines:" >&2
tail -30 "$LOG" >&2
status
exit 1
