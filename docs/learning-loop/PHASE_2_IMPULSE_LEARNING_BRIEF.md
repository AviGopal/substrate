# Phase 2: Impulse-Driven Context Learning (Brief)

## Key Insight
The activity system learns **what context to provide** via impulses, not just execution tracking.

## Goal
Minimize token costs while maximizing success rates through intelligent context pre-loading.

## What We Track

### Per Task:
- `impulses_loaded`: Which impulses were provided (id, tokens, was_used)
- `impulses_created`: What this task produced for downstream
- `context_ratio`: context_tokens / total_tokens (want this LOW)

### Per Activity:
- `context_requirements`: What impulses memory agent gathered
- `memory_agent_cost`: Cost of context gathering
- Impulse chain flow between tasks

## Learning Queries

1. **Optimal Context Size**: What context_ratio gives best success/cost?
2. **Critical Impulses**: Which impulses correlate with success?
3. **Wasted Context**: Which impulses loaded but never used?
4. **Chain Efficiency**: Do downstream tasks use created impulses?

## Expected Impact

**Before Learning**:
- Load entire codebase: 100K tokens, $0.50/exec, 90% success

**After Learning**:
- Load only relevant modules: 10K tokens, $0.05/exec, 90% success
- **Result**: 10x cost reduction, same quality!

## Schema Additions

```sql
-- task_execution table
ADD COLUMN impulses_loaded ARRAY;
ADD COLUMN impulses_created ARRAY;
ADD COLUMN total_context_tokens INT;
ADD COLUMN context_ratio DECIMAL;

-- activity_content table  
ADD COLUMN context_requirements ARRAY;
ADD COLUMN memory_agent_session_id STRING;
ADD COLUMN memory_agent_cost DECIMAL;
```

## Next Steps
1. Update schema with impulse tracking
2. Add context metrics to API endpoints
3. Implement impulse usage detection
4. Build learning dashboards
5. Test: measure context_ratio evolution

**Goal**: Templates evolve toward minimal cost + high success via learning.
