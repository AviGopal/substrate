# Dashboard Activities

Automated dashboard generation and metrics collection for MiniBob CI/CD demo.

## Activities

### 1. `update-metrics.json` (Deterministic)

**Purpose**: Fetch execution traces and Thompson Sampling data from the learning backend, calculate selection efficiency metrics, and generate JSON data files for dashboard visualization.

**Mode**: Deterministic (no LLM usage)

**Tasks**:
1. **fetch-execution-traces**: Query `activity.metabob.com` for recent traces
2. **fetch-thompson-sampling-data**: Get alpha/beta parameters for all activities
3. **calculate-selection-efficiency**: Compute metrics using Node.js:
   - Goal achievement rate (% of successful executions)
   - Template hit rate (% of templates with execution history)
   - Improvisation conversion rate (% of improvised activities that succeeded)
   - Average rank of successful activities
4. **create-dashboard-data-directory**: Ensure `dashboard/data/` structure exists
5. **write-metrics-file**: Write `dashboard/data/metrics.json`
6. **generate-traces-index**: Write `dashboard/data/traces/index.json`
7. **commit-and-push**: Git commit and push changes

**Output Files**:
- `dashboard/data/metrics.json`: Aggregated metrics and Thompson Sampling stats
- `dashboard/data/traces/index.json`: Recent execution traces index

**Usage**:
```bash
bunx @metabob/minibob@latest \
  --template activities/dashboard/update-metrics.json \
  --var "lookbackHours=24" \
  --trace
```

**Variables**:
- `lookbackHours` (default: 24): Hours of execution history to analyze
- `metabobEndpoint` (default: https://activity.metabob.com): Backend API URL

**Requirements**:
- `METABOB_API_KEY` environment variable must be set
- Network access to `activity.metabob.com`
- Git repository with write access

**Cost**: ~$0.00 (no LLM usage, just API calls)

---

### 2. `build-dashboard.json` (Learning)

**Purpose**: Read metrics.json and generate/update dashboard HTML with visualizations. Uses LLM for chart generation and responsive design, then commits and triggers GitHub Pages deployment.

**Mode**: Learning (LLM-assisted)

**Tasks**:
1. **verify-metrics-exist**: Check that `dashboard/data/metrics.json` exists
2. **read-metrics**: Parse metrics and traces data
3. **generate-html-structure**: Create responsive dashboard HTML with:
   - Header with title and last-updated timestamp
   - Key metrics cards (goal achievement, template hit rate, etc.)
   - Thompson Sampling evolution chart (using Chart.js)
   - Activity timeline (recent 10 executions)
   - Dark mode toggle
4. **generate-chart-javascript**: Create Chart.js visualization for alpha/beta evolution
5. **generate-styles**: Generate modern CSS with dark mode support
6. **test-dashboard-locally**: Validate HTML (if html5validator installed)
7. **commit-dashboard**: Git commit dashboard changes
8. **trigger-github-pages**: Trigger GitHub Pages deployment workflow (if configured)

**Output Files**:
- `dashboard/index.html`: Main dashboard page
- `dashboard/js/charts.js`: Chart.js visualization code
- `dashboard/css/styles.css`: Responsive styles with dark mode

**Usage**:
```bash
bunx @metabob/minibob@latest \
  --template activities/dashboard/build-dashboard.json \
  --var "dashboardTitle=MiniBob Learning Dashboard" \
  --trace
```

**Variables**:
- `dashboardTitle` (default: "MiniBob Learning Dashboard"): Page title
- `chartLibrary` (default: "chart.js"): JavaScript charting library

**Requirements**:
- `dashboard/data/metrics.json` must exist (run `update-metrics.json` first)
- Git repository with write access
- Anthropic API key for LLM
- (Optional) GitHub CLI authenticated for Pages deployment

**Cost**: ~$0.03-0.05 per execution (LLM for HTML/CSS/JS generation)

---

## Complete Workflow

**Typical usage** (combine both activities):

```bash
# 1. Update metrics from backend
bunx @metabob/minibob@latest \
  --template activities/dashboard/update-metrics.json \
  --trace

# 2. Build dashboard HTML
bunx @metabob/minibob@latest \
  --template activities/dashboard/build-dashboard.json \
  --trace
```

**Scheduled automation** (GitHub Actions example):

```yaml
name: Update Dashboard
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  update-dashboard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Update Metrics
        run: |
          bunx @metabob/minibob@latest \
            --template activities/dashboard/update-metrics.json \
            --var "lookbackHours=24" \
            --trace
        env:
          METABOB_API_KEY: ${{ secrets.METABOB_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      
      - name: Build Dashboard
        run: |
          bunx @metabob/minibob@latest \
            --template activities/dashboard/build-dashboard.json \
            --trace
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## Learning Loop Integration

These activities demonstrate **Loop 2: External Validation** and **Loop 3: Discovery**:

### Loop 2: Thompson Sampling Metrics
The `update-metrics.json` activity calculates:
- **Selection efficiency**: How well Thompson Sampling chooses activities
- **Template hit rate**: Coverage of activities with execution history
- **Improvisation conversion**: Success rate of novel approaches

These metrics feed back into the learning system to improve activity selection over time.

### Loop 3: Discovery Effectiveness
The dashboard visualizes:
- Which discovery activities (scan-execution-traces, scan-file-system) are most useful
- Alpha/beta evolution showing learning progress
- Cost and duration trends showing efficiency improvements

---

## Dashboard Features

The generated dashboard includes:

1. **Metrics Cards**:
   - Goal Achievement Rate (with trend)
   - Template Hit Rate (coverage indicator)
   - Improvisation Conversion (innovation success)
   - Avg Successful Rank (selection quality)

2. **Thompson Sampling Evolution Chart**:
   - Dual-line chart (alpha=green, beta=red)
   - Top 5 activities by execution count
   - Time-series showing learning progress

3. **Activity Timeline**:
   - Last 20 executions
   - Outcome badges (success/failure)
   - Duration and cost indicators

4. **Design**:
   - Responsive (mobile-first)
   - Dark mode toggle
   - Auto-refresh every 5 minutes
   - Minimal, clean aesthetic

---

## File Structure

```
dashboard/
├── index.html              # Main dashboard page
├── css/
│   └── styles.css         # Responsive styles with dark mode
├── js/
│   └── charts.js          # Chart.js visualizations
└── data/
    ├── metrics.json       # Aggregated metrics
    └── traces/
        └── index.json     # Execution traces index
```

---

## Troubleshooting

**Problem**: `update-metrics.json` fails with "unauthorized"
**Solution**: Ensure `METABOB_API_KEY` is set and valid

**Problem**: `build-dashboard.json` fails with "metrics.json not found"
**Solution**: Run `update-metrics.json` first to generate data files

**Problem**: GitHub Pages not deploying
**Solution**: 
1. Ensure repository has Pages enabled (Settings → Pages)
2. Set source to "GitHub Actions" (not branch)
3. Create `.github/workflows/deploy-pages.yml` workflow
4. Authenticate GitHub CLI: `gh auth login`

**Problem**: Charts not rendering
**Solution**: Check browser console for errors; ensure Chart.js CDN is accessible

---

## Next Steps

**Enhancement ideas**:

1. **Historical tracking**: Store metrics over time for trend analysis
2. **Alerting**: Trigger alerts when metrics degrade (e.g., goal achievement < 70%)
3. **Comparison views**: Compare before/after for specific changes
4. **Activity deep-dives**: Click activity cards for detailed trace exploration
5. **Cost optimization**: Track and visualize cost per successful execution

---

**Created**: 2026-04-16  
**Activity Pattern**: Deterministic data collection + LLM-assisted visualization  
**Learning Loops**: Loop 2 (Thompson Sampling), Loop 3 (Discovery)
