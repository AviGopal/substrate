# Runtime Tracing Example: Activity Template Endpoint

This example shows how to instrument the `GET /v2/activities/templates` endpoint to track runtime performance and identify optimization opportunities.

> **Naming note (2026-04):** This example uses the `runtimeTracingMiddleware` / `withResolver` API in `repos/metabob-activity-api/src/middleware/runtime-tracing.ts` — the server-side request tracer. On the client side, `repos/minibob` renamed its tracer module from `runtime-tracing.ts` to `activity-tracer.ts` (interface `ActivityTracer`, env var `ACTIVITY_TRACER_ENABLED`). The two share the same trace schema but are separate modules.

## Before: Untraced

```typescript
// repos/metabob-activity-api/src/routes/activities.ts

app.get('/v2/activities/templates', async (c) => {
  const db = await createAuthenticatedClient(c);
  const templates = await db.query('SELECT * FROM activity_template');
  return c.json(templates);
});
```

**Problems:**
- No visibility into how often this is called
- No performance metrics
- Can't identify if DB query is slow
- Can't learn usage patterns

## After: Request-Level Tracing

```typescript
// repos/metabob-activity-api/src/index.ts

import { runtimeTracingMiddleware } from './middleware/runtime-tracing';

const tracingConfig = {
  enabled: process.env.RUNTIME_TRACING_ENABLED !== 'false', // Default on
  level: 'function' as const,
  sampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0.10,
  storeEndpoint: process.env.METABOB_ENDPOINT || 'https://activity.metabob.com',
  // Set VESSEL_ID explicitly in deployment manifests; the hostname fallback
  // used in older revisions has been dropped in minibob (client side) and
  // should be avoided for server-side tracing too.
  vesselId: process.env.VESSEL_ID || `activity-api-${Date.now()}`
};

app.use('*', runtimeTracingMiddleware(tracingConfig));

// Now all requests automatically traced
```

**Result:**
Execution trace stored:
```json
{
  "id": "runtime_1713715200_abc123",
  "activity_template_id": "http_get_v2_activities_templates",
  "vessel_id": "activity-api-pod-7f8c9d",
  "impulse_resolutions": [],
  "duration_ms": 523,
  "total_cost_usd": 0,
  "success": true,
  "metadata": {
    "runtime_trace": true,
    "status_code": 200,
    "resolver_count": 0
  }
}
```

**What we learn:**
- Endpoint called X times per day
- Average response time: 523ms
- Success rate: 98.7%

## Better: Function-Level Tracing

```typescript
// repos/metabob-activity-api/src/routes/activities.ts

import { withResolver } from '../middleware/runtime-tracing';

// Wrap DB query as traced resolver
const fetchTemplatesFromDB = withResolver(
  'surrealdb_fetch_templates',
  'deterministic',
  async (db: SurrealDB, c: Context) => {
    return await db.query('SELECT * FROM activity_template');
  }
);

// Wrap Thompson Sampling logic
const filterByCategory = withResolver(
  'filter_templates_by_category',
  'deterministic',
  async (templates: any[], category: string | undefined, c: Context) => {
    if (!category) return templates;
    return templates.filter(t => t.category === category);
  }
);

const sortBySuccessRate = withResolver(
  'sort_templates_by_success_rate',
  'pattern',
  async (templates: any[], c: Context) => {
    return templates.sort((a, b) => b.success_rate - a.success_rate);
  }
);

// Instrumented route
app.get('/v2/activities/templates', async (c) => {
  const db = await createAuthenticatedClient(c);
  const category = c.req.query('category');

  // Each step is traced
  const allTemplates = await fetchTemplatesFromDB(db, c);
  const filtered = await filterByCategory(allTemplates, category, c);
  const sorted = await sortBySuccessRate(filtered, c);

  return c.json(sorted);
});
```

**Result:**
Execution trace with resolver breakdown:
```json
{
  "id": "runtime_1713715200_abc123",
  "activity_template_id": "http_get_v2_activities_templates",
  "vessel_id": "activity-api-pod-7f8c9d",
  "impulse_resolutions": [
    {
      "impulse_id": "surrealdb_fetch_templates_1713715200123",
      "resolver_id": "surrealdb_fetch_templates",
      "resolver_tier": "deterministic",
      "vessel_id": "activity-api-pod-7f8c9d",
      "latency_ms": 487,  // BOTTLENECK!
      "cost_usd": 0
    },
    {
      "impulse_id": "filter_templates_by_category_1713715200624",
      "resolver_id": "filter_templates_by_category",
      "resolver_tier": "deterministic",
      "vessel_id": "activity-api-pod-7f8c9d",
      "latency_ms": 12,
      "cost_usd": 0
    },
    {
      "impulse_id": "sort_templates_by_success_rate_1713715200641",
      "resolver_id": "sort_templates_by_success_rate",
      "resolver_tier": "pattern",
      "vessel_id": "activity-api-pod-7f8c9d",
      "latency_ms": 23,
      "cost_usd": 0
    }
  ],
  "duration_ms": 523,
  "total_cost_usd": 0,
  "success": true,
  "metadata": {
    "runtime_trace": true,
    "status_code": 200,
    "resolver_count": 3
  }
}
```

**What we learn:**
- ✅ Request takes 523ms total
- 🔴 **DB query takes 487ms (93% of time)** ← BOTTLENECK
- ✅ Filtering takes 12ms (negligible)
- ✅ Sorting takes 23ms (acceptable)

**Optimization target identified:** `surrealdb_fetch_templates`

## Dashboard Visualization

After collecting 1,000 traces over a week:

### Hot Paths
```
Endpoint                              Calls    Avg Latency   P95      Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GET  /v2/activities/templates         8,234    523ms        892ms    🔴 SLOW
POST /v2/activities/recommend         3,421    234ms        387ms    ✅ OK
GET  /health                          15,678   12ms         18ms     ✅ OK
POST /v2/impulses/resolve             1,987    156ms        243ms    ✅ OK
```

### Resolver Performance
```
Resolver                      Calls    Avg Latency   P95      Bottleneck?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
surrealdb_fetch_templates     8,234    487ms        892ms    🔴 YES
sort_templates_by_success_rate 6,123   23ms         31ms     ✅ OK
filter_templates_by_category   4,876   12ms         17ms     ✅ OK
validate_jwt                  13,562   8ms          12ms     ✅ OK
```

**Insight:** `surrealdb_fetch_templates` is called 8,234 times, taking 487ms average.
**Total time wasted:** 8,234 × 487ms = 4,010 seconds = 67 minutes per week

## Optimization: Add Caching

```typescript
// repos/metabob-activity-api/src/routes/activities.ts

import { withResolver } from '../middleware/runtime-tracing';

// Cache layer (in-memory, 60s TTL)
const templateCache = new Map<string, { data: any[]; expires: number }>();

const fetchTemplatesWithCache = withResolver(
  'cached_fetch_templates',
  'deterministic',
  async (db: SurrealDB, c: Context) => {
    const cacheKey = 'all_templates';
    const cached = templateCache.get(cacheKey);

    if (cached && cached.expires > Date.now()) {
      return cached.data; // Cache hit
    }

    // Cache miss - query DB
    const templates = await db.query('SELECT * FROM activity_template');

    templateCache.set(cacheKey, {
      data: templates,
      expires: Date.now() + 60_000 // 60s TTL
    });

    return templates;
  }
);

app.get('/v2/activities/templates', async (c) => {
  const db = await createAuthenticatedClient(c);
  const category = c.req.query('category');

  const allTemplates = await fetchTemplatesWithCache(db, c); // Now cached
  const filtered = await filterByCategory(allTemplates, category, c);
  const sorted = await sortBySuccessRate(filtered, c);

  return c.json(sorted);
});
```

## A/B Test: Cached vs Uncached

Deploy both variants:
- 50% traffic → `fetchTemplatesFromDB` (uncached)
- 50% traffic → `fetchTemplatesWithCache` (cached)

After 1 week, query traces:

```sql
-- Compare cached vs uncached performance
SELECT
  resolution.resolver_id,
  COUNT() as call_count,
  AVG(resolution.latency_ms) as avg_latency_ms,
  math::percentile(resolution.latency_ms, 0.95) as p95_latency_ms
FROM execution,
     execution.impulse_resolutions as resolution
WHERE resolution.resolver_id IN ['surrealdb_fetch_templates', 'cached_fetch_templates']
  AND execution.created_at > time::now() - 7d
GROUP BY resolution.resolver_id;
```

**Result:**
```
Resolver                      Calls    Avg Latency   P95
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
surrealdb_fetch_templates     4,117    487ms        892ms   (control)
cached_fetch_templates        4,117    23ms         487ms   (cached variant)
                                       ↓ 95% faster ↑
```

**Thompson Sampling learns:**
- Cached variant: 95% faster, same success rate
- Automatically routes 100% traffic to cached variant
- Uncached variant deprecated

## Automated Refactoring Suggestion

After detecting this pattern, the system creates an activity:

```json
{
  "id": "optimize_fetch_templates",
  "name": "Add caching to surrealdb_fetch_templates",
  "category": "refactor",
  "priority": "high",
  "reason": "Resolver called 8,234 times/week with 487ms avg latency. Total time: 67 min/week. Cache hit rate would be ~90% based on access patterns.",
  "tasks": [
    {
      "id": "add_cache_layer",
      "description": "Add in-memory cache with 60s TTL to surrealdb_fetch_templates",
      "validation": {
        "requiredPatterns": ["templateCache", "Map<string"],
        "successCriteria": "Avg latency < 50ms after deployment"
      }
    }
  ]
}
```

**MiniBob executes the activity:**
1. Reads the runtime traces
2. Implements caching
3. Deploys to canary
4. Waits for new runtime traces
5. Validates: latency dropped from 487ms → 23ms ✅
6. Auto-promotes to production

**The system optimized itself based on runtime data.**

## Learning Outcomes

After 1 month of runtime tracing:

### Hot Paths Identified
- `GET /v2/activities/templates`: 32K calls, avg 487ms → **OPTIMIZED (cache added)**
- `POST /v2/activities/recommend`: 14K calls, avg 234ms → **acceptable**
- `POST /v2/impulses/resolve`: 8K calls, avg 156ms → **acceptable**

### Bottlenecks Fixed
1. ✅ Template fetching: Cache added (487ms → 23ms)
2. ✅ Thompson Sampling: Indexed filtering (234ms → 87ms)
3. ✅ JWT validation: Connection pooling (45ms → 8ms)

### Reuse Opportunities
- `validate_jwt`: Used in 87% of endpoints → extracted to shared middleware
- `format_json_response`: Used in 23 endpoints → standardized signature
- `error_handler`: Used in 18 endpoints → extracted to utility

### Cost Savings
- DB query reduction: 67 min/week → 4 min/week (cache hit rate: 94%)
- Infrastructure cost: $45/month → $23/month (fewer DB connections needed)

## Next Steps

1. **Enable in canary** (10% sampling)
   ```bash
   export RUNTIME_TRACING_ENABLED=true
   ./scripts/deploy-canary.sh
   ```

2. **Monitor trace volume**
   ```bash
   curl https://activity.metabob.com/v2/activities/execution-traces?runtime_trace=true | jq 'length'
   ```

3. **View dashboard**
   - Visit https://internal.metabob.com/runtime
   - Check "Hot Paths" and "Resolver Performance"

4. **Optimize based on data**
   - Identify bottlenecks (high latency + high frequency)
   - Implement fixes
   - Deploy to canary
   - Compare traces before/after
   - Promote if successful

5. **Enable in production** (1% sampling)
   ```bash
   export RUNTIME_TRACING_ENABLED=true
   export SAMPLE_RATE=0.01
   ./scripts/promote-canary-to-production.sh
   ```

## Summary

**Runtime tracing uses the same activity/impulse infrastructure to:**
- ✅ Track which code paths are executed frequently
- ✅ Identify performance bottlenecks
- ✅ Learn optimization opportunities
- ✅ A/B test code variants
- ✅ Self-optimize based on runtime data

**The application becomes a vessel that learns how to improve itself.**
