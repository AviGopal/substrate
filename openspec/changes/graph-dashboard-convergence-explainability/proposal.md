# Graph Dashboard: Convergence & Explainability

> **Status**: Proposed
> **Created**: 2026-03-27
> **Hostname**: `graph.metabob.local` (currently `activity-dashboard`)

## Problem Statement

The activity-dashboard at `graph.metabob.local` needs to provide representative information for:

1. **Convergence Detection**: Is the system converging on optimal solutions?
2. **Outcome Explainability**: Why did observed outcomes happen?

Currently, the dashboard shows operational metrics but lacks:
- Time-series visualization of belief convergence
- Selection probability attribution in execution traces
- Impulse contribution analysis
- Edge weights on composition graphs
- Historical trend data for convergence detection

## Solution Overview

Transform the dashboard from an operational monitoring tool into a **learning graph visualizer** that shows:

| Domain | Purpose | Current State | Target State |
|--------|---------|---------------|--------------|
| Informational State | What impulses exist | Basic listing | Shape/relationship graph |
| Activity Selection | Thompson Sampling beliefs | α/β metrics | Convergence trends + selection attribution |
| Impulse Relevance | Which impulses matter | ❌ Missing | Relevance heatmap + contribution scores |
| Traces/Outcomes | Historical executions | Timeline | Explainability drill-down |
| Composition Strength | Activity relationships | Basic tree | Interactive weighted graph |

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI LAYER                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Convergence  │  │ Explainability│  │ Composition  │          │
│  │   Overview   │  │   Drill-down  │  │    Graph     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
│  ┌──────┴─────────────────┴─────────────────┴───────┐          │
│  │              Shared Components                    │          │
│  │  DateRangePicker │ InteractiveGraph │ ExportUtil  │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                         API LAYER                                │
│  /v2/activities/scores          /v2/activities/execution-traces │
│  /v2/activities/corpus-summary  /v2/activities/composition/graph│
│  /v2/activities/impulse-relevance  /v2/activities/tool-usage   │
│  /v2/activities/selection-events (NEW)                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                       DATABASE LAYER                             │
│  v_activity_score (FIX)      │  v_impulse_relevance (NEW)       │
│  v_composition_graph (NEW)   │  thompson_selection_log (NEW)    │
│  variant_performance_metrics │  execution_trace                 │
└─────────────────────────────────────────────────────────────────┘
```

## Logical Groupings

### Group A: Schema Foundation
Schema changes that enable all other features.

- `v_activity_score` view (verify/fix)
- `v_impulse_relevance` view (create)
- `v_composition_graph` view (create)
- `thompson_selection_log` table (create for explainability)
- Selection tracking fix (`total_selections` persistence)

### Group B: Shared UI Components
Reusable components needed by multiple features.

- `DateRangePicker` (used by: traces, corpus, trends)
- `InteractiveGraph` (used by: composition, sequences)
- `ExportUtility` (used by: all data views)
- `HistoricalTrendsChart` (used by: convergence, beliefs)

### Group C: Convergence Dashboard
New view for convergence detection.

- Belief Stability Gauge (aggregate uncertainty)
- Exploration/Exploitation Balance chart
- System Success Rate Trend (rolling 7-day)
- Stable Composition Pattern Count

### Group D: Explainability Enhancements
Enhancements for outcome attribution.

- Selection probability in execution traces
- Impulse contribution table
- Task waterfall chart
- Composition path diagram

### Group E: New Analytics Dashboards
Completely new vertical slices.

- Impulse Relevance Dashboard
- Tool Usage Dashboard
- Execution Sequences Dashboard

### Group F: Existing Component Enhancements
Improvements to working components.

- ActivityBeliefs: Add trend sparklines
- CompositionVisualization: Interactive graph
- ExecutionHistory: Date range filtering
- LearnedCorpus: Convergence indicators

## Dependencies

```
Group A (Schema) ─────┬────────────────────────────────────────┐
                      │                                        │
                      ▼                                        ▼
              Group B (Shared UI)                      Group E (Analytics)
                      │                                        │
          ┌───────────┼───────────┐                           │
          ▼           ▼           ▼                           │
     Group C     Group D     Group F ◄────────────────────────┘
   (Convergence) (Explain)  (Enhance)
```

## Schema Changes Required

### New: `v_impulse_relevance` View
```sql
DEFINE TABLE v_impulse_relevance AS
  SELECT
    impulse_id,
    activity_id,
    org_id,
    count() AS times_loaded,
    count(IF e.success = true THEN 1 ELSE NONE END) AS times_succeeded,
    count(IF e.success = true THEN 1 ELSE NONE END) / count() AS relevance_score
  FROM execution e,
       e.input_impulses AS impulse_id
  GROUP BY impulse_id, activity_id, org_id;
```

### New: `v_composition_graph` View
```sql
DEFINE TABLE v_composition_graph AS
  SELECT
    parent.activity_id AS parent_activity_id,
    child.activity_id AS child_activity_id,
    parent.org_id AS org_id,
    count() AS execution_count,
    count(IF child.success = true THEN 1 ELSE NONE END) AS success_count,
    count(IF child.success = true THEN 1 ELSE NONE END) / count() AS weight,
    time::max(child.executed_at) AS last_executed_at
  FROM execution AS child
  JOIN execution AS parent ON child.parent_execution_id = parent.id
  GROUP BY parent.activity_id, child.activity_id, parent.org_id;
```

### New: `thompson_selection_log` Table
```sql
DEFINE TABLE thompson_selection_log SCHEMAFULL
  PERMISSIONS FOR select WHERE org_id = $auth.org_id
  PERMISSIONS FOR create WHERE $auth.org_id != NONE;

DEFINE FIELD execution_id ON thompson_selection_log TYPE string;
DEFINE FIELD activity_id ON thompson_selection_log TYPE string;
DEFINE FIELD thompson_sample ON thompson_selection_log TYPE float;
DEFINE FIELD alpha ON thompson_selection_log TYPE float;
DEFINE FIELD beta ON thompson_selection_log TYPE float;
DEFINE FIELD org_id ON thompson_selection_log TYPE record<organizations>;
DEFINE FIELD selected_at ON thompson_selection_log TYPE datetime
  VALUE $value OR time::now();
```

## API Changes Required

### New Endpoint: Selection Event Logging
```
POST /v2/activities/selection-events
{
  "execution_id": "exec-123",
  "activity_id": "debug-null-pointer",
  "thompson_sample": 0.87,
  "alpha": 12,
  "beta": 3
}
```

### Enhanced Endpoint: Execution Traces
Add `selection_probability` and `selection_method` to response:
```json
{
  "execution_id": "exec-123",
  "selection_method": "thompson_sampling",
  "selection_probability": 0.87,
  ...
}
```

## Success Criteria

### Convergence Detection
- [ ] Can visualize uncertainty trend over time
- [ ] Can see exploration/exploitation ratio shifting
- [ ] Can identify when beliefs have stabilized
- [ ] Can detect when patterns are solidifying

### Outcome Explainability
- [ ] Given any execution, can explain WHY that activity was selected
- [ ] Can see which impulses contributed to success/failure
- [ ] Can trace the composition path taken
- [ ] Can see state transitions (before/after)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Schema migrations break existing queries | High | Test in staging, use dual-write pattern |
| Interactive graph performance with large datasets | Medium | Implement pagination, lazy loading |
| Selection logging adds latency to requests | Low | Make logging async, batch writes |
| Time-series queries slow without proper indexes | Medium | Add indexes in Milestone 1 |

## Out of Scope

- Real-time streaming (WebSocket already handles this)
- Machine learning model for convergence prediction
- Automatic activity selection tuning
- Multi-tenant dashboard views (single org for now)
