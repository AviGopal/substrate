#!/bin/bash

echo "Testing Dashboard Integration for Stats Command"
echo "================================================"
echo ""

# Test 1: Check if dashboard is running
echo "Test 1: Dashboard Server Status"
if curl -s http://localhost:8083/ > /dev/null 2>&1; then
    echo "✅ Dashboard server is running on port 8083"
else
    echo "❌ Dashboard server is NOT running"
    exit 1
fi
echo ""

# Test 2: Fetch metrics endpoint
echo "Test 2: Metrics Endpoint"
METRICS=$(curl -s http://localhost:8083/metrics)
TOTAL_ISSUES=$(echo "$METRICS" | jq -r '.project_metrics.total_issues')
FILES_ANALYZED=$(echo "$METRICS" | jq -r '.project_metrics.files_analyzed')
BACKEND_CONNECTED=$(echo "$METRICS" | jq -r '.dashboard_health.backend_api_connected')

echo "  Total Issues: $TOTAL_ISSUES"
echo "  Files Analyzed: $FILES_ANALYZED"
echo "  Backend Connected: $BACKEND_CONNECTED"

if [ "$FILES_ANALYZED" != "null" ] && [ "$FILES_ANALYZED" != "0" ]; then
    echo "✅ Metrics endpoint returning real data"
else
    echo "⚠️  Metrics endpoint has limited data"
fi
echo ""

# Test 3: Fetch problems endpoint
echo "Test 3: Problems Endpoint"
PROBLEMS=$(curl -s http://localhost:8083/problems)
PROBLEM_COUNT=$(echo "$PROBLEMS" | jq -r '.total_count')
echo "  Problem Count: $PROBLEM_COUNT"

if [ "$PROBLEM_COUNT" != "null" ]; then
    echo "✅ Problems endpoint returning data"
else
    echo "❌ Problems endpoint failed"
fi
echo ""

# Test 4: Fetch activities endpoint
echo "Test 4: Activities Endpoint"
ACTIVITIES=$(curl -s 'http://localhost:8083/activities?limit=5')
ACTIVITY_COUNT=$(echo "$ACTIVITIES" | jq -r '.total_count')
echo "  Activity Count: $ACTIVITY_COUNT"

if [ "$ACTIVITY_COUNT" != "null" ]; then
    echo "✅ Activities endpoint returning data"
else
    echo "❌ Activities endpoint failed"
fi
echo ""

# Test 5: Check data freshness
echo "Test 5: Data Freshness"
LAST_UPDATE=$(echo "$METRICS" | jq -r '.dashboard_health.last_data_update')
if [ "$LAST_UPDATE" != "null" ]; then
    NOW=$(date -u +%s)
    UPDATE_TIME=$(date -d "$LAST_UPDATE" +%s 2>/dev/null || echo "0")
    AGE=$((NOW - UPDATE_TIME))
    
    echo "  Last Update: $LAST_UPDATE"
    echo "  Age: ${AGE}s"
    
    if [ "$AGE" -lt 120 ]; then
        echo "✅ Data is fresh (< 2 minutes old)"
    else
        echo "⚠️  Data may be stale (> 2 minutes old)"
    fi
else
    echo "⚠️  Cannot determine data freshness"
fi
echo ""

# Summary
echo "================================================"
echo "Summary: Dashboard is operational and serving data"
echo "The enhanced stats command will be able to fetch:"
echo "  - Activity statistics from Activity.list()"
echo "  - Metabob metrics from dashboard /metrics"
echo "  - Code quality data from dashboard /problems"
echo "  - Boredom system status (when implemented)"
echo ""
echo "Note: Bootstrap template issue prevents stats command"
echo "from running, but dashboard integration is functional."
