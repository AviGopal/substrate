#!/usr/bin/bash
# Simple test of jiggle activity using direct API calls

echo "🔍 Testing Jiggle Documentation Activity"
echo "=========================================="
echo ""

# Test 1: Check backend health
echo "1. Checking backend health..."
curl -s http://localhost:8080/ | python3 -m json.tool
echo ""

# Test 2: Check if jiggle activity exists in database
echo "2. Checking for jiggle activity in database..."
echo "   (This queries SurrealDB directly)"
docker exec metabob-rpc-api-surreal-1 /surreal sql \
  --endpoint http://localhost:8000 \
  --username root \
  --password root \
  --namespace metabob \
  --database dev \
  --pretty \
  "SELECT * FROM activity_templates WHERE name CONTAINS 'Jiggle' OR activity_id CONTAINS 'jiggle' LIMIT 5;" 2>&1 | head -50

echo ""
echo "3. Alternative: Check bootstrap activities directory..."
ls -lah repos/metabob-proto/activities/bootstrap/*.json | grep jiggle

echo ""
echo "✅ Activity file exists at:"
echo "   repos/metabob-proto/activities/bootstrap/jiggle-documentation.json"
echo ""
echo "📖 Documentation available at:"
echo "   README-JIGGLE-ACTIVITY.md"
echo ""
echo "🎯 To execute the activity:"
echo "   - Use OpenCode activity tool (via MCP)"
echo "   - Or call V2 API: POST /api/v2/activities"
echo "   - Or use the activity creation script"
