#!/usr/bin/env bash
# Why the app process died: the crash, the ANR, or the OOM kill — whichever it was.
#
#   crash-reason.sh
#
# A screenshot of the launcher looks like "a blank screen in the app", so this is the check
# to run before believing any blank screen report. It goes through, in order: the app's own
# death records, the system's low-memory killer, and the last native traces.
set -u
. "$HOME/.android-hosts.env"
PACKAGE=pt.econoflow.mobile

echo "=== is it running?"
pid="$(adb shell pidof $PACKAGE 2>/dev/null | tr -d '\r')"
echo "pid: ${pid:-NOT RUNNING}"

echo
echo "=== death records (dumpsys activity exit-info)"
adb shell dumpsys activity exit-info $PACKAGE 2>/dev/null | grep -iE 'reason|description|timestamp|subreason' | head -12

echo
echo "=== crashes in the log"
adb logcat -d -b crash 2>/dev/null | tail -40

echo
echo "=== low-memory killer"
adb logcat -d 2>/dev/null | grep -iE 'lowmemorykiller|lmkd.*kill|Killing.*econoflow' | tail -8
