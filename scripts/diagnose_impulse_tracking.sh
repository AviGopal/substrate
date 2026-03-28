#!/usr/bin/env bash
#
# Diagnose Impulse Tracking - Check current state of learning system
#
# This script verifies:
# 1. Database state (executions vs impulses tracked)
# 2. Recent activity execution data
# 3. Whether impulses field is populated
#

set -euo pipefail

echo "🔍 Impulse Tracking Diagnostic"
echo "================================"
echo ""

# Check if SurrealDB is running
if ! docker ps | grep -q metabob-surreal; then
    echo "❌ SurrealDB container not running"
    exit 1
fi

echo "✓ SurrealDB container running"
echo ""

# Query 1: Count executions
echo "📊 Query 1: Total Activity Executions"
echo "--------------------------------------"
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< 'SELECT COUNT() as total FROM activity_executions GROUP ALL;' 2>&1 | grep -A10 "Query 1"

echo ""

# Query 2: Count impulses
echo "📊 Query 2: Impulses Tracked"
echo "-----------------------------"
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< 'SELECT COUNT() as total FROM impulse_registry GROUP ALL;' 2>&1 | grep -A10 "Query 1"

echo ""

# Query 3: Check recent executions for impulse data
echo "📊 Query 3: Recent Executions (Impulse Field Check)"
echo "----------------------------------------------------"
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< 'SELECT execution_id, activity_id, array::len(impulses_used) as impulse_count, success FROM activity_executions ORDER BY timestamp DESC LIMIT 10;' 2>&1 | grep -A50 "Query 1"

echo ""

# Query 4: Check if impulse_usage table exists
echo "📊 Query 4: Impulse Usage Table Check"
echo "--------------------------------------"
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< 'INFO FOR TABLE impulse_usage;' 2>&1 | grep -A20 "Query 1" || echo "⚠️  impulse_usage table does not exist yet"

echo ""

# Summary
echo "📋 Summary"
echo "=========="
echo ""
echo "If impulse_count is 0 for all executions:"
echo "  → Confirms that impulses are not being tracked"
echo "  → Need to implement impulse data flow from OpenCode → CLI → Backend"
echo ""
echo "Next steps:"
echo "  1. Review LEARNING_FIX_ACTION_PLAN_FEB17.md"
echo "  2. Implement the 3 code fixes"
echo "  3. Re-run this diagnostic after fixes"
echo ""
