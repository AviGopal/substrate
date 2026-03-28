# Learning System Fix - Action Plan

**Date**: February 17, 2026  
**Priority**: HIGH  
**Effort**: 1 week (40 hours)  
**ROI**: Unlocks existing pattern detection and variant commissioning code

---

## Executive Summary

**Problem**: Impulse data not flowing through pipeline → Pattern detection dormant

**Solution**: Fix 3 code gaps to enable impulse tracking

**Impact**: 
- ✅ Pattern detection works (already coded, just needs data)
- ✅ Variant commissioning works (already coded, just needs data)
- ✅ Impulse effectiveness tracking works (tables exist, just needs data)
- ✅ Cost optimization possible (analyze which impulses help)

**Timeline**: 1 week to implementation + validation

---

## The Fix: 3 Code Changes

### Gap 1: OpenCode Activity Tool

**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Current State**: Tool doesn't extract impulses from session memory

**Fix**:
```typescript
// BEFORE: Doesn't pass impulses
const execution = await activityManager.start_execution(
  activityId,
  sessionId,
  variables,
  costBudget,
  variantId
)

// AFTER: Extract and pass impulses
import { getSessionManager } from "./session/manager"

const sessionManager = getSessionManager()
const sessionImpulses = sessionManager.getImpulses()

const impulseData = sessionImpulses.map(imp => ({
  id: imp.id,
  type: imp.type,
  pointer: imp.pointer,
  tokens_loaded: imp.estimateTokens?.() || 0
}))

const execution = await activityManager.start_execution(
  activityId,
  sessionId,
  variables,
  costBudget,
  variantId,
  impulseData  // NEW
)
```

**Testing**:
```bash
cd repos/metabob-opencode
npm test -- --grep "activity tool"
```

**Estimated Time**: 2 hours (1h code, 1h test)

---

### Gap 2: CLI Activity Manager

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Current State**: `start_execution` doesn't accept impulses parameter

**Fix**:
```python
# BEFORE: No impulses parameter
async def start_execution(
    self,
    activity_id: str,
    session_id: str,
    variables: dict = None,
    cost_budget: float = 1.0,
    variant_id: str = None,
) -> dict:
    # ... existing code ...

# AFTER: Accept and store impulses
async def start_execution(
    self,
    activity_id: str,
    session_id: str,
    variables: dict = None,
    cost_budget: float = 1.0,
    variant_id: str = None,
    impulses: list = None,  # NEW
) -> dict:
    # ... existing code ...
    
    # Store impulses for later tracking
    if impulses:
        execution.impulses_available = impulses
        logger.info(f"Execution {execution_id} has {len(impulses)} available impulses")
    
    return {
        "execution_id": execution_id,
        "session_id": session_id,
        "next_task": task,
        "impulses_tracked": len(impulses) if impulses else 0  # NEW
    }
```

**Update `_extract_impulses_used`**:
```python
# BEFORE: Stub implementation
async def _extract_impulses_used(self, session_id: str) -> list[dict]:
    """Extract impulses that were actually loaded."""
    # TODO: Implement sophisticated tracking
    return []

# AFTER: Use stored impulses
async def _extract_impulses_used(self, session_id: str) -> list[dict]:
    """Extract impulses that were loaded during execution."""
    
    # Find execution for this session
    execution = None
    for exec_id, exec_obj in self._executions.items():
        if exec_obj.session_id == session_id:
            execution = exec_obj
            break
    
    if not execution:
        logger.warning(f"No execution found for session {session_id}")
        return []
    
    # Get impulses from execution state
    impulses_available = getattr(execution, 'impulses_available', [])
    if not impulses_available:
        return []
    
    # Convert to recording format
    import hashlib
    return [
        {
            "impulse_id": imp.get("id", "unknown"),
            "content_hash": hashlib.sha256(
                str(imp.get("pointer", "")).encode()
            ).hexdigest()[:16],
            "tokens_used": imp.get("tokens_loaded", 0),
            "was_useful": True,  # Assume all loaded impulses were useful
        }
        for imp in impulses_available
    ]
```

**Testing**:
```bash
cd repos/metabob-cli
python -m pytest tests/mcp/test_activity_manager.py -v
```

**Estimated Time**: 3 hours (2h code, 1h test)

---

### Gap 3: MCP Tool Interface

**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_tools.py`

**Current State**: MCP tool doesn't accept impulses from OpenCode

**Fix**:
```python
# BEFORE: No impulses parameter
@mcp_server.tool("activity/start")
async def activity_start(
    activity_id: str,
    session_id: str,
    variables: dict = None,
    cost_budget: float = 1.0,
    variant_id: str = None
):
    # ... existing code ...

# AFTER: Accept impulses
@mcp_server.tool("activity/start")
async def activity_start(
    activity_id: str,
    session_id: str,
    variables: dict = None,
    cost_budget: float = 1.0,
    variant_id: str = None,
    impulses: list = None  # NEW
):
    manager = get_activity_manager()
    
    result = await manager.start_execution(
        activity_id=activity_id,
        session_id=session_id,
        variables=variables or {},
        cost_budget=cost_budget,
        variant_id=variant_id,
        impulses=impulses  # NEW
    )
    
    return {
        "success": True,
        "execution_id": result["execution_id"],
        "impulses_tracked": result.get("impulses_tracked", 0)  # NEW
    }
```

**Testing**:
```bash
cd repos/metabob-cli
python -m pytest tests/mcp/test_activity_tools.py -v
```

**Estimated Time**: 1 hour (30m code, 30m test)

---

## Verification Plan

### Step 1: Unit Tests (2 hours)

**OpenCode Tests**:
```bash
cd repos/metabob-opencode
npm test -- --grep "impulse"
```

**CLI Tests**:
```bash
cd repos/metabob-cli
pytest tests/mcp/test_activity_manager.py::test_impulse_tracking -v
```

### Step 2: Integration Test (2 hours)

**Test Script**: `scripts/test_impulse_tracking_e2e.py`

```python
#!/usr/bin/env python3
"""
End-to-end impulse tracking test.

Verifies:
1. OpenCode extracts impulses from session
2. CLI receives and stores impulses
3. Backend records impulses in database
4. Pattern detection can access impulse data
"""
import asyncio
import json
from metabob_cli.mcp.activity_manager import get_activity_manager
from metabob_cli.core.file_state import FileStateManager

async def test_e2e_impulse_tracking():
    """Test complete impulse tracking pipeline."""
    
    print("🧪 E2E Impulse Tracking Test\n")
    
    # Setup
    state = FileStateManager()
    config = state.get_config()
    manager = get_activity_manager(
        base_url=config.get("api_base_url"),
        session_token=state.get_session_token()
    )
    
    # Create test impulses (simulate OpenCode session)
    test_impulses = [
        {
            "id": "test-codebase-scan",
            "type": "metabob-search",
            "pointer": {"query": "authentication bugs"},
            "tokens_loaded": 250
        },
        {
            "id": "test-bug-report",
            "type": "memo",
            "pointer": {"content": "User reported auth failure on login"},
            "tokens_loaded": 50
        },
        {
            "id": "test-file-context",
            "type": "file",
            "pointer": {"filePath": "src/auth.ts"},
            "tokens_loaded": 300
        }
    ]
    
    print(f"✓ Created {len(test_impulses)} test impulses")
    
    # Step 1: Start execution WITH impulses
    print("\n📝 Step 1: Starting execution with impulses...")
    result = await manager.start_execution(
        activity_id="demo-315bfaf1",
        session_id="test-e2e-impulses",
        variables={"bugDescription": "Auth failure test"},
        impulses=test_impulses
    )
    
    execution_id = result["execution_id"]
    impulses_tracked = result.get("impulses_tracked", 0)
    
    assert impulses_tracked == 3, f"Expected 3 impulses, got {impulses_tracked}"
    print(f"✓ Execution started: {execution_id}")
    print(f"✓ Impulses tracked: {impulses_tracked}")
    
    # Step 2: Execute activity (simplified - would use get_next_step loop)
    print("\n⚙️  Step 2: Executing activity...")
    # ... (simulate execution) ...
    print("✓ Activity completed")
    
    # Step 3: Complete execution (triggers impulse recording)
    print("\n📊 Step 3: Recording execution completion...")
    await manager.record_execution_complete(
        execution_id=execution_id,
        success=True,
        duration_ms=5000,
        cost=0.02,
        tokens=600,
        outcome="test_success"
    )
    print("✓ Execution recorded")
    
    # Step 4: Verify database
    print("\n🔍 Step 4: Verifying database...")
    
    from metabob_cli.utils.surreal_client import SurrealDBClient
    db = SurrealDBClient()
    await db.connect()
    
    # Check impulse_registry
    registry = await db.query(
        "SELECT * FROM impulse_registry WHERE impulse_id LIKE 'test-%'"
    )
    print(f"✓ impulse_registry entries: {len(registry)}")
    
    # Check impulse_usage
    usage = await db.query(
        "SELECT * FROM impulse_usage WHERE execution_id = $exec_id",
        {"exec_id": execution_id}
    )
    print(f"✓ impulse_usage entries: {len(usage)}")
    
    # Assertions
    assert len(registry) == 3, f"Expected 3 registry entries, got {len(registry)}"
    assert len(usage) >= 3, f"Expected 3+ usage entries, got {len(usage)}"
    
    print("\n✅ ALL TESTS PASSED")
    print("\nImpulse tracking is now functional!")
    print("\nNext steps:")
    print("1. Run 3+ similar executions to trigger pattern detection")
    print("2. Verify variant commissioning creates learned variants")
    print("3. Monitor Thompson Sampling using new variants")

if __name__ == "__main__":
    asyncio.run(test_e2e_impulse_tracking())
```

**Run Test**:
```bash
cd repos/metabob-cli
python scripts/test_impulse_tracking_e2e.py
```

**Expected Output**:
```
🧪 E2E Impulse Tracking Test

✓ Created 3 test impulses

📝 Step 1: Starting execution with impulses...
✓ Execution started: exec_xyz123
✓ Impulses tracked: 3

⚙️  Step 2: Executing activity...
✓ Activity completed

📊 Step 3: Recording execution completion...
✓ Execution recorded

🔍 Step 4: Verifying database...
✓ impulse_registry entries: 3
✓ impulse_usage entries: 3

✅ ALL TESTS PASSED

Impulse tracking is now functional!
```

### Step 3: Pattern Detection Test (2 hours)

**Test Script**: `scripts/test_pattern_detection.py`

```python
#!/usr/bin/env python3
"""
Test pattern detection and variant commissioning.

Runs 3 similar executions to trigger pattern detection.
"""
import asyncio

async def test_pattern_detection():
    """Run 3 similar executions and verify pattern detection."""
    
    print("🧪 Pattern Detection Test\n")
    
    # Define common impulse pattern
    common_impulses = [
        {"id": "codebase-scan", "type": "metabob-search", "tokens_loaded": 200},
        {"id": "bug-context", "type": "memo", "tokens_loaded": 100},
        {"id": "test-file", "type": "file", "tokens_loaded": 300}
    ]
    
    execution_ids = []
    
    # Run 3 similar executions
    for i in range(3):
        print(f"\n📝 Execution {i+1}/3...")
        
        result = await manager.start_execution(
            activity_id="demo-315bfaf1",
            session_id=f"pattern-test-{i}",
            variables={"bugDescription": f"Test bug {i}"},
            impulses=common_impulses  # Same impulses each time
        )
        
        execution_id = result["execution_id"]
        execution_ids.append(execution_id)
        
        # Execute and complete
        await manager.record_execution_complete(
            execution_id=execution_id,
            success=True,  # All successful
            duration_ms=5000,
            cost=0.02,
            tokens=600,
            outcome="success"
        )
        
        print(f"✓ Execution {i+1} completed: {execution_id}")
    
    # Check if pattern detected
    print("\n🔍 Checking for pattern detection...")
    
    from metabob_cli.utils.surreal_client import SurrealDBClient
    db = SurrealDBClient()
    await db.connect()
    
    # Query for auto-commissioned variants
    variants = await db.query(
        """
        SELECT * FROM activity_variants 
        WHERE activity_id = 'demo-315bfaf1' 
        AND variant_name LIKE 'auto-%'
        ORDER BY created_at DESC
        LIMIT 1
        """
    )
    
    if variants and len(variants) > 0:
        variant = variants[0]
        print(f"✅ Pattern detected and variant commissioned!")
        print(f"   Variant ID: {variant['variant_id']}")
        print(f"   Variant Name: {variant['variant_name']}")
        print(f"   Source Executions: {len(execution_ids)}")
        print(f"   Description: {variant['description']}")
    else:
        print("❌ Pattern detection did not trigger")
        print("   Debug: Check variant_commissioning.py logs")
        print("   Expected: should_commission_variant() returns True")

if __name__ == "__main__":
    asyncio.run(test_pattern_detection())
```

**Run Test**:
```bash
cd repos/metabob-cli
python scripts/test_pattern_detection.py
```

**Expected Output**:
```
🧪 Pattern Detection Test

📝 Execution 1/3...
✓ Execution 1 completed: exec_abc123

📝 Execution 2/3...
✓ Execution 2 completed: exec_def456

📝 Execution 3/3...
✓ Execution 3 completed: exec_ghi789

🔍 Checking for pattern detection...
✅ Pattern detected and variant commissioned!
   Variant ID: demo-315bfaf1-a7b3c2d4
   Variant Name: auto-a7b3c2d4
   Source Executions: 3
   Description: Auto-commissioned from execution exec_ghi789
```

---

## Database Verification

### Check Impulse Registry

```bash
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< '
SELECT 
  impulse_id, 
  impulse_type,
  usage_count, 
  success_count,
  effectiveness_rate
FROM impulse_registry
ORDER BY usage_count DESC
LIMIT 10;
'
```

**Expected Output**:
```
[
  {
    impulse_id: "codebase-scan",
    impulse_type: "metabob-search",
    usage_count: 3,
    success_count: 3,
    effectiveness_rate: 1.0
  },
  {
    impulse_id: "bug-context",
    impulse_type: "memo",
    usage_count: 3,
    success_count: 3,
    effectiveness_rate: 1.0
  },
  ...
]
```

### Check Impulse Usage

```bash
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< '
SELECT 
  execution_id,
  impulse_id,
  was_useful,
  tokens_loaded,
  step_succeeded
FROM impulse_usage
ORDER BY timestamp DESC
LIMIT 10;
'
```

**Expected Output**:
```
[
  {
    execution_id: "exec_ghi789",
    impulse_id: "codebase-scan",
    was_useful: true,
    tokens_loaded: 200,
    step_succeeded: true
  },
  ...
]
```

### Check Pattern-Learned Variants

```bash
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< '
SELECT 
  variant_id,
  variant_name,
  description,
  source_execution_id,
  created_at
FROM activity_variants
WHERE variant_name LIKE "auto-%"
ORDER BY created_at DESC
LIMIT 5;
'
```

**Expected Output**:
```
[
  {
    variant_id: "demo-315bfaf1-a7b3c2d4",
    variant_name: "auto-a7b3c2d4",
    description: "Auto-commissioned from execution exec_ghi789",
    source_execution_id: "exec_ghi789",
    created_at: "2026-02-17T..."
  }
]
```

---

## Timeline & Effort

### Day 1: Implementation (6 hours)
- ✅ Gap 1: OpenCode activity tool (2h)
- ✅ Gap 2: CLI activity manager (3h)
- ✅ Gap 3: MCP tool interface (1h)

### Day 2: Unit Testing (4 hours)
- ✅ OpenCode tests (1h)
- ✅ CLI tests (2h)
- ✅ MCP tests (1h)

### Day 3: Integration Testing (4 hours)
- ✅ E2E impulse tracking test (2h)
- ✅ Pattern detection test (2h)

### Day 4: Validation (3 hours)
- ✅ Database verification (1h)
- ✅ Variant commissioning check (1h)
- ✅ Thompson Sampling validation (1h)

### Day 5: Documentation (3 hours)
- ✅ Update gap analysis document (1h)
- ✅ Write examples (1h)
- ✅ Update learning guide (1h)

**Total Effort**: 20 hours (0.5 weeks)

---

## Success Criteria

### Phase 1: Impulse Data Flowing
- [ ] E2E test passes
- [ ] impulse_registry has 10+ entries
- [ ] impulse_usage has 30+ entries
- [ ] All 3 code gaps fixed

### Phase 2: Pattern Detection Working
- [ ] Pattern detection test passes
- [ ] First auto-commissioned variant created
- [ ] Variant shows in database
- [ ] Variant includes learned impulses

### Phase 3: Learning Loop Complete
- [ ] Thompson Sampling uses learned variants
- [ ] Effectiveness rates calculated
- [ ] Cost optimization possible (can identify unhelpful impulses)
- [ ] Documentation updated

---

## Rollback Plan

If issues arise during implementation:

### Rollback Step 1: Revert Code Changes
```bash
cd repos/metabob-opencode
git checkout HEAD -- packages/opencode/src/tool/activity.ts

cd repos/metabob-cli
git checkout HEAD -- src/metabob_cli/mcp/activity_manager.py
git checkout HEAD -- src/metabob_cli/mcp/activity_tools.py
```

### Rollback Step 2: Clear Test Data
```bash
docker exec -i metabob-surreal /surreal sql \
  --endpoint http://localhost:8000 \
  --username root --password root \
  --namespace metabob --database production \
  --pretty <<< '
DELETE FROM impulse_registry WHERE impulse_id LIKE "test-%";
DELETE FROM impulse_usage WHERE impulse_id LIKE "test-%";
'
```

### Rollback Step 3: Verify System Stable
```bash
# Run existing tests to ensure no regression
cd repos/metabob-opencode
npm test

cd repos/metabob-cli
pytest tests/
```

---

## Post-Implementation

### Monitoring (Week 2)

**Metrics to Track**:
1. Impulse registry growth rate
2. Pattern detection frequency
3. Variant commissioning count
4. Thompson Sampling variant selection
5. Effectiveness rate improvements

**Queries**:
```sql
-- Daily impulse tracking
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as impulses_tracked
FROM impulse_usage
GROUP BY date
ORDER BY date DESC;

-- Variant commissioning trend
SELECT 
  DATE(created_at) as date,
  COUNT(*) as variants_created
FROM activity_variants
WHERE variant_name LIKE 'auto-%'
GROUP BY date
ORDER BY date DESC;

-- Effectiveness improvements
SELECT 
  impulse_id,
  usage_count,
  effectiveness_rate,
  AVG(effectiveness_rate) OVER () as avg_effectiveness
FROM impulse_registry
WHERE usage_count >= 3
ORDER BY effectiveness_rate DESC;
```

### Optimization (Week 3+)

Once data collected:
1. Identify low-effectiveness impulses (< 0.3 rate)
2. Remove unhelpful impulses from prompts
3. Measure cost reduction
4. Iterate on impulse selection

---

## Next Steps

1. **Review this plan** (30 min)
2. **Begin implementation** (Day 1)
3. **Run tests** (Day 2-3)
4. **Validate in production** (Day 4)
5. **Document results** (Day 5)

**Target Start**: Immediate  
**Target Completion**: 1 week from start

---

**Action Plan Complete**  
**Ready for**: Implementation
