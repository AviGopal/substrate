# Architecture Assessment: A/B Testing System - Separation of Concerns

⚠️ **IMPORTANT UPDATE**: This document has been superseded by **MCP_GATEWAY_ARCHITECTURE.md** which enforces proper separation of concerns through the MCP gateway pattern.

**Key Principle**: `metabob-opencode` MUST communicate with backends ONLY through `metabob-cli` (MCP gateway).

See: [MCP_GATEWAY_ARCHITECTURE.md](./MCP_GATEWAY_ARCHITECTURE.md) for the complete architecture redesign.

---

## Original System Architecture (PRE-REDESIGN)

### 1. **metabob-opencode** (TypeScript)
**Role**: AI Coding Agent / Client Application
**Location**: Terminal/IDE integration, runs locally on developer machines
**Responsibilities**:
- Activity template storage and execution
- Session management and context
- Agent orchestration (general, config, test, tool, etc.)
- User interaction and CLI
- Template selection and A/B test traffic routing
- Local metrics collection

**Data Access**:
- Local storage: `~/.local/share/opencode/storage/`
- Activity templates
- Activity execution history
- Template execution evidence
- Session state

**Current A/B Implementation (Phases 2.1-2.2)**:
- ✅ Template schema with A/B fields (status, candidateIds, allocationWeight)
- ✅ Template selector (probabilistic routing, fallback, metrics)
- ✅ Selection history tracking (in-memory, max 1000 entries)

---

### 2. **metabob-cli** (Python)
**Role**: Code Analysis Engine / MCP Server
**Location**: Runs as MCP server or standalone CLI tool
**Responsibilities**:
- Static code analysis (bugs, security, quality)
- CPG (Code Property Graph) construction and querying
- Issue detection and prioritization
- Component annotation
- Change impact analysis
- Deletion safety assessment
- MCP tool interface for OpenCode integration

**Data Access**:
- Codebase files (analysis input)
- Analysis results cache
- CPG database
- Issue priority cache
- Component annotations

**NOT Responsible For**:
- Activity template management (that's OpenCode)
- Activity execution tracking (that's OpenCode)
- A/B testing decisions (that's OpenCode + RPC API)

---

### 3. **metabob-rpc-api** (Python)
**Role**: Centralized Backend / Template Registry / Metrics Aggregation
**Location**: Cloud service (production) or local server (dev)
**Responsibilities**:
- Template registry (centralized storage)
- Template versioning and genealogy
- Cross-session metrics aggregation
- A/B testing promotion decisions (Phase 3)
- Statistical analysis (chi-square, confidence intervals)
- Template quality scoring
- Learning and recommendations
- Multi-user template sharing

**Data Access**:
- Template registry (SurrealDB or similar)
- Activity execution records (aggregated from multiple clients)
- Template performance metrics
- A/B test results
- User/organization data

**Should Be Responsible For (Phase 3)**:
- Statistical evaluation of A/B tests
- Promotion/pruning decisions
- Global template quality trends
- Recommendation engine

---

## Separation of Concerns Matrix

| Concern | metabob-opencode | metabob-cli | metabob-rpc-api |
|---------|------------------|-------------|-----------------|
| **Template Storage** | Local cache | ❌ | Primary registry |
| **Template Selection** | ✅ A/B routing | ❌ | ❌ (trusts client) |
| **Activity Execution** | ✅ Orchestration | ❌ | ❌ (receives logs) |
| **Code Analysis** | ❌ (calls MCP) | ✅ Primary | ❌ |
| **Metrics Collection** | ✅ Local evidence | ❌ | ✅ Aggregation |
| **A/B Test Decisions** | ✅ Traffic split | ❌ | ✅ Promotion/prune |
| **Statistical Analysis** | ❌ (basic stats) | ❌ | ✅ Chi-square, CI |
| **Template Promotion** | ❌ (reports to API) | ❌ | ✅ Global decisions |
| **Issue Detection** | ❌ (calls MCP) | ✅ Analysis | ❌ |
| **Component Annotation** | ❌ (calls MCP) | ✅ Storage | ❌ |

---

## Data Flow for A/B Testing

```
┌─────────────────────────────────────────────────────────────────┐
│ Developer's Machine (metabob-opencode)                          │
│                                                                  │
│  1. User requests: "add feature X"                             │
│  2. TemplateSelector.select("add-feature-complete")            │
│     - Load stable template (weight: 0.9)                       │
│     - Check candidateIds: ["add-feature-v2"]                   │
│     - Weighted random: select candidate (10% chance)           │
│  3. Execute selected template                                   │
│  4. Record executionEvidence to local storage                  │
│  5. Report metrics to metabob-rpc-api (async)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ POST /api/activity-execution
                             │ { templateId, candidateId, success, cost, duration }
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ Cloud Backend (metabob-rpc-api)                                 │
│                                                                  │
│  1. Receive execution result                                    │
│  2. Aggregate metrics by template variant                       │
│  3. Calculate success rates, costs, durations                   │
│  4. Statistical comparison (stable vs candidates)               │
│  5. Evaluate promotion criteria:                                │
│     - Sample size >= 30 (each variant)                         │
│     - Candidate success rate > stable                           │
│     - Chi-square p-value < 0.05 (significant)                  │
│     - Cost delta acceptable                                     │
│  6. Decision:                                                    │
│     - PROMOTE: Update stable template, archive old             │
│     - KEEP_TESTING: Need more data                             │
│     - PRUNE: Candidate is worse, remove it                     │
│  7. Update template registry                                    │
│  8. Notify clients of template changes                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Gap Analysis

### What We Have (Phases 2.1-2.2) ✅
1. **metabob-opencode**:
   - Template schema with A/B fields
   - Template selector (weighted routing)
   - Selection metrics (in-memory)
   - Execution evidence collection (70%+ working)

### What We Need (Phase 2.3-3.0) 📋

#### Phase 2.3: Metrics Aggregation (metabob-opencode + Python script)
**Location**: Extend `analyze_template_performance.py` in root
**Why**: Quick prototype for aggregation logic before adding to RPC API
**Components**:
1. Read executionEvidence from local storage
2. Aggregate by template variant (stable vs candidates)
3. Calculate:
   - Success rate per variant
   - Average cost/duration per variant
   - Recent trend (last 10 executions)
4. Compare stable vs candidates
5. Generate recommendation (promote/keep/prune)

#### Phase 3.1: RPC API - Metrics Endpoint (metabob-rpc-api)
**Location**: `repos/metabob-rpc-api/src/endpoints/template_metrics.py`
**Why**: Centralized, multi-user metrics aggregation
**Endpoints**:
- `POST /api/activity-execution` - Report execution results
- `GET /api/template/:id/metrics` - Get aggregated metrics
- `GET /api/template/:id/variants` - Compare stable vs candidates
- `GET /api/template/:id/recommendation` - Get promotion recommendation

#### Phase 3.2: RPC API - Promotion Engine (metabob-rpc-api)
**Location**: `repos/metabob-rpc-api/src/services/promotion_engine.py`
**Why**: Statistical rigor, global decisions
**Components**:
1. Statistical tests (chi-square, t-test, confidence intervals)
2. Minimum sample size checks
3. Promotion decision logic
4. Template registry updates
5. Client notification (webhook or polling)

#### Phase 3.3: OpenCode - API Integration (metabob-opencode)
**Location**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`
**Why**: Report metrics to RPC API, receive promotion decisions
**Components**:
1. Report execution results to API
2. Poll for template updates
3. Apply promotion decisions locally
4. Cache API responses

---

## Decision Matrix: Who Decides What?

| Decision | Owner | Rationale |
|----------|-------|-----------|
| **Which variant to execute?** | metabob-opencode | Client-side traffic splitting for low latency |
| **Fallback on candidate failure?** | metabob-opencode | Client-side resilience |
| **When to promote a candidate?** | metabob-rpc-api | Centralized, statistical, multi-user data |
| **Which templates to recommend?** | metabob-rpc-api | Global learning across all users |
| **Code quality issues?** | metabob-cli | Domain-specific analysis engine |
| **Component annotations?** | metabob-cli | CPG-based semantic understanding |
| **Template genealogy tracking?** | metabob-rpc-api | Central registry, versioning |
| **Local execution evidence?** | metabob-opencode | Performance data collection |

---

## Recommended Approach for Phase 2.3

### Option A: Python Script (Quick Prototype) ⭐ **RECOMMENDED**
**Location**: Extend `analyze_template_performance.py` in root
**Pros**:
- Quick to implement (2 hours)
- No API deployment needed
- Validates aggregation logic
- Can migrate to RPC API later

**Cons**:
- Local data only (single user)
- Not real-time
- Manual execution

**Implementation**:
```python
# analyze_template_performance.py

def analyze_ab_testing_metrics(storage_path: Path):
    """Analyze A/B testing metrics for template variants."""
    
    # 1. Load templates and identify A/B relationships
    templates = load_templates(storage_path)
    stable_templates = [t for t in templates if t.status == "stable" and t.candidateIds]
    
    # 2. Load execution evidence
    executions = load_execution_evidence(storage_path)
    
    # 3. Aggregate by variant
    for stable in stable_templates:
        stable_metrics = calculate_metrics(executions, stable.id)
        
        for candidate_id in stable.candidateIds:
            candidate_metrics = calculate_metrics(executions, candidate_id)
            
            # 4. Compare and recommend
            recommendation = compare_variants(stable_metrics, candidate_metrics)
            print(f"Recommendation for {candidate_id}: {recommendation}")
```

### Option B: RPC API Endpoint (Production-Ready)
**Location**: `repos/metabob-rpc-api/src/endpoints/template_metrics.py`
**Pros**:
- Production-ready
- Multi-user data
- Real-time analysis
- Centralized decisions

**Cons**:
- Requires API deployment
- More complex (3-4 hours)
- Needs authentication, rate limiting, etc.

**Implementation**:
```python
# repos/metabob-rpc-api/src/endpoints/template_metrics.py

@router.post("/api/activity-execution")
async def report_execution(execution: ExecutionResult):
    """Receive execution result from client."""
    await metrics_aggregator.record_execution(execution)
    return {"status": "ok"}

@router.get("/api/template/{template_id}/recommendation")
async def get_recommendation(template_id: str):
    """Get promotion recommendation for template."""
    metrics = await metrics_aggregator.get_variant_metrics(template_id)
    recommendation = promotion_engine.evaluate(metrics)
    return recommendation
```

---

## Recommendation for Phase 2.3

**Use Option A (Python Script)** for now because:

1. ✅ **Fast to implement** - 2 hours vs 4 hours
2. ✅ **Validates logic** - Test aggregation algorithm before adding to API
3. ✅ **Sufficient for Phase 2** - We're building the A/B infrastructure, not deploying to production yet
4. ✅ **Easy to migrate** - Logic can be copy-pasted to RPC API in Phase 3
5. ✅ **Already have the script** - `analyze_template_performance.py` exists and works

**Phase 3 Migration Path**:
- Phase 2.3: Python script (local analysis) ← **START HERE**
- Phase 3.1: Add RPC API endpoints (receive executions)
- Phase 3.2: Add promotion engine (statistical decisions)
- Phase 3.3: OpenCode integration (report to API)

This approach lets us:
- ✅ Complete Phase 2 quickly (A/B infrastructure)
- ✅ Validate metrics logic with real data
- ✅ Defer API deployment to Phase 3 (when we're ready for production)

---

## Next Steps

### Immediate (Phase 2.3 - Next 2 hours):
1. Extend `analyze_template_performance.py`:
   - Add variant comparison logic
   - Calculate per-variant success rates
   - Statistical significance testing
   - Promotion recommendations

2. Test with real data:
   - Run against local storage
   - Verify metrics calculations
   - Validate recommendations

### Future (Phase 3 - Next week):
1. Add RPC API endpoints (metabob-rpc-api)
2. Implement promotion engine (statistical tests)
3. Add OpenCode API client (report metrics)
4. Deploy and test end-to-end

---

## Conclusion

**Separation is clear**:
- **metabob-opencode**: Client-side A/B routing, execution, local metrics ✅
- **metabob-cli**: Code analysis, CPG, issue detection ✅
- **metabob-rpc-api**: Centralized registry, promotion decisions, statistical analysis (Phase 3)

**For Phase 2.3**: Extend Python script for quick validation. Migrate to RPC API in Phase 3.

This approach minimizes architectural complexity while maintaining clear separation of concerns.
