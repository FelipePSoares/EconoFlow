#!/usr/bin/env bash
# Is the device awake, unlocked and focused on the app? The three things a Detox wait needs
# and a screenshot does not show.
#
#   scripts/wsl/device-state.sh
#
# `has-window-focus=false` in a Detox failure means the app window is not focused: the device
# locked, a system dialog is on top, or the screen went off. Setting a device credential (to
# enroll a fingerprint) makes the lock screen appear, so check this after doing that.
set -u
# shellcheck source=/dev/null
. "$HOME/.android-hosts.env"
ADB="$ANDROID_HOME/platform-tools/adb"

echo "screen:"
"$ADB" shell dumpsys power 2>/dev/null | grep -E 'mWakefulness=|Display Power' | head -n 3

echo
echo "keyguard (showing / occluded):"
"$ADB" shell dumpsys window 2>/dev/null | grep -iE 'KeyguardShowing|KeyguardOccluded|mDreamingLockscreen' | head -n 4

echo
echo "focus:"
"$ADB" shell dumpsys window 2>/dev/null | grep -E 'mCurrentFocus|mFocusedApp' | head -n 2

echo
echo "app process:"
"$ADB" shell pidof pt.econoflow.mobile 2>/dev/null | tr -d '\r' || true

echo
echo "screen-off timeout: $("$ADB" shell settings get system screen_off_timeout 2>/dev/null | tr -d '\r')"
