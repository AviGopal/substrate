# Learning Loop End-to-End Test Guide

## Overview
This guide walks through validating the complete learning loop with validation scripts that:
- **FAIL** before the test (no data exists)
- **PASS** after the test (data recorded)

## Prerequisites
- Backend running: `http://localhost:8080`
- OpenCode session active with metabob-cli MCP
- `METABOB_API_KEY` environment variable set

## Test Procedure

### Step 1: Pre-Test Validation (Should PASS for infrastructure)
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

python3 scripts/validate_learning_loop.py --mode pre-test
```

**Expected Output**:
```
✅ MCP Tools: READY
  ✅ query_activity_impulses
  ✅ record_impulse_usage

✅ Backend API: READY
  ✅ POST /v2/impulses/record-usage - Available
  ✅ GET /v2/impulses/for-activity/test-activity - Available
  ✅ GET /v2/impulses/learned - Available

✅ Database Schema: READY

✅ INFRASTRUCTURE READY - Proceed with test
⚠️  Expected: No impulse data should exist yet
```

**Exit code**: 0 (success) - Infrastructure is ready

---

### Step 2: Run Test Activity
Execute an activity that uses impulses:

```bash
# In OpenCode session
activity({
  templateId: "add-feature-complete",
  variables: {
    featureName: "test learning loop",
    files: ["test.txt"],
    description: "Testing impulse recording"
  },
  reason: "Validate learning loop records impulse usage"
})
```

**Alternative**: Create a simple test file and run any activity
```bash
echo "test" > /tmp/test-learning-loop.txt

# Use any activity - even a simple one
# The key is that it should complete successfully with some impulses loaded
```

**What to watch for in logs**:
```
[activity] Recording impulse usage for task
  execution_id: "act_exec_..."
  task_id: "task-1"
  impulse_count: N

[metabob-cli] record_impulse_usage: Recorded N usage records
```

---

### Step 3: Post-Test Validation (Should PASS with data)
```bash
python3 scripts/validate_learning_loop.py --mode post-test --activity-id add-feature-complete
```

**Expected Output**:
```
✅ MCP Tools: VERIFIED

✅ Recorded Data: VERIFIED
  ✅ Found activity: Add Feature Complete
  ℹ️  Total executions: 1
  ℹ️  Success rate: 100.0%
  ℹ️  Impulses recorded: 3
  ✅ LEARNING LOOP WORKING - 3 impulses recorded!

Top 3 impulses:
  1. imp_abc123 - used 1 times, success rate: 100.0%
  2. imp_def456 - used 1 times, success rate: 100.0%
  3. imp_ghi789 - used 1 times, success rate: 100.0%

✅ LEARNING LOOP VALIDATED - Data recorded successfully!
🔵 The loop is working: impulses were recorded and can be queried
```

**Exit code**: 0 (success) - Data was recorded!

---

### Step 4: Test Reverse Flow (Pre-loading)
Run the **same activity again** to verify learned impulses are pre-loaded:

```bash
# In OpenCode session - same activity as Step 2
activity({
  templateId: "add-feature-complete",
  variables: {
    featureName: "test learning loop iteration 2",
    files: ["test2.txt"],
    description: "Second run should pre-load learned impulses"
  },
  reason: "Verify reverse flow pre-loads learned impulses"
})
```

**What to watch for in logs**:
```
[activity] Querying learned impulses for activity
  variantId: "add-feature-complete"
  minSuccessRate: 0.6
  limit: 5

[metabob-cli] query_activity_impulses: Found 3 proven impulses

[activity] Pre-loaded learned impulses for activity
  learnedCount: 3
  impulseIds: ["imp_abc123", "imp_def456", "imp_ghi789"]
```

---

### Step 5: Verify Loop Closure
Run post-test validation again to see updated metrics:

```bash
python3 scripts/validate_learning_loop.py --mode post-test --activity-id add-feature-complete
```

**Expected Output** (after second run):
```
✅ Found activity: Add Feature Complete
  ℹ️  Total executions: 2
  ℹ️  Success rate: 100.0%
  ℹ️  Impulses recorded: 3
  
Top 3 impulses:
  1. imp_abc123 - used 2 times, success rate: 100.0%  ← Usage count increased!
  2. imp_def456 - used 2 times, success rate: 100.0%
  3. imp_ghi789 - used 2 times, success rate: 100.0%
```

**Success Criteria**:
- ✅ Usage counts increased from 1 → 2
- ✅ Same impulses appear in both executions
- ✅ Pre-loading happened on second run (check logs)
- ✅ Success rates maintained or improved

---

## Troubleshooting

### Pre-Test Validation Fails

**MCP Tools Not Found**:
```bash
# Restart OpenCode to reload MCP server
# Or check that activity_tools is imported in server.py
cd repos/metabob-cli
grep "import.*activity_tools" src/metabob_cli/mcp/server.py
```

**Backend Not Reachable**:
```bash
# Check backend is running
curl http://localhost:8080/health

# Check API key
echo $METABOB_API_KEY
```

### Post-Test Validation Fails (No Data)

**Check OpenCode Logs**:
```bash
# Look for errors during activity execution
tail -f ~/.opencode/logs/opencode.log | grep -E "(impulse|record|error)"
```

**Check Backend Logs**:
```bash
# Check if POST /v2/impulses/record-usage was called
# Check for authentication errors
# Check for database errors
```

**Direct Database Query** (if backend uses PostgreSQL/SQLite):
```sql
-- Check if any impulse usage was recorded
SELECT COUNT(*) FROM impulse_usage;

-- Check if impulse registry has entries
SELECT COUNT(*) FROM impulse_registry;

-- See recent usage
SELECT * FROM impulse_usage ORDER BY recorded_at DESC LIMIT 5;
```

### Reverse Flow Not Pre-loading

**Check Query Happens**:
```bash
# Search OpenCode logs for "querying learned impulses"
grep "querying learned impulses" ~/.opencode/logs/opencode.log
```

**Check MCP Tool Call**:
```bash
# Enable debug logging in OpenCode
# Look for MCP tool calls to query_activity_impulses
```

**Verify Backend Response**:
```bash
# Manually query the endpoint
curl -H "Authorization: Bearer $METABOB_API_KEY" \
  "http://localhost:8080/v2/impulses/for-activity/add-feature-complete?min_success_rate=0.6&limit=5"
```

---

## Success Definition

The learning loop is **validated** when:

1. ✅ Pre-test validation passes (infrastructure ready)
2. ✅ Activity executes successfully
3. ✅ Post-test validation passes (data recorded)
4. ✅ Second execution pre-loads learned impulses (reverse flow)
5. ✅ Usage counts increment on repeated execution (loop closed)

---

## Quick Validation Command Sequence

```bash
# Full test in one go
cd /home/avi/documents/work/exp-repo/metabob-devbob

# 1. Pre-test (should pass for infrastructure)
python3 scripts/validate_learning_loop.py --mode pre-test

# 2. Run activity in OpenCode (manual step)

# 3. Post-test (should pass with data)
python3 scripts/validate_learning_loop.py --mode post-test --activity-id add-feature-complete

# 4. Run activity again in OpenCode (manual step)

# 5. Post-test again (usage counts should increase)
python3 scripts/validate_learning_loop.py --mode post-test --activity-id add-feature-complete
```

---

## Alternative: Direct Backend Test

If you want to test the backend directly without OpenCode:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Create test script
python3 - << 'EOF'
import asyncio
import os
import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.mcp.activity_manager import ActivityManager

async def test():
    manager = ActivityManager(
        base_url=os.getenv("METABOB_API_URL", "http://localhost:8080"),
        session_token=os.getenv("METABOB_API_KEY", "")
    )
    
    # Record test usage
    result = await manager.record_impulse_usage(
        execution_id="test_exec_123",
        activity_id="add-feature-complete",
        task_id="task-1",
        success=True,
        impulse_usages=[
            {"impulse_id": "test_imp_1", "tokens_used": 500}
        ]
    )
    print(f"Record result: {result}")
    
    # Query learned
    learned = await manager.query_activity_impulses(
        variant_id="add-feature-complete",
        min_success_rate=0.0,
        limit=10
    )
    print(f"Learned impulses: {learned}")

asyncio.run(test())
EOF
```

---

**Test Duration**: ~5 minutes for full validation  
**Expected Outcome**: All validation steps pass with increasing usage counts
