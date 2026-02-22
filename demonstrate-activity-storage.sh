#!/bin/bash

echo "======================================================================"
echo "Activity System Storage Demonstration - DevBob Docker Environment"
echo "======================================================================"
echo ""

echo "This demonstration shows where activity data is stored and how the"
echo "activity system works in the Docker environment."
echo ""

echo "----------------------------------------------------------------------"
echo "1. REDIS - Activity Template Storage"
echo "----------------------------------------------------------------------"
echo ""
echo "Redis stores activity templates with Thompson Sampling metrics."
echo "These templates are used to execute activities with learned success rates."
echo ""

echo "Available activity template keys in Redis:"
docker exec metabob-redis redis-cli KEYS "activity:template:*" | head -10
echo ""

echo "Sample template: hello-world-minimal"
echo "----------------------------------------------------------------------"
docker exec metabob-redis redis-cli GET "activity:template:hello-world-minimal-31727b21" | jq '.' 2>/dev/null || docker exec metabob-redis redis-cli GET "activity:template:hello-world-minimal-31727b21"
echo ""

echo "----------------------------------------------------------------------"
echo "2. REDIS - Activity Metrics Storage"
echo "----------------------------------------------------------------------"
echo ""
echo "Metrics track success rates, costs, and durations for each template."
echo ""

echo "Available activity metrics keys in Redis:"
docker exec metabob-redis redis-cli KEYS "activity:metrics:*" | head -10
echo ""

echo "Sample metrics: hello-world-minimal"
echo "----------------------------------------------------------------------"
docker exec metabob-redis redis-cli GET "activity:metrics:hello-world-minimal-31727b21" | jq '.' 2>/dev/null || docker exec metabob-redis redis-cli GET "activity:metrics:hello-world-minimal-31727b21"
echo ""

echo "----------------------------------------------------------------------"
echo "3. FILESYSTEM - Local Activity Data"
echo "----------------------------------------------------------------------"
echo ""
echo "OpenCode stores activity execution state locally in:"
echo "  ~/.local/share/opencode/activities/"
echo ""

echo "Recent activity directories in devbob-clean container:"
docker exec devbob-clean sh -c "ls -lth /root/.local/share/opencode/activities 2>/dev/null | head -10" || echo "(No activities executed yet)"
echo ""

echo "----------------------------------------------------------------------"
echo "4. SURREALDB - Activity Execution History"
echo "----------------------------------------------------------------------"
echo ""
echo "SurrealDB stores full execution records for learning and analysis."
echo "Tables: activity_execution, template_metrics, failure_patterns"
echo ""

echo "Querying activity_execution table..."
curl -s -X POST http://localhost:8000/sql \
  -u "root:root" \
  -H "NS: metabob" \
  -H "DB: metabob" \
  -H "Accept: application/json" \
  --data-binary "SELECT * FROM activity_execution ORDER BY created_at DESC LIMIT 3;" | jq '.' 2>/dev/null || echo "(SurrealDB query requires different content-type)"
echo ""

echo "----------------------------------------------------------------------"
echo "5. API SERVER - Backend Integration"
echo "----------------------------------------------------------------------"
echo ""
echo "Metabob RPC API provides backend services for activity execution:"
echo "  - Template registry"
echo "  - Metrics aggregation"
echo "  - Thompson Sampling selection"
echo ""

echo "API server health check:"
curl -s http://localhost:8080/ | head -5
echo ""

echo "======================================================================"
echo "Summary: Activity System Architecture"
echo "======================================================================"
echo ""
echo "Data Flow:"
echo "  1. Templates stored in Redis (fast access)"
echo "  2. Agent executes activity using template"
echo "  3. Execution state stored locally (filesystem)"
echo "  4. Results posted to Redis (metrics update)"
echo "  5. Full history stored in SurrealDB (learning)"
echo "  6. Thompson Sampling uses metrics for template selection"
echo ""
echo "Key Components:"
echo "  ✅ Redis: Template cache + metrics"
echo "  ✅ SurrealDB: Execution history + learning data"
echo "  ✅ Filesystem: Local activity state + artifacts"
echo "  ✅ API Server: Backend coordination + aggregation"
echo "  ✅ DevBob Container: Isolated execution environment"
echo ""
echo "======================================================================"
