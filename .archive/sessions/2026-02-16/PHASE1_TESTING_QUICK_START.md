# Phase 1 Impulse Persistence - Testing Quick Start

**Implementation Status:** ✅ COMPLETE  
**Testing Status:** 🔨 READY TO TEST

---

## Prerequisites

Before testing, ensure:

1. **SurrealDB running** in Docker (devbob environment)
2. **Backend service** configured with correct DB connection
3. **Migrations ready** to apply (004, 005)

---

## Step-by-Step Testing Guide

### Step 1: Verify Docker Environment

```bash
# Check SurrealDB container is running
docker ps | grep surreal

# Expected output:
# <container-id>  surrealdb/surrealdb  ... 0.0.0.0:8000->8000/tcp
```

If not running:
```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob
docker-compose up -d surrealdb
```

---

### Step 2: Apply Database Migrations

**Migration 004: Tool Invocations (Phase 2)**
```bash
surreal sql \
  --endpoint http://localhost:8000 \
  --namespace metabob \
  --database devbob \
  --username root \
  --password root \
  --file sql/migrations/004-tool-invocations-table.surql
```

**Migration 005: Impulse Tables (Phase 1)**
```bash
surreal sql \
  --endpoint http://localhost:8000 \
  --namespace metabob \
  --database devbob \
  --username root \
  --password root \
  --file sql/migrations/005-impulse-tables.surql
```

**Verify Tables Created:**
```bash
# Connect to SurrealDB
surreal sql \
  --endpoint http://localhost:8000 \
  --namespace metabob \
  --database devbob \
  --username root \
  --password root

# Run queries
INFO FOR TABLE impulse_registry;
INFO FOR TABLE impulse_usage;
INFO FOR TABLE tool_invocations;
```

**Expected Output:**
- `impulse_registry` table with 20+ fields and 6+ indexes
- `impulse_usage` table with 10+ fields and 4+ indexes
- `tool_invocations` table with fields including `code_context`

---

### Step 3: Run Direct Test

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Run test script
python3 scripts/test-impulse-persistence-direct.py

# Or with cleanup after test
python3 scripts/test-impulse-persistence-direct.py --cleanup
```

**Expected Output:**
```
================================================================================
Phase 1 Impulse Persistence - Direct Test
================================================================================

[1/5] Connecting to SurrealDB...
✓ Connected to SurrealDB

[2/5] Persisting step impulses...
✓ Persisted 4 impulses

[3/5] Verifying impulse_registry table...
✓ Found 4 impulses in registry
  - activity-workflow-reminder:
    Type: memo
    Budget: 300
    Usage Count: 1
    Success Rate: 100.00%
    Status: active
  [... more impulses ...]

[4/5] Verifying impulse_usage table...
✓ Found 4 usage records
  - activity-workflow-reminder:
    Usage Type: loaded
    Step Succeeded: True
    Resolution Time: 15ms
    Tokens Used: 250
  [... more records ...]

[5/5] Verifying statistics calculation...
✓ Statistics updated:
  - activity-workflow-reminder:
    Usage Count: 1
    Success Rate: 100.00%
    Last Used: 2026-02-14T...

================================================================================
✅ ALL TESTS PASSED
================================================================================

Phase 1 impulse persistence is working correctly:
  ✓ impulse_registry table populated with metadata
  ✓ impulse_usage table populated with usage records
  ✓ Statistics calculated correctly (usage_count, success_rate)
  ✓ Timestamps and metadata preserved

Ready for production use!
```

---

### Step 4: Verify Data Manually

**Connect to SurrealDB:**
```bash
surreal sql \
  --endpoint http://localhost:8000 \
  --namespace metabob \
  --database devbob \
  --username root \
  --password root
```

**Query 1: Check impulse registry**
```sql
SELECT 
    impulse_id, 
    impulse_type, 
    usage_count, 
    success_rate, 
    status,
    created_at
FROM impulse_registry 
ORDER BY created_at DESC 
LIMIT 10;
```

**Query 2: Check impulse usage**
```sql
SELECT 
    execution_id,
    step_id,
    impulse_id,
    usage_type,
    step_succeeded,
    resolution_time_ms,
    tokens_used,
    created_at
FROM impulse_usage 
ORDER BY created_at DESC 
LIMIT 10;
```

**Query 3: Check statistics**
```sql
SELECT 
    ir.impulse_id,
    ir.impulse_type,
    ir.usage_count,
    ir.success_rate,
    count(iu.id) as actual_usage_count
FROM impulse_registry ir
LEFT JOIN impulse_usage iu ON ir.impulse_id = iu.impulse_id
WHERE ir.status = 'active'
GROUP BY ir.impulse_id, ir.impulse_type, ir.usage_count, ir.success_rate
LIMIT 20;
```

**Expected:** usage_count should match actual count from impulse_usage join

---

### Step 5: Test with Real Activity Execution

**Option A: Use OpenCode CLI**
```bash
# Start OpenCode session
bun run opencode

# Run any activity (impulse tracking is automatic)
# Example: Use activity tool or let agent pick activity
```

**Option B: Use test activity script**
```bash
# If you have existing activity test scripts
python3 scripts/test-activity-execution.py
```

**Verification After Activity:**
```sql
-- Check latest impulses
SELECT * FROM impulse_registry 
WHERE created_at > '2026-02-14T00:00:00Z'
ORDER BY created_at DESC;

-- Check usage patterns
SELECT 
    impulse_type,
    count() as impulse_count,
    avg(usage_count) as avg_uses,
    avg(success_rate) as avg_success_rate
FROM impulse_registry
WHERE status = 'active'
GROUP BY impulse_type;
```

---

## Troubleshooting

### Issue: "Failed to connect to SurrealDB"

**Solution:**
```bash
# Check SurrealDB is running
docker ps | grep surreal

# Check logs
docker logs <surreal-container-id>

# Restart if needed
docker-compose restart surrealdb
```

---

### Issue: "Table does not exist"

**Solution:**
```bash
# Migrations not applied - run Step 2 again
surreal sql --endpoint http://localhost:8000 \
  --namespace metabob --database devbob \
  --username root --password root \
  --file sql/migrations/005-impulse-tables.surql
```

---

### Issue: "Import error: server.actions.impulse_registry"

**Solution:**
This is a linter warning only. The module exists at:
```
repos/metabob-rpc-api/server/actions/impulse_registry.py
```

Python will find it at runtime. If you want to fix the linter warning:
```bash
# Add to server/actions/__init__.py
echo "from . import impulse_registry" >> repos/metabob-rpc-api/server/actions/__init__.py
```

---

### Issue: "No impulses in test results"

**Possible Causes:**
1. Backend not reading impulse fields from step results
2. CLI not sending impulse data in payload
3. impulse_loaded/impulse_created arrays empty

**Debug:**
```python
# Check backend logs for:
logger.info(f"Recorded step {step.step_order} to execution_steps table "
            f"(impulses_loaded: {len(step.impulses_loaded)}, "
            f"impulses_created: {len(step.impulses_created)})")

# If showing 0/0, CLI isn't sending impulse data
```

---

### Issue: "Statistics not updating"

**Check:**
```sql
-- Verify impulse_usage has entries
SELECT count() FROM impulse_usage WHERE impulse_id = 'your-impulse-id';

-- Manually trigger stats update
-- (The code does this automatically, but for debugging:)
SELECT 
    count() as usage_count,
    sum(CASE WHEN step_succeeded = true THEN 1 ELSE 0 END) as success_when_used,
    sum(CASE WHEN step_succeeded = true THEN 1.0 ELSE 0.0 END) / count() as success_rate
FROM impulse_usage
WHERE impulse_id = 'your-impulse-id';
```

---

## Success Criteria Checklist

After testing, verify:

- [ ] ✅ Tables created (impulse_registry, impulse_usage)
- [ ] ✅ Test script passes all 5 validation steps
- [ ] ✅ Impulses persist to impulse_registry
- [ ] ✅ Usage records created in impulse_usage
- [ ] ✅ Statistics calculate correctly (usage_count, success_rate)
- [ ] ✅ Timestamps populate (created_at, last_used_at)
- [ ] ✅ Non-blocking behavior (errors logged, not thrown)
- [ ] ✅ Real activity execution creates impulse data

---

## Next Steps After Successful Testing

1. **Update documentation** with production deployment notes
2. **Create dashboard queries** for impulse effectiveness visualization
3. **Set up monitoring** for impulse persistence performance
4. **Plan Phase 3** features (impulse recommendations, context pruning)

---

## Sample Learning Loop Queries

Once you have real data flowing, try these:

**Most effective impulse types:**
```sql
SELECT 
    impulse_type,
    count() as total_impulses,
    avg(usage_count) as avg_uses,
    avg(success_rate) as avg_success_rate
FROM impulse_registry
WHERE usage_count >= 5 AND status = 'active'
GROUP BY impulse_type
ORDER BY avg_success_rate DESC;
```

**High-usage, low-success impulses (candidates for removal):**
```sql
SELECT impulse_id, impulse_type, usage_count, success_rate, last_used_at
FROM impulse_registry
WHERE usage_count >= 20 
  AND success_rate < 0.3 
  AND status = 'active'
ORDER BY usage_count DESC;
```

**Session effectiveness:**
```sql
SELECT 
    session_id,
    count() as impulses_created,
    avg(success_rate) as avg_effectiveness,
    sum(usage_count) as total_reuses
FROM impulse_registry
WHERE session_id IS NOT NULL
GROUP BY session_id
ORDER BY avg_effectiveness DESC
LIMIT 20;
```

---

## Files Reference

**Implementation:**
- `repos/metabob-rpc-api/server/actions/impulse_registry.py` (new)
- `repos/metabob-rpc-api/server/routes/v2_activities.py` (modified)

**Migrations:**
- `sql/migrations/004-tool-invocations-table.surql`
- `sql/migrations/005-impulse-tables.surql`

**Testing:**
- `scripts/test-impulse-persistence-direct.py` (new)

**Documentation:**
- `PHASE1_IMPULSE_PERSISTENCE_COMPLETE.md` (implementation report)
- `PHASE1_TESTING_QUICK_START.md` (this file)
- `PHASE2_COMPLETION_REPORT.md` (code intelligence enrichment)

---

**Last Updated:** February 14, 2026  
**Status:** Ready for testing ✅
