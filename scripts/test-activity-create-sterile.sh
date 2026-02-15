#!/bin/bash
# Test activity-create-v2 in sterile environment
# Usage: ./test-activity-create-sterile.sh [container_name] [test_case]

set -e

CONTAINER_NAME="${1:-devbob-clean}"
TEST_CASE="${2:-minimal}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="./validation-results/sterile-tests/$TIMESTAMP"

echo "=== Testing activity-create-v2 in Sterile Environment ==="
echo "Container: $CONTAINER_NAME"
echo "Test case: $TEST_CASE"
echo "Results: $RESULTS_DIR"
echo ""

# Create results directory
mkdir -p "$RESULTS_DIR"

# Verify container is running
echo "1. Verifying container status..."
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container $CONTAINER_NAME is not running"
    echo "Start it with: docker start $CONTAINER_NAME"
    exit 1
fi
echo "✅ Container is running"

# Check workspace is empty (sterile environment)
echo ""
echo "2. Verifying sterile environment (empty workspace)..."
docker exec "$CONTAINER_NAME" bash -c "ls -la /workspace" > "$RESULTS_DIR/workspace-before.txt"
FILE_COUNT=$(docker exec "$CONTAINER_NAME" bash -c "ls -A /workspace | wc -l")
if [ "$FILE_COUNT" -gt 2 ]; then
    echo "⚠️  Workspace has $FILE_COUNT items (expected empty or only .metabob, .opencode)"
    echo "Contents:"
    cat "$RESULTS_DIR/workspace-before.txt"
else
    echo "✅ Workspace is sterile (0-2 config items)"
fi

# Check backend connectivity
echo ""
echo "3. Checking backend connectivity..."
BACKEND_STATUS=$(docker exec "$CONTAINER_NAME" bash -c "curl -s http://localhost:8080/status 2>&1 || echo 'FAILED'")
if echo "$BACKEND_STATUS" | grep -q "ok"; then
    echo "✅ Backend is reachable"
    echo "$BACKEND_STATUS" > "$RESULTS_DIR/backend-status.json"
else
    echo "❌ Backend is not reachable: $BACKEND_STATUS"
    echo "This test requires the Metabob backend running"
    exit 1
fi

# Check OpenCode installation
echo ""
echo "4. Checking OpenCode CLI..."
OPENCODE_VERSION=$(docker exec "$CONTAINER_NAME" bash -c "opencode --version 2>&1 | head -1")
echo "✅ OpenCode: $OPENCODE_VERSION"

# Create test input based on test case
echo ""
echo "5. Preparing test case: $TEST_CASE"
case "$TEST_CASE" in
    minimal)
        ACTIVITY_NAME="Hello World Demo"
        ACTIVITY_ID="hello-world-demo-v1"
        CATEGORY="infrastructure"
        PATTERN="User requests a simple hello world activity that prints a message and exits successfully"
        TEST_VARS='{"message":"Hello from sterile test!"}'
        EXPECTED_STEPS=2
        ;;
    complex)
        ACTIVITY_NAME="File Backup"
        ACTIVITY_ID="backup-files-v1"
        CATEGORY="infrastructure"
        PATTERN="User has files they want to backup. The activity should: 1) List source files, 2) Create backup directory, 3) Copy files to backup directory, 4) Verify all files were copied successfully"
        TEST_VARS='{"source_dir":"/tmp/test","backup_dir":"/tmp/backup"}'
        EXPECTED_STEPS=4
        ;;
    vague)
        ACTIVITY_NAME="Process Data"
        ACTIVITY_ID="process-data-v1"
        CATEGORY="refactor"
        PATTERN="Process some data efficiently and output results"
        TEST_VARS='{"input_file":"data.txt"}'
        EXPECTED_STEPS=3
        ;;
    *)
        echo "❌ Unknown test case: $TEST_CASE"
        echo "Available: minimal, complex, vague"
        exit 1
        ;;
esac

cat > "$RESULTS_DIR/test-parameters.json" <<EOF
{
  "test_case": "$TEST_CASE",
  "activity_name": "$ACTIVITY_NAME",
  "activity_id": "$ACTIVITY_ID",
  "target_category": "$CATEGORY",
  "source_pattern": "$PATTERN",
  "test_variables": $TEST_VARS,
  "expected_steps": $EXPECTED_STEPS
}
EOF

echo "Test Parameters:"
cat "$RESULTS_DIR/test-parameters.json" | jq .

# Create ACP prompt file
cat > "$RESULTS_DIR/acp-prompt.txt" <<EOF
I need you to execute the activity-create-v2 template to test sterile environment compatibility.

IMPORTANT CONTEXT:
- You are in a STERILE environment (no source code present)
- /workspace is empty except for config files
- You must create the template using ONLY the description provided
- Do NOT try to read source files or git history
- All information needed is in the variables below

Execute this activity:

activity({
  activityId: "activity-create-v2",
  variables: {
    activity_name: "$ACTIVITY_NAME",
    activity_id: "$ACTIVITY_ID", 
    target_category: "$CATEGORY",
    source_pattern: "$PATTERN",
    test_variables: $TEST_VARS
  },
  reason: "Test sterile environment execution - validate template creation works without source code"
})

Please report:
1. Progress through each of the 7 steps
2. Any validation errors encountered
3. Whether schema validation passed
4. Whether test execution succeeded
5. Contents of the created template summary

If you encounter issues:
- Use trailblazing to recover
- Do not try to access source code
- Generate reasonable defaults from the pattern description
- Focus on creating a simple, functional template
EOF

echo ""
echo "6. Executing activity via ACP..."
echo "This may take 3-5 minutes depending on template complexity..."
echo ""

# Execute activity via ACP with timeout
timeout 600 docker exec -i "$CONTAINER_NAME" bash -c "cd /workspace && opencode acp --cwd /workspace" < "$RESULTS_DIR/acp-prompt.txt" 2>&1 | tee "$RESULTS_DIR/acp-output.log"

ACP_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "7. Analyzing results..."

# Check if activity completed
if [ $ACP_EXIT_CODE -eq 0 ]; then
    echo "✅ ACP session completed (exit code 0)"
else
    echo "❌ ACP session failed (exit code $ACP_EXIT_CODE)"
fi

# Check for created files in temporary workspace
echo ""
echo "8. Checking for created artifacts..."
docker exec "$CONTAINER_NAME" bash -c "find /workspace -name '*.json' -o -name '*.md' 2>/dev/null" > "$RESULTS_DIR/created-files.txt" || true

if [ -s "$RESULTS_DIR/created-files.txt" ]; then
    echo "✅ Found created files:"
    cat "$RESULTS_DIR/created-files.txt"
    
    # Try to extract the created template
    TEMPLATE_FILE=$(grep "$ACTIVITY_ID.json" "$RESULTS_DIR/created-files.txt" | head -1)
    if [ -n "$TEMPLATE_FILE" ]; then
        docker exec "$CONTAINER_NAME" cat "$TEMPLATE_FILE" > "$RESULTS_DIR/created-template.json" 2>/dev/null || true
        if [ -s "$RESULTS_DIR/created-template.json" ]; then
            echo "✅ Extracted template to: $RESULTS_DIR/created-template.json"
            
            # Validate JSON syntax
            if jq empty "$RESULTS_DIR/created-template.json" 2>/dev/null; then
                echo "✅ Template JSON is valid"
                STEP_COUNT=$(jq '.task_steps | length' "$RESULTS_DIR/created-template.json" 2>/dev/null || echo "0")
                echo "   Steps in template: $STEP_COUNT (expected: $EXPECTED_STEPS)"
            else
                echo "❌ Template JSON is invalid"
            fi
        fi
    fi
else
    echo "⚠️  No files found (might be in temporary directory)"
fi

# Parse ACP output for key indicators
echo ""
echo "9. Parsing execution log..."
grep -i "step.*complete\|validation.*passed\|error\|failed\|success" "$RESULTS_DIR/acp-output.log" > "$RESULTS_DIR/key-events.txt" || true

COMPLETED_STEPS=$(grep -c "completed\|✅" "$RESULTS_DIR/key-events.txt" || echo "0")
ERRORS=$(grep -c -i "error\|failed\|❌" "$RESULTS_DIR/key-events.txt" || echo "0")

echo "Completed steps: $COMPLETED_STEPS"
echo "Errors encountered: $ERRORS"

# Generate summary report
cat > "$RESULTS_DIR/SUMMARY.md" <<EOF
# Sterile Environment Test Results

**Test Case**: $TEST_CASE  
**Date**: $(date)  
**Container**: $CONTAINER_NAME  
**Activity**: activity-create-v2

## Test Parameters
\`\`\`json
$(cat "$RESULTS_DIR/test-parameters.json")
\`\`\`

## Results

### Execution
- Exit Code: $ACP_EXIT_CODE
- Completed Steps: $COMPLETED_STEPS
- Errors: $ERRORS

### Artifacts Created
\`\`\`
$(cat "$RESULTS_DIR/created-files.txt")
\`\`\`

### Key Events
\`\`\`
$(cat "$RESULTS_DIR/key-events.txt")
\`\`\`

## Success Criteria

- [ ] All 7 steps completed
- [ ] JSON file created and valid
- [ ] Schema validation passed
- [ ] Template registered successfully
- [ ] Test execution completed
- [ ] Summary markdown created
- [ ] No source code access attempted

## Full Logs

See: $RESULTS_DIR/acp-output.log
EOF

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
echo ""
cat "$RESULTS_DIR/SUMMARY.md"

# Return appropriate exit code
if [ $ACP_EXIT_CODE -eq 0 ] && [ $ERRORS -eq 0 ]; then
    echo ""
    echo "✅ Test PASSED"
    exit 0
else
    echo ""
    echo "❌ Test FAILED (see $RESULTS_DIR/SUMMARY.md for details)"
    exit 1
fi
