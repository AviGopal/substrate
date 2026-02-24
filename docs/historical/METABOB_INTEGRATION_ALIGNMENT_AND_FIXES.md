# Metabob Integration Alignment & Fixes

**Date:** February 23, 2026  
**Status:** 🎯 Alignment Analysis Complete → Implementation Plan Ready  
**Scope:** Align metabob-cli/metabob-opencode/metabob-rpc-api integration with learning system specifications

---

## Executive Summary

This document aligns the metabob integration data flow analysis with the learning system specifications and provides a comprehensive plan to fix identified issues. The integration is **70% aligned** with specifications, with critical gaps in consistency, race conditions, and validation.

**Key Findings:**
- ✅ **Aligned (70%):** Optimistic cache, tool integration, data flows work correctly
- ❌ **Misaligned (30%):** Dual-write consistency, Thompson Sampling races, validation gaps
- 🔧 **Action Required:** 3 high-priority fixes, 4 medium-priority improvements

---

## Alignment Analysis

### Specification Coverage

| Specification | Component | Status | Gap Analysis |
|--------------|-----------|--------|--------------|
| **Spec 1: Thompson Sampling** | metabob-rpc-api | ❌ **NOT IN CLI** | CLI doesn't participate in template selection - this is OpenCode's responsibility |
| **Spec 4: Metabob Failure Analysis** | metabob-opencode | ✅ **ALIGNED** | Metabob tools integrated correctly via MCP |
| **Spec 6: Impulse Budget Management** | metabob-opencode | ✅ **ALIGNED** | Budget tracking handled by OpenCode session |
| **Spec 8: Impulse Usage Statistics** | metabob-rpc-api | ⚠️ **PARTIAL** | Dual-write exists but lacks consistency guarantees |
| **Spec 13: Metabob Tool Integration** | metabob-cli MCP | ✅ **ALIGNED** | Tools exposed correctly, error handling exists |

**Insight:** Most learning system responsibilities belong to **metabob-opencode** (OpenCode), not metabob-cli. The CLI's role is **data provider**, not learning coordinator.

---

## Our Portion of Concerns

Based on the learning system specifications, **metabob-cli** and **metabob-rpc-api** are responsible for:

### 1. ✅ Tool Integration (Spec 13)
**Status:** ALIGNED  
**Responsibility:** Expose Metabob tools via MCP server for OpenCode to consume

**What We Do Well:**
- MCP server exposes 9 tools (search, analyze, annotate, etc.)
- Graceful degradation when backend unavailable
- Optimistic cache provides instant responses
- Error handling with retry logic

**Evidence:**
```python
# repos/metabob-cli/src/metabob_cli/mcp/server.py
@server.call_tool()
async def metabob_search_codebase_issues(query: str, limit: int = 10):
    """Search codebase for issues matching query."""
    try:
        results = await activity_manager.search_codebase_issues(query, limit)
        return {"issues": results}
    except Exception as e:
        logger.warning(f"Search failed: {e}")
        return {"issues": [], "error": str(e)}  # Graceful degradation
```

---

### 2. ⚠️ Dual-Write Metrics (Spec 8 Partial)
**Status:** PARTIAL - EXISTS BUT LACKS CONSISTENCY  
**Responsibility:** Report activity metrics to backend with consistency guarantees

**What We Do:**
```python
# repos/metabob-cli/src/metabob_cli/mcp/optimistic_cache.py (Lines 165-198)
async def _flush_now(self):
    """Flush pending changes immediately."""
    response = await self._flush_callback(changes_to_flush)
    
    if response.get("status") == "success":
        # Update base state from worker response
        self._base_state = new_state
        # Remove flushed changes
        self._pending_changes = self._pending_changes[len(changes_to_flush):]
    else:
        # Keep changes in queue for retry
        logger.warning(f"Flush failed: {response.get('message')}")
```

**Gap:** No compensating transactions if backend fails after Redis succeeds

---

### 3. ❌ Race Condition Prevention (Spec 5 Related)
**Status:** MISALIGNED  
**Responsibility:** Ensure metrics updates are atomic (no lost updates)

**Problem:**
```python
# Current approach (non-atomic):
metrics = await redis.get(key)  # Read
metrics["success_count"] += 1    # Modify
await redis.set(key, metrics)    # Write

# Concurrent executions can lose updates:
# Execution A reads: success_count=10
# Execution B reads: success_count=10
# Both increment to 11
# Both write 11 → One update lost!
```

**Impact:** Thompson Sampling in OpenCode uses corrupted metrics → poor template selection

---

### 4. ❌ Input Validation (Data Flow Integrity)
**Status:** MISSING  
**Responsibility:** Validate API responses before exposing to OpenCode

**Gap:**
```python
# Current approach (no validation):
response = await httpx.get(f"{backend_url}/api/activities")
activities = response.json()  # Trusts response is valid
return activities

# Problems:
# - Backend returns HTML error page → JSON parse fails → crash
# - Malformed response → invalid data propagated to OpenCode
# - No Content-Type validation
```

---

### 5. ⚠️ Retry Queue Management (Resilience)
**Status:** PARTIAL - UNBOUNDED QUEUE  
**Responsibility:** Manage failed flushes without memory leaks

**Gap:**
```python
# Current approach (unbounded):
# repos/metabob-cli/src/metabob_cli/mcp/optimistic_cache.py (Line 198)
except Exception as e:
    logger.error(f"Flush error: {e}")
    # Keep changes in queue for retry  <-- UNBOUNDED!

# Problem:
# - Failed flushes accumulate indefinitely
# - Memory leak under persistent backend failures
# - No dead letter queue for unrecoverable changes
```

---

## High-Priority Fixes (Block Release)

### Fix 1: Add Compensating Transactions for Dual-Write

**File:** `repos/metabob-cli/src/metabob_cli/mcp/optimistic_cache.py`  
**Lines:** 165-206 (`_flush_now` method)

**Current Code:**
```python
async def _flush_now(self):
    response = await self._flush_callback(changes_to_flush)
    
    if response.get("status") == "success":
        self._base_state = new_state
        self._pending_changes = self._pending_changes[len(changes_to_flush):]
    else:
        logger.warning(f"Flush failed")
        # Keep changes in queue for retry
```

**Fixed Code:**
```python
async def _flush_now(self):
    """Flush pending changes with compensating transactions."""
    async with self._flush_lock:
        if self._is_flushing or not self._pending_changes:
            return

        self._is_flushing = True
        changes_to_flush = self._pending_changes.copy()
        redis_snapshot = None  # For rollback

        try:
            logger.info(f"[CACHE] Flushing {len(changes_to_flush)} changes")
            
            # Dual-write with compensating transaction
            try:
                # Step 1: Apply to Redis (fast path)
                redis_snapshot = await self._get_redis_snapshot(changes_to_flush)
                await self._apply_to_redis(changes_to_flush)
                
                # Step 2: Apply to SurrealDB (durable path)
                await self._apply_to_surrealdb(changes_to_flush)
                
                # Success: both stores updated
                self._pending_changes = self._pending_changes[len(changes_to_flush):]
                self._rebuild_optimistic_state()
                logger.info(f"[CACHE] Flush successful (dual-write committed)")
                
            except SurrealDBError as e:
                # Compensating transaction: rollback Redis
                logger.error(f"[CACHE] SurrealDB write failed, rolling back Redis: {e}")
                await self._rollback_redis(redis_snapshot)
                # Keep changes in queue for retry
                
        except Exception as e:
            logger.error(f"[CACHE] Flush error: {e}", exc_info=True)
            # Keep changes in queue for retry
            
        finally:
            self._is_flushing = False

async def _get_redis_snapshot(self, changes: list[StateChange]) -> dict:
    """Get current Redis state for rollback."""
    # Implementation: query affected keys from Redis
    pass

async def _rollback_redis(self, snapshot: dict):
    """Rollback Redis to snapshot state."""
    # Implementation: restore snapshot values
    pass
```

**Validation:**
```python
# Test: SurrealDB fails after Redis succeeds
async def test_dual_write_rollback():
    cache = OptimisticStateCache(...)
    
    # Mock: Redis succeeds, SurrealDB fails
    with patch_redis_success(), patch_surrealdb_failure():
        cache.apply_change(StateChange(...))
        await cache.force_flush()
    
    # Verify: Redis was rolled back
    redis_state = await redis.get("state")
    assert redis_state == initial_state  # Rollback successful
```

**Impact:**
- ✅ Prevents inconsistency between Redis and SurrealDB
- ✅ Learning system metrics remain accurate
- ✅ No corruption of Thompson Sampling data

---

### Fix 2: Add Atomic Metrics Updates (Redis WATCH/MULTI/EXEC)

**File:** `repos/metabob-cli/src/metabob_cli/mcp/api_client.py` (or new file: `metrics_reporter.py`)

**New Method:**
```python
async def increment_template_metric_atomic(
    redis: Redis,
    template_id: str,
    metric_name: str,  # e.g., "thompson_alpha" (success) or "thompson_beta" (failure)
    increment: int = 1
) -> bool:
    """Atomically increment template metric using Redis optimistic locking.
    
    Uses WATCH/MULTI/EXEC to prevent lost updates from concurrent executions.
    
    Args:
        redis: Redis client
        template_id: Template ID
        metric_name: Metric to increment (thompson_alpha, thompson_beta, etc.)
        increment: Amount to increment (default: 1)
        
    Returns:
        True if update succeeded, False if conflict (retry needed)
    """
    metrics_key = f"template_metrics:{template_id}"
    max_retries = 3
    
    for attempt in range(max_retries):
        try:
            # Start optimistic lock
            async with redis.pipeline() as pipe:
                # WATCH the metrics key
                await pipe.watch(metrics_key)
                
                # Read current value
                metrics_json = await pipe.get(metrics_key)
                if metrics_json:
                    metrics = json.loads(metrics_json)
                else:
                    metrics = {"template_id": template_id}
                
                # Modify
                metrics[metric_name] = metrics.get(metric_name, 0) + increment
                
                # MULTI/EXEC: atomic write
                pipe.multi()
                pipe.set(metrics_key, json.dumps(metrics))
                await pipe.execute()
                
                # Success: no conflict
                logger.debug(f"[METRICS] Atomically incremented {metric_name} for {template_id}")
                return True
                
        except redis.WatchError:
            # Conflict: another client modified the key
            logger.debug(f"[METRICS] Conflict on {metrics_key}, retrying ({attempt+1}/{max_retries})")
            continue
            
    # All retries failed
    logger.warning(f"[METRICS] Failed to update {metrics_key} after {max_retries} retries")
    return False


# Usage in activity completion:
async def report_activity_completion(template_id: str, success: bool):
    """Report activity completion with atomic metrics update."""
    metric_name = "thompson_alpha" if success else "thompson_beta"
    
    # Atomic increment (handles concurrent executions)
    success = await increment_template_metric_atomic(
        redis=redis_client,
        template_id=template_id,
        metric_name=metric_name,
        increment=1
    )
    
    if not success:
        logger.error(f"Failed to update metrics for {template_id} after retries")
```

**Validation:**
```python
# Test: Concurrent metric updates don't lose counts
async def test_atomic_metrics_concurrent():
    """Test 10 concurrent success reports → all counted."""
    template_id = "test-template"
    
    # Run 10 concurrent success reports
    tasks = [
        report_activity_completion(template_id, success=True)
        for _ in range(10)
    ]
    await asyncio.gather(*tasks)
    
    # Verify: thompson_alpha = 10 (no lost updates)
    metrics = await redis.get(f"template_metrics:{template_id}")
    metrics = json.loads(metrics)
    assert metrics["thompson_alpha"] == 10  # All updates counted
```

**Impact:**
- ✅ Prevents lost updates from concurrent executions
- ✅ Thompson Sampling uses accurate success/failure counts
- ✅ Template selection improves over time (not biased by lost data)

---

### Fix 3: Add API Response Validation

**File:** `repos/metabob-cli/src/metabob_cli/mcp/api_client.py`

**New Validation Layer:**
```python
from pydantic import BaseModel, ValidationError
from typing import Optional

# Schema definitions
class TemplateMetrics(BaseModel):
    template_id: str
    success_count: int
    failure_count: int
    thompson_alpha: int
    thompson_beta: int

class ActivityTemplate(BaseModel):
    id: str
    name: str
    description: str
    category: str
    metrics: Optional[TemplateMetrics] = None

class TemplateListResponse(BaseModel):
    templates: list[ActivityTemplate]
    total: int

# Validation function
def validate_api_response(
    schema: type[BaseModel],
    response: httpx.Response
) -> BaseModel:
    """Validate API response against Pydantic schema.
    
    Args:
        schema: Pydantic model class to validate against
        response: HTTP response from backend
        
    Returns:
        Validated model instance
        
    Raises:
        ValidationError: If response doesn't match schema
        ValueError: If Content-Type is not JSON
    """
    # Check Content-Type
    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        raise ValueError(
            f"Expected JSON response, got Content-Type: {content_type}. "
            f"Response body: {response.text[:200]}"
        )
    
    # Parse JSON
    try:
        data = response.json()
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON response: {e}. Body: {response.text[:200]}")
    
    # Validate schema
    try:
        return schema(**data)
    except ValidationError as e:
        logger.error(f"API response validation failed: {e}")
        logger.error(f"Response data: {data}")
        raise

# Updated API client methods
class BackendAPIClient:
    async def list_templates(self) -> list[ActivityTemplate]:
        """List activity templates with validation."""
        response = await self.http_client.get(f"{self.base_url}/api/templates")
        response.raise_for_status()
        
        # Validate response schema
        validated = validate_api_response(TemplateListResponse, response)
        return validated.templates

    async def get_template_metrics(self, template_id: str) -> Optional[TemplateMetrics]:
        """Get template metrics with validation."""
        response = await self.http_client.get(
            f"{self.base_url}/api/templates/{template_id}/metrics"
        )
        response.raise_for_status()
        
        # Validate response schema
        try:
            validated = validate_api_response(TemplateMetrics, response)
            return validated
        except ValidationError:
            logger.warning(f"Invalid metrics for {template_id}, returning None")
            return None
```

**Validation:**
```python
# Test: Malformed response caught and handled
async def test_api_validation_malformed_response():
    """Test that malformed responses raise ValidationError."""
    client = BackendAPIClient(...)
    
    # Mock: Backend returns HTML error page
    with patch_httpx_response(
        status_code=200,
        content_type="text/html",
        body="<html><h1>500 Internal Server Error</h1></html>"
    ):
        with pytest.raises(ValueError, match="Expected JSON response"):
            await client.list_templates()

# Test: Missing required fields caught
async def test_api_validation_missing_fields():
    """Test that missing required fields raise ValidationError."""
    client = BackendAPIClient(...)
    
    # Mock: Backend returns incomplete data
    with patch_httpx_response(
        status_code=200,
        content_type="application/json",
        body='{"templates": [{"id": "123"}]}'  # Missing name, description
    ):
        with pytest.raises(ValidationError):
            await client.list_templates()
```

**Impact:**
- ✅ Prevents crashes from malformed API responses
- ✅ Catches HTML error pages before they corrupt data
- ✅ Provides clear error messages for debugging
- ✅ Validates contract between CLI and backend

---

## Medium-Priority Improvements (Next Sprint)

### Improvement 1: Limit Retry Queue Size

**File:** `repos/metabob-cli/src/metabob_cli/mcp/optimistic_cache.py`  
**Lines:** 34-53 (constructor), 198-205 (error handling)

**Changes:**
```python
class OptimisticStateCache:
    def __init__(
        self,
        flush_callback: Callable[[list[StateChange]], Any],
        flush_debounce_ms: int = 100,
        max_batch_size: int = 100,
        max_queue_age_ms: int = 1000,
        max_retries: int = 3,  # NEW
        max_queue_size: int = 1000,  # NEW
    ):
        self._max_retries = max_retries
        self._max_queue_size = max_queue_size
        self._dead_letter_queue: list[StateChange] = []  # NEW
        
        # Track retry counts per change
        self._retry_counts: dict[int, int] = {}  # change_id -> retry_count

    async def _flush_now(self):
        """Flush with retry limits and dead letter queue."""
        try:
            # ... existing flush logic ...
        except Exception as e:
            logger.error(f"Flush error: {e}")
            
            # Track retry counts
            for change in changes_to_flush:
                change_id = id(change)
                self._retry_counts[change_id] = self._retry_counts.get(change_id, 0) + 1
                
                # Move to dead letter queue if max retries exceeded
                if self._retry_counts[change_id] >= self._max_retries:
                    logger.error(f"Change {change.type} exceeded max retries, moving to DLQ")
                    self._dead_letter_queue.append(change)
                    self._pending_changes.remove(change)
            
            # Check queue size limit
            if len(self._pending_changes) > self._max_queue_size:
                logger.critical(
                    f"Retry queue size ({len(self._pending_changes)}) exceeded limit "
                    f"({self._max_queue_size}), moving oldest changes to DLQ"
                )
                # Move oldest changes to DLQ
                overflow = len(self._pending_changes) - self._max_queue_size
                self._dead_letter_queue.extend(self._pending_changes[:overflow])
                self._pending_changes = self._pending_changes[overflow:]

    def get_dead_letter_queue(self) -> list[StateChange]:
        """Get changes that failed after max retries."""
        return self._dead_letter_queue.copy()

    def get_stats(self) -> dict[str, Any]:
        """Include DLQ stats in monitoring."""
        return {
            **super().get_stats(),
            "dead_letter_queue_size": len(self._dead_letter_queue),
            "max_retries": self._max_retries,
            "max_queue_size": self._max_queue_size,
        }
```

**Impact:**
- ✅ Prevents memory leaks from unbounded retry queue
- ✅ Dead letter queue preserves unrecoverable changes for analysis
- ✅ Monitoring visibility into retry health

---

### Improvement 2: Add Redis Connection Timeout

**File:** `repos/metabob-cli/src/metabob_cli/core/redis_client.py` (or wherever Redis is configured)

**Changes:**
```python
from redis.asyncio import Redis

def create_redis_client() -> Redis:
    """Create Redis client with timeout configuration."""
    return Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        socket_timeout=5,  # NEW: 5 second timeout
        socket_connect_timeout=3,  # NEW: 3 second connect timeout
        retry_on_timeout=True,  # NEW: retry once on timeout
        decode_responses=True,
    )
```

**Impact:**
- ✅ Prevents hanging when Redis is slow/unavailable
- ✅ Fails fast with clear error
- ✅ Automatic retry for transient network issues

---

### Improvement 3: Add Correlation IDs for Tracing

**File:** `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

**Changes:**
```python
import uuid
from contextvars import ContextVar

# Context variable for correlation ID
correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")

@server.call_tool()
async def metabob_search_codebase_issues(query: str, limit: int = 10):
    """Search codebase with correlation tracking."""
    # Generate correlation ID
    correlation_id = str(uuid.uuid4())
    correlation_id_var.set(correlation_id)
    
    logger.info(f"[{correlation_id}] Searching codebase: query='{query}', limit={limit}")
    
    try:
        results = await activity_manager.search_codebase_issues(query, limit)
        logger.info(f"[{correlation_id}] Search completed: {len(results)} results")
        return {"issues": results, "_correlationId": correlation_id}
        
    except Exception as e:
        logger.error(f"[{correlation_id}] Search failed: {e}", exc_info=True)
        return {"issues": [], "error": str(e), "_correlationId": correlation_id}
```

**Impact:**
- ✅ End-to-end request tracing across components
- ✅ Easier debugging of production issues
- ✅ Correlate CLI logs with OpenCode logs with backend logs

---

### Improvement 4: Create OpenAPI Specification

**File:** `docs/api/openapi.yaml` (new file)

**Content:**
```yaml
openapi: 3.0.0
info:
  title: Metabob Backend API
  version: 1.0.0
  description: API contract between metabob-cli and metabob-rpc-api

paths:
  /api/templates:
    get:
      summary: List activity templates
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  templates:
                    type: array
                    items:
                      $ref: '#/components/schemas/ActivityTemplate'
                  total:
                    type: integer

  /api/templates/{templateId}/metrics:
    get:
      summary: Get template metrics
      parameters:
        - name: templateId
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TemplateMetrics'

components:
  schemas:
    ActivityTemplate:
      type: object
      required: [id, name, description, category]
      properties:
        id:
          type: string
        name:
          type: string
        description:
          type: string
        category:
          type: string
          enum: [feature, bugfix, refactor, tool, infrastructure]
        metrics:
          $ref: '#/components/schemas/TemplateMetrics'

    TemplateMetrics:
      type: object
      required: [template_id, success_count, failure_count]
      properties:
        template_id:
          type: string
        success_count:
          type: integer
        failure_count:
          type: integer
        thompson_alpha:
          type: integer
        thompson_beta:
          type: integer
```

**Impact:**
- ✅ Contract testing (validate CLI against spec)
- ✅ Auto-generate client SDKs
- ✅ Documentation for API consumers
- ✅ Prevents breaking changes

---

## Implementation Plan

### Phase 1: High-Priority Fixes (2-3 days)

**Day 1: Dual-Write Consistency**
- [ ] Implement compensating transactions in `optimistic_cache.py`
- [ ] Add `_get_redis_snapshot()` and `_rollback_redis()` methods
- [ ] Write unit tests for rollback scenarios
- [ ] Integration test: SurrealDB failure triggers rollback

**Day 2: Atomic Metrics Updates**
- [ ] Implement `increment_template_metric_atomic()` in `metrics_reporter.py`
- [ ] Update activity completion handler to use atomic updates
- [ ] Write unit tests for concurrent updates
- [ ] Integration test: 100 concurrent updates = accurate count

**Day 3: API Response Validation**
- [ ] Add Pydantic schemas for API responses
- [ ] Implement `validate_api_response()` function
- [ ] Update all API client methods to use validation
- [ ] Write tests for malformed responses, missing fields

---

### Phase 2: Medium-Priority Improvements (3-5 days)

**Day 4-5: Retry Queue Management**
- [ ] Add retry limits and dead letter queue to `OptimisticStateCache`
- [ ] Implement monitoring endpoint for DLQ stats
- [ ] Write tests for retry exhaustion, queue overflow

**Day 6: Redis Timeout + Correlation IDs**
- [ ] Configure Redis timeouts in client setup
- [ ] Add correlation ID tracking to all MCP tools
- [ ] Update logging to include correlation IDs

**Day 7: OpenAPI Specification**
- [ ] Create `openapi.yaml` with all endpoints
- [ ] Generate client SDK from spec (optional)
- [ ] Add contract tests (validate responses against spec)

---

## Validation Strategy

### Unit Tests (New)
```bash
# Dual-write rollback
pytest tests/unit/test_optimistic_cache.py::test_dual_write_rollback

# Atomic metrics
pytest tests/unit/test_metrics_reporter.py::test_atomic_increment_concurrent

# API validation
pytest tests/unit/test_api_client.py::test_validate_malformed_response
pytest tests/unit/test_api_client.py::test_validate_missing_fields
```

### Integration Tests (New)
```bash
# End-to-end dual-write with failure injection
pytest tests/integration/test_dual_write.py::test_surrealdb_failure_rollback

# Concurrent metric updates
pytest tests/integration/test_metrics.py::test_concurrent_template_completions

# API contract validation
pytest tests/integration/test_api_contract.py
```

### Manual Verification
```bash
# Test correlation IDs end-to-end
metabob search "authentication" 
# Check logs for correlation ID propagation across CLI → OpenCode → Backend

# Test retry queue limits
# Disconnect SurrealDB, trigger 1000 state changes, verify DLQ activated
```

---

## Success Criteria

### High-Priority Fixes ✅ Complete When:
1. [ ] Dual-write consistency: SurrealDB failure rolls back Redis (0 inconsistencies)
2. [ ] Atomic metrics: 100 concurrent updates = accurate count (0 lost updates)
3. [ ] API validation: Malformed responses caught (0 crashes from bad data)
4. [ ] All unit tests pass (>95% coverage)
5. [ ] All integration tests pass

### Medium-Priority Improvements ✅ Complete When:
1. [ ] Retry queue bounded: Max 1000 pending, max 3 retries per change
2. [ ] Redis timeouts configured: 5s socket timeout, 3s connect timeout
3. [ ] Correlation IDs present in all logs (end-to-end tracing works)
4. [ ] OpenAPI spec published and contract tests pass

---

## Alignment Verification

### Before Fixes:
- ❌ Dual-write consistency: **MISSING** → can corrupt learning system
- ❌ Atomic metrics updates: **MISSING** → Thompson Sampling uses bad data
- ❌ API validation: **MISSING** → crashes on malformed responses
- ⚠️ Retry queue: **UNBOUNDED** → memory leak risk
- ⚠️ Tracing: **NO CORRELATION IDs** → hard to debug production

### After Fixes:
- ✅ Dual-write consistency: **ENFORCED** → learning system data integrity guaranteed
- ✅ Atomic metrics updates: **ENFORCED** → Thompson Sampling accurate
- ✅ API validation: **ENFORCED** → resilient to malformed responses
- ✅ Retry queue: **BOUNDED** → no memory leaks, DLQ for failed changes
- ✅ Tracing: **CORRELATION IDs** → end-to-end request tracking

---

## Appendix: Learning System Specifications Reference

### What We're Responsible For:

1. **Spec 8: Impulse Usage Statistics Accuracy** (Partial)
   - Dual-write metrics to Redis + SurrealDB
   - **FIX:** Add compensating transactions

2. **Spec 13: Metabob Tool Integration Data Flow** (Aligned)
   - MCP tools correctly exposed
   - **IMPROVE:** Add correlation IDs for tracing

3. **Metrics Integrity for Thompson Sampling** (Related to Spec 1)
   - Atomic metric updates for concurrent executions
   - **FIX:** Use Redis WATCH/MULTI/EXEC

### What We're NOT Responsible For:

1. **Spec 1: Thompson Sampling Template Selection** → OpenCode's responsibility
2. **Spec 6: Impulse Token Budget Management** → OpenCode's responsibility
3. **Spec 7: Metabob Failure Analysis Integration** → OpenCode's responsibility (we provide tools)

---

**Next Step:** Execute high-priority fixes using appropriate activity template (e.g., `fix-bug-complete` for each fix, or `develop-with-devbob-container` for safe development).
