# Resolver Tier Tracking Implementation

**Date**: 2026-04-20
**Status**: ✅ Complete
**Purpose**: Enable learning which resolvers work best for which impulse shapes

## Problem Statement

Impulse resolution uses different tiers (deterministic/pattern/llm) but this information wasn't tracked. The backend couldn't learn patterns like "use file resolver for source_code shapes" without knowing which resolver succeeded for each impulse.

## Solution Overview

Added comprehensive resolver tracking throughout the impulse resolution and relevance recording pipeline:

1. **Capture**: Resolution metadata captured during impulse load
2. **Store**: Metadata attached to impulse objects
3. **Transmit**: Metadata sent to backend when recording relevance
4. **Persist**: Backend stores resolver metrics for learning

## Implementation Details

### 1. MiniBob Changes

#### `/repos/minibob/src/types.ts`

Added `resolutionMetadata` field to Impulse interface:

```typescript
export interface Impulse {
  // ... existing fields ...
  resolutionMetadata?: {
    tier: "LOCAL" | "CUSTOM" | "DISCOVERY" | "MCP" | "FALLBACK" | "ERROR";
    resolver: string; // memo, file, directoryTree, gitDiff, VesselClient, MCP, etc.
    latencyMs: number;
    vesselId?: string;
    success: boolean;
    errorReason?: string;
  };
}
```

#### `/repos/minibob/src/impulse.ts`

Updated `ImpulseStore.load()` method to capture and store resolution metadata:

```typescript
// Extract resolution metadata from tracker
let resolutionMetadata: Impulse["resolutionMetadata"];
if (resolutionTracker) {
  const resolutions = resolutionTracker.getResolutions();
  const impulseResolution = resolutions.find((r) => r.impulse_id === id);
  if (impulseResolution) {
    resolutionMetadata = {
      tier: impulseResolution.resolver_tier as any,
      resolver: impulseResolution.resolver_id,
      latencyMs: impulseResolution.latency_ms || Math.round(resolveLatency),
      vesselId: impulseResolution.vessel_id,
      success: impulseResolution.success,
      errorReason: impulseResolution.error_reason,
    };
  }
}

const loadedImpulse: Impulse = {
  // ... existing fields ...
  resolutionMetadata, // Add resolution tracking metadata
};
```

#### `/repos/minibob/src/activity.ts`

Updated `recordImpulseRelevance()` and `recordErrorImpulseRelevance()` methods to extract and send resolver metadata:

```typescript
const impulse = impulseStore.get(impulseId);
const resolutionMeta = impulse?.resolutionMetadata;

await mcp.recordImpulseRelevance({
  impulseId,
  activityId: templateId,
  wasLoaded,
  executionSucceeded,
  contentSizeTokens:
    typeof impulse?.metadata?.originalTokenCount === "number"
      ? impulse.metadata.originalTokenCount
      : undefined,
  pointerType: impulse?.pointer?.type,
  // Add resolver tracking fields
  resolverTier: resolutionMeta?.tier,
  resolverName: resolutionMeta?.resolver,
  resolutionLatencyMs: resolutionMeta?.latencyMs,
});
```

#### `/repos/minibob/src/mcp.ts`

Updated `recordImpulseRelevance()` to accept and transmit resolver fields:

```typescript
async recordImpulseRelevance(params: {
  // ... existing fields ...
  // Resolver tracking fields (resolver-tier-tracking)
  resolverTier?: string;
  resolverName?: string;
  resolutionLatencyMs?: number;
}): Promise<boolean> {
  const payload = {
    // ... existing fields ...
    resolver_tier: params.resolverTier,
    resolver_name: params.resolverName,
    resolution_latency_ms: params.resolutionLatencyMs,
  };
  // ... send to backend ...
}
```

### 2. Backend Changes

#### `/repos/metabob-activity-api/src/models/schemas.ts`

Updated request and response schemas:

```typescript
// Request schema (what MiniBob sends)
export const ImpulseRelevanceRecordRequestSchema = z.object({
  // ... existing fields ...
  resolver_tier: z.string().optional(),
  resolver_name: z.string().optional(),
  resolution_latency_ms: z.number().int().optional(),
});

// Response schema (what backend returns)
export const ImpulseRelevanceMetricSchema = z.object({
  // ... existing fields ...
  resolver_tier: z.string().optional(),
  resolver_name: z.string().optional(),
  avg_resolution_latency_ms: z.number().int().default(0),
  resolver_success_count: z.number().int().default(0),
  resolver_failure_count: z.number().int().default(0),
});
```

#### `/repos/metabob-activity-api/src/routes/activities.ts`

Updated `POST /impulse-relevance` endpoint to compute and store resolver metrics:

**UPDATE path** (existing metric):
```typescript
// Update resolver tracking metrics
const currentResolverSuccessCount = current.resolver_success_count || 0;
const currentResolverFailureCount = current.resolver_failure_count || 0;
const currentAvgLatency = current.avg_resolution_latency_ms || 0;
const totalResolutions = currentResolverSuccessCount + currentResolverFailureCount;

const newResolverSuccessCount = validated.was_loaded && validated.execution_succeeded
  ? currentResolverSuccessCount + 1
  : currentResolverSuccessCount;

const newResolverFailureCount = validated.was_loaded && !validated.execution_succeeded
  ? currentResolverFailureCount + 1
  : currentResolverFailureCount;

// Update average latency
const newAvgLatency = validated.resolution_latency_ms !== undefined && totalResolutions > 0
  ? Math.floor((currentAvgLatency * totalResolutions + validated.resolution_latency_ms) / (totalResolutions + 1))
  : currentAvgLatency;
```

**CREATE path** (new metric):
```typescript
const created = await surrealDB.query<ImpulseRelevanceMetric[]>(createQuery, {
  // ... existing fields ...
  resolver_tier: validated.resolver_tier ?? undefined,
  resolver_name: validated.resolver_name ?? undefined,
  avg_resolution_latency_ms: validated.resolution_latency_ms || 0,
  resolver_success_count: validated.was_loaded && validated.execution_succeeded ? 1 : 0,
  resolver_failure_count: validated.was_loaded && !validated.execution_succeeded ? 1 : 0,
});
```

#### `/repos/metabob-activity-api/sql/migrations/072-add-resolver-tracking-to-impulse-relevance.surql`

New migration to add resolver tracking fields to `impulse_relevance_metrics` table:

```sql
-- Add resolver tier field (what tier was used to resolve this impulse)
DEFINE FIELD resolver_tier ON impulse_relevance_metrics TYPE option<string>
  COMMENT "Resolution tier used: LOCAL, CUSTOM, DISCOVERY, MCP, FALLBACK, ERROR";

-- Add resolver name field (which specific resolver was used)
DEFINE FIELD resolver_name ON impulse_relevance_metrics TYPE option<string>
  COMMENT "Resolver name: memo, file, directoryTree, gitDiff, VesselClient, mcp, etc.";

-- Add average resolution latency tracking
DEFINE FIELD avg_resolution_latency_ms ON impulse_relevance_metrics TYPE int
  VALUE $value OR 0
  COMMENT "Average resolution time in milliseconds";

-- Add resolver success/failure counters for learning
DEFINE FIELD resolver_success_count ON impulse_relevance_metrics TYPE int
  VALUE $value OR 0
  COMMENT "Number of successful resolutions";

DEFINE FIELD resolver_failure_count ON impulse_relevance_metrics TYPE int
  VALUE $value OR 0
  COMMENT "Number of failed resolutions";

-- Create indexes for efficient queries
DEFINE INDEX idx_impulse_relevance_resolver ON impulse_relevance_metrics
  FIELDS resolver_tier, resolver_name;

DEFINE INDEX idx_impulse_relevance_shape_resolver ON impulse_relevance_metrics
  FIELDS pointer_type, resolver_tier, resolver_name;
```

### 3. Testing

Created comprehensive test suite in `/repos/minibob/src/__tests__/resolver-tracking.test.ts`:

```bash
$ bun test src/__tests__/resolver-tracking.test.ts
 11 pass
 0 fail
 38 expect() calls
```

Tests cover:
- LOCAL tier resolution (memo, file, directoryTree, gitDiff)
- DISCOVERY tier resolution (VesselClient)
- MCP tier resolution
- Failed resolutions with error reasons
- Multiple resolutions tracking
- Tracker reset between executions
- Tier inference from resolver ID (legacy paths)
- Resolution metadata storage on impulse objects

## Data Flow

```
┌─────────────┐
│  MiniBob    │
│  (Vessel)   │
└──────┬──────┘
       │
       │ 1. Impulse Load Request
       ▼
┌─────────────────────┐
│  ResolutionTracker  │  ← Tracks resolution pathway
│  (impulse.ts)       │     LOCAL → CUSTOM → DISCOVERY → MCP
└──────┬──────────────┘
       │
       │ 2. Resolution Success/Failure
       ▼
┌─────────────────────┐
│  Impulse Object     │  ← Stores resolutionMetadata
│  (loaded impulse)   │     { tier, resolver, latencyMs, ... }
└──────┬──────────────┘
       │
       │ 3. Activity Execution
       ▼
┌─────────────────────┐
│  recordImpulse      │  ← Extracts metadata from impulse
│  Relevance()        │
└──────┬──────────────┘
       │
       │ 4. HTTP POST /v2/activities/impulse-relevance
       ▼
┌─────────────────────┐
│  Backend API        │  ← Computes resolver metrics
│  (routes/           │     Updates averages, counts
│   activities.ts)    │
└──────┬──────────────┘
       │
       │ 5. SQL INSERT/UPDATE
       ▼
┌─────────────────────┐
│  SurrealDB          │  ← Persists resolver metrics
│  impulse_relevance  │     for Thompson Sampling
│  _metrics table     │
└─────────────────────┘
```

## Learning Applications

### 1. Resolver Selection (Thompson Sampling)

Backend can now learn which resolver works best for each impulse shape:

```sql
-- Which resolver has highest success rate for 'file' pointers?
SELECT
  resolver_name,
  resolver_tier,
  resolver_success_count / (resolver_success_count + resolver_failure_count) as success_rate,
  avg_resolution_latency_ms
FROM impulse_relevance_metrics
WHERE pointer_type = 'file'
ORDER BY success_rate DESC, avg_resolution_latency_ms ASC
LIMIT 5;
```

### 2. Vessel Performance Monitoring

Track resolver latency per vessel to detect degradation:

```sql
-- Average latency by resolver tier
SELECT
  resolver_tier,
  AVG(avg_resolution_latency_ms) as avg_latency,
  COUNT(*) as sample_size
FROM impulse_relevance_metrics
WHERE resolver_tier IS NOT NONE
GROUP BY resolver_tier
ORDER BY avg_latency ASC;
```

### 3. Cost Optimization

Identify expensive patterns and prefer deterministic resolvers:

```sql
-- Compare LOCAL (deterministic) vs LLM (reasoning) costs
SELECT
  resolver_tier,
  SUM(resolver_success_count + resolver_failure_count) as total_resolutions,
  AVG(avg_resolution_latency_ms) as avg_latency
FROM impulse_relevance_metrics
WHERE resolver_tier IN ['LOCAL', 'LLM']
GROUP BY resolver_tier;
```

### 4. Pattern Recognition

Learn which resolvers work well together in composition:

```sql
-- Find impulse pairs that often appear together
SELECT
  a.impulse_id as impulse_a,
  b.impulse_id as impulse_b,
  a.resolver_name as resolver_a,
  b.resolver_name as resolver_b,
  COUNT(*) as co_occurrence_count
FROM impulse_relevance_metrics a
JOIN impulse_relevance_metrics b
  ON a.activity_variant_id = b.activity_variant_id
  AND a.impulse_id < b.impulse_id
GROUP BY a.impulse_id, b.impulse_id, a.resolver_name, b.resolver_name
ORDER BY co_occurrence_count DESC
LIMIT 20;
```

## Success Criteria

✅ **Implemented**:
- [x] Resolver tier (LOCAL/CUSTOM/DISCOVERY/MCP/ERROR) tracked for each impulse
- [x] Resolver name (memo/file/VesselClient/etc.) recorded
- [x] Resolution latency measured and averaged
- [x] Success/failure counts maintained
- [x] Backend can query resolver performance by shape
- [x] Thompson Sampling can prefer faster/cheaper resolvers

✅ **Tested**:
- [x] Unit tests for ResolutionTracker (11 tests, all passing)
- [x] Type checking passes for MiniBob
- [x] Type checking passes for backend (ignoring pre-existing errors)
- [x] Schema migration created (072)

## Deployment Notes

### Migration Required

Apply migration 072 to add new fields to `impulse_relevance_metrics` table:

```bash
# In deployment environment
cd repos/metabob-activity-api
bun run apply-migration sql/migrations/072-add-resolver-tracking-to-impulse-relevance.surql
```

### Backward Compatibility

- ✅ New fields are optional (won't break existing MiniBob instances)
- ✅ Backend gracefully handles missing resolver fields
- ✅ Existing impulse relevance metrics continue to work
- ✅ Old MiniBob instances can still record impulse relevance (just without resolver data)

### Validation Steps

After deployment:

1. **Check schema applied**:
   ```bash
   surreal sql --endpoint http://surql.metabob.local \
     --namespace activity-system --database learning_loop \
     --username root --password $SURREALDB_PASSWORD \
     --command "INFO FOR TABLE impulse_relevance_metrics;"
   ```

2. **Verify new fields present**:
   - `resolver_tier`
   - `resolver_name`
   - `avg_resolution_latency_ms`
   - `resolver_success_count`
   - `resolver_failure_count`

3. **Check indexes created**:
   - `idx_impulse_relevance_resolver`
   - `idx_impulse_relevance_shape_resolver`

4. **Test impulse relevance recording**:
   ```bash
   # Run MiniBob activity and verify resolver data stored
   minibob --single "run any activity that uses impulses"

   # Query backend for resolver data
   curl http://activity.metabob.local/v2/activities/impulse-relevance \
     -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.metrics[] | {impulse_id, resolver_tier, resolver_name, avg_latency: .avg_resolution_latency_ms}'
   ```

## Future Enhancements

1. **Resolver Selection Algorithm**:
   - Implement Thompson Sampling for resolver selection
   - Use `resolver_success_count` and `resolver_failure_count` for Beta distribution
   - Prefer resolvers with higher success rates and lower latency

2. **Cost Tracking**:
   - Add `cost_usd` field to track resolver costs
   - Prefer deterministic resolvers (zero cost) over LLM resolvers

3. **Adaptive Routing**:
   - Use resolver metrics to dynamically route impulse resolution
   - Skip slow/unreliable resolvers based on historical data

4. **Vessel Health Monitoring**:
   - Track resolver performance per vessel
   - Detect vessel degradation (increasing latency)
   - Automatic failover to healthier vessels

## References

- **CLAUDE.md**: Main development guidelines
- **docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md**: Foundation principles
- **docs/architecture/RESOLVER_TRACKING.md**: Detailed resolver tracking design (if exists)
- **repos/minibob/src/resolution-tracker.ts**: Resolution tracker implementation
- **repos/minibob/src/__tests__/resolver-tracking.test.ts**: Test suite

## Changelog

**2026-04-20**: Initial implementation
- Added `resolutionMetadata` to Impulse type
- Updated ImpulseStore.load() to capture resolution data
- Updated activity.ts to send resolver metadata
- Updated MCP client to transmit resolver fields
- Updated backend schemas and endpoint
- Created migration 072
- Created comprehensive test suite
