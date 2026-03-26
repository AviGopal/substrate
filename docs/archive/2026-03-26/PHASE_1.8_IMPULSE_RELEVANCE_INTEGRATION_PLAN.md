# Phase 1.8: Impulse Relevance Integration - Implementation Plan

**Status:** Planning  
**Depends On:** Phase 1.3 (Impulse Relevance Metrics - backend) ✅  
**Enables:** 30-50% token reduction, faster activity execution

---

## Overview

Phase 1.8 integrates the impulse relevance metrics from the backend (Phase 1.3) into minibob's activity execution workflow. Instead of loading all impulses for every activity, we now:

1. **Query relevance metrics** from backend before loading
2. **Filter impulses** based on `relevance_score` threshold
3. **Load only relevant impulses** (lazy loading)
4. **Track savings** (tokens, cost, time)

### Problem Being Solved

**Current behavior:**
```
Activity executes → Load ALL impulses → Pass to LLM
Token usage: 15,000 tokens
Cost: $0.045
```

**New behavior:**
```
Activity executes → Query relevance → Load ONLY relevant impulses → Pass to LLM
Token usage: 7,500 tokens (50% reduction)
Cost: $0.0225 (50% reduction)
```

---

## Architecture

### Data Flow

```
Activity Execution Start
    ↓
Query Backend: /v2/activities/impulse-relevance?activity_variant_id=X
    ↓
Get relevance scores for all impulses
    ↓
Filter: relevance_score > threshold (default: 0.5)
    ↓
Load ONLY high-relevance impulses
    ↓
Execute activity with reduced context
    ↓
Record: which impulses were loaded, execution success
    ↓
POST /v2/activities/impulse-relevance (update metrics)
```

### Threshold Strategy

**Relevance Score Interpretation:**
- `relevance_score` = P(success | impulse loaded)
- `irrelevance_score` = P(success | impulse NOT loaded)

**Decision Rules:**
1. **Always load** if `relevance_score > 0.8` (strong positive signal)
2. **Load if relevant** if `relevance_score > 0.5` (more likely to help than hurt)
3. **Skip if irrelevant** if `relevance_score < 0.5` (doesn't contribute to success)
4. **Always skip** if `irrelevance_score > relevance_score` (activity succeeds WITHOUT it)

---

## Implementation Tasks

### Task 1: Update MCP Client (Backend Integration)

**File:** `repos/minibob/src/mcp.ts`

Add method to query impulse relevance:

```typescript
/**
 * Query impulse relevance metrics for an activity
 */
async queryImpulseRelevance(
  activityVariantId: string,
  impulseIds?: string[]
): Promise<ImpulseRelevanceMetric[]> {
  const params = new URLSearchParams({
    activity_variant_id: activityVariantId,
  });
  
  if (impulseIds && impulseIds.length > 0) {
    // Query specific impulses
    for (const id of impulseIds) {
      params.append('impulse_id', id);
    }
  }
  
  const response = await fetch(
    `${this.endpoint}/v2/activities/impulse-relevance?${params.toString()}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to query impulse relevance: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.metrics || [];
}
```

### Task 2: Implement Impulse Filtering Logic

**File:** `repos/minibob/src/impulse-filter.ts` (NEW FILE)

```typescript
import type { ImpulseRelevanceMetric } from './mcp';

export interface FilterConfig {
  // Threshold for loading impulses (default: 0.5)
  relevanceThreshold: number;
  
  // Always load impulses with score above this (default: 0.8)
  alwaysLoadThreshold: number;
  
  // Maximum impulses to load (default: 10)
  maxImpulses: number;
  
  // Fallback behavior when no metrics available
  fallbackBehavior: 'load-all' | 'load-none' | 'load-top-n';
}

export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  relevanceThreshold: 0.5,
  alwaysLoadThreshold: 0.8,
  maxImpulses: 10,
  fallbackBehavior: 'load-all', // Conservative: load all if no data
};

/**
 * Filter impulses based on relevance scores
 */
export function filterImpulsesByRelevance(
  impulseIds: string[],
  metrics: ImpulseRelevanceMetric[],
  config: Partial<FilterConfig> = {}
): {
  toLoad: string[];
  toSkip: string[];
  reasoning: Record<string, string>;
} {
  const cfg = { ...DEFAULT_FILTER_CONFIG, ...config };
  
  // Build metric map for fast lookup
  const metricMap = new Map<string, ImpulseRelevanceMetric>();
  for (const metric of metrics) {
    metricMap.set(metric.impulse_id, metric);
  }
  
  const toLoad: string[] = [];
  const toSkip: string[] = [];
  const reasoning: Record<string, string> = {};
  
  for (const impulseId of impulseIds) {
    const metric = metricMap.get(impulseId);
    
    if (!metric) {
      // No metrics available - use fallback
      if (cfg.fallbackBehavior === 'load-all') {
        toLoad.push(impulseId);
        reasoning[impulseId] = 'No metrics available (fallback: load)';
      } else if (cfg.fallbackBehavior === 'load-none') {
        toSkip.push(impulseId);
        reasoning[impulseId] = 'No metrics available (fallback: skip)';
      } else {
        // load-top-n: will be handled after sorting
        toLoad.push(impulseId);
        reasoning[impulseId] = 'No metrics available (fallback: top-n)';
      }
      continue;
    }
    
    // Decision logic
    if (metric.relevance_score >= cfg.alwaysLoadThreshold) {
      toLoad.push(impulseId);
      reasoning[impulseId] = `High relevance (${metric.relevance_score.toFixed(2)})`;
    } else if (metric.relevance_score >= cfg.relevanceThreshold) {
      toLoad.push(impulseId);
      reasoning[impulseId] = `Relevant (${metric.relevance_score.toFixed(2)})`;
    } else if (metric.irrelevance_score > metric.relevance_score) {
      toSkip.push(impulseId);
      reasoning[impulseId] = `More successful without it (${metric.irrelevance_score.toFixed(2)} vs ${metric.relevance_score.toFixed(2)})`;
    } else {
      toSkip.push(impulseId);
      reasoning[impulseId] = `Low relevance (${metric.relevance_score.toFixed(2)})`;
    }
  }
  
  // Enforce max impulses limit
  if (toLoad.length > cfg.maxImpulses) {
    // Sort by relevance score descending
    const loadWithScores = toLoad.map(id => ({
      id,
      score: metricMap.get(id)?.relevance_score || 0,
    }));
    
    loadWithScores.sort((a, b) => b.score - a.score);
    
    const keptIds = loadWithScores.slice(0, cfg.maxImpulses).map(x => x.id);
    const droppedIds = loadWithScores.slice(cfg.maxImpulses).map(x => x.id);
    
    for (const id of droppedIds) {
      toSkip.push(id);
      reasoning[id] = `Dropped (exceeded max ${cfg.maxImpulses})`;
    }
    
    return {
      toLoad: keptIds,
      toSkip,
      reasoning,
    };
  }
  
  return { toLoad, toSkip, reasoning };
}

/**
 * Calculate token savings from skipped impulses
 */
export function calculateSavings(
  skippedImpulses: string[],
  impulseTokenSizes: Map<string, number>
): {
  tokensSaved: number;
  costSaved: number; // USD
  percentSaved: number;
} {
  const totalTokens = Array.from(impulseTokenSizes.values()).reduce((sum, t) => sum + t, 0);
  const skippedTokens = skippedImpulses
    .map(id => impulseTokenSizes.get(id) || 0)
    .reduce((sum, t) => sum + t, 0);
  
  const percentSaved = totalTokens > 0 ? (skippedTokens / totalTokens) * 100 : 0;
  
  // Approximate cost: $3 per 1M input tokens (Claude pricing)
  const costSaved = (skippedTokens / 1_000_000) * 3;
  
  return {
    tokensSaved: skippedTokens,
    costSaved,
    percentSaved,
  };
}
```

### Task 3: Update Activity Executor

**File:** `repos/minibob/src/activity.ts`

Modify the activity execution flow to use impulse filtering:

```typescript
import { filterImpulsesByRelevance, calculateSavings, DEFAULT_FILTER_CONFIG } from './impulse-filter';
import type { ImpulseRelevanceMetric } from './mcp';

// Add to ActivityExecutor class
async executeActivity(
  template: ActivityTemplate,
  variables: Record<string, any>,
  options: ExecuteOptions = {}
): Promise<ActivityResult> {
  const activityVariantId = template.variant_id;
  const impulseIds = this.gatherImpulseIds(variables); // Extract impulse IDs from variables
  
  let loadedImpulseIds: string[] = impulseIds;
  let skippedImpulseIds: string[] = [];
  let filteringReasoning: Record<string, string> = {};
  let tokensSaved = 0;
  
  // PHASE 1.8: Query impulse relevance and filter
  if (options.enableImpulseFiltering !== false) { // Enabled by default
    try {
      logger.info('Querying impulse relevance metrics', {
        activity: activityVariantId,
        impulse_count: impulseIds.length,
      });
      
      const metrics = await this.mcp.queryImpulseRelevance(activityVariantId, impulseIds);
      
      logger.info('Received relevance metrics', {
        metrics_count: metrics.length,
      });
      
      // Filter impulses
      const filterResult = filterImpulsesByRelevance(
        impulseIds,
        metrics,
        options.filterConfig || DEFAULT_FILTER_CONFIG
      );
      
      loadedImpulseIds = filterResult.toLoad;
      skippedImpulseIds = filterResult.toSkip;
      filteringReasoning = filterResult.reasoning;
      
      logger.info('Impulse filtering complete', {
        total: impulseIds.length,
        loaded: loadedImpulseIds.length,
        skipped: skippedImpulseIds.length,
        percent_skipped: ((skippedImpulseIds.length / impulseIds.length) * 100).toFixed(1) + '%',
      });
      
      // Calculate savings
      const impulseTokenSizes = new Map<string, number>();
      for (const id of impulseIds) {
        // Estimate token size (will be accurate after loading)
        impulseTokenSizes.set(id, 1000); // Placeholder
      }
      
      const savings = calculateSavings(skippedImpulseIds, impulseTokenSizes);
      
      logger.info('Estimated token savings', {
        tokens_saved: savings.tokensSaved,
        cost_saved: `$${savings.costSaved.toFixed(4)}`,
        percent_saved: `${savings.percentSaved.toFixed(1)}%`,
      });
      
      tokensSaved = savings.tokensSaved;
      
    } catch (error) {
      logger.warn('Impulse filtering failed, loading all impulses', {
        error: error.message,
      });
      // Fallback: load all impulses
      loadedImpulseIds = impulseIds;
    }
  }
  
  // Load ONLY the filtered impulses
  const impulses = await this.loadImpulses(loadedImpulseIds);
  
  // ... rest of execution logic ...
  
  // After execution: record impulse relevance for all impulses
  for (const impulseId of impulseIds) {
    const wasLoaded = loadedImpulseIds.includes(impulseId);
    
    await this.mcp.recordImpulseRelevance({
      impulse_id: impulseId,
      activity_variant_id: activityVariantId,
      was_loaded: wasLoaded,
      execution_succeeded: result.success,
      content_size_tokens: impulses.find(i => i.id === impulseId)?.tokenSize,
      pointer_type: impulses.find(i => i.id === impulseId)?.pointerType,
    });
  }
  
  return {
    ...result,
    impulseFiltering: {
      totalImpulses: impulseIds.length,
      loadedImpulses: loadedImpulseIds.length,
      skippedImpulses: skippedImpulseIds.length,
      tokensSaved,
      reasoning: filteringReasoning,
    },
  };
}
```

### Task 4: Add Configuration Options

**File:** `repos/minibob/src/config.ts` or environment

Add configuration for impulse filtering:

```typescript
export const IMPULSE_FILTERING_CONFIG = {
  enabled: process.env.IMPULSE_FILTERING_ENABLED !== 'false', // Default: enabled
  relevanceThreshold: parseFloat(process.env.IMPULSE_RELEVANCE_THRESHOLD || '0.5'),
  alwaysLoadThreshold: parseFloat(process.env.IMPULSE_ALWAYS_LOAD_THRESHOLD || '0.8'),
  maxImpulses: parseInt(process.env.IMPULSE_MAX_LOAD || '10'),
  fallbackBehavior: (process.env.IMPULSE_FALLBACK || 'load-all') as 'load-all' | 'load-none' | 'load-top-n',
};
```

### Task 5: Integration Tests

**File:** `test-impulse-filtering-integration.ts`

Test scenarios:

1. **No metrics available (fallback)**
   - Activity has 5 impulses, no metrics in backend
   - Verify: loads all 5 (fallback behavior)

2. **High relevance impulses**
   - Activity has 3 impulses with scores: 0.9, 0.6, 0.2
   - Verify: loads first 2, skips last 1

3. **Irrelevance signal**
   - Impulse has `irrelevance_score=0.8, relevance_score=0.3`
   - Verify: skips impulse (more successful without it)

4. **Max impulses limit**
   - Activity has 15 impulses, all relevant
   - Verify: loads only top 10 by relevance score

5. **Token savings calculation**
   - Skip 3 impulses totaling 5000 tokens
   - Verify: savings = 5000 tokens, ~$0.015

---

## Implementation Order

### Step 1: MCP Client Update (15 min)
- [ ] Add `queryImpulseRelevance()` method to `mcp.ts`
- [ ] Add types for `ImpulseRelevanceMetric`
- [ ] Test method against backend

### Step 2: Impulse Filtering Logic (30 min)
- [ ] Create `impulse-filter.ts` with filtering functions
- [ ] Implement `filterImpulsesByRelevance()`
- [ ] Implement `calculateSavings()`
- [ ] Add unit tests for filtering logic

### Step 3: Activity Executor Integration (45 min)
- [ ] Update `activity.ts` to query relevance before loading
- [ ] Integrate filtering logic
- [ ] Load only filtered impulses
- [ ] Record actual loaded/skipped state
- [ ] Log savings metrics

### Step 4: Configuration (10 min)
- [ ] Add environment variables for thresholds
- [ ] Add config validation
- [ ] Document configuration options

### Step 5: Integration Testing (30 min)
- [ ] Write integration tests
- [ ] Test against live backend
- [ ] Verify 5/5 scenarios pass
- [ ] Measure actual token savings

### Step 6: Deployment (10 min)
- [ ] Build minibob Docker image
- [ ] Deploy to Kubernetes
- [ ] Verify in production
- [ ] Monitor savings metrics

**Total Estimated Time:** ~2.5 hours

---

## Success Criteria

✅ MCP client can query impulse relevance  
✅ Filtering logic correctly identifies relevant impulses  
✅ Activity executor loads only relevant impulses  
✅ Token savings measured and logged  
✅ 5/5 integration tests passing  
✅ 30-50% token reduction achieved  
✅ No regression in activity success rate  

---

## Expected Impact

### Token Reduction
- **Baseline:** 15,000 tokens per activity (all impulses)
- **With filtering:** 7,500 - 10,500 tokens (30-50% reduction)
- **Annual savings:** $10,000 - $15,000 (assuming 1M activities/year)

### Performance Improvement
- **Faster LLM response:** Less context to process
- **Lower latency:** 20-30% faster activity execution
- **Reduced costs:** Direct correlation with token reduction

### Learning Loop
- **Better metrics:** Track which impulses actually contribute
- **Continuous improvement:** Relevance scores improve over time
- **Self-optimizing:** System learns to load only what matters

---

## Example Usage

### Before (Phase 1.7)
```typescript
const result = await executor.executeActivity(template, {
  impulses: ['imp1', 'imp2', 'imp3', 'imp4', 'imp5'], // All 5 loaded
});
// Tokens: 15,000
// Cost: $0.045
```

### After (Phase 1.8)
```typescript
const result = await executor.executeActivity(template, {
  impulses: ['imp1', 'imp2', 'imp3', 'imp4', 'imp5'],
}, {
  enableImpulseFiltering: true,
  filterConfig: {
    relevanceThreshold: 0.5,
    maxImpulses: 10,
  },
});

// Result includes:
// impulseFiltering: {
//   totalImpulses: 5,
//   loadedImpulses: 3,  // Only imp1, imp2, imp3 loaded
//   skippedImpulses: 2, // imp4, imp5 skipped
//   tokensSaved: 4000,
//   reasoning: {
//     imp1: "High relevance (0.92)",
//     imp2: "Relevant (0.67)",
//     imp3: "Relevant (0.58)",
//     imp4: "Low relevance (0.32)",
//     imp5: "More successful without it (0.75 vs 0.18)"
//   }
// }

// Tokens: 11,000 (27% reduction)
// Cost: $0.033 (27% savings)
```

---

## Monitoring & Observability

Add metrics tracking:

```typescript
// Log after each activity execution
logger.info('Impulse filtering metrics', {
  activity_id: template.variant_id,
  impulses_total: totalImpulses,
  impulses_loaded: loadedImpulses,
  impulses_skipped: skippedImpulses,
  tokens_saved: tokensSaved,
  percent_saved: percentSaved,
  success: result.success,
});

// Aggregate metrics (stored in backend)
{
  "total_executions": 1000,
  "avg_impulses_loaded": 6.2,
  "avg_impulses_skipped": 3.8,
  "avg_tokens_saved": 4200,
  "avg_percent_saved": 35.2,
  "cumulative_cost_saved": "$42.50"
}
```

---

## Next Phase Preview

**Phase 1.9: Boredom Variant Generation**

Use composition graph, tool patterns, execution sequences, and impulse relevance to:
- Generate template variants when boredom threshold reached
- Trigger Thompson Sampling exploration
- Create new activity templates automatically
- Learn from variant performance

---

Let's start with **Step 1: MCP Client Update**!
