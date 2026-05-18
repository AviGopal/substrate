# metabob-internal-dashboard Gap Analysis

> **Purpose**: Analyze the current implementation against the Impulse-Activity Foundation principles
> **Source**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
> **Target**: `repos/metabob-internal-dashboard/`

---

## Executive Summary

The internal dashboard has **partial alignment** with the foundation. It correctly models UI components as impulses and uses WebSocket for real-time updates. However, the critical gap is that **query processing bypasses the activity system** - MiniBob uses GoalProcessor directly rather than executing activities with recorded traces.

**Alignment Score**: 4/8 foundational principles implemented

---

## Point-by-Point Gap Analysis

### 1. UI Components as Impulses

| Aspect | Status |
|--------|--------|
| CURRENT | UI components ARE modeled as impulses with `type: 'ui_component'` pointer |
| DESIRED | UI components should be impulses with metadata for LLM reasoning |
| GAP | **Partial** - Has pointer/metadata structure but metadata is minimal |
| CHANGE | Enrich `UIComponentMetadata` with `summary`, `dataShape`, `availableOps` |

**Current Implementation** (`src/lib/impulse-types.ts:61-88`):
```typescript
interface UIComponentPointer extends ImpulsePointer {
  type: 'ui_component'
  primitive: Primitive
  position?: PositionMode
  // ...
}
```

**Missing per Foundation**:
- `metadata.summary` for LLM context (what this component shows)
- `metadata.dataShape` describing the data structure
- `metadata.availableOps` listing what actions can be performed
- `budget` is always 0 - should estimate visual/interaction complexity

---

### 2. Query Processing via Activities

| Aspect | Status |
|--------|--------|
| CURRENT | Queries go to `GoalProcessor.executeGoal()` directly |
| DESIRED | Queries should be impulses that trigger activity matching |
| GAP | **Critical** - No activity templates for dashboard operations |
| CHANGE | Create activity templates for dashboard queries, route through activity system |

**Current Implementation** (`src/lib/minibob-integration.ts:366-378`):
```typescript
const result = await this.goalProcessor.executeGoal(query.text, {
  sessionId,
  previousMessages: context.messages,
})
```

**Missing per Foundation**:
- No query → impulse conversion
- No activity matching based on query shape
- No Thompson Sampling for activity selection
- No execution trace recording
- Improvisation happens without recording

**Required Flow**:
```
Query → Create goal impulse → Match activities → Execute selected activity → Record trace
```

---

### 3. Resolvers Live Where Data Is

| Aspect | Status |
|--------|--------|
| CURRENT | `query_activity_api` tool fetches from backend directly |
| DESIRED | Backend data should be resolved via proper impulse resolution |
| GAP | **Moderate** - Direct API calls bypass impulse system |
| CHANGE | Create impulse pointers for backend data, use impulse resolution |

**Current Implementation** (`src/lib/minibob-integration.ts:244-279`):
```typescript
query_activity_api: {
  handler: async (params) => {
    const response = await fetch(url, {...})
    // Direct fetch, no impulse creation
  }
}
```

**Should Be**:
```typescript
// Create impulse pointer
{ type: 'activityMetrics', endpoint: '/v2/activities/metrics' }
// Resolve via impulse system
const impulse = await resolveImpulse(pointer)
```

---

### 4. Metadata First, Content Later

| Aspect | Status |
|--------|--------|
| CURRENT | UI impulses created with full primitive trees immediately |
| DESIRED | Create impulse with metadata, let renderer resolve content |
| GAP | **Moderate** - No lazy loading pattern |
| CHANGE | Support `dataRef` pattern where UI points to data impulse |

**Current Implementation** (`src/lib/websocket-handler.ts:139-171`):
```typescript
interface UIComponentImpulse {
  primitive: Primitive  // Full data embedded
  dataRef?: string      // Present but unused
}
```

**Foundation Pattern**:
```typescript
// UI impulse with dataRef
{
  id: 'metrics-chart',
  primitive: { type: 'chart', dataRef: 'metrics-data-1' },
  dataRef: 'metrics-data-1'
}

// Separate data impulse
{
  id: 'metrics-data-1',
  pointer: { type: 'metrics', name: 'success_rate' },
  loaded: false,
  content: null  // Lazy loaded
}
```

---

### 5. Trace Recording for Learning

| Aspect | Status |
|--------|--------|
| CURRENT | No traces recorded for dashboard interactions |
| DESIRED | Every query → activity execution should produce a trace |
| GAP | **Critical** - Zero learning from dashboard usage |
| CHANGE | Record execution traces via activity system |

**Current Implementation**: No trace recording at all.

**Foundation Requirement**:
```typescript
{
  trace_id: "exec-123",
  activity_id: "dashboard-show-metrics",
  input_impulses: [
    { type: "goal", shape: "user_request", summary: "Show system health" }
  ],
  tasks: [...],
  output_impulses: [
    { type: "ui_component", shape: "chart", ... }
  ],
  outcome: { success: true, duration_ms: 1200 }
}
```

---

### 6. Activity Matching with Thompson Sampling

| Aspect | Status |
|--------|--------|
| CURRENT | No activity templates for dashboard operations |
| DESIRED | Multiple activity variants competing via Thompson Sampling |
| GAP | **Critical** - No activity-based UI generation |
| CHANGE | Create activity templates, integrate Thompson Sampling |

**Current Implementation**: GoalProcessor has no dashboard-specific activities.

**Required**:
- `dashboard-show-health` activity template
- `dashboard-query-templates` activity template
- `dashboard-show-executions` activity template
- Each with Thompson Sampling state (alpha/beta)

---

### 7. Improvisation with Recording

| Aspect | Status |
|--------|--------|
| CURRENT | Demo mode creates hardcoded UI, no recording |
| DESIRED | Improvised UI creation should be recorded for ribosome extraction |
| GAP | **Critical** - Improvisation happens but is not recorded |
| CHANGE | Record improvisation traces, enable ribosome pattern |

**Current Implementation** (`src/lib/minibob-integration.ts:426-463`):
```typescript
private async handleDemoQuery(query: QueryMessage, sessionId: string) {
  // Creates hardcoded UI
  // NO trace recording
  // NO ribosome extraction possible
}
```

**Foundation Requirement**:
```typescript
{
  trace_type: "improvisation",
  steps: [
    { tool: "create_ui_component", params: {...}, result: {...} }
  ],
  reasoning: ["No matching activity, improvising based on query"],
  outcome: { success: true },
  learning: { if_successful: "extract as activity template" }
}
```

---

### 8. LLMs as Tools, Not Controllers

| Aspect | Status |
|--------|--------|
| CURRENT | LLM drives everything via GoalProcessor |
| DESIRED | LLM used only for reasoning/generation steps, deterministic otherwise |
| GAP | **Moderate** - Over-reliance on LLM for simple operations |
| CHANGE | Use deterministic resolvers for known query patterns |

**Current Implementation**: Every query goes through LLM.

**Optimization Opportunity**:
```typescript
// Known patterns should be deterministic
"show health" → deterministic resolver: query /health, render badge
"list templates" → deterministic resolver: query /templates, render table

// LLM only for ambiguous queries
"what went wrong yesterday" → needs LLM reasoning
```

---

## Implementation Alignment Checklist

Per Foundation section "Implementation Alignment Checklist":

| Principle | Status | Evidence |
|-----------|--------|----------|
| Treats data as impulses with metadata | Partial | UIComponentImpulse has structure but minimal metadata |
| Uses activities to constrain search | No | GoalProcessor bypasses activity system |
| Resolvers live where data is | No | Direct API calls, no impulse resolution |
| Records traces for learning | No | No trace recording implemented |
| Avoids unnecessary LLM usage | No | Every query uses LLM |
| Allows improvisation with recording | No | Demo mode improvises without recording |
| Backend limited to trace/patterns | N/A | Backend not being used properly |
| Patterns can be extracted/reused | No | No ribosome integration |

---

## Required Changes for Full Alignment

### Phase 1: Activity Templates for Dashboard

Create activity templates in `repos/metabob-activity-api/templates/`:

```json
{
  "id": "dashboard-show-system-health",
  "name": "Show System Health",
  "inputSchema": {
    "required": [{ "shape": "goal" }]
  },
  "outputSchema": {
    "produces": [{ "shape": "ui_component" }]
  },
  "tasks": [
    {
      "id": "fetch-health",
      "resolver": "http",
      "params": { "endpoint": "/health" }
    },
    {
      "id": "render-ui",
      "resolver": "ui",
      "params": { "template": "health-badge" }
    }
  ]
}
```

### Phase 2: Query → Activity Routing

Modify `MiniBobIntegration.handleQuery()`:

```typescript
async handleQuery(query: QueryMessage, sessionId: string) {
  // 1. Create goal impulse
  const goalImpulse = createImpulse({
    pointer: { type: 'goal', content: query.text },
    metadata: { shape: 'user_request' }
  })

  // 2. Match activities via Thompson Sampling
  const activities = await recommendActivities(goalImpulse)

  // 3. Execute best match
  const result = await executeActivity(activities[0], [goalImpulse])

  // 4. Record trace (happens automatically in activity execution)
}
```

### Phase 3: Trace Recording Integration

Add to `MiniBobIntegration`:

```typescript
private async recordTrace(
  activityId: string,
  inputs: Impulse[],
  outputs: Impulse[],
  outcome: { success: boolean; duration: number }
) {
  await fetch('/v2/traces', {
    method: 'POST',
    body: JSON.stringify({
      activity_id: activityId,
      input_impulses: inputs,
      output_impulses: outputs,
      outcome
    })
  })
}
```

### Phase 4: Impulse Resolution for Backend Data

Replace direct API calls with impulse resolution:

```typescript
// Instead of
const data = await fetch('/v2/activities/metrics').then(r => r.json())

// Use
const metricsImpulse = createImpulse({
  pointer: { type: 'activityMetrics', window: '1h' },
  loaded: false
})
const resolved = await resolveImpulse(metricsImpulse)
```

### Phase 5: Ribosome for Improvisation

When GoalProcessor improvises, capture for ribosome:

```typescript
// After successful improvisation
if (result.improvised && result.success) {
  const template = await ribosome.extract(result.trace)
  await registerActivity(template)
}
```

---

## Priority Order

1. **Critical**: Trace recording - without this, no learning
2. **Critical**: Activity templates for common dashboard queries
3. **High**: Query → Activity routing
4. **Medium**: Impulse resolution for backend data
5. **Medium**: Ribosome integration
6. **Low**: Deterministic resolvers for known patterns

---

## Success Metrics

After implementation:

- [ ] Dashboard queries produce execution traces in trace store
- [ ] Thompson Sampling selects between dashboard activity variants
- [ ] Improvised UI patterns get extracted as activity templates
- [ ] Dashboard activity success rates visible in learning metrics
- [ ] Backend data accessed through impulse resolution pattern

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/minibob-integration.ts` | Add activity routing, trace recording |
| `src/lib/impulse-types.ts` | Enrich metadata, add resolver patterns |
| `src/lib/websocket-handler.ts` | Add trace event broadcasting |
| `create-dashboard-templates.ts` | Create activity templates |
| New: `src/lib/activity-router.ts` | Activity matching logic |
| New: `src/lib/trace-recorder.ts` | Trace recording to backend |
