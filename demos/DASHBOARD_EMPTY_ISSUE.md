# Dashboard Empty Issue - Root Cause and Solutions

## Current State

**Operational Dashboard shows**:
- ✅ System Health: 1/1 vessels online
- ❌ Recent Executions: Empty
- ❌ Thompson Scores: All 50% (α=1, β=1)

## Root Cause

### Why Recent Executions is Empty

1. **Only execution in last 24h**: `auth_resolve_v1` (failed auth attempts)
2. **Dashboard filters these out**: Because they're expected failures, not real activity work
3. **Result**: Empty list

**Database state**:
```
Total executions: 50
- auth_resolve_v1: 49 (all failures)
- test-activity:    1 (success, 3 days ago)
```

### Why All Scores are 50%

Thompson Sampling starts all templates at **α=1, β=1** (uninformed prior):
```
score = α / (α + β) = 1 / 2 = 50%
```

Scores only change when activities **execute and store traces**:
- Success → α increases → score goes up
- Failure → β increases → score goes down

**Current templates**: None have executed, so all still at 50%.

## The Missing Piece: Activity Execution Flow

For dashboards to populate, this flow must complete:

```
1. User runs MiniBob
   ↓
2. MiniBob executes activity
   ↓
3. Activity completes (success or failure)
   ↓
4. MiniBob stores execution trace in Activity API
   ↓
5. Activity API updates Thompson scores (α/β)
   ↓
6. Dashboard queries show updated data
```

**Current problem**: Step 2-4 aren't happening (or aren't completing).

## Solutions

### Option 1: Run Test Script (Recommended)

Test the complete flow:

```bash
cd demos
./test-activity-flow.sh
```

This will:
1. Count current executions
2. Run a simple activity through MiniBob
3. Verify trace was stored
4. Show you exactly what happened

### Option 2: Run Activities Manually

```bash
cd ../repos/minibob

# Run a simple activity
minibob --single "list files in the current directory"

# Or run from REPL
minibob
minibob> show me the files in this directory
minibob> /bye
```

Then check the dashboard:
```bash
cd ../demos
./run-ops-dashboard.sh
```

### Option 3: Populate with Script

```bash
cd demos
./populate-dashboard.sh
```

Runs 3 simple activities to generate data.

## Debugging Checklist

If activities still don't appear:

### 1. Check MiniBob Can Reach Activity API

```bash
curl http://activity.metabob.local/health
```

Should return:
```json
{
  "service": "metabob-activity-api",
  "status": "healthy"
}
```

### 2. Check MiniBob Configuration

```bash
cat ~/.metabob/config.json
```

Should have:
```json
{
  "instance": {
    "apiKey": "mb-..."
  },
  "providers": {
    "anthropic": {
      "apiKey": "sk-ant-..."
    }
  }
}
```

### 3. Check MiniBob Can Store Traces

```bash
cd ../repos/minibob

# Run with verbose logging
minibob -vv --single "test activity" 2>&1 | grep -i "trace"
```

Look for:
- "Storing execution trace"
- "Trace stored successfully"

### 4. Verify Activity API is Receiving Traces

```bash
# Watch Activity API logs
kubectl logs -f -n activity-system deployment/metabob-activity-api

# Then run an activity in another terminal
```

Look for:
- POST /v2/activities/execution-traces
- Trace stored with ID

### 5. Check Database Directly

```bash
# Query for recent traces
curl -H "Authorization: ApiKey YOUR_KEY" \
  "http://activity.metabob.local/v2/activities/execution-traces?limit=5" | jq .
```

## Expected Behavior After Fix

Once activities execute successfully:

**Dashboard Updates**:
```
🏥 System Health
  Executions (24h):     5        ← Was 20 (auth only)
  Success Rate:         80%      ← Was 0% (all auth failures)

⚡ Recent Activity Executions
✓  list-files              0.5s     $0.0000      30s ago
✓  check-system-status     1.2s     $0.0050      2m ago
✗  complex-task           45.0s     $0.0120      5m ago

⭐ Top Performing Activities
list-files                bugfix            5    1  83%  ← Was 50%
check-system-status       diagnostic        4    2  67%  ← Was 50%
complex-task              feature           2    3  40%  ← Was 50%
```

**Thompson Scores Diverge**:
- Successful activities: α increases → score > 50%
- Failed activities: β increases → score < 50%
- System learns which templates work best

## Why Thompson Scores Matter

**Before execution** (all 50%):
```
System: "I don't know which activity works best for this goal"
→ Picks randomly or by recency
```

**After executions** (scores diverge):
```
Activity A: 83% (5 successes, 1 failure)
Activity B: 67% (4 successes, 2 failures)
Activity C: 40% (2 successes, 3 failures)

System: "Activity A works best for goals like this"
→ Probabilistically favors Activity A
→ Still explores B and C occasionally
→ Continuous learning and optimization
```

## Next Steps

1. **Run test script** to verify flow:
   ```bash
   ./test-activity-flow.sh
   ```

2. **If successful**, populate with more data:
   ```bash
   ./populate-dashboard.sh
   ```

3. **Watch dashboard update**:
   ```bash
   ./run-ops-dashboard.sh
   ```

4. **Use MiniBob regularly** to keep data flowing:
   ```bash
   minibob --single "your development task"
   ```

## Common Issues

### Issue: Activities Run But Don't Store Traces

**Symptom**: MiniBob executes but no new traces in DB

**Causes**:
- MiniBob can't reach Activity API
- Authentication failing (wrong API key)
- Activity completes too fast (before trace async call)

**Fix**:
1. Check logs: `minibob -vv --single "task"`
2. Verify connectivity: `curl http://activity.metabob.local/health`
3. Check API key in `~/.metabob/config.json`

### Issue: Traces Store But Thompson Scores Don't Update

**Symptom**: New executions appear, but all scores still 50%

**Causes**:
- Thompson update logic not running
- Database transaction failing
- Template ID mismatch

**Fix**:
1. Check Activity API logs for errors
2. Verify trace has correct `template_id`
3. Query templates: `GET /v2/activities/templates`

### Issue: Dashboard Shows Old Data

**Symptom**: Dashboard doesn't refresh

**Causes**:
- Caching
- Dashboard not polling
- API not returning latest

**Fix**:
1. Restart dashboard
2. Force refresh (Ctrl+C, restart)
3. Clear cache: `rm -rf /tmp/dashboard-cache`

---

**Created**: 2026-04-19
**Status**: Debugging Guide
**Purpose**: Fix empty dashboard by running actual activities
**Next Action**: Run `./test-activity-flow.sh`
