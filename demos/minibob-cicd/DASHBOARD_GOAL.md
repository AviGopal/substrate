# MiniBob Monitoring Dashboard - Goal-Seeking Development

## Target Dashboard
https://metabobproject.github.io/demo-minibob-cicd/index.html

## Dashboard Features (9 Sections)

### 1. Execution Traces
- Display detailed logs of autonomous sessions
- Show tool invocations and state changes
- Fetch from: `traces/index.json`

### 2. Cost Budget
- Monitor daily spending
- Budget consumption metrics
- Display current cost and percentage used
- Fetch from: `cost-budget.json`

### 3. CI/CD Workflows
- Links to GitHub Actions
- Show autonomous development runs
- Integration with GitHub workflows

### 4. MiniBob Issues
- GitHub issue tracker
- Filter for tasks labeled 'minibob'
- Show active development tasks

### 5. Development Progress
- Real-time tracking of goals
- Development phases
- System health metrics

### 6. Learning Insights
- Thompson Sampling improvements
- Pattern discovery visualization
- Learning metrics over time

### 7. Trace Viewer
- Detailed execution analysis
- File changes visualization
- Tool call sequences

### 8. Thompson Sampling
- Bayesian optimization visualization
- Activity variant selection stats
- Success rates per variant

### 9. Specification Compliance
- Validation results
- Compliance trend analysis
- Violations tracking

## Data Sources

### Primary JSON Endpoints
```json
// traces/index.json
[
  {
    "id": "trace-123",
    "timestamp": "2026-04-19T10:30:00Z",
    "activityId": "...",
    "status": "success",
    "duration_ms": 45000,
    "cost_usd": 0.12,
    "toolCalls": [...],
    "filesChanged": [...]
  }
]

// cost-budget.json
{
  "todayCost": 2.45,
  "budgetLimit": 10.00,
  "budgetUsedPercent": 24.5,
  "updatedAt": "2026-04-19T15:30:00Z"
}
```

### Additional Data Sources
- GitHub API for issues/workflows
- Activity API for Thompson Sampling metrics
- Specification validation results

## Design Requirements

### Visual Style
- Modern dark theme
- Gradient backgrounds (#667eea to #764ba2)
- Interactive hover effects
- Responsive grid layout

### Technical Requirements
- Auto-refresh every 30 seconds
- Offline caching with fallbacks
- Error handling for API failures
- Real-time data updates

## Goal-Seeking Approach

### Phase 1: Discover
1. Identify data sources (JSON files, APIs)
2. Understand data structures
3. Map features to data requirements

### Phase 2: Compose
1. Create activities to fetch each data source
2. Create activities to calculate derived metrics
3. Create activities to generate HTML sections
4. Compose into complete dashboard

### Phase 3: Execute
1. Fetch traces/index.json
2. Fetch cost-budget.json
3. Fetch GitHub data
4. Calculate metrics
5. Generate HTML with all 9 sections

### Phase 4: Extract
1. Extract reusable template for dashboard building
2. Record successful patterns
3. Enable Thompson Sampling for future improvements

## Output Location
`demos/minibob-cicd/public/index.html`

## Success Criteria
- ✅ All 9 features implemented
- ✅ Data fetched from correct sources
- ✅ Auto-refresh working
- ✅ Error handling with caching
- ✅ Responsive layout
- ✅ Matches design of target dashboard
