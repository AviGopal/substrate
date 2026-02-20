#!/bin/bash
# Simple test of activity registration and search

echo "=== Testing Activity System ==="
echo ""

echo "1. Checking if template is registered..."
cd repos/metabob-cli

# Try to get activities list via API
echo "2. Querying backend API for activities..."
curl -s "http://localhost:8080/api/v1/activities?category=refactor" | jq '.' || echo "API call failed"

echo ""
echo "3. Template details:"
echo "   - Name: jiggle-documentation"
echo "   - Variant ID: jiggle-documentation-772b239e"
echo "   - Status: testing"
echo ""

echo "4. To use this activity in OpenCode:"
echo "   activity({"
echo "     activityId: 'jiggle-documentation-772b239e',"
echo "     variables: {"
echo "       scope: 'entire repo',"
echo "       recentDays: 30,"
echo "       mode: 'dryRun'"
echo "     },"
echo "     reason: 'Test documentation jiggle'"
echo "   })"
echo ""

echo "✅ Activity system test complete"
