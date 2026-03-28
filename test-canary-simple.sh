#!/bin/bash
# Simple Canary Test - Proof of Concept
# Tests that we can run activities in containers and capture results

set -e

ACTIVITY_ID="${1:-ultra-simple-test}"
CONTAINER_NAME="devbob-opencode"
TIMESTAMP=$(date +%s)
ARTIFACT_DIR="./canary-test-${TIMESTAMP}"

echo "=== Simple Canary Test ==="
echo "Activity: $ACTIVITY_ID"
echo "Container: $CONTAINER_NAME"
echo "Artifacts: $ARTIFACT_DIR"
echo ""

# Step 1: Start container
echo "[1/5] Starting container..."
cd /home/avi/documents/work/exp-repo/metabob-devbob
./devbob agent start $CONTAINER_NAME || true
sleep 3

# Step 2: Check container is running
echo "[2/5] Checking container status..."
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "ERROR: Container not running"
    exit 1
fi
echo "✓ Container running"

# Step 3: Execute activity in container
echo "[3/5] Executing activity in container..."
docker exec -i $CONTAINER_NAME bash -c "
    cd /workspace && 
    opencode activity execute $ACTIVITY_ID --reason 'Canary test'
" 2>&1 | tee /tmp/canary-output.log

EXIT_CODE=${PIPESTATUS[0]}
echo "Activity exit code: $EXIT_CODE"

# Step 4: Copy artifacts
echo "[4/5] Copying artifacts..."
mkdir -p "$ARTIFACT_DIR"
docker cp $CONTAINER_NAME:/workspace/. "$ARTIFACT_DIR/" 2>/dev/null || echo "Some files couldn't be copied (normal)"
cp /tmp/canary-output.log "$ARTIFACT_DIR/execution.log"
echo "✓ Artifacts saved to $ARTIFACT_DIR"

# Step 5: Stop container
echo "[5/5] Stopping container..."
./devbob agent stop $CONTAINER_NAME

# Summary
echo ""
echo "=== Summary ==="
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ SUCCESS: Activity executed successfully"
    echo "✓ Artifacts: $ARTIFACT_DIR"
    echo ""
    echo "Next steps:"
    echo "  1. Review artifacts: ls -la $ARTIFACT_DIR"
    echo "  2. Review execution log: cat $ARTIFACT_DIR/execution.log"
    echo "  3. Repeat test to verify repeatability"
else
    echo "✗ FAILURE: Activity failed with exit code $EXIT_CODE"
    echo "Review logs: cat $ARTIFACT_DIR/execution.log"
fi

exit $EXIT_CODE
