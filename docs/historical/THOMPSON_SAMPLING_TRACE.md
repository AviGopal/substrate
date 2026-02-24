# Thompson Sampling Template Selection - Implementation Trace

**Specification**: thompson-sampling-template-selection  
**Status**: NOT IMPLEMENTED (Infrastructure exists, algorithm missing)  
**Date**: 2026-02-23

## Executive Summary

The Thompson Sampling specification requires activity execution to select templates using a Bayesian multi-armed bandit algorithm (Beta distribution sampling) to balance exploration vs exploitation. **Current implementation uses simple weighted random selection and does NOT implement Thompson Sampling.**

## Current vs Desired State

### Current Implementation

```typescript
// template-selector.ts (line 221)
function performWeightedSelection(template) {
  const random = Math.random() * totalWeight;
  // Select based on fixed allocation weights (90/10 split)
  // NO metrics consulted, NO Beta distribution
}
```

**Flow**: ActivityTool → TemplateRepository.get() → Load template directly → Execute

### Desired Implementation

```typescript
// Desired flow
async function selectWithThompsonSampling(templateId) {
  // 1. Query Redis for metrics
  const metrics = await getTemplateMetrics(templateId);
  
  // 2. Calculate Beta distributions
  const alpha = metrics.successes + 1;
  const beta = metrics.failures + 1;
  
  // 3. Sample from Beta distribution
  const sample = betaSample(alpha, beta);
  
  // 4. Select template with highest sample
  // 5. Record selection_reason with Beta parameters
}
```

**Flow**: ActivityTool → TemplateSelector.select() → Query metrics → Calculate Beta → Sample → Select highest → Record reason → Execute

## Components Analysis

### 1. Template Selector (NEEDS THOMPSON SAMPLING)
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-selector.ts`

**Current**: Lines 221-269 implement weighted random selection
- Uses fixed `allocationWeight` (typically 0.9 for stable, 0.1 for candidates)
- No metrics consulted
- No Beta distribution calculations
- No selection reason recorded

**Gap**:
- Missing: `betaSample(alpha, beta)` function
- Missing: Metrics query before selection
- Missing: Beta parameter calculation (alpha=successes+1, beta=failures+1)
- Missing: Selection reason recording

### 2. Metrics Client (HAS DUAL-WRITE, MISSING BETA)
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Current**: Lines 91-168 implement dual-write to Redis + SurrealDB
- Stores execution data (success, duration, cost, tokens)
- No Beta parameter calculation
- `getTemplateMetrics()` exists but doesn't return thompson_alpha/thompson_beta

**Gap**:
- Backend needs to calculate alpha/beta when storing metrics
- `TemplateMetrics` interface needs thompson_alpha/thompson_beta fields

### 3. Activity Tool (BYPASSES SELECTION)
**File**: `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Current**: Line 436 directly loads template
```typescript
const template = await TemplateRepository.get(params.templateId)
```

**Gap**:
- Should call `TemplateSelector.select(templateId)` instead
- TemplateSelector should handle Thompson Sampling internally

### 4. Metrics Schema (MISSING BETA FIELDS)
**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics.ts`

**Current**: Lines 30-65 define TemplateMetrics
- Has: `executions`, `success_rate`, `avg_cost`, `avg_duration`
- Missing: `thompson_alpha`, `thompson_beta`

**Gap**:
- Add Beta distribution parameters to interface

### 5. Activity Metadata (NO SELECTION REASON)
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

**Current**: Activity execution records stats but no selection metadata

**Gap**:
- Add `selection_reason` field to Activity.Schema
- Should contain: `{ method: "thompson_sampling", alpha: 6, beta: 2, sample: 0.73 }`

### 6. Backend (MENTIONED BUT NOT IMPLEMENTED)
**File**: `repos/metabob-cli/src/metabob_cli/mcp/activity_manager.py`

**Current**: Line 175 comments mention "Backend handles Thompson Sampling" but no implementation visible

**Gap**:
- Backend API needs to calculate Beta parameters when storing metrics
- Backend API needs to expose thompson_alpha/thompson_beta in metrics endpoint

## Data Flow Trace

### Current Flow (No Thompson Sampling)
```
User calls activity tool
  ↓
ActivityTool.invoke() line 436
  ↓
TemplateRepository.get(templateId)
  ↓
Load template directly (no selection logic)
  ↓
Execute activity
  ↓
Metrics dual-written (no Beta params)
```

### Desired Flow (With Thompson Sampling)
```
User calls activity tool
  ↓
ActivityTool.invoke()
  ↓
TemplateSelector.select(templateId)
  ├─ Query Redis for metrics via TemplateMetricsClient
  ├─ Extract alpha/beta parameters
  ├─ Calculate Beta(alpha, beta) for each candidate
  ├─ Sample random value from each Beta distribution
  ├─ Select template with highest sample
  └─ Record selection_reason with Beta params
  ↓
Execute activity with selected template
  ↓
Metrics dual-written (calculate alpha=successes+1, beta=failures+1)
```

## Missing Implementations

### Priority 1: Beta Distribution Sampling
**Location**: `template-selector.ts`  
**What**: Implement `betaSample(alpha: number, beta: number): number`

```typescript
/**
 * Sample from Beta distribution using inverse transform
 * Returns value in [0, 1]
 */
function betaSample(alpha: number, beta: number): number {
  // Option A: Use jStat library (recommended)
  // Option B: Implement using Gamma distribution sampling
  // Option C: Use rejection sampling
}
```

### Priority 2: Metrics Query Integration
**Location**: `template-selector.ts`  
**What**: Query metrics before selection

```typescript
async function select(templateId: string): Promise<SelectionResult> {
  // Load template and candidates
  const template = await TemplateRepository.get(templateId);
  
  // NEW: Query metrics for Thompson Sampling
  const metricsResponse = await TemplateMetricsClient.getTemplateMetrics(templateId);
  
  // NEW: Extract Beta parameters
  const alpha = metricsResponse.stable.thompson_alpha || 1;
  const beta = metricsResponse.stable.thompson_beta || 1;
  
  // NEW: Sample from Beta distribution
  const sample = betaSample(alpha, beta);
  
  // Select based on highest sample
}
```

### Priority 3: Schema Updates
**Location**: `template-metrics.ts`  
**What**: Add Thompson Sampling fields

```typescript
export interface TemplateMetrics {
  template_id: string
  executions: number
  success_rate: number
  // NEW: Thompson Sampling parameters
  thompson_alpha: number  // successes + 1
  thompson_beta: number   // failures + 1
}
```

### Priority 4: Activity Tool Integration
**Location**: `activity.ts` line 436  
**What**: Replace direct load with Thompson Sampling selection

```typescript
// OLD:
const template = await TemplateRepository.get(params.templateId)

// NEW:
const selectionResult = await TemplateSelector.select(params.templateId)
const template = selectionResult.template

// Record selection reason in activity metadata
activity.selection_reason = {
  method: "thompson_sampling",
  alpha: selectionResult.alpha,
  beta: selectionResult.beta,
  sample: selectionResult.sample,
  selectedId: selectionResult.selectedId
}
```

### Priority 5: Beta Parameter Calculation
**Location**: `template-metrics-client.ts`  
**What**: Calculate alpha/beta when reporting execution

Backend needs to track:
```typescript
// After each execution
const successes = previousSuccesses + (data.success ? 1 : 0);
const failures = previousFailures + (data.success ? 0 : 1);

await redis.set(`activity:metrics:${templateId}`, {
  executions: successes + failures,
  success_rate: successes / (successes + failures),
  thompson_alpha: successes + 1,  // Beta prior
  thompson_beta: failures + 1     // Beta prior
});
```

## Integration Points

1. **Entry Point**: `src/tool/activity.ts:436` - Replace `TemplateRepository.get()` with `TemplateSelector.select()`
2. **Metrics**: `src/session/template-metrics-client.ts` - Add Beta parameter calculation
3. **Selection**: `src/session/template-selector.ts` - Implement Thompson Sampling algorithm
4. **Recording**: `src/session/activity.ts` - Add selection_reason to metadata

## Testing Strategy

### Unit Tests
```typescript
test("betaSample produces values in [0,1]", () => {
  const sample = betaSample(5, 2);
  expect(sample).toBeGreaterThanOrEqual(0);
  expect(sample).toBeLessThanOrEqual(1);
});

test("higher alpha increases mean of Beta distribution", () => {
  const samples1 = Array(100).fill(0).map(() => betaSample(2, 2));
  const samples2 = Array(100).fill(0).map(() => betaSample(10, 2));
  
  const mean1 = samples1.reduce((a,b) => a+b) / 100;
  const mean2 = samples2.reduce((a,b) => a+b) / 100;
  
  expect(mean2).toBeGreaterThan(mean1);
});
```

### Integration Tests
```typescript
test("Thompson Sampling favors high-success templates", async () => {
  // Setup: Template A with 90% success (alpha=10, beta=2)
  // Setup: Template B with 50% success (alpha=6, beta=6)
  
  const selections = [];
  for (let i = 0; i < 100; i++) {
    const result = await TemplateSelector.select("test-template");
    selections.push(result.selectedId);
  }
  
  const aSelections = selections.filter(id => id === "template-a").length;
  
  // Verify exploitation bias (should select A ~70-80% of time)
  expect(aSelections).toBeGreaterThan(65);
  expect(aSelections).toBeLessThan(85);
});
```

### Validation Tests
```typescript
test("selection_reason contains Beta parameters", async () => {
  const activity = await ActivityTool.invoke({
    templateId: "test-template",
    variables: {},
    reason: "Test Thompson Sampling"
  });
  
  expect(activity.selection_reason).toBeDefined();
  expect(activity.selection_reason.method).toBe("thompson_sampling");
  expect(activity.selection_reason.alpha).toBeGreaterThan(0);
  expect(activity.selection_reason.beta).toBeGreaterThan(0);
  expect(activity.selection_reason.sample).toBeGreaterThanOrEqual(0);
  expect(activity.selection_reason.sample).toBeLessThanOrEqual(1);
});
```

## Why This Matters

Thompson Sampling is the **core learning mechanism** that enables:

1. **Exploration vs Exploitation Balance**: New templates get tried (exploration) while proven templates are preferred (exploitation)
2. **Self-Improving System**: Success rates automatically guide template selection over time
3. **Adaptive Selection**: System responds to changing template performance
4. **Automatic A/B Testing**: No manual traffic splitting needed

Without Thompson Sampling, the system uses **fixed allocation weights** that never adapt to actual performance data.

## Validation Criteria (from Spec)

When implemented correctly:

1. ✅ Create 2 templates: hello-world-A (90% success), hello-world-B (50% success)
2. ✅ Run 100 template selections
3. ✅ Verify: hello-world-A selected ~75% of time (exploitation) + ~25% exploration
4. ✅ Verify: `selection_reason` field contains Beta distribution values (alpha, beta, sample)

## Next Steps for Implementation

1. Install Beta distribution library (jStat or implement manually)
2. Add `thompson_alpha` and `thompson_beta` to TemplateMetrics interface
3. Implement `betaSample(alpha, beta)` function in template-selector.ts
4. Modify `TemplateSelector.select()` to query metrics and sample from Beta distributions
5. Update activity.ts line 436 to use TemplateSelector.select()
6. Add `selection_reason` field to Activity.Schema
7. Backend: Calculate alpha/beta when storing metrics to Redis
8. Write integration tests to validate Thompson Sampling behavior

---

**Status**: Ready for enforcement. All infrastructure exists (dual-write metrics, template selector), just needs Thompson Sampling algorithm.

**Estimated Effort**: 4-6 hours (Beta sampling implementation + integration + tests)
