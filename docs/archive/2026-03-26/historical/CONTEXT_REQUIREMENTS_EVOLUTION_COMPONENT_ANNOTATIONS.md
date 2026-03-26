# Component Annotations: Context Requirements Evolution Data Flow

**Status:** Feature NOT IMPLEMENTED - This document annotates the existing infrastructure and missing components needed to enable context-requirements-evolution.

**Purpose:** Documenting the WHY behind each component in the data flow to enable automatic template optimization based on impulse effectiveness analysis.

**Date:** 2026-02-23  
**Scope:** Analyzing impulse usage patterns across 20+ executions, calculating correlation between impulse presence and task success, automatically updating template.contextRequirements

---

## Critical Component 1: Impulse Loading and Usage Tracking (Frontend)

**Component:** `loadAndFormatImpulses()` in `repos/metabob-opencode/packages/opencode/src/session/task-execution-shared.ts:70-153`

**Role in Flow:** Entry point for impulse resolution - tracks which impulses are loaded during activity execution

### Data Transformation
```
Input:  impulseIds: string[]
        activityImpulses: Record<string, Impulse.Schema>

Output: Formatted markdown string with impulse content
        Side effect: Mutates activityImpulses with updated usageStats
```

### Business Logic
**What it enforces:** Monotonic increase of impulse load count (invariant: loadCount must always increase)

**Why it exists:** 
- Activities need context to complete tasks successfully
- Different impulses have different value (some help, some add noise)
- Need to track which impulses are actually loaded to analyze their effectiveness
- Usage statistics enable learning: which impulses correlate with success?

**Design Decision: In-Memory Tracking**
- **Chosen approach:** Store `usageStats` in session state (ephemeral)
- **Rationale:** Fast access during execution, no I/O overhead
- **Trade-off:** Data lost after session ends → cannot analyze patterns across executions
- **For context-requirements-evolution:** This is the BLOCKER - need to persist to backend

### Constraints
- **Monotonic invariant:** `loadCount` must always increase (detects double-counting bugs)
- **Session-scoped:** Data isolated to single activity execution
- **Memory-only:** No persistence layer
- **Parallel loading:** All impulses loaded concurrently for performance

### Required Extension for Context-Requirements-Evolution
```typescript
// AFTER loading impulses, send usage data to backend
const impulseUsageData = loadedImpulses.map(impulse => ({
  id: impulse.id,
  type: impulse.type,
  tokens_loaded: impulse.tokenCount,
  cost_usd: Token.cost(impulse.tokenCount)
}))

await MetabobCLI.recordImpulseUsage({
  executionId: activityId,
  impulses: impulseUsageData
})
```

**Why this extension:** Backend needs impulse data to calculate correlation with execution success.

---

## Critical Component 2: Execution Metrics Recording (Backend Entry Point)

**Component:** `record_execution()` endpoint in `repos/metabob-rpc-api/server/routes/learning_loop.py:87-174`

**Role in Flow:** Backend entry point - receives execution results from frontend via MCP

### Data Transformation
```
Input:  ExecutionRequest (HTTP POST body)
        {
          activity_id: str,
          template_id: str,
          duration_ms: int,
          success: bool,
          tokens_input/output/cache: int,
          cost_usd: float,
          error_message?: str
        }

Output: ExecutionResponse
        {
          success: bool,
          execution_id: str,
          metrics_updated: bool
        }

Side Effects: 
  1. Insert execution record to activity_execution table
  2. Update aggregated metrics in template_metrics table
  3. Record failure pattern if execution failed
```

### Business Logic
**What it enforces:**
- Historical record of every execution (audit trail)
- Aggregated metrics for template performance (success_rate, avg_cost, avg_duration)
- Failure pattern tracking for debugging

**Why it exists:**
- Enable Thompson Sampling for template variant selection
- Provide data for template evolution (identify templates needing improvement)
- Track template performance over time
- Enable learning from failures

**Design Decision: Three Separate Writes (NO TRANSACTION)**
- **Chosen approach:** Sequential writes without transaction
- **Rationale:** Simplicity, SurrealDB transactions not implemented
- **Trade-off:** Risk of partial failure (execution recorded but metrics not updated)
- **Problem:** Data inconsistency possible
- **For context-requirements-evolution:** Will compound - 4+ writes without transaction

### Constraints
- **No transaction support:** Partial failures possible
- **Race condition:** Concurrent executions can corrupt metrics (see Component 3)
- **No impulse data:** Schema missing `impulses[]` field → DATA LOSS

### Critical Issue: Missing Impulse Field
```python
class ExecutionRequest(BaseModel):
    # ... existing fields ...
    # ❌ MISSING: impulses: List[ImpulseUsage] = Field(default=[])
```

**Impact:** Frontend sends impulses via MCP, but backend ignores them → context-requirements-evolution BLOCKED

### Required Extension for Context-Requirements-Evolution
```python
class ImpulseUsage(BaseModel):
    id: str
    type: str  # 'file', 'annotation', 'cochange', 'memo'
    tokens_loaded: int
    cost_usd: float

class ExecutionRequest(BaseModel):
    # ... existing fields ...
    impulses: List[ImpulseUsage] = Field(default=[])

@router.post("/executions")
async def record_execution(request: ExecutionRequest):
    try:
        # BEGIN TRANSACTION (fix race condition)
        execution = insert_execution(...)
        
        # NEW: Insert impulse records
        for impulse in request.impulses:
            insert_impulse_execution(
                execution_id=execution["id"],
                impulse_id=impulse.id,
                impulse_type=impulse.type,
                tokens_loaded=impulse.tokens_loaded,
                cost_usd=impulse.cost_usd
            )
        
        update_metrics_after_execution(...)
        
        if not request.success:
            record_failure(...)
        
        # COMMIT TRANSACTION
    except Exception:
        # ROLLBACK TRANSACTION
        raise
```

**Why this extension:** Impulse data persistence is foundation for correlation analysis.

---

## Critical Component 3: Metrics Aggregation (Business Logic Core)

**Component:** `update_metrics_after_execution()` in `repos/metabob-rpc-api/server/db/operations/template_metrics.py:99-214`

**Role in Flow:** Main business logic - calculates template performance metrics using incremental aggregation

### Data Transformation
```
Input:  template_id: str
        success: bool
        duration_ms: int
        cost_usd: float
        tokens_input/output/cache: int

Output: Updated template_metrics record
        {
          total_executions: int,
          successful_executions: int,
          failed_executions: int,
          success_rate: float,
          avg_duration_ms: int,
          avg_cost_usd: float,
          avg_tokens_total: int,
          thompson_alpha: float,
          thompson_beta: float,
          improvement_gradient: float
        }
```

### Business Logic
**What it enforces:**
- **Incremental aggregation:** Avoid scanning all execution records
- **Thompson Sampling:** Update Beta distribution parameters (alpha = successes + 1, beta = failures + 1)
- **Improvement gradient:** Composite score for evolution trigger (success_rate * min(1.0, executions/10))

**Why it exists:**
- **Performance:** Incremental mean formula: `new_avg = (old_avg * old_count + new_value) / new_count`
- **Variant selection:** Thompson Sampling balances exploration vs. exploitation
- **Evolution trigger:** `improvement_gradient < 0.7` → template needs improvement
- **Cost tracking:** Average cost for budgeting and optimization

**Design Decision: Read-Modify-Write Pattern (NO LOCKING)**
- **Chosen approach:** Read current metrics, calculate new values, write back
- **Rationale:** Simplicity, SurrealDB locking not used
- **Trade-off:** RACE CONDITION - concurrent executions corrupt aggregates
- **Problem:** Two simultaneous completions read same `n`, both write `n+1` → lost update

### Constraints
- **Race condition:** No atomic update → concurrent writes corrupt data
- **Create-if-not-exists:** Template metrics auto-created on first execution
- **No validation:** Template ID not validated before creating metrics → orphaned records

### Critical Issue: Race Condition
```python
# Thread A reads: n = 5
metrics = get_metrics(template_id)
n = metrics.get("total_executions", 0)  # n = 5
n_new = n + 1  # n_new = 6

# Thread B reads: n = 5 (same value!)
metrics = get_metrics(template_id)
n = metrics.get("total_executions", 0)  # n = 5
n_new = n + 1  # n_new = 6

# Thread A writes: total_executions = 6
db.update(record_id, {"total_executions": 6, ...})

# Thread B writes: total_executions = 6 (should be 7!)
db.update(record_id, {"total_executions": 6, ...})

# Result: Lost update - executed 2 times but counted as 1
```

**Impact on context-requirements-evolution:** Correlation analysis uses corrupt success_rate → wrong impulses selected

### Required Extension for Context-Requirements-Evolution
```python
# Fix 1: Atomic update (use SurrealDB's increment syntax)
def update_metrics_after_execution_atomic(template_id: str, success: bool, ...):
    db = get_surreal_client()
    
    query = """
    UPDATE template_metrics:{template_id}
    SET 
        total_executions += 1,
        successful_executions += $success_delta,
        avg_duration_ms = (avg_duration_ms * total_executions + $duration_ms) / (total_executions + 1),
        thompson_alpha = successful_executions + 1.0,
        success_rate = successful_executions / total_executions
    """
    
    result = db.query(query, {
        "template_id": template_id,
        "success_delta": 1 if success else 0,
        "duration_ms": duration_ms,
        ...
    })

# Fix 2: Add impulse-level metrics aggregation
def update_impulse_effectiveness_metrics(template_id: str, impulses: List[ImpulseUsage], success: bool):
    """
    For each impulse used in this execution, track:
    - How many times it was used in successful vs. failed executions
    - Calculate correlation: (success_rate_with_impulse - success_rate_without_impulse)
    """
    for impulse in impulses:
        # Atomic increment for impulse metrics
        db.query("""
        UPDATE impulse_effectiveness:{template_id}:{impulse_id}
        SET
            executions_with += 1,
            successes_with += $success_delta,
            success_rate_with = successes_with / executions_with
        """, {
            "template_id": template_id,
            "impulse_id": impulse.id,
            "success_delta": 1 if success else 0
        })
```

**Why this extension:** Impulse-level metrics enable correlation analysis.

---

## Critical Component 4: [MISSING] Impulse Correlation Analysis Service

**Component:** `analyze_impulse_correlation()` in `repos/metabob-rpc-api/server/services/impulse_analytics.py` (DOES NOT EXIST)

**Role in Flow:** Core analytics - calculates correlation between impulse presence and execution success

### Data Transformation
```
Input:  template_id: str
        min_executions: int = 20

Output: ImpulseCorrelationResponse
        {
          template_id: str,
          total_executions: int,
          impulses: [
            {
              impulse_id: str,
              impulse_type: str,
              executions_with: int,
              successes_with: int,
              success_rate_with: float,
              executions_without: int,
              successes_without: int,
              success_rate_without: float,
              correlation: float,  # success_rate_with - success_rate_without
              recommendation: "ADD" | "REMOVE" | "NEUTRAL"
            }
          ]
        }
```

### Business Logic
**What it enforces:**
- **Minimum sample size:** Require 20+ executions to avoid spurious correlations
- **Statistical correlation:** Calculate lift in success rate when impulse present
- **Recommendation thresholds:**
  - `correlation > 0.2` → "ADD" (impulse helps significantly)
  - `correlation < -0.1` → "REMOVE" (impulse hurts performance)
  - Otherwise → "NEUTRAL" (no clear effect)

**Why it exists:**
- **Data-driven optimization:** Replace manual template tuning with statistical analysis
- **Identify high-value context:** Which impulses actually help vs. add noise
- **Reduce context bloat:** Remove low-value impulses to save tokens/cost
- **Continuous improvement:** Templates get smarter over time

**Design Decision: Correlation-Based Ranking**
- **Chosen approach:** Simple difference in success rates (lift metric)
- **Rationale:** Easy to understand, no complex statistics needed
- **Trade-off:** Doesn't account for confounding variables (maybe successful executions just use more impulses overall)
- **Alternative considered:** Chi-squared test for statistical significance
- **Why not chosen:** Too complex for MVP, lift metric is actionable enough

### Constraints
- **Minimum sample size:** 20+ executions required (configurable)
- **Per-template analysis:** Can't pool data across templates (different tasks)
- **Assumes independence:** Ignores impulse interactions (impulse A + B might be better than either alone)

### Implementation Requirements
```python
class ImpulseAnalyticsService:
    def analyze_impulse_correlation(
        self, 
        template_id: str, 
        min_executions: int = 20
    ) -> ImpulseCorrelationResponse:
        # 1. Query all executions for this template
        executions = get_executions_by_template(template_id)
        
        if len(executions) < min_executions:
            raise ValueError(f"Insufficient data: {len(executions)} < {min_executions}")
        
        # 2. Get unique impulses used across all executions
        unique_impulses = self._get_unique_impulses(executions)
        
        # 3. For each impulse, calculate correlation
        results = []
        for impulse_id in unique_impulses:
            # Partition executions: with vs. without this impulse
            with_impulse = [e for e in executions if impulse_id in e.impulses]
            without_impulse = [e for e in executions if impulse_id not in e.impulses]
            
            # Calculate success rates
            success_rate_with = sum(1 for e in with_impulse if e.success) / len(with_impulse)
            success_rate_without = sum(1 for e in without_impulse if e.success) / len(without_impulse)
            
            # Calculate correlation (lift)
            correlation = success_rate_with - success_rate_without
            
            # Determine recommendation
            if correlation > 0.2:
                recommendation = "ADD_TO_CONTEXT_REQUIREMENTS"
            elif correlation < -0.1:
                recommendation = "REMOVE_FROM_CONTEXT_REQUIREMENTS"
            else:
                recommendation = "NEUTRAL"
            
            results.append(ImpulseEffectiveness(
                impulse_id=impulse_id,
                impulse_type=self._get_impulse_type(impulse_id),
                executions_with=len(with_impulse),
                successes_with=sum(1 for e in with_impulse if e.success),
                success_rate_with=success_rate_with,
                executions_without=len(without_impulse),
                successes_without=sum(1 for e in without_impulse if e.success),
                success_rate_without=success_rate_without,
                correlation=correlation,
                recommendation=recommendation
            ))
        
        # 4. Sort by correlation (highest first)
        results.sort(key=lambda r: r.correlation, reverse=True)
        
        return ImpulseCorrelationResponse(
            template_id=template_id,
            total_executions=len(executions),
            analysis_date=datetime.utcnow().isoformat(),
            impulses=results
        )
```

**Why this design:** Straightforward correlation analysis provides actionable insights without requiring expertise in statistics.

---

## Critical Component 5: [MISSING] Template Evolution Service (Exit Point)

**Component:** `optimize_context_requirements()` in `repos/metabob-rpc-api/server/services/template_evolution.py` (DOES NOT EXIST)

**Role in Flow:** Exit point - applies correlation analysis results to update template.contextRequirements

### Data Transformation
```
Input:  template_id: str
        correlation_threshold: float = 0.2
        auto_apply: bool = False

Output: UpdateContextRequirementsResponse
        {
          template_id: str,
          preview: bool,
          changes: [
            {
              action: "ADD" | "REMOVE",
              impulse_id: str,
              impulse_type: str,
              correlation: float,
              justification: str
            }
          ],
          updated_template?: ActivityTemplate  # Only if auto_apply=True
        }
```

### Business Logic
**What it enforces:**
- **Safety gate:** Preview mode by default (auto_apply=False)
- **Human approval:** Require explicit confirmation before modifying templates
- **Audit trail:** Track all changes with justification
- **Version control:** Increment template version after changes
- **Rollback capability:** Store template history for undo

**Why it exists:**
- **Close the learning loop:** Data → Analysis → Action
- **Automatic optimization:** Templates improve themselves over time
- **Reduce manual maintenance:** No need to manually tune contextRequirements
- **Prevent degradation:** Remove impulses that hurt performance

**Design Decision: Preview + Auto-Apply Pattern**
- **Chosen approach:** Two-stage process (preview first, then apply)
- **Rationale:** Safety - don't auto-modify templates without review
- **Trade-off:** Extra API call required
- **Alternative considered:** Auto-apply with rollback
- **Why not chosen:** Rollback is complex, preview is safer

### Constraints
- **Idempotency:** Applying same changes twice should be no-op
- **Version conflicts:** Detect if template changed since analysis
- **Minimum correlation threshold:** Don't make changes for weak signals
- **Audit logging:** Record who/what/when/why for governance

### Implementation Requirements
```python
class TemplateEvolutionService:
    def optimize_context_requirements(
        self,
        template_id: str,
        correlation_threshold: float = 0.2,
        auto_apply: bool = False
    ) -> UpdateContextRequirementsResponse:
        # 1. Get correlation analysis
        analysis = impulse_analytics.analyze_correlation(template_id, min_executions=20)
        
        # 2. Get current template
        template = get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")
        
        # 3. Determine changes
        changes = []
        current_requirements = set(cr.identifier for cr in template.contextRequirements)
        
        for impulse in analysis.impulses:
            # Add high-correlation impulses not already in template
            if (impulse.correlation > correlation_threshold and 
                impulse.impulse_id not in current_requirements):
                changes.append(ContextRequirementChange(
                    action="ADD",
                    impulse_id=impulse.impulse_id,
                    impulse_type=impulse.impulse_type,
                    correlation=impulse.correlation,
                    justification=f"High correlation ({impulse.correlation:.2f}) with success. "
                                  f"Success rate with impulse: {impulse.success_rate_with:.1%}, "
                                  f"without: {impulse.success_rate_without:.1%}"
                ))
            
            # Remove negative-correlation impulses currently in template
            elif (impulse.correlation < -correlation_threshold and 
                  impulse.impulse_id in current_requirements):
                changes.append(ContextRequirementChange(
                    action="REMOVE",
                    impulse_id=impulse.impulse_id,
                    impulse_type=impulse.impulse_type,
                    correlation=impulse.correlation,
                    justification=f"Negative correlation ({impulse.correlation:.2f}) with success. "
                                  f"Success rate with impulse: {impulse.success_rate_with:.1%}, "
                                  f"without: {impulse.success_rate_without:.1%}"
                ))
        
        # 4. Preview or apply
        if auto_apply and len(changes) > 0:
            updated_template = self._apply_changes(template_id, changes)
            return UpdateContextRequirementsResponse(
                template_id=template_id,
                preview=False,
                changes=changes,
                updated_template=updated_template
            )
        else:
            # Preview mode
            return UpdateContextRequirementsResponse(
                template_id=template_id,
                preview=True,
                changes=changes,
                updated_template=None
            )
    
    def _apply_changes(self, template_id: str, changes: List[ContextRequirementChange]) -> ActivityTemplate:
        template = get_template(template_id)
        
        for change in changes:
            if change.action == "ADD":
                # Add new context requirement
                template.contextRequirements.append({
                    "type": change.impulse_type,
                    "identifier": change.impulse_id,
                    "priority": "high" if change.correlation > 0.3 else "medium",
                    "added_by": "learning_system",
                    "added_at": datetime.utcnow().isoformat(),
                    "justification": change.justification
                })
            
            elif change.action == "REMOVE":
                # Remove existing context requirement
                template.contextRequirements = [
                    cr for cr in template.contextRequirements 
                    if cr.identifier != change.impulse_id
                ]
        
        # Increment version
        template.version = increment_version(template.version)
        template.updated_at = datetime.utcnow().isoformat()
        
        # Store evolution history
        template.evolution_history.append({
            "date": datetime.utcnow().isoformat(),
            "type": "context_requirements_optimization",
            "changes": [change.dict() for change in changes],
            "analysis_executions": template.metrics.total_executions
        })
        
        # Persist updated template
        update_template(template_id, template)
        
        return template
```

**Why this design:** Two-stage process (preview + apply) ensures human oversight while enabling automation.

---

## Integration Point: MCP Bridge (Frontend ↔ Backend)

**Component:** `TemplateMetricsClient.reportExecution()` in `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:91-150`

**Role in Flow:** Boundary crossing - sends execution results from frontend to backend via MCP

### Data Transformation
```
Input:  ActivityExecutionData (frontend type)
        {
          activity_id: string,
          template_id: string,
          variant_id: string,
          success: boolean,
          duration: number,
          cost: number,
          tokens: { input, output, cache }
        }

Output: MCP tool call "metabob_post_activity_result"
        Dual-write to:
          - Path A: JSON files (legacy)
          - Path B: Redis (Thompson Sampling)
          - Path C: SurrealDB via HTTP (learning loop)
```

### Business Logic
**What it enforces:**
- **Non-blocking:** Metrics reporting failures don't block activity completion
- **Graceful degradation:** If MCP unavailable, activity still completes
- **Dual-write pattern:** Write to multiple backends for redundancy

**Why it exists:**
- **Decouple frontend from backend:** Frontend doesn't know about SurrealDB
- **Protocol abstraction:** MCP provides standard tool interface
- **Resilience:** Multiple write paths provide redundancy

**Design Decision: Dual-Write Pattern**
- **Chosen approach:** Write to JSON + Redis + SurrealDB in parallel
- **Rationale:** Migration strategy (legacy JSON, new SurrealDB)
- **Trade-off:** No consistency guarantees (eventual consistency)
- **Problem:** If one path fails, data diverges

### Constraints
- **Non-blocking:** Uses `Promise.allSettled` (tolerates partial failures)
- **No retry:** Failed writes are logged but not retried
- **No consistency:** Three backends can have different data

### Required Extension for Context-Requirements-Evolution
```typescript
export async function reportExecution(data: ActivityExecutionData): Promise<void> {
  // Existing dual-write...
  const [mcpResult, redisResult] = await Promise.allSettled([mcpPromise, redisPromise])
  
  // NEW: Send impulse data to backend (Path C)
  if (data.impulses && data.impulses.length > 0) {
    const impulsePromise = callMCPTool("metabob_record_impulses", {
      execution_id: data.activity_id,
      template_id: data.template_id,
      impulses: data.impulses.map(imp => ({
        id: imp.id,
        type: imp.type,
        tokens_loaded: imp.tokenCount,
        cost_usd: Token.cost(imp.tokenCount)
      }))
    })
    
    const impulseResult = await impulsePromise
    
    if (!impulseResult || !impulseResult.success) {
      log.warn("Impulse data recording failed", {
        activityId: data.activity_id,
        impulseCount: data.impulses.length
      })
    }
  }
}
```

**Why this extension:** Bridge impulse data from frontend session state to backend persistence.

---

## Summary: Component Annotations Complete

### Annotated Components (5 Critical)

1. ✅ **`loadAndFormatImpulses()`** (Frontend) - Impulse loading and usage tracking
   - **Status:** Exists but incomplete (no persistence)
   - **Extension needed:** Send impulse data to backend after loading

2. ✅ **`record_execution()`** (Backend Entry) - Execution metrics recording
   - **Status:** Exists but missing impulse field
   - **Extension needed:** Add `impulses[]` to schema, insert impulse records

3. ✅ **`update_metrics_after_execution()`** (Business Logic) - Metrics aggregation
   - **Status:** Exists but has race condition
   - **Extension needed:** Fix atomic updates, add impulse-level metrics

4. ❌ **`analyze_impulse_correlation()`** (Analytics Core) - Correlation analysis
   - **Status:** DOES NOT EXIST
   - **Must create:** New service for correlation calculation

5. ❌ **`optimize_context_requirements()`** (Exit Point) - Template evolution
   - **Status:** DOES NOT EXIST
   - **Must create:** New service to apply correlation results

### Integration Point Annotated

6. ✅ **`TemplateMetricsClient.reportExecution()`** (MCP Bridge) - Frontend→Backend
   - **Status:** Exists but doesn't send impulse data
   - **Extension needed:** Add impulse data to MCP call

### Key Insights Documented

**Why Context-Requirements-Evolution is Blocked:**
1. **Data Loss:** Impulse usage tracked in-memory but not persisted → cannot analyze patterns
2. **Schema Gap:** Backend missing `impulses[]` field in ExecutionRequest → frontend data ignored
3. **Missing Analytics:** No correlation analysis service → cannot identify effective impulses
4. **No Automation:** No template evolution service → cannot close learning loop

**Critical Design Decisions:**
- **In-memory tracking:** Fast but ephemeral (needs persistence extension)
- **No transactions:** Simple but risky (race conditions, partial failures)
- **Dual-write pattern:** Redundant but inconsistent (eventual consistency model)
- **Preview-first evolution:** Safe but requires extra step (prevents accidental template corruption)

**Business Constraints:**
- **Minimum 20 executions:** Statistical significance requirement
- **Correlation threshold 0.2:** Practical threshold for "meaningful" effect
- **Human approval required:** Safety gate for auto-modifications
- **Non-blocking metrics:** Don't fail activities if metrics recording fails

### Next Steps

To enable context-requirements-evolution:

1. **Extend existing components** (3 files)
   - Add `impulses[]` to `ExecutionRequest` schema
   - Fix race condition in metrics aggregation
   - Send impulse data via MCP bridge

2. **Create new components** (4 files)
   - `impulse_execution.py` - Database operations for impulse records
   - `impulse_analytics.py` - Correlation analysis service
   - `template_evolution.py` - Template optimization service
   - `impulse_analytics_router.py` - REST endpoints

3. **Add database schema** (SurrealDB)
   - `impulse_execution` table
   - `impulse_effectiveness` table (optional, for incremental metrics)

**All components documented with WHY, not just WHAT.**
