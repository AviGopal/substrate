# Data Flow Analysis: Context Requirements Evolution

**Feature:** `context-requirements-evolution`  
**Status:** ⚠️ **NOT IMPLEMENTED** - Infrastructure exists but core functionality missing  
**Date:** 2026-02-23  
**Analysis Type:** Complete end-to-end data flow tracing

---

## Executive Summary

**Purpose:** Automatically optimize activity template `contextRequirements` by analyzing impulse usage patterns across 20+ executions, calculating correlation between impulse presence and task success, and updating templates to include high-correlation impulses while removing low-correlation ones.

**Current State:** 
- ✅ Impulse loading and usage tracking (in-memory)
- ✅ Execution outcome recording (success/failure)
- ✅ Template metrics aggregation (success_rate, avg_cost)
- ❌ Impulse data persistence (MISSING)
- ❌ Correlation analysis (MISSING)
- ❌ Automatic template updates (MISSING)

**Blocking Issues:**
1. Backend missing `impulses[]` field in ExecutionRequest schema → data loss
2. No impulse correlation analysis service → cannot identify effective impulses
3. No template evolution service → cannot close learning loop

---

## Complete Data Flow Diagram

### Current Implementation (Partial)

```mermaid
graph TD
    %% Entry Point
    A[Activity Execution Start] -->|impulseIds: string[]| B[loadAndFormatImpulses]
    
    %% Frontend - Impulse Loading
    B -->|Impulse.Schema[]| C[ImpulseResolver.load]
    C -->|content: string, tokens: int| D[Update usageStats in-memory]
    D -->|usageStats.loadCount++| E[Format impulse section]
    E -->|markdown: string| F[Task Execution]
    
    %% Execution Completes
    F -->|success: boolean, duration: int| G[TemplateMetricsClient.reportExecution]
    
    %% MCP Bridge
    G -->|ActivityExecutionData| H{MCP Bridge}
    H -->|Path A| I[JSON Files - Legacy]
    H -->|Path B| J[Redis - Thompson Sampling]
    H -->|Path C| K[HTTP POST /api/v1/learning-loop/executions]
    
    %% Backend - Execution Recording
    K -->|ExecutionRequest| L[record_execution endpoint]
    L -->|parse timestamps| M[insert_execution]
    M -->|execution record| N[(SurrealDB - activity_execution)]
    
    L -->|aggregate metrics| O[update_metrics_after_execution]
    O -->|read-modify-write| P[(SurrealDB - template_metrics)]
    
    L -->|if failure| Q[record_failure]
    Q -->|failure pattern| R[(SurrealDB - failure_pattern)]
    
    %% MISSING COMPONENTS
    S[❌ MISSING: Impulse Data] -.->|impulses not persisted| N
    T[❌ MISSING: Correlation Analysis] -.->|cannot analyze patterns| P
    U[❌ MISSING: Template Evolution] -.->|no automatic updates| V[Template Storage]
    
    %% Styling
    style A fill:#e1f5ff,stroke:#0066cc,stroke-width:3px
    style N fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    style P fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    style R fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    style S fill:#ffcccc,stroke:#990000,stroke-width:2px,stroke-dasharray: 5 5
    style T fill:#ffcccc,stroke:#990000,stroke-width:2px,stroke-dasharray: 5 5
    style U fill:#ffcccc,stroke:#990000,stroke-width:2px,stroke-dasharray: 5 5
    style H fill:#fff4e1,stroke:#ff9900,stroke-width:2px
```

### Target Implementation (Complete Flow)

```mermaid
graph TD
    %% Phase 1: Execution & Data Collection
    A[Activity Execution Start] -->|impulseIds: string[]| B[loadAndFormatImpulses]
    B -->|Impulse.Schema[]| C[ImpulseResolver.load]
    C -->|content, tokens, cost| D[Update usageStats]
    D -->|usageStats: {loadCount, totalCost, totalTokens}| E[Format impulse section]
    E -->|markdown: string| F[Task Execution]
    
    %% Phase 2: Execution Completion
    F -->|ExecutionResult| G[TemplateMetricsClient.reportExecution]
    G -->|ActivityExecutionData + impulses[]| H{MCP Bridge}
    
    %% Phase 3: Backend Data Persistence
    H -->|HTTP POST| K[record_execution endpoint]
    K -->|ExecutionRequest with impulses[]| L{Transaction Begin}
    
    L -->|1. execution| M[insert_execution]
    M -->|execution record| N[(activity_execution)]
    
    L -->|2. impulses| O[insert_impulse_execution loop]
    O -->|impulse records| P[(impulse_execution)]
    
    L -->|3. metrics| Q[update_metrics_after_execution]
    Q -->|ATOMIC update| R[(template_metrics)]
    
    L -->|4. failure pattern| S[record_failure if needed]
    S -->|pattern| T[(failure_pattern)]
    
    L -->|Transaction Commit| U{All writes succeeded?}
    U -->|Yes| V[Success Response]
    U -->|No| W[Rollback + Error]
    
    %% Phase 4: Correlation Analysis (Triggered by Evolution)
    X[Evolution Trigger: BoredomManager] -->|template_id| Y[GET /api/v1/impulse-analytics/correlation]
    Y -->|min_executions=20| Z[analyze_impulse_correlation]
    
    Z -->|query| AA[get_executions_by_template]
    AA -->|execution list| AB[(activity_execution + impulse_execution JOIN)]
    
    AB -->|executions with impulse data| AC[Calculate correlation per impulse]
    AC -->|for each unique impulse| AD{Partition executions}
    AD -->|with impulse| AE[Calculate success_rate_with]
    AD -->|without impulse| AF[Calculate success_rate_without]
    
    AE --> AG[correlation = success_with - success_without]
    AF --> AG
    
    AG -->|correlation scores| AH{Determine recommendation}
    AH -->|correlation > 0.2| AI[Recommendation: ADD]
    AH -->|correlation < -0.1| AJ[Recommendation: REMOVE]
    AH -->|else| AK[Recommendation: NEUTRAL]
    
    AI --> AL[ImpulseCorrelationResponse]
    AJ --> AL
    AK --> AL
    
    %% Phase 5: Template Evolution
    AL -->|analysis results| AM[PATCH /api/v1/templates/:id/context-requirements]
    AM -->|auto_apply=false| AN{Preview Mode?}
    
    AN -->|Yes: preview| AO[Return preview of changes]
    AO -->|human review| AP{User approves?}
    
    AP -->|No| AQ[Cancel evolution]
    AP -->|Yes| AR[auto_apply=true]
    
    AN -->|No: auto_apply| AR
    AR -->|apply changes| AS[optimize_context_requirements]
    
    AS -->|for each ADD| AT[Append to template.contextRequirements]
    AS -->|for each REMOVE| AU[Filter from template.contextRequirements]
    
    AT --> AV[Increment template.version]
    AU --> AV
    
    AV -->|updated template| AW[Store evolution_history]
    AW -->|persist| AX[(template storage)]
    
    AX -->|updated template| AY[Evolution Complete]
    
    %% Styling
    style A fill:#e1f5ff,stroke:#0066cc,stroke-width:3px
    style N fill:#d4edda,stroke:#28a745,stroke-width:2px
    style P fill:#d4edda,stroke:#28a745,stroke-width:2px
    style R fill:#d4edda,stroke:#28a745,stroke-width:2px
    style T fill:#d4edda,stroke:#28a745,stroke-width:2px
    style AB fill:#fff3cd,stroke:#ffc107,stroke-width:2px
    style AX fill:#ffe1e1,stroke:#cc0000,stroke-width:3px
    style AY fill:#d4edda,stroke:#28a745,stroke-width:3px
    style H fill:#fff4e1,stroke:#ff9900,stroke-width:2px
    style L fill:#fff4e1,stroke:#ff9900,stroke-width:2px
    style AN fill:#e7f3ff,stroke:#0066cc,stroke-width:2px
```

---

## Data Flow Summary

### Entry Point
**Location:** `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts:70`  
**Component:** `loadAndFormatImpulses()`  
**Input Format:**
```typescript
impulseIds: string[]  // e.g., ["file:auth.ts", "cochange:login.ts", "annotation:UserAuth"]
activityImpulses: Record<string, Impulse.Schema>
```

**Initial State:** Impulses are pointers (not yet loaded)

---

### Transformation 1: Impulse Resolution
**Location:** Frontend → `ImpulseResolver.load()`  
**Input:** `Impulse.Schema` with pointer
**Output:** `Impulse.Schema` with content loaded
**Transformation:**
```typescript
// Before
{
  id: "file:auth.ts",
  type: "file",
  pointer: { type: "file", path: "src/auth.ts" },
  loaded: false,
  content: null
}

// After
{
  id: "file:auth.ts",
  type: "file",
  pointer: { type: "file", path: "src/auth.ts" },
  loaded: true,
  content: "export class AuthService { ... }",  // ← Loaded from filesystem
  tokenCount: 450,
  usageStats: {
    loadCount: 1,
    totalTokens: 450,
    totalCost: 0.0045,  // ❌ Currently not calculated
    firstAccessedAt: 1708670400000,
    lastAccessedAt: 1708670400000
  }
}
```

**Validation Rules:**
- ✅ Monotonic invariant: `loadCount` must increase
- ❌ No validation for token budget exhaustion
- ❌ No validation for cost limits

**Side Effects:**
- Updates `usageStats` in-place (mutation)
- **⚠️ CRITICAL:** Data stored in memory only (lost after session)

---

### Transformation 2: MCP Bridge (Frontend → Backend)
**Location:** `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:91`  
**Component:** `TemplateMetricsClient.reportExecution()`  
**Input:** `ActivityExecutionData` (TypeScript)
```typescript
{
  activity_id: string,
  template_id: string,
  variant_id: string,
  success: boolean,
  duration: number,  // milliseconds
  cost: number,      // USD
  tokens: { input: number, output: number, cache: number },
  failure_reason?: string,
  error_type?: string
}
```

**Output:** HTTP POST to `/api/v1/learning-loop/executions`  
**Transformation:**
```typescript
// Frontend format → Backend format
{
  activity_id: "act_abc123",           // Same
  template_id: "add-feature-complete", // Same
  started_at: "2026-02-23T04:00:00Z",  // ← Must be added (missing from frontend)
  duration_ms: 45000,                  // ← Renamed from "duration"
  success: true,                       // Same
  tokens_input: 5000,                  // ← Flattened from tokens.input
  tokens_output: 1500,                 // ← Flattened from tokens.output
  tokens_cache: 2000,                  // ← Flattened from tokens.cache
  cost_usd: 0.022,                     // ← Renamed from "cost"
  // ❌ MISSING: impulses: [...]
}
```

**Validation Rules:**
- ✅ Non-blocking: Errors logged but don't throw
- ✅ Dual-write pattern: JSON + Redis + SurrealDB
- ❌ No retry logic for transient failures
- ❌ No schema version negotiation

**Architectural Boundary:** **Service Boundary** (Frontend ↔ Backend via MCP/HTTP)  
**Coupling:** Medium (schema coupling, no shared type definitions)  
**Resilience:** Good (graceful degradation if MCP unavailable)

---

### Transformation 3: Backend Entry - Execution Recording
**Location:** `repos/metabob-rpc-api/server/routes/learning_loop.py:119`  
**Component:** `record_execution()` endpoint  
**Input:** `ExecutionRequest` (Pydantic model)
```python
class ExecutionRequest(BaseModel):
    activity_id: str
    template_id: str
    started_at: str  # ISO 8601
    duration_ms: int
    success: bool
    tokens_input: int
    tokens_output: int
    tokens_cache: int
    cost_usd: float
    error_message: Optional[str] = None
    error_type: Optional[str] = None
```

**Output:** Three database writes (NO TRANSACTION):
1. `activity_execution` record
2. `template_metrics` update
3. `failure_pattern` record (if failed)

**Transformation:**
```python
# Parse timestamps
started_at = datetime.fromisoformat(request.started_at.replace("Z", "+00:00"))

# Extract template_id parts (may contain variant)
# "add-feature-complete-abc123" → template_id="add-feature-complete", variant_id="abc123"

# Insert execution
execution = {
    "execution_id": request.activity_id,
    "variant_id": variant_id,
    "activity_id": template_id,
    "duration_ms": request.duration_ms,
    "success": request.success,
    "tokens_input": request.tokens_input,
    "tokens_output": request.tokens_output,
    "tokens_cache": request.tokens_cache,
    "cost_usd": request.cost_usd,
    "started_at": started_at,
    "error_message": request.error_message,
    "error_type": request.error_type
}
```

**Validation Rules:**
- ✅ Pydantic schema validation (type safety)
- ✅ Timestamp parsing with error handling
- ❌ No validation that template_id exists
- ❌ No validation for logical consistency (completed_at > started_at)
- ❌ No validation for duration_ms vs. calculated time difference

**Side Effects:**
- **⚠️ CRITICAL:** Three separate writes WITHOUT transaction
- **Risk:** Partial failure (execution inserted, metrics not updated)
- **For impulse data:** Would add 4th write (compounds risk)

**Architectural Boundary:** **Data Store Boundary** (Application → SurrealDB)  
**Coupling:** Tight (direct schema dependency)  
**Resilience:** Weak (no retry, no transaction)

---

### Transformation 4: Metrics Aggregation
**Location:** `repos/metabob-rpc-api/server/db/operations/template_metrics.py:99`  
**Component:** `update_metrics_after_execution()`  
**Input:** Execution result fields
**Output:** Updated `template_metrics` record

**Transformation (Incremental Aggregation):**
```python
# Read current metrics
metrics = get_metrics(template_id)
n = metrics.get("total_executions", 0)
n_new = n + 1

# Incremental mean formula: new_mean = (old_mean * old_count + new_value) / new_count
new_avg_duration = (metrics["avg_duration_ms"] * n + duration_ms) / n_new
new_avg_cost = (metrics["avg_cost_usd"] * n + cost_usd) / n_new

# Update counts
successful_executions = metrics["successful_executions"] + (1 if success else 0)
failed_executions = metrics["failed_executions"] + (0 if success else 1)

# Calculate derived metrics
success_rate = successful_executions / n_new
thompson_alpha = successful_executions + 1.0  # Beta distribution prior
thompson_beta = failed_executions + 1.0
improvement_gradient = success_rate * min(1.0, n_new / 10.0)

# Write updated metrics
db.update(f"template_metrics:{template_id}", {
    "total_executions": n_new,
    "successful_executions": successful_executions,
    "failed_executions": failed_executions,
    "success_rate": success_rate,
    "avg_duration_ms": int(new_avg_duration),
    "avg_cost_usd": new_avg_cost,
    "thompson_alpha": thompson_alpha,
    "thompson_beta": thompson_beta,
    "improvement_gradient": improvement_gradient,
    "last_executed_at": datetime.utcnow().isoformat()
})
```

**Business Logic:**
- **Thompson Sampling:** Beta distribution parameters for variant selection
- **Improvement Gradient:** Composite score triggers evolution when < 0.7
- **Incremental Aggregation:** Avoid scanning all execution records (performance)

**Validation Rules:**
- ✅ Create-if-not-exists pattern (auto-initialize metrics)
- ✅ Division by zero protection (`if n_new > 0`)
- ❌ **RACE CONDITION:** Read-modify-write without locking

**Critical Issue:**
```python
# Thread A: Read n=5
n = metrics.get("total_executions", 0)  # n = 5

# Thread B: Read n=5 (same value!)
n = metrics.get("total_executions", 0)  # n = 5

# Thread A: Write n=6
db.update(..., {"total_executions": 6})

# Thread B: Write n=6 (should be 7!)
db.update(..., {"total_executions": 6})

# Result: Lost update
```

**Architectural Boundary:** **Layer Boundary** (Business Logic → Data Access)  
**Coupling:** Tight (no service layer abstraction)  
**Resilience:** Weak (race condition, no transaction)

---

### Transformation 5: [MISSING] Impulse Correlation Analysis
**Location:** `repos/metabob-rpc-api/server/services/impulse_analytics.py` (DOES NOT EXIST)  
**Component:** `analyze_impulse_correlation()`  
**Input:** `template_id: str`, `min_executions: int = 20`
**Output:** `ImpulseCorrelationResponse`

**Transformation (Statistical Analysis):**
```python
# 1. Query all executions with impulse data
executions = db.query("""
    SELECT 
        e.*, 
        array::group(i.impulse_id) AS impulses
    FROM activity_execution e
    LEFT JOIN impulse_execution i ON i.execution_id = e.id
    WHERE e.activity_id = $template_id
    GROUP BY e.id
""")

# 2. Extract unique impulses
unique_impulses = set()
for execution in executions:
    unique_impulses.update(execution.impulses or [])

# 3. For each impulse, calculate correlation
results = []
for impulse_id in unique_impulses:
    # Partition executions
    with_impulse = [e for e in executions if impulse_id in (e.impulses or [])]
    without_impulse = [e for e in executions if impulse_id not in (e.impulses or [])]
    
    # Calculate success rates
    success_rate_with = sum(1 for e in with_impulse if e.success) / len(with_impulse)
    success_rate_without = sum(1 for e in without_impulse if e.success) / len(without_impulse)
    
    # Correlation = Lift in success rate
    correlation = success_rate_with - success_rate_without
    
    # Recommendation
    if correlation > 0.2:
        recommendation = "ADD_TO_CONTEXT_REQUIREMENTS"
    elif correlation < -0.1:
        recommendation = "REMOVE_FROM_CONTEXT_REQUIREMENTS"
    else:
        recommendation = "NEUTRAL"
    
    results.append({
        "impulse_id": impulse_id,
        "correlation": correlation,
        "executions_with": len(with_impulse),
        "successes_with": sum(1 for e in with_impulse if e.success),
        "success_rate_with": success_rate_with,
        "executions_without": len(without_impulse),
        "successes_without": sum(1 for e in without_impulse if e.success),
        "success_rate_without": success_rate_without,
        "recommendation": recommendation
    })

# 4. Sort by correlation (highest first)
results.sort(key=lambda r: r["correlation"], reverse=True)

return ImpulseCorrelationResponse(
    template_id=template_id,
    total_executions=len(executions),
    impulses=results
)
```

**Business Logic:**
- **Minimum sample size:** Require 20+ executions (avoid spurious correlations)
- **Lift metric:** Simple difference in success rates (easy to understand)
- **Recommendation thresholds:** >0.2 = ADD, <-0.1 = REMOVE

**Validation Rules:**
- ✅ Sample size validation (`len(executions) >= min_executions`)
- ✅ Avoid division by zero (`len(with_impulse) > 0`)
- ⚠️ No statistical significance test (Chi-squared, p-value)
- ⚠️ Ignores confounding variables (correlation ≠ causation)

**Architectural Boundary:** **Analytics Service Boundary** (Read-only, no side effects)  
**Coupling:** Loose (stateless, cacheable)  
**Resilience:** Good (read-only queries, can retry)

---

### Transformation 6: [MISSING] Template Evolution
**Location:** `repos/metabob-rpc-api/server/services/template_evolution.py` (DOES NOT EXIST)  
**Component:** `optimize_context_requirements()`  
**Input:** `template_id: str`, `correlation_threshold: float = 0.2`, `auto_apply: bool = False`
**Output:** Updated template with optimized `contextRequirements`

**Transformation:**
```python
# 1. Get correlation analysis
analysis = analyze_impulse_correlation(template_id, min_executions=20)

# 2. Get current template
template = get_template(template_id)
current_requirements = set(cr.identifier for cr in template.contextRequirements)

# 3. Determine changes
changes = []
for impulse in analysis.impulses:
    if impulse.correlation > correlation_threshold:
        if impulse.impulse_id not in current_requirements:
            # ADD impulse
            changes.append({
                "action": "ADD",
                "impulse_id": impulse.impulse_id,
                "impulse_type": impulse.impulse_type,
                "correlation": impulse.correlation,
                "justification": f"High correlation ({impulse.correlation:.2f}). Success with: {impulse.success_rate_with:.1%}, without: {impulse.success_rate_without:.1%}"
            })
    
    elif impulse.correlation < -correlation_threshold:
        if impulse.impulse_id in current_requirements:
            # REMOVE impulse
            changes.append({
                "action": "REMOVE",
                "impulse_id": impulse.impulse_id,
                "impulse_type": impulse.impulse_type,
                "correlation": impulse.correlation,
                "justification": f"Negative correlation ({impulse.correlation:.2f}). Success with: {impulse.success_rate_with:.1%}, without: {impulse.success_rate_without:.1%}"
            })

# 4. Apply changes (if auto_apply=True)
if auto_apply and len(changes) > 0:
    for change in changes:
        if change["action"] == "ADD":
            template.contextRequirements.append({
                "type": change["impulse_type"],
                "identifier": change["impulse_id"],
                "priority": "high" if change["correlation"] > 0.3 else "medium",
                "added_by": "learning_system",
                "added_at": datetime.utcnow().isoformat(),
                "justification": change["justification"]
            })
        elif change["action"] == "REMOVE":
            template.contextRequirements = [
                cr for cr in template.contextRequirements
                if cr.identifier != change["impulse_id"]
            ]
    
    # Increment version
    template.version = increment_version(template.version)
    
    # Store evolution history
    template.evolution_history.append({
        "date": datetime.utcnow().isoformat(),
        "type": "context_requirements_optimization",
        "changes": changes,
        "analysis_executions": analysis.total_executions
    })
    
    # Persist
    update_template(template_id, template)

return {
    "template_id": template_id,
    "preview": not auto_apply,
    "changes": changes,
    "updated_template": template if auto_apply else None
}
```

**Business Logic:**
- **Safety gate:** Preview mode by default (auto_apply=False)
- **Human approval:** Require explicit confirmation before modifications
- **Audit trail:** Store evolution_history with justifications
- **Version control:** Increment template.version after changes

**Validation Rules:**
- ✅ Idempotency: Applying same changes twice is no-op
- ✅ Template existence check
- ❌ No version conflict detection (what if template changed since analysis?)
- ❌ No rollback mechanism

**Architectural Boundary:** **Data Store Boundary** (Application → Template Storage)  
**Coupling:** Medium (modifies template schema)  
**Resilience:** Medium (needs rollback support)

---

### Exit Point
**Location:** `repos/metabob-rpc-api/server/db/surrealdb_client.py`  
**Component:** SurrealDB write operations  
**Final Format:**

**1. Execution Record (`activity_execution` table):**
```json
{
  "id": "activity_execution:act_abc123",
  "execution_id": "act_abc123",
  "variant_id": "add-feature-complete-abc123",
  "activity_id": "add-feature-complete",
  "duration_ms": 45000,
  "success": true,
  "tokens_input": 5000,
  "tokens_output": 1500,
  "tokens_cache": 2000,
  "cost_usd": 0.022,
  "started_at": "2026-02-23T04:00:00Z",
  "completed_at": "2026-02-23T04:00:45Z",
  "error_message": null,
  "error_type": null
}
```

**2. Impulse Records (`impulse_execution` table - MISSING):**
```json
{
  "id": "impulse_execution:uuid123",
  "execution_id": "activity_execution:act_abc123",
  "impulse_id": "file:auth.ts",
  "impulse_type": "file",
  "tokens_loaded": 450,
  "cost_usd": 0.0045,
  "loaded_at": "2026-02-23T04:00:01Z"
}
```

**3. Template Metrics (`template_metrics` table):**
```json
{
  "id": "template_metrics:add-feature-complete",
  "total_executions": 47,
  "successful_executions": 42,
  "failed_executions": 5,
  "success_rate": 0.8936,
  "avg_duration_ms": 43200,
  "avg_cost_usd": 0.0234,
  "avg_tokens_input": 4800,
  "avg_tokens_output": 1450,
  "avg_tokens_cache": 1900,
  "avg_tokens_total": 8150,
  "thompson_alpha": 43.0,
  "thompson_beta": 6.0,
  "improvement_gradient": 0.8936,
  "last_executed_at": "2026-02-23T04:00:45Z",
  "updated_at": "2026-02-23T04:00:45Z"
}
```

**4. Updated Template (after evolution):**
```json
{
  "id": "add-feature-complete",
  "name": "Add Feature (Complete)",
  "version": "1.2.0",
  "contextRequirements": [
    {
      "type": "file",
      "identifier": "file:auth.ts",
      "priority": "high",
      "added_by": "learning_system",
      "added_at": "2026-02-23T04:00:50Z",
      "justification": "High correlation (0.34). Success with: 87.5%, without: 53.3%"
    },
    {
      "type": "cochange",
      "identifier": "cochange:login.ts",
      "priority": "medium"
    }
  ],
  "evolution_history": [
    {
      "date": "2026-02-23T04:00:50Z",
      "type": "context_requirements_optimization",
      "changes": [
        {
          "action": "ADD",
          "impulse_id": "file:auth.ts",
          "correlation": 0.34,
          "justification": "High correlation..."
        }
      ],
      "analysis_executions": 47
    }
  ]
}
```

---

## Architectural Boundaries Crossed

### Boundary 1: Repository Boundary (TypeScript ↔ Python)
**Location:** `metabob-opencode` (frontend) ↔ `metabob-rpc-api` (backend)  
**Protocol:** Model Context Protocol (MCP) over HTTP  
**Contract:** JSON Schema for tool definitions  
**Coupling:** **LOOSE** (language-agnostic, network-based)  
**Resilience:** **GOOD** (graceful degradation, non-blocking)  
**Versioning:** ❌ None (no API versioning strategy)

**Risk:** Schema changes break silently (return `undefined` instead of error)

---

### Boundary 2: Service Boundary (Frontend → Backend)
**Location:** MCP tool call → REST endpoint  
**Contract:** `ActivityExecutionData` → `ExecutionRequest`  
**Coupling:** **MEDIUM** (schema coupling, no shared types)  
**Resilience:** **GOOD** (dual-write, tolerates partial failures)  
**Versioning:** ❌ None

**Risk:** Adding `impulses[]` requires coordinated deployment (backend first, then frontend)

---

### Boundary 3: Data Store Boundary (Backend → SurrealDB)
**Location:** Business logic → Database writes  
**Contract:** Python dicts → SurrealDB records  
**Coupling:** **TIGHT** (direct schema dependency, no ORM)  
**Resilience:** **WEAK** (no transactions, no retry)  
**Versioning:** ❌ None (no schema migrations evident)

**Risk:** Partial failures corrupt data, race conditions in concurrent updates

---

### Boundary 4: Analytics Service Boundary (Read-Only)
**Location:** Correlation analysis service  
**Contract:** REST API with query parameters  
**Coupling:** **LOOSE** (stateless, cacheable)  
**Resilience:** **GOOD** (read-only, idempotent)  
**Versioning:** ✅ Can add query parameters without breaking clients

**Risk:** Expensive queries for large execution datasets (needs pagination/caching)

---

## Key Insights

### Business Purpose
**Goal:** Enable continuous template improvement through data-driven optimization

**Value Proposition:**
- **Reduce manual tuning:** Templates optimize themselves based on real execution data
- **Improve success rates:** Add high-value context, remove noise
- **Reduce costs:** Eliminate low-value impulses that add tokens without helping
- **Accelerate learning:** Faster feedback loop from execution → insights → action

**Stakeholders:**
- **Template authors:** Less maintenance burden, data-driven improvements
- **Activity users:** Higher success rates, faster execution (less noisy context)
- **System operators:** Better resource utilization (token efficiency)

---

### Critical Decision Points

#### Decision 1: In-Memory vs. Persistent Impulse Tracking
**Current:** In-memory only (session state)  
**Trade-off:** Fast access vs. data loss  
**Decision Rationale:** Performance during execution  
**Impact:** **BLOCKS** context-requirements-evolution (no data to analyze)

**Recommendation:** **Persist impulse usage to backend** (dual-write pattern)

---

#### Decision 2: Transaction vs. No Transaction
**Current:** Three separate writes without transaction  
**Trade-off:** Simplicity vs. consistency  
**Decision Rationale:** SurrealDB transactions not implemented  
**Impact:** **HIGH RISK** of data corruption under concurrent load

**Recommendation:** **Implement transactions** (BEGIN/COMMIT/ROLLBACK)

---

#### Decision 3: Atomic vs. Read-Modify-Write Metrics
**Current:** Read-modify-write without locking  
**Trade-off:** Ease of implementation vs. race conditions  
**Decision Rationale:** Incremental aggregation for performance  
**Impact:** **CRITICAL** race condition corrupts metrics

**Recommendation:** **Use atomic SurrealDB updates** (single query with arithmetic)

---

#### Decision 4: Correlation vs. Statistical Significance
**Proposed:** Simple lift metric (success_rate_with - success_rate_without)  
**Trade-off:** Simplicity vs. statistical rigor  
**Decision Rationale:** Easy to understand, actionable  
**Impact:** Risk of spurious correlations (false positives)

**Recommendation:** **Start with lift, add chi-squared test later** (MVP first)

---

#### Decision 5: Preview vs. Auto-Apply Evolution
**Proposed:** Preview mode by default, require explicit approval  
**Trade-off:** Safety vs. automation  
**Decision Rationale:** Prevent accidental template corruption  
**Impact:** Extra step for human review

**Recommendation:** **Keep preview-first** (safety over automation)

---

### Potential Risks & Technical Debt

#### Risk 1: Data Loss (HIGH)
**Issue:** Impulse usage tracked in-memory but not persisted  
**Impact:** Cannot analyze patterns across executions  
**Mitigation:** Add `impulses[]` to ExecutionRequest, create `impulse_execution` table

---

#### Risk 2: Race Condition (CRITICAL)
**Issue:** Metrics aggregation uses read-modify-write without locking  
**Impact:** Concurrent executions corrupt success_rate, thompson_alpha/beta  
**Mitigation:** Use atomic SurrealDB updates

---

#### Risk 3: Partial Failures (HIGH)
**Issue:** Three database writes without transaction  
**Impact:** Execution recorded but metrics not updated → inconsistent state  
**Mitigation:** Wrap writes in transaction (BEGIN/COMMIT/ROLLBACK)

---

#### Risk 4: Spurious Correlations (MEDIUM)
**Issue:** Simple lift metric without statistical significance test  
**Impact:** False positives → add/remove wrong impulses  
**Mitigation:** Add chi-squared test, require minimum sample size (20+)

---

#### Risk 5: No Rollback Mechanism (MEDIUM)
**Issue:** Template updates are permanent, no undo  
**Impact:** Bad evolution decisions cannot be reversed  
**Mitigation:** Store template history, implement rollback API

---

#### Technical Debt 1: No Service Layer (MEDIUM)
**Issue:** Controller directly calls data access layer  
**Impact:** Hard to test, mixed concerns, hard to extend  
**Mitigation:** Refactor to Controller → Service → Repository pattern

---

#### Technical Debt 2: No Schema Versioning (MEDIUM)
**Issue:** No API versioning, no schema migrations  
**Impact:** Breaking changes break silently  
**Mitigation:** Add version field to requests, implement migration system

---

#### Technical Debt 3: Dual-Write Inconsistency (LOW-MEDIUM)
**Issue:** JSON + Redis + SurrealDB writes can diverge  
**Impact:** Eventual consistency model (no guarantees)  
**Mitigation:** Consolidate to single source of truth (SurrealDB)

---

## Suggested Improvements

### Immediate (Unblock Feature)
1. ✅ **Add impulse persistence**
   - Modify `ExecutionRequest` schema to include `impulses[]`
   - Create `impulse_execution` table in SurrealDB
   - Update `record_execution()` to insert impulse records

2. ✅ **Implement correlation analysis service**
   - Create `impulse_analytics.py` with `analyze_impulse_correlation()`
   - Add REST endpoint `GET /api/v1/impulse-analytics/correlation`
   - Implement lift metric calculation

3. ✅ **Implement template evolution service**
   - Create `template_evolution.py` with `optimize_context_requirements()`
   - Add REST endpoint `PATCH /api/v1/templates/:id/context-requirements`
   - Implement preview mode with human approval gate

### Short-Term (Fix Data Integrity)
4. ✅ **Fix race condition in metrics aggregation**
   - Replace read-modify-write with atomic SurrealDB updates
   - Use single query with arithmetic operations

5. ✅ **Add transaction support**
   - Wrap execution + impulses + metrics writes in transaction
   - Implement BEGIN/COMMIT/ROLLBACK pattern

6. ✅ **Add input validation**
   - Validate template_id exists before creating metrics
   - Validate timestamp logical consistency (completed_at > started_at)
   - Validate duration_ms vs. calculated time difference

### Medium-Term (Architecture)
7. ⚠️ **Refactor to service layer**
   - Extract business logic from controllers
   - Implement Controller → Service → Repository pattern
   - Add dependency injection for testability

8. ⚠️ **Add schema versioning**
   - Add version field to API requests/responses
   - Implement schema migration system for SurrealDB
   - Support multiple API versions concurrently

9. ⚠️ **Consolidate dual-write**
   - Migrate from JSON + Redis to SurrealDB only
   - Implement change data capture (CDC) for Redis if needed

### Long-Term (Advanced Analytics)
10. 💡 **Add statistical significance testing**
    - Implement chi-squared test for impulse correlation
    - Calculate p-values and confidence intervals
    - Add sample size power analysis

11. 💡 **Add impulse interaction analysis**
    - Detect impulse combinations that work well together
    - Use association rule mining (Apriori algorithm)
    - Recommend impulse sets, not just individual impulses

12. 💡 **Add cost-effectiveness analysis**
    - Calculate value per token (success lift / token cost)
    - Optimize for success rate AND cost efficiency
    - Support user-defined cost budgets

---

## Reusable Patterns

### Pattern 1: Incremental Aggregation
**Where Used:** Metrics aggregation (`update_metrics_after_execution`)  
**Purpose:** Avoid expensive table scans for aggregates  
**Formula:** `new_avg = (old_avg * old_count + new_value) / new_count`

**When to Use:**
- Real-time metrics that update frequently
- Large datasets where full aggregation is expensive
- Read-heavy workloads (avoid re-scanning on every query)

**Reusable in:**
- Any metrics aggregation (user stats, API performance, usage tracking)
- Token usage tracking across sessions
- Cost tracking per user/organization

**Implementation Pattern:**
```python
def update_aggregate(entity_id: str, new_value: float, metric_name: str):
    metrics = get_metrics(entity_id)
    n = metrics["count"]
    n_new = n + 1
    old_avg = metrics[metric_name]
    new_avg = (old_avg * n + new_value) / n_new
    
    update_metrics(entity_id, {
        "count": n_new,
        metric_name: new_avg
    })
```

**Abstraction Opportunity:** ✅ **YES** - Create `IncrementalAggregator` utility class

---

### Pattern 2: Correlation Analysis
**Where Used:** Impulse correlation analysis (`analyze_impulse_correlation`)  
**Purpose:** Identify which features correlate with desired outcomes  
**Metric:** Lift (success_rate_with_feature - success_rate_without_feature)

**When to Use:**
- A/B testing analysis
- Feature effectiveness evaluation
- Recommendation system optimization
- Any binary outcome (success/failure, conversion/no-conversion)

**Reusable in:**
- Tool effectiveness analysis (which tools improve success?)
- Subagent performance analysis (which agents work best?)
- Context type effectiveness (files vs. annotations vs. cochange)
- User behavior analysis (which actions predict success?)

**Implementation Pattern:**
```python
def calculate_correlation(
    outcomes: List[Outcome],  # All outcomes
    feature_presence: Callable[[Outcome], bool],  # Is feature present?
    success_metric: Callable[[Outcome], bool]  # Is outcome successful?
) -> CorrelationResult:
    with_feature = [o for o in outcomes if feature_presence(o)]
    without_feature = [o for o in outcomes if not feature_presence(o)]
    
    success_rate_with = sum(1 for o in with_feature if success_metric(o)) / len(with_feature)
    success_rate_without = sum(1 for o in without_feature if success_metric(o)) / len(without_feature)
    
    correlation = success_rate_with - success_rate_without
    
    return CorrelationResult(
        correlation=correlation,
        with_count=len(with_feature),
        without_count=len(without_feature),
        success_rate_with=success_rate_with,
        success_rate_without=success_rate_without
    )
```

**Abstraction Opportunity:** ✅ **YES** - Create `CorrelationAnalyzer` utility class

---

### Pattern 3: Preview-First Modification
**Where Used:** Template evolution (`optimize_context_requirements`)  
**Purpose:** Safety gate for automated changes  
**Flow:** Preview → Human Review → Apply

**When to Use:**
- Any automated system modification
- Schema changes
- Configuration updates
- Template/policy modifications

**Reusable in:**
- Schema migration preview
- Configuration drift detection
- Automated refactoring suggestions
- Security policy updates
- Cost optimization recommendations

**Implementation Pattern:**
```python
def preview_or_apply_change(
    change_spec: ChangeSpec,
    auto_apply: bool = False
) -> ChangeResult:
    # Calculate changes
    changes = calculate_changes(change_spec)
    
    if not auto_apply:
        # Preview mode
        return ChangeResult(
            preview=True,
            changes=changes,
            applied=False
        )
    
    # Apply mode (requires explicit approval)
    result = apply_changes(changes)
    
    # Store audit trail
    log_change_history(change_spec, changes, result)
    
    return ChangeResult(
        preview=False,
        changes=changes,
        applied=True,
        result=result
    )
```

**Abstraction Opportunity:** ✅ **YES** - Create `PreviewableChangeService` base class

---

### Pattern 4: Dual-Write for Migration
**Where Used:** Metrics reporting (`TemplateMetricsClient.reportExecution`)  
**Purpose:** Migrate from legacy system to new system without downtime  
**Flow:** Write to both old and new backends, tolerate partial failures

**When to Use:**
- Database migration (old DB → new DB)
- API migration (v1 → v2)
- Storage migration (local files → cloud storage)
- Protocol migration (REST → gRPC)

**Reusable in:**
- Any data store migration
- Cross-region replication
- Gradual rollout of new infrastructure
- Backup/disaster recovery

**Implementation Pattern:**
```python
async def dual_write(data: Data):
    legacy_promise = write_to_legacy(data)
    new_promise = write_to_new(data)
    
    # Execute both in parallel
    results = await Promise.allSettled([legacy_promise, new_promise])
    
    # Log results (both writes are optional)
    if results[0].status == "rejected":
        log.warn("Legacy write failed", error=results[0].reason)
    
    if results[1].status == "rejected":
        log.warn("New write failed", error=results[1].reason)
    
    # Success if at least one write succeeded
    return results[0].status == "fulfilled" or results[1].status == "fulfilled"
```

**Abstraction Opportunity:** ⚠️ **MAYBE** - Useful for migrations, not general-purpose

---

### Feature-Specific vs. Universal Aspects

#### Universal (Reusable Across Features)
- ✅ Incremental aggregation pattern
- ✅ Correlation analysis pattern
- ✅ Preview-first modification pattern
- ✅ MCP bridge for frontend-backend communication
- ✅ Transaction pattern for multi-write operations
- ✅ Monotonic invariant validation

#### Feature-Specific (Context-Requirements-Evolution Only)
- ❌ Impulse resolution logic (specific to activity system)
- ❌ Template schema structure (feature-specific)
- ❌ Thompson Sampling parameters (specific to variant selection)
- ❌ Improvement gradient calculation (specific to evolution trigger)
- ❌ Context requirement priority levels (domain-specific)

---

## Activity Template Opportunity

### Recommended: Create "Correlation Analysis" Activity Template

**Template Name:** `analyze-feature-effectiveness`

**Purpose:** Generic correlation analysis for any feature vs. outcome

**Variables:**
- `entity_type` - What type of entity to analyze (e.g., "impulse", "tool", "agent")
- `outcome_metric` - What metric to optimize (e.g., "success_rate", "duration", "cost")
- `min_sample_size` - Minimum samples required (default: 20)
- `correlation_threshold` - Threshold for recommendations (default: 0.2)

**Tasks:**
1. Query execution history for entity
2. Partition data by feature presence
3. Calculate success rates with/without feature
4. Calculate correlation (lift metric)
5. Generate recommendations (ADD/REMOVE/NEUTRAL)
6. Return analysis report

**Reusable for:**
- Impulse effectiveness (this feature)
- Tool effectiveness (which tools improve success?)
- Subagent effectiveness (which agents perform best?)
- Context type effectiveness (files vs. annotations)
- Validation rule effectiveness (which validations prevent failures?)

---

## Summary

### Data Flow Status
**Current:** 40% implemented (execution tracking, metrics aggregation)  
**Missing:** 60% (impulse persistence, correlation analysis, template evolution)

### Critical Blockers
1. ❌ Impulse data not persisted → cannot analyze patterns
2. ❌ Correlation analysis service missing → cannot identify effective impulses
3. ❌ Template evolution service missing → cannot close learning loop

### Data Integrity Issues
1. ⚠️ Race condition in metrics aggregation → corrupt success_rate
2. ⚠️ No transactions → partial failures corrupt data
3. ⚠️ Monotonic invariant only logs errors → doesn't prevent corruption

### Recommended Implementation Order
1. **Phase 1:** Add impulse persistence (unblock data collection)
2. **Phase 2:** Fix race condition and transactions (prevent corruption)
3. **Phase 3:** Implement correlation analysis (enable insights)
4. **Phase 4:** Implement template evolution (close learning loop)

### Reusable Patterns Identified
- ✅ Incremental aggregation → Extract to utility class
- ✅ Correlation analysis → Extract to utility class
- ✅ Preview-first modification → Extract to base class
- ⚠️ Dual-write pattern → Useful for migrations only

### Estimated Effort
- **Impulse persistence:** 1-2 days (schema + backend changes)
- **Fix data integrity:** 2-3 days (transactions + atomic updates)
- **Correlation analysis:** 3-5 days (service + REST API + tests)
- **Template evolution:** 3-5 days (service + REST API + preview/apply logic)
- **Total:** 9-15 days for complete implementation

---

**Document Status:** COMPLETE  
**Next Steps:** Implement Phase 1 (impulse persistence) to unblock feature
