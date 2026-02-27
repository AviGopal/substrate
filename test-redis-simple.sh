#!/bin/bash
# Simple Redis data flow test with input-output validation

TEST_RUN_ID="e2e-test-20260226-manual"
TEST_INPUT="Hello Redis from E2E test - this is the input data"
KEY="test:session:${TEST_RUN_ID}"

echo "=== Testing Redis Data Flow ==="
echo ""

# Create test data JSON
TEST_DATA=$(cat <<EOF
{
  "testRunId": "$TEST_RUN_ID",
  "sessionId": "test-session-$TEST_RUN_ID",
  "data": {
    "input": "$TEST_INPUT",
    "timestamp": "$(date -Iseconds)"
  }
}
EOF
)

# Write to Redis
echo "Writing to Redis key: $KEY"
echo "$TEST_DATA" | redis-cli -h localhost -p 6379 -x SET "$KEY" > /dev/null
redis-cli -h localhost -p 6379 EXPIRE "$KEY" 300 > /dev/null
echo "✓ Written to Redis"
echo ""

# Read from Redis
echo "Reading from Redis key: $KEY"
RETRIEVED=$(redis-cli -h localhost -p 6379 GET "$KEY")
echo "✓ Read from Redis"
echo ""

# Parse and validate
OUTPUT=$(echo "$RETRIEVED" | jq -r '.data.input')

echo "=== Input-Output Validation ==="
echo "Input:  \"$TEST_INPUT\""
echo "Output: \"$OUTPUT\""

if [ "$OUTPUT" = "$TEST_INPUT" ]; then
    echo "Match:  ✓ PASS"
    echo ""
    echo "=== Test Result ==="
    echo "Status: PASS"
    echo "Verification: output === input"
    exit 0
else
    echo "Match:  ✗ FAIL"
    echo ""
    echo "=== Test Result ==="
    echo "Status: FAIL"
    echo "Verification: output !== input"
    exit 1
fi
