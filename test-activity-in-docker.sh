#!/bin/bash
set -e

echo "=== Testing Activity Execution in DevBob Container ==="
echo ""

# Execute the hello-world-minimal activity
echo "1. Executing hello-world-minimal activity in devbob-clean container..."
TIMESTAMP=$(date +%s)
TEST_ID="demo-${TIMESTAMP}"

echo "   Test ID: ${TEST_ID}"
echo ""

# Run the activity
docker exec devbob-clean sh -c "cd /workspace && opencode activity execute hello-world-minimal testId=${TEST_ID} name=DevBobDemo --print-logs" 2>&1 | tee activity-output-${TIMESTAMP}.log

echo ""
echo "2. Checking activity storage locations..."

# Check local activity storage
echo ""
echo "=== Local Activity Data (Filesystem) ==="
docker exec devbob-clean sh -c "find /root/.local/share/opencode -name 'act_*' -type d 2>/dev/null | head -5"

# Check if SurrealDB has activity data
echo ""
echo "=== SurrealDB Activity Records ==="
curl -s -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -d "SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 5;" 2>/dev/null | jq '.' || echo "Query failed or no data"

# Check Redis for activity data
echo ""
echo "=== Redis Activity Keys ==="
docker exec metabob-redis redis-cli KEYS "activity:*" 2>/dev/null | head -10 || echo "No activity keys found"

echo ""
echo "=== Test Complete ==="
echo "Output saved to: activity-output-${TIMESTAMP}.log"
