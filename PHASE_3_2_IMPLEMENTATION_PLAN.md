# Phase 3.2 Implementation Plan: Backend REST Endpoints

**Status:** IN PROGRESS  
**Started:** 2026-02-19 (current session)  
**Previous:** Phase 3.1 COMPLETE (MCP gateway tools)

---

## Summary

Implementing backend REST endpoints in `metabob-rpc-api` that the Phase 3.1 MCP gateway tools will call.

### Deliverables

1. ✅ **Services Layer** (Business Logic):
   - `server/services/metrics_aggregator.py` - CREATED (235 lines)
   - `server/services/promotion_engine.py` - TODO

2. ⏳ **REST Endpoints** (API Layer):
   - `server/routes/activity_metrics.py` - TODO
   - Register in `server/app.py` - TODO

3. ⏳ **Testing**:
   - Unit tests for services
   - Integration tests for endpoints

---

## Files Created

### 1. `server/services/__init__.py` ✅
```python
"""
Backend Services for Activity Metrics and A/B Testing
"""
from .metrics_aggregator import MetricsAggregator
from .promotion_engine import PromotionEngine

__all__ = ["MetricsAggregator", "PromotionEngine"]
```

### 2. `server/services/metrics_aggregator.py` ✅

**Purpose:** Aggregate execution metrics across activity executions

**Key Methods:**
- `record_execution()` - Store single execution + update aggregates
- `get_template_metrics()` - Retrieve aggregated metrics for template
- `get_template_with_variants_metrics()` - Get stable + candidate metrics
- `_update_aggregated_metrics()` - Internal: Calculate averages, success rates

**Storage:** Redis (consistent with existing `/v2/activities` endpoints)

**Metrics Calculated:**
- Total executions, successes, failures
- Success rate
- Average cost (USD)
- Average duration (ms)
- Average tokens (input, output, cache)

---

## Files To Create

### 3. `server/services/promotion_engine.py` (250 lines est.)

**Purpose:** Statistical A/B testing and promotion recommendations

**Key Methods:**
```python
class PromotionEngine:
    def __init__(self, redis_client, metrics_aggregator):
        ...
    
    async def get_recommendation(
        self,
        stable_id: str,
        candidate_ids: List[str]
    ) -> Dict[str, Any]:
        """
        Statistical A/B test recommendation.
        
        Returns:
            {
                "action": "PROMOTE" | "KEEP_TESTING" | "PRUNE",
                "reason": "Detailed explanation",
                "statistics": {
                    "sample_size": {"stable": 100, "candidate": 30},
                    "success_rate_diff": 0.10,
                    "p_value": 0.03,
                    "cost_delta": 0.20,
                    "duration_delta": -0.07
                }
            }
        """
        ...
    
    async def _chi_square_test(
        self,
        stable_metrics: Dict,
        candidate_metrics: Dict
    ) -> float:
        """Perform chi-square test for success rate difference."""
        # Use scipy.stats.chi2_contingency
        ...
```

**Statistical Tests:**
1. **Sample Size Check:**
   - Minimum 30 executions per variant
   - Return "KEEP_TESTING" if insufficient

2. **Chi-Square Test:**
   - Compare success rates
   - p-value < 0.05 for significance

3. **Cost/Duration Analysis:**
   - Cost increase > 20% → PRUNE
   - Duration improvement > 10% → bonus points

4. **Recommendation Logic:**
   - `PROMOTE`: Significantly better (p < 0.05) + acceptable cost
   - `KEEP_TESTING`: Not enough data or inconclusive
   - `PRUNE`: Worse performance or too expensive

---

### 4. `server/routes/activity_metrics.py` (200 lines est.)

**Purpose:** REST endpoints matching MCP gateway tool expectations

```python
from fastapi import APIRouter, Depends, HTTPException
from server.services import MetricsAggregator, PromotionEngine
from server.utils.dependencies import get_redis_connection

router = APIRouter(prefix="/api", tags=["activity-metrics"])

@router.post("/activity-execution")
async def record_execution(
    execution_data: Dict[str, Any],
    redis=Depends(get_redis_connection)
):
    """
    Record activity execution result.
    
    Called by: metabob_report_execution MCP tool
    
    Request Body:
        {
            "activity_id": "exec_abc123",
            "template_id": "add-feature-complete",
            "success": true,
            "duration": 45000,
            "cost": 0.15,
            "tokens": {"input": 8000, "output": 2000, "cache": 5000},
            "errors": ""
        }
    
    Returns:
        {
            "recorded": true,
            "execution_id": "exec_abc123",
            "template_id": "add-feature-complete"
        }
    """
    aggregator = MetricsAggregator(redis)
    result = await aggregator.record_execution(
        activity_id=execution_data["activity_id"],
        template_id=execution_data["template_id"],
        success=execution_data["success"],
        duration=execution_data["duration"],
        cost=execution_data["cost"],
        tokens=execution_data["tokens"],
        errors=execution_data.get("errors", "")
    )
    return result


@router.get("/template/{template_id}/metrics")
async def get_template_metrics(
    template_id: str,
    redis=Depends(get_redis_connection)
):
    """
    Get aggregated metrics for template.
    
    Called by: metabob_get_template_metrics MCP tool
    
    Returns:
        {
            "stable": {
                "template_id": "add-feature-complete",
                "executions": 120,
                "success_rate": 0.75,
                "avg_cost": 0.15,
                "avg_duration": 45000
            },
            "candidates": []
        }
    """
    aggregator = MetricsAggregator(redis)
    metrics = await aggregator.get_template_with_variants_metrics(template_id)
    
    if not metrics.get("stable"):
        raise HTTPException(
            status_code=404,
            detail=f"Template not found: {template_id}"
        )
    
    return metrics


@router.get("/template/{template_id}/recommendation")
async def get_promotion_recommendation(
    template_id: str,
    redis=Depends(get_redis_connection)
):
    """
    Get A/B testing promotion recommendation.
    
    Called by: metabob_get_promotion_recommendation MCP tool
    
    Returns:
        {
            "action": "PROMOTE" | "KEEP_TESTING" | "PRUNE",
            "reason": "Detailed explanation",
            "statistics": {...}
        }
    """
    aggregator = MetricsAggregator(redis)
    engine = PromotionEngine(redis, aggregator)
    
    # For MVP: Assume template_id is stable, no candidates yet
    recommendation = await engine.get_recommendation(
        stable_id=template_id,
        candidate_ids=[]  # Future: Query variants from template registry
    )
    
    return recommendation


@router.post("/template/promote")
async def promote_template(
    request: Dict[str, Any],
    redis=Depends(get_redis_connection)
):
    """
    Promote candidate template to stable.
    
    Called by: metabob_promote_template MCP tool
    
    Request Body:
        {
            "stable_id": "add-feature-complete",
            "candidate_id": "add-feature-v2",
            "reason": "10% success improvement (p<0.05)"
        }
    
    Returns:
        {
            "promoted": true,
            "new_stable_id": "add-feature-v2",
            "archived_id": "add-feature-complete"
        }
    """
    # Future: Implement template status updates in registry
    # For MVP: Return success acknowledgement
    return {
        "promoted": True,
        "new_stable_id": request["candidate_id"],
        "archived_id": request["stable_id"],
        "reason": request["reason"]
    }
```

---

### 5. Register Router in `server/app.py`

**Changes Required:**
```python
# Line ~75 (after other router includes)
from server.routes import activity_metrics

app.include_router(activity_metrics.router)
```

---

## Testing Strategy

### Unit Tests (`tests/services/`)

**test_metrics_aggregator.py:**
```python
import pytest
from server.services import MetricsAggregator

@pytest.mark.asyncio
async def test_record_execution(mock_redis):
    aggregator = MetricsAggregator(mock_redis)
    result = await aggregator.record_execution(
        activity_id="test_exec_1",
        template_id="test_template",
        success=True,
        duration=5000,
        cost=0.01,
        tokens={"input": 100, "output": 50, "cache": 0}
    )
    assert result["recorded"] == True
    assert result["template_id"] == "test_template"

@pytest.mark.asyncio
async def test_get_template_metrics_not_found(mock_redis):
    aggregator = MetricsAggregator(mock_redis)
    metrics = await aggregator.get_template_metrics("nonexistent")
    assert metrics is None
```

**test_promotion_engine.py:**
```python
@pytest.mark.asyncio
async def test_insufficient_data_recommendation(mock_redis, mock_aggregator):
    engine = PromotionEngine(mock_redis, mock_aggregator)
    
    # Stable: 10 executions (< 30 minimum)
    recommendation = await engine.get_recommendation(
        stable_id="template_low_sample",
        candidate_ids=[]
    )
    
    assert recommendation["action"] == "KEEP_TESTING"
    assert "insufficient" in recommendation["reason"].lower()

@pytest.mark.asyncio
async def test_chi_square_test_significance(mock_redis, mock_aggregator):
    engine = PromotionEngine(mock_redis, mock_aggregator)
    
    stable = {"executions": 100, "successes": 75, "failures": 25}
    candidate = {"executions": 100, "successes": 85, "failures": 15}
    
    p_value = await engine._chi_square_test(stable, candidate)
    assert p_value < 0.05  # Significant difference
```

### Integration Tests (`tests/routes/`)

**test_activity_metrics_routes.py:**
```python
@pytest.mark.asyncio
async def test_record_execution_endpoint(client, mock_redis):
    response = await client.post("/api/activity-execution", json={
        "activity_id": "exec_test_1",
        "template_id": "test_template",
        "success": True,
        "duration": 5000,
        "cost": 0.01,
        "tokens": {"input": 100, "output": 50, "cache": 0}
    })
    assert response.status_code == 200
    assert response.json()["recorded"] == True

@pytest.mark.asyncio
async def test_get_metrics_endpoint_404(client, mock_redis):
    response = await client.get("/api/template/nonexistent/metrics")
    assert response.status_code == 404
```

---

## Dependencies Required

**Already in requirements.txt:**
- ✅ `fastapi`
- ✅ `redis`
- ✅ `pydantic`

**May need to add:**
- `scipy` (for chi-square test) - check if already present

---

## Integration with Phase 3.1

**MCP Gateway Tools → Backend Endpoints:**
| MCP Tool | Endpoint | Status |
|----------|----------|--------|
| `metabob_report_execution` | `POST /api/activity-execution` | ⏳ TODO |
| `metabob_get_template_metrics` | `GET /api/template/:id/metrics` | ⏳ TODO |
| `metabob_get_promotion_recommendation` | `GET /api/template/:id/recommendation` | ⏳ TODO |
| `metabob_promote_template` | `POST /api/template/promote` | ⏳ TODO |

---

## Next Steps

1. **Immediate (This Session):**
   - Create `promotion_engine.py`
   - Create `activity_metrics.py` router
   - Register router in `app.py`
   - Basic smoke test

2. **Follow-Up (Next Session):**
   - Write unit tests
   - Write integration tests
   - End-to-end testing (Phase 3.5)

3. **Then: Phase 3.3 (OpenCode Integration)**
   - Create `template-metrics.ts`
   - Update `activity.ts` to call MCP tools
   - Add CLI commands

---

## Architecture Compliance

**Expected Improvements:**
- metabob-opencode: ✅ 100% (no change)
- metabob-cli gateway: ✅ 100% (Phase 3.1 complete)
- metabob-rpc-api: ✅ 100% (after Phase 3.2)

**Overall Target:** 100% compliant (13/13 criteria)

---

**Status:** Ready to implement promotion_engine.py + endpoints
