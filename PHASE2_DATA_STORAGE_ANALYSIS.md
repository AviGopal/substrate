# Phase 2 Data Storage Analysis

**Date**: 2026-02-09  
**Purpose**: Validate data storage strategy, identify duplications and potential conflicts

---

## Storage Architecture Overview

### Three-Layer Storage Model

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Execution Record (activity_executions table)       │
│ - Basic execution data (duration, cost, success)           │
│ - Embedded: impulses_used, component_changes (arrays)      │
│ - Purpose: Complete execution snapshot                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Aggregate Metrics (separate tables)                │
│ - impulse_effectiveness: Per-impulse aggregate stats       │
│ - component_changes: Separate records for querying         │
│ - Purpose: Fast queries, analytics, learning               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Variant Commissioning (activity_variants table)    │
│ - New variants created from successful patterns            │
│ - References source_execution_id                           │
│ - Purpose: Template evolution                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Current Data Flow

### When record_execution() is called:

```python
1. Create activity_executions record
   ↓
   Stores: {
     execution_id, variant_id, success, duration_ms,
     impulses_used: [{...}],      # Array embedded
     component_changes: [{...}],  # Array embedded
     ...
   }

2. store_impulse_provenance()
   ↓
   Updates impulse_effectiveness:{impulse_id}
   ↓
   Aggregates: total_uses, useful_uses, total_tokens
   
3. store_component_changes()
   ↓
   Creates component_changes:{id} records (one per change)
   ↓
   Links: execution_id, file_path, component_name, related_impulse_ids

4. should_commission_variant() + commission_variant_from_execution()
   ↓
   Reads: activity_executions (multiple) to find patterns
   ↓
   Creates: activity_variants:{new_variant_id} with source_execution_id
```

---

## Data Duplication Analysis

### ✅ Intentional Duplication (Denormalization for Performance)

#### 1. impulses_used Array

**Stored in TWO places**:

**Location A**: `activity_executions.impulses_used` (embedded array)
```json
{
  "execution_id": "exec_123",
  "impulses_used": [
    {"impulse_id": "errorContext", "tokens_used": 800, "was_useful": true}
  ]
}
```

**Location B**: `impulse_effectiveness:{impulse_id}` (aggregate)
```json
{
  "impulse_id": "errorContext",
  "total_uses": 50,
  "useful_uses": 42,
  "total_tokens": 35000,
  "effectiveness_rate": 0.84
}
```

**Why both?**
- **Location A**: Execution snapshot - "what impulses were used in THIS execution?"
- **Location B**: Aggregate analytics - "how effective is this impulse OVERALL?"
- **Query patterns**:
  - A: "Show me all data for execution exec_123" → O(1) read
  - B: "What's the effectiveness of errorContext?" → O(1) read
  - Without B: Must scan all executions → O(n) reads

**Verdict**: ✅ **Acceptable** - Classic denormalization for read performance

---

#### 2. component_changes Array

**Stored in TWO places**:

**Location A**: `activity_executions.component_changes` (embedded array)
```json
{
  "execution_id": "exec_123",
  "component_changes": [
    {
      "file_path": "src/auth.ts",
      "component_name": "validateToken",
      "change_type": "MODIFIED",
      "related_impulse_ids": ["errorContext"]
    }
  ]
}
```

**Location B**: `component_changes:{id}` (separate records)
```json
{
  "id": "change_456",
  "execution_id": "exec_123",
  "file_path": "src/auth.ts",
  "component_name": "validateToken",
  "change_type": "MODIFIED",
  "related_impulse_ids": ["errorContext"],
  "timestamp": "2026-02-09T12:00:00Z"
}
```

**Why both?**
- **Location A**: Execution snapshot - complete context
- **Location B**: Component history - "show all changes to validateToken"
- **Query patterns**:
  - A: "What changed in this execution?" → O(1) read
  - B: "Show history of validateToken" → Indexed query on file_path+component_name
  - Without B: Must scan all executions and filter → O(n) reads

**Verdict**: ✅ **Acceptable** - Enables component-centric queries

---

### ❌ Potential Issues Identified

#### Issue 1: UPDATE impulse_effectiveness May Not Create Records

**Location**: `server/actions/impulse_provenance.py:30-44`

```python
await db.query("""
    UPDATE impulse_effectiveness SET
        total_uses += 1,
        useful_uses += $useful,
        total_tokens += $tokens,
        last_used = time::now()
    WHERE impulse_id = $impulse_id
""", {...})
```

**Problem**: If `impulse_effectiveness:{impulse_id}` doesn't exist, UPDATE does nothing!

**Expected behavior**: First use of impulse should create record

**Solution needed**: Use UPSERT pattern or CREATE IF NOT EXISTS

**Fix**:
```python
# Option 1: Upsert (if SurrealDB supports)
await db.query("""
    UPDATE impulse_effectiveness:{$impulse_id} CONTENT {
        impulse_id: $impulse_id,
        total_uses: $new_total,
        useful_uses: $new_useful,
        total_tokens: $new_tokens,
        last_used: time::now()
    }
""")

# Option 2: Check then create/update
existing = await db.select(f"impulse_effectiveness:{impulse_id}")
if not existing:
    await db.create("impulse_effectiveness", {...})
else:
    await db.query("UPDATE ...", {...})
```

---

#### Issue 2: No Index Definitions

**Problem**: New tables (`impulse_effectiveness`, `component_changes`) have no indexes

**Impact**:
- Slow queries on `component_changes` by file_path/component_name
- Slow variant commissioning (scans all executions)

**Solution needed**: Add index definitions

---

#### Issue 3: Race Condition in Variant Commissioning

**Location**: `server/actions/variant_commissioning.py:23-60`

**Scenario**:
1. Two executions complete simultaneously with same impulse pattern
2. Both call `should_commission_variant()` → both return True
3. Both call `commission_variant_from_execution()` → creates DUPLICATE variants!

**Problem**: No locking or uniqueness constraint on content_hash

**Solution needed**: Add uniqueness check or advisory lock

**Fix**:
```python
# Before creating variant, check if it exists
existing = await db.query("""
    SELECT * FROM activity_variants
    WHERE activity_id = $activity_id
    AND content_hash = $content_hash
    LIMIT 1
""", {"activity_id": activity_id, "content_hash": content_hash})

if existing:
    logger.info(f"Variant with hash {content_hash} already exists")
    return existing[0]["variant_id"]

# Create with uniqueness constraint (if SurrealDB supports)
await db.create("activity_variants", {...})
```

---

## Recommended Fixes

### Priority 1: Fix impulse_effectiveness Upsert

**File**: `server/actions/impulse_provenance.py`

**Current** (lines 29-44):
```python
await db.query("""
    UPDATE impulse_effectiveness SET ...
    WHERE impulse_id = $impulse_id
""")
```

**Proposed**:
```python
# Check if exists, create if not
existing = await db.select(f"impulse_effectiveness:{impulse_id}")
if not existing:
    await db.create("impulse_effectiveness", {
        "impulse_id": impulse_id,
        "total_uses": 1,
        "useful_uses": 1 if was_useful else 0,
        "total_tokens": tokens_used,
        "last_used": datetime.now(timezone.utc).isoformat(),
        "effectiveness_rate": 1.0 if was_useful else 0.0
    })
else:
    new_total = existing["total_uses"] + 1
    new_useful = existing["useful_uses"] + (1 if was_useful else 0)
    await db.query("""
        UPDATE impulse_effectiveness:{$impulse_id} SET
            total_uses = $total,
            useful_uses = $useful,
            total_tokens = $tokens,
            effectiveness_rate = $rate,
            last_used = time::now()
    """, {
        "impulse_id": impulse_id,
        "total": new_total,
        "useful": new_useful,
        "tokens": existing["total_tokens"] + tokens_used,
        "rate": new_useful / new_total
    })
```

---

### Priority 2: Add Database Indexes

**File**: `server/actions/init_activity_schema.py` (or create migration)

**Add these definitions**:
```surql
-- Impulse effectiveness lookups (already has :id primary key)
DEFINE INDEX idx_impulse_effectiveness_rate ON impulse_effectiveness FIELDS effectiveness_rate;

-- Component changes - find by component
DEFINE INDEX idx_component_changes_file ON component_changes FIELDS file_path;
DEFINE INDEX idx_component_changes_name ON component_changes FIELDS file_path, component_name;
DEFINE INDEX idx_component_changes_execution ON component_changes FIELDS execution_id;

-- Activity executions - variant commissioning queries
DEFINE INDEX idx_executions_variant_success ON activity_executions FIELDS variant_id, success;
DEFINE INDEX idx_executions_session ON activity_executions FIELDS session_id;

-- Variant genealogy
DEFINE INDEX idx_variants_parent ON activity_variants FIELDS parent_id;
DEFINE INDEX idx_variants_content_hash ON activity_variants FIELDS activity_id, content_hash UNIQUE;
```

---

### Priority 3: Add Variant Uniqueness Check

**File**: `server/actions/variant_commissioning.py`

**In commission_variant_from_execution()** (before line 102):
```python
# Compute content hash
content_str = json.dumps(new_task_steps, sort_keys=True)
content_hash = hashlib.sha256(content_str.encode()).hexdigest()

# CHECK: Does variant with this hash already exist?
existing_variants = await db.query("""
    SELECT * FROM activity_variants
    WHERE activity_id = $activity_id
    AND content_hash = $content_hash
    LIMIT 1
""", {"activity_id": parent["activity_id"], "content_hash": content_hash})

if existing_variants:
    logger.info(f"Variant with hash {content_hash[:8]} already exists: {existing_variants[0]['variant_id']}")
    return existing_variants[0]["variant_id"]

# Create new variant
variant_id = f"{parent['activity_id']}-{content_hash[:8]}"
...
```

---

## Data Consistency Guarantees

### What's Guaranteed Now

✅ **Execution atomicity**: `activity_executions` record created atomically  
✅ **Embedded data**: impulses_used and component_changes always present  
⚠️  **Aggregate updates**: Best-effort (fire-and-forget)  
⚠️  **Variant uniqueness**: No guarantee (race conditions possible)

### What Should Be Guaranteed

1. **Impulse effectiveness creation**: First use must create record
2. **Variant uniqueness**: No duplicate variants with same content_hash
3. **Component history**: All component_changes records created

### Failure Modes

**Current behavior if helper functions fail**:
```python
# Phase 2 calls are wrapped in try/except (line 594-601)
try:
    new_variant_id = await commission_variant_from_execution(db, execution_dict)
    logger.info(f"✨ Auto-commissioned variant: {new_variant_id}")
except Exception as e:
    logger.error(f"Failed to commission variant: {e}", exc_info=True)
    # Execution continues - no crash!
```

**Good**: Execution recording never fails due to Phase 2 errors  
**Bad**: Silent failures in aggregate updates (no retry, no alert)

**Recommendation**: Add monitoring/alerting for Phase 2 failures

---

## Query Patterns Analysis

### Efficient Queries (O(1) or O(log n))

✅ **Get execution data**: `SELECT * FROM activity_executions:{execution_id}`  
✅ **Get impulse effectiveness**: `SELECT * FROM impulse_effectiveness:{impulse_id}`  
✅ **Get variant**: `SELECT * FROM activity_variants:{variant_id}`

### Potentially Slow Queries (O(n) without indexes)

⚠️  **Component history**: `SELECT * FROM component_changes WHERE file_path = ... AND component_name = ...`  
  → **Fix**: Add composite index on (file_path, component_name)

⚠️  **Find similar executions**: `SELECT * FROM activity_executions WHERE variant_id = ... AND success = true`  
  → **Fix**: Add composite index on (variant_id, success)

⚠️  **Check variant exists**: `SELECT * FROM activity_variants WHERE activity_id = ... AND content_hash = ...`  
  → **Fix**: Add UNIQUE composite index on (activity_id, content_hash)

---

## Storage Size Estimates

### Per Execution

**activity_executions record**:
- Base fields: ~500 bytes
- impulses_used (avg 3 impulses × 100 bytes): ~300 bytes
- component_changes (avg 5 components × 150 bytes): ~750 bytes
- **Total per execution**: ~1.5 KB

**component_changes records** (separate):
- Per component: ~200 bytes
- Avg 5 per execution: ~1 KB

**impulse_effectiveness updates**:
- Negligible (aggregate updates, not inserts)

**Total per execution**: ~2.5 KB

**At scale** (1M executions): ~2.5 GB (reasonable)

---

## Recommendations Summary

### Immediate (Before Production)

1. **Fix impulse_effectiveness upsert** - Ensure first-use creates record
2. **Add database indexes** - Critical for query performance
3. **Add variant uniqueness check** - Prevent duplicate variants

### Short-term (Before Scale)

4. **Add monitoring** - Track Phase 2 failure rates
5. **Add retries** - For transient database failures
6. **Add batch operations** - If many component_changes per execution

### Long-term (Optimization)

7. **Consider event sourcing** - Store raw events, compute aggregates async
8. **Add caching** - For frequently-accessed impulse effectiveness data
9. **Partition tables** - By date for efficient archival

---

## Conclusion

### Current State

✅ **No critical conflicts** - Denormalization is intentional and acceptable  
✅ **Clean separation** - Execution snapshot vs aggregates vs variants  
⚠️  **Missing safeguards** - Upsert, indexes, uniqueness checks needed

### Action Items

1. Implement 3 priority fixes above (estimated: 1-2 hours)
2. Add database schema initialization/migration
3. Test at scale (1000+ executions) to validate performance
4. Add monitoring for Phase 2 operations

**Overall assessment**: Architecture is sound, needs implementation polish.
