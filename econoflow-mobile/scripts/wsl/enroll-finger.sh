#!/usr/bin/env bash
# Checks — and, when it is missing, enrolls — the fingerprint the biometric spec depends on.
#
# WHY THIS MATTERS
#   `e2e/support/biometrics.js` answers the system sensor with
#     adb -e emu finger touch 1
#   but that only *simulates a touch* on a finger that is ALREADY enrolled. On a device with
#   nothing enrolled, the app's `isEnrolledAsync()` answers false and `BiometricEnrollScreen`
#   renders its "nothing to offer" shape instead of the offer — so the biometric spec cannot
#   reach the sensor at all, and `03-biometricUnlock` fails on a wait that no tap can fix.
#   A freshly created `Pixel_7_API_35` AVD has NO fingerprint: `dumpsys fingerprint` reports
#   `"count":0`. Check it first, always:
#
#     scripts/wsl/enroll-finger.sh          # "count":N
#
# ENROLLING (headless, no display)
#   Android only offers biometric enrolment once the device has a credential, and the wizard
#   itself is system UI that Detox cannot drive. These steps are the ones that worked on this
#   machine, in this order — each is a no-op if that step is already done:
#
#     adb shell locksettings set-pin 1234
#     adb shell am start -n com.android.settings/.Settings\$SecuritySettingsActivity
#     adb shell am start -a android.settings.FINGERPRINT_ENROLL
#     adb shell input text 1234 && adb shell input keyevent 66      # confirm the credential
#     adb shell input tap 912 2220                                  # MORE, then scroll /
#     adb shell input tap 912 2220                                  #   I AGREE (native coords)
#     for i in 1 2 3 4 5 6 7 8; do adb -e emu finger touch 1; sleep 2; done
#     adb shell input tap 912 2220                                  # DONE
#
#   Coordinates are the **native** 1080x2400 pixels (`adb shell wm size`), not screenshot
#   points, and the "I AGREE" / "DONE" buttons sit at the bottom-right. Verify each step with
#   `adb shell dumpsys window | grep mCurrentFocus` — the wizard's activity names are
#   FingerprintEnrollIntroduction → FindSensor → EnrollFinish.
#
#   The screen lock this sets is a PIN on the *device*. It does not touch the app's PIN, but
#   `pm clear pt.econoflow.mobile` does not remove it either — a device with a lock screen is
#   fine for the suite (Detox wakes the device), and the biometric spec needs it.
#
#   TWO THINGS THAT WILL BITE YOU AFTERWARDS:
#   1. Clearing the lock removes the fingerprint with it — Android ties a biometric to a
#      credential. So you cannot "just unlock the device" to make it simpler; re-enrol instead.
#   2. The wizard can leave the system `BiometricPrompt` window in FRONT of the app, and then
#      every Detox wait fails with `has-window-focus=false` — which reads like a broken app.
#      Check it, and dismiss it, before the next run:
#
#        scripts/wsl/device-state.sh      # mCurrentFocus must be the app or the launcher
#        adb shell input keyevent 3       # back to the launcher, dropping whatever is on top
#
#   scripts/wsl/enroll-finger.sh status
#   scripts/wsl/enroll-finger.sh enroll
set -u
# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"
ADB="$ANDROID_HOME/platform-tools/adb"

count() {
  "$ADB" shell dumpsys fingerprint 2>/dev/null \
    | grep -o '"count":[0-9]*' | head -n 1 | cut -d: -f2
}

status() {
  local n
  n=$(count)
  if [ -z "${n:-}" ]; then
    echo "could not read the fingerprint state (is the device attached?)"
    return 2
  fi
  if [ "$n" -gt 0 ]; then
    echo "fingerprints enrolled: $n (the biometric spec can pass)"
    return 0
  fi
  echo "fingerprints enrolled: 0 — the biometric spec CANNOT pass until one is enrolled"
  echo "run: $0 enroll"
  return 1
}

case "${1:-status}" in
  status)
    status
    ;;
  enroll)
    if [ "$(count)" -gt 0 ]; then
      echo "already enrolled; nothing to do"
      status
      exit 0
    fi
    echo "setting a device credential (required before a fingerprint can be enrolled)"
    "$ADB" shell locksettings set-pin 1234 >/dev/null 2>&1
    "$ADB" shell settings put system screen_off_timeout 2147483647 >/dev/null 2>&1

    echo "opening the fingerprint wizard"
    "$ADB" shell am start -a android.settings.FINGERPRINT_ENROLL >/dev/null 2>&1
    sleep 3
    # It asks for the credential first.
    "$ADB" shell input text 1234 >/dev/null 2>&1
    sleep 1
    "$ADB" shell input keyevent 66 >/dev/null 2>&1
    sleep 3
    # MORE → I AGREE, both at the bottom-right of the native 1080x2400 screen.
    "$ADB" shell input tap 912 2220 >/dev/null 2>&1
    sleep 2
    "$ADB" shell input tap 912 2220 >/dev/null 2>&1
    sleep 3

    echo "offering the finger"
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      "$ADB" -e emu finger touch 1 >/dev/null 2>&1
      sleep 2
    done
    # DONE
    "$ADB" shell input tap 912 2220 >/dev/null 2>&1
    sleep 2

    # Drop whatever the wizard left in front of the app. A stale system `BiometricPrompt`
    # steals the window focus and makes every later Detox wait fail with
    # `has-window-focus=false`, which looks exactly like a broken app.
    "$ADB" shell input keyevent 3 >/dev/null 2>&1
    sleep 2
    echo "focus now: $("$ADB" shell dumpsys window 2>/dev/null | grep -m1 mCurrentFocus | tr -d '\r')"

    status
    ;;
  *)
    echo "usage: $0 {status|enroll}" >&2
    exit 2
    ;;
esac
