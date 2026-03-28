#!/bin/bash
# Test: Backend API → SurrealDB impulse persistence
# Validates that impulse data flows from backend to database

set -e

echo "========================================"
echo "IMPULSE BACKEND FLOW TEST"
echo "========================================"
echo ""

#Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test data
IMPULSE_ID="test-impulse-backend-$(date +%s)"
EXECUTION_ID="test-exec-backend-$(date +%s)"

echo -e "${YELLOW}[1/4] Creating impulse in SurrealDB...${NC}"

docker exec -i metabob-surreal /surreal sql \
    --endpoint http://localhost:8000 \
    --namespace metabob --database devbob \
    --username root --password root <<EOF
INSERT INTO impulse_registry {
    impulse_id: '${IMPULSE_ID}',
    impulse_type: 'memo',
    org_id: 'test-org',
    project_id: 'test-project',
    session_id: 'test-session',
    pointer: {type: 'memo', content: 'Test content'},
    budget: 1000,
    scope: 'session',
    created_by: 'test-backend-flow',
    created_for: 'Backend flow test',
    tags: ['test'],
    related_impulses: [],
    status: 'active',
    usage_count: 0,
    success_when_used: 0,
    success_rate: 0.0,
    created_at: time::now()
};
