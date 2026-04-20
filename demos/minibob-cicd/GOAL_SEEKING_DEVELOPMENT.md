# Goal-Seeking Development Process

> Use MiniBob to build the dashboard itself through procedural activity composition

## The Principle

**Don't pre-write infrastructure. Use goal-seeking to create it.**

Instead of:
- Writing HTML/CSS/JS for dashboards
- Pre-writing activity templates
- Creating canned demos

We give MiniBob goals and let it:
1. Discover available data (impulse state space)
2. Create activities to source and process data
3. Generate outputs (dashboards, reports, tools)
4. Extract successful executions into reusable templates

## Starting Point

**What we have**:
- `specifications/minibob-cicd-specs.json` - Learned specifications (data)
- MiniBob with goal-seeking capabilities
- Backend API with impulse state space

**What we DON'T have** (intentionally):
- Pre-written dashboards
- Pre-written activity templates
- Canned demonstrations

## The Goal

**Build a development state dashboard using goal-seeking**

```bash
minibob --single "Create a development state dashboard that shows:

1. Available shapes in the impulse state space
   - Query https://activity.metabob.com/v2/shapes
   - Display shape name, description, resolver

2. Registered activities with Thompson Sampling scores
   - Query https://activity.metabob.com/v2/activities/templates
   - Display activity name, success rate, avg cost, avg latency

3. Recent execution traces showing goal-seeking composition
   - Query https://activity.metabob.com/v2/activities/execution-traces
   - Display execution flow, tasks, impulse resolutions

4. System metrics
   - Calculate from traces: total executions, success rate, ribosome extractions
   - Display aggregate statistics

Generate HTML file at public/development-state.html with live data from these sources.
The dashboard should auto-refresh every 30 seconds."
```

## What MiniBob Should Do

### Phase 1: Discover
```
[Discovering available data sources...]
✓ Found: GET /v2/shapes → availableShapes impulse
✓ Found: GET /v2/activities/templates → activityTemplates impulse
✓ Found: GET /v2/activities/execution-traces → executionTraces impulse
✓ Found: Calculated metrics from traces → systemMetrics impulse
```

### Phase 2: Compose
```
[Composing data pipeline...]
Activity 1: fetch-shapes
  Input: API endpoint URL
  Output: shapes impulse (JSON)
  Resolver: bash (curl)

Activity 2: fetch-templates
  Input: API endpoint URL
  Output: templates impulse (JSON)
  Resolver: bash (curl)

Activity 3: fetch-traces
  Input: API endpoint URL
  Output: traces impulse (JSON)
  Resolver: bash (curl)

Activity 4: calculate-metrics
  Input: traces impulse
  Output: metrics impulse (aggregated)
  Resolver: llm (analyze and aggregate)

Activity 5: render-dashboard
  Input: shapes, templates, traces, metrics impulses
  Output: HTML file
  Resolver: llm (generate visualization)
```

### Phase 3: Execute
```
[Executing pipeline...]
✓ Task: fetch-shapes (bash, 120ms, $0)
✓ Task: fetch-templates (bash, 340ms, $0)
✓ Task: fetch-traces (bash, 180ms, $0)
✓ Task: calculate-metrics (llm, 4.2s, $0.02)
✓ Task: render-dashboard (llm, 8.5s, $0.04)

Result: public/development-state.html created
```

### Phase 4: Extract
```
[Ribosome extraction...]
New template: build-development-dashboard (v1.0.0)
  Input impulses: none (fetches from API)
  Tasks: 5 (3 deterministic, 2 llm)
  Output: HTML dashboard file

✅ Template registered
   Next execution: minibob --template build-development-dashboard
```

## The Impulse State Space

Every piece of data on the dashboard is an impulse:

| Data | Impulse Type | Source |
|------|--------------|--------|
| Available shapes | `availableShapes` | GET /v2/shapes |
| Activity templates | `activityTemplates` | GET /v2/activities/templates |
| Execution traces | `executionTraces` | GET /v2/activities/execution-traces |
| System metrics | `systemMetrics` | Calculated from traces |
| Dashboard HTML | `dashboardHTML` | Rendered from above impulses |

## Running It

```bash
# Give MiniBob the goal (from project root)
cd /home/avi/documents/work/exp-repo/metabob-devbob

minibob --single "Create a development state dashboard that shows:
1. Available shapes from https://activity.metabob.com/v2/shapes
2. Activity templates from https://activity.metabob.com/v2/activities/templates
3. Recent traces from https://activity.metabob.com/v2/activities/execution-traces
4. System metrics calculated from the traces
Generate HTML at demos/minibob-cicd/public/development-state.html"

# MiniBob will:
# - Discover available data sources
# - Create activities to fetch each piece
# - Create activity to render HTML
# - Execute the pipeline
# - Output: demos/minibob-cicd/public/development-state.html
```

## Validating the Process

After execution, check:

1. **Activities created**:
   ```bash
   # Query backend for new activities
   curl https://activity.metabob.com/v2/activities/templates | jq '.templates[] | select(.created_via == "goal-seeking")'
   ```

2. **Dashboard generated**:
   ```bash
   # Check output exists
   ls -la demos/minibob-cicd/public/development-state.html

   # Serve locally
   cd demos/minibob-cicd/public
   python3 -m http.server 8000
   open http://localhost:8000/development-state.html
   ```

3. **Ribosome extraction**:
   ```bash
   # Check for extracted template
   curl https://activity.metabob.com/v2/activities/templates | jq '.templates[] | select(.name | contains("dashboard"))'
   ```

## Next Goals

Once the dashboard works:

1. **Spec validation dashboard**:
   ```
   "Create a specification compliance dashboard showing violations from specifications/minibob-cicd-specs.json"
   ```

2. **CI/CD integration**:
   ```
   "Create a GitHub Actions workflow that runs spec validation on every commit and posts results as PR comment"
   ```

3. **Fault detection**:
   ```
   "Analyze execution traces to find false positives in spec validation activities and create improved variants"
   ```

Each goal uses the same process: Discover → Compose → Execute → Extract

## Key Insight

**The dashboard itself demonstrates goal-seeking** because it's created through goal-seeking, not pre-written. Every time we improve it, we're showing MiniBob learning and composing better solutions.

This is "activities all the way down" - using the system to build the system.

---

**Status**: Ready to execute
**Next step**: Run MiniBob with the dashboard creation goal
