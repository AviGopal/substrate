#!/bin/bash
# Test bootstrap templates inside devbob container and examine performance
set -e

TEST_NUM="${1:-1}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="./proof-logs/iteration-${TIMESTAMP}"

mkdir -p "${LOG_DIR}"

echo "========================================="
echo "Bootstrap Template Iteration Test"
echo "========================================="
echo "Test: #${TEST_NUM}"
echo "Log Dir: ${LOG_DIR}"
echo ""

# Test Case 1: Create "Add Logging" template
cat > "${LOG_DIR}/test-prompt.txt" <<'EOF'
Create an activity template for adding logging statements.

Template name: Add Logging Statements
Description: Add comprehensive logging to functions at entry points, decision branches, and error paths
Category: tool
Template ID: add-logging

The template should have 3 tasks:
1. Analyze target code to identify key logging points (function entry/exit, branches, errors)
2. Add logging statements with appropriate log levels (DEBUG, INFO, WARNING, ERROR)
3. Validate that logging doesn't break functionality

Variables:
- targetFile: Path to file to add logging to (required, string)
- functionName: Specific function to instrument - if not provided, instrument all functions (optional, string)
- logLevel: Minimum log level to add (optional, string, default: INFO)
EOF

echo "Test prompt saved to: ${LOG_DIR}/test-prompt.txt"
echo ""
echo "Executing test in devbob container..."
echo ""

# Execute with timing
START_TIME=$(date +%s)

docker exec -i devbob-clean sh -c "
cd /workspace && \
opencode run 2>&1
" < "${LOG_DIR}/test-prompt.txt" | tee "${LOG_DIR}/execution-log.txt"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "========================================="
echo "Execution Complete"
echo "========================================="
echo "Duration: ${DURATION} seconds"
echo ""

# Check for output files
echo "Checking for generated files..."
docker exec devbob-clean sh -c "ls -la /tmp/activity-add-logging/ 2>&1" | tee "${LOG_DIR}/output-files.txt"

# Check if template was created
if docker exec devbob-clean test -f /tmp/activity-add-logging/template.json; then
    echo "✅ Template JSON created"
    docker exec devbob-clean cat /tmp/activity-add-logging/template.json > "${LOG_DIR}/generated-template.json"
    
    # Validate JSON
    if jq empty "${LOG_DIR}/generated-template.json" 2>/dev/null; then
        echo "✅ Template JSON is valid"
        
        # Extract key info
        jq '{activity_id, name, category, task_count: (.task_steps | length)}' "${LOG_DIR}/generated-template.json" > "${LOG_DIR}/template-summary.json"
        cat "${LOG_DIR}/template-summary.json"
    else
        echo "❌ Template JSON is invalid"
    fi
else
    echo "❌ Template JSON not created"
fi

# Check if success file was created
if docker exec devbob-clean test -f /tmp/activity-add-logging/SUCCESS.md; then
    echo "✅ Success file created"
    docker exec devbob-clean cat /tmp/activity-add-logging/SUCCESS.md > "${LOG_DIR}/success-message.md"
else
    echo "❌ Success file not created"
fi

# Check backend registration
echo ""
echo "Checking backend for new template..."
docker exec devbob-clean curl -sf http://api-server-dev:8080/v2/activities/templates 2>&1 | \
    python3 -c "
import sys, json
data = json.load(sys.stdin)
templates = data.get('templates', [])
found = False
for t in templates:
    if 'add-logging' in t['activity_id'].lower():
        found = True
        print(f\"✅ Template registered: {t['activity_id']}\")
        print(f\"   Variant ID: {t['variant_id']}\")
        print(f\"   Generation: {t['genealogy']['generation']}\")
if not found:
    print('❌ Template not found in backend')
" | tee -a "${LOG_DIR}/backend-check.txt"

# Extract error patterns from log
echo ""
echo "Analyzing execution log for errors..."
grep -i "error\|failed\|exception\|traceback" "${LOG_DIR}/execution-log.txt" > "${LOG_DIR}/errors.txt" 2>/dev/null || echo "No errors found"

if [ -s "${LOG_DIR}/errors.txt" ]; then
    echo "⚠️  Errors detected:"
    head -20 "${LOG_DIR}/errors.txt"
else
    echo "✅ No errors detected"
fi

# Generate summary
cat > "${LOG_DIR}/SUMMARY.md" <<SUMMARY
# Test Execution Summary

**Test Number**: ${TEST_NUM}
**Timestamp**: ${TIMESTAMP}
**Duration**: ${DURATION} seconds

## Test Case
Create "Add Logging Statements" template (tool category)

## Results

### File Generation
- Template JSON: $(docker exec devbob-clean test -f /tmp/activity-add-logging/template.json && echo "✅ Created" || echo "❌ Missing")
- Success Message: $(docker exec devbob-clean test -f /tmp/activity-add-logging/SUCCESS.md && echo "✅ Created" || echo "❌ Missing")

### Validation
- JSON Valid: $(jq empty "${LOG_DIR}/generated-template.json" 2>/dev/null && echo "✅ Valid" || echo "❌ Invalid")
- Backend Registration: $(grep "✅ Template registered" "${LOG_DIR}/backend-check.txt" > /dev/null 2>&1 && echo "✅ Registered" || echo "❌ Not registered")

### Errors
$([ -s "${LOG_DIR}/errors.txt" ] && echo "⚠️  Errors detected (see errors.txt)" || echo "✅ No errors")

### Performance
- Duration: ${DURATION}s
- Target: < 120s (2 minutes)
- Status: $([ ${DURATION} -lt 120 ] && echo "✅ Within target" || echo "⚠️  Exceeded target")

## Files Generated
\`\`\`
${LOG_DIR}/
├── test-prompt.txt          # Input prompt
├── execution-log.txt        # Full OpenCode output
├── output-files.txt         # ls output from /tmp/activity-add-logging/
├── generated-template.json  # Created template (if successful)
├── template-summary.json    # Extracted key info
├── success-message.md       # Success message (if created)
├── backend-check.txt        # Backend registration check
├── errors.txt               # Extracted errors (if any)
└── SUMMARY.md               # This file
\`\`\`

## Next Steps

$(if [ -f "${LOG_DIR}/generated-template.json" ] && jq empty "${LOG_DIR}/generated-template.json" 2>/dev/null; then
    echo "✅ **SUCCESS** - Template created successfully"
    echo "- Review generated template for quality"
    echo "- Test the generated template with sample inputs"
    echo "- Run 5 more iterations to gather metrics"
else
    echo "❌ **FAILED** - Template creation failed"
    echo "- Review execution-log.txt for failure cause"
    echo "- Identify failure mode (task 1? task 2? validation?)"
    echo "- Iterate on create-activity-template to fix issue"
fi)

## Iteration Strategy

1. **If successful**: Run diverse test cases (feature, bugfix, refactor templates)
2. **If failed**: Examine logs, fix root cause, create new variant (gen 2)
3. **After 5 runs**: Check Thompson Sampling metrics and success rate
4. **If 80%+ success**: Promote to metabob-proto
5. **If < 80% success**: Use evolve-activity-template to improve
SUMMARY

cat "${LOG_DIR}/SUMMARY.md"

echo ""
echo "========================================="
echo "Test Complete"
echo "========================================="
echo "Full logs: ${LOG_DIR}/"
echo ""
