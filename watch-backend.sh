#!/bin/bash
echo "=== WATCHING BACKEND LOGS ==="
echo "Press Ctrl+C to stop"
echo ""
docker logs -f api-server-dev 2>&1 | grep --line-buffered -E "POST|Failed|Error|500|activities|templates"
