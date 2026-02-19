# Simplified Implementation Plan: Template Lifecycle (Even Less Code!)

**Date:** 2026-02-18  
**Insight:** Keep `register_activity_template` - it's fine! Backend handles deduplication.  
**Strategy:** Variants created automatically, Thompson Sampling prunes bad ones naturally.

---

## Key Insight: Natural Selection Over Access Control

### The Realization ✅

**User's Point:**
> "We can just have the backend create a variant if the id already exists. It should be fine to create extra variants, we should already have the mechanisms in place to detect if an activity template is not fit for purpose and prune it in the backend."

**This is correct because:**

1. **Thompson Sampling = Natural Selection**
   - Bad variants get low alpha (few successes)
   - Good variants get high alpha (many successes)
   - Bad variants naturally stop being selected (probability → 0)
   - System is **antifragile**: more variants = more exploration = better learning

2. **Variants are Content-Addressable**
   - Same content → same variant_id (via content hash)
   - Duplicate "create" calls just update existing variant
   - No pollution from identical variants

3. **Storage is Cheap, Quality is Expensive**
   - Redis/SurrealDB easily handles 1000s of variants
   - Better to have 10 variants and let system learn
   - Worse to prevent experimentation and miss improvements

4. **Trust Boundaries are Wrong Focus**
   - Real risk: Bad variant breaks production
   - Mitigation: Thompson Sampling keeps it away from users
   - Not risk: LLM creates too many variants (they just don't get used)

### Simplified Architecture

```
┌─────────────────────────────────────────────────────────┐
│ metabob-opencode (LLM Execution)                        │
│                                                          │
│ ✅ register_activity_template (KEEP IT!)                │
│ ✅ search_activities                                     │
│ ✅ get_activity_template                                 │
│ ✅ activity (execute)                                    │
└─────────────────────────────────────────────────────────┘
                         ↓ Creates templates/variants
┌─────────────────────────────────────────────────────────┐
│ metabob-cli (MCP Orchestrator)                          │
│                                                          │
│ ✅ Passes through to backend                            │
│ ✅ No approval needed                                    │
└─────────────────────────────────────────────────────────┘
                         ↓ Stores variants
┌─────────────────────────────────────────────────────────┐
│ metabob-rpc-api (Backend - Port 8080)                   │
│                                                          │
│ ✅ POST /v2/activities/templates                        │
│    - If template_id exists → create variant             │
│    - If template_id new → create first variant          │
│    - Content-addressable: same content = same variant   │
│                                                          │
│ ✅ Thompson Sampling (Natural Selection)                │
│    - Track alpha/beta per variant                       │
│    - Select variants probabilistically                  │
│    - Bad variants naturally pruned (low selection rate) │
└─────────────────────────────────────────────────────────┘
```

**Key Change:** No "proposal" tool, no "approval" flow - just let system learn!

---

## Updated Implementation: Even Simpler!

### Remove from Original Plan ❌

1. **NO `propose_template_variant` tool** - unnecessary complexity
2. **NO deprecation warning** - `register_activity_template` is fine
3. **NO approval flow** - Thompson Sampling handles quality
4. **NO manual review** - metrics decide

**Lines Removed:** 90 lines (proposal tool + deprecation)

**New Total:** 350 lines (was 440)

### Backend Logic: Auto-Variant on Duplicate

**File:** `repos/metabob-rpc-api/server/actions/activity.py`

**Updated `create_template()` function:**

```python
async def create_template(redis: Redis, template_data: dict) -> Dict:
    """
    Create activity template (or variant if already exists).
    
    Logic:
    1. Generate template_id from name (e.g., "add-feature-complete")
    2. Generate variant_id from content hash (content-addressable)
    3. Check if variant_id exists:
       - If exists: Return existing (idempotent)
       - If new: Create variant
    4. Check if this is first variant for template_id:
       - If first: Initialize as generation 0
       - If not first: Set as generation N+1, link to parent
    
    Result: Automatic variant management, no manual intervention!
    """
    # Generate IDs
    template_id = template_data.get("name", "unknown").lower().replace(" ", "-")
    
    # Content-addressable variant ID
    content = {
        "task_steps": template_data.get("task_steps", []),
        "description": template_data.get("description", ""),
    }
    content_str = json.dumps(content, sort_keys=True)
    content_hash = hashlib.sha256(content_str.encode()).hexdigest()[:8]
    variant_id = f"{template_id}-{content_hash}"
    
    # Check if this exact variant already exists (idempotent)
    existing = await redis.get(f"activity:template:{variant_id}")
    if existing:
        logger.info(f"Variant already exists: {variant_id} (idempotent)")
        return json.loads(existing)
    
    # Check if template_id has other variants
    template_pattern = f"activity:template:{template_id}-*"
    existing_variants = await redis.keys(template_pattern)
    
    if existing_variants:
        # This is a NEW VARIANT of existing template
        # Load any existing variant to get genealogy
        first_variant_key = existing_variants[0]
        first_variant_json = await redis.get(first_variant_key)
        first_variant = json.loads(first_variant_json)
        
        generation = first_variant["genealogy"].get("generation", 0) + 1
        parent_hash = first_variant["genealogy"]["content_hash"]
        
        logger.info(f"Creating variant {generation} of {template_id}: {variant_id}")
    else:
        # This is the FIRST variant (generation 0)
        generation = 0
        parent_hash = None
        
        logger.info(f"Creating first variant of {template_id}: {variant_id}")
    
    # Build ActivityVariant
    template = {
        "variant_id": variant_id,
        "activity_id": template_id,
        "variant_name": template_data["name"],
        "description": template_data.get("description", ""),
        "version": generation + 1,
        "task_steps": template_data.get("task_steps", []),
        "variables": template_data.get("variables", {}),
        "context_requirements": template_data.get("context_requirements", []),
        "expected_duration_ms": 10000,
        "expected_cost": 0.01,
        "expected_quality_score": 0.5,  # Unknown initially
        "created_at": datetime.utcnow().isoformat(),
        "genealogy": {
            "content_hash": content_hash,
            "parent_hash": parent_hash,
            "generation": generation,
        }
    }
    
    # Store variant
    await redis.set(f"activity:template:{variant_id}", json.dumps(template))
    await redis.sadd("activity:templates:list", variant_id)
    
    # Initialize Thompson Sampling metrics
    metrics = {
        "variant_id": variant_id,
        "activity_id": template_id,
        "total_selections": 0,
        "total_successes": 0,
        "total_failures": 0,
        "thompson_alpha": 1.0,  # Prior (optimistic)
        "thompson_beta": 1.0,   # Prior (pessimistic)
        "avg_cost": 0.0,
        "avg_duration_ms": 0.0,
        "last_updated": datetime.utcnow().isoformat(),
    }
    
    await redis.set(f"activity:metrics:{variant_id}", json.dumps(metrics))
    
    logger.info(f"Created variant: {variant_id} (generation {generation})")
    
    return template
```

**Key Properties:**

1. **Idempotent:** Same content → same variant_id → returns existing
2. **Auto-variant:** Different content → new variant automatically
3. **Genealogy:** Tracks parent_hash and generation
4. **No approval:** Just creates and lets Thompson Sampling decide

### Example: Multiple LLMs Creating Variants

**Scenario:** 3 different LLMs try to fix same bug in template

```python
# LLM 1 creates "fix" with approach A
register_activity_template({
    "name": "add-feature-complete",
    "task_steps": [{"id": "task-1", "prompt": "Approach A"}]
})
# → Creates: add-feature-complete-a1b2c3d4

# LLM 2 creates "fix" with approach B (different)
register_activity_template({
    "name": "add-feature-complete",
    "task_steps": [{"id": "task-1", "prompt": "Approach B"}]
})
# → Creates: add-feature-complete-e5f6g7h8 (NEW VARIANT)

# LLM 3 creates "fix" with approach A (same as LLM 1)
register_activity_template({
    "name": "add-feature-complete",
    "task_steps": [{"id": "task-1", "prompt": "Approach A"}]
})
# → Returns: add-feature-complete-a1b2c3d4 (IDEMPOTENT - no duplicate)

# Result: 2 variants created, Thompson Sampling will test both
```

**After Executions:**

```python
# Variant A: 8 successes, 2 failures → alpha=9, beta=3 (75% success)
# Variant B: 2 successes, 8 failures → alpha=3, beta=9 (25% success)

# Thompson Sampling probabilities:
# - Variant A selected: ~85% of time
# - Variant B selected: ~15% of time (still exploring)

# After 100 more executions:
# - Variant A: alpha=89, beta=11 (89% success) → 98% selection rate
# - Variant B: alpha=11, beta=89 (11% success) → 2% selection rate

# Variant B effectively "pruned" (almost never selected)
```

**No manual intervention needed!**

---

## Updated Code: Only Backend Changes

### File 1: Backend Routes (UNCHANGED - 150 lines)

Same as original plan - `repos/metabob-rpc-api/server/routes/activity.py`

### File 2: Backend Actions (UPDATED - 200 lines)

Updated `create_template()` function as shown above.

**Key change:** Auto-detect if template_id exists, create variant automatically.

### File 3: Register Routes (UNCHANGED - 2 lines)

Same as original - add to `__init__.py` and `app.py`

### ~~File 4: OpenCode Deprecation~~ (REMOVED ❌)

**NO CHANGES TO OPENCODE!**

- Keep `register_activity_template` as-is
- Remove `propose_template_variant` (not needed)
- Remove deprecation warning (tool is fine)

**Lines saved:** 90 lines

---

## Updated Timeline: Even Faster!

### Day 1 (3 hours) ← Was 4 hours
- Create backend routes (150 lines) - SAME
- Create backend actions (200 lines) - SAME (minor update to create_template)
- Register routes (2 lines) - SAME
- Test locally (30 min) - FASTER (no OpenCode changes)

### ~~Day 2~~ (REMOVED ❌)
- ~~Deprecate OpenCode tool~~
- ~~Create proposal tool~~
- ~~Test integration~~

### Day 2 (2 hours) ← Was Day 3
- Deploy to staging
- Run integration tests
- Fix any issues

### Day 3 (1 hour) ← Was Day 4
- Deploy to production
- Monitor for issues
- Document changes

**New Total: 6 hours (1.5 days) instead of 10 hours!**

---

## Updated Code Summary

| Component | Status | Lines |
|-----------|--------|-------|
| Backend routes | NEW | 150 |
| Backend actions | NEW | 200 |
| Register routes | EDIT | 2 |
| ~~OpenCode deprecation~~ | ~~REMOVED~~ | ~~-10~~ |
| ~~OpenCode proposal tool~~ | ~~REMOVED~~ | ~~-80~~ |
| **TOTAL** | - | **352** |

**Was 440 lines, now 352 lines! (20% reduction)**

---

## Natural Pruning: How Thompson Sampling Works

### Scenario: Bad Variant Created

```
Time T0: LLM creates bad variant
- Variant A (good): alpha=50, beta=10 (83% success)
- Variant B (new, bad): alpha=1, beta=1 (50% assumed)

Time T1: First 10 executions
- Thompson Sampling tries both probabilistically
- Variant B fails 9/10 times
- Variant B: alpha=2, beta=10 (16% success)

Time T2: Next 100 executions  
- Thompson Sampling heavily favors A (Beta(50,10) >> Beta(2,10))
- Variant B selected only ~2% of time
- Variant B: alpha=3, beta=17 (15% success)

Time T3: After 1000 total executions
- Variant B: alpha=5, beta=95 (5% success)
- Selection probability: ~0.1% (effectively dead)

Result: Bad variant "pruned" without manual intervention
```

### Storage Impact

**Worst Case:**
- 100 templates
- 10 variants each (extreme experimentation)
- 1000 total variants
- ~10KB per variant JSON
- **Total: 10MB** (trivial for Redis)

**Reality:**
- Most templates: 1-3 variants
- Bad variants rarely created (LLM learns patterns)
- Identical content → same variant_id (deduplication)
- **Typical: <1MB total**

**Conclusion:** Storage is not a concern, let LLMs experiment!

---

## Benefits of Simplified Approach

### 1. **Faster Development**
- No OpenCode changes (was 90 lines)
- No approval logic (was complex)
- No proposal workflow (was multiple steps)
- **6 hours instead of 10 hours**

### 2. **Better Learning**
- More variants = more exploration
- System learns optimal templates faster
- No human bottleneck in approval

### 3. **Antifragile System**
- Bad variants make system stronger (learn what doesn't work)
- Experimentation encouraged
- Natural selection handles quality

### 4. **Simpler Mental Model**
- LLM creates variants freely
- Backend tracks metrics
- Thompson Sampling selects best
- No approval needed

### 5. **Zero Breaking Changes**
- Existing `register_activity_template` tool works
- No deprecation warnings
- Backward compatible
- Just works™

---

## Updated Implementation Steps

### Step 1: Backend Only (Day 1, 3 hours)

```bash
# Create backend files (copy from MINIMAL_IMPLEMENTATION_PLAN.md)
cat > repos/metabob-rpc-api/server/routes/activity.py << 'EOF'
# ... 150 lines (same as original plan) ...
EOF

cat > repos/metabob-rpc-api/server/actions/activity.py << 'EOF'
# ... 200 lines with updated create_template() ...
EOF

# Register routes
# Edit: repos/metabob-rpc-api/server/routes/__init__.py
# Add: from .activity import router as activity_router

# Edit: repos/metabob-rpc-api/server/app.py
# Add: app.include_router(routes.activity_router)

# Test locally
docker-compose build api
docker-compose up -d api
python test_backend_api_minimal.py
```

### Step 2: Deploy (Day 2, 2 hours)

```bash
# Deploy to staging
docker-compose -f docker-compose.staging.yaml up -d api

# Run integration tests
cd repos/metabob-cli
pytest tests/mcp/integration/test_activity_template_lifecycle.py

# Verify CLI integration
python -c "
from metabob_cli.mcp.activity_manager import ActivityManager
import asyncio

async def test():
    mgr = ActivityManager()
    templates = await mgr.search_activities()
    print(f'Found {len(templates)} templates')

asyncio.run(test())
"
```

### Step 3: Production (Day 3, 1 hour)

```bash
# Deploy to production
docker-compose up -d api

# Verify health
curl http://localhost:8080/health
curl http://localhost:8080/v2/activities/templates

# Monitor logs
docker-compose logs -f api | grep activity
```

**Done! No OpenCode changes needed.**

---

## Testing Strategy: Variant Creation

### Test 1: Duplicate Content (Idempotent)

```python
# Create same template twice
template_data = {
    "name": "test-template",
    "task_steps": [{"id": "task-1", "description": "Test"}]
}

result1 = await create_template(redis, template_data)
result2 = await create_template(redis, template_data)

assert result1["variant_id"] == result2["variant_id"]
# ✓ Same content → same variant_id (idempotent)
```

### Test 2: Different Content (Auto-Variant)

```python
# Create template with different content
template_data_v1 = {
    "name": "test-template",
    "task_steps": [{"id": "task-1", "description": "V1"}]
}

template_data_v2 = {
    "name": "test-template",  # Same name
    "task_steps": [{"id": "task-1", "description": "V2"}]  # Different content
}

result1 = await create_template(redis, template_data_v1)
result2 = await create_template(redis, template_data_v2)

assert result1["variant_id"] != result2["variant_id"]
assert result2["genealogy"]["generation"] == 1
assert result2["genealogy"]["parent_hash"] == result1["genealogy"]["content_hash"]
# ✓ Different content → new variant with lineage
```

### Test 3: Thompson Sampling Convergence

```python
# Create 2 variants, one good, one bad
variant_good = await create_template(redis, {...})
variant_bad = await create_template(redis, {...})

# Simulate executions
for i in range(100):
    # Good variant: 90% success
    await record_execution(redis, {
        "variant_id": variant_good["variant_id"],
        "success": random.random() < 0.9
    })
    
    # Bad variant: 10% success
    await record_execution(redis, {
        "variant_id": variant_bad["variant_id"],
        "success": random.random() < 0.1
    })

# Check metrics
metrics_good = await get_metrics(redis, variant_good["variant_id"])
metrics_bad = await get_metrics(redis, variant_bad["variant_id"])

# Thompson Sampling should heavily favor good variant
selection_prob_good = metrics_good["thompson_alpha"] / (
    metrics_good["thompson_alpha"] + metrics_good["thompson_beta"]
)
selection_prob_bad = metrics_bad["thompson_alpha"] / (
    metrics_bad["thompson_alpha"] + metrics_bad["thompson_beta"]
)

assert selection_prob_good > 0.8  # Good variant: >80% selection
assert selection_prob_bad < 0.2   # Bad variant: <20% selection
# ✓ Thompson Sampling converged to better variant
```

---

## Migration Path: Existing Templates

### Current State
- Templates in OpenCode local storage: `~/.local/share/opencode/storage/activity-template/`
- Templates in CLI bootstrap: `repos/metabob-cli/activities/bootstrap/`

### Migration Strategy

**Option 1: Lazy Migration (Recommended)**
- Don't migrate upfront
- On first execution, CLI creates in backend
- Gradual migration as templates are used
- Old storage remains (read fallback)

**Option 2: Batch Migration**
```bash
# Script to migrate all templates
python scripts/migrate_templates_to_backend.py

# For each template in local storage:
# 1. Read JSON
# 2. POST to /v2/activities/templates
# 3. Backend creates variant automatically
# 4. Log variant_id mapping
```

**Recommendation:** Option 1 (lazy) - no downtime, no risk

---

## Monitoring & Observability

### Key Metrics to Track

1. **Variant Creation Rate**
   - Metric: `variants_created_per_day`
   - Alert: >100/day (unusual LLM behavior)
   - Dashboard: Grafana graph

2. **Thompson Sampling Distribution**
   - Metric: `variant_selection_entropy`
   - Alert: <0.5 (too concentrated) or >3.0 (too distributed)
   - Dashboard: Variant selection heatmap

3. **Template Success Rates**
   - Metric: `template_success_rate` (per template_id)
   - Alert: <0.5 for templates with >10 executions
   - Dashboard: Success rate trends

4. **Variant Pruning**
   - Metric: `variants_below_threshold` (selection_prob < 0.01)
   - Dashboard: Dead variant count
   - Cleanup: Archive variants not selected in 90 days

### Example Grafana Query

```sql
-- Thompson Sampling distribution
SELECT 
  variant_id,
  thompson_alpha / (thompson_alpha + thompson_beta) as success_rate,
  total_selections
FROM activity_metrics
ORDER BY total_selections DESC
LIMIT 20
```

---

## FAQ: Why This Approach Works

### Q: Won't LLMs create too many bad variants?

**A:** No, because:
1. Content-addressable IDs prevent duplicates
2. Thompson Sampling tries them once, learns they're bad
3. Bad variants stop being selected (natural pruning)
4. Storage is cheap (<10MB for 1000 variants)

### Q: What if malicious LLM creates harmful variant?

**A:** Thompson Sampling protects:
1. First execution of new variant: 50/50 chance selected
2. If harmful, execution fails → beta += 1
3. After 1 failure: selection probability drops to ~33%
4. After 3 failures: selection probability ~10%
5. After 10 failures: selection probability <1% (effectively dead)

**Blast radius:** At most 10 users affected (then pruned)

### Q: How do we clean up dead variants?

**A:** Automated pruning (future enhancement):
```python
# Archive variants not selected in 90 days
async def prune_dead_variants():
    for variant_id in all_variants:
        metrics = await get_metrics(redis, variant_id)
        
        # Criteria for "dead":
        # - >100 selections (not new)
        # - <1% selection probability (proven bad)
        # - Not selected in 90 days
        
        if (metrics["total_selections"] > 100 and
            metrics["thompson_alpha"] / (metrics["thompson_alpha"] + metrics["thompson_beta"]) < 0.01 and
            days_since_last_selection(metrics) > 90):
            
            await archive_variant(redis, variant_id)
```

**For MVP:** Manual cleanup if storage becomes issue (unlikely)

### Q: How do we force use of specific variant (testing)?

**A:** Add parameter to activity execution:
```python
activity({
    templateId: "add-feature-complete",
    variantId: "add-feature-complete-a1b2c3d4",  # Override Thompson Sampling
    variables: {...}
})
```

Backend bypasses Thompson Sampling if `variantId` specified.

---

## Conclusion: Simpler is Better

### What Changed from Original Plan

**Removed:**
- ❌ `propose_template_variant` tool (90 lines)
- ❌ Deprecation warning (10 lines)
- ❌ Approval workflow (complexity)
- ❌ Manual review process (complexity)

**Kept:**
- ✅ `register_activity_template` tool (no changes)
- ✅ Backend API (minor update to create_template)
- ✅ Thompson Sampling (natural selection)
- ✅ Automatic variant creation

**Result:**
- **20% less code** (352 lines vs 440)
- **40% faster implementation** (6 hours vs 10)
- **Zero OpenCode changes** (backend only)
- **Simpler mental model** (create → track → select)

### Key Insight

> **Trust the system, not the LLM.**

Instead of preventing bad variants (access control), let the system **detect and prune** them automatically (Thompson Sampling).

This is:
- ✅ **Simpler** (less code, less complexity)
- ✅ **Faster** (no approval bottleneck)
- ✅ **Better** (more exploration = better learning)
- ✅ **Antifragile** (bad variants make system stronger)

**Next Step:** Implement the backend API (6 hours), deploy, done!
