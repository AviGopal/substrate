# OpenSpec Alignment Registry

> Generated: 2026-03-26
> Canonical Reference: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

## Phase 2: Prune (Completed)

### Summary

| Spec | Before | After | Action Taken |
|------|--------|-------|--------------|
| metabob-mcp-vessel-spec | 6.5/10 | 8.5/10 | ✅ Added foundation alignment section |
| metabob-analysis-api-spec | 8.0/10 | 8.0/10 | Keep as-is (already aligned) |
| self-development-loop | 8.5/10 | 9.0/10 | ✅ Added impulse creation from traces |
| minibob-tui | 7.0/10 | 8.5/10 | ✅ Added resolver mapping table |
| vessel-development-architecture | 8.5/10 | 8.5/10 | Keep as-is (minor issue only) |
| llm-goal-enrichment | 6.0/10 | 9.0/10 | ✅ **REWRITTEN** - LLM removed from decisions |

## Phase 1: Jiggle (Conflict Detection)

---

## Critical Alignment Issues

### 🔴 HIGH SEVERITY

#### 1. llm-goal-enrichment: LLM as Controller (FOUNDATION VIOLATION)

**Foundation says:**
> "LLMs Are Tools, Not Controllers" - LLMs are one resolver type. Use them for reasoning and generation. Use deterministic resolvers for everything else.

**Spec does:**
- `parseGoal()` → LLM decides goal type
- `verifyGoalAchievement()` → LLM judges success
- Makes LLM the decision maker instead of Thompson Sampling

**Correct approach:**
- Goal type = determined by which activities MATCH, not LLM interpretation
- Success = output impulses match activity's `outputSchema`
- LLM only used for: reasoning about ambiguous input, generating text

**Resolution:** REWRITE spec to remove LLM from decision paths

---

#### 2. metabob-mcp-vessel-spec: Backend as Universal Resolver

**Foundation says:**
> "The backend is NOT a universal resolver. It is: A Trace Store + Pattern Learner"
> "Resolvers Live Where Data Lives"

**Spec does:**
- CPG indexing in backend (should be vessel-local)
- Embedding generation in backend (should be vessel-local)
- Treats analysis-api as "the brain" rather than "the memory"

**Correct approach:**
- CPG lives in vessel memory (session-scoped, ephemeral)
- Embeddings generated where code is (vessel)
- Backend only stores: execution traces, learned patterns
- Backend computes: Thompson Sampling scores, impulse relevance

**Resolution:** MERGE corrections into spec

---

### 🟡 MEDIUM SEVERITY

#### 3. metabob-analysis-api-spec: CPG Persistence Ambiguity

**Issue:** Spec says "in-memory session-scoped" but also discusses "persisting"

**Clarification needed:**
- CPG is **transient state** - exists only during session
- CPG analysis **outputs** become execution traces - these are persisted
- CPG itself is NEVER persisted

**Resolution:** Add explicit clarification section

---

#### 4. minibob-tui: Missing Resolver Definitions

**Foundation says:**
> "The shape describes what it is. The resolver knows how to access it."

**Spec defines shapes but no resolvers:**
- `log_stream` → resolver = ?
- `user_input` → resolver = ?
- `code_generation` → resolver = ?

**Resolution:** Add shape-to-resolver mapping table

---

#### 5. self-development-loop: Missing Impulse Creation

**Foundation says:**
> "Output impulses from Activity A → Input impulses for Activity B"

**Spec gap:**
- Traces stored but not converted to impulse pointers
- No explicit "create impulse from trace" step

**Resolution:** Add impulse creation step after trace storage

---

### 🟢 LOW SEVERITY

#### 6. vessel-development-architecture: Missing Thompson Seeding

**Issue:** When template promoted with local history, backend should use that history to seed Thompson Sampling parameters.

**Current:** Template registered, backend starts fresh (α=1, β=0)
**Should be:** Template registered with local stats → α=successes+1, β=failures+1

**Resolution:** Add note about including execution history in promotion

---

## Foundation Alignment Checklist

| Principle | MCP | API | Self-Dev | TUI | Vessel | LLM |
|-----------|-----|-----|----------|-----|--------|-----|
| Impulses are universal data | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Activities constrain search | ✓ | ✓ | ✓ | ✗ | ✓ | ⚠️ |
| Resolvers live where data lives | ⚠️ | ✓ | ✓ | ⚠️ | ✓ | ✗ |
| Metadata first, content later | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Record everything | ⚠️ | ✓ | ✓ | ⚠️ | ✓ | ⚠️ |
| Learn from traces | ✓ | ✓ | ✓ | ✗ | ✓ | ⚠️ |
| Reserve improvisation | ⚠️ | ✓ | ✓ | N/A | ✓ | ✗ |
| LLMs are tools, not controllers | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |

Legend: ✓ = Aligned | ⚠️ = Partial drift | ✗ = Clear violation

---

## Phase 2: Resolution Plan

### 1. REWRITE: llm-goal-enrichment

Replace with foundation-aligned approach:
- Remove LLM from `parseGoal()` type detection
- Remove LLM from `verifyGoalAchievement()`
- Keep LLM for optional metadata enrichment only
- Goal type = activity matching, not LLM classification
- Success = output impulses match schema, not LLM judgment

### 2. MERGE: metabob-mcp-vessel-spec

Add clarification sections:
- CPG is vessel-local (session memory, not backend storage)
- Embeddings generated in vessel (where code lives)
- Backend role = trace store + pattern learner
- Milestones 2-3 should move CPG/embedding work to vessel side

### 3. EDIT: metabob-analysis-api-spec

Add section clarifying:
- CPG is transient (never persisted)
- CPG outputs become traces (persisted)
- Clear boundary: what's in memory vs what's stored

### 4. EDIT: minibob-tui

Add resolver mapping table:
```
Shape           | Resolver      | Location
--------------- | ------------- | --------
log_stream      | websocket     | minibob server
user_input      | tui_input     | local terminal
code_generation | minibob       | vessel execution
error           | system        | stderr capture
```

### 5. EDIT: self-development-loop

Add step after trace storage:
```typescript
// After storing trace, create impulse pointer
const impulse = {
  type: 'executionTrace',
  pointer: { traceId: storedTrace.id },
  metadata: {
    activityId: trace.activity_id,
    success: trace.outcome.success,
    timestamp: trace.timestamp
  }
}
await storeImpulse(impulse, org_id)
```

### 6. EDIT: vessel-development-architecture

Add to promotion section:
> When promoting template, include execution history to seed backend Thompson Sampling:
> - `alpha = localSuccesses + 1`
> - `beta = localFailures + 1`
