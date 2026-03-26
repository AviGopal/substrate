# Architecture Enforcement Activity: Metabob Component Separation

## Overview

I've created a comprehensive activity template that enforces the separation of concerns between metabob-opencode, metabob-cli, and metabob-rpc-api using a constraint-driven approach.

**Activity Template ID:** `enforce-architecture-separation-metabob-components`  
**Category:** refactor  
**Tasks:** 5 phases  
**Approach:** Each phase uses the `trace-enforce-validate-loop` activity to define constraints and systematically enforce them

---

## Activity Design Philosophy

### Constraint-Driven Enforcement

Instead of manually implementing the refactoring, this activity:

1. **Defines architectural constraints** as specifications
2. **Traces current implementation** against desired state  
3. **Enforces constraints** through code mutations
4. **Validates externally** using test harnesses (not LLM-dependent)
5. **Aggregates conflicts** across specifications
6. **Ripples changes** to maintain consistency
7. **Commits with documentation** of state transitions

### Nested Activity Composition

Each phase invokes `trace-enforce-validate-loop` activity 1-3 times:
- **Phase 1**: 3 invocations (Thompson Sampling, Impulse Learning, Metrics)
- **Phase 2**: 3 invocations (Storage, Pattern Extraction, Context Optimization)
- **Phase 3**: 1 invocation (SurrealDB Primary)
- **Phase 4**: 1 invocation (Overall Validation)
- **Phase 5**: Commit organization

**Total**: 8 nested `trace-enforce-validate-loop` invocations

---

## Activity Structure

### Phase 1: Remove ML Logic from metabob-opencode

**Goal:** Remove all machine learning and learning logic from metabob-opencode

**Constraints Enforced:**

1. **`thompson-sampling-in-rpc-api-only`**
   - Thompson Sampling (Beta distribution) ONLY in rpc-api
   - opencode calls `/v1/templates/select-variant` endpoint
   - Validation: 0 matches for 'thompson', 'beta', 'Math.random' in opencode

2. **`impulse-learning-in-rpc-api-only`**
   - Impulse learning (pattern extraction, quality scoring) ONLY in rpc-api
   - opencode calls `/v1/learning/record-turn` endpoint
   - `session/impulse-learning.ts` reduced to <50 lines or deleted

3. **`metrics-calculation-in-rpc-api-only`**
   - Metrics calculations ONLY in rpc-api
   - `template-metrics-client.ts` is thin HTTP client (<100 lines)
   - No dual-write to JSON files

**Expected Impact:**
- ✅ 800+ lines removed from opencode
- ✅ 3 new rpc-api endpoints created
- ✅ Zero ML logic in opencode

---

### Phase 2: Complete Learning Loop in metabob-rpc-api

**Goal:** Implement missing learning infrastructure in rpc-api

**Constraints Enforced:**

1. **`impulse-learning-storage-complete`**
   - POST `/v1/learning/impulse-mappings` stores in SurrealDB
   - Implements pattern extraction from removed opencode logic
   - SurrealDB table: `impulse_learning_records`

2. **`pattern-extraction-service-complete`**
   - Service extracts: file paths, components, patterns, complexity
   - Logic ported from `opencode/impulse-learning.ts` lines 200-350
   - File: `server/services/pattern_extraction_service.py`

3. **`context-optimization-endpoint-complete`**
   - GET `/v1/learning/context-optimization?activity_type=X`
   - Returns optimal impulse recommendations based on history
   - Queries `impulse_learning_records` for patterns

**Expected Impact:**
- ✅ Full learning loop operational
- ✅ 3 new endpoints + 1 service created
- ✅ Learning data flows through rpc-api

---

### Phase 3: Storage Consolidation

**Goal:** Make SurrealDB primary store, Redis as cache

**Constraints Enforced:**

1. **`surrealdb-primary-redis-cache`**
   - Write path: SurrealDB first → Redis cache
   - Read path: Redis cache hit → SurrealDB fallback → populate cache
   - Cache invalidation on writes
   - TTL=3600s for cached data

**Implementation Changes:**
- Refactor `actions/activity.py` write path (SurrealDB before Redis)
- Refactor read path (Redis first, SurrealDB fallback)
- Create `db/operations/template_metrics.py` for SurrealDB CRUD
- Add cache invalidation logic

**Expected Impact:**
- ✅ Single source of truth (SurrealDB)
- ✅ Performance maintained (cache hit rate >95%)
- ✅ Reduced complexity (no dual-write issues)

---

### Phase 4: Validate Complete Separation

**Goal:** Final validation across all three components

**Constraints Enforced:**

1. **`complete-architecture-separation`**
   - metabob-opencode: ZERO ML keywords
   - metabob-cli: ZERO training logic
   - metabob-rpc-api: ALL learning endpoints
   - Data flow: opencode → cli (MCP) → rpc-api (HTTP) → SurrealDB
   - Template lifecycle: created in opencode → stored in rpc-api

**Validation Checklist:**

| Responsibility | opencode | cli | rpc-api |
|----------------|----------|-----|------------|
| Activity execution | ✅ | ❌ | ❌ |
| Activity coordination | ✅ | ❌ | ❌ |
| Data collection | ✅ | ✅ | ❌ |
| CPG enrichment | ❌ | ✅ | ❌ |
| MCP gateway | ❌ | ✅ | ❌ |
| Thompson Sampling | ❌ | ❌ | ✅ |
| Pattern extraction | ❌ | ❌ | ✅ |
| Metrics aggregation | ❌ | ❌ | ✅ |
| Learning training | ❌ | ❌ | ✅ |
| SurrealDB storage | ❌ | ❌ | ✅ |

**Expected Output:**
- ✅ Architecture separation score: 100%
- ✅ 0 violations found
- ✅ `SEPARATION_VALIDATION_REPORT.md` created

---

### Phase 5: Commit Architecture Refactor

**Goal:** Create organized, atomic commits with comprehensive documentation

**Commit Strategy:**

**Commit 1:** Remove ML logic from metabob-opencode
```
refactor(opencode): Remove ML/learning logic, enforce separation

Removes all machine learning and learning logic from metabob-opencode:
- Remove Thompson Sampling from template-selector.ts
- Remove impulse learning from impulse-learning.ts (586 lines → <50 lines)
- Simplify template-metrics-client.ts to thin HTTP client
- Replace local logic with rpc-api endpoint calls
```

**Commit 2:** Complete learning loop in metabob-rpc-api
```
feat(rpc-api): Complete impulse learning and pattern extraction

Implements missing learning infrastructure in metabob-rpc-api:
- Implement /v1/learning/impulse-mappings endpoint
- Create pattern_extraction_service.py with logic from opencode
- Implement /v1/learning/context-optimization endpoint
```

**Commit 3:** Consolidate storage with SurrealDB primary
```
refactor(rpc-api): Make SurrealDB primary store, Redis as cache

Refactors storage hierarchy to use SurrealDB as single source of truth:
- Write path: SurrealDB first, then Redis cache
- Read path: Redis cache hit → fallback to SurrealDB → populate cache
```

**Commit 4:** Add validation and documentation
```
docs: Add architecture separation validation and reports

Adds comprehensive documentation of architecture refactoring:
- ARCHITECTURE_SEPARATION_ANALYSIS.md (initial analysis)
- SEPARATION_VALIDATION_REPORT.md (validation results)
- Update component architecture docs
```

**Git Tag:** `architecture-separation-v1`

---

## How to Execute

### Prerequisites

1. Clean git state (or at least commitable state)
2. Analysis document exists: `ARCHITECTURE_SEPARATION_ANALYSIS.md`
3. Access to all three repositories

### Execution Command

```bash
activity({
  templateId: "enforce-architecture-separation-metabob-components",
  variables: {},  # No variables required - all guidance in prompts
  reason: "Enforce clean separation of concerns between metabob-opencode, metabob-cli, and metabob-rpc-api per ARCHITECTURE_SEPARATION_ANALYSIS.md. Remove ML logic from opencode, complete learning loop in rpc-api, consolidate storage with SurrealDB primary."
})
```

### Expected Duration

Based on similar activities:
- **Total time:** 5-8 hours (automated execution)
- **Cost estimate:** $5-10 (based on trace-enforce-validate-loop: $2.43 × 8 invocations + overhead)
- **Human review time:** 2-3 hours (reviewing commits, testing)

---

## Benefits of This Approach

### 1. **Self-Verifying**
- External validation harnesses (not LLM-dependent)
- Validation survives as permanent tests
- Can re-run to verify architecture remains clean

### 2. **Systematic**
- Each constraint traced → enforced → validated independently
- Changes ripple through entire codebase
- Conflicts detected and resolved automatically

### 3. **Documented**
- Every change has "WHY" in annotations
- Commit messages explain state transitions
- Validation report proves correctness

### 4. **Reproducible**
- Activity can be re-run for similar refactorings
- Validation harnesses become regression tests
- Pattern can be applied to other architecture separations

### 5. **Conflict-Aware**
- Detects conflicting specifications
- Suggests resolution strategies
- Ensures all specs remain satisfied after changes

---

## Success Metrics

After execution, validate:

1. **Code Patterns:**
   - 0 ML keywords in opencode
   - 0 training logic in CLI
   - All learning logic in rpc-api

2. **File Sizes:**
   - `impulse-learning.ts`: <50 lines or deleted
   - `template-selector.ts`: <30 lines (thin client)
   - `template-metrics-client.ts`: <100 lines (thin client)

3. **API Contracts:**
   - `/v1/templates/select-variant` exists
   - `/v1/learning/impulse-mappings` exists
   - `/v1/learning/context-optimization` exists

4. **Data Flow:**
   - Integration test passes (opencode → rpc-api → SurrealDB)
   - Thompson Sampling uses SurrealDB metrics
   - Cache hit rate >95%

5. **Documentation:**
   - `SEPARATION_VALIDATION_REPORT.md` exists
   - All commits have comprehensive messages
   - Component docs updated

---

## Relationship to Analysis Document

This activity **implements** the refactoring strategy defined in `ARCHITECTURE_SEPARATION_ANALYSIS.md`:

| Analysis Phase | Activity Phase | Status |
|----------------|----------------|---------|
| Phase 1: Remove ML from opencode (5-8 days) | Phase 1: Remove ML (3 constraints) | ✅ Automated |
| Phase 2: Complete learning loop (10-15 days) | Phase 2: Complete loop (3 constraints) | ✅ Automated |
| Phase 3: Storage consolidation (5-7 days) | Phase 3: Storage (1 constraint) | ✅ Automated |
| Phase 4: Template governance (2-3 days) | Phase 4: Validation (1 constraint) | ✅ Automated |

**Time reduction:** 22-33 days → 5-8 hours (automated execution)

---

## Lessons Learned

### What Works Well

1. **Constraint-first thinking:** Define desired state, let activity enforce it
2. **Nested activities:** Compose complex workflows from proven primitives
3. **External validation:** Non-LLM harnesses survive as permanent tests
4. **Conflict detection:** Cross-specification analysis prevents regressions

### Improvements for Next Time

1. **Pre-validation:** Test each constraint independently before full execution
2. **Rollback strategy:** Define rollback points for each phase
3. **Incremental commits:** Consider committing after each constraint (not just each phase)
4. **Performance baselines:** Establish cache hit rate, latency baselines before refactoring

---

## Next Steps

1. **Execute the activity** (see "How to Execute" above)
2. **Monitor progress** through activity task completion
3. **Review generated commits** before pushing
4. **Run integration tests** to verify data flow
5. **Update developer docs** with new architecture
6. **Communicate changes** to team

---

## Files Created

1. **Activity Template:** `templates/enforce-architecture-separation.json`
   - Registered as: `enforce-architecture-separation-metabob-components`
   - 5 tasks, each using nested `trace-enforce-validate-loop` invocations

2. **Analysis Document:** `ARCHITECTURE_SEPARATION_ANALYSIS.md`
   - Current state analysis
   - Violation identification
   - Refactoring strategy
   - Effort estimates

3. **This Document:** `ARCHITECTURE_ENFORCEMENT_ACTIVITY.md`
   - Activity design philosophy
   - Phase-by-phase breakdown
   - Execution guide
   - Success metrics

---

## Questions or Issues?

If the activity fails or produces unexpected results:

1. Check `activity_error_inspector` for detailed error analysis
2. Review validation harnesses for specific failures
3. Examine conflict analysis output for conflicting specifications
4. Consider breaking down phases into smaller constraint invocations

---

**Document Version:** 1.0  
**Date:** 2026-02-28  
**Activity Template:** `enforce-architecture-separation-metabob-components`  
**Status:** Ready for Execution
