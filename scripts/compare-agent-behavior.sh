#!/bin/bash
# Compare agent behavior across multiple test executions
# Extracts patterns and generates comparative analysis

RESULTS_DIR="${1:-validation-results/agent-behavior}"

if [ ! -d "$RESULTS_DIR" ]; then
    echo "Results directory not found: $RESULTS_DIR"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPARISON_FILE="$RESULTS_DIR/COMPARISON_${TIMESTAMP}.md"

echo "=== Comparing Agent Behavior Across Tests ==="
echo "Results directory: $RESULTS_DIR"
echo "Output: $COMPARISON_FILE"
echo ""

# Find all test results
TEST_DIRS=$(find "$RESULTS_DIR" -maxdepth 1 -type d -name "2*" | sort)
TEST_COUNT=$(echo "$TEST_DIRS" | wc -l)

if [ $TEST_COUNT -eq 0 ]; then
    echo "No test results found in $RESULTS_DIR"
    exit 1
fi

echo "Found $TEST_COUNT test executions"
echo ""

# Generate comparison report
cat > "$COMPARISON_FILE" <<'EOF'
# Agent Behavior Comparison Report

**Generated**: $(date)  
**Test Executions**: TEST_COUNT

---

## Executive Summary

### Success Rate
EOF

# Count successes and failures
SUCCESS_COUNT=0
FAILURE_COUNT=0

for dir in $TEST_DIRS; do
    if [ -f "$dir/test-config.json" ]; then
        EXIT_CODE=$(grep -o '"exit_code":[0-9]*' "$dir/ANALYSIS.md" 2>/dev/null | cut -d: -f2 || echo "1")
        if [ "$EXIT_CODE" = "0" ]; then
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            FAILURE_COUNT=$((FAILURE_COUNT + 1))
        fi
    fi
done

cat >> "$COMPARISON_FILE" <<EOF

- **Successful**: $SUCCESS_COUNT / $TEST_COUNT
- **Failed**: $FAILURE_COUNT / $TEST_COUNT
- **Success Rate**: $(awk "BEGIN {printf \"%.1f\", ($SUCCESS_COUNT * 100.0 / $TEST_COUNT)}")%

---

## Test Case Breakdown

| Test Case | Status | Task Count | Tool Calls | Errors | Duration | Template Created |
|-----------|--------|-----------|-----------|--------|----------|------------------|
EOF

# Populate table
for dir in $TEST_DIRS; do
    if [ -f "$dir/test-config.json" ]; then
        TEST_CASE=$(jq -r '.test_case' "$dir/test-config.json" 2>/dev/null || echo "unknown")
        
        # Extract metrics from analysis
        EXIT_CODE=$(grep "Exit Code:" "$dir/ANALYSIS.md" 2>/dev/null | awk '{print $NF}' || echo "?")
        TOOL_CALLS=$(grep "Tool Calls:" "$dir/ANALYSIS.md" 2>/dev/null | awk '{print $NF}' || echo "?")
        ERRORS=$(grep "Errors:" "$dir/ANALYSIS.md" 2>/dev/null | awk '{print $NF}' || echo "?")
        
        # Status emoji
        if [ "$EXIT_CODE" = "0" ]; then
            STATUS="✅"
        else
            STATUS="❌"
        fi
        
        # Task count from created template
        if [ -f "$dir/created-template.json" ]; then
            TASK_COUNT=$(jq '.task_steps | length' "$dir/created-template.json" 2>/dev/null || echo "?")
            TEMPLATE_STATUS="✅"
        else
            TASK_COUNT="N/A"
            TEMPLATE_STATUS="❌"
        fi
        
        # Duration (rough estimate from logs)
        DURATION="?"
        if [ -f "$dir/acp-output.log" ]; then
            START_TIME=$(head -5 "$dir/acp-output.log" | grep -o "[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}" | head -1)
            END_TIME=$(tail -5 "$dir/acp-output.log" | grep -o "[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}" | tail -1)
            if [ -n "$START_TIME" ] && [ -n "$END_TIME" ]; then
                DURATION="~5m"  # Rough estimate
            fi
        fi
        
        echo "| $TEST_CASE | $STATUS | $TASK_COUNT | $TOOL_CALLS | $ERRORS | $DURATION | $TEMPLATE_STATUS |" >> "$COMPARISON_FILE"
    fi
done

cat >> "$COMPARISON_FILE" <<'EOF'

---

## Pattern Analysis

### Consistent Behaviors (Across All Tests)

EOF

# Extract common patterns
echo "#### Tool Usage" >> "$COMPARISON_FILE"
echo "" >> "$COMPARISON_FILE"

# Check which tools were used in all tests
COMMON_TOOLS=""
for tool in "search_activities" "register_activity_template" "activity"; do
    USED_COUNT=0
    for dir in $TEST_DIRS; do
        if [ -f "$dir/tool-calls.txt" ] && grep -q "$tool" "$dir/tool-calls.txt"; then
            USED_COUNT=$((USED_COUNT + 1))
        fi
    done
    
    if [ $USED_COUNT -eq $TEST_COUNT ]; then
        echo "- ✅ **$tool**: Used in all $TEST_COUNT tests (100%)" >> "$COMPARISON_FILE"
    elif [ $USED_COUNT -gt 0 ]; then
        PERCENTAGE=$(awk "BEGIN {printf \"%.0f\", ($USED_COUNT * 100.0 / $TEST_COUNT)}")
        echo "- ⚠️  **$tool**: Used in $USED_COUNT/$TEST_COUNT tests ($PERCENTAGE%)" >> "$COMPARISON_FILE"
    else
        echo "- ❌ **$tool**: Never used (0%)" >> "$COMPARISON_FILE"
    fi
done

echo "" >> "$COMPARISON_FILE"
echo "#### Decision Quality" >> "$COMPARISON_FILE"
echo "" >> "$COMPARISON_FILE"

# Check for decision explanations
EXPLAINED_COUNT=0
for dir in $TEST_DIRS; do
    if [ -f "$dir/decision-points.txt" ] && [ -s "$dir/decision-points.txt" ]; then
        EXPLAINED_COUNT=$((EXPLAINED_COUNT + 1))
    fi
done

if [ $EXPLAINED_COUNT -eq $TEST_COUNT ]; then
    echo "- ✅ Agent provided reasoning in all tests" >> "$COMPARISON_FILE"
elif [ $EXPLAINED_COUNT -gt 0 ]; then
    echo "- ⚠️  Agent provided reasoning in $EXPLAINED_COUNT/$TEST_COUNT tests" >> "$COMPARISON_FILE"
else
    echo "- ❌ Agent did not explain reasoning (verbose reporting not working)" >> "$COMPARISON_FILE"
fi

echo "" >> "$COMPARISON_FILE"
echo "### Varying Behaviors (Test-Specific)" >> "$COMPARISON_FILE"
echo "" >> "$COMPARISON_FILE"

# Task count variation
echo "#### Task Count by Test Case" >> "$COMPARISON_FILE"
echo "" >> "$COMPARISON_FILE"

for dir in $TEST_DIRS; do
    if [ -f "$dir/created-template.json" ]; then
        TEST_CASE=$(jq -r '.test_case' "$dir/test-config.json" 2>/dev/null || echo "unknown")
        TASK_COUNT=$(jq '.task_steps | length' "$dir/created-template.json" 2>/dev/null || echo "?")
        
        if [ "$TASK_COUNT" -ge 3 ] && [ "$TASK_COUNT" -le 5 ]; then
            echo "- ✅ **$TEST_CASE**: $TASK_COUNT tasks (optimal range)" >> "$COMPARISON_FILE"
        elif [ "$TASK_COUNT" != "?" ]; then
            echo "- ⚠️  **$TEST_CASE**: $TASK_COUNT tasks (outside optimal 3-5 range)" >> "$COMPARISON_FILE"
        else
            echo "- ❌ **$TEST_CASE**: Template not created" >> "$COMPARISON_FILE"
        fi
    fi
done

cat >> "$COMPARISON_FILE" <<'EOF'

---

## Success Patterns (Reinforce These)

Based on successful executions, the agent consistently:

EOF

# Extract success patterns from successful tests
SUCCESS_PATTERNS=()

# Check for example template usage
EXAMPLE_USE_COUNT=0
for dir in $TEST_DIRS; do
    if [ -f "$dir/tool-calls.txt" ] && grep -q "search_activities" "$dir/tool-calls.txt"; then
        EXAMPLE_USE_COUNT=$((EXAMPLE_USE_COUNT + 1))
    fi
done

if [ $EXAMPLE_USE_COUNT -gt 0 ]; then
    echo "1. **References Example Templates**: Agent searches for similar templates before designing ($EXAMPLE_USE_COUNT/$TEST_COUNT tests)" >> "$COMPARISON_FILE"
fi

# Check for validation
VALIDATION_COUNT=0
for dir in $TEST_DIRS; do
    if [ -f "$dir/validation-events.txt" ] && [ -s "$dir/validation-events.txt" ]; then
        VALIDATION_COUNT=$((VALIDATION_COUNT + 1))
    fi
done

if [ $VALIDATION_COUNT -gt 0 ]; then
    echo "2. **Validates Schemas**: Agent performs validation before registration ($VALIDATION_COUNT/$TEST_COUNT tests)" >> "$COMPARISON_FILE"
fi

# Check for testing
TEST_EXECUTION_COUNT=0
for dir in $TEST_DIRS; do
    if [ -f "$dir/tool-calls.txt" ] && grep -q "activity(" "$dir/tool-calls.txt"; then
        TEST_EXECUTION_COUNT=$((TEST_EXECUTION_COUNT + 1))
    fi
done

if [ $TEST_EXECUTION_COUNT -gt 0 ]; then
    echo "3. **Tests Created Templates**: Agent executes created template to verify ($TEST_EXECUTION_COUNT/$TEST_COUNT tests)" >> "$COMPARISON_FILE"
fi

cat >> "$COMPARISON_FILE" <<'EOF'

---

## Failure Patterns (Prevent These)

Based on failed or problematic executions:

EOF

# Extract failure patterns
FAILURE_PATTERNS=()

# Check for missing example review
SKIPPED_EXAMPLES=$((TEST_COUNT - EXAMPLE_USE_COUNT))
if [ $SKIPPED_EXAMPLES -gt 0 ]; then
    echo "1. **Skips Example Review**: Agent sometimes doesn't search for similar templates ($SKIPPED_EXAMPLES/$TEST_COUNT tests)" >> "$COMPARISON_FILE"
fi

# Check for validation skipping
SKIPPED_VALIDATION=$((TEST_COUNT - VALIDATION_COUNT))
if [ $SKIPPED_VALIDATION -gt 0 ]; then
    echo "2. **Skips Validation**: Agent sometimes doesn't validate schema ($SKIPPED_VALIDATION/$TEST_COUNT tests)" >> "$COMPARISON_FILE"
fi

# Check for test skipping
SKIPPED_TESTING=$((TEST_COUNT - TEST_EXECUTION_COUNT))
if [ $SKIPPED_TESTING -gt 0 ]; then
    echo "3. **Skips Testing**: Agent sometimes doesn't test created template ($SKIPPED_TESTING/$TEST_COUNT tests)" >> "$COMPARISON_FILE"
fi

# Check for errors
TOTAL_ERRORS=0
for dir in $TEST_DIRS; do
    if [ -f "$dir/errors.txt" ]; then
        ERROR_COUNT=$(wc -l < "$dir/errors.txt")
        TOTAL_ERRORS=$((TOTAL_ERRORS + ERROR_COUNT))
    fi
done

if [ $TOTAL_ERRORS -gt 0 ]; then
    echo "4. **Encounters Errors**: Total of $TOTAL_ERRORS error events across all tests" >> "$COMPARISON_FILE"
fi

cat >> "$COMPARISON_FILE" <<'EOF'

---

## Recommendations for New Template

### Required Context (contextRequirements)

EOF

echo "1. **Example Templates**: Search for 3+ similar templates with high success rates" >> "$COMPARISON_FILE"
if [ $EXAMPLE_USE_COUNT -eq $TEST_COUNT ]; then
    echo "   - Current behavior: ✅ Already doing this consistently" >> "$COMPARISON_FILE"
else
    echo "   - Current behavior: ⚠️  Only in $EXAMPLE_USE_COUNT/$TEST_COUNT tests - make REQUIRED" >> "$COMPARISON_FILE"
fi

echo "" >> "$COMPARISON_FILE"
echo "2. **Failure Patterns**: Load annotations about common mistakes" >> "$COMPARISON_FILE"
echo "   - Purpose: Help agent avoid known pitfalls" >> "$COMPARISON_FILE"

cat >> "$COMPARISON_FILE" <<'EOF'

### Validation Gates (task.validation)

1. **Step 4 (create-template)**: MUST run validation script before proceeding
   - check: command
   - command: `bash scripts/validate-activity-template.sh *.json`
   - required: true
   - Reason: Prevents invalid schemas from being registered

2. **Step 5 (validate-schema)**: MUST retry on validation failure (max 3 attempts)
   - retry.max_attempts: 3
   - retry.strategy: "progressive-context"
   - Reason: Gives agent chances to fix issues

3. **Step 6 (test-execute)**: MUST use activity tool to test created template
   - requiredPatterns: ["activity(", "activityId:"]
   - Reason: Ensures template actually works before registration

### Prompt Enhancements

1. **Step 1 (identify-pattern)**: Add explicit guidance for vague inputs
   - "If pattern is vague (< 50 words), generate 3 clarifying questions"
   - "Document assumptions clearly if proceeding with vague input"

2. **Step 2 (define-scope)**: Add task count guidance
   - "Optimal task count: 3-5"
   - "If >5 tasks, consider splitting into multiple templates"
   - "If <3 tasks, verify pattern isn't too simple"

3. **Step 3 (design-steps)**: Add agent selection guide
   - Provide table mapping task types → appropriate agents
   - "config" for schema changes, "test" for test coverage, etc.

### Impulse Strategy

EOF

echo "- **highQualityExamples**: Budget 5000-8000 tokens (observed: examples are crucial)" >> "$COMPARISON_FILE"
echo "- **failurePatterns**: Budget 2000-4000 tokens (observed: helps avoid mistakes)" >> "$COMPARISON_FILE"
echo "- **validationLibrary**: Budget 1000-2000 tokens (new: provide validation patterns)" >> "$COMPARISON_FILE"

cat >> "$COMPARISON_FILE" <<'EOF'

---

## Next Steps

1. **Review Detailed Logs**
   - Read ANALYSIS.md for each test case
   - Note specific decision points and reasoning
   - Extract additional patterns not captured here

2. **Design New Template**
   - Incorporate required context from recommendations
   - Add validation gates at critical steps
   - Enhance prompts with clear guidance
   - Implement retry strategies for common failures

3. **Test New Template**
   - Run same 3 test cases with new template
   - Compare success rates and quality metrics
   - Iterate based on results

---

## Detailed Test Results

EOF

# Link to individual test reports
for dir in $TEST_DIRS; do
    if [ -f "$dir/test-config.json" ]; then
        TEST_CASE=$(jq -r '.test_case' "$dir/test-config.json" 2>/dev/null || echo "unknown")
        TIMESTAMP=$(basename "$dir")
        echo "- **$TEST_CASE** ($TIMESTAMP): \`$dir/ANALYSIS.md\`" >> "$COMPARISON_FILE"
    fi
done

echo "" >> "$COMPARISON_FILE"
echo "---" >> "$COMPARISON_FILE"
echo "" >> "$COMPARISON_FILE"
echo "*Generated by compare-agent-behavior.sh*" >> "$COMPARISON_FILE"

# Replace placeholders
sed -i "s/TEST_COUNT/$TEST_COUNT/g" "$COMPARISON_FILE"

echo ""
echo "=========================================="
echo "COMPARISON COMPLETE"
echo "=========================================="
echo ""
cat "$COMPARISON_FILE"

echo ""
echo "Full report saved to: $COMPARISON_FILE"
