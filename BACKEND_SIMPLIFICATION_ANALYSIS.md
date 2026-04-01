# Backend Simplification Analysis

**Date**: 2026-04-01
**Purpose**: Align metabob-activity-api with IMPULSE_ACTIVITY_FOUNDATION.md

---

## Executive Summary

The metabob-activity-api has grown to **~9,000 lines of code** across routes, services, resolvers, and utilities. The foundational architecture document specifies the backend should be a simple **trace store + pattern learner** with 3 core endpoints.

**Recommendation**: Simplify to **~1,500 lines** (83% reduction) by removing vessel responsibilities that migrated into the backend.

---

## Current State

### Code Complexity
- **Routes**: ~5,000 lines (10+ files)
- **Services**: ~1,500 lines
- **Resolvers**: ~1,600 lines (should be in vessels)
- **Utils**: ~1,000 lines
- **Total**: ~9,000 lines

### Schema Complexity
- **17 schema files** (150KB total)
- Many tables for vessel responsibilities
- Overlapping/redundant patterns
- Incompatible views (paradigm-computed-views)

---

## Foundation Requirements

From `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`:

### Backend Role

1. **Trace Store** - Receive and store execution traces from vessels
2. **Pattern Learner** - Analyze traces for Thompson Sampling, composition patterns
3. **Historical Data Source** - Serve stored traces via queries

### Minimal API

```typescript
POST /v2/traces                 // Store execution trace
POST /v2/traces/query           // Resolve trace-type impulses
POST /v2/activities/recommend   // Thompson-sampled recommendations

// Plus auth
POST /v2/auth/minibob/signin
GET /v2/health
```

**Key Principle**: "Everything else is either a query type passed to `/v2/traces/query`, derived from stored traces, or not a separate endpoint."

---

## What to Remove

### 1. Resolvers in Backend (~1,600 lines)

**Why Remove**: Foundation states "resolvers live where data lives" (in vessels)

- ❌ `src/resolvers/llm-proxy.ts` (403 lines) - LLM resolution in vessels
- ❌ `src/resolvers/budget.ts` (354 lines) - Budget management in vessels
- ❌ `src/resolvers/pattern-store.ts` (450 lines) - Duplicate of pattern-miner?
- ❌ `src/resolvers/router.ts` (402 lines) - Routing happens in vessels

### 2. Redundant Resolution Routes (~750 lines)

**Why Remove**: Should use unified `/v2/traces/query`

- ❌ `src/routes/resolve.ts` (539 lines)
- ❌ `src/routes/resolvers.ts` (210 lines)

### 3. Vessel Management (~436 lines)

**Why Remove**: Vessels self-register, backend stores traces

- ❌ `src/routes/vessel-registry.ts` (436 lines)

### 4. State Space Exploration (~339 lines)

**Why Remove**: Vessels explore, backend stores outcomes

- ❌ `src/routes/state-space.ts` (339 lines)

### 5. Template Generation (~620 lines)

**Why Remove**: Ribosome belongs in vessels

- ❌ `src/services/template-merger.ts` (510 lines)
- ❌ `src/routes/ribosome.ts` (110 lines)

### 6. Semantic/Tag Utils (~400 lines)

**Why Remove**: Reasoning happens in vessels

- ❌ `src/utils/semantic-tags.ts` (282 lines)
- ⚠️ `src/utils/impulse-relevancy.ts` (257 lines) - Keep calculation, remove resolution

---

## What to Simplify

### activities.ts (1,261 → ~300 lines)

**Keep**:
- Template CRUD (store, list, get)
- Recommendation endpoint (Thompson Sampling)

**Remove**:
- Variant management (separate service if needed)
- Complex composition logic (vessels handle)
- Extra metrics endpoints (derive from traces)

### impulses.ts (massive → ~200 lines)

**Keep**:
- Store impulse metadata for traces
- Query impulse metadata

**Remove**:
- Resolution logic (vessels resolve)
- Shape-based routing (vessels know shapes)

### execution-traces.ts (keep but simplify)

**Keep**: Core trace storage and querying

**Simplify**:
- Single trace format (no split-brain)
- Unified query interface via type parameter

---

## Schema Simplification

### Current: 17 Schemas → Target: 4 Schemas

**Keep**:
1. ✅ `000-auth-schema.surql` - MiniBob instance auth
2. ✅ `010-activity-registry.surql` - Template storage (simplified)
3. ✅ `011-executions.surql` - Trace storage (simplified)
4. ✅ `018-patterns.surql` - Learned patterns (simplified)

**Remove**:
- ❌ `012-composition.surql` - Derive from traces
- ❌ `013-impulse-tool-usage.surql` - Derive from traces
- ❌ `014-ribosome-sequences.surql` - Move to vessel
- ❌ `015-impulse-metadata.surql` - Vessels manage
- ❌ `017-llm-resolution.surql` - Vessels resolve
- ❌ `020-paradigm-core-tables.surql` - Overcomplicated
- ❌ `021-paradigm-computed-views.surql` - Incompatible + unnecessary
- ❌ `022-paradigm-compat-views.surql` - Backwards compat not needed
- ❌ `023-shape-conditioned-scores.surql` - Vessels decide
- ❌ `024-vessel-capabilities.surql` - Vessels self-describe
- ❌ `025-validation-traces.surql` - Move to vessel
- ❌ `026-activity-template-alias.surql` - Unnecessary indirection
- ❌ `027-vessel-registry.surql` - Vessels self-register
- ❌ `028-resolver-architecture.surql` - Vessels have resolvers

---

## Target Architecture

### Minimal Backend API

```typescript
// ============================================================
// Trace Storage & Querying
// ============================================================

POST /v2/traces
  Request: {
    vessel_id: string
    activity_id: string
    template_id: string
    input_impulses: Impulse[]
    steps: Step[]
    output_impulses: Impulse[]
    state_transition: StateTransition
    metadata: object
  }
  Response: { trace_id: string }

POST /v2/traces/query
  Request: {
    type: "executionTrace" | "recentExecutions" | "failurePatterns" |
          "compositionPatterns" | "systemHealth" | "toolUsage" | ...
    params: object
  }
  Response: { data: any[] }

// ============================================================
// Activity Recommendations
// ============================================================

POST /v2/activities/recommend
  Request: {
    goal: string
    context?: string[]
    exclude?: string[]
    limit?: number
  }
  Response: {
    recommendations: Array<{
      template_id: string
      score: number
      thompson_sample: number
    }>
  }

// ============================================================
// Template Storage (Simple CRUD)
// ============================================================

POST /v2/activities/templates
  Request: ActivityTemplate
  Response: { template_id: string }

GET /v2/activities/templates
  Query: ?category=...&search=...&limit=...
  Response: { templates: ActivityTemplate[] }

GET /v2/activities/templates/:id
  Response: ActivityTemplate

// ============================================================
// Auth & Health
// ============================================================

POST /v2/auth/minibob/signin
  Request: { instance_id: string, api_key: string }
  Response: { token: string, org_id: string }

GET /v2/health
  Response: { status: "healthy" | "degraded", checks: {...} }
```

### Minimal Schema

```sql
-- 1. Auth
DEFINE TABLE minibob_instance SCHEMAFULL
DEFINE ACCESS minibob_record ON DATABASE TYPE RECORD

-- 2. Templates
DEFINE TABLE activity_template SCHEMAFULL
  -- Fields: template_id, org_id, name, category, tasks, variables
  -- Learning: thompson_alpha, thompson_beta

-- 3. Traces
DEFINE TABLE execution_trace SCHEMAFULL
  -- Fields: trace_id, vessel_id, activity_id, template_id
  -- Data: input_impulses, steps, output_impulses
  -- Metrics: status, duration_ms, cost_usd, tokens_used
  -- Learning: parent_activity_id, composition_sequence

-- 4. Patterns
DEFINE TABLE learned_pattern SCHEMAFULL
  -- Fields: pattern_id, pattern_type, pattern_data
  -- Metrics: frequency, success_rate, last_seen
```

---

## Migration Strategy

### Phase 1: Create Simplified Branch (Week 1)

1. Create `simple-backend` branch
2. Implement minimal routes:
   - `/v2/traces` (POST, query)
   - `/v2/activities/recommend`
   - `/v2/activities/templates` (CRUD)
   - Auth endpoints
3. Implement simplified schemas (4 files)
4. Test with MiniBob + `progressive-goal-achievement` template

### Phase 2: Validate (Week 2)

1. Run progressive composition tests
2. Verify learning loop works:
   - Thompson Sampling updates
   - Composition patterns discovered
   - Trace queries resolve correctly
3. Performance benchmark vs current backend

### Phase 3: Migration (Week 3)

1. If tests pass, merge `simple-backend` → `main`
2. Delete removed files:
   - 13 schema files
   - ~4,000 lines of code
3. Update documentation
4. Deploy to local cluster

### Phase 4: Cleanup (Week 4)

1. Remove backup files (.backup, .bak2, .bak3)
2. Archive old backend as reference
3. Update CLAUDE.md with new architecture
4. Celebrate 83% code reduction 🎉

---

## Benefits

### Code Quality
- **83% smaller** (~9,000 → ~1,500 lines)
- **Clearer separation** (vessels vs backend)
- **Easier to maintain**
- **Fewer bugs** (less code = fewer bugs)

### Performance
- **Faster queries** (fewer tables, simpler joins)
- **Lower memory** (smaller schema)
- **Better caching** (predictable patterns)

### Alignment
- **Matches foundation** (impulse-activity model)
- **Vessels own resolution** (as intended)
- **Backend stores traces** (as intended)
- **Learning from patterns** (as intended)

### Developer Experience
- **Easy to understand** (3 core endpoints)
- **Easy to debug** (trace everything)
- **Easy to extend** (add query types)

---

## Risks & Mitigations

### Risk 1: Lost Functionality

**Mitigation**:
- All "lost" functionality moves to vessels
- Vessels can still call backend for trace queries
- Feature parity maintained, just better organized

### Risk 2: Migration Complexity

**Mitigation**:
- Branch-based development
- Parallel testing before merge
- Can revert if issues found

### Risk 3: Performance Regression

**Mitigation**:
- Benchmark before/after
- Simpler schemas often faster
- Can optimize query performance

---

## Next Steps

**Immediate (Today)**:
1. Review this analysis
2. Decide: simplify now or continue with current complexity?
3. If simplify: Create `simple-backend` branch

**Short-term (Week 1)**:
4. Implement minimal routes
5. Test with MiniBob
6. Validate learning loop

**Medium-term (Week 2-3)**:
7. Merge if successful
8. Deploy simplified backend
9. Archive old code

---

## Conclusion

The metabob-activity-api has accumulated significant complexity by taking on responsibilities that belong in vessels (resolution, routing, template extraction, state exploration).

By simplifying to **trace store + pattern learner** as specified in the foundation document, we achieve:
- 83% code reduction
- Clearer architecture
- Better separation of concerns
- Alignment with core principles

The migration is low-risk (branch-based) and high-reward (simpler, faster, clearer).

**Recommendation**: Proceed with simplification.
