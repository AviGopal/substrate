# Architecture Separation Analysis: metabob-opencode, metabob-cli, metabob-rpc-api

## Executive Summary

This document analyzes the current separation of concerns between the three components and identifies architectural violations relative to the desired state.

**Desired Architecture:**
- **metabob-opencode**: Activity execution, coordination, data collection
- **metabob-cli**: Data collection, enrichment with inference models, gateway to activity database
- **metabob-rpc-api**: Activity storage in SurrealDB, ML learning, metrics training, data maintenance

**Current State:** Significant boundary violations with ML/learning logic distributed across all three components.

---

## Current Architecture Analysis

### 1. metabob-opencode (TypeScript)

**Location:** `repos/metabob-opencode/packages/opencode/src/`

#### Current Responsibilities

**✅ CORRECT (As Desired):**
- Activity execution orchestration (`session/activity.ts`)
- Activity coordination (`session/activity-coordination.ts`)
- Template management (`session/activity-template.ts`, `session/activity-template-repository.ts`)
- Data collection during execution:
  - Step results tracking
  - Token usage monitoring
  - Cost tracking
  - Error capture

**❌ VIOLATIONS (Should Not Be Here):**

1. **ML/Learning Logic** (`session/impulse-learning.ts`):
   - Learning buffer management
   - Impulse usage tracking
   - Pattern normalization
   - Response quality calculation
   - Learning record persistence
   - **Lines of code:** ~586 lines
   - **Impact:** HIGH - This is pure ML data preparation that belongs in rpc-api

2. **Thompson Sampling Selection** (`session/template-selector.ts`):
   - Beta distribution sampling
   - Variant selection algorithm
   - Alpha/beta parameter management
   - **Lines of code:** ~150 lines (estimated)
   - **Impact:** HIGH - ML selection logic should be in rpc-api

3. **Metrics Aggregation** (`session/template-metrics.ts`, `session/template-metrics-client.ts`):
   - Template metrics types with Thompson Sampling parameters
   - Promotion recommendation types
   - Success rate calculations
   - **Lines of code:** ~320 lines
   - **Impact:** MEDIUM - Type definitions are OK, but calculations should move

4. **Dual-Write Implementation** (`session/template-metrics-client.ts` lines 91-168):
   - Writing to both JSON files AND Redis
   - Coordinating two different storage backends
   - **Impact:** MEDIUM - Creates coupling and violates single responsibility

#### Files with Violations

```
session/impulse-learning.ts                 (586 lines) - MOVE TO rpc-api
session/template-selector.ts               (est. 150)  - MOVE TO rpc-api
session/template-metrics-client.ts         (320)       - REFACTOR (keep client, move logic)
session/template-metrics.ts                (124)       - OK (type definitions)
session/session-memory-metrics.ts          (unknown)   - EVALUATE
```

---

### 2. metabob-cli (Python)

**Location:** `repos/metabob-cli/src/metabob_cli/mcp/`

#### Current Responsibilities

**✅ CORRECT (As Desired):**
- MCP server implementation
- Data collection from code analysis
- CPG inference enrichment
- Code quality issue detection
- File watching and analysis triggers
- Gateway to activity database via MCP tools

**⚠️ PARTIAL VIOLATIONS:**

1. **Activity Manager** (`mcp/activity_manager.py`):
   - Activity execution state tracking (OK - this is coordination)
   - Step result tracking (OK - this is data collection)
   - Trailblazing logic (OK - this is execution coordination)
   - **Lines of code:** ~100 lines shown
   - **Impact:** LOW - Mostly correct, just execution coordination

2. **Learning Tools** (`mcp/learning_tools.py`):
   - MCP tool wrappers for learning endpoints (OK - gateway role)
   - Proxies to rpc-api endpoints (OK - correct pattern)
   - **Lines of code:** ~30 lines per tool
   - **Impact:** NONE - This is correct (gateway to rpc-api)

3. **Activity Template Tools** (`mcp/activity_template_tools.py`):
   - Template registration (OK - gateway)
   - Template search (OK - gateway)
   - **Impact:** NONE - Correct gateway pattern

**✅ GOOD PATTERNS:**
- Learning tools correctly proxy to rpc-api
- No ML logic implemented locally
- Pure gateway/enrichment role maintained

#### Assessment

**Status:** MOSTLY CORRECT
- metabob-cli is properly acting as a gateway
- No significant ML/learning violations
- Correctly delegates to rpc-api for learning operations

---

### 3. metabob-rpc-api (Python)

**Location:** `repos/metabob-rpc-api/server/`

#### Current Responsibilities

**✅ CORRECT (As Desired):**

1. **SurrealDB Operations** (`db/operations/`):
   - `activity_execution.py` - Execution record CRUD
   - `activity_data.py` - Activity storage
   - `activity_content.py` - Template content storage
   - `impulse_data.py` - Impulse persistence
   - **Status:** CORRECT - Proper database layer

2. **Thompson Sampling** (`actions/activity.py` lines 1-150):
   - Beta distribution sampling
   - Variant selection logic
   - Alpha/beta parameter updates
   - **Status:** CORRECT - This is where ML should live

3. **Metrics Aggregation** (`services/metrics_aggregator.py`):
   - Execution metrics calculation
   - Success rate aggregation
   - Cost/duration averaging
   - Template metrics management
   - **Status:** CORRECT - Proper business logic layer

4. **Promotion Engine** (`services/promotion_engine.py`):
   - Statistical A/B testing (chi-square tests)
   - Promotion recommendations
   - Significance testing
   - **Status:** CORRECT - ML decision logic in right place

**❌ VIOLATIONS (Missing Implementation):**

1. **Learning Loop Not Fully Implemented:**
   - Routes defined (`routes/learning_loop.py`) but minimal implementation
   - Impulse learning data not being aggregated
   - Pattern extraction not implemented
   - Context requirement optimization not implemented
   - **Impact:** HIGH - Core learning infrastructure incomplete

2. **SurrealDB Not Primary Storage:**
   - Redis used as primary for Thompson Sampling
   - SurrealDB used for persistence only
   - Dual-write pattern in actions (Redis first, then SurrealDB)
   - **Impact:** MEDIUM - Complexity, but functionally correct

3. **Impulse Learning Endpoint Stubs:**
   - `/v1/learning/impulse-mappings` - defined but incomplete
   - `/v1/learning/pattern-extraction` - not implemented
   - `/v1/learning/context-optimization` - not implemented
   - **Impact:** HIGH - Learning system incomplete

#### Files Status

```
✅ server/actions/activity.py              - Thompson Sampling logic CORRECT
✅ server/services/metrics_aggregator.py   - Metrics calculation CORRECT
✅ server/services/promotion_engine.py     - Statistical testing CORRECT
✅ server/db/operations/*.py               - Database layer CORRECT
⚠️  server/routes/learning_loop.py         - Defined but incomplete
❌ [MISSING] Impulse pattern extraction    - Not implemented
❌ [MISSING] Context requirement learning  - Not implemented
```

---

## Architectural Violations Summary

### High Priority Violations

| Component | Violation | Lines | Impact | Fix Complexity |
|-----------|-----------|-------|--------|----------------|
| opencode | `impulse-learning.ts` - Learning logic | 586 | HIGH | MEDIUM - Move to rpc-api |
| opencode | `template-selector.ts` - Thompson Sampling | 150 | HIGH | LOW - Already in rpc-api |
| opencode | Dual-write to JSON + Redis | 80 | MEDIUM | LOW - Remove JSON path |
| rpc-api | Impulse learning incomplete | N/A | HIGH | HIGH - Implement full loop |

### Medium Priority Issues

| Component | Issue | Impact | Fix Complexity |
|-----------|-------|--------|----------------|
| opencode | Metrics client doing calculations | MEDIUM | LOW - Use rpc-api endpoints |
| rpc-api | Redis as primary vs SurrealDB | MEDIUM | MEDIUM - Refactor data flow |
| opencode | Template selection logic duplicated | LOW | LOW - Delegate to rpc-api |

---

## Desired State Architecture

### Component Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        metabob-opencode                          │
│  - Activity execution orchestration                              │
│  - Activity coordination (trailblazing, retries)                 │
│  - Data collection (tokens, cost, duration, errors)              │
│  - Template loading (via rpc-api client)                         │
│  - Template selection delegation (call rpc-api)                  │
│  ❌ NO ML logic                                                   │
│  ❌ NO learning algorithms                                        │
│  ❌ NO metrics aggregation                                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    (MCP tools / HTTP API)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         metabob-cli                              │
│  - MCP server for code quality tools                             │
│  - CPG inference enrichment                                      │
│  - Code analysis and issue detection                             │
│  - Gateway to activity database (MCP tools)                      │
│  - Data collection from codebase                                 │
│  ❌ NO ML training                                                │
│  ✅ YES: Enrichment with inference models (non-learning)         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        (HTTP API calls)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       metabob-rpc-api                            │
│  ✅ SurrealDB as single source of truth                          │
│  ✅ Thompson Sampling (variant selection)                        │
│  ✅ Metrics aggregation and learning                             │
│  ✅ Promotion engine (statistical testing)                       │
│  ✅ Impulse learning and pattern extraction                      │
│  ✅ Context requirement optimization                             │
│  ✅ Template effectiveness analysis                              │
│  ✅ All ML training and model updates                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Refactoring Strategy

### Phase 1: Remove ML Logic from metabob-opencode (HIGH PRIORITY)

**Goal:** Remove all learning/ML logic from opencode, delegate to rpc-api

#### 1.1 Move Thompson Sampling to rpc-api

**Current:** `opencode/session/template-selector.ts` implements Beta sampling

**Action:**
1. Create rpc-api endpoint: `POST /v1/templates/select-variant`
   - Input: `{ template_id: string, context?: object }`
   - Output: `{ selected_variant_id: string, selection_metadata: {...} }`
2. Implement Thompson Sampling logic in rpc-api (already exists in `actions/activity.py`)
3. Replace opencode template selector with API call
4. Keep selection metadata for transparency

**Files to modify:**
- `opencode/session/template-selector.ts` - Replace with API client
- `rpc-api/routes/activity.py` - Add `/select-variant` endpoint
- `rpc-api/actions/activity.py` - Expose `select_variant_thompson_sampling()` via route

**Estimated effort:** 1-2 days

#### 1.2 Remove impulse-learning.ts from opencode

**Current:** `opencode/session/impulse-learning.ts` (586 lines) implements learning data capture

**Action:**
1. Keep data collection in opencode (tokens, cost, duration, impulses used)
2. Move learning buffer, pattern extraction, quality calculation to rpc-api
3. Create rpc-api endpoint: `POST /v1/learning/record-turn`
   - Input: Raw execution data
   - Processing: Pattern extraction, quality scoring, persistence
4. Call endpoint from opencode after activity completion

**Files to modify:**
- `opencode/session/impulse-learning.ts` - REMOVE or reduce to data collection only
- `rpc-api/routes/learning_loop.py` - Implement `/record-turn` endpoint
- `rpc-api/services/learning_service.py` - NEW: Learning logic from opencode

**Estimated effort:** 3-5 days

#### 1.3 Simplify template-metrics-client.ts

**Current:** Dual-writes to JSON + Redis, contains logic

**Action:**
1. Remove JSON file write path (Path A)
2. Keep only Redis write via rpc-api endpoint
3. Remove local calculations (success rate, quality score)
4. Make client a thin HTTP wrapper

**Files to modify:**
- `opencode/session/template-metrics-client.ts` - Simplify to thin client
- Remove MCP tool `metabob_post_activity_result` (redundant with Redis)

**Estimated effort:** 1 day

**Total Phase 1 effort:** 5-8 days

---

### Phase 2: Complete Learning Loop in rpc-api (HIGH PRIORITY)

**Goal:** Implement missing learning infrastructure

#### 2.1 Impulse Learning Implementation

**Current:** Routes defined but incomplete

**Action:**
1. Implement impulse mapping record storage in SurrealDB
2. Implement pattern extraction from raw messages
3. Implement context requirement optimization
4. Build learning feedback loop

**Files to create/modify:**
- `rpc-api/server/services/impulse_learning_service.py` - NEW
- `rpc-api/server/routes/learning_loop.py` - Complete implementation
- `rpc-api/server/db/operations/impulse_learning.py` - NEW

**Endpoints to implement:**
- `POST /v1/learning/impulse-mappings` - Record mapping
- `POST /v1/learning/pattern-extraction` - Extract patterns
- `GET /v1/learning/context-optimization` - Get optimized requirements

**Estimated effort:** 7-10 days

#### 2.2 Template Effectiveness Learning

**Action:**
1. Aggregate template metrics over time
2. Identify improvement trends
3. Detect regression patterns
4. Generate template quality scores

**Files to create:**
- `rpc-api/server/services/template_effectiveness_service.py` - NEW

**Estimated effort:** 3-5 days

**Total Phase 2 effort:** 10-15 days

---

### Phase 3: Data Storage Consolidation (MEDIUM PRIORITY)

**Goal:** Make SurrealDB primary, simplify Redis usage

#### 3.1 Storage Architecture Decision

**Current:** Redis primary for Thompson Sampling, SurrealDB for persistence

**Options:**

**Option A: SurrealDB Primary (Recommended)**
- All writes go to SurrealDB first
- Redis becomes pure cache layer
- Thompson Sampling reads from Redis cache (with SurrealDB fallback)
- Benefits: Single source of truth, better for learning queries
- Costs: Slightly slower reads (negligible with caching)

**Option B: Keep Current Dual-Write**
- Redis remains primary for hot data
- SurrealDB for historical analysis
- Benefits: Performance
- Costs: Complexity, consistency issues

**Recommendation:** Option A (SurrealDB primary)

#### 3.2 Implementation

**Action:**
1. Refactor write path: SurrealDB first, then Redis cache
2. Add SurrealDB read path for template selection
3. Keep Redis for performance-critical paths with TTL
4. Implement cache invalidation strategy

**Files to modify:**
- `rpc-api/server/actions/activity.py` - Reverse write order
- `rpc-api/server/db/operations/template_metrics.py` - NEW
- `rpc-api/server/services/metrics_aggregator.py` - Add SurrealDB reads

**Estimated effort:** 5-7 days

**Total Phase 3 effort:** 5-7 days

---

### Phase 4: Template Management Clarification (LOW PRIORITY)

**Goal:** Clarify template creation/update flow

#### 4.1 Template Lifecycle

**Current state:**
- Templates created in opencode (via activity execution or trailblazing)
- Templates updated via rpc-api
- Unclear ownership

**Desired:**
- Templates created by opencode (correct - user-facing creation)
- Templates stored in rpc-api immediately upon creation
- Updates flow through rpc-api
- Version control via content-addressable variant IDs (already implemented)

**Action:**
1. Document template lifecycle
2. Ensure immediate persistence to rpc-api on creation
3. Add template governance (approval workflow) in rpc-api

**Files to document:**
- `TEMPLATE_LIFECYCLE.md` - NEW documentation

**Estimated effort:** 2-3 days

---

## Total Refactoring Effort Estimate

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| 1 | Remove ML from opencode | 5-8 days | HIGH |
| 2 | Complete learning loop | 10-15 days | HIGH |
| 3 | Storage consolidation | 5-7 days | MEDIUM |
| 4 | Template governance | 2-3 days | LOW |
| **Total** | **Full refactoring** | **22-33 days** | - |

**Recommended approach:** Tackle Phase 1 and Phase 2 in parallel (opencode and rpc-api teams)

---

## Key Metrics for Success

After refactoring, validate:

1. **Separation of Concerns:**
   - ✅ opencode has ZERO ML logic (search for "thompson", "beta", "learning")
   - ✅ metabob-cli has ZERO training logic (only inference enrichment)
   - ✅ metabob-rpc-api contains ALL learning/training logic

2. **Performance:**
   - Template selection latency < 100ms (p95)
   - Metrics write latency < 50ms (p95)
   - Learning data processing < 5s per turn

3. **Data Integrity:**
   - SurrealDB is queryable source of truth
   - Redis cache hit rate > 95% for hot data
   - Zero data loss in learning pipeline

4. **Maintainability:**
   - Each component has single clear responsibility
   - No duplicated business logic
   - Clean API boundaries between components

---

## Immediate Next Steps

1. **Create GitHub issues** for Phase 1 tasks
2. **Set up branch** for opencode ML removal
3. **Design rpc-api endpoints** for template selection and learning
4. **Run proof-of-concept** for SurrealDB-primary storage
5. **Document API contracts** between components

---

## Questions for Stakeholders

1. **Performance requirements:** What is acceptable latency for template selection?
2. **Data retention:** How long should we keep raw learning data in SurrealDB?
3. **Governance:** Do templates need approval workflow before becoming available?
4. **Backward compatibility:** Do we need to support old JSON-based metrics during migration?
5. **Timeline:** What's the priority relative to other work?

---

## Appendix: File Inventory

### metabob-opencode (violations)
```
session/impulse-learning.ts              (586 lines) - HIGH: Move to rpc-api
session/template-selector.ts            (150 lines) - HIGH: Move to rpc-api
session/template-metrics-client.ts      (320 lines) - MED: Simplify
session/template-metrics.ts             (124 lines) - OK: Type defs
```

### metabob-cli (correct)
```
mcp/activity_manager.py                 - OK: Execution coordination
mcp/learning_tools.py                   - OK: Gateway to rpc-api
mcp/activity_template_tools.py          - OK: Gateway to rpc-api
```

### metabob-rpc-api (mostly correct)
```
✅ actions/activity.py                   - Thompson Sampling present
✅ services/metrics_aggregator.py        - Metrics calculation
✅ services/promotion_engine.py          - Statistical testing
✅ db/operations/*.py                    - Database layer
⚠️  routes/learning_loop.py              - Incomplete
❌ [MISSING] Impulse learning service     - Not implemented
```

---

**Document Version:** 1.0  
**Date:** 2026-02-28  
**Author:** OpenCode Activity Mode Analysis  
**Status:** Draft for Review
