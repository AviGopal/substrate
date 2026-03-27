# Graph Dashboard Design

## Technical Decisions

### 1. Graph Visualization Library

**Decision**: Use React Flow for interactive graphs

**Rationale**:
- Native React integration (vs D3.js which fights React's DOM model)
- Built-in zoom, pan, selection
- Good TypeScript support
- Active maintenance
- Already works well with shadcn styling

**Alternative Considered**: D3.js
- Pro: More flexible, powerful
- Con: Requires careful integration with React, steeper learning curve

### 2. Time-Series Charts

**Decision**: Use Recharts (already in project)

**Rationale**:
- Already a dependency (`package.json` line 30)
- Consistent with existing charts
- Good enough for dashboard needs
- Lighter than Chart.js

### 3. Selection Logging Strategy

**Decision**: Async logging with fire-and-forget

**Rationale**:
- Selection tracking should not add latency to `/recommend` endpoint
- Acceptable to lose occasional logs (not critical path)
- Can batch logs for performance

**Implementation**:
```typescript
// In activities.ts recommend endpoint
const selection = betaSample(alpha, beta);

// Fire-and-forget async logging
logSelectionEvent({
  execution_id: context.execution_id,
  activity_id: selected.activity_id,
  thompson_sample: selection,
  alpha, beta
}).catch(err => console.warn('Selection log failed:', err));

return selectedActivity;
```

### 4. View Computation Strategy

**Decision**: Computed views in SurrealDB (not materialized)

**Rationale**:
- Data volume is low enough for real-time computation
- Avoids stale data issues
- Simpler operations (no refresh jobs)
- Can add materialization later if needed

**Trade-off**: Slightly slower queries, but acceptable for dashboard use.

### 5. Date Range Implementation

**Decision**: Server-side filtering with timestamp indexes

**Rationale**:
- Don't transfer unnecessary data over network
- Database can use indexes efficiently
- Client-side filtering would require loading all data

**API Pattern**:
```
GET /v2/activities/execution-traces?start_date=2026-03-20&end_date=2026-03-27
```

### 6. Convergence Calculation Location

**Decision**: Client-side calculation from raw α/β

**Rationale**:
- Uncertainty formula is simple: `sqrt((α*β) / ((α+β)² * (α+β+1)))`
- Allows UI to adjust thresholds without API changes
- Reduces API complexity
- Thompson sampling helper already exists in `thompson.ts`

### 7. Export Implementation

**Decision**: Client-side CSV/JSON generation

**Rationale**:
- Data already loaded in browser
- No server load for exports
- Instant response
- Standard browser download API

**Implementation**:
```typescript
const exportCSV = (data: any[], filename: string) => {
  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  // Trigger download...
};
```

### 8. WebSocket Updates for Composition

**Decision**: Broadcast `composition_edge_created` events

**Rationale**:
- Composition graph should update live
- Consistent with existing WebSocket pattern
- Minimal new infrastructure

**Message Format**:
```json
{
  "type": "composition_edge_created",
  "timestamp": "2026-03-27T10:30:00Z",
  "data": {
    "parent_activity_id": "debug-null",
    "child_activity_id": "fix-type-error",
    "execution_id": "exec-123",
    "success": true
  }
}
```

## Data Contracts

### Convergence Metrics Response

```typescript
interface ConvergenceMetrics {
  belief_stability: {
    stable_count: number;      // Activities with uncertainty <10%
    unstable_count: number;    // Activities with uncertainty >15%
    total_count: number;
    stability_ratio: number;   // stable_count / total_count
  };
  exploration_balance: {
    exploration_count: number; // <5 executions
    exploitation_count: number; // ≥10 executions
    transition_count: number;  // 5-9 executions
    exploitation_ratio: number;
  };
  success_trend: {
    period: string;            // "7d", "30d"
    data_points: Array<{
      date: string;
      success_rate: number;
      execution_count: number;
    }>;
  };
  composition_patterns: {
    stable_edges: number;      // reliability >0.8, execution_count ≥10
    total_edges: number;
    pattern_stability: number;
  };
}
```

### Execution Explainability Response

```typescript
interface ExecutionExplainability {
  execution_id: string;

  selection: {
    method: 'thompson_sampling' | 'exploration_forced' | 'improvisation';
    probability: number;       // Thompson sample value
    alpha_at_selection: number;
    beta_at_selection: number;
    confidence_interval: [number, number]; // 5th, 95th percentile
  };

  impulse_contributions: Array<{
    impulse_id: string;
    shape: string;
    relevance_score: number;
    success_rate_with: number;    // Success rate when this impulse loaded
    success_rate_without: number; // Success rate when not loaded
    contribution: number;         // Lift in success probability
  }>;

  task_timeline: Array<{
    task_id: string;
    description: string;
    start_ms: number;
    duration_ms: number;
    status: 'success' | 'failure';
    tool_calls: Array<{
      tool: string;
      duration_ms: number;
      success: boolean;
    }>;
  }>;

  composition_path: {
    nodes: Array<{
      execution_id: string;
      activity_id: string;
      success: boolean;
      depth: number;
    }>;
    edges: Array<{
      source: string;
      target: string;
      data_passed: string[];
    }>;
  };
}
```

### Impulse Relevance Response

```typescript
interface ImpulseRelevanceResponse {
  metrics: Array<{
    impulse_id: string;
    activity_id: string;
    impulse_shape: string;
    times_loaded: number;
    times_succeeded: number;
    times_failed: number;
    relevance_score: number;    // times_succeeded / times_loaded
    confidence: number;         // Based on sample size
  }>;
  total: number;
  filters_applied: {
    activity_id?: string;
    min_relevance?: number;
  };
}
```

## Component Architecture

### Convergence Overview

```
ConvergenceOverview
├── ConvergenceHeader (title + refresh button)
├── MetricsGrid (4-column)
│   ├── BeliefStabilityGauge
│   ├── ExplorationBalanceBar
│   ├── PatternCountCard
│   └── SuccessRateTrend (sparkline)
├── TrendChart (full-width line chart)
└── ActivityConvergenceTable
    └── Row per activity with convergence status
```

### Execution Explainability

```
ExecutionExplainability
├── SelectionCard
│   ├── Method badge
│   ├── Probability bar
│   └── Confidence interval
├── ImpulseContributionTable
│   └── Row per impulse with relevance
├── TaskWaterfall
│   └── Horizontal bars for each task
└── CompositionPath (if multi-activity)
    └── InteractiveGraph (mini version)
```

### Interactive Composition Graph

```
CompositionGraph
├── GraphControls
│   ├── DateRangePicker
│   ├── DepthSlider (1-5)
│   └── FilterByActivity
├── InteractiveGraph (React Flow)
│   ├── ActivityNode (custom node type)
│   ├── CompositionEdge (custom edge with weight)
│   └── Controls (zoom, fit, export)
├── GraphLegend
│   ├── Node type colors
│   └── Edge weight scale
└── DetailPanel (on selection)
    └── Node/Edge details
```

## State Management

### Local State (React useState/useReducer)
- Filter selections (date range, activity filter)
- UI state (expanded rows, selected nodes)
- Modal open/close

### Server State (Custom Hooks)
- `useConvergence()` → Convergence metrics
- `useImpulseRelevance()` → Impulse data
- `useToolUsage()` → Tool patterns
- `useCompositionGraph()` → Graph data

### Shared State (Context, if needed)
- Selected date range (used by multiple views)
- Auth token (already in useAuth)

**Note**: Avoid global state library (Redux/Zustand) unless complexity grows significantly. Current custom hooks pattern is sufficient.

## Performance Considerations

### Lazy Loading
- Analytics tabs (Impulses, Tools) load on first visit
- Large graphs paginate or virtualize nodes

### Caching
- Use `stale-while-revalidate` pattern in hooks
- Cache composition graph for 30s
- Don't cache convergence metrics (always fresh)

### Debouncing
- Date range picker debounces API calls (300ms)
- Search filters debounce (200ms)

### Pagination
- Execution history: 50 per page
- Impulse relevance: 100 per page
- Tool usage: 100 per page
