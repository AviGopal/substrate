#!/bin/bash
# Trace agent behavior during activity template creation
# Captures breadcrumbs, tool calls, and decision points

set -e

CONTAINER="${1:-devbob-clean}"
TEST_CASE="${2:-minimal}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_DIR="./validation-results/agent-behavior/$TIMESTAMP"

echo "=== Agent Behavior Tracing ==="
echo "Container: $CONTAINER"
echo "Test case: $TEST_CASE"
echo "Results: $RESULTS_DIR"
echo ""

mkdir -p "$RESULTS_DIR"

# Define test cases
case "$TEST_CASE" in
    minimal)
        PATTERN="Simple hello world activity that prints a message and exits successfully"
        ACTIVITY_NAME="Hello World"
        ACTIVITY_ID="hello-world-traced"
        CATEGORY="infrastructure"
        TEST_VARS='{"message":"Hello from tracing!"}'
        ;;
    complex)
        PATTERN="Backup files: 1) List source files, 2) Create backup directory, 3) Copy files to backup, 4) Verify all files copied"
        ACTIVITY_NAME="File Backup"
        ACTIVITY_ID="backup-files-traced"
        CATEGORY="infrastructure"
        TEST_VARS='{"source_dir":"/tmp/test","backup_dir":"/tmp/backup"}'
        ;;
    vague)
        PATTERN="Process data efficiently and output results"
        ACTIVITY_NAME="Data Processor"
        ACTIVITY_ID="process-data-traced"
        CATEGORY="refactor"
        TEST_VARS='{"input":"data.txt"}'
        ;;
    *)
        echo "Unknown test case: $TEST_CASE"
        echo "Available: minimal, complex, vague"
        exit 1
        ;;
esac

# Save test parameters
cat > "$RESULTS_DIR/test-config.json" <<EOF
{
  "test_case": "$TEST_CASE",
  "pattern": "$PATTERN",
  "activity_name": "$ACTIVITY_NAME",
  "activity_id": "$ACTIVITY_ID",
  "category": "$CATEGORY",
  "test_variables": $TEST_VARS,
  "timestamp": "$TIMESTAMP",
  "container": "$CONTAINER"
}
EOF

echo "Test configuration saved to: $RESULTS_DIR/test-config.json"
echo ""

# Create ACP prompt with tracing instructions
cat > "$RESULTS_DIR/acp-prompt.txt" <<EOF
IMPORTANT: I need you to execute an activity while I observe your decision-making process.

CONTEXT:
- You are in a STERILE environment (no source code)
- I will be tracing your execution with breadcrumb logging
- Please be VERBOSE about your reasoning at each step
- Explain WHY you make decisions, not just WHAT you do

TASK:
Execute the activity-create-v2 template to create a new activity:

activity({
  activityId: "activity-create-v2",
  variables: {
    activity_name: "$ACTIVITY_NAME",
    activity_id: "$ACTIVITY_ID",
    target_category: "$CATEGORY",
    source_pattern: "$PATTERN",
    test_variables: $TEST_VARS
  },
  reason: "Testing agent behavior during template creation - observing decision patterns"
})

REPORTING REQUIREMENTS:
At each of the 7 steps, please report:

1. **Step Name**: Which step you're executing
2. **Context Used**: What information you're referencing (examples, annotations, docs)
3. **Decision Made**: What you decided to do
4. **Reasoning**: WHY you made that decision
5. **Alternatives Considered**: What other options you evaluated
6. **Confidence**: How confident you are (high/medium/low)

Example format:
---
STEP: identify-pattern
CONTEXT: Reviewed pattern: "$PATTERN"
DECISION: Categorizing as $CATEGORY with 3 tasks
REASONING: Pattern suggests sequential workflow with clear validation points
ALTERNATIVES: Could be 2 tasks (simpler) or 4 tasks (more granular)
CONFIDENCE: High - pattern is clear and matches similar templates
---

This verbose reporting helps me understand your decision-making process.

Please begin execution now.
EOF

echo "Starting execution with behavior tracing..."
echo ""

# Start container log collection in background
docker logs -f "$CONTAINER" 2>&1 | grep -E "STAGE|breadcrumb|correlationId|activity" > "$RESULTS_DIR/container-logs.txt" &
LOG_PID=$!

# Start core log tailing (if accessible)
docker exec "$CONTAINER" bash -c "tail -f /root/.local/share/opencode/logs/core.log 2>/dev/null || echo 'Core log not accessible'" > "$RESULTS_DIR/core-logs.txt" &
CORE_LOG_PID=$!

# Execute activity via ACP with timeout
echo "Executing activity (timeout: 10 minutes)..."
timeout 600 docker exec -i "$CONTAINER" bash -c "cd /workspace && opencode acp --cwd /workspace --log-level DEBUG" < "$RESULTS_DIR/acp-prompt.txt" 2>&1 | tee "$RESULTS_DIR/acp-output.log"

ACP_EXIT_CODE=${PIPESTATUS[0]}

# Stop log collection
kill $LOG_PID 2>/dev/null || true
kill $CORE_LOG_PID 2>/dev/null || true

echo ""
echo "Execution complete. Analyzing agent behavior..."
echo ""

# Extract key decision points
echo "=== EXTRACTING DECISION POINTS ==="
grep -A 5 "STEP:\|DECISION:\|REASONING:\|ALTERNATIVES:" "$RESULTS_DIR/acp-output.log" > "$RESULTS_DIR/decision-points.txt" 2>/dev/null || echo "No explicit decision points found"

# Extract breadcrumbs
echo "=== EXTRACTING BREADCRUMBS ==="
grep -E "STAGE|correlationId|exec_" "$RESULTS_DIR/acp-output.log" > "$RESULTS_DIR/breadcrumbs.log" 2>/dev/null || echo "No breadcrumbs found"

if [ -s "$RESULTS_DIR/breadcrumbs.log" ]; then
    CORRELATION_ID=$(grep -o "exec_[a-f0-9]\+" "$RESULTS_DIR/breadcrumbs.log" | head -1)
    echo "Correlation ID: $CORRELATION_ID"
    
    # Extract stage transitions
    grep "$CORRELATION_ID" "$RESULTS_DIR/breadcrumbs.log" | grep -E "ENTER|EXIT|ERROR" > "$RESULTS_DIR/stage-transitions.txt"
    
    echo "Stage transitions captured: $(wc -l < "$RESULTS_DIR/stage-transitions.txt")"
else
    echo "⚠️  No breadcrumbs found in output (may be in container logs)"
    CORRELATION_ID=""
fi

# Extract tool calls
echo "=== EXTRACTING TOOL CALLS ==="
grep -E "tool:|Tool call|Calling tool|search_activities|register_activity_template|activity\(" "$RESULTS_DIR/acp-output.log" > "$RESULTS_DIR/tool-calls.txt" 2>/dev/null || echo "No tool calls found"
TOOL_COUNT=$(wc -l < "$RESULTS_DIR/tool-calls.txt")
echo "Tool calls captured: $TOOL_COUNT"

# Extract validation results
echo "=== EXTRACTING VALIDATION ==="
grep -i -A 3 "validation\|schema\|validate" "$RESULTS_DIR/acp-output.log" > "$RESULTS_DIR/validation-events.txt" 2>/dev/null || echo "No validation events found"

# Extract error patterns
echo "=== EXTRACTING ERRORS ==="
grep -i -B 2 -A 2 "error\|failed\|exception" "$RESULTS_DIR/acp-output.log" > "$RESULTS_DIR/errors.txt" 2>/dev/null || echo "No errors found"
ERROR_COUNT=$(grep -c -i "error\|failed" "$RESULTS_DIR/errors.txt" 2>/dev/null || echo "0")

# Check for created artifacts
echo "=== CHECKING ARTIFACTS ==="
docker exec "$CONTAINER" bash -c "find /tmp /workspace -name '$ACTIVITY_ID*.json' -o -name '*summary*.md' 2>/dev/null | head -20" > "$RESULTS_DIR/artifacts-found.txt" || true

if [ -s "$RESULTS_DIR/artifacts-found.txt" ]; then
    ARTIFACT_COUNT=$(wc -l < "$RESULTS_DIR/artifacts-found.txt")
    echo "Artifacts found: $ARTIFACT_COUNT"
    
    # Try to extract the template
    TEMPLATE_PATH=$(grep "$ACTIVITY_ID.json" "$RESULTS_DIR/artifacts-found.txt" | head -1)
    if [ -n "$TEMPLATE_PATH" ]; then
        docker exec "$CONTAINER" cat "$TEMPLATE_PATH" > "$RESULTS_DIR/created-template.json" 2>/dev/null || true
        if [ -s "$RESULTS_DIR/created-template.json" ]; then
            echo "✅ Template extracted to: $RESULTS_DIR/created-template.json"
            
            # Analyze template
            STEP_COUNT=$(jq '.task_steps | length' "$RESULTS_DIR/created-template.json" 2>/dev/null || echo "0")
            echo "   Task steps: $STEP_COUNT"
            
            # Extract task names
            jq -r '.task_steps[].description' "$RESULTS_DIR/created-template.json" 2>/dev/null > "$RESULTS_DIR/task-descriptions.txt" || true
        fi
    fi
else
    echo "⚠️  No artifacts found"
fi

# Generate analysis report
echo ""
echo "=== GENERATING ANALYSIS REPORT ==="

cat > "$RESULTS_DIR/ANALYSIS.md" <<EOF
# Agent Behavior Analysis

**Test Case**: $TEST_CASE  
**Date**: $(date)  
**Pattern**: $PATTERN  
**Correlation ID**: ${CORRELATION_ID:-Not found}

---

## Execution Summary

- **Exit Code**: $ACP_EXIT_CODE
- **Tool Calls**: $TOOL_COUNT
- **Errors**: $ERROR_COUNT
- **Artifacts Created**: $(wc -l < "$RESULTS_DIR/artifacts-found.txt" 2>/dev/null || echo "0")

---

## Decision Points Observed

\`\`\`
$(cat "$RESULTS_DIR/decision-points.txt" 2>/dev/null || echo "No explicit decision points captured")
\`\`\`

---

## Stage Transitions (Breadcrumbs)

\`\`\`
$(cat "$RESULTS_DIR/stage-transitions.txt" 2>/dev/null || echo "No breadcrumbs captured")
\`\`\`

---

## Tool Calls Made

\`\`\`
$(cat "$RESULTS_DIR/tool-calls.txt" 2>/dev/null || echo "No tool calls captured")
\`\`\`

---

## Validation Events

\`\`\`
$(cat "$RESULTS_DIR/validation-events.txt" 2>/dev/null || echo "No validation events captured")
\`\`\`

---

## Errors Encountered

\`\`\`
$(cat "$RESULTS_DIR/errors.txt" 2>/dev/null || echo "No errors encountered")
\`\`\`

---

## Created Template Analysis

$(if [ -f "$RESULTS_DIR/created-template.json" ]; then
    echo "### Template Structure"
    echo "\`\`\`json"
    jq '{name, category, task_count: (.task_steps | length), tasks: [.task_steps[].description]}' "$RESULTS_DIR/created-template.json" 2>/dev/null || echo "Could not parse template"
    echo "\`\`\`"
    
    echo ""
    echo "### Task Descriptions"
    echo "\`\`\`"
    cat "$RESULTS_DIR/task-descriptions.txt" 2>/dev/null || echo "No task descriptions"
    echo "\`\`\`"
else
    echo "Template was not created or could not be extracted"
fi)

---

## Behavioral Observations

### What Worked Well
- [ ] Agent referenced example templates
- [ ] Agent validated schema before proceeding
- [ ] Agent explained reasoning clearly
- [ ] Agent recovered from errors gracefully
- [ ] Agent created appropriate task count (3-5)
- [ ] Agent chose correct agent assignments
- [ ] Agent tested created template

### What Could Improve
- [ ] Agent skipped example review
- [ ] Agent created too many/few tasks
- [ ] Agent used vague validation
- [ ] Agent didn't test template
- [ ] Agent gave generic reasoning
- [ ] Agent ignored validation failures

### Pattern Recognition
- **Strong patterns**: (behaviors agent did well)
- **Weak patterns**: (behaviors agent struggled with)
- **Missing patterns**: (behaviors not observed)

---

## Recommendations for New Template

### Improvements Needed
1. 
2. 
3. 

### Context Requirements
1. 
2. 
3. 

### Validation Enhancements
1. 
2. 
3. 

---

## Raw Logs

- Full output: \`$RESULTS_DIR/acp-output.log\`
- Container logs: \`$RESULTS_DIR/container-logs.txt\`
- Core logs: \`$RESULTS_DIR/core-logs.txt\`

EOF

cat "$RESULTS_DIR/ANALYSIS.md"

echo ""
echo "=========================================="
echo "ANALYSIS COMPLETE"
echo "=========================================="
echo ""
echo "Review: $RESULTS_DIR/ANALYSIS.md"
echo ""

if [ $ACP_EXIT_CODE -eq 0 ]; then
    echo "✅ Execution succeeded"
else
    echo "❌ Execution failed (exit code: $ACP_EXIT_CODE)"
fi

exit $ACP_EXIT_CODE
