# Enforcement Summary: thompson-sampling-in-rpc-api-only

## Specification
Thompson Sampling (Beta distribution variant selection) must ONLY exist in metabob-rpc-api. 
metabob-opencode must call rpc-api endpoint for template selection.

## Changes Applied

### 1. Created RPC HTTP Client Utility
**File**: `repos/metabob-opencode/packages/opencode/src/util/rpc-http-client.ts` (NEW)
**Change**: Created HTTP client utility for calling RPC API
**Reason**: Provides clean interface for delegating Thompson Sampling to RPC API, maintains architectural boundary
**Impact**: New utility, no breaking changes

**Details**:
- `selectTemplateVariant()`: Calls POST /v2/activities/templates/{id}/select
- `getConfig()`: Reads METABOB_RPC_API_URL and METABOB_API_KEY from environment
- Handles authentication headers (X-API-Key)
- 10-second timeout with graceful error handling
- Returns template + selection metadata from RPC API

### 2. Removed Beta Sampling Logic from OpenCode
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
**Component**: `betaSample()` function (lines 44-130)
**Change**: REMOVED Beta distribution sampling implementation
**Reason**: Architectural violation - Beta sampling is ML logic that belongs in rpc-api, not opencode
**Impact**: Removed 87 lines of Gamma/Box-Muller transform code

**Details**:
- Removed Gamma distribution sampling (Marsaglia and Tsang's method)
- Removed Box-Muller transform for normal distribution
- Removed Beta(alpha, beta) = X / (X + Y) calculation
- Added comment pointing to repos/metabob-rpc-api/server/actions/activity.py::sample_beta()

### 3. Removed Thompson Sampling Orchestration from OpenCode
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
**Component**: `performThompsonSampling()` function (lines 349-443)
**Change**: REMOVED Thompson Sampling algorithm implementation
**Reason**: Architectural violation - Thompson Sampling is ML logic that belongs in rpc-api
**Impact**: Removed 95 lines of sampling orchestration code

**Details**:
- Removed metrics fetching via TemplateMetricsClient.getTemplateMetrics()
- Removed variant list building with alpha/beta parameters
- Removed Beta sampling for each variant
- Removed highest-sample selection logic
- Added comment pointing to repos/metabob-rpc-api/server/actions/activity.py::select_variant_thompson_sampling()

### 4. Refactored Template Selection to Call RPC API
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
**Component**: `select()` function (lines 211-331)
**Change**: REPLACED local Thompson Sampling with RPC API call
**Reason**: Enforces architectural boundary - delegates ML selection to rpc-api
**Impact**: Template selection now calls RPC API instead of local sampling, fallback to stable on API failure

**Details**:
- Calls RpcHttpClient.selectTemplateVariant() for stable templates with candidates
- Parses RPC API response (template_id + selection_metadata)
- Maintains same SelectionResult interface (backward compatible)
- Fallback to stable template if RPC API unavailable (graceful degradation)
- Logs RPC API errors with clear fallback reasoning

**Data Flow (Before)**:
```
Activity tool → TemplateSelector.select() → performThompsonSampling() 
→ TemplateMetricsClient.getTemplateMetrics() → betaSample() → Select highest sample
```

**Data Flow (After)**:
```
Activity tool → TemplateSelector.select() → RpcHttpClient.selectTemplateVariant() 
→ POST /v2/activities/templates/{id}/select → RPC API Thompson Sampling → Return template
```

### 5. Deprecated getTemplateMetrics()
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`
**Component**: `getTemplateMetrics()` function (lines 176-212)
**Change**: Added @deprecated notice and warning log
**Reason**: OpenCode no longer needs raw alpha/beta metrics for Thompson Sampling
**Impact**: Kept for backward compatibility, logs warning when used

**Details**:
- Added @deprecated JSDoc tag
- Added warning log explaining RPC API integration
- Documented architectural boundary in deprecation notice
- Function still works but discouraged for new code

### 6. Updated Module Documentation
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`
**Component**: Module header docstring
**Change**: Updated architecture description
**Reason**: Reflects new RPC API delegation pattern
**Impact**: Documentation now accurately describes architectural boundary

**Before**:
- "Handles probabilistic template selection using Thompson Sampling algorithm"
- "Uses Beta(alpha, beta) distribution sampling for probabilistic selection"

**After**:
- "Handles template selection by delegating Thompson Sampling to metabob-rpc-api"
- "Maintains architectural boundary: ML logic in rpc-api, execution in opencode"

## Enforcement Verification

### Architectural Boundary Compliance
✅ **RPC API** (repos/metabob-rpc-api):
- POST /v2/activities/templates/{id}/select endpoint exists
- select_variant_thompson_sampling() implementation present
- sample_beta() Beta distribution sampling present
- No changes required - already compliant

✅ **OpenCode** (repos/metabob-opencode):
- Removed betaSample() function (87 lines)
- Removed performThompsonSampling() function (95 lines)
- Refactored select() to call RPC API
- Created RpcHttpClient utility (117 lines)
- Deprecated getTemplateMetrics()
- Total: -266 lines removed, +256 lines added (net -10 lines)

### Data Flow Validation
✅ **Entry Point**: Activity tool calls TemplateSelector.select()
✅ **Delegation**: select() calls RpcHttpClient.selectTemplateVariant()
✅ **RPC Call**: POST /v2/activities/templates/{id}/select
✅ **Sampling**: RPC API performs Thompson Sampling
✅ **Response**: Template + metadata returned to opencode
✅ **Execution**: OpenCode executes activity with selected template

### Fallback Behavior
✅ **RPC API Unavailable**: Falls back to stable template, logs error
✅ **Candidate Load Failure**: Falls back to stable template, logs error
✅ **No Candidates**: Direct template load, no RPC call needed
✅ **Backward Compatibility**: SelectionResult interface unchanged

## Testing Recommendations

1. **Unit Tests**:
   - Mock RpcHttpClient.selectTemplateVariant() responses
   - Test fallback behavior when RPC API unavailable
   - Verify SelectionResult format unchanged

2. **Integration Tests**:
   - End-to-end: Activity tool → RPC API → Template execution
   - Verify selection metadata passed through correctly
   - Test with multiple variants

3. **Validation Harness**:
   - Run existing Thompson Sampling validation
   - Compare selection distribution before/after
   - Verify probabilities match expected values

## Rollout Plan

1. **Environment Configuration**: Set METABOB_RPC_API_URL and METABOB_API_KEY
2. **Deploy RPC API**: Already deployed, no changes needed
3. **Deploy OpenCode**: Deploy with new RPC delegation
4. **Monitor**: Watch for RPC API errors and fallback rates
5. **Verify**: Confirm template selection distributions match expectations

## Files Modified

- `repos/metabob-opencode/packages/opencode/src/util/rpc-http-client.ts` (NEW, 117 lines)
- `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts` (REFACTORED, -110 lines)
- `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts` (DEPRECATED, +14 lines)
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts` (AUTO-FORMAT, 14 lines)
- `repos/metabob-opencode/packages/opencode/src/session/impulse-learning.ts` (AUTO-FORMAT, 6 lines)

## Architectural Principle Enforced

**Principle**: ML and probabilistic selection logic belongs in metabob-rpc-api, NOT metabob-opencode

**Rationale**:
- Separation of concerns: OpenCode = execution engine, RPC API = intelligence layer
- Single source of truth for selection algorithm
- Easier to experiment with different selection strategies
- Metrics and sampling co-located in same service
- Reduced complexity in OpenCode

**Enforcement**:
- Code review: Reject PRs adding Beta/Thompson Sampling to opencode ✅
- This refactor: Removed all sampling logic from opencode ✅
- RPC delegation: All selection decisions go through rpc-api ✅

## Trace Impulse
**ID**: trace-thompson-sampling-in-rpc-api-only
**Source**: TRACE_thompson-sampling-in-rpc-api-only.json
**Used For**: Guided enforcement decisions

## Next Steps

1. Run tests to verify behavior unchanged
2. Deploy to staging environment
3. Monitor RPC API latency and error rates
4. Verify template selection distributions
5. Remove deprecated getTemplateMetrics() in future version
