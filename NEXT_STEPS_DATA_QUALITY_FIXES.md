# Next Steps: Learning Loop Data Quality Fixes

**Priority**: 🔴 High  
**Estimated Time**: 2-3 hours total  
**Impact**: Enable actual learning from impulse effectiveness data

---

## Current State

✅ **Data pipeline working**: 40 impulse records stored  
🔴 **Data quality issues**: 60% unknown IDs, 100% effectiveness (not useful)  

---

## Fix #1: Generate Unique Impulse IDs (30 min)

### Problem
60% of impulses have `impulse_id="unknown"` because they lack explicit `id` field.

### Location
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`  
**Function**: `_capture_session_impulses()` (line ~1096)

### Current Code
```python
{
    "impulse_id": imp.get("id", "unknown"),  # ⚠️ Defaults to "unknown"!
    "content_hash": hashlib.sha256(...).hexdigest()[:16],
    "tokens_used": imp.get("tokens_loaded", 0),
    "was_useful": True
}
```

### Fix
```python
def _generate_impulse_id(impulse: dict) -> str:
    """Generate unique impulse ID from pointer type and content."""
    pointer = impulse.get("pointer", {})
    pointer_type = pointer.get("type", "unknown")
    
    # Use existing ID if present
    if impulse.get("id"):
        return impulse["id"]
    
    # Generate ID based on pointer type
    if pointer_type == "file":
        path = pointer.get("path", "")
        return f"file-{hashlib.sha256(path.encode()).hexdigest()[:8]}"
    elif pointer_type == "memo":
        content = pointer.get("content", "")[:50]  # First 50 chars
        return f"memo-{hashlib.sha256(content.encode()).hexdigest()[:8]}"
    elif pointer_type == "component":
        name = pointer.get("name", "")
        return f"component-{hashlib.sha256(name.encode()).hexdigest()[:8]}"
    else:
        # Fallback: hash full pointer
        return f"{pointer_type}-{hashlib.sha256(str(pointer).encode()).hexdigest()[:8]}"

# In _capture_session_impulses():
{
    "impulse_id": self._generate_impulse_id(imp),  # ✅ Always unique!
    "content_hash": hashlib.sha256(...).hexdigest()[:16],
    "tokens_used": imp.get("tokens_loaded", 0),
    "was_useful": True
}
```

### Test
```bash
# Run test activity
python3 test_activity_create.py

# Check database
docker exec metabob-rpc-api-server-dev-1 python3 -c "
import asyncio
from server.utils.surreal_client import SurrealDBClient
from server.config import settings

async def check():
    db = SurrealDBClient(settings())
    await db.connect()
    result = await db.query('SELECT * FROM impulse_effectiveness ORDER BY last_used DESC LIMIT 5;')
    for r in result:
        print(f'{r[\"impulse_id\"]}: {r[\"total_tokens\"]} tokens')

asyncio.run(check())
"

# Expected: file-abc12345, memo-def67890 (no more "unknown")
```

---

## Fix #2: Calculate Token Counts (30 min)

### Problem
Impulses without `tokens_loaded` field have 0 tokens, skewing cost/benefit analysis.

### Location
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`  
**Function**: `_capture_session_impulses()` (line ~1096)

### Fix
```python
def _estimate_impulse_tokens(impulse: dict) -> int:
    """Estimate token count from impulse content."""
    pointer = impulse.get("pointer", {})
    pointer_type = pointer.get("type", "unknown")
    
    # Use explicit tokens_loaded if present
    if "tokens_loaded" in impulse:
        return impulse["tokens_loaded"]
    
    # Estimate from content
    content = ""
    if pointer_type == "file":
        # File content stored in pointer
        content = pointer.get("content", "")
    elif pointer_type == "memo":
        content = pointer.get("content", "")
    elif pointer_type == "component":
        # Component has code field
        content = pointer.get("code", "")
    
    # Rough estimation: ~4 chars per token
    return len(content) // 4 if content else 0

# In _capture_session_impulses():
{
    "impulse_id": self._generate_impulse_id(imp),
    "content_hash": hashlib.sha256(...).hexdigest()[:16],
    "tokens_used": self._estimate_impulse_tokens(imp),  # ✅ Calculated!
    "was_useful": True
}
```

### Test
```bash
# Check tokens are non-zero
docker exec metabob-rpc-api-server-dev-1 python3 -c "
import asyncio
from server.utils.surreal_client import SurrealDBClient
from server.config import settings

async def check():
    db = SurrealDBClient(settings())
    await db.connect()
    result = await db.query('SELECT * FROM impulse_effectiveness WHERE impulse_id != \"unknown\";')
    zero_tokens = [r for r in result if r['total_tokens'] == 0]
    print(f'Zero token records: {len(zero_tokens)}/{len(result)}')

asyncio.run(check())
"

# Expected: Zero token records: 0/X (all have tokens)
```

---

## Fix #3: Track Actual Impulse Usage (2-4 hours)

### Problem
All impulses marked as `was_useful=True`, so effectiveness is always 100% (not useful for learning).

### Location
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`  
**Function**: `_capture_session_impulses()` (line ~1096)

### Approach 1: Track Tool Calls (Recommended)

**Idea**: If impulse content appears in LLM tool call inputs, mark as useful.

```python
class ExecutionContext:
    """Track execution metadata for learning loop."""
    
    def __init__(self):
        self.impulses_loaded: dict[str, dict] = {}  # impulse_id -> metadata
        self.tool_calls: list[dict] = []  # All tool calls during execution
    
    def track_tool_call(self, tool_name: str, arguments: dict):
        """Record tool call for impulse usage analysis."""
        self.tool_calls.append({
            "tool": tool_name,
            "args": arguments,
            "timestamp": time.time()
        })
    
    def mark_impulse_used(self, impulse_id: str, content: str):
        """Check if impulse content appeared in tool calls."""
        # Simple substring matching
        for call in self.tool_calls:
            args_str = json.dumps(call["args"])
            if content[:100] in args_str:  # Check first 100 chars
                return True
        return False

# In _capture_session_impulses():
{
    "impulse_id": self._generate_impulse_id(imp),
    "content_hash": hashlib.sha256(...).hexdigest()[:16],
    "tokens_used": self._estimate_impulse_tokens(imp),
    "was_useful": execution.context.mark_impulse_used(
        impulse_id, 
        str(imp.get("pointer", {}).get("content", ""))
    )  # ✅ Track actual usage!
}
```

### Approach 2: Track LLM Context (More Accurate)

**Idea**: Intercept LLM API calls, check if impulse content is in prompt.

```python
class LLMContextTracker:
    """Track which impulses are included in LLM prompts."""
    
    def __init__(self):
        self.impulse_content_hashes = {}  # hash -> impulse_id
        self.llm_calls = []
    
    def register_impulse(self, impulse_id: str, content: str):
        """Register impulse content hash."""
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        self.impulse_content_hashes[content_hash] = impulse_id
    
    def track_llm_call(self, prompt: str):
        """Track LLM call and match impulse content."""
        used_impulses = set()
        for content_hash, impulse_id in self.impulse_content_hashes.items():
            if content_hash in prompt:  # Check if impulse content in prompt
                used_impulses.add(impulse_id)
        self.llm_calls.append({
            "timestamp": time.time(),
            "impulses_used": list(used_impulses)
        })
        return used_impulses
```

### Test
```bash
# Run activity with test impulses
python3 -c "
import asyncio
from metabob_cli.mcp.activity_manager import get_activity_manager

async def test():
    manager = get_activity_manager('http://localhost:8080', 'test_session_token')
    
    # Start execution with explicit impulses
    exec_id = await manager.start_execution(
        activity_id='INFRASTRUCTURE-0013e379',
        variables={...},
        session_id='test_session',
        impulses=[
            {'id': 'test-useful', 'pointer': {'type': 'memo', 'content': 'Important context'}},
            {'id': 'test-unused', 'pointer': {'type': 'memo', 'content': 'Ignored context'}}
        ]
    )
    
    # Complete execution
    await manager.record_outcome(exec_id, success=True)
    
    print('Check database for test-useful (should be useful) and test-unused (should not)')

asyncio.run(test())
"

# Check database
docker exec metabob-rpc-api-server-dev-1 python3 -c "
import asyncio
from server.utils.surreal_client import SurrealDBClient
from server.config import settings

async def check():
    db = SurrealDBClient(settings())
    await db.connect()
    result = await db.query('SELECT * FROM impulse_effectiveness WHERE impulse_id LIKE \"test-%\";')
    for r in result:
        print(f'{r[\"impulse_id\"]}: useful={r[\"useful_uses\"]}/{r[\"total_uses\"]} ({r[\"effectiveness_rate\"]*100:.1f}%)')

asyncio.run(check())
"

# Expected:
# test-useful: useful=1/1 (100.0%)
# test-unused: useful=0/1 (0.0%)
```

---

## Validation Steps

### 1. Unit Tests
```bash
cd repos/metabob-cli
python3 -m pytest tests/test_impulse_tracking.py -v
```

### 2. Integration Test
```bash
# Create test activity template
cat > /tmp/test-impulse-learning.json << 'EOF'
{
  "name": "Test Impulse Learning",
  "description": "Test impulse effectiveness tracking",
  "category": "test",
  "tasks": [{
    "id": "echo-task",
    "description": "Echo to verify impulse usage",
    "agent_type": "general",
    "prompt": "Echo: {{ message }}"
  }],
  "variables": [{"name": "message", "type": "string", "required": true}]
}
EOF

# Execute with impulses
python3 test_activity_with_impulses.py

# Verify data quality
docker exec metabob-rpc-api-server-dev-1 python3 -c "
import asyncio
from server.utils.surreal_client import SurrealDBClient
from server.config import settings

async def check():
    db = SurrealDBClient(settings())
    await db.connect()
    
    result = await db.query('''
        SELECT 
            count() as total,
            count(CASE WHEN impulse_id = \"unknown\" THEN 1 END) as unknown_count,
            count(CASE WHEN total_tokens = 0 THEN 1 END) as zero_token_count,
            avg(effectiveness_rate) as avg_effectiveness
        FROM impulse_effectiveness
        GROUP ALL
    ''')
    
    print(f'Total impulses: {result[0][\"total\"]}')
    print(f'Unknown IDs: {result[0][\"unknown_count\"]} ({result[0][\"unknown_count\"]/result[0][\"total\"]*100:.1f}%)')
    print(f'Zero tokens: {result[0][\"zero_token_count\"]} ({result[0][\"zero_token_count\"]/result[0][\"total\"]*100:.1f}%)')
    print(f'Avg effectiveness: {result[0][\"avg_effectiveness\"]*100:.1f}%')

asyncio.run(check())
"

# Success criteria:
# - Unknown IDs: <10%
# - Zero tokens: <10%
# - Avg effectiveness: 40-70% (shows discrimination)
```

### 3. Database Integrity Check
```bash
docker exec metabob-rpc-api-server-dev-1 python3 -c "
import asyncio
from server.utils.surreal_client import SurrealDBClient
from server.config import settings

async def integrity_check():
    db = SurrealDBClient(settings())
    await db.connect()
    
    # Check for data integrity issues
    checks = {
        'negative_uses': 'SELECT * FROM impulse_effectiveness WHERE total_uses < 0 OR useful_uses < 0',
        'invalid_rate': 'SELECT * FROM impulse_effectiveness WHERE effectiveness_rate < 0 OR effectiveness_rate > 1',
        'inconsistent_rate': 'SELECT * FROM impulse_effectiveness WHERE ABS(effectiveness_rate - useful_uses/total_uses) > 0.01',
        'negative_tokens': 'SELECT * FROM impulse_effectiveness WHERE total_tokens < 0'
    }
    
    for check_name, query in checks.items():
        result = await db.query(query)
        if result:
            print(f'❌ {check_name}: {len(result)} issues found')
        else:
            print(f'✅ {check_name}: OK')

asyncio.run(integrity_check())
"
```

---

## Success Metrics

### Before Fixes
- Unknown IDs: 60% (24/40)
- Zero tokens: 60% (24/40)
- Effectiveness: 100% (all records)

### After Fixes (Target)
- Unknown IDs: <10%
- Zero tokens: <10%
- Effectiveness: 40-70% (shows discrimination)

---

## Rollout Plan

### Phase 1: Deploy Fixes (Day 1)
1. Implement Fix #1 (IDs)
2. Implement Fix #2 (Tokens)
3. Deploy to dev environment
4. Run integration tests

### Phase 2: Validate (Day 2)
1. Execute 10 test activities
2. Monitor database metrics
3. Verify data quality improvements
4. Fix any edge cases

### Phase 3: Enable Learning (Day 3)
1. Implement Fix #3 (Usage tracking)
2. Deploy to dev environment
3. Run A/B tests
4. Verify effectiveness discrimination

### Phase 4: Production (Day 4+)
1. Deploy to production
2. Monitor metrics
3. Build analytics dashboard
4. Enable template recommendations

---

## Files to Modify

1. **repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py**
   - Add `_generate_impulse_id()` method
   - Add `_estimate_impulse_tokens()` method
   - Add `ExecutionContext` class (for Fix #3)
   - Update `_capture_session_impulses()` to use new methods

2. **repos/metabob-cli/tests/test_impulse_tracking.py** (new file)
   - Unit tests for ID generation
   - Unit tests for token estimation
   - Integration tests for usage tracking

3. **test_activity_with_impulses.py** (new file)
   - End-to-end test for impulse learning

---

## Related Documentation

- **LEARNING_LOOP_DATA_VERIFICATION_COMPLETE.md** - Full verification report
- **ACTIVITY_SYSTEM_WORKING.md** - Activity system status
- **repos/metabob-rpc-api/server/actions/impulse_provenance.py** - Backend storage logic

---

**Status**: 🟡 Ready to implement  
**Priority**: 🔴 High (blocks learning loop effectiveness)  
**Estimated ROI**: High (enables actual template improvement from data)

