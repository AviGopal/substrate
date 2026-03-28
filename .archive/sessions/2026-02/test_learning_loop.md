# Learning Loop End-to-End Test Plan

## Overview
Test the complete Activity-Impulse-Metabob learning loop:
1. **Forward Flow**: Record impulse usage after task execution
2. **Reverse Flow**: Query learned impulses before next execution
3. **Verification**: Confirm impulses are pre-loaded and influence execution

## Prerequisites
- Backend running with impulse tables (impulse_registry, impulse_usage)
- Metabob-CLI MCP server with new tools
- OpenCode with learning loop integration

## Test Steps

### Step 1: Create Test Activity with Impulses
```bash
# Use add-feature-complete or similar activity that uses impulses
# Ensure some impulses are loaded during execution
```

### Step 2: Verify Forward Flow (Record Usage)
After task completion, check:
1. `POST /v2/impulses/record-usage` was called
2. Records created in `impulse_usage` table
3. Impulse metadata in `impulse_registry`

Query database:
```sql
-- Check recorded usage
SELECT * FROM impulse_usage 
WHERE activity_id = 'add-feature-complete' 
ORDER BY recorded_at DESC 
LIMIT 10;

-- Check registry
SELECT impulse_id, type, usage_count, success_when_used, success_rate
FROM impulse_registry 
WHERE impulse_id IN (SELECT DISTINCT impulse_id FROM impulse_usage)
LIMIT 10;
```

### Step 3: Verify Reverse Flow (Query Learned)
Before next execution, check:
1. `GET /v2/impulses/for-activity/{variant_id}` returns impulses
2. OpenCode pre-loads them into `activity.impulses`
3. Impulses have success_rate and usage metrics

### Step 4: End-to-End Verification
Run same activity twice:
1. **First run**: No learned impulses (cold start)
2. **Second run**: Learned impulses pre-loaded

Check logs for:
```
"pre-loaded learned impulses for activity"
learnedCount: N
impulseIds: [...]
```

### Step 5: Confirm Loop Closure
Verify complete cycle:
- Impulse used in execution → recorded in DB
- Same impulse queried in next execution → pre-loaded
- Pre-loaded impulse influences context gathering

## Success Criteria
✅ Forward flow: Usage recorded after each task
✅ Reverse flow: Learned impulses queried before execution
✅ Pre-loading: Impulses appear in activity.impulses
✅ Loop closed: Same impulse flows through complete cycle

## Test Execution
Run with OpenCode activity system:
```bash
cd repos/metabob-opencode
bun run dev

# In OpenCode session:
# 1. Run activity with impulses
# 2. Check database for recorded usage
# 3. Run same activity again
# 4. Verify learned impulses pre-loaded
```

## Expected Log Output

### Forward Flow (Record):
```
[activity] Recording impulse usage for task
  execution_id: "act_exec_123"
  activity_id: "add-feature-complete"
  task_id: "task-1"
  impulse_count: 3
  
[metabob-cli] record_impulse_usage: Recorded 3 usage records
```

### Reverse Flow (Query):
```
[activity] Querying learned impulses for activity
  variantId: "add-feature-complete"
  minSuccessRate: 0.6
  limit: 5
  
[metabob-cli] query_activity_impulses: Found 3 proven impulses
  
[activity] Pre-loaded learned impulses
  learnedCount: 3
  impulseIds: ["imp_abc", "imp_def", "imp_ghi"]
```

## Debugging

If forward flow fails:
- Check backend API is running
- Verify `POST /v2/impulses/record-usage` endpoint exists
- Check API key authentication

If reverse flow fails:
- Check `GET /v2/impulses/for-activity/{id}` endpoint
- Verify impulses have enough usage_count (min 1)
- Check success_rate calculation

If pre-loading fails:
- Check OpenCode logs for errors
- Verify MCP tool call succeeds
- Check impulse pointer resolution
