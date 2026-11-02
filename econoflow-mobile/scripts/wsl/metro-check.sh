#!/usr/bin/env bash
# Whether Metro is serving the app's code, and from where.
#
#   metro-check.sh            # status, working directory, and whether a known file is served
#   metro-check.sh restart    # restart Metro against ~/econoflow (the working copy e2e builds)
#
# Metro caches aggressively and serves the bundle of the directory it was started in. A
# `sync.sh` that updated `~/econoflow` while Metro was serving a stale or differently-rooted
# bundle is invisible from the device: the app runs, and simply runs the old code.
set -u
. "$HOME/.android-hosts.env"
WORK="${WORK_DIR:-$HOME/econoflow}"
LOG="${LOG:-$HOME/metro.log}"

pid_of_metro() { pgrep -f "expo start" | head -1; }

start_metro() {
  cd "$WORK" || exit 1
  nohup setsid npx expo start --dev-client --port 8081 --clear > "$LOG" 2>&1 < /dev/null &
  for _ in $(seq 1 60); do
    if curl -s --max-time 2 http://127.0.0.1:8081/status | grep -q running; then
      echo "metro restarted (pid $(pid_of_metro)) serving $WORK"
      return 0
    fi
    sleep 2
  done
  echo "metro did not come up; last log lines:" >&2
  tail -20 "$LOG" >&2
  return 1
}

if [ "${1:-check}" = "restart" ]; then
  pkill -f "expo start" >/dev/null 2>&1
  sleep 3
  start_metro
  exit $?
fi

echo "status:  $(curl -s --max-time 3 http://127.0.0.1:8081/status || echo offline)"
pid="$(pid_of_metro)"
echo "pid:     ${pid:-none}"
if [ -n "$pid" ]; then
  echo "cwd:     $(readlink "/proc/$pid/cwd")"
fi
echo "expected: $WORK"
echo "bundle:  $(curl -s --max-time 20 'http://127.0.0.1:8081/index.bundle?platform=android&dev=true&minify=false' | grep -c 'diagnostics/trace' || echo 0) references to diagnostics"
