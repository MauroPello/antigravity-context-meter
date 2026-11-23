#!/bin/bash
set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PLIST_LABEL="com.antigravity.context-meter"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/$PLIST_LABEL.plist"
SYNC_SCRIPT="$DIR/sync-capsule.sh"

chmod +x "$DIR/start-capsule.sh" "$DIR/stop-capsule.sh" "$SYNC_SCRIPT"
mkdir -p "$PLIST_DIR"

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$PLIST_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$SYNC_SCRIPT</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>3</integer>
  <key>AbandonProcessGroup</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/antigravity-context-meter-sync.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/antigravity-context-meter-sync.log</string>
</dict>
</plist>
EOF

# Reset state and reload LaunchAgent
rm -f /tmp/antigravity-context-meter.last-app-pid
launchctl bootout "gui/$(id -u)/$PLIST_LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"

echo "✅ Installed and enabled macOS auto-start/auto-close LaunchAgent:"
echo "   $PLIST_PATH"
echo "💡 The floating capsule will now open and close automatically with Antigravity Desktop."
echo "   To disable later, run: ./uninstall-autostart-macos.sh"
