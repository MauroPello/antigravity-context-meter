#!/bin/bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Resolve Node binary (supports PATH, Homebrew, /usr/local, and nvm)
resolve_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return
  fi
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return
    fi
  done
  local nvm_node
  nvm_node="$(ls -1 "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -n 1)"
  if [ -n "$nvm_node" ] && [ -x "$nvm_node" ]; then
    echo "$nvm_node"
    return
  fi
  return 1
}

NODE_BIN="${NODE_BIN:-$(resolve_node)}"
if [ -z "$NODE_BIN" ] || [ ! -x "$NODE_BIN" ]; then
  echo "❌ Node.js not found. Please install Node.js or set NODE_BIN." >&2
  exit 1
fi

echo "===================================================="
echo "🚀 Starting Antigravity Floating Context Capsule"
echo "===================================================="

# 1. Stop any existing processes
pkill -f "AntigravityCapsule" 2>/dev/null || true
lsof -ti :8765 | xargs kill -9 2>/dev/null || true

# 2. Start local data stream server
nohup "$NODE_BIN" dist/desktop.js </dev/null >/tmp/antigravity-context-meter.log 2>&1 &

# Wait for local server to be ready (up to 5s)
for i in $(seq 1 25); do
  if curl -sSf http://127.0.0.1:8765/capsule > /dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

# 3. Launch native macOS always-on-top floating HUD
nohup ./dist/AntigravityCapsule </dev/null >/dev/null 2>&1 &

echo "💊 Floating capsule started in the top-right corner!"
echo "✨ Features:"
echo "   - Always-on-top across windows and full-screen apps"
echo "   - Hold and drag to reposition anywhere on screen"
echo "   - Click to expand and switch between active sessions"
echo "💡 To stop, run: ./stop-capsule.sh"
