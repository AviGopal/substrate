#!/bin/bash
# Live Activity Execution Tracing Script
# Monitors logs from all components during activity execution

set -e

NAMESPACE="metabob"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="/tmp/devbob-activity-trace-${TIMESTAMP}"

echo "========================================="
echo "Activity Execution Live Trace"
echo "========================================="
echo "Timestamp: ${TIMESTAMP}"
echo "Log Directory: ${LOG_DIR}"
echo ""

# Create log directory
mkdir -p "${LOG_DIR}"

# Get pod names
RPC_POD=$(kubectl get pod -n ${NAMESPACE} -l app=metabob-rpc-api -o jsonpath='{.items[0].metadata.name}')
DEVBOB_POD="devbob-0"
REDIS_POD=$(kubectl get pod -n ${NAMESPACE} -l app.kubernetes.io/name=redis -o jsonpath='{.items[0].metadata.name}')
SURREAL_POD=$(kubectl get pod -n ${NAMESPACE} -l app=surrealdb -o jsonpath='{.items[0].metadata.name}')

echo "📦 Component Pods:"
echo "  DevBob: ${DEVBOB_POD}"
echo "  RPC API: ${RPC_POD}"
echo "  SurrealDB: ${SURREAL_POD}"
echo "  Redis: ${REDIS_POD}"
echo ""

# Check if we can access OpenCode
echo "🔍 Checking OpenCode availability in DevBob container..."
kubectl exec ${DEVBOB_POD} -n ${NAMESPACE} -c devbob -- which opencode > /dev/null 2>&1
if [ $? -eq 0 ]; then
    OPENCODE_VERSION=$(kubectl exec ${DEVBOB_POD} -n ${NAMESPACE} -c devbob -- opencode --version 2>&1 | grep -v "INFO" | head -1)
    echo "   ✅ OpenCode available: ${OPENCODE_VERSION}"
else
    echo "   ❌ OpenCode not found in container"
    exit 1
fi
echo ""

# Get current log positions (to show only new logs)
echo "📊 Capturing baseline log positions..."
RPC_LOG_BASELINE=$(kubectl logs -n ${NAMESPACE} ${RPC_POD} -c rpc-api --tail=0 2>&1 | wc -l)
echo "   RPC API baseline: ${RPC_LOG_BASELINE} lines"
echo ""

# Start log streaming in background
echo "🎬 Starting log capture (background processes)..."

# RPC API logs
kubectl logs -f -n ${NAMESPACE} ${RPC_POD} -c rpc-api --since=0s 2>&1 | \
    while read line; do
        echo "[RPC-API] $(date +%H:%M:%S.%3N) $line"
    done > "${LOG_DIR}/rpc-api.log" 2>&1 &
RPC_LOG_PID=$!
echo "   RPC API logs: PID ${RPC_LOG_PID}"

# Give logs time to start
sleep 2

echo ""
echo "========================================="
echo "🚀 Ready to Execute Activity"
echo "========================================="
echo ""
echo "Log files will be saved to:"
echo "  ${LOG_DIR}/rpc-api.log"
echo ""
echo "Press ENTER to start activity execution..."
read

# Create a test script in the container
echo "📝 Creating test activity in DevBob container..."

ACTIVITY_SCRIPT=$(cat <<'ACTIVITY_EOF'
#!/bin/bash
# Simple activity test script
echo "========================================="
echo "Test Activity Execution Started"
echo "========================================="
echo "Timestamp: $(date)"
echo "Container: $(hostname)"
echo ""

# Test 1: Check OpenCode version
echo "1️⃣ OpenCode Version:"
opencode --version 2>&1 | grep -v INFO | head -1
echo ""

# Test 2: Check environment
echo "2️⃣ Environment Configuration:"
echo "   METABOB_API_URL: ${METABOB_API_URL}"
echo "   SURREAL_HOST: ${SURREAL_HOST}:${SURREAL_PORT}"
echo "   REDIS available: ${REDIS_MASTER_SERVICE_HOST}:${REDIS_MASTER_SERVICE_PORT}"
echo ""

# Test 3: Create a simple test directory with a file
echo "3️⃣ Creating test workspace..."
mkdir -p /tmp/test-activity-$$
cd /tmp/test-activity-$$
echo "# Test Activity" > README.md
echo "This is a test activity execution" >> README.md
echo "   Created: /tmp/test-activity-$$/README.md"
echo ""

# Test 4: Check if we can reach RPC API
echo "4️⃣ Testing RPC API connectivity..."
curl -s "${METABOB_API_URL}/health" | head -1
echo ""

# Test 5: Try to list activity templates (will require auth, but shows connectivity)
echo "5️⃣ Testing activity templates endpoint (expect auth error)..."
curl -s "${METABOB_API_URL}/v2/activities/templates" | head -1
echo ""

echo "========================================="
echo "Test Activity Execution Completed"
echo "========================================="

# Cleanup
cd /
rm -rf /tmp/test-activity-$$
ACTIVITY_EOF
)

# Copy script to container
echo "${ACTIVITY_SCRIPT}" | kubectl exec -i ${DEVBOB_POD} -n ${NAMESPACE} -c devbob -- bash -c "cat > /tmp/test-activity.sh && chmod +x /tmp/test-activity.sh"

echo "   ✅ Activity script created in container"
echo ""

echo "========================================="
echo "▶️  EXECUTING ACTIVITY"
echo "========================================="
echo ""

# Execute the activity and capture output
kubectl exec ${DEVBOB_POD} -n ${NAMESPACE} -c devbob -- /tmp/test-activity.sh 2>&1 | tee "${LOG_DIR}/activity-execution.log"

echo ""
echo "========================================="
echo "📊 Post-Execution Analysis"
echo "========================================="
echo ""

# Wait a moment for logs to flush
sleep 3

# Stop log streaming
echo "🛑 Stopping log capture..."
kill ${RPC_LOG_PID} 2>/dev/null || true
sleep 1

# Analyze RPC API logs for activity-related entries
echo ""
echo "📈 RPC API Activity (last 20 lines):"
tail -20 "${LOG_DIR}/rpc-api.log" | sed 's/^/   /'

echo ""
echo "🔍 Checking for API calls in RPC logs..."
grep -E "(GET|POST|PUT|DELETE) /" "${LOG_DIR}/rpc-api.log" | tail -10 | sed 's/^/   /' || echo "   No API calls found"

echo ""
echo "📊 Redis Keys:"
kubectl exec ${REDIS_POD} -n ${NAMESPACE} -c redis -- redis-cli KEYS "*" 2>/dev/null | sed 's/^/   /'

echo ""
echo "📊 Redis Database Size:"
kubectl exec ${REDIS_POD} -n ${NAMESPACE} -c redis -- redis-cli DBSIZE 2>/dev/null | sed 's/^/   /'

echo ""
echo "========================================="
echo "✅ Trace Complete"
echo "========================================="
echo ""
echo "📁 Logs saved to: ${LOG_DIR}/"
echo ""
echo "To view logs:"
echo "  cat ${LOG_DIR}/activity-execution.log"
echo "  cat ${LOG_DIR}/rpc-api.log"
echo ""
echo "To analyze:"
echo "  grep 'ERROR' ${LOG_DIR}/*.log"
echo "  grep 'activity' ${LOG_DIR}/*.log"
echo "  grep 'POST' ${LOG_DIR}/rpc-api.log"
echo ""
