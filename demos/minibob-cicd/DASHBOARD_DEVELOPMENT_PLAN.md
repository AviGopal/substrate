# Development Dashboard - Autonomous Development Plan

## Purpose

Create and maintain a **development dashboard** that provides visibility into MiniBob's autonomous development process in the minibob-cicd repository.

## Dashboard Requirements

### 1. Decision Tracking
**What to Show:**
- Activity selections (which activity was chosen and why)
- Thompson Sampling probabilities
- Goal interpretations
- Path decisions (improvise vs. use template)

**Data Sources:**
- Activity execution traces (`activityExecutionTrace`)
- Thompson Sampling metrics (`activityMetrics`)
- Goal processing logs

**Visualization:**
- Timeline of decisions
- Decision tree visualization
- Probability distributions over time

### 2. Code Change Tracking
**What to Show:**
- Files created
- Files modified (with diffs)
- Files deleted
- Lines added/removed per change
- Change categories (feature, bugfix, refactor)

**Data Sources:**
- Execution traces with state transitions
- Git commit history
- Activity task results

**Visualization:**
- Code churn heatmap
- File modification frequency
- Change impact analysis
- Before/after diff viewer

### 3. Development Process Visualization
**What to Show:**
- Activity execution pipeline
- Task dependencies and flow
- Success/failure rates
- Execution duration trends
- Cost per activity

**Data Sources:**
- Execution sequences (`executionSequences`)
- Composition graphs (`activityCompositionGraph`)
- Tool usage patterns (`toolUsagePatterns`)

**Visualization:**
- Sankey diagram of activity flow
- Success rate trends
- Cost analysis charts
- Performance metrics

### 4. Accuracy and Clarity
**Requirements:**
- Real-time data updates (poll every 30s)
- Timestamps for all events
- Clear labeling and legends
- Color-coded status indicators
- Responsive design
- Error handling and fallbacks

---

## Architecture

### Frontend Stack
```
Technology: React 19 + TypeScript
Styling: Tailwind CSS
Charts: Recharts or D3.js
State: React Query for data fetching
Build: Bun
```

### Backend Integration
```
Data Source: activity.metabob.com/v2/*
Impulse Types:
  - activityExecutionTrace
  - activityMetrics
  - activityCompositionGraph
  - executionSequences
  - toolUsagePatterns

Polling: 30-second intervals
Caching: Redis (5-minute TTL)
```

### File Structure
```
demos/minibob-cicd/
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   │   ├── DecisionTimeline.tsx
│   │   │   ├── CodeChangeHeatmap.tsx
│   │   │   ├── ProcessFlow.tsx
│   │   │   └── MetricsDashboard.tsx
│   │   ├── hooks/
│   │   │   ├── useExecutionTraces.ts
│   │   │   ├── useMetrics.ts
│   │   │   └── useCompositionGraph.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   └── App.tsx
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── tsconfig.json
└── results/
    └── dashboard-development/  # Autonomous loop outputs
```

---

## Implementation Phases

### Phase 1: Data Collection Infrastructure
**Duration:** ~2 hours (autonomous)

**Tasks:**
1. Create API client for activity.metabob.com
2. Implement impulse resolution for all required types
3. Set up data polling with React Query
4. Create TypeScript types from backend schemas
5. Implement error handling and retries

**Autonomous Activities:**
- `create-api-client` - Generate TypeScript API client
- `setup-data-fetching` - Implement polling hooks
- `generate-types` - Extract types from backend

**Validation:**
- [ ] API client successfully connects
- [ ] All impulse types resolve correctly
- [ ] Polling updates data every 30s
- [ ] Error states handled gracefully

### Phase 2: Decision Tracking Dashboard
**Duration:** ~3 hours (autonomous)

**Tasks:**
1. Create DecisionTimeline component
2. Fetch execution traces
3. Extract decision points from traces
4. Visualize Thompson Sampling probabilities
5. Add filters (time range, activity type)

**Autonomous Activities:**
- `create-decision-timeline` - Build timeline component
- `integrate-thompson-sampling` - Show probability distributions
- `add-decision-filters` - Implement filtering

**Validation:**
- [ ] Timeline shows all decisions chronologically
- [ ] Thompson Sampling probabilities displayed
- [ ] Filters work correctly
- [ ] Timestamps accurate

### Phase 3: Code Change Tracking
**Duration:** ~3 hours (autonomous)

**Tasks:**
1. Parse state transitions from execution traces
2. Extract file modifications
3. Calculate code churn metrics
4. Create heatmap visualization
5. Implement diff viewer

**Autonomous Activities:**
- `parse-state-transitions` - Extract file changes
- `create-code-heatmap` - Build heatmap component
- `implement-diff-viewer` - Show before/after diffs

**Validation:**
- [ ] All file changes tracked
- [ ] Churn metrics accurate
- [ ] Heatmap updates in real-time
- [ ] Diff viewer shows correct changes

### Phase 4: Process Flow Visualization
**Duration:** ~4 hours (autonomous)

**Tasks:**
1. Fetch composition graphs
2. Build activity flow diagram (Sankey)
3. Show task dependencies
4. Display success/failure rates
5. Add performance metrics

**Autonomous Activities:**
- `create-process-flow` - Build Sankey diagram
- `add-metrics-dashboard` - Show performance data
- `implement-success-tracking` - Visualize rates

**Validation:**
- [ ] Flow diagram shows all activities
- [ ] Dependencies visualized correctly
- [ ] Metrics accurate and current
- [ ] Performance trends visible

### Phase 5: Integration and Polish
**Duration:** ~2 hours (autonomous)

**Tasks:**
1. Combine all components into unified dashboard
2. Add navigation and layout
3. Implement responsive design
4. Add error boundaries
5. Write tests

**Autonomous Activities:**
- `integrate-components` - Combine all views
- `add-navigation` - Implement routing
- `write-dashboard-tests` - Test coverage

**Validation:**
- [ ] All components integrated
- [ ] Navigation works smoothly
- [ ] Responsive on mobile/desktop
- [ ] Tests pass
- [ ] Error boundaries catch issues

---

## Autonomous Development Loop

### Loop Configuration

```json
{
  "activity": "autonomous-code-quality-loop",
  "repository": "/home/avi/documents/work/exp-repo/metabob-devbob/demos/minibob-cicd",
  "specifications": "./specifications/minibob-cicd-specs.json",
  "target_files": [
    "dashboard/src/**/*.tsx",
    "dashboard/src/**/*.ts",
    "public/**/*.js",
    "scripts/**/*.ts"
  ],
  "patterns": [
    "error-handling",
    "async-patterns",
    "test-structure",
    "activity-composition"
  ],
  "max_iterations": 5,
  "output_path": "./results/dashboard-development",
  "goals": [
    "Create development dashboard showing decisions, code changes, and process",
    "Ensure accuracy and clarity of all displayed information",
    "Implement real-time data updates",
    "Add comprehensive error handling",
    "Write tests for all components"
  ]
}
```

### Success Criteria

**Functional:**
- [ ] Dashboard loads without errors
- [ ] All data sources connected
- [ ] Real-time updates working (30s polling)
- [ ] All visualizations rendering correctly
- [ ] Filtering and navigation functional

**Quality:**
- [ ] 100% compliance with minibob-cicd specifications
- [ ] 0 regressions introduced
- [ ] Error handling on all API calls
- [ ] Tests covering >80% of code
- [ ] Performance: <2s initial load, <500ms updates

**Accuracy:**
- [ ] Decision data matches execution traces
- [ ] Code changes match git history
- [ ] Metrics match backend data
- [ ] Timestamps accurate to millisecond
- [ ] No data loss or corruption

**Clarity:**
- [ ] All charts have clear labels and legends
- [ ] Color coding is intuitive and accessible
- [ ] Navigation is self-explanatory
- [ ] Error messages are helpful
- [ ] Loading states are clear

---

## Monitoring and Validation

### Real-Time Monitoring

```bash
# Monitor autonomous loop progress
./scripts/monitor-results.sh --watch

# Check dashboard development output
tail -f results/dashboard-development/autonomous-loop-summary.json

# View specific phase results
cat results/dashboard-development/phase-*.json | jq .
```

### Validation Commands

```bash
# Check dashboard builds
cd dashboard && bun install && bun run build

# Run tests
bun test

# Check for regressions
bun run lint && bun run typecheck

# Verify API connectivity
curl https://activity.metabob.com/health

# Test impulse resolution
curl -X POST https://activity.metabob.com/v2/impulses/resolve \
  -H "Content-Type: application/json" \
  -d '{"impulses": [{"id": "test", "pointer": {"type": "activityExecutionTrace", "limit": 1}}]}'
```

---

## Current Status

**Autonomous Loop:** Running (background task b6f9af6)

**Output:** `/tmp/claude-1000/-home-avi-documents-work-exp-repo-metabob-devbob/tasks/b6f9af6.output`

**Activities Registered:**
- ✅ enforce-error-handling-pattern
- ✅ validate-specification-enforcement
- ✅ autonomous-code-quality-loop

**Specifications Learned:**
- ✅ minibob-cicd-specs.json (4 patterns)
- ✅ express-specifications.json (3 patterns)

**Next:**
1. Wait for autonomous loop to complete
2. Review generated dashboard components
3. Validate accuracy and clarity
4. Run chaos tests to verify resilience
5. Deploy to GitHub Pages

---

## Dashboard URL (After Deployment)

**Development:** `http://localhost:3000`

**Production:** `https://<org>.github.io/minibob-cicd/dashboard`

**API Endpoint:** `https://activity.metabob.com`

---

## Success Metrics

Track these metrics to measure dashboard effectiveness:

| Metric | Target | Current |
|--------|--------|---------|
| Data accuracy | 100% | TBD |
| Update latency | <500ms | TBD |
| Uptime | >99.5% | TBD |
| Load time | <2s | TBD |
| Test coverage | >80% | TBD |
| User satisfaction | >4.5/5 | TBD |

---

**This dashboard will demonstrate MiniBob's ability to autonomously develop, document, and maintain complex systems.**
