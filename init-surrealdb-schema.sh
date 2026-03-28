#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="activity-system"
DB_USERNAME="root"
DB_PASSWORD="surrealdb-local-dev-123"
DB_NAMESPACE="activity-system"
DB_DATABASE="learning_loop"
LOCAL_PORT="8000"

echo -e "${YELLOW}=== SurrealDB Schema Initialization ===${NC}"
echo ""

# Check if port-forward is already running
if lsof -Pi :$LOCAL_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}Port $LOCAL_PORT already in use, assuming SurrealDB port-forward exists${NC}"
    CLEANUP_PORT_FORWARD=false
else
    echo -e "${GREEN}Starting port-forward to SurrealDB...${NC}"
    kubectl port-forward -n $NAMESPACE svc/surrealdb $LOCAL_PORT:8000 &
    PORT_FORWARD_PID=$!
    CLEANUP_PORT_FORWARD=true

    # Wait for port-forward to be ready
    echo -n "Waiting for port-forward"
    for i in {1..10}; do
        if curl -s http://localhost:$LOCAL_PORT/health >/dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    echo ""
fi

# Cleanup function
cleanup() {
    if [ "$CLEANUP_PORT_FORWARD" = true ] && [ ! -z "$PORT_FORWARD_PID" ]; then
        echo -e "${YELLOW}Stopping port-forward...${NC}"
        kill $PORT_FORWARD_PID 2>/dev/null || true
    fi
}
trap cleanup EXIT

# Function to execute SurrealQL file
execute_sql_file() {
    local file=$1
    local filename=$(basename "$file")

    echo -e "${YELLOW}Applying $filename...${NC}"

    # Read file content and execute via HTTP API
    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Accept: application/json" \
        -H "surreal-ns: $DB_NAMESPACE" \
        -H "surreal-db: $DB_DATABASE" \
        -u "$DB_USERNAME:$DB_PASSWORD" \
        --data-binary "@$file" \
        "http://localhost:$LOCAL_PORT/sql")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        # Check if response contains errors
        if echo "$body" | jq -e '.[] | select(.status == "ERR")' >/dev/null 2>&1; then
            echo -e "${RED}✗ Error in $filename:${NC}"
            echo "$body" | jq '.[] | select(.status == "ERR")'
            return 1
        else
            echo -e "${GREEN}✓ $filename applied successfully${NC}"
            return 0
        fi
    else
        echo -e "${RED}✗ HTTP error $http_code for $filename${NC}"
        echo "$body"
        return 1
    fi
}

# Apply migrations in order
MIGRATIONS=(
    "repos/metabob-activity-api/sql/001-init-schema.surql"
    "repos/metabob-activity-api/sql/002-learning-system-phase1.surql"
    "repos/metabob-activity-api/sql/003-goal-execution-paths.surql"
    "repos/metabob-activity-api/sql/004-execution-traces.surql"
)

echo -e "${GREEN}Applying migrations to $DB_NAMESPACE.$DB_DATABASE...${NC}"
echo ""

for migration in "${MIGRATIONS[@]}"; do
    if [ ! -f "$migration" ]; then
        echo -e "${RED}✗ Migration file not found: $migration${NC}"
        exit 1
    fi

    if ! execute_sql_file "$migration"; then
        echo -e "${RED}✗ Failed to apply $migration${NC}"
        exit 1
    fi
    echo ""
done

# Verify tables were created
echo -e "${YELLOW}Verifying tables...${NC}"
TABLES_QUERY="INFO FOR DB;"

tables_response=$(curl -s \
    -X POST \
    -H "Accept: application/json" \
    -H "surreal-ns: $DB_NAMESPACE" \
    -H "surreal-db: $DB_DATABASE" \
    -u "$DB_USERNAME:$DB_PASSWORD" \
    -d "$TABLES_QUERY" \
    "http://localhost:$LOCAL_PORT/sql")

echo "$tables_response" | jq '.[0].result.tb' || echo "$tables_response"

echo ""
echo -e "${GREEN}=== Schema initialization complete! ===${NC}"
echo ""
echo "Tables created in $DB_NAMESPACE.$DB_DATABASE:"
echo "  - activity_template"
echo "  - variant_performance_metrics"
echo "  - activity_executions"
echo "  - activity_composition_graph"
echo "  - impulse_relevance_metrics"
echo "  - tool_usage_patterns"
echo "  - goal_execution_paths"
echo "  - execution_traces"
