#!/bin/bash

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "  FINAL DEVBOB SETUP VERIFICATION"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

echo "📍 CURRENT DIRECTORY:"
pwd
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. CONTAINER STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker ps --filter "status=running" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(devbob|api-server|metabob)" || echo "No containers found"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. METABOB API CONNECTIVITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: curl http://localhost:8080/"
RESPONSE=$(curl -s http://localhost:8080/)
echo "Response: $RESPONSE"
if [[ $RESPONSE == *"version"* ]]; then
    echo "✅ API connectivity: OK"
else
    echo "❌ API connectivity: FAILED"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. CONFIGURATION FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ opencode.json" && test -f opencode.json && echo "  Location: $(pwd)/opencode.json" || echo "  ❌ NOT FOUND"
echo "✅ .metabob/config.json" && test -f .metabob/config.json && echo "  Location: $(pwd)/.metabob/config.json" || echo "  ❌ NOT FOUND"
echo "✅ configs/opencode.devbob.json" && test -f configs/opencode.devbob.json && echo "  Location: $(pwd)/configs/opencode.devbob.json" || echo "  ❌ NOT FOUND"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. NETWORK VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Networks available:"
docker network ls --format "table {{.Name}}" | grep -E "(devbob|metabob)" || echo "No networks found"
echo ""
echo "devbob-opencode connected to:"
docker network inspect metabob-devbob_default --format='{{range .Containers}}{{.Name}}: {{.IPv4Address}}{{"\n"}}{{end}}' | grep devbob-opencode || echo "Not found on metabob network"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. OPENCODE INSTALLATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
which opencode && opencode --version | head -1 || echo "OpenCode not installed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. METABOB-CLI INSTALLATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
which metabob-cli && metabob-cli --version || echo "metabob-cli not installed"
echo ""

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "✅ SETUP VERIFICATION COMPLETE"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Next: Run 'opencode metabob status' from this directory to test connectivity"
echo ""
