#!/usr/bin/env bash
# The trail, straight from logcat. The one command to run after reproducing anything.
#
#   trail.sh            # this app run's events, numbered
#   trail.sh clear      # start a fresh log before a run
#   trail.sh save PATH  # write them to a file to attach to a report
set -u
. "$HOME/.android-hosts.env"
TAG='EconoFlowTrace'

case "${1:-show}" in
  clear)
    adb logcat -c
    echo "logcat cleared"
    exit 0
    ;;
  save)
    adb logcat -d -s "$TAG" 2>/dev/null | sed "s/^.*${TAG}: //" > "${2:-/tmp/trail.txt}"
    echo "${2:-/tmp/trail.txt} ($(wc -l < "${2:-/tmp/trail.txt}") events)"
    exit 0
    ;;
esac

pid="$(adb shell pidof pt.econoflow.mobile 2>/dev/null | tr -d '\r')"
echo "# app pid: ${pid:-NOT RUNNING}"
if [ -n "$pid" ]; then
  adb logcat -d --pid="$pid" 2>/dev/null | grep -F "${TAG}:" | sed "s/^.*${TAG}: //"
else
  adb logcat -d -s "$TAG" 2>/dev/null | sed "s/^.*${TAG}: //" | tail -40
fi
