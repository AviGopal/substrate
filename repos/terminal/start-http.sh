#!/bin/bash
# Start terminal vessel HTTP server

export MODE=http
export PORT=9090
export INSTANCE_ID=terminal-vessel-1
export VESSEL_ENDPOINT=http://localhost:9090
export ACTIVITY_API_ENDPOINT=http://activity.metabob.local

echo "Starting Terminal Vessel HTTP server..."
echo "Port: $PORT"
echo "Backend: $ACTIVITY_API_ENDPOINT"
echo ""

bun run src/index.ts
