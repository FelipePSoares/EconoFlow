#!/usr/bin/env bash
# What is on screen right now, according to the accessibility tree.
#
#   view-tree.sh
#
# A blank screenshot has two very different causes that look identical: the app drew nothing,
# or the app drew something invisible. `uiautomator dump` answers which: every testID and text
# React Native exposes shows up here, including views with no visible pixels.
set -u
. "$HOME/.android-hosts.env"

adb shell uiautomator dump /sdcard/tree.xml >/dev/null 2>&1
adb shell cat /sdcard/tree.xml 2>/dev/null > /tmp/tree.xml
adb shell rm -f /sdcard/tree.xml >/dev/null 2>&1

printf 'nodes: %s\n' "$(grep -o '<node' /tmp/tree.xml 2>/dev/null | wc -l)"
echo "=== ids and text on screen"
grep -oE 'resource-id="[^"]*"|text="[^"]+"' /tmp/tree.xml 2>/dev/null | sort -u | head -40
echo "=== activity"
adb shell dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|topResumedActivity' | head -2
