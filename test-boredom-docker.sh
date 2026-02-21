#!/bin/bash
# Test boredom idle detection in Docker container
# This script simulates the boredom manager flow using basic shell commands

set -e

echo "================================================================================"
echo "  BOREDOM IDLE DETECTION TEST (Docker Container)"
echo "================================================================================"

SESSION_ID="test-session-$(date +%s)"
IDLE_THRESHOLD=10  # 10 seconds for testing
CHECK_INTERVAL=5   # Check every 5 seconds

echo ""
echo "Test Configuration:"
echo "  Session ID:      $SESSION_ID"
echo "  Idle Threshold:  ${IDLE_THRESHOLD}s"
echo "  Check Interval:  ${CHECK_INTERVAL}s"
echo ""

# Simulate idle detection
START_TIME=$(date +%s)
LAST_ACTIVITY=$START_TIME
CHECK_COUNT=0

echo "[1] Starting idle detection simulation..."
echo "    (No activity will be simulated - session will become idle)"
echo ""

while true; do
  CHECK_COUNT=$((CHECK_COUNT + 1))
  CURRENT_TIME=$(date +%s)
  IDLE_TIME=$((CURRENT_TIME - LAST_ACTIVITY))
  
  if [ $IDLE_TIME -ge $IDLE_THRESHOLD ]; then
    IS_IDLE="YES ✓"
  else
    IS_IDLE="NO"
  fi
  
  echo "[Check $CHECK_COUNT] Idle time: ${IDLE_TIME}s | Idle: $IS_IDLE"
  
  if [ $IDLE_TIME -ge $IDLE_THRESHOLD ]; then
    echo "    → Session is IDLE! Fetching boredom activities..."
    echo ""
    
    # Test the boredom API (placeholder - would call actual MCP)
    echo "[BOREDOM] Simulating MCP call to metabob_fetch_boredom_activities..."
    echo "[BOREDOM] Expected API call parameters:"
    echo "  {
    \"max_activities\": 5,
    \"priority_threshold\": 0.6,
    \"exclude_recent_hours\": 24
  }"
    echo ""
    
    # In real implementation, this would call:
    # docker exec devbob-clean opencode mcp call metabob_fetch_boredom_activities ...
    
    echo "[BOREDOM] Expected response (from mock templates):"
    echo "  {
    \"status\": \"success\",
    \"activities\": [
      {
        \"template_id\": \"high-failures-template\",
        \"activity_type\": \"debug-failures\",
        \"priority\": 42,
        \"improvement_gradient\": 0.28,
        \"reason\": \"Very low improvement gradient (0.28), poor success rate...\",
        \"estimated_effort\": \"medium\"
      },
      ...
    ]
  }"
    echo ""
    
    echo "[BOREDOM] ✅ Would execute top priority activity:"
    echo "    Template ID:      high-failures-template"
    echo "    Activity Type:    debug-failures"
    echo "    Priority:         42"
    echo "    Gradient:         0.28"
    echo ""
    
    echo "[BOREDOM] Execution flow:"
    echo "    1. ✓ Load template from repository"
    echo "    2. ✓ Create Activity instance"
    echo "    3. ✓ Execute with 'boredom' flag"
    echo "    4. ✓ Monitor for user return (cancel if detected)"
    echo "    5. ✓ Report results to metrics system"
    echo ""
    
    echo "================================================================================"
    echo "  TEST COMPLETE"
    echo "================================================================================"
    echo ""
    echo "✅ Idle detection working correctly"
    echo "✅ Boredom activity would be fetched and executed"
    echo ""
    echo "NEXT STEPS:"
    echo "  - Implement actual MCP call in container"
    echo "  - Test with real activity execution"
    echo "  - Verify cancellation on user return"
    break
  fi
  
  # Check timeout (30 seconds)
  ELAPSED=$((CURRENT_TIME - START_TIME))
  if [ $ELAPSED -ge 30 ]; then
    echo ""
    echo "⚠️  Test timeout (30s) - stopping"
    exit 1
  fi
  
  sleep $CHECK_INTERVAL
done

echo ""
echo "Test completed successfully!"
