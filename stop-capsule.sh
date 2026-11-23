#!/bin/bash

echo "🛑 Stopping Antigravity Floating Capsule and background server..."
pkill -f "AntigravityCapsule" 2>/dev/null || true
lsof -ti :8765 | xargs kill -9 2>/dev/null || true
echo "✅ Stopped!"
