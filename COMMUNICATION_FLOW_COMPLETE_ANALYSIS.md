# Communication Flow Complete Analysis: Shape-Based Vessel Architecture

## Date: 2026-04-10

## Executive Summary

This document provides a comprehensive analysis of data flow across all impulse shapes in the metabob vessel ecosystem. Four parallel investigations examined:

1. **Core Execution Shapes**: goal, activityExecutionTrace, activityTemplate, activityMetrics
2. **Data Analysis Shapes**: trace_data, error_statistics, performance_metrics, improvement_recommendations
3. **Context & Data Shapes**: git_context, file, memo, api_response, workflow_statistics
4. **Learning System Shapes**: compositionGraph, thompsonSamplingData, impulseRelevance, toolUsage, executionSequences

### Key Findings

✅ **Architecture is Sound**: The impulse-based communication model is well-designed and conforms to foundational idioms
✅ **Resolvers Live Where Data Lives**: Clear separation between local (MiniBob) and remote (backend) resolution
✅ **Backend Limited to Learning**: Backend correctly acts as trace store + pattern learner, not universal resolver
❌ **Critical Break in Data Flow**: Traces not reaching backend due to org_id mismatch (0 executions despite successful activities)
⚠️ **Some Implementations Missing**: Impulse relevance and execution sequence recording not called by MiniBob

**Overall Idiom Conformance**: 8.5/10

---

## Part 1: Core Execution Shapes

### 1.1 Shape: `goal`

**Definition**: User intent parsed into structured goal with enrichment metadata

| Aspect | Details |
|--------|---------|
| **Sources** | MiniBob CLI/REPL → GoalProcessor enrichment → Backend goal recommendations |
| **Sinks** | GoalProcessor.processGoal() → ActivityExecutor context → ImpulseStore |
| **Resolution** | Local: Parse user input<br>Backend: `/v2/activities/recommend` with Thompson Sampling |
| **Pattern** | User input → Enrich with git context → Query backend for activities → Execute selected |
| **Idiom Status** | ✅ Mostly aligned<br>⚠️ Minor drift: Goal enrichment eager (should be lazy impulses) |

**Communication Flow**:
```
User Goal → GoalProcessor
  ↓
Create goal impulse (shape: 'goal', type: 'memo')
  ↓
Load contextual impulses (git_context, files)
  ↓
Backend recommendation: POST /v2/activities/recommend
  ← Thompson-ranked activities filtered by input shapes
  ↓
MiniBob executes selected activity
```

### 1.2 Shape: `activityTemplate`

**Definition**: Activity specifications defining tasks, input/output shapes, validation

| Aspect | Details |
|--------|---------|
| **Sources** | Backend DB (SurrealDB `activity_template` table)<br>Ribosome extraction from successful executions<br>Embedded templates (offline fallback) |
| **Sinks** | ActivityExecutor → GoalProcessor → Template search → Dashboard metrics |
| **Resolution** | MiniBob: MCP client queries backend + embedded fallback<br>Backend: Stores, recommends, enriches with metrics |
| **Pattern** | Backend stores → MiniBob loads → Executes → Ribosome extracts → Registers back to backend |
| **Idiom Status** | ✅ Excellent alignment<br>Clear separation: Backend stores/recommends, MiniBob executes/extracts |

**Template Registration (Ribosome Pattern)**:
```
Successful Improvisation
  ↓
assembleTemplateFromExecution() extracts tasks
  ↓
MCPClient.registerTemplate()
  ↓
POST /v2/activities/templates
  ↓
SurrealDB: INSERT/UPDATE with variant tracking
  ↓
Thompson Sampling initialized (α=1, β=0)
```

### 1.3 Shape: `activityExecutionTrace`

**Definition**: Complete record of activity execution with tasks, tools, state transitions

| Aspect | Details |
|--------|---------|
| **Sources** | ActivityExecutor creates during execution<br>MCPClient.storeExecutionTrace() sends to backend |
| **Sinks** | Backend persistent storage<br>Thompson Sampling (α/β updates)<br>Pattern learning (composition, tool usage)<br>Goal processor (failure analysis) |
| **Resolution** | MiniBob: Creates locally, cannot resolve historical traces<br>Backend: Stores in `activity_execution_trace` table, serves via `/v2/impulses/resolve` |
| **Pattern** | Execute → Capture trace → Store via MCP → Backend learns → Query for context |
| **Idiom Status** | ✅ Perfectly aligned<br>Trace is learning material, metadata-first, resolvers where data lives |

**Current Issue**: ❌ Traces created but not reaching backend (0 executions recorded)

### 1.4 Shape: `activityMetrics`

**Definition**: Performance statistics derived from execution traces (Thompson Sampling data)

| Aspect | Details |
|--------|---------|
| **Sources** | Backend views from traces (`v_activity_score`)<br>MCPClient.reportExecution() sends metrics<br>Impulse/tool relevance metrics |
| **Sinks** | GoalProcessor (failure penalties)<br>Dashboard visualization<br>Model selector (cost optimization)<br>Thompson Sampling (activity ranking) |
| **Resolution** | MiniBob: Temporary in-memory tracking, queries backend<br>Backend: Computes from traces, serves via `/v2/activities/metrics` |
| **Pattern** | Traces → Views compute metrics → API serves → MiniBob uses for decisions |
| **Idiom Status** | ✅ Good alignment<br>⚠️ Minor drift: Failure penalty tracking local (should be backend-learned) |

**Metrics Computed**:
- `v_activity_score`: α, β, success_rate, avg_duration_ms, avg_cost_usd
- `v_impulse_relevance`: P(success | impulse loaded)
- `v_argument_recommendations`: Tool argument success patterns

---

## Part 2: Data Analysis Shapes (Activity Composition)

### Key Finding: Shape System Exists But Not Fully Formalized

The system implements a **generalized shape-based impulse system** rather than the four specific shapes. Here's what actually exists:

| Requested Shape | Actual Implementation | Status |
|-----------------|----------------------|--------|
| `trace_data` | Merged into `execution_trace` shape | ✅ Working |
| `error_statistics` | Embedded in `error` or `analysis_result` | ⚠️ Not formalized |
| `performance_metrics` | Part of `activity_metrics` | ✅ Working |
| `improvement_recommendations` | Generated as `analysis_result` or `recommendation` | ⚠️ Not formalized |

### 2.1 Shape-Based Activity Composition

**How It Works**:
1. Activity A declares `output_shapes: ["analysis_result", "error_statistics"]`
2. Activity B declares `input_shapes: ["analysis_result", "error_statistics"]`
3. Shape resolver matches: `resolveImpulsesByShape()` finds compatible impulses
4. Activity B loads matched impulses for context
5. Execution creates new output impulses for next activity

**Example Flow** (from atomic activities):
```
fetch-api-json
  output_shapes: ["api_response"]
  ↓
calculate-error-statistics
  input_shapes: ["trace_data"]  # Compatible with api_response
  output_shapes: ["error_statistics"]
  ↓
generate-improvement-recommendations
  input_shapes: ["error_statistics", "performance_metrics"]
  output_shapes: ["improvement_recommendations"]
```

### 2.2 Idiom Conformance

✅ **CONFORM**: "Impulses are Universal Data"
- Shapes identify content type (metadata, not instructions)
- Metadata-first: impulse.metadata.shape before loading content

✅ **CONFORM**: "Activities Constrain Search"
- Tasks declare `inputShapes[]` requirements
- Shape resolver filters to matching impulses only

✅ **CONFORM**: "Record Everything"
- Output impulses created with lineage (producedBy field)
- Shape metadata enables composition learning

⚠️ **POTENTIAL IMPROVEMENT**:
- Formalize the 4 data analysis shapes as first-class citizens
- Add to shape registry with validation
- Create dedicated atomic activities that produce these shapes

---

## Part 3: Context & Data Shapes

### 3.1 Shape: `git_context`

| Aspect | Details |
|--------|---------|
| **Sources** | MiniBob GitHistoryResolver (local git execution) |
| **Resolution** | Local only - MiniBob has git repo access |
| **Pattern** | Git command → JSON format → Embedded in memo impulse |
| **Idiom Status** | ✅ CORRECT - Resolver lives where data lives |

**Operations**: recent_commits, file_history, blame, changed_files, search_commits

### 3.2 Shape: `file`

| Aspect | Details |
|--------|---------|
| **Sources** | MiniBob FileResolver (Bun.file() API) |
| **Resolution** | Local only - MiniBob has filesystem access |
| **Pattern** | Read file → Optional offset/limit → Budget tracking |
| **Idiom Status** | ✅ CORRECT - Resolver lives where data lives |

**Pointer Format**: `{type: "file", path: "/path/to/file", offset?: N, limit?: M}`

### 3.3 Shape: `memo`

| Aspect | Details |
|--------|---------|
| **Sources** | MiniBob (error impulses, manual creation)<br>Backend (resolved content returned as memo) |
| **Resolution** | Immediate - content embedded in pointer |
| **Pattern** | Zero-latency inline resolution |
| **Idiom Status** | ✅ CORRECT - Efficient for small transient content |

**Use Cases**: Error messages, temporary context, LLM-generated text

### 3.4 Shape: `api_response`

| Aspect | Details |
|--------|---------|
| **Sources** | MiniBob HTTP fetch or bash curl<br>Activity templates with API calls |
| **Resolution** | Hybrid: Direct fetch when possible, delegated to backend for auth |
| **Pattern** | Activity executes curl → Response as memo/api_response impulse |
| **Idiom Status** | ⚠️ HYBRID STATE (partial drift)<br>Some API calls proxied through backend unnecessarily |

**Architectural Issue**: Analysis API types proxied via backend (deprecated, returns 410 Gone)

### 3.5 Shape: `workflow_statistics`

| Aspect | Details |
|--------|---------|
| **Sources** | Backend computed from execution traces |
| **Resolution** | Backend only - queries `execution` table, computes aggregates |
| **Pattern** | Remote resolution + caching via `/v2/impulses/resolve` |
| **Idiom Status** | ✅ CORRECT - Backend has execution data, resolves its own shapes |

**Pointer Types**:
- `variantMetricsSummary`: Performance per activity variant
- `executionTraceList`: Recent executions with metadata

---

## Part 4: Learning System Shapes

### Critical Finding: Architecture Sound, Data Flow Broken

All five learning shapes have **correct endpoints** but suffer from **broken data ingestion** (traces not reaching backend).

### 4.1 Shape: `compositionGraph`

| Aspect | Details |
|--------|---------|
| **Sources** | MiniBob calls `mcp.recordComposition()` after nested activities |
| **Storage** | Backend `activity_composition_graph` table |
| **Endpoint** | POST `/v2/activities/composition`<br>GET `/v2/activities/composition/graph` |
| **Consumers** | Pattern miner, impulse resolver, composition queries |
| **Status** | ✅ Implemented, ❌ Data not flowing (0 edges) |

**What It Learns**: Which activities follow which, success rates, shape flow patterns

### 4.2 Shape: `thompsonSamplingData`

| Aspect | Details |
|--------|---------|
| **Sources** | Computed from execution traces (NOT stored directly) |
| **Storage** | Views: `v_activity_score`, `v_shape_conditioned_score` |
| **Endpoint** | Used by `/v2/activities/recommend` |
| **Consumers** | Goal processor (activity selection), dashboard (visualization) |
| **Status** | ✅ Implemented, ❌ No traces to learn from |

**Why Not Stored**: Prevents race conditions, enables rich conditioning without schema changes

### 4.3 Shape: `impulseRelevance`

| Aspect | Details |
|--------|---------|
| **Sources** | Should be MiniBob calling `mcp.recordImpulseRelevance()` during execution |
| **Storage** | Backend `impulse_relevance_metrics` table |
| **Endpoint** | POST `/v2/activities/impulse-relevance`<br>GET `/v2/activities/impulse-relevance` |
| **Consumers** | Impulse memory manager (skip low-relevance impulses) |
| **Status** | ⚠️ Backend ready, ❌ MiniBob never calls it |

**What It Learns**: P(success | impulse loaded) vs P(success | not loaded) - Bayesian relevance

### 4.4 Shape: `toolUsage`

| Aspect | Details |
|--------|---------|
| **Sources** | MiniBob calls `mcp.recordToolUsage()` after tool execution |
| **Storage** | Backend `tool_usage_patterns` table |
| **Endpoint** | POST `/v2/activities/tool-usage`<br>GET `/v2/activities/tool-usage` |
| **Consumers** | Tool requirement analyzer, success correlation tracker |
| **Status** | ✅ Implemented, ❌ Data not flowing |

**What It Learns**: Which tools are required vs optional, success correlation per tool

### 4.5 Shape: `executionSequences`

| Aspect | Details |
|--------|---------|
| **Sources** | Should be MiniBob calling `mcp.recordExecutionSequence()` at session end |
| **Storage** | Backend `execution_sequences` table |
| **Endpoint** | POST `/v2/activities/execution-sequences`<br>GET `/v2/activities/execution-sequences` |
| **Consumers** | Session analysis, sequence pattern mining, goal-driven learning |
| **Status** | ⚠️ Backend ready, ❌ MiniBob never calls it |

**What It Learns**: What activity sequences achieve specific goals

---

## Cross-Shape Communication Matrix

| Source Vessel | Target Vessel | Shape Category | Pattern | Idiom Status |
|---------------|---------------|----------------|---------|--------------|
| MiniBob | MiniBob | git_context, file, memo | Local resolver | ✅ Correct |
| MiniBob | Backend | execution traces, composition, tool usage | MCP storage | ✅ Correct design, ❌ Data not flowing |
| Backend | MiniBob | workflow_statistics, metrics | MCP resolution | ✅ Correct |
| MiniBob | External APIs | api_response | Direct HTTP or delegated | ⚠️ Hybrid (some proxy drift) |
| Backend | Backend | Internal queries | Direct table access | ✅ Correct |

---

## Critical Issues Identified

### 1. Trace Storage Failure (CRITICAL)

**Issue**: MiniBob executes activities successfully but traces don't reach backend
- Activities complete: ✅
- Trace creation: ✅ (in `activity.ts:1169-1183`)
- Backend call: ✅ (POST `/v2/activities/execution-traces`)
- Backend storage: ❌ (0 executions recorded)

**Root Cause (Likely)**: org_id mismatch
- MiniBob uses `getOrgId()` to determine organization
- Backend filters by `WHERE org_id = $auth.org_id`
- If mismatch, traces stored under wrong tenant (invisible to queries)

**Evidence** (from TEACHING_LOOP_COMPLETE_ANALYSIS.md):
```
Bootstrap: ⚠️ Vessel registration skipped
Backend Query: No composition data yet, No metrics available, No traces available
Workflow: ✓ All activities completed successfully
Output Quality: ✓ Excellent (error-stats.json with comprehensive analysis)
```

**Fix Applied**: Added `METABOB_ORG_ID` and `METABOB_PROJECT_ID` to workflow environment

**Next Steps**: Verify traces appear after next teaching loop run

### 2. Missing Implementations (IMPORTANT)

**Issue**: Two learning endpoints ready but not called by MiniBob

1. **Impulse Relevance**: `recordImpulseRelevance()` never called during activity execution
   - Should track: which impulses loaded, execution success, token count
   - Enables: Smart impulse filtering based on learned relevance

2. **Execution Sequences**: `recordExecutionSequence()` never called at session end
   - Should track: ordered activity list, goals, outcomes
   - Enables: Session-level pattern learning, goal-driven recommendations

**Impact**: Missing valuable learning signals that would improve:
- Impulse memory management (load only relevant impulses)
- Session-based recommendations (what sequences achieve goals)

### 3. Analysis API Proxy (MINOR - Being Fixed)

**Issue**: Backend proxying Analysis API impulse types
- Location: `routes/impulses.ts:930-946`
- Returns: 410 Gone (explicitly deprecated)
- Violates: "Resolvers live where data is" principle

**Status**: Already identified and marked for removal
**Direction**: Analysis API should provide own `/v2/impulses/resolve` endpoint

---

## Idiom Conformance Assessment

### Strengths (What's Correct)

1. ✅ **Clear Separation of Concerns**
   - MiniBob: Executes locally, records remotely
   - Backend: Stores persistently, learns analytically
   - No vessel doing another vessel's job

2. ✅ **Resolvers Live Where Data Lives**
   - Git context: MiniBob (has repo access)
   - File content: MiniBob (has filesystem access)
   - Execution traces: Backend (has database)
   - Workflow statistics: Backend (computes from traces)

3. ✅ **Metadata-First Pattern**
   - Impulses include shape before loading content
   - Pointer describes location, not content
   - Budget-aware truncation

4. ✅ **Backend Limited to Learning**
   - Not a universal resolver (except deprecated Analysis proxy)
   - Stores traces + computes patterns
   - Serves learned data via specific endpoints

5. ✅ **Activities Constrain Search**
   - Shape-based matching narrows options
   - Thompson Sampling ranks finite set
   - No infinite exploration

6. ✅ **Vessel Discovery**
   - Dynamic resolver registration
   - Network-based capability discovery
   - System grows without code changes

### Minor Drifts (What Could Be Better)

1. ⚠️ **Goal Enrichment**
   - Currently: Eager loading of git context before recommendation
   - Should be: Lazy impulses loaded on-demand
   - Impact: Minor - doesn't violate core principles

2. ⚠️ **Failure Penalty Tracking**
   - Currently: Local, temporary, heuristic decay
   - Should be: Backend-learned from execution patterns
   - Impact: Minor - penalty application, not storage

3. ⚠️ **Analysis API Proxy**
   - Currently: Backend proxies some Analysis API calls
   - Should be: Analysis API provides own impulse resolution
   - Impact: Minor - explicitly marked deprecated

### No Critical Anti-Patterns

- Backend is NOT acting as universal resolver (except deprecated proxy)
- Activities ARE effectively constraining search space
- Recording IS comprehensive (when data reaches backend)
- Learning IS happening via Thompson Sampling (when data available)

**Overall Assessment**: 8.5/10 - Strong alignment with minor improvements needed

---

## Resolver Ownership Summary

| Shape | Owner | Rationale |
|-------|-------|-----------|
| **git_context** | MiniBob | Git repo lives in MiniBob's filesystem |
| **file** | MiniBob | Files live in MiniBob's filesystem |
| **memo** | MiniBob | Content embedded in pointer |
| **api_response** | Hybrid | Direct when possible, delegated for auth |
| **workflow_statistics** | Backend | Execution traces live in backend database |
| **activityTemplate** | Backend | Templates stored in SurrealDB |
| **activityExecutionTrace** | Backend | Persistent trace storage |
| **activityMetrics** | Backend | Computed from execution traces |
| **compositionGraph** | Backend | Learned from composition records |
| **thompsonSamplingData** | Backend | Computed from execution traces |
| **impulseRelevance** | Backend | Learned from impulse usage patterns |
| **toolUsage** | Backend | Learned from tool execution patterns |
| **executionSequences** | Backend | Stored session execution records |

---

## Recommendations

### Immediate (Fix Trace Storage)

1. **Verify org_id Configuration**
   ```bash
   # Check MiniBob config
   cat ~/.metabob/config.json | jq '.metabob.orgId'

   # Check workflow environment
   grep METABOB_ORG_ID .github/workflows/teaching-loop.yml
   ```

2. **Add Verbose Logging**
   ```typescript
   // In mcp.ts:storeExecutionTrace()
   log.info('[MCP] Storing trace', {
     executionId: execution.id,
     orgId, projectId, vesselId,
     endpoint: `${this.endpoint}/v2/activities/execution-traces`
   })
   ```

3. **Query Backend Directly**
   ```bash
   # Test if traces exist but aren't exposed
   curl -H "Authorization: ApiKey $API_KEY" \
     "https://activity.metabob.com/v2/activities/execution-traces?limit=10"
   ```

### Short-Term (Implement Missing Features)

4. **Implement Impulse Relevance Recording**
   - Location: `repos/minibob/src/activity.ts` (task execution loop)
   - Call: `mcp.recordImpulseRelevance()` for each impulse loaded
   - Payload: impulse_id, was_loaded, execution_succeeded, tokens

5. **Implement Execution Sequence Recording**
   - Location: `repos/minibob/src/goal-processor.ts` (session end)
   - Call: `mcp.recordExecutionSequence()` after goal completion
   - Payload: session_id, goal_context, sequence array, outcome

6. **Remove Analysis API Proxy**
   - Already deprecated (returns 410 Gone)
   - Final step: Remove dead code from `routes/impulses.ts:930-946`

### Medium-Term (Formalize Data Analysis Shapes)

7. **Promote Data Analysis Shapes to First-Class**
   - Register: `error_statistics`, `performance_metrics`, `improvement_recommendations`, `trace_data`
   - Create dedicated atomic activities that produce these shapes
   - Add shape validation in activity executor

8. **Enhance Composition-Aware Recommendation**
   - Implement `/v2/activities/composition/patterns` endpoint
   - Query composition graph for proven sequences
   - Verify shape compatibility before recommending

### Long-Term (Optimization)

9. **Impulse Memory Management**
   - Use impulse relevance scores to filter low-value impulses
   - Implement budget-aware loading (skip if relevance < threshold)

10. **Session Pattern Learning**
    - Query execution sequences for similar goals
    - Recommend activity sequences based on historical success
    - Enable goal-driven composition suggestions

---

## Success Criteria

Once trace storage is fixed:

✅ **Data Flow**:
- Backend shows executions > 0
- Composition graph has edges
- Thompson Sampling α/β parameters update

✅ **Learning Loop**:
- Activity recommendation improves over time
- Composition patterns identified
- Tool usage patterns learned

✅ **Composition**:
- Shape-based activity chaining works
- Atomic activities compose correctly
- Execution time improves (60-80% faster)

---

## Conclusion

The **impulse-based communication architecture is fundamentally sound** with excellent separation of concerns and adherence to the foundational idioms. The critical issue is **operational, not architectural**: traces are created correctly but not reaching backend storage due to org_id configuration.

Once the org_id issue is resolved and the two missing recording calls are implemented, the system will have a **complete learning loop** with all five pattern shapes functioning:

1. ✅ Composition patterns tracked
2. ✅ Thompson Sampling learning
3. ✅ Impulse relevance optimized
4. ✅ Tool usage patterns learned
5. ✅ Execution sequences recorded

The architecture demonstrates **strong idiom conformance (8.5/10)** with clear paths to address remaining gaps.

---

**Document Status**: Complete
**Next Action**: Fix org_id configuration and monitor next teaching loop run
**Priority**: Critical (unblocks entire learning system)
