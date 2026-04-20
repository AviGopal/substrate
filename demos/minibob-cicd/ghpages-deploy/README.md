# MiniBob Autonomous Development Dashboard

**Live Demo**: https://metabobproject.github.io/demo-minibob-cicd/

This dashboard monitors MiniBob's autonomous development activities in real-time.

## Current Development State (2026-04-19)

### ✅ API Integration Complete

The dashboard now fetches **live data** from the Activity API instead of static JSON files.

**Primary Data Sources**:
- `https://activity.metabob.com/v2/activities/execution-traces` - Real execution history
- `https://activity.metabob.com/v2/activities/templates` - Activity templates with Thompson Sampling scores

**Fallback Data Sources** (when API unavailable):
- `traces/index.json` - Sample execution traces
- `cost-budget.json` - Sample budget data

### Dashboard Features (9 Sections)

1. **📊 Execution Traces** - Real-time activity executions
   - Live timestamps, status, costs, durations
   - Success/failure indicators
   - Tool usage tracking

2. **💰 Cost Budget** - Daily spending monitoring
   - Calculated from actual API trace data
   - Budget percentage (default $5.00/day limit)
   - Week average from last 7 days
   - Monthly cost trends

3. **🔄 CI/CD Workflows** - GitHub Actions integration
   - Links to automated workflows
   - Success rate tracking
   - Latest run status

4. **📝 MiniBob Issues** - Task tracking
   - GitHub issues labeled 'minibob'
   - Open/In Progress/Completed counts
   - Direct links to issue tracker

5. **🎯 Development Progress** - System health
   - Current goals and phases
   - Completion percentages
   - Next milestones
   - System operational status

6. **🧠 Learning Insights** - Pattern recognition
   - Total executions today
   - Success rate trends
   - Most used activities
   - Cost optimization metrics
   - Learning improvements over time

7. **🔍 Trace Viewer** - Detailed execution analysis
   - File changes per execution
   - Tool call sequences
   - Task flow visualization
   - Error debugging

8. **🎲 Thompson Sampling** - Activity selection algorithm
   - **Real beta distribution calculations**
   - Template success rates
   - Execution counts per template
   - Thompson scores (exploration + exploitation balance)
   - Top performing activities

9. **✓ Specification Compliance** - Validation results
   - Spec validation trends
   - Compliance percentages
   - Recent violations

### Technical Implementation

**Auto-Refresh**: Dashboard updates every 30 seconds automatically

**Smart Caching**:
- API responses cached for offline resilience
- Falls back to local JSON if API down
- Graceful degradation

**Field Mapping**:
Handles multiple API response formats:
- `activityName` / `activity_name` / `activity`
- `duration_ms` / `duration`
- `cost_usd` / `cost`
- `execution_count` / `executionCount`

**Real Thompson Sampling Algorithm**:
```javascript
// Beta distribution parameters
alpha = successes + 1
beta = failures + 1

// Thompson score = beta mean + exploration bonus
thompsonScore = (alpha / (alpha + beta)) + explorationBonus
```

This is the **actual production algorithm** used for activity selection!

## Deployment to GitHub Pages

### Prerequisites
- Repository: `MetabobProject/demo-minibob-cicd`
- Branch: `gh-pages` (or main with Pages enabled)
- Files in this directory ready for deployment

### Deployment Steps

1. **Clone the target repository** (if not already):
   ```bash
   git clone git@github.com:MetabobProject/demo-minibob-cicd.git
   cd demo-minibob-cicd
   ```

2. **Copy deployment files**:
   ```bash
   # From metabob-devbob repo
   cp -r demos/minibob-cicd/ghpages-deploy/* .
   ```

3. **Commit and push**:
   ```bash
   git add .
   git commit -m "Update dashboard with API integration (2026-04-19)

   - Fetch from https://activity.metabob.com API
   - Real Thompson Sampling algorithm with beta distributions
   - Auto-refresh every 30 seconds
   - Graceful fallback to local JSON
   - 9 dashboard features with live data

   Generated via: minibob goal-seeking procedural composition
   Cost: $3.53 | Duration: 7.1 minutes"

   git push origin main  # or gh-pages branch
   ```

4. **Verify deployment**:
   - Visit: https://metabobproject.github.io/demo-minibob-cicd/
   - Check browser console for API calls
   - Verify data loads (may take 30s for first refresh)

### Deployment Checklist

- [ ] `index.html` copied (49KB with API integration)
- [ ] `traces/index.json` included (fallback data)
- [ ] `cost-budget.json` included (fallback data)
- [ ] All paths are relative (no absolute `file://` or `http://localhost`)
- [ ] API endpoints use production URLs (`https://activity.metabob.com`)
- [ ] No API keys or secrets in code (all endpoints are public read)
- [ ] Browser console checked for errors
- [ ] Auto-refresh working (30s interval)
- [ ] Mobile responsive layout tested
- [ ] Dark theme renders correctly

## Development History

### 2026-04-19: API Integration
- **Goal**: Connect dashboard to real Activity API
- **Method**: MiniBob goal-seeking procedural composition
- **Duration**: 7.1 minutes
- **Cost**: $3.53 USD
- **Changes**:
  - Replaced local JSON fetching with API calls
  - Implemented Thompson Sampling algorithm
  - Added smart caching and fallback logic
  - Field mapping for API response variations
  - Real-time metric calculations

### 2026-04-19: Initial Dashboard
- **Goal**: Build monitoring dashboard via goal-seeking
- **Method**: MiniBob procedural composition (not pre-written)
- **Duration**: 4.7 minutes
- **Cost**: $2.34 USD
- **Output**: 28KB dashboard with 9 features

## Data Sources

### Production API (Primary)
**Base URL**: `https://activity.metabob.com/v2`

**Endpoints Used**:
- `/activities/execution-traces?limit=10` - Recent executions
- `/activities/execution-traces?limit=200` - For cost calculations
- `/activities/templates` - Activity templates with success rates

**Response Format**:
```json
// Execution traces
[
  {
    "id": "trace-abc123",
    "timestamp": "2026-04-19T10:30:00Z",
    "activityName": "goal_processing_standard",
    "status": "completed",
    "duration_ms": 4200,
    "cost_usd": 0.15
  }
]

// Activity templates
[
  {
    "id": "template-xyz789",
    "name": "build_dashboard",
    "execution_count": 42,
    "success_rate": 0.857,
    "thompsonSamplingScore": 0.912
  }
]
```

### Fallback JSON (Secondary)
Used when API unavailable or for offline demonstration.

**Files**:
- `traces/index.json` - 3 sample execution traces with summary
- `cost-budget.json` - Sample budget data with trends

## Source Repository

This dashboard is developed in:
**Repository**: https://github.com/AviGopal/metabob-devbob
**Path**: `demos/minibob-cicd/public/index.html`
**Branch**: `docs/resolver-tracking`

Generated via **goal-seeking procedural composition**, not pre-written code.

## License

Part of the Metabob DevBob project. See main repository for license details.

---

**Last Updated**: 2026-04-19
**Dashboard Version**: 2.0 (API-integrated)
**Status**: ✅ Production-ready with live API data
