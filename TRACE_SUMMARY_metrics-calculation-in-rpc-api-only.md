# Trace Summary: metrics-calculation-in-rpc-api-only

## Executive Summary

**Status**: ✅ COMPLIANT

All metrics calculations are correctly isolated to metabob-rpc-api backend. OpenCode client is a thin HTTP wrapper with no calculations.

## Specification

**Requirement**: Metrics calculations (success rate, quality score, averaging) must ONLY exist in metabob-rpc-api. metabob-opencode template-metrics-client must be a thin HTTP client with no calculations.

## Data Flow

```
Activity Execution (opencode)
    ↓
TemplateMetricsClient.reportExecution()
    ↓ (single write path)
MCP tool: metabob_post_activity_result
    ↓ (HTTP gateway)
POST {api_base}/v2/activities/templates/{id}/executions
    ↓
Learning Loop REST endpoint (rpc-api)
    ↓
MetricsAggregator.record_execution()
    ↓
MetricsAggregator._update_aggregated_metrics()
    ↓ (CALCULATIONS HAPPEN HERE)
    • success_rate = successes / total
    • avg_cost = total_cost / total
    • avg_duration = total_duration / total
    • avg_tokens = tokens_sum / total
    ↓
Redis: template:{template_id}:metrics
```

## Components Analysis

### ✅ OpenCode Client Components (COMPLIANT)

#### 1. template-metrics-client.ts (repos/metabob-opencode)
- **Lines**: 301 (reasonable for HTTP client)
- **Behavior**: Thin HTTP client, calls MCP tools only
- **Methods**:
  - `reportExecution()` - Single write path via MCP
  - `getTemplateMetrics()` - Deprecated, warns to use RPC API
  - `getRecommendation()` - HTTP call via MCP
  - `promoteTemplate()` - HTTP call via MCP
- **Evidence**: No division, multiplication, or Math.* calls
- **Gap**: None - COMPLIANT

#### 2. template-quality-score.ts (repos/metabob-opencode)
- **Lines**: 53 (stub)
- **Previous Lines**: 375 (removed)
- **Behavior**: Deprecated stub that throws error
- **Error Message**: "Quality score calculations have been moved to metabob-rpc-api. Use rpc-api endpoint: GET /v2/activities/templates/{id}/quality-score. OpenCode is now a thin client - calculations belong in the backend."
- **Evidence**: @deprecated markers, throws error, no calculations
- **Gap**: None - COMPLIANT

### ✅ MCP Gateway (COMPLIANT)

#### 3. metabob_post_activity_result (repos/metabob-cli)
- **Location**: `activity_template_tools.py:256`
- **Behavior**: Pure HTTP forwarding to rpc-api
- **Endpoint**: `POST {api_base}/v2/activities/templates/{template_id}/executions`
- **Evidence**: Builds ExecutionRequest payload, no calculations
- **Gap**: None - COMPLIANT

### ✅ RPC API Backend (COMPLIANT - Correct Location)

#### 4. Activity Metrics REST Routes
- **Location**: `repos/metabob-rpc-api/server/routes/activity_metrics_router.py`
- **Endpoints**:
  - `POST /api/activity-execution` - Record execution
  - `GET /api/template/{id}/metrics` - Get aggregated metrics
  - `GET /api/template/{id}/recommendation` - A/B testing recommendation
  - `POST /api/template/promote` - Promote candidate
- **Behavior**: Delegates to MetricsAggregator and PromotionEngine services
- **Evidence**: No inline calculations, proper service layer delegation
- **Gap**: None - COMPLIANT

#### 5. MetricsAggregator Service ⭐ CALCULATION SITE
- **Location**: `repos/metabob-rpc-api/server/services/metrics_aggregator.py`
- **Calculations Performed** (lines 88-159):
  ```python
  success_rate = successes / total
  avg_cost = total_cost / total
  avg_duration = total_duration / total
  avg_tokens_in = total_tokens_in / total
  avg_tokens_out = total_tokens_out / total
  avg_tokens_cache = total_tokens_cache / total
  ```
- **Storage**: Redis `template:{template_id}:metrics`
- **Methods**:
  - `record_execution()` - Store execution record
  - `_update_aggregated_metrics()` - **PERFORMS ALL CALCULATIONS**
  - `get_template_metrics()` - Retrieve aggregated metrics
- **Evidence**: This is the ONLY place where metrics calculations happen
- **Gap**: None - COMPLIANT (correct architectural layer)

#### 6. PromotionEngine Service ⭐ A/B TESTING CALCULATIONS
- **Location**: `repos/metabob-rpc-api/server/services/promotion_engine.py`
- **Calculations Performed**:
  ```python
  success_rate_diff = candidate_metrics['success_rate'] - stable_metrics['success_rate']
  cost_delta = (candidate_cost - stable_cost) / stable_cost
  duration_delta = (candidate_duration - stable_duration) / stable_duration
  chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)
  score = success_rate_diff * 10.0 - cost_penalty + duration_bonus
  ```
- **Methods**:
  - `get_recommendation()` - A/B testing recommendation
  - `_evaluate_candidate()` - Compare candidate vs stable
  - `_chi_square_test()` - Statistical significance test
  - `_generate_recommendation()` - PROMOTE/KEEP_TESTING/PRUNE decision
- **Evidence**: Complex statistical calculations server-side
- **Gap**: None - COMPLIANT (correct architectural layer)

#### 7. Template Metrics DB Operations ⭐ INCREMENTAL AGGREGATION
- **Location**: `repos/metabob-rpc-api/server/db/operations/template_metrics.py`
- **Calculations Performed** (lines 99-214):
  ```python
  new_avg_duration = (avg_duration_ms * n + duration_ms) / (n + 1)
  new_avg_cost = (avg_cost_usd * n + cost_usd) / (n + 1)
  success_rate = successful_executions / total_executions
  thompson_alpha = successful_executions + 1.0
  thompson_beta = failed_executions + 1.0
  improvement_gradient = success_rate * min(1.0, n_new / 10.0)
  ```
- **Storage**: SurrealDB `template_metrics` table
- **Methods**:
  - `update_metrics_after_execution()` - Incremental mean formula
  - `get_metrics()` - Retrieve metrics from DB
  - `create_metrics()` - Initialize metrics record
  - `increment_selection_count()` - Thompson Sampling tracking
- **Evidence**: Efficient incremental aggregation (no full scan)
- **Gap**: None - COMPLIANT (correct architectural layer)

## Architectural Boundaries

### ✅ Violations: NONE

All components respect the architectural boundary:
- **Client Layer** (opencode): Thin HTTP client, no calculations
- **Gateway Layer** (metabob-cli MCP): Pure HTTP forwarding, no calculations
- **Service Layer** (rpc-api): ALL calculations happen here

### ✅ Validation Harness

**Location**: `tests/validation-harnesses/metrics-calculation-in-rpc-api-only-harness.ts`

**Automated Checks**:
1. ✅ `no-calculation-operators` - No division, multiplication, Math.* in client
2. ✅ `no-dual-write-pattern` - No Promise.allSettled dual-write
3. ✅ `quality-score-deprecated` - template-quality-score.ts is stub (<100 lines)
4. ✅ `reportExecution-single-write` - Single MCP call in reportExecution()
5. ✅ `file-size-check` - template-metrics-client.ts <400 lines

**Purpose**: Automated enforcement of architectural boundaries via CI/CD

## Phase 3 Completion

### ✅ Goals Achieved

1. ✅ **SurrealDB as primary storage** - template_metrics table
2. ✅ **Redis as cache layer** - template:{id}:metrics keys
3. ✅ **Metrics calculations ONLY in rpc-api** - MetricsAggregator, PromotionEngine, DB operations
4. ✅ **No calculations in opencode client** - Thin HTTP wrapper
5. ✅ **Single write path** - No dual-write pattern

### ✅ Completed Work

1. ✅ Removed 375 lines of calculation logic from template-quality-score.ts
2. ✅ Converted template-metrics-client.ts to thin HTTP client
3. ✅ Implemented MetricsAggregator service in rpc-api
4. ✅ Implemented PromotionEngine for A/B testing
5. ✅ Added SurrealDB template_metrics operations with incremental aggregation
6. ✅ Created validation harness for automated boundary enforcement

## Evidence Summary

| Component | Location | Calculations? | Compliant? |
|-----------|----------|--------------|------------|
| template-metrics-client.ts | opencode | ❌ None | ✅ Yes |
| template-quality-score.ts | opencode | ❌ None (stub) | ✅ Yes |
| metabob_post_activity_result | metabob-cli | ❌ None | ✅ Yes |
| activity_metrics_router.py | rpc-api | ❌ None (delegates) | ✅ Yes |
| metrics_aggregator.py | rpc-api | ✅ Yes | ✅ Yes (correct layer) |
| promotion_engine.py | rpc-api | ✅ Yes | ✅ Yes (correct layer) |
| template_metrics.py | rpc-api | ✅ Yes | ✅ Yes (correct layer) |

## Conclusion

**Overall Compliance**: ✅ COMPLIANT

The architecture correctly enforces the boundary that metrics calculations belong exclusively in metabob-rpc-api. The opencode client is a thin HTTP wrapper with no calculation logic. This separation allows:

1. **Centralized calculation logic** - Single source of truth
2. **Backend-side optimization** - Can change algorithms without client updates
3. **Consistent metrics** - No client-side calculation drift
4. **Proper separation of concerns** - Client = presentation, Backend = business logic

The validation harness ensures this architectural boundary is maintained through automated testing.

---

**Trace ID**: trace-metrics-calculation-in-rpc-api-only  
**Generated**: 2026-02-28  
**Full Details**: See `TRACE_metrics-calculation-in-rpc-api-only.json`
