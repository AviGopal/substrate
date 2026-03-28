# Thompson Sampling Architectural Trace

**Specification**: `thompson-sampling-in-rpc-api-only`

**Date**: 2026-02-28

**Status**: ✅ COMPLIANT

## Executive Summary

Thompson Sampling (Beta distribution variant selection) has been successfully architected with proper boundaries:
- **ML Logic**: Resides entirely in `metabob-rpc-api`
- **Execution Logic**: Resides in `metabob-opencode` 
- **Interface**: HTTP endpoint `POST /v2/activities/templates/{id}/select`

## Data Flow Trace

```
┌─────────────────────────────────────────────────────────────────────┐
│ OPENCODE: Template Selection Request                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
    TemplateSelector.select(templateId)
                              │
                              ▼
    Load requested template from TemplateRepository
                              │
                              ▼
    ┌──────────────────────────────────────┐
    │ Has candidates for A/B testing?      │
    └──────────────────────────────────────┘
                 │                    │
                 │ YES                │ NO
                 ▼                    ▼
    ┌──────────────────────┐    Return stable template
    │ Delegate to RPC API  │
    └──────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ RPC CLIENT: HTTP Call                                                │
└─────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
    RpcHttpClient.selectTemplateVariant(templateId)
                 │
                 ▼
    POST /v2/activities/templates/{templateId}/select
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ RPC API: Thompson Sampling Algorithm                                 │
└─────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
    select_variant_thompson_sampling(redis, activity_id)
                 │
                 ▼
    1. Find all variants: redis.keys(f"activity:template:{activity_id}-*")
                 │
                 ▼
    2. For each variant:
       - Load metrics: alpha, beta = redis.get(f"activity:metrics:{variant_id}")
       - Sample: score = sample_beta(alpha, beta)
       - Track: candidates.append({variant_id, score, alpha, beta})
                 │
                 ▼
    3. Select winner: max(candidates, key=lambda x: x["score"])
                 │
                 ▼
    4. Increment selection count
                 │
                 ▼
    5. Return: {
         template_id, 
         template: {...}, 
         selection_metadata: {method, alpha, beta, sample, variant}
       }
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│ OPENCODE: Response Handling                                          │
└─────────────────────────────────────────────────────────────────────┘
                 │
                 ▼
    Receive selection response
                 │
                 ▼
    ┌──────────────────────────────────────┐
    │ Was candidate selected?               │
    └──────────────────────────────────────┘
                 │                    │
                 │ YES                │ NO
                 ▼                    ▼
    Load candidate template    Use stable template
                 │                    │
                 ▼                    │
    ┌──────────────────────┐         │
    │ Load successful?     │         │
    └──────────────────────┘         │
         │            │               │
         │ YES        │ NO            │
         ▼            ▼               │
    Return        Fallback to        │
    candidate     stable template ───┘
                       │
                       ▼
    Record selection to selectionHistory
                       │
                       ▼
                  Execute activity
```

## Component Analysis

### RPC API Components (ML Logic Layer)

#### 1. `sample_beta()` - Beta Distribution Sampling
- **Location**: `repos/metabob-rpc-api/server/actions/activity.py:73-84`
- **Current Behavior**: Implements Beta(alpha, beta) sampling using `random.betavariate()`
- **Gap**: NONE - Correct implementation
- **Key Code**:
  ```python
  def sample_beta(alpha: float, beta: float) -> float:
      try:
          return random.betavariate(alpha, beta)
      except (ValueError, ZeroDivisionError):
          return alpha / (alpha + beta) if (alpha + beta) > 0 else 0.5
  ```

#### 2. `select_variant_thompson_sampling()` - Thompson Sampling Algorithm
- **Location**: `repos/metabob-rpc-api/server/actions/activity.py:819-940`
- **Current Behavior**: 
  1. Find all variants for activity
  2. Sample from each variant's Beta distribution
  3. Select variant with highest sample
  4. Increment selection count
  5. Return selected variant with metadata
- **Gap**: NONE - Complete implementation
- **Algorithm**:
  ```python
  # Find variants
  variant_keys = redis.keys(f"activity:template:{activity_id}-*")
  
  # Sample from each
  for key in variant_keys:
      metrics = redis.get(f"activity:metrics:{variant_id}")
      alpha = metrics.get("thompson_alpha", 1.0)
      beta = metrics.get("thompson_beta", 1.0)
      sample = sample_beta(alpha, beta)
      candidates.append({...})
  
  # Select winner
  selected = max(candidates, key=lambda x: x["sample"])
  ```

#### 3. `POST /v2/activities/templates/{activity_id}/select` - HTTP Endpoint
- **Location**: `repos/metabob-rpc-api/server/routes/activity.py:355-405`
- **Current Behavior**: Exposes Thompson Sampling via REST API
- **Gap**: NONE - Correct endpoint
- **Response Schema**:
  ```json
  {
    "template_id": "create-activity-abc123",
    "template": {...},
    "selection_metadata": {
      "method": "thompson_sampling",
      "alpha": 2.0,
      "beta": 1.0,
      "sample": 0.724,
      "variant": "candidate"
    }
  }
  ```

### OpenCode Components (Execution Layer)

#### 4. `TemplateSelector.select()` - Template Selection Orchestration
- **Location**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts:118-281`
- **Current Behavior**: Delegates to RPC API, handles response, manages fallback
- **Gap**: NONE - Correct delegation pattern
- **Key Logic**:
  ```typescript
  // Delegate to RPC API
  const rpcResponse = await RpcHttpClient.selectTemplateVariant(templateId, rpcConfig)
  const selectedId = rpcResponse.template_id
  const metadata = rpcResponse.selection_metadata
  
  // Handle candidate loading
  if (selectedId !== templateId) {
    try {
      const candidateTemplate = await TemplateRepository.get(selectedId, backend)
      return { template: candidateTemplate, ...metadata }
    } catch (error) {
      // Fallback to stable
      return { template: requestedTemplate, fallback: true, ...fallbackMetadata }
    }
  }
  ```

#### 5. `betaSample()` - [REMOVED]
- **Location**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts:31-37`
- **Current State**: Function removed with architectural explanation
- **Gap**: NONE - Correctly removed
- **Documentation**:
  ```typescript
  /**
   * REMOVED: betaSample() function
   * 
   * Thompson Sampling (Beta distribution sampling) now happens in metabob-rpc-api.
   * This maintains the architectural boundary: ML logic in rpc-api, execution in opencode.
   * 
   * See: repos/metabob-rpc-api/server/actions/activity.py::sample_beta()
   */
  ```

#### 6. `performThompsonSampling()` - [REMOVED]
- **Location**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts:284-296`
- **Current State**: Function removed with migration documentation
- **Gap**: NONE - Correctly removed
- **Documentation**:
  ```typescript
  /**
   * REMOVED: performThompsonSampling() function
   * 
   * Thompson Sampling now happens in metabob-rpc-api via POST /v2/activities/templates/{id}/select.
   * This maintains the architectural boundary: ML logic in rpc-api, execution in opencode.
   */
  ```

#### 7. `RpcHttpClient.selectTemplateVariant()` - HTTP Client
- **Location**: `repos/metabob-opencode/packages/opencode/src/util/rpc-http-client.ts:41-91`
- **Current Behavior**: HTTP client for RPC API variant selection endpoint
- **Gap**: NONE - Correct client implementation
- **Key Code**:
  ```typescript
  export async function selectTemplateVariant(
    activityId: string,
    config: Config
  ): Promise<TemplateSelectionResponse> {
    const url = `${config.baseUrl}/v2/activities/templates/${activityId}/select`
    const response = await fetch(url, { method: "POST", ... })
    return await response.json()
  }
  ```

#### 8. `getTemplateMetrics()` - [DEPRECATED]
- **Location**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts:152-193`
- **Current State**: Marked `@deprecated` with warning log
- **Gap**: NONE - Correctly deprecated
- **Warning**:
  ```typescript
  export async function getTemplateMetrics(templateId: string): Promise<...> {
    log.warn("getTemplateMetrics() is deprecated - Thompson Sampling now in RPC API", {
      templateId,
      recommendation: "Use RPC API POST /v2/activities/templates/{id}/select instead",
    })
    // ... backward compatibility implementation
  }
  ```

#### 9. `thompson-sampler.ts` - [DELETED]
- **Location**: `repos/metabob-opencode/packages/opencode/src/ml/` (directory removed)
- **Current State**: File does not exist
- **Gap**: NONE - ML directory correctly removed

## Architectural Boundaries

### metabob-rpc-api (ML Logic Layer)

**Responsibilities**:
- ✅ Beta distribution sampling (`sample_beta` function)
- ✅ Thompson Sampling algorithm implementation (`select_variant_thompson_sampling`)
- ✅ Metrics storage and retrieval (`thompson_alpha`, `thompson_beta`)
- ✅ Variant selection logic (highest sample wins)
- ✅ Selection count tracking

**Files**:
- `repos/metabob-rpc-api/server/actions/activity.py`
- `repos/metabob-rpc-api/server/routes/activity.py`

### metabob-opencode (Execution Layer)

**Allowed Responsibilities**:
- ✅ Template loading and caching
- ✅ HTTP client to RPC API for variant selection
- ✅ Fallback handling (RPC failure, candidate load failure)
- ✅ Selection metrics recording (local analytics)
- ✅ Template execution

**Forbidden Responsibilities**:
- ❌ Beta distribution sampling (MUST use RPC API)
- ❌ Thompson Sampling calculations (MUST delegate to RPC API)
- ❌ Direct alpha/beta parameter updates (MUST use RPC API)
- ❌ ML algorithm implementation (MUST use RPC API)

**Files**:
- `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
- `repos/metabob-opencode/packages/opencode/src/util/rpc-http-client.ts`
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

## Validation Results

### Test 1: No Beta Sampling Keywords in OpenCode
**Method**: `grep -rn 'thompson\|beta\|betavariate\|sample_beta\|sampleBeta' repos/metabob-opencode/packages/opencode/src --include='*.ts'`
**Expected**: Only allowed references (comments, metadata fields, type definitions)
**Result**: ✅ PASS - Only metadata fields and comments found

### Test 2: RPC API Has Thompson Sampling Implementation
**Method**: `grep -r 'sample_beta\|select_variant_thompson_sampling' repos/metabob-rpc-api/server --include='*.py'`
**Expected**: Found `sample_beta()` and `select_variant_thompson_sampling()` in activity.py
**Result**: ✅ PASS - Both functions found

### Test 3: OpenCode Delegates to RPC API Endpoint
**Method**: `grep 'POST /v2/activities/templates' repos/metabob-opencode/packages/opencode/src/util/rpc-http-client.ts`
**Expected**: Found POST endpoint call in `selectTemplateVariant()`
**Result**: ✅ PASS - Endpoint call found

### Test 4: thompson-sampler.ts Deleted from OpenCode
**Method**: `ls repos/metabob-opencode/packages/opencode/src/ml/thompson-sampler.ts`
**Expected**: File does not exist
**Result**: ✅ PASS - File not found (ML directory removed)

## Compliance Status

**Overall**: ✅ COMPLIANT

**Details**:
- ✅ Thompson Sampling implementation exists only in metabob-rpc-api
- ✅ Beta distribution sampling (`sample_beta`) only in rpc-api
- ✅ OpenCode delegates via HTTP to `POST /v2/activities/templates/{id}/select`
- ✅ No local ML calculations in opencode
- ✅ Proper fallback handling in opencode for RPC failures
- ✅ Selection metadata (alpha, beta, sample) passed through interface
- ✅ ML directory removed from opencode
- ✅ Deprecated methods marked with warnings

**Violations**: None

## Key Design Decisions

### 1. Thompson Sampling Delegated to RPC API
**Rationale**: Architectural boundary - ML logic belongs in rpc-api, execution logic in opencode
**Impact**: Clean separation of concerns, easier to test and maintain ML algorithms

### 2. Fallback to Stable on RPC Failure
**Rationale**: OpenCode should remain functional even if RPC API is unavailable
**Impact**: Graceful degradation, no activity execution blocked by ML service downtime

### 3. Selection Metadata Passed Through Interface
**Rationale**: OpenCode needs visibility into selection method for debugging and analytics
**Impact**: Transparent decision-making, enables local metrics tracking

### 4. Deprecated getTemplateMetrics() with Warning
**Rationale**: Backward compatibility during migration, clear guidance to use RPC API
**Impact**: Smooth transition path, no breaking changes for existing code

## Impulse Details

**ID**: `trace-thompson-sampling-in-rpc-api-only`
**Type**: `trace`
**Budget**: 5000 tokens
**Status**: COMPLIANT
**Component Count**: 9
**Validation Passed**: ✅ YES

This impulse will be used by downstream validation and enforcement tasks to ensure the architectural boundary remains intact.
