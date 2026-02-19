# Template Lifecycle Infrastructure Audit Report

**Date:** 2026-02-18  
**Auditor:** Activity Mode (OpenCode)  
**Scope:** Template management, variant evolution, and learning systems  
**Status:** 🔴 CRITICAL ISSUES IDENTIFIED

---

## Executive Summary

### Overall Assessment: 3.5/10 (Critical Issues Blocking Production)

The template lifecycle infrastructure has **major architectural gaps** that prevent safe template evolution:

1. **Backend API Missing**: CLI calls `/v2/activities/templates` but backend has no such routes
2. **Security Violation Active**: OpenCode has `register_activity_template` (direct writes to shared infrastructure)
3. **No Variant System**: Despite `derive_template()` in CLI, no backend support for variants
4. **Evolution Activity Broken**: `evolve-activity-self-contained` has 0% success rate
5. **Learning System Incomplete**: Metrics collected but no analysis or optimization

### Risk Level: **CRITICAL**

- Templates cannot be safely evolved (no variant system)
- LLM has write access to shared infrastructure (security risk)
- Backend API doesn't match CLI expectations (integration broken)
- Template evolution activity doesn't work (0% success)

---

## Architecture Analysis

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│ metabob-opencode (LLM Execution)                        │
│                                                          │
│ ✅ Has: register_activity_template (SECURITY RISK!)     │
│ ✅ Has: search_activities, get_activity_template        │
│ ✅ Has: activity (execute templates)                    │
│ ❌ Missing: propose_template_variant                    │
│ ❌ Missing: report_template_bug                         │
└─────────────────────────────────────────────────────────┘
                         ↓ Calls
┌─────────────────────────────────────────────────────────┐
│ metabob-cli (MCP Orchestrator)                          │
│                                                          │
│ ✅ Has: ActivityManager.search_activities()             │
│ ✅ Has: ActivityManager.create_template()               │
│ ✅ Has: ActivityManager.derive_template()               │
│ ✅ Has: ActivityManager.get_template_lineage()          │
│ ❓ Integration: Calls backend API (BUT API MISSING!)    │
└─────────────────────────────────────────────────────────┘
                         ↓ HTTP Calls
┌─────────────────────────────────────────────────────────┐
│ metabob-rpc-api (Backend - Port 8080)                   │
│                                                          │
│ ❌ MISSING: /v2/activities/templates (GET)              │
│ ❌ MISSING: /v2/activities/templates (POST)             │
│ ❌ MISSING: /v2/activities/templates/:id/variants       │
│ ❌ MISSING: /v2/activities/executions (POST)            │
│ ❌ MISSING: Thompson Sampling logic                     │
│ ❌ MISSING: Variant lineage tracking                    │
│                                                          │
│ ✅ Has: health, session, analysis, generation routes    │
│ ✅ Has: SurrealDB integration                           │
└─────────────────────────────────────────────────────────┘
```

### Critical Gap: Backend API Missing

**CLI Code Expects:**
```python
# repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py:202
response = await client.get(
    "/v2/activities/templates",
    params=params,
)
```

**Backend Reality:**
```python
# repos/metabob-rpc-api/server/routes/__init__.py
__all__ = [
    "analysis_router",
    "generation_router",
    "github_auth_router",
    "health_router",
    "session_router",
    "feedback_router",
    "metrics_router",
    "repository_router",
    "websocket_router",
]
# NO activity_router or template_router!
```

**Impact:** 🔴 **CRITICAL**
- CLI cannot fetch templates from backend
- CLI cannot create templates in backend
- CLI cannot create variants
- Thompson Sampling cannot work (no backend storage)
- Template evolution is impossible

---

## Security Audit

### 🔴 Critical: Direct Write Access Violation

**Finding:** OpenCode has `register_activity_template` tool with direct write access to template storage.

**Location:** `repos/metabob-opencode/packages/opencode/src/tool/register-activity-template.ts`

**Violation:**
```typescript
// Line 111: Direct write to storage
await TemplateRepository.save(template, backends)
```

**Risk Assessment:**
- **Severity:** HIGH
- **Impact:** LLM can overwrite/corrupt shared templates
- **Exploit Scenario:** Malicious prompt → hallucinated template → production corruption
- **Users Affected:** ALL (templates are shared infrastructure)

**Required Action:** 
1. Remove `register_activity_template` from OpenCode tool registry
2. Replace with read-only + proposal tools:
   - `search_activities` (read-only) ✅ Already exists
   - `get_activity_template` (read-only) ✅ Already exists
   - `propose_template_variant` (proposal only) ❌ MISSING
   - `report_template_bug` (report only) ❌ MISSING

### Trust Boundary Enforcement

**Correct Model:**
```
Untrusted (LLM) → Proposal → Trusted (CLI) → Backend (Storage)
```

**Current Model:**
```
Untrusted (LLM) → Direct Write → Storage (VIOLATION!)
```

---

## Variant System Analysis

### Design: Correct Architecture Defined

**Documentation:** `TEMPLATE_MANAGEMENT_ARCHITECTURE.md` (created in last session)

**Key Principles:**
1. Never update templates directly (immutable)
2. Create variants for fixes/improvements
3. Thompson Sampling selects best variant
4. Bad variants naturally deprecated
5. No human approval needed (metrics decide)

### Implementation: Incomplete

| Component | Status | Notes |
|-----------|--------|-------|
| **Documentation** | ✅ Complete | `TEMPLATE_MANAGEMENT_ARCHITECTURE.md` |
| **CLI Support** | 🟡 Partial | `derive_template()` exists but untested |
| **Backend API** | ❌ Missing | No `/v2/activities/templates/:id/variants` |
| **Thompson Sampling** | ❌ Missing | No backend implementation |
| **OpenCode Tools** | ❌ Missing | No `propose_template_variant` tool |
| **Variant Storage** | ❌ Missing | No database schema |
| **Lineage Tracking** | ❌ Missing | No genealogy system |

### CLI Code Analysis

**Method:** `derive_template()` in `activity_manager.py`

```python
async def derive_template(
    self,
    parent_id: str,
    changes: dict,
    evolution_note: str,
    evolution_type: str = "derived",
) -> dict:
    """
    Create a derived variant from an existing template.
    Genealogy is automatically tracked via parent_hash and lineage.
    """
```

**Status:** ✅ Method exists, ❌ Backend endpoint missing

**Expected Backend Call:**
```python
response = await client.post(
    f"/v2/activities/templates/{parent_id}/variants",
    json=variant_data
)
```

**Reality:** Backend has no such endpoint → `derive_template()` will fail

---

## Template Evolution Activity

### Status: 0% Success Rate

**Activity:** `evolve-activity-self-contained`
- **Category:** infrastructure
- **Executions:** 1
- **Success Rate:** 0% (FAILED)
- **Avg Cost:** $0.7927
- **Avg Duration:** 1167.6s (~19 minutes)

### Root Cause Analysis

**Task 1: Fetch template and metrics**
```json
{
  "id": "fetch-template-and-metrics",
  "description": "Fetch template definition and execution metrics from backend API"
}
```

**Expected API Calls:**
```bash
curl http://localhost:8080/v2/activities/templates/{{templateId}}
curl http://localhost:8080/v2/activities/executions?template_id={{templateId}}
curl http://localhost:8080/v2/activities/templates/{{templateId}}/stats
```

**Problem:** ❌ None of these endpoints exist in backend!

**Impact:**
- Task 1 fails immediately (API 404)
- Subsequent tasks cannot run
- Activity fails with 0% success
- Template evolution is impossible

### Fix Requirements

1. Implement backend endpoints:
   - `GET /v2/activities/templates/:id`
   - `GET /v2/activities/executions`
   - `GET /v2/activities/templates/:id/stats`
   - `GET /v2/activities/templates/:id/learnings`

2. Update activity to handle missing data gracefully

3. Add fallback to local template storage if backend unavailable

---

## Learning System Infrastructure

### Metrics Collection: Working

**Evidence:** `StepResult` in `activity_manager.py` tracks:
```python
@dataclass
class StepResult:
    step_id: str
    success: bool
    cost: float
    tokens: int
    duration_ms: int
    tool_calls: list
    impulses_loaded: list[str]  # Phase 1: Input tracking
    impulses_created: list[str]  # Phase 1: Output tracking
    context_summary: dict  # Context selection metadata
```

**Status:** ✅ Data collection working

### Metrics Analysis: Missing

**Expected Components:**

1. **Impulse Usage Analysis**
   - Which impulses are loaded but never used?
   - Which impulses correlate with success/failure?
   - Token efficiency: cost per impulse resolution

2. **Context Optimization**
   - Gradient analysis: which context causes success?
   - Budget optimization: minimum context for reliability
   - Compression strategy selection

3. **Thompson Sampling Integration**
   - Variant selection based on execution results
   - Alpha/beta updates from success/failure
   - Confidence intervals for variant quality

4. **Template Evolution Triggers**
   - Automatic variant proposal when pattern detected
   - Session-to-activity conversion
   - Merge similar successful patterns

**Status:** ❌ None of these systems implemented

### Backend Storage: Missing

**Required Tables:**

```sql
-- Activity templates (base definitions)
CREATE TABLE activity_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    created_at TIMESTAMP,
    deprecated_at TIMESTAMP
);

-- Template variants (versions with lineage)
CREATE TABLE template_variants (
    variant_id TEXT PRIMARY KEY,
    template_id TEXT REFERENCES activity_templates(id),
    parent_variant_id TEXT REFERENCES template_variants(variant_id),
    content_hash TEXT UNIQUE NOT NULL,
    task_steps JSONB NOT NULL,
    context_requirements JSONB,
    created_at TIMESTAMP,
    alpha REAL DEFAULT 1.0,  -- Thompson Sampling success count
    beta REAL DEFAULT 1.0,   -- Thompson Sampling failure count
    execution_count INTEGER DEFAULT 0,
    evolution_note TEXT
);

-- Execution results (for learning)
CREATE TABLE activity_executions (
    execution_id TEXT PRIMARY KEY,
    variant_id TEXT REFERENCES template_variants(variant_id),
    session_id TEXT,
    success BOOLEAN NOT NULL,
    cost REAL,
    duration_ms INTEGER,
    tokens JSONB,
    error TEXT,
    step_results JSONB,
    created_at TIMESTAMP
);

-- Impulse usage tracking (Phase 1)
CREATE TABLE impulse_usage (
    id TEXT PRIMARY KEY,
    execution_id TEXT REFERENCES activity_executions(execution_id),
    step_id TEXT,
    impulse_id TEXT,
    impulse_type TEXT,
    loaded BOOLEAN,
    used BOOLEAN,
    tokens INTEGER,
    resolution_time_ms INTEGER
);
```

**Status:** ❌ None of these tables exist

---

## Validation Templates Analysis

### Created in Last Session

1. **validate-backend-activity-storage.json**
   - Purpose: Test template storage and Thompson Sampling
   - Status: ⚠️ Uses `activityOutput` impulses (correct)
   - Issue: Backend API doesn't exist to test!

2. **validate-cli-orchestration.json**
   - Purpose: Test CLI state management and incremental delivery
   - Status: ✅ Can work (tests CLI only)
   - Issue: Cannot test backend integration

3. **validate-impulse-system.json**
   - Purpose: Test impulse resolution and lazy loading
   - Status: ✅ Can work (tests OpenCode only)

### Critical Fix Applied

**Problem Found:** Templates originally used variables for cross-task communication (wrong pattern)

**Fix Applied:** Changed to `activityOutput` impulses:

```json
{
  "impulses": [
    {
      "id": "prepareOutput",
      "type": "activityOutput",
      "pointer": {
        "type": "activityOutput",
        "activityId": "{{activityId}}",
        "taskId": "prepare-test-template"
      }
    }
  ]
}
```

**Status:** ✅ Fixed correctly, but cannot execute due to missing backend API

---

## Gap Analysis

### 🔴 Critical Gaps (Blockers)

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| Backend `/v2/activities/templates` API missing | Cannot fetch/create templates | HIGH | P0 |
| Backend variant endpoints missing | Cannot create variants | HIGH | P0 |
| `propose_template_variant` tool missing | Cannot safely propose fixes | MEDIUM | P0 |
| Thompson Sampling missing | Cannot select best variant | HIGH | P1 |
| Database schema missing | Cannot store templates/metrics | HIGH | P1 |

### 🟡 High Priority Gaps

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| `evolve-activity-self-contained` broken | Cannot improve templates | MEDIUM | P1 |
| Impulse usage analysis missing | Cannot optimize context | MEDIUM | P2 |
| Session-to-activity converter missing | Cannot learn from sessions | HIGH | P2 |
| Gradient analysis missing | Cannot identify key context | HIGH | P2 |

### 🟢 Medium Priority Gaps

| Gap | Impact | Effort | Priority |
|-----|--------|--------|----------|
| Variant visualization missing | Cannot inspect evolution | LOW | P3 |
| Learning dashboard missing | Cannot monitor learning | MEDIUM | P3 |
| Template deprecation missing | Old variants linger | LOW | P3 |

---

## Immediate Action Plan

### Phase 1: Backend API Implementation (Week 1)

**Priority:** P0 - CRITICAL BLOCKER

**Tasks:**

1. **Create Activity Router** (`repos/metabob-rpc-api/server/routes/activity.py`)
   ```python
   from fastapi import APIRouter
   
   router = APIRouter(prefix="/v2/activities", tags=["activities"])
   
   @router.get("/templates")
   async def list_templates(category: str = None, limit: int = 50):
       """List all activity templates with Thompson Sampling scores"""
       pass
   
   @router.get("/templates/{template_id}")
   async def get_template(template_id: str):
       """Get specific template variant"""
       pass
   
   @router.post("/templates")
   async def create_template(template_data: dict):
       """Create new template (first variant)"""
       pass
   
   @router.post("/templates/{template_id}/variants")
   async def create_variant(template_id: str, variant_data: dict):
       """Create new variant of existing template"""
       pass
   
   @router.post("/executions")
   async def record_execution(execution_data: dict):
       """Record execution result for Thompson Sampling"""
       pass
   
   @router.get("/templates/{template_id}/stats")
   async def get_template_stats(template_id: str):
       """Get execution statistics for template"""
       pass
   ```

2. **Create Database Schema** (SurrealDB)
   ```sql
   -- Use SurrealDB syntax
   DEFINE TABLE activity_template SCHEMAFULL;
   DEFINE TABLE template_variant SCHEMAFULL;
   DEFINE TABLE activity_execution SCHEMAFULL;
   -- Add indexes and constraints
   ```

3. **Implement Thompson Sampling**
   ```python
   class ThompsonSampling:
       def select_variant(self, variants: list) -> str:
           """Select variant using Beta(alpha, beta) sampling"""
           pass
       
       def update_variant(self, variant_id: str, success: bool):
           """Update alpha/beta after execution"""
           pass
   ```

4. **Register Router in App**
   ```python
   # server/app.py
   from routes import activity_router
   app.include_router(activity_router)
   ```

**Acceptance Criteria:**
- CLI can call `GET /v2/activities/templates` successfully
- CLI can call `POST /v2/activities/templates` to create templates
- CLI can call `POST /v2/activities/templates/:id/variants` for variants
- Thompson Sampling selects variants based on alpha/beta
- All validation templates can execute successfully

### Phase 2: Security Fix (Week 1)

**Priority:** P0 - SECURITY RISK

**Tasks:**

1. **Remove Direct Write Tool from OpenCode**
   ```typescript
   // repos/metabob-opencode/src/tool/register-activity-template.ts
   // Option 1: Delete file entirely
   // Option 2: Mark as deprecated with warning
   ```

2. **Add Proposal Tools to OpenCode**
   ```typescript
   // repos/metabob-opencode/src/tool/propose-template-variant.ts
   export const ProposeTemplateVariantTool = Tool.define(
     "propose_template_variant",
     async () => {
       return {
         description: "Propose a template variant (safe, no direct write)",
         parameters: z.object({
           templateId: z.string(),
           reason: z.string(),
           changes: z.record(z.any()),
           testPlan: z.string().optional()
         }),
         async execute(params, ctx) {
           // Send proposal to CLI via MCP
           // CLI decides whether to create variant
         }
       }
     }
   )
   ```

3. **Add Approval Flow to CLI**
   ```python
   # repos/metabob-cli/src/metabob_cli/mcp/tools.py
   async def handle_template_variant_proposal(params):
       """
       Review variant proposal and create if valid:
       1. Validate schema
       2. Check diff reasonableness
       3. Create variant in backend
       4. Return variant_id
       """
       pass
   ```

**Acceptance Criteria:**
- OpenCode cannot write templates directly
- OpenCode can propose variants (read-only + proposal)
- CLI validates and approves proposals
- Security boundary enforced

### Phase 3: Fix Evolution Activity (Week 2)

**Priority:** P1 - FUNCTIONALITY BLOCKED

**Tasks:**

1. **Update Activity Template**
   ```json
   {
     "tasks": [
       {
         "id": "fetch-template-and-metrics",
         "prompt": {
           "template": "Fetch template from backend using: curl http://localhost:8080/v2/activities/templates/{{templateId}}\n\nIf API fails, fall back to local storage."
         }
       }
     ]
   }
   ```

2. **Add Graceful Degradation**
   - Try backend API first
   - Fall back to local template storage
   - Generate metrics from local execution history
   - Continue even with partial data

3. **Test Evolution Workflow**
   ```bash
   # Create test template with known issues
   # Run evolve-activity-self-contained
   # Verify variant created successfully
   # Verify Thompson Sampling selects new variant
   ```

**Acceptance Criteria:**
- `evolve-activity-self-contained` success rate > 80%
- Activity can work with backend or local storage
- Variants created successfully
- Evolution produces better templates (measured)

### Phase 4: Learning Systems (Week 3)

**Priority:** P2 - OPTIMIZATION

**Tasks:**

1. **Impulse Usage Analysis**
   - Track which impulses loaded but never referenced
   - Correlate impulse types with success/failure
   - Generate recommendations for impulse removal

2. **Context Optimization**
   - Gradient analysis: which context bytes matter?
   - Budget optimization: minimum viable context
   - Compression strategy auto-selection

3. **Session-to-Activity Converter**
   - Detect successful ad-hoc sessions
   - Extract reusable patterns
   - Generate template proposals automatically

**Acceptance Criteria:**
- Impulse usage tracked per execution
- Context optimization recommendations generated
- At least 1 session auto-converted to template

---

## Metrics & Success Criteria

### Template Management

- **Availability:** 99%+ (backend API must be reliable)
- **Response Time:** < 200ms (template lookup)
- **Storage:** Unlimited templates, 10+ variants per template
- **Lineage Depth:** Support 10+ generations of variants

### Variant Evolution

- **Proposal Rate:** 5+ variant proposals per day (automated)
- **Approval Rate:** 80%+ (automated validation)
- **Thompson Sampling:** 95% confidence after 10 executions
- **Deprecation Time:** 30 days without selection → archive

### Learning Systems

- **Impulse Efficiency:** 80%+ impulses used (not wasted)
- **Context Optimization:** 20% token reduction while maintaining quality
- **Auto-Template Rate:** 1+ template/week from successful sessions
- **Evolution Success:** 80%+ success rate for evolve-activity

### Security

- **Direct Writes:** 0 from OpenCode (zero tolerance)
- **Proposal Review Time:** < 5 minutes (automated)
- **Variant Validation:** 100% schema validated
- **Audit Trail:** 100% variant lineage tracked

---

## Dependencies

### External Dependencies

- **SurrealDB:** Template and variant storage
- **Redis:** Thompson Sampling state caching
- **FastAPI:** Backend REST API framework
- **httpx:** CLI HTTP client (already installed)

### Internal Dependencies

- `metabob-proto`: Protobuf schemas for API contracts
- `metabob-opencode`: Tool execution environment
- `metabob-cli`: MCP orchestrator and activity manager

### Configuration

```env
# Backend (.env.docker)
BACKEND_PORT=8080
SURREAL_HOST=surreal
SURREAL_PORT=8000
TEMPLATE_CACHE_TTL=3600

# CLI (.env)
BACKEND_URL=http://localhost:8080
THOMPSON_SAMPLING_ENABLED=true
AUTO_VARIANT_APPROVAL=false  # Require manual approval initially
```

---

## Risk Assessment

### High Risk Areas

1. **Backward Compatibility**
   - Risk: Existing templates may break with new schema
   - Mitigation: Migration script to convert old templates
   - Rollback: Keep old storage alongside new backend

2. **Thompson Sampling Bugs**
   - Risk: Incorrect alpha/beta updates could favor bad variants
   - Mitigation: Extensive unit tests with known distributions
   - Monitoring: Alert if variant success rate diverges from expected

3. **Proposal Spam**
   - Risk: LLM proposes too many unnecessary variants
   - Mitigation: Rate limiting (max 10 proposals/session)
   - Review: Manual approval for first 100 variants

### Medium Risk Areas

1. **Backend Performance**
   - Risk: Template lookup becomes bottleneck
   - Mitigation: Redis caching, database indexing
   - Target: < 200ms p99 latency

2. **Storage Growth**
   - Risk: Unlimited variants consume disk space
   - Mitigation: Archive variants after 90 days without use
   - Monitoring: Alert if storage > 10GB

### Low Risk Areas

1. **Learning System Accuracy**
   - Risk: Impulse analysis recommends wrong optimizations
   - Mitigation: Human review of recommendations
   - Impact: Low (optimization is optional, not critical)

---

## Testing Strategy

### Unit Tests

- Thompson Sampling logic (100% coverage)
- Variant selection algorithm
- Schema validation
- API endpoint handlers

### Integration Tests

- CLI ↔ Backend API communication
- Template creation workflow
- Variant derivation workflow
- Execution result recording

### End-to-End Tests

1. **Happy Path**
   - Create template → Execute → Propose variant → Execute variant → Verify Thompson Sampling selection

2. **Failure Handling**
   - Backend unavailable → Fall back to local storage
   - Invalid variant proposal → Rejected with clear error
   - Template execution fails → Beta updated correctly

3. **Security Tests**
   - OpenCode cannot write templates directly
   - Malicious variant proposal rejected
   - SQL injection attempts blocked

### Performance Tests

- 1000 templates, 10 variants each → < 500ms search
- 100 concurrent execution results → No race conditions
- Thompson Sampling with 1000 variants → < 100ms selection

---

## Rollout Plan

### Week 1: Foundation

- ✅ Backend API implementation
- ✅ Database schema creation
- ✅ Thompson Sampling implementation
- ✅ CLI integration testing

**Validation:** CLI can fetch/create templates successfully

### Week 2: Security & Evolution

- ✅ Remove `register_activity_template` from OpenCode
- ✅ Add `propose_template_variant` tool
- ✅ Fix `evolve-activity-self-contained` activity
- ✅ Manual approval flow for variants

**Validation:** No direct writes, evolution activity works

### Week 3: Learning Systems

- ✅ Impulse usage tracking
- ✅ Context optimization analysis
- ✅ Session-to-activity converter
- ✅ Automated variant proposals

**Validation:** At least 1 auto-generated template from session

### Week 4: Production Readiness

- ✅ Monitoring dashboards
- ✅ Alerting for variant failures
- ✅ Documentation updates
- ✅ Team training

**Validation:** System runs in production for 7 days with no incidents

---

## Conclusion

### Critical Findings

1. **Backend API missing** - CLI expects `/v2/activities/templates` but it doesn't exist
2. **Security violation active** - OpenCode has direct write access to templates
3. **No variant system** - Despite architecture design, no implementation
4. **Evolution broken** - `evolve-activity-self-contained` has 0% success
5. **Learning incomplete** - Metrics collected but not analyzed

### Recommended Next Steps

1. **IMMEDIATE (Week 1):** Implement backend API (blocks everything else)
2. **IMMEDIATE (Week 1):** Remove direct write tool (security risk)
3. **HIGH (Week 2):** Fix evolution activity (functionality blocked)
4. **MEDIUM (Week 3):** Build learning systems (optimization)

### Expected Outcomes

After completing this work:
- ✅ Templates can be safely evolved via variants
- ✅ Thompson Sampling selects best variants automatically
- ✅ LLM cannot corrupt shared infrastructure
- ✅ Evolution activity works reliably (>80% success)
- ✅ System learns optimal context patterns
- ✅ Templates improve over time without human intervention

### Final Assessment

**Current State:** 3.5/10 - Critical blockers prevent production use

**Target State:** 9/10 - Self-evolving, secure, production-ready system

**Timeline:** 3-4 weeks to production readiness

**Complexity:** Medium-High (backend API + learning systems)

---

## Appendices

### A. Related Documentation

- `TEMPLATE_MANAGEMENT_ARCHITECTURE.md` - Variant evolution design
- `VALIDATION_LESSONS_LEARNED.md` - Trash/cruft problem
- `PROMPT_OPTIMIZATION_ARCHITECTURE.md` - Learning systems design
- `INSTRUCTIONAL_VS_FUNCTIONAL_STATE.md` - Core architecture principle

### B. Code Locations

- OpenCode tools: `repos/metabob-opencode/packages/opencode/src/tool/`
- CLI activity manager: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`
- Backend routes: `repos/metabob-rpc-api/server/routes/`
- Evolution activity: `repos/metabob-opencode/packages/opencode/templates/built-in/evolve-activity-self-contained.json`

### C. Database Schemas

See "Learning System Infrastructure → Backend Storage" section above for full schema definitions.

### D. API Specifications

See "Immediate Action Plan → Phase 1" section above for FastAPI route definitions.

---

**Report Generated:** 2026-02-18  
**Next Review:** After Phase 1 completion (Week 1)  
**Owner:** DevBob Infrastructure Team
