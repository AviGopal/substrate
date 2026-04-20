#!/bin/bash

# MiniBob Dashboard Viewer
# Starts a local server to view the dashboard

echo "🚀 Starting MiniBob Autonomous Development Dashboard..."

# Check if Python is available
if command -v python3 &> /dev/null; then
    SERVER_CMD="python3 -m http.server"
elif command -v python &> /dev/null; then
    SERVER_CMD="python -m http.server"
elif command -v npx &> /dev/null; then
    SERVER_CMD="npx http-server"
else
    echo "❌ No Python or Node.js found. Please install one of them to run the dashboard."
    exit 1
fi

# Start server
PORT=8081
cd public
echo "📊 Dashboard available at: http://localhost:$PORT"
echo "📂 Serving from: $(pwd)"
echo "⏹️  Press Ctrl+C to stop"
echo ""

exec $SERVER_CMD $PORT