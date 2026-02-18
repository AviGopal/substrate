# Activity Template Sterile Environment Test Plan

**Date**: February 14, 2026  
**Objective**: Validate that `activity-create-v2` template works in sterile environments without source code access

## Executive Summary

The `activity-create-v2` template must be **self-contained** and work in environments with:
- ✅ No source code present
- ✅ No git repository
- ✅ Only OpenCode CLI + Metabob backend available
- ✅ Empty /workspace directory

## Template Analysis

### Current Template: activity-create-v2.json

**Location**: `repos/metabob-proto/activities/bootstrap/activity-create-v2.json`

**7 Steps**:
1. `identify-pattern` - Analyze pattern description (requires only variable input)
2. `define-scope` - Create scope definition (depends on step 1 output)
3. `design-steps` - Design task steps (depends on step 2 output)
4. `create-template` - Write JSON file (depends on step 3 output)
5. `validate-schema` - Uses `register_activity_template` tool (NEW functionality)
6. `test-execute` - Uses `activity` tool to test (NEW functionality)
7. `create-summary` - Document the template (depends on previous steps)

### Source Code Dependencies Audit

**✅ GOOD - No source code dependencies found**:
- Step 1: Uses `source_pattern` variable (user-provided string)
- Step 2-3: Uses previous step outputs (PATTERN_ANALYSIS.md, SCOPE_DEFINITION.md)
- Step 4: Creates JSON from step 3 design
- Step 5: Uses `register_activity_template` tool (backend API call)
- Step 6: Uses `activity` tool (backend API call)
- Step 7: Creates summary from previous work

**⚠️ POTENTIAL ISSUES**:
1. Step 1 guidance mentions "Look for recurring user intents" - could confuse agent if source_pattern is vague
2. Step 5 `requiredPatterns: ["✓ Validation passed", "success.*true"]` - relies on tool output format
3. Step 6 forbiddenPatterns includes "Error:", "Exception:" - might catch legitimate content in template descriptions

### New Functionality Usage

**✅ Uses register_activity_template tool**:
- Step 5: validate_only=true (schema validation)
- Step 6: validate_only=false (registration + execution)

**✅ Uses activity tool**:
- Step 6: Executes the newly created template with test variables

**✅ Uses hooks**:
- preActivity: temporary working directory
- postActivity: extractFiles, createSummary, captureMetrics
- onError: enableTrailblazing, maxRecoveryAttempts

## Test Strategy

### Test 1: Minimal Sterile Environment Test
**Environment**: devbob-clean container (/workspace empty)
**Input**:
```json
{
  "activity_name": "Hello World Demo",
  "activity_id": "hello-world-demo-v1",
  "target_category": "infrastructure",
  "source_pattern": "User requests a simple hello world activity that prints a message",
  "test_variables": {
    "message": "Hello from sterile test!"
  }
}
```
**Expected**: Template creates a simple 1-2 step activity that prints a message

### Test 2: Complex Pattern Without Code
**Environment**: devbob-clean container (/workspace empty)
**Input**:
```json
{
  "activity_name": "File Backup",
  "activity_id": "backup-files-v1",
  "target_category": "infrastructure",
  "source_pattern": "User has files they want to backup. Steps: 1) List files, 2) Create backup directory, 3) Copy files, 4) Verify backup",
  "test_variables": {
    "source_dir": "/tmp/test",
    "backup_dir": "/tmp/backup"
  }
}
```
**Expected**: Template creates 4-step activity matching the pattern

### Test 3: Edge Case - Vague Pattern
**Environment**: devbob-clean container
**Input**:
```json
{
  "activity_name": "Process Data",
  "activity_id": "process-data-v1",
  "target_category": "refactor",
  "source_pattern": "Process some data efficiently"
}
```
**Expected**: Agent should handle vague pattern gracefully, potentially using trailblazing

### Test 4: Schema Validation Edge Cases
**Environment**: devbob-clean container
**Input**: Deliberately create template with schema issues
**Expected**: Step 5 catches issues, agent fixes them through retry mechanism

## Testing Infrastructure

### Required Components
1. ✅ **devbob-clean container** - Running and healthy
2. ✅ **Backend API** - Port 8082 (needs verification)
3. ✅ **SurrealDB** - Database backend
4. ⚠️ **Session token** - Needs to be created/refreshed

### Test Harness Script

Create: `scripts/test-activity-create-sterile.sh`

```bash
#!/bin/bash
# Test activity-create-v2 in sterile environment

set -e

CONTAINER_NAME="${1:-devbob-clean}"
TEST_CASE="${2:-minimal}"

echo "=== Testing activity-create-v2 in sterile environment ==="
echo "Container: $CONTAINER_NAME"
echo "Test case: $TEST_CASE"

# Verify container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "❌ Container $CONTAINER_NAME is not running"
    exit 1
fi

# Check workspace is empty
echo "Checking workspace..."
docker exec "$CONTAINER_NAME" bash -c "ls -la /workspace"

# Create test input based on test case
case "$TEST_CASE" in
    minimal)
        ACTIVITY_NAME="Hello World Demo"
        ACTIVITY_ID="hello-world-demo-v1"
        CATEGORY="infrastructure"
        PATTERN="User requests a simple hello world activity that prints a message"
        TEST_VARS='{"message":"Hello from sterile test!"}'
        ;;
    complex)
        ACTIVITY_NAME="File Backup"
        ACTIVITY_ID="backup-files-v1"
        CATEGORY="infrastructure"
        PATTERN="User has files they want to backup. Steps: 1) List files, 2) Create backup directory, 3) Copy files, 4) Verify backup"
        TEST_VARS='{"source_dir":"/tmp/test","backup_dir":"/tmp/backup"}'
        ;;
    vague)
        ACTIVITY_NAME="Process Data"
        ACTIVITY_ID="process-data-v1"
        CATEGORY="refactor"
        PATTERN="Process some data efficiently"
        TEST_VARS='{}'
        ;;
esac

# Execute activity via ACP
echo "Executing activity-create-v2..."
docker exec -i "$CONTAINER_NAME" opencode acp --cwd /workspace <<EOF
Execute the activity-create-v2 template with these parameters:

activity({
  activityId: "activity-create-v2",
  variables: {
    activity_name: "$ACTIVITY_NAME",
    activity_id: "$ACTIVITY_ID",
    target_category: "$CATEGORY",
    source_pattern: "$PATTERN",
    test_variables: $TEST_VARS
  },
  reason: "Test sterile environment execution - no source code present"
})

Report the results including:
- Which steps completed successfully
- Any validation errors encountered
- Whether the template was created and registered
- Test execution results
EOF

echo "✅ Test complete"
```

### Validation Criteria

**Success Metrics**:
- [ ] All 7 steps complete without errors
- [ ] JSON file is created and valid
- [ ] Schema validation passes (register_activity_template with validate_only=true)
- [ ] Template is registered successfully
- [ ] Test execution runs without errors
- [ ] Summary markdown is created

**Failure Indicators**:
- Agent tries to read source code files that don't exist
- Agent gets stuck on vague patterns
- Schema validation fails repeatedly
- Template execution fails on test run
- Trailblazing recovery exceeds max attempts

## Implementation Plan

### Phase 1: Environment Setup (15 min)
- [ ] Verify devbob-clean container status
- [ ] Check backend API connectivity
- [ ] Create/refresh session token
- [ ] Verify workspace is empty

### Phase 2: Test Execution (45 min)
- [ ] Run Test 1 (minimal)
- [ ] Run Test 2 (complex)
- [ ] Run Test 3 (vague)
- [ ] Document results for each test

### Phase 3: Issue Remediation (variable)
- [ ] Identify any source code dependencies
- [ ] Fix validation pattern issues
- [ ] Improve prompts for clarity
- [ ] Test fixes

### Phase 4: Documentation (30 min)
- [ ] Create validation report
- [ ] Update template with lessons learned
- [ ] Document sterile environment best practices

## Known Issues & Mitigations

### Issue 1: Backend API Connection
**Problem**: Backend might not be accessible from devbob container
**Mitigation**: 
- Check `docker exec devbob-clean curl http://localhost:8080/status`
- Update .metabob/config.json with correct endpoint
- Ensure session token is valid

### Issue 2: Vague Pattern Handling
**Problem**: Step 1 might struggle with vague source_pattern
**Mitigation**:
- Add guidance in prompt: "If pattern is vague, design a simple 2-3 step template"
- Increase max_attempts for step 1
- Improve fallback_prompt

### Issue 3: Validation Pattern Matching
**Problem**: requiredPatterns might be too strict or tool-output-dependent
**Mitigation**:
- Make patterns more flexible (regex-based)
- Check actual tool output format first
- Add alternative success indicators

## Success Criteria

### Template is STERILE-READY if:
✅ Works with empty /workspace  
✅ Requires only user-provided variables  
✅ Uses register_activity_template tool  
✅ Uses activity tool for testing  
✅ All validations pass without source code  
✅ Creates functional template from description alone  
✅ Self-validates and self-tests  
✅ Trailblazing handles edge cases  

## Next Steps

1. **Immediate**: Run Test 1 in devbob-clean container
2. **Short-term**: Fix any issues discovered, run Tests 2-3
3. **Medium-term**: Package validated template with metabob-proto
4. **Long-term**: Create sterile test suite for all bootstrap templates

---

**Status**: Ready for Testing  
**Blockers**: None identified  
**Risk Level**: Low (template appears self-contained)
