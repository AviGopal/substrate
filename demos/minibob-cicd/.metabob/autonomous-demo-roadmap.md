# MiniBob Autonomous Demo Roadmap

**Goal**: MiniBob develops and maintains its own GitHub Pages demo site while autonomously managing issues, documentation, and workspace cleanliness.

## Vision

**Public-facing demo at**: `https://metabobproject.github.io/demo-minibob-cicd/`

The site shows:
- Live learning metrics (success rate, cost, speed improvements)
- Recent activity executions with traces
- Execution graph visualization
- Real-time autonomous development
- Issue/PR tracking created by MiniBob
- Learning curves over time

## Phase 1: GitHub Integration (Week 1)

### Autonomous Issue Management

**When MiniBob Encounters Problems**:
```javascript
// Automatic issue creation
if (execution.failed && retryCount >= maxAttempts) {
  createIssue({
    title: `Auto-remediation failed: ${activity.name}`,
    labels: ["auto-detected", "needs-investigation"],
    body: `
      ## Problem
      ${errorLog}

      ## Context
      - Activity: ${activity.id}
      - Execution: ${execution.id}
      - Trace: ${execution.traceId}

      ## What Was Tried
      ${attempts.map(a => `- ${a.approach}: ${a.outcome}`).join('\n')}

      ## Suggested Next Steps
      ${suggestedActions}

      Created automatically by MiniBob during execution ${execution.id}
    `
  })
}
```

**When MiniBob Fixes Issues**:
```javascript
// Automatic issue closure
if (execution.success && linkedIssue) {
  closeIssue({
    issueNumber: linkedIssue,
    comment: `
      ## Resolution
      Fixed in execution ${execution.id}

      ## Approach
      ${execution.summary}

      ## Verification
      - Tests passed: ✅
      - Duration: ${execution.duration}ms
      - Cost: $${execution.cost}

      Trace: ${execution.traceId}
    `
  })
}
```

### Activities Needed

**`activities/github/create-issue-auto.json`**:
```json
{
  "id": "create-issue-auto",
  "name": "Create GitHub Issue Automatically",
  "description": "Creates GitHub issue when MiniBob encounters unresolved problems",
  "triggers": [
    "execution.failed && retryCount >= maxAttempts",
    "codeQualityIssue.detected",
    "documentationOutdated.detected"
  ],
  "variables": [
    { "name": "problemType", "type": "string" },
    { "name": "errorLog", "type": "string" },
    { "name": "executionId", "type": "string" },
    { "name": "suggestedLabels", "type": "array" }
  ],
  "tasks": [
    {
      "id": "generate-issue-body",
      "prompt": {
        "template": "Analyze this problem and create a detailed GitHub issue:\n\nError: {{errorLog}}\n\nInclude: problem summary, context, what was tried, suggested next steps"
      }
    },
    {
      "id": "create-issue",
      "dependencies": ["generate-issue-body"],
      "type": "github",
      "command": {
        "operation": "createIssue",
        "params": {
          "title": "{{generate-issue-body.title}}",
          "body": "{{generate-issue-body.body}}",
          "labels": "{{suggestedLabels}}"
        }
      }
    }
  ]
}
```

**`activities/github/update-issue-auto.json`**: Link PRs, commits, and executions to issues

**`activities/github/close-issue-auto.json`**: Close issues when problems are resolved

### GitHub Actions Workflow

**`.github/workflows/minibob-autonomous.yml`**:
```yaml
name: MiniBob Autonomous Development

on:
  push:
    branches: [main]
  issues:
    types: [opened, labeled]
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  autonomous-development:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Run MiniBob Autonomous Mode
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          METABOB_API_KEY: ${{ secrets.METABOB_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # MiniBob works on labeled issues
          minibob --idle --max-tasks 3

      - name: Create PR if Changes Made
        if: success()
        uses: peter-evans/create-pull-request@v5
        with:
          title: "Autonomous improvements by MiniBob"
          body: "Automated changes from MiniBob autonomous development session"
          labels: auto-generated, minibob
```

## Phase 2: Documentation Maintenance (Week 1-2)

### Auto-Update Documentation

**When Code Changes**:
```javascript
if (execution.filesModified.includes('activities/')) {
  updateREADME({
    section: 'Activities',
    operation: 'regenerate-activity-list'
  })
}

if (execution.filesModified.some(f => f.includes('.json'))) {
  updateActivityInventory()
}
```

**Activities Needed**:

**`activities/upkeep/sync-readme-auto.json`**:
- Triggered after activity changes
- Regenerates activity list
- Updates examples
- Refreshes metrics

**`activities/upkeep/sync-changelog-auto.json`**:
- Triggered after successful executions
- Adds entry for new features
- Links to issues/PRs
- Includes trace IDs

**`activities/upkeep/update-learning-metrics-doc.json`**:
- Runs daily
- Queries backend for latest metrics
- Updates LEARNING_PROGRESS_REPORT.md
- Generates charts/graphs

### Link Related Information

**Cross-Reference System**:
```markdown
## Execution exec_1775766690525_gcalm

**Related**:
- Issue: #42 (created this execution)
- PR: #43 (fix applied)
- Commits: a1b2c3d, d4e5f6g
- Activities: fix-test-failure, run-test-suite
- Parent Execution: exec_1775766500000_abc123
- Child Executions: exec_1775766800000_def456
```

**Activities Needed**:

**`activities/upkeep/link-execution-artifacts.json`**:
- Links execution → issue → PR → commits
- Creates relationship graph
- Updates documentation

## Phase 3: Workspace Cleanup (Week 2)

### Autonomous Cleanup

**What Gets Cleaned**:
- ❌ One-off test files (`test-*.tmp`, `*.backup.*`)
- ❌ Environment-specific configs (`.env.local`, `config.dev.json`)
- ❌ Build artifacts not in `.gitignore`
- ❌ Unused imports in source files
- ❌ Deprecated code markers older than 2 commits
- ❌ Duplicate documentation
- ❌ Orphaned activity files

**Activities Needed**:

**`activities/cleanup/remove-test-artifacts.json`**:
```json
{
  "tasks": [
    {
      "id": "find-test-artifacts",
      "type": "command",
      "command": {
        "run": "find . -name '*.tmp' -o -name '*.backup.*' -o -name 'test-*.tmp'"
      }
    },
    {
      "id": "confirm-safe-to-delete",
      "dependencies": ["find-test-artifacts"],
      "prompt": {
        "template": "Review these files: {{find-test-artifacts.output}}\n\nWhich are safe to delete?"
      }
    },
    {
      "id": "delete-artifacts",
      "dependencies": ["confirm-safe-to-delete"],
      "type": "command",
      "command": {
        "run": "rm {{confirm-safe-to-delete.filesToDelete}}"
      }
    }
  ]
}
```

**`activities/cleanup/remove-unused-imports.json`**:
- Scans TypeScript files
- Identifies unused imports
- Removes them
- Updates files

**`activities/cleanup/consolidate-docs.json`**:
- Finds duplicate documentation
- Merges related docs
- Removes outdated versions
- Updates cross-references

### Automated Cleanup Schedule

**Daily**:
- Remove test artifacts
- Update documentation links
- Check for deprecated code

**Weekly**:
- Consolidate documentation
- Remove unused imports
- Clean up activity inventory

**Monthly**:
- Archive old execution traces
- Prune underperforming variants
- Reorganize file structure

## Phase 4: GitHub Pages Demo Site (Week 2-3)

### Live Demo Architecture

**`public/index.html`** - Main dashboard:
```html
<!DOCTYPE html>
<html>
<head>
  <title>MiniBob Autonomous Development Demo</title>
</head>
<body>
  <h1>MiniBob: Self-Improving AI Developer</h1>

  <section id="live-metrics">
    <h2>Learning Metrics (Real-Time)</h2>
    <div class="metric">
      <span>Success Rate:</span>
      <span id="success-rate">Loading...</span>
    </div>
    <div class="metric">
      <span>Avg Duration:</span>
      <span id="avg-duration">Loading...</span>
    </div>
    <div class="metric">
      <span>Avg Cost:</span>
      <span id="avg-cost">Loading...</span>
    </div>
  </section>

  <section id="recent-executions">
    <h2>Recent Activity</h2>
    <ul id="execution-list"></ul>
  </section>

  <section id="execution-graph">
    <h2>Execution Graph</h2>
    <canvas id="graph-canvas"></canvas>
  </section>

  <section id="learning-curves">
    <h2>Learning Over Time</h2>
    <canvas id="learning-chart"></canvas>
  </section>
</body>
</html>
```

**`public/js/dashboard.js`** - Fetch metrics from backend:
```javascript
async function fetchMetrics() {
  const response = await fetch('https://activity.metabob.com/v2/activities/metrics', {
    headers: { 'Authorization': 'ApiKey <public-read-only-key>' }
  })
  const data = await response.json()

  updateDashboard(data)
}

function updateDashboard(data) {
  document.getElementById('success-rate').textContent =
    `${(data.successRate * 100).toFixed(1)}%`
  document.getElementById('avg-duration').textContent =
    `${data.avgDuration.toFixed(1)}s`
  document.getElementById('avg-cost').textContent =
    `$${data.avgCost.toFixed(3)}`

  renderExecutionGraph(data.executionGraph)
  renderLearningCurves(data.learningHistory)
}
```

### Activities to Build Demo Site

**`activities/development/update-demo-site.json`**:
```json
{
  "id": "update-demo-site",
  "name": "Update GitHub Pages Demo Site",
  "description": "Updates the public demo site with latest metrics and examples",
  "tasks": [
    {
      "id": "fetch-latest-metrics",
      "type": "http",
      "request": {
        "url": "https://activity.metabob.com/v2/activities/metrics",
        "method": "GET"
      }
    },
    {
      "id": "generate-metrics-json",
      "dependencies": ["fetch-latest-metrics"],
      "type": "transform",
      "transform": {
        "operation": "formatForDashboard",
        "output": "public/data/metrics.json"
      }
    },
    {
      "id": "update-dashboard-html",
      "dependencies": ["generate-metrics-json"],
      "prompt": {
        "template": "Update public/index.html to reflect latest metrics and add new examples"
      }
    },
    {
      "id": "commit-and-push",
      "dependencies": ["update-dashboard-html"],
      "type": "command",
      "command": {
        "run": "git add public/ && git commit -m 'Update demo site with latest metrics' && git push"
      }
    }
  ],
  "schedule": {
    "cron": "0 */4 * * *"  // Every 4 hours
  }
}
```

### Demo Site Features

**1. Live Learning Metrics**:
- Success rate over time
- Cost reduction graph
- Speed improvements
- Thompson Sampling convergence

**2. Recent Executions**:
- Last 10 executions with outcomes
- Links to traces in backend
- Activity used + duration + cost

**3. Execution Graph Visualization**:
- D3.js force-directed graph
- Nodes = activities
- Edges = sequences
- Edge weight = success rate

**4. Real Examples**:
- "Watch MiniBob fix a bug"
- "See composition in action"
- "Learning from failures"

**5. Interactive Demo**:
- Submit a goal
- Watch MiniBob work
- See trace in real-time

## Phase 5: Continuous Autonomous Improvement (Ongoing)

### Daily Autonomous Tasks

**Morning (6 AM)**:
```bash
# Clean up workspace
minibob --template activities/cleanup/remove-test-artifacts.json
minibob --template activities/cleanup/remove-unused-imports.json

# Update documentation
minibob --template activities/upkeep/sync-readme-auto.json
minibob --template activities/upkeep/update-learning-metrics-doc.json
```

**Afternoon (2 PM)**:
```bash
# Check for open issues labeled "auto-fix"
minibob --template activities/github/process-auto-fix-issues.json

# Update demo site
minibob --template activities/development/update-demo-site.json
```

**Evening (10 PM)**:
```bash
# Analyze today's executions
minibob --template activities/monitoring/analyze-daily-traces.json

# Create improvement suggestions
minibob --template activities/upkeep/suggest-improvements.json
```

### Self-Improvement Loop

```
1. Execute activity → Record trace
2. Analyze trace → Identify patterns
3. Extract template → Create variant
4. Test variant → Compare performance
5. Update Thompson Sampling → Prefer better variant
6. Repeat
```

## Implementation Timeline

**Week 1**:
- ✅ Day 1-2: Create GitHub integration activities
- ✅ Day 3-4: Implement auto-issue creation/closure
- ✅ Day 5-7: Setup autonomous cleanup

**Week 2**:
- ✅ Day 8-10: Build demo site structure
- ✅ Day 11-12: Integrate metrics API
- ✅ Day 13-14: Deploy to GitHub Pages

**Week 3**:
- ✅ Day 15-17: Add execution graph visualization
- ✅ Day 18-19: Implement interactive features
- ✅ Day 20-21: Refine and polish

**Week 4+**:
- ✅ Continuous autonomous operation
- ✅ Monitor and improve
- ✅ Expand capabilities

## Success Criteria

**GitHub Integration**:
- ✅ MiniBob creates issues for problems
- ✅ MiniBob links issues/PRs/commits/traces
- ✅ MiniBob closes issues when resolved
- ✅ All activity tracked in GitHub

**Documentation**:
- ✅ README always current
- ✅ CHANGELOG updated automatically
- ✅ Learning metrics documented daily
- ✅ Cross-references maintained

**Workspace**:
- ✅ No test artifacts
- ✅ No environment-specific configs
- ✅ No unused imports
- ✅ Clean git status

**Demo Site**:
- ✅ Live metrics visible
- ✅ Recent executions shown
- ✅ Execution graph rendered
- ✅ Learning curves displayed
- ✅ Updated automatically

**Autonomous Operation**:
- ✅ Runs without human intervention
- ✅ Creates and resolves issues
- ✅ Improves over time
- ✅ Maintains itself

## Getting Started

**Immediate Actions** (use MiniBob):
```bash
cd demos/minibob-cicd

# 1. Create GitHub integration activities
minibob --single "Create create-issue-auto.json activity that automatically
  creates GitHub issues when executions fail after max retries"

# 2. Create workspace cleanup activity
minibob --single "Create remove-test-artifacts.json activity that finds and
  removes temporary test files and backups"

# 3. Start building demo site
minibob --single "Create public/index.html for GitHub Pages demo showing
  MiniBob's learning metrics and recent executions"

# 4. Setup GitHub Actions
minibob --single "Create .github/workflows/minibob-autonomous.yml that runs
  MiniBob in autonomous mode every 6 hours"
```

---

**Vision**: MiniBob autonomously develops, maintains, documents, and demonstrates itself through a public GitHub Pages site, creating and resolving issues, keeping workspace clean, and continuously improving based on execution traces.

**Tagline**: "Watch AI Develop Itself in Real-Time"
