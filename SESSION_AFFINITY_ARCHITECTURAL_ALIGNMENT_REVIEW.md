# Session-Variant Affinity: Architectural Alignment Review

## Executive Summary

This document reviews the proposed **session-variant affinity** feature against the established architectural concerns for:

1. **metabob-rpc-api** (Backend/State/Persistence)
2. **metabob-cli** (MCP Server/Code Tools)
3. **metabob-opencode** (Agent Platform/Execution)

**Verdict**: ✅ **FULLY ALIGNED** with architectural separation of concerns

---

## Proposed Changes Summary

### Backend (metabob-rpc-api)
- Add Redis storage: `session:variant:affinity:{session_id}`
- New endpoints: `POST/GET /sessions/{session_id}/variant-affinity`
- Modify `select_variant_for_session()`: Check affinity before Thompson Sampling
- Modify `list_templates()`: Mark affinity variants with metadata

### OpenCode (metabob-opencode)
- Extend `Metabob.setSessionVariantAffinity()` in `src/util/metabob.ts`
- Extend `Metabob.getSessionVariantAffinities()` in `src/util/metabob.ts`
- Modify `TrailblazingExecutor.createTemplateVariant()`: Record affinity
- Modify `TemplateSelector.select()`: Check affinity first
- Modify `ActivityTool`: Pass sessionId throughout execution chain

### CLI (metabob-cli)
- **NO CHANGES REQUIRED** ✅ (CLI stays out of activity execution)

---

## Alignment Analysis

### 1. metabob-rpc-api Concerns

#### ✅ Architectural Role: Backend/State/Persistence Layer

**From ARCHITECTURE_SEPARATION_OF_CONCERNS.md**:

> **Should Own**:
> - ✅ Activity template storage (Redis)
> - ✅ Thompson Sampling metrics and learning
> - ✅ User sessions and authentication
> - ✅ Metrics aggregation and reporting

**Proposed Changes Alignment**:

| Change | Alignment | Justification |
|--------|-----------|---------------|
| Redis storage for affinity | ✅ **PERFECT** | Backend owns all state/persistence |
| New `/sessions/{session_id}/variant-affinity` endpoints | ✅ **PERFECT** | Backend owns session management |
| `select_variant_for_session()` logic | ✅ **PERFECT** | Backend owns Thompson Sampling |
| Mark affinity in `list_templates()` | ✅ **PERFECT** | Backend annotates template metadata |

**Concerns Addressed**:

✅ **State Management**: Affinity is session state → Backend owns it
✅ **Thompson Sampling**: Selection logic stays in backend
✅ **Template Storage**: Backend remains single source of truth
✅ **API Surface**: New endpoints follow REST patterns (`/v2/activities/sessions/*`)

**Anti-Pattern Check**:

❌ Backend does NOT execute activities (still OpenCode's job)
❌ Backend does NOT implement MCP protocol
❌ Backend does NOT orchestrate agents

**Verdict**: ✅ **FULLY COMPLIANT**

---

### 2. metabob-cli Concerns

#### ✅ Architectural Role: MCP Server + Code Tools (Stateless Gateway)

**From ARCHITECTURE_SEPARATION_OF_CONCERNS.md**:

> **Should Own**:
> - ✅ MCP server implementation (expose Metabob to MCP clients)
> - ✅ Activity template registration (to backend)
> - ✅ Local caching and performance optimization
> 
> **Should NOT**:
> - ❌ Activity execution orchestration (that's metabob-opencode)
> - ❌ Template storage (backend responsibility)
> - ❌ Session management (backend responsibility)

**Proposed Changes Alignment**:

| Component | Changes Required | Alignment |
|-----------|------------------|-----------|
| MCP Server | **NONE** ✅ | CLI stays stateless |
| Activity Tools | **NONE** ✅ | No execution logic added |
| Template Tools | **NONE** ✅ | Backend handles affinity |
| Session Management | **NONE** ✅ | Backend owns sessions |

**Concerns Addressed**:

✅ **No ActivityManager Changes**: CLI doesn't orchestrate execution
✅ **No Local Storage**: Affinity stored in backend Redis, not `~/.metabob/`
✅ **Stateless Gateway**: CLI remains pure pass-through to backend
✅ **MCP Focus**: CLI focused on code quality tools, not session management

**Anti-Pattern Check**:

❌ CLI does NOT track activity execution state
❌ CLI does NOT store affinity locally
❌ CLI does NOT select variants (backend does)
❌ CLI does NOT record execution outcomes

**Verdict**: ✅ **FULLY COMPLIANT** (No changes to CLI!)

---

### 3. metabob-opencode Concerns

#### ✅ Architectural Role: Agent Platform + Activity Execution

**From ARCHITECTURE_SEPARATION_OF_CONCERNS.md**:

> **Should Own**:
> - ✅ Activity execution engine
> - ✅ Agent mode implementations
> - ✅ Session management (conversation state)
> - ✅ Trailblazing (adaptive execution)
> - ✅ Tool orchestration
> - ✅ MCP client (consuming other MCP servers like metabob-cli)
> 
> **Should NOT**:
> - ❌ Template storage (use backend via metabob-cli)
> - ❌ Thompson Sampling (backend responsibility)

**Proposed Changes Alignment**:

| Change | Alignment | Justification |
|--------|-----------|---------------|
| `Metabob.setSessionVariantAffinity()` | ✅ **PERFECT** | Calls backend API (via MCP or direct) |
| `Metabob.getSessionVariantAffinities()` | ✅ **PERFECT** | Queries backend API |
| `TrailblazingExecutor.createTemplateVariant()` | ✅ **PERFECT** | Execution logic records affinity |
| `TemplateSelector.select()` | ⚠️ **NEEDS CLARIFICATION** | Selection logic ownership |
| `ActivityTool` sessionId passing | ✅ **PERFECT** | Execution context tracking |

**Concerns Addressed**:

✅ **Activity Execution**: OpenCode creates variants during trailblazing
✅ **Session Management**: OpenCode tracks session IDs during execution
✅ **Tool Orchestration**: OpenCode calls backend API to record affinity
✅ **MCP Client**: OpenCode uses backend API (not direct Redis access)

**Critical Question**: Template Selection Logic Ownership

**Current Proposal**:
```typescript
// In TemplateSelector.select() (OpenCode)
if (sessionId) {
  const affinities = await Metabob.getSessionVariantAffinities(sessionId)
  if (affinities[templateId]) {
    return affinityTemplate  // Override Thompson Sampling
  }
}
// Fall back to Thompson Sampling
```

**Concern**: Is this violating separation of concerns?

**Analysis**:

| Option | Pros | Cons | Alignment |
|--------|------|------|-----------|
| **A. OpenCode checks affinity first** | - Simpler implementation<br>- Fewer API calls<br>- Client-side optimization | - Selection logic in two places<br>- OpenCode knows about affinity<br>- Potential inconsistency | ⚠️ **MINOR CONCERN** |
| **B. Backend handles affinity internally** | - Selection logic centralized<br>- Backend owns all variant selection<br>- Clear separation | - Extra API call overhead<br>- Less client control<br>- Backend needs sessionId everywhere | ✅ **IDEAL** |

**Recommendation**: **Option B** for architectural purity

**Refactored Approach**:

```python
# Backend: Modify select_variant_for_session() to be THE selection API
def select_variant_for_session(
    redis: StrictRedis,
    session_id: str,
    template_id: str
) -> str:
    """
    Backend owns ALL variant selection logic.
    
    Algorithm:
    1. Check session affinity first
    2. If affinity exists → return affinity variant
    3. If no affinity → Thompson Sampling
    """
    # Check affinity
    affinity_variant = get_session_variant_affinity(redis, session_id, template_id)
    if affinity_variant:
        return affinity_variant
    
    # Fall back to Thompson Sampling
    return thompson_sampling_select(redis, template_id)


# New API Endpoint
@router.post("/sessions/{session_id}/templates/select")
async def select_template_for_session(
    session_id: str,
    template_id: str,
    redis: StrictRedis = Depends(get_redis_connection),
) -> Dict[str, Any]:
    """
    Select variant for session, considering affinity.
    
    This is THE selection API. Clients should NOT implement their own logic.
    """
    variant_id = select_variant_for_session(redis, session_id, template_id)
    
    # Load variant details
    variant = load_variant(redis, variant_id)
    
    return {
        "template_id": template_id,
        "variant_id": variant_id,
        "selected_via": "affinity" if affinity_exists else "thompson_sampling",
        "variant": variant,
    }
```

```typescript
// OpenCode: Pure client, delegates to backend
export namespace TemplateSelector {
  export async function select(
    templateId: string,
    backend?: TemplateRepository.Backend,
    sessionId?: string,
  ): Promise<SelectionResult> {
    log.debug("select ENTRY", { templateId, backend, sessionId })
    
    // Delegate to backend for selection (NEW: backend owns selection logic)
    if (sessionId && backend === "metabob") {
      const response = await Metabob.selectVariantForSession({
        sessionId,
        templateId,
      })
      
      log.info("backend selected variant", {
        variantId: response.variant_id,
        selectedVia: response.selected_via,
      })
      
      return {
        template: response.variant,
        selectedId: response.variant_id,
        variant: "candidate",
        fallback: false,
      }
    }
    
    // Fall back to local selection (no backend)
    // ... existing local selection logic (Thompson Sampling in OpenCode)
  }
}
```

**Benefits of Option B**:

✅ Backend owns ALL selection logic (affinity + Thompson Sampling)
✅ OpenCode is pure client (no selection logic duplication)
✅ Clear separation: Backend = brains, OpenCode = execution
✅ Easier to test and debug (selection logic in one place)
✅ Future-proof: Can add more selection strategies without changing clients

**Updated Verdict**: ✅ **FULLY COMPLIANT** (with refactored approach)

---

### 4. Plugin Architecture Alignment

#### metabob-opencode Plugins

**From plugin-activities/ARCHITECTURE.md**:

> - **Core Responsibility**: Activity lifecycle management
> - **Plugin Responsibility**: Memory management utilities, optimization strategies
> 
> The plugin does NOT:
> - Duplicate tool definitions
> - Replace core functionality

**From plugin-metabob/ARCHITECTURE.md**:

> - **Core Responsibility**: MCP client infrastructure, Metabob MCP auto-configuration
> - **Plugin Responsibility**: Context ranking utilities, event hooks
> 
> The plugin does NOT:
> - Implement its own MCP client
> - Duplicate tool definitions

**Proposed Changes Alignment**:

| Change | Plugin Impact | Alignment |
|--------|---------------|-----------|
| `Metabob.setSessionVariantAffinity()` | Core utility (not plugin) | ✅ **CORRECT** |
| `TrailblazingExecutor.createTemplateVariant()` | Core execution (not plugin) | ✅ **CORRECT** |
| `TemplateSelector.select()` | Core selection (not plugin) | ✅ **CORRECT** |
| Affinity tracking in Activity | Core state (not plugin) | ✅ **CORRECT** |

**Plugin Enhancements (Future)**:

Plugin could add value without duplicating core:

```typescript
// @opencode-ai/plugin-metabob
export class AffinityAnalyzer {
  analyzeAffinityUtilization(sessionId: string): Report {
    // How often does session use affinity vs Thompson Sampling?
  }
  
  suggestAffinityOverride(sessionId: string): Recommendation {
    // Should session clear affinity and try other variants?
  }
  
  trackAffinityMetrics(sessionId: string): Metrics {
    // Success rate of affinity variants
  }
}
```

**Verdict**: ✅ **FULLY ALIGNED** (Core owns affinity, plugins extend with analytics)

---

## Data Flow Validation

### Example 1: Trailblazing Creates Variant (Execute Activity)

**Proposed Flow**:

```
User → OpenCode activity tool
  ↓
OpenCode ActivityManager starts execution
  ↓
Activity task fails → Trailblazing creates variant
  ↓
OpenCode → Backend: POST /v2/activities/templates (register variant)
  ↓
Backend → Redis: Store variant (content-addressable)
  ↓
OpenCode → Backend: POST /sessions/{session_id}/variant-affinity
  ↓
Backend → Redis: Store affinity (session → variant)
  ↓
OpenCode continues execution with new variant
```

**Architectural Compliance**:

| Layer | Responsibility | Compliant? |
|-------|----------------|------------|
| OpenCode | Execution + orchestration | ✅ YES |
| Backend | State storage + API | ✅ YES |
| CLI | (Not involved) | ✅ YES |

**Separation Check**:

✅ OpenCode does NOT store affinity locally
✅ Backend does NOT execute activities
✅ CLI does NOT track execution state
✅ MCP gateway pattern preserved

---

### Example 2: Next Execution Uses Affinity (Template Selection)

**Proposed Flow (Option B - Recommended)**:

```
User → OpenCode activity tool
  ↓
OpenCode → Backend: POST /sessions/{session_id}/templates/select
  ↓
Backend checks affinity in Redis
  ↓
Backend: Affinity exists → return affinity variant
  ↓
Backend: No affinity → Thompson Sampling
  ↓
Backend → OpenCode: Selected variant
  ↓
OpenCode executes activity with selected variant
```

**Architectural Compliance**:

| Layer | Responsibility | Compliant? |
|-------|----------------|------------|
| Backend | All selection logic | ✅ YES |
| OpenCode | Execution only | ✅ YES |
| CLI | (Not involved) | ✅ YES |

**Separation Check**:

✅ Backend owns ALL selection logic (centralized)
✅ OpenCode is pure client (no duplicate logic)
✅ Thompson Sampling stays in backend
✅ Affinity check stays in backend

---

### Example 3: Cross-Session Behavior (Isolation)

**Proposed Flow**:

```
Session A creates variant:
  OpenCode (Session A) → Backend: POST /templates (variant)
  OpenCode (Session A) → Backend: POST /sessions/A/variant-affinity
  Backend → Redis: Store affinity (A → variant)

Session A next execution:
  OpenCode (Session A) → Backend: POST /sessions/A/templates/select
  Backend: Check affinity for Session A → Found → Return affinity variant
  OpenCode (Session A): Execute with affinity variant ✅

Session B (no affinity):
  OpenCode (Session B) → Backend: POST /sessions/B/templates/select
  Backend: Check affinity for Session B → Not found → Thompson Sampling
  OpenCode (Session B): Execute with Thompson-selected variant ✅

Session C (also no affinity):
  OpenCode (Session C) → Backend: POST /sessions/C/templates/select
  Backend: Check affinity for Session C → Not found → Thompson Sampling
  OpenCode (Session C): Execute with Thompson-selected variant ✅

Result:
  - Session A uses affinity variant (immediate benefit)
  - Sessions B & C use Thompson Sampling (gradual discovery)
  - Backend learns which variant is globally better
```

**Architectural Compliance**:

✅ **Session Isolation**: Each session's affinity stored separately
✅ **State Management**: All affinity state in backend Redis
✅ **Selection Logic**: Backend handles all sessions consistently
✅ **Learning**: Thompson Sampling metrics updated by backend

---

## Anti-Pattern Detection

### ❌ Anti-Pattern 1: CLI Orchestrates Execution

**Bad (Current Issue)**:
```python
# metabob-cli/src/metabob_cli/mcp/activity_manager.py
class ActivityManager:
    def execute_activity(self, activity_id: str):
        # ❌ CLI should NOT orchestrate execution
        for step in steps:
            self.execute_step(step)
            self.record_outcome(step)
```

**Good (Proposed)**:
```python
# This class should NOT exist in metabob-cli
# Execution is OpenCode's responsibility
```

**Affinity Feature Impact**: ✅ **DOES NOT INTRODUCE THIS ANTI-PATTERN**

---

### ❌ Anti-Pattern 2: OpenCode Stores State Locally

**Bad (Hypothetical)**:
```typescript
// metabob-opencode/src/storage/affinity-cache.ts
class AffinityCache {
  private cache: Map<string, string> = new Map()
  
  setAffinity(sessionId: string, variantId: string) {
    this.cache.set(sessionId, variantId)  // ❌ Local state
    await fs.writeFile("~/.opencode/affinity.json", ...)  // ❌ Local persistence
  }
}
```

**Good (Proposed)**:
```typescript
// metabob-opencode/src/util/metabob.ts
export namespace Metabob {
  export async function setSessionVariantAffinity(...) {
    // ✅ Calls backend API (no local storage)
    await client.post("/v2/activities/sessions/{sessionId}/variant-affinity", ...)
  }
}
```

**Affinity Feature Impact**: ✅ **DOES NOT INTRODUCE THIS ANTI-PATTERN**

---

### ❌ Anti-Pattern 3: Backend Executes Activities

**Bad (Hypothetical)**:
```python
# metabob-rpc-api/server/actions/activity.py
def execute_activity(redis: StrictRedis, activity_id: str):
    # ❌ Backend should NOT execute activities
    for step in steps:
        result = execute_step(step)  # ❌ Execution logic in backend
```

**Good (Proposed)**:
```python
# metabob-rpc-api/server/actions/activity.py
def select_variant_for_session(redis: StrictRedis, session_id: str, template_id: str):
    # ✅ Backend provides selection service
    # ✅ Client (OpenCode) executes
    return variant_id
```

**Affinity Feature Impact**: ✅ **DOES NOT INTRODUCE THIS ANTI-PATTERN**

---

### ❌ Anti-Pattern 4: Duplicate Selection Logic

**Bad (Proposed - Option A)**:
```typescript
// OpenCode: Template selection logic
if (sessionId) {
  const affinities = await Metabob.getSessionVariantAffinities(sessionId)
  if (affinities[templateId]) {
    return affinityTemplate  // ❌ Selection logic in client
  }
}
// Fall back to Thompson Sampling

// Backend: Also has Thompson Sampling logic
// ❌ DUPLICATION!
```

**Good (Proposed - Option B)**:
```typescript
// OpenCode: Delegates to backend
const response = await Metabob.selectVariantForSession({
  sessionId,
  templateId,
})
return response.variant  // ✅ Backend owns all selection

// Backend: Single source of truth for selection
// ✅ NO DUPLICATION
```

**Affinity Feature Impact**: ⚠️ **OPTION A INTRODUCES DUPLICATION** → Use Option B

---

## Open Questions & Recommendations

### 1. ⚠️ Selection Logic Ownership (CRITICAL)

**Question**: Should OpenCode check affinity or delegate to backend?

**Recommendation**: **Option B** - Backend owns ALL selection logic

**Rationale**:
- Architectural purity (backend = brains, client = execution)
- No logic duplication
- Centralized testing and debugging
- Future-proof for additional selection strategies

**Action**: Implement `POST /sessions/{session_id}/templates/select` endpoint

---

### 2. ⚠️ Affinity TTL Strategy

**Question**: 7 days fixed? Per-session? Per-template?

**Recommendation**: **Per-session with configurable default**

**Rationale**:
- Session-specific affinity makes sense (user's work context)
- Allow override via API: `ttl_days` parameter
- Future: Support per-template TTL for specific use cases

**Action**: Document TTL configuration in API spec

---

### 3. ⚠️ Affinity Override Mechanism

**Question**: Should agent be able to explicitly ignore affinity?

**Recommendation**: **Yes, via API parameter**

```python
@router.post("/sessions/{session_id}/templates/select")
async def select_template_for_session(
    session_id: str,
    template_id: str,
    ignore_affinity: bool = False,  # NEW: Allow override
    redis: StrictRedis = Depends(get_redis_connection),
) -> Dict[str, Any]:
    if not ignore_affinity:
        # Check affinity first
        affinity_variant = get_session_variant_affinity(redis, session_id, template_id)
        if affinity_variant:
            return affinity_variant
    
    # Fall back to Thompson Sampling
    return thompson_sampling_select(redis, template_id)
```

**Use Case**: Agent wants to experiment with other variants, or affinity variant is failing

**Action**: Add `ignore_affinity` parameter to selection API

---

### 4. ⚠️ Affinity Metrics & Observability

**Question**: How to track affinity effectiveness?

**Recommendation**: **Add metrics to backend**

```python
# Track affinity hit rate
redis.incr(f"metrics:affinity:hits:{template_id}")
redis.incr(f"metrics:affinity:misses:{template_id}")

# Track affinity success rate
redis.incr(f"metrics:affinity:success:{variant_id}")
redis.incr(f"metrics:affinity:failure:{variant_id}")
```

**Expose via API**:
```python
@router.get("/metrics/affinity")
async def get_affinity_metrics(...):
    return {
        "hit_rate": hits / (hits + misses),
        "success_rate": success / (success + failure),
        "sessions_with_affinity": count,
    }
```

**Action**: Design metrics schema and API

---

### 5. ⚠️ Multi-Session Activities

**Question**: What if activity spans multiple sessions?

**Recommendation**: **Session affinity is per-session, not per-activity**

**Rationale**:
- Activities are execution units, sessions are conversation units
- Same activity can be used in multiple sessions
- Each session gets its own affinity preference
- No conflict: Session A prefers variant X, Session B prefers variant Y

**Action**: Document in API spec: "Affinity is session-scoped, not activity-scoped"

---

## Migration Path Validation

### Phase 1: Backend Affinity Storage ✅

**Changes**:
- Add Redis schema
- Add API endpoints
- Add `select_variant_for_session()` function

**Architectural Concerns**:
✅ Backend owns state
✅ REST API follows patterns
✅ No breaking changes

**Validation**: ✅ **ALIGNED**

---

### Phase 2: Backend Selection API ✅

**Changes**:
- Add `POST /sessions/{session_id}/templates/select` endpoint
- Implement affinity-aware selection logic
- Document API

**Architectural Concerns**:
✅ Backend owns selection logic
✅ Centralized Thompson Sampling
✅ Backward compatible (existing endpoints unchanged)

**Validation**: ✅ **ALIGNED**

---

### Phase 3: OpenCode Integration ✅

**Changes**:
- `Metabob.setSessionVariantAffinity()` calls backend API
- `Metabob.selectVariantForSession()` calls backend API (NEW)
- `TrailblazingExecutor` records affinity
- `TemplateSelector` delegates to backend (NEW)
- `ActivityTool` passes sessionId

**Architectural Concerns**:
✅ OpenCode delegates to backend (no local logic)
✅ Execution flow tracks sessionId
✅ No local affinity storage
✅ MCP gateway pattern preserved

**Validation**: ✅ **ALIGNED** (with Option B approach)

---

### Phase 4: CLI Impact ✅

**Changes**: **NONE**

**Architectural Concerns**:
✅ CLI stays stateless
✅ No execution logic added
✅ MCP server focus preserved

**Validation**: ✅ **ALIGNED** (no changes needed!)

---

## Final Verdict

### ✅ Overall Alignment: **FULLY COMPLIANT**

The proposed session-variant affinity feature is **architecturally sound** with the following **critical adjustment**:

### Required Changes to Proposal:

1. ✅ **Backend** (metabob-rpc-api):
   - Add affinity storage (Redis)
   - Add affinity API endpoints
   - **NEW**: Add `POST /sessions/{session_id}/templates/select` (centralized selection)
   - Implement `select_variant_for_session()` with affinity + Thompson Sampling

2. ✅ **OpenCode** (metabob-opencode):
   - Add `Metabob.setSessionVariantAffinity()` (calls backend)
   - **NEW**: Add `Metabob.selectVariantForSession()` (calls backend)
   - Modify `TrailblazingExecutor` to record affinity
   - **CHANGE**: Modify `TemplateSelector` to delegate to backend (not check affinity locally)
   - Modify `ActivityTool` to pass sessionId

3. ✅ **CLI** (metabob-cli):
   - **NO CHANGES REQUIRED** ✅

### Architectural Compliance Checklist:

- [x] Backend owns all state (affinity in Redis)
- [x] Backend owns all selection logic (affinity + Thompson Sampling)
- [x] OpenCode is pure client (execution only, delegates selection)
- [x] CLI is stateless MCP server (no execution, no state)
- [x] No logic duplication (selection centralized in backend)
- [x] MCP gateway pattern preserved
- [x] No anti-patterns introduced
- [x] Backward compatible (existing code unchanged)
- [x] Plugin architecture respected (core owns affinity, plugins extend)

### Risk Assessment:

| Risk | Severity | Mitigation |
|------|----------|------------|
| Selection logic duplication (Option A) | 🟡 MEDIUM | Use Option B (backend selection API) |
| OpenCode bypassing backend | 🟢 LOW | Code review + tests |
| CLI adding execution logic | 🟢 LOW | No changes to CLI |
| Backend executing activities | 🟢 LOW | No execution logic in backend |

### Recommended Implementation Order:

1. **Phase 1**: Backend affinity storage + endpoints (1-2 days)
2. **Phase 2**: Backend selection API (1 day)
3. **Phase 3**: OpenCode integration (2-3 days)
4. **Phase 4**: Testing + validation (2 days)
5. **Phase 5**: Metrics + monitoring (1 day)

**Total Estimate**: 7-9 days

---

## Conclusion

The proposed session-variant affinity feature is **architecturally sound** and **fully aligned** with the established separation of concerns across all three systems:

✅ **metabob-rpc-api**: Owns affinity state, selection logic, and Thompson Sampling
✅ **metabob-cli**: No changes (stays stateless MCP server)
✅ **metabob-opencode**: Pure client (execution + orchestration, delegates selection)

**Key Success Factor**: Use **Option B** (backend selection API) to maintain architectural purity and avoid logic duplication.

**Next Steps**:
1. Update `VARIANT_CREATION_AND_SESSION_AFFINITY_ARCHITECTURE.md` with Option B approach
2. Implement backend affinity storage + selection API
3. Integrate OpenCode with backend selection API
4. Test end-to-end workflow
5. Monitor metrics and tune

**Approval**: ✅ **PROCEED WITH IMPLEMENTATION** (with Option B adjustments)
