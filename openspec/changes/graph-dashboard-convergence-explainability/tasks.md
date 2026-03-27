# Graph Dashboard Implementation Tasks

> **Estimated Duration**: 12-15 days (1 dev), 8-10 days (2 devs parallel)
> **Working State**: Each milestone ends with deployable, testable functionality

---

## Milestone 1: Schema Foundation
**Goal**: Fix data contracts before building on them
**Commit**: `feat(schema): add convergence and explainability views`

### Tasks

- [x] **1.1** Verify `v_activity_score` view exists and returns correct fields
  - Location: `repos/metabob-activity-api/sql/schemas/021-paradigm-computed-views.surql`
  - Fields needed: `activity_id`, `alpha`, `beta`, `total_executions`, `successes`, `failures`
  - Test: `SELECT * FROM v_activity_score LIMIT 5` returns data

- [x] **1.2** Create `v_impulse_relevance` view for impulse contribution analysis
  - Location: `repos/metabob-activity-api/sql/schemas/021-paradigm-computed-views.surql`
  - Purpose: Aggregate impulse→execution success correlation
  - Test: Query returns relevance scores per impulse/activity pair

- [x] **1.3** Create `v_composition_graph` view for edge strength
  - Location: `repos/metabob-activity-api/sql/schemas/021-paradigm-computed-views.surql`
  - Purpose: Aggregate parent→child execution counts and success rates
  - Test: Query returns weighted edges between activities

- [x] **1.4** Create `thompson_selection_log` table for selection attribution
  - Location: `repos/metabob-activity-api/sql/schemas/011-executions.surql`
  - Purpose: Persist Thompson sample values at selection time
  - Test: Can INSERT and SELECT selection logs

- [x] **1.5** Fix `total_selections` persistence in recommend endpoint
  - Location: `repos/metabob-activity-api/src/routes/activities.ts`
  - Change: Increment `total_selections` when activity is selected
  - Test: After recommend call, `total_selections` is incremented

- [x] **1.6** Add performance indexes for dashboard queries
  ```sql
  idx_thompson_belief ON variant_performance_metrics (thompson_alpha, thompson_beta)
  idx_executions_success_time ON execution (org_id, success, executed_at)
  ```

**Testable State**: All views queryable via SurrealDB, selection tracking works

---

## Milestone 2: Shared UI Components
**Goal**: Build reusable components before feature dashboards
**Commit**: `feat(dashboard): add shared components for convergence views`

### Tasks

- [x] **2.1** Create `DateRangePicker` component
  - Location: `repos/activity-dashboard/src/components/ui/date-range-picker.tsx`
  - Uses: shadcn Calendar component
  - Props: `{ startDate, endDate, onChange, presets: ['7d', '30d', '90d'] }`
  - Test: Renders, date selection works, presets work

- [x] **2.2** Create `InteractiveGraph` base component
  - Location: `repos/activity-dashboard/src/components/ui/interactive-graph.tsx`
  - Uses: React Flow or D3.js
  - Features: Zoom, pan, node click, edge hover
  - Props: `{ nodes, edges, onNodeClick, onEdgeHover }`
  - Test: Renders graph, interactions work

- [x] **2.3** Create `ExportUtility` component
  - Location: `repos/activity-dashboard/src/components/ui/export-button.tsx`
  - Formats: CSV, JSON
  - Props: `{ data, filename, columns? }`
  - Test: Downloads correct file format

- [x] **2.4** Create `HistoricalTrendsChart` component
  - Location: `repos/activity-dashboard/src/components/ui/historical-trends-chart.tsx`
  - Uses: Recharts LineChart
  - Props: `{ data, xKey, yKey, dateRange }`
  - Test: Renders time-series with correct data

- [x] **2.5** Create `SparklineChart` component for inline trends
  - Location: `repos/activity-dashboard/src/components/ui/sparkline.tsx`
  - Uses: Recharts (minimal)
  - Props: `{ data, width, height, color }`
  - Test: Renders inline spark

**Testable State**: All components render in isolation, can be imported

---

## Milestone 3: Convergence Overview View
**Goal**: New dashboard view for convergence detection
**Commit**: `feat(dashboard): add convergence overview view`

### Tasks

- [ ] **3.1** Create `useConvergence` hook
  - Location: `repos/activity-dashboard/src/hooks/useConvergence.ts`
  - Fetches: corpus-summary, activity-scores, execution-traces (for trends)
  - Returns: `{ metrics, trends, loading, error, refresh }`

- [ ] **3.2** Create `ConvergenceOverview` component
  - Location: `repos/activity-dashboard/src/components/ConvergenceOverview.tsx`
  - Layout: 4-card grid + trend chart

- [ ] **3.3** Implement Belief Stability Gauge
  - Metric: `% activities with uncertainty < 10%`
  - Calculation: `sqrt((α*β) / ((α+β)² * (α+β+1))) * 100`
  - Visual: Progress bar with color (red/yellow/green)

- [ ] **3.4** Implement Exploration/Exploitation Balance
  - Metric: Stacked bar (exploration <5 exec, exploitation ≥10 exec)
  - Visual: Horizontal stacked bar with trend arrow

- [ ] **3.5** Implement Success Rate Trend
  - Data: Rolling 7-day success rate from execution traces
  - Visual: Line chart using HistoricalTrendsChart

- [ ] **3.6** Implement Composition Pattern Counter
  - Metric: Count of edges with reliability >0.8
  - Visual: Number card with trend indicator

- [ ] **3.7** Add Convergence tab to App.tsx navigation
  - Position: After "Overview", before "Activity"

**Testable State**: Convergence view loads, shows real metrics, auto-refreshes

---

## Milestone 4: Explainability Enhancements
**Goal**: Add attribution data to execution views
**Commit**: `feat(dashboard): add execution explainability features`

### Tasks

- [ ] **4.1** Add selection event logging API endpoint
  - Location: `repos/metabob-activity-api/src/routes/activities.ts`
  - Endpoint: `POST /v2/activities/selection-events`
  - Writes to: `thompson_selection_log` table

- [ ] **4.2** Enhance execution trace response with selection data
  - Join `thompson_selection_log` to `execution_trace` on `execution_id`
  - Add fields: `selection_probability`, `selection_method`, `alpha_at_selection`, `beta_at_selection`

- [ ] **4.3** Create `ExecutionExplainability` component
  - Location: `repos/activity-dashboard/src/components/ExecutionExplainability.tsx`
  - Shows: Selection attribution, impulse contributions, task waterfall

- [ ] **4.4** Implement Selection Attribution Card
  - Shows: Selection method (Thompson/improvisation), probability at selection
  - Visual: Card with probability bar

- [ ] **4.5** Implement Impulse Contribution Table
  - Data: From `v_impulse_relevance` for this execution's impulses
  - Shows: Impulse ID, shape, relevance score, "improves success by X%"
  - Visual: Table with color-coded relevance

- [ ] **4.6** Implement Task Waterfall Chart
  - Data: From `execution_trace.tasks[]`
  - Shows: Task timeline with duration bars, success/failure coloring
  - Visual: Horizontal bar chart, tool calls nested

- [ ] **4.7** Implement Composition Path Diagram
  - Data: Parent-child execution chain
  - Shows: Graph of activities called in this execution
  - Visual: Uses InteractiveGraph component

- [ ] **4.8** Integrate explainability into ExecutionHistory
  - Add "Explain" button on each execution row
  - Opens ExecutionExplainability in modal or side panel

**Testable State**: Can click any execution and see full attribution

---

## Milestone 5: Analytics Dashboards
**Goal**: New vertical slices for impulse/tool analytics
**Commit**: `feat(dashboard): add impulse and tool analytics views`

### Tasks

- [ ] **5.1** Create `useImpulseRelevance` hook
  - Location: `repos/activity-dashboard/src/hooks/useImpulseRelevance.ts`
  - Endpoint: `GET /v2/activities/impulse-relevance`
  - Params: `{ activity_id?, min_relevance?, limit }`

- [ ] **5.2** Create `ImpulseRelevanceDashboard` component
  - Location: `repos/activity-dashboard/src/components/ImpulseRelevanceDashboard.tsx`
  - Features: Heatmap (activity × impulse), relevance table, filters

- [ ] **5.3** Create `useToolUsage` hook
  - Location: `repos/activity-dashboard/src/hooks/useToolUsage.ts`
  - Endpoint: `GET /v2/activities/tool-usage`
  - Params: `{ activity_id?, tool_name?, limit }`

- [ ] **5.4** Create `ToolUsageDashboard` component
  - Location: `repos/activity-dashboard/src/components/ToolUsageDashboard.tsx`
  - Features: Grouped bar chart (tool × activity), usage table

- [ ] **5.5** Add API client methods
  - `api.listImpulseRelevance(params)`
  - `api.listToolUsage(params)`

- [ ] **5.6** Add TypeScript types
  - `ImpulseRelevanceMetric` in `types.ts`
  - `ToolUsagePattern` in `types.ts`

- [ ] **5.7** Add tabs to App.tsx navigation
  - "Impulses" tab → ImpulseRelevanceDashboard
  - "Tools" tab → ToolUsageDashboard

**Testable State**: Both dashboards load with real data, filters work

---

## Milestone 6: Enhanced Composition Graph
**Goal**: Interactive weighted graph visualization
**Commit**: `feat(dashboard): enhance composition graph with edge weights`

### Tasks

- [ ] **6.1** Update API to return edge weights
  - Endpoint: `GET /v2/activities/composition/graph`
  - Add: Query from `v_composition_graph` view
  - Return: `edges[].weight`, `edges[].execution_count`, `edges[].success_count`

- [ ] **6.2** Refactor CompositionVisualization to use InteractiveGraph
  - Replace: Hierarchical list with React Flow/D3 graph
  - Features: Zoom, pan, node expansion

- [ ] **6.3** Implement edge weight visualization
  - Visual: Edge thickness proportional to `execution_count`
  - Color: Green (high success), red (low success) based on `weight`
  - Hover: Show detailed edge statistics

- [ ] **6.4** Implement node expansion
  - Click node: Expand to show child activities
  - Double-click: Drill down into activity detail

- [ ] **6.5** Add time range filtering
  - Integrate DateRangePicker
  - Filter edges by `last_executed_at` within range

- [ ] **6.6** Add export capability
  - Export graph as PNG/SVG
  - Export edge data as CSV

**Testable State**: Interactive graph renders, weights visible, filters work

---

## Milestone 7: Existing Component Polish
**Goal**: Enhance working components with convergence data
**Commit**: `feat(dashboard): add convergence indicators to existing views`

### Tasks

- [ ] **7.1** Add trend sparklines to ActivityBeliefs
  - Data: Last 20 executions for each activity
  - Visual: Inline sparkline showing belief evolution

- [ ] **7.2** Add convergence badges to LearnedCorpus
  - Badge: "Converging" (uncertainty decreasing), "Exploring" (high uncertainty)
  - Color: Green/yellow/red based on convergence state

- [ ] **7.3** Add date range filtering to ExecutionHistory
  - Integrate DateRangePicker from M2
  - Filter API calls by `start_date`, `end_date`

- [ ] **7.4** Add export to ExecutionHistory
  - Button: "Export CSV" / "Export JSON"
  - Uses ExportUtility from M2

- [ ] **7.5** Add decision framework badges to LearningSystem
  - Logic:
    - `uncertainty >15%, execs <5` → "Keep Exploring" (yellow)
    - `uncertainty <10%, execs ≥10` → "Safe to Exploit" (green)
    - `success_rate <30%, execs ≥10` → "Needs Variant" (red)
    - `success_rate >70%, uncertainty <10%` → "Specialize" (blue)

- [ ] **7.6** Add auto-refresh to CompositionVisualization
  - Currently manual-only
  - Add refresh interval option (30s/60s/off)

- [ ] **7.7** Update VesselStatus with historical metrics
  - Add mini time-series for CPU/memory
  - Data: Last 1 hour of metrics (if available)

**Testable State**: All existing views enhanced with new features

---

## Commit Milestone Summary

| Milestone | Commit Message | Deliverable |
|-----------|---------------|-------------|
| M1 | `feat(schema): add convergence and explainability views` | Database ready |
| M2 | `feat(dashboard): add shared components for convergence views` | Component library |
| M3 | `feat(dashboard): add convergence overview view` | New "Convergence" tab |
| M4 | `feat(dashboard): add execution explainability features` | Execution attribution |
| M5 | `feat(dashboard): add impulse and tool analytics views` | New "Impulses" + "Tools" tabs |
| M6 | `feat(dashboard): enhance composition graph with edge weights` | Interactive graph |
| M7 | `feat(dashboard): add convergence indicators to existing views` | Polish everywhere |

---

## Parallel Work Opportunities

```
Week 1:
  Dev A: M1 (Schema) → M2 (Components)
  Dev B: (blocked until M1 complete, can help with M2)

Week 2:
  Dev A: M3 (Convergence Overview)
  Dev B: M5 (Analytics Dashboards)  ← parallel track

Week 3:
  Dev A: M4 (Explainability)
  Dev B: M6 (Composition Graph)  ← parallel track

Week 4:
  Dev A + B: M7 (Polish) ← can split tasks
```

---

## Definition of Done

Each milestone is complete when:
- [ ] All tasks checked off
- [ ] Tests pass (unit + integration)
- [ ] Dashboard loads without errors
- [ ] New features visible in UI
- [ ] Commit pushed with conventional commit message
- [ ] PR reviewed (if team workflow)
