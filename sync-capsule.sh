#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
STATE_FILE="/tmp/antigravity-context-meter.last-app-pid"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

APP_PATH="${ANTIGRAVITY_APP_PATH:-/Applications/Antigravity.app/Contents/MacOS/Antigravity}"
APP_PID="$(ps -eo pid=,comm= | awk -v target="$APP_PATH" '$2 == target {print $1; exit}')"

is_capsule_running() {
  pgrep -f "AntigravityCapsule" >/dev/null 2>&1
}

is_server_running() {
  lsof -ti :8765 >/dev/null 2>&1
}

if [ -n "$APP_PID" ]; then
  LAST_PID=""
  if [ -f "$STATE_FILE" ]; then
    LAST_PID="$(cat "$STATE_FILE" 2>/dev/null)"
  fi

  if [ "$APP_PID" != "$LAST_PID" ]; then
    echo "$APP_PID" > "$STATE_FILE"
    if ! is_capsule_running || ! is_server_running; then
      "$DIR/start-capsule.sh"
    fi
  fi
else
  rm -f "$STATE_FILE"
  if is_capsule_running || is_server_running; then
    "$DIR/stop-capsule.sh"
  fi
fi
