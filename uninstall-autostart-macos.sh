#!/bin/bash
set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLIST_LABEL="com.antigravity.context-meter"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"

launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
rm -f "$PLIST_PATH" /tmp/antigravity-context-meter.last-app-pid
"$DIR/stop-capsule.sh"

echo "✅ Removed macOS auto-start/auto-close LaunchAgent."
