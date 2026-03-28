# OpenSpec Change Dependency Map

This document captures the relationships between active OpenSpec changes, their current status, and what each enables or blocks.

---

## Dependency Graph (Topological Order)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LAYER 0: FOUNDATIONAL                              │
│                         (No dependencies)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐                                           │
│  │ surrealdb-multi-tenant-schema│  ✅ COMPLETE                              │
│  │ ─────────────────────────────│                                           │
│  │ RBAC, org_id isolation,      │                                           │
│  │ federated schema migrations  │                                           │
│  └──────────────┬───────────────┘                                           │
│                 │                                                            │
└─────────────────┼────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LAYER 1: CORE SERVICES                             │
│                         (Built on Layer 0)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────┐   ┌──────────────────────────────┐        │
│  │ impulse-pointer-mvp         │   │ metabob-analysis-api         │        │
│  │ ─────────────────────────────│   │ ─────────────────────────────│        │
│  │ 🔶 PARTIAL                   │   │ ✅ COMPLETE                   │        │
│  │                              │   │                               │        │
│  │ • Custom resolver dispatch   │   │ • TypeScript/Bun/Hono backend│        │
│  │ • Impulse metadata field     │   │ • Analysis orchestration     │        │
│  │ • process_impulse tool       │   │ • Problem/component storage  │        │
│  │ • Resolver registry          │   │ • Online learning            │        │
│  └──────────────┬───────────────┘   └──────────────┬───────────────┘        │
│                 │                                   │                        │
└─────────────────┼───────────────────────────────────┼────────────────────────┘
                  │                                   │
                  ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LAYER 2: ALGORITHMS & BRIDGES                      │
│                         (Built on Layer 1)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │ fix-thompson-sampling│  │ metabob-mcp        │  │ metabob-cloud-      │  │
│  │ ─────────────────────│  │ ─────────────────────│  │ dashboard          │  │
│  │ ⏳ READY             │  │ ✅ COMPLETE         │  │ ─────────────────────│  │
│  │                      │  │                     │  │ ✅ COMPLETE         │  │
│  │ • Beta distribution  │  │ • 7 MCP tools       │  │                     │  │
│  │ • Proper sampling    │  │ • Session mgmt      │  │ • React 19 + shadcn │  │
│  │ • Exploration/exploit│  │ • API bridge        │  │ • 7 core features   │  │
│  └──────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │ metabob-opencode    │                                                    │
│  │ ─────────────────────│                                                    │
│  │ ✅ COMPLETE         │                                                    │
│  │                      │                                                    │
│  │ • MiniBob skill      │                                                    │
│  │ • Observer pattern   │                                                    │
│  └──────────────────────┘                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LAYER 3: GOVERNANCE                                 │
│                         (Built on Layers 0-2)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ observation-hierarchy-foundation                                      │   │
│  │ ─────────────────────────────────────────────────────────────────────│   │
│  │ ⏳ DESIGN COMPLETE                                                    │   │
│  │                                                                        │   │
│  │ Requires: impulse-pointer-mvp + fix-thompson-sampling                 │   │
│  │                                                                        │   │
│  │ • Multi-scale traces (Layer 0-3)        • Template lifecycle          │   │
│  │ • Convergence verification              • Circuit breaker             │   │
│  │ • Peer comparison                       • Generation depth tracking   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ internal-dashboard                                                    │   │
│  │ ─────────────────────────────────────────────────────────────────────│   │
│  │ ✅ COMPLETE (basic)                                                   │   │
│  │                                                                        │   │
│  │ Requires: impulse-pointer-mvp + observation-hierarchy-foundation      │   │
│  │                                                                        │   │
│  │ • Impulse-driven UI architecture        • System introspection        │   │
│  │ • Query interface                       • MiniBob tools for UI        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LAYER 4: UNIFICATION                                │
│                         (Brings all sources together)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ multi-source-learning                                                 │   │
│  │ ─────────────────────────────────────────────────────────────────────│   │
│  │ ⏳ SPEC COMPLETE                                                      │   │
│  │                                                                        │   │
│  │ Requires: observation-hierarchy-foundation + impulse-pointer-mvp      │   │
│  │                                                                        │   │
│  │ • MCP sessions → execution traces       • Pattern emergence queries  │   │
│  │ • Git commits → execution traces        • Analysis-API impulse       │   │
│  │ • Unified MultiScaleTrace format          pointers                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Change Status Summary

| Change | Status | Blocking | Blocked By |
|--------|--------|----------|------------|
| surrealdb-multi-tenant-schema | ✅ COMPLETE | Layer 1+ | - |
| impulse-pointer-mvp | 🔶 PARTIAL | observation-hierarchy, internal-dashboard, multi-source-learning | surrealdb-multi-tenant-schema |
| metabob-analysis-api | ✅ COMPLETE | metabob-mcp, metabob-cloud-dashboard | surrealdb-multi-tenant-schema |
| fix-thompson-sampling | ⏳ READY | observation-hierarchy-foundation | - |
| metabob-mcp | ✅ COMPLETE | - | metabob-analysis-api |
| metabob-cloud-dashboard | ✅ COMPLETE | - | metabob-analysis-api |
| metabob-opencode | ✅ COMPLETE | - | - |
| observation-hierarchy-foundation | ⏳ DESIGN | multi-source-learning, internal-dashboard (full) | impulse-pointer-mvp, fix-thompson-sampling |
| internal-dashboard | ✅ BASIC | - | impulse-pointer-mvp, observation-hierarchy |
| multi-source-learning | ⏳ SPEC | - | observation-hierarchy, impulse-pointer-mvp |

---

## Critical Paths

### Path 1: Learning System Autonomy (HIGHEST PRIORITY)

**Goal**: Enable boredom activities and autonomous improvement

```
surrealdb-multi-tenant-schema ✅
       │
       ▼
impulse-pointer-mvp 🔶 ← Current blocker
       │
       ├──────────────────────┐
       ▼                      ▼
fix-thompson-sampling ⏳    (parallel)
       │
       ▼
observation-hierarchy-foundation ⏳
       │
       ▼
multi-source-learning ⏳
```

**What's blocking**: Custom resolver dispatch in impulse-pointer-mvp is incomplete. Without this, impulses can't be resolved via the registry pattern.

**Impact if blocked**:
- Thompson Sampling is deterministic (no exploration)
- No multi-scale traces (can't observe at higher layers)
- No pattern emergence (can't aggregate across sources)

### Path 2: Customer-Facing Services (COMPLETE)

**Goal**: Analysis tools accessible via MCP/dashboard

```
surrealdb-multi-tenant-schema ✅
       │
       ▼
metabob-analysis-api ✅
       │
       ├──────────────────────┐
       ▼                      ▼
metabob-mcp ✅            metabob-cloud-dashboard ✅
```

**Status**: Complete and deployed.

### Path 3: Internal Observability (PARTIAL)

**Goal**: Team visibility into system behavior

```
surrealdb-multi-tenant-schema ✅
       │
       ▼
impulse-pointer-mvp 🔶 ← Blocker
       │
       ▼
observation-hierarchy-foundation ⏳
       │
       ▼
internal-dashboard ✅ (basic, awaiting observation layer)
```

**What's missing**: Full observation layer for system health metrics, circuit breaker state, peer anomalies.

---

## What Each Change Enables

### surrealdb-multi-tenant-schema ✅
**Enables**:
- RBAC with JWT + RECORD authentication
- Org/project isolation at database level
- Public template marketplace
- Federated schema migrations
- Stack deployment activities

### impulse-pointer-mvp 🔶
**Enables**:
- Custom resolver dispatch (route to appropriate handler)
- Impulse metadata (shape, row_count, summary, columns)
- Pointer-mode formatting (metadata-only context injection)
- process_impulse tool (filter, expand, resolve operations)
- Resolver registry (validated storage of resolvers)
- Backend impulse type expansion without MiniBob changes

**Currently missing**:
- `customResolvers` not wired into `resolvePointer()`
- `metadata` field not added to Impulse type
- `process_impulse` tool not implemented

### fix-thompson-sampling ⏳
**Enables**:
- Proper Beta distribution sampling (not expected value)
- Exploration-exploitation balance
- A/B testing actually works
- New templates get explored (not starved)
- Failed templates recover (not permanently penalized)

**Currently broken**:
- Uses `α/(α+β)` (deterministic) instead of `Beta(α,β).sample()` (probabilistic)
- Always selects highest expected value = no exploration

### observation-hierarchy-foundation ⏳
**Enables**:
- Multi-scale traces (Layer 0: tool calls, Layer 1: task patterns, Layer 2: activity patterns, Layer 3: composition context)
- Convergence verification (parallel execution + structural comparison)
- Template lifecycle (pruning, score decay, generation depth)
- Circuit breaker (halts autonomous activity on repeated failures)
- Peer comparison (flags anomalous variants)
- Governance framework (convince/coerce/kill)

### multi-source-learning ⏳
**Enables**:
- MCP sessions produce execution traces
- Git commits produce execution traces
- All sources feed unified learning
- Pattern emergence via SQL aggregation
- Analysis-API impulse pointers (CPG, problems, impact)
- Co-change pattern learning from commits

---

## Recommended Implementation Order

### Phase 1: Foundation Fixes (Unblock Everything)

1. **fix-thompson-sampling** (smallest, highest impact)
   - Replace `sample = α/(α+β)` with actual Beta distribution sampling
   - Add tests verifying probabilistic selection
   - ~2 hours of work

2. **impulse-pointer-mvp** (complete remaining tasks)
   - Wire `customResolvers` into `resolvePointer()`
   - Add `metadata` field to Impulse type
   - Implement `process_impulse` tool
   - ~1 day of work

### Phase 2: Governance Layer

3. **observation-hierarchy-foundation**
   - Add MultiScaleTrace schema fields
   - Implement circuit breaker
   - Implement peer comparison
   - ~2-3 days of work

### Phase 3: Unification

4. **multi-source-learning**
   - Add source field to execution traces
   - Add MCP session trace accumulator
   - Add Git import route
   - Implement pattern emergence queries
   - ~3-5 days of work

---

## Blockers and Mitigations

### Blocker 1: Thompson Sampling is Deterministic

**Impact**: System cannot explore, cannot recover from early failures, A/B testing doesn't work.

**Mitigation**: Implement fix-thompson-sampling immediately (~2 hours).

**Code location**: `repos/metabob-activity-api/src/routes/activities.ts`

### Blocker 2: Custom Resolvers Not Dispatched

**Impact**: New impulse types can't be added, boredom-driven resolver extraction won't work.

**Mitigation**: Wire `ImpulseStore.customResolvers` into `resolvePointer()` in MiniBob.

**Code location**: `repos/minibob/src/impulse.ts`

### Blocker 3: No Multi-Scale Traces

**Impact**: Can't observe patterns above single execution, can't build governance layer.

**Mitigation**: Add Layer 0-3 fields to execution trace schema, start recording.

**Code location**: `repos/metabob-activity-api/sql/schemas/011-executions.surql`

---

## Verification Criteria

### fix-thompson-sampling is complete when:
- [ ] `Beta(α,β).sample()` is used instead of `α/(α+β)`
- [ ] Running 100 recommendations for equal templates shows ~50/50 split with variance
- [ ] Template with α=10,β=2 is selected more often than α=2,β=10
- [ ] New template (α=1,β=1) appears in results with non-zero probability

### impulse-pointer-mvp is complete when:
- [ ] `customResolvers` map dispatches to registered resolvers
- [ ] `ImpulseResolver.register(type, handler)` works
- [ ] `impulse.metadata` field contains shape/count/summary
- [ ] `process_impulse` tool can filter/expand/resolve
- [ ] Backend can add new impulse types without MiniBob code changes

### observation-hierarchy-foundation is complete when:
- [ ] Execution traces have `taskPatterns`, `activityPattern`, `compositionContext` fields
- [ ] Circuit breaker halts boredom activities after N consecutive failures
- [ ] Peer comparison flags variants with >2 stddev deviation
- [ ] Template pruning removes variants with <0.1 success rate after N executions

### multi-source-learning is complete when:
- [ ] MCP sessions produce traces with `source='mcp'`
- [ ] Git commits produce traces with `source='git'`
- [ ] MiniBob executions produce traces with `source='execution'`
- [ ] Query by source returns correct traces
- [ ] Pattern emergence query returns aggregated sequences
