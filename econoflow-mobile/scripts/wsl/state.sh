#!/usr/bin/env bash
# One line per thing a Detox run depends on, so a broken run can be told from a broken app.
set -u
# shellcheck source=/dev/null
[ -f "$HOME/.android-hosts.env" ] && . "$HOME/.android-hosts.env"
line() { printf '%-12s %s\n' "$1" "$2"; }

line "qemu"    "$(pgrep -f qemu-system-x86_64 >/dev/null && echo UP || echo DOWN)"
line "device"  "$(adb devices 2>/dev/null | sed -n '2p' | tr -s '\t' ' ' | sed 's/ *$//')"
line "booted"  "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')"
line "metro"   "$(curl -s --max-time 3 http://127.0.0.1:8081/status 2>/dev/null || echo offline)"
line "api"     "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:7003/api/health/live 2>/dev/null || echo 000)"
line "reverse" "$(adb reverse --list 2>/dev/null | tr '\n' ' ')"
line "app"     "$(adb shell pm list packages 2>/dev/null | grep -c pt.econoflow.mobile)"
line "instr"   "$(adb shell pm list instrumentation 2>/dev/null | grep -c DetoxJUnitRunner)"
line "mem"     "$(free -m | sed -n '2p')"
