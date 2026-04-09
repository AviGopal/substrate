# MiniBob Autonomous CI/CD Setup

**Purpose**: Enable fully autonomous development with MiniBob, trace collection, and optimization feedback loops.

## Architecture

```
GitHub → MiniBob Execution → Traces → Backend → Analysis → GitHub Pages
   ↓                              ↓                              ↓
Issues                        activity.metabob.com        Optimization Points
   ↓                              ↓                              ↓
Labels (minibob)              Thompson Sampling          Development Feedback
   ↓                              ↓                              ↓
Autonomous Fix                Learning Loop              Continuous Improvement
```

## Components

### 1. GitHub Actions Workflow
**File**: `.github/workflows/minibob-autonomous-development.yml`

**Triggers**:
- `push` to main/dev branches
- `issues` opened with `minibob` label
- `schedule` every 6 hours
- `workflow_dispatch` for manual runs

**Jobs**:
1. **autonomous-development**
   - Installs MiniBob
   - Processes labeled issues
   - Runs autonomous boredom mode
   - Collects execution traces
   - Commits changes
   - Creates PRs

2. **deploy-pages**
   - Deploys trace visualization dashboard
   - Updates metrics in real-time

### 2. GitHub Pages Dashboard
**Files**:
- `public/index.html` - Task manager app (existing)
- `public/traces.html` - Trace visualization & optimization analysis (new)
- `public/metrics.json` - Latest metrics from backend
- `public/recent-executions.json` - Recent execution traces
- `public/traces/*.json` - Individual trace files

**Features**:
- Real-time success rate, duration, cost metrics
- Recent execution list with status
- Optimization opportunity detection
- Pattern analysis from execution logs

### 3. Trace Collection System

**Flow**:
```bash
# MiniBob executes activity
minibob --single "fix bug"
  → Logs: "Trace saved to backend: exec_improv_123_abc"

# CI/CD extracts trace ID
grep "Trace saved" execution.log > trace-ids.txt

# CI/CD fetches trace data
curl https://activity.metabob.com/v2/activities/execution-traces/exec_improv_123_abc
  → Saves to public/traces/exec_improv_123_abc.json

# GitHub Pages displays
traces.html reads public/traces/*.json
  → Shows execution details
  → Identifies patterns
  → Suggests optimizations
```

### 4. Optimization Feedback Loop

**Pattern Detection**:
- JSON parse errors (>3 = high priority)
- Unknown tool errors
- Timeout/hang issues
- Max turns reached frequently
- Low activity success rates (<50%)

**Recommendations**:
- Add validation
- Register missing tools
- Increase max turns
- Decompose activities
- Create variants

## Setup Instructions

### 1. Enable GitHub Pages

```bash
cd demos/minibob-cicd
git checkout -b gh-pages
git push -u origin gh-pages
```

**In GitHub repo settings**:
- Go to Settings → Pages
- Source: GitHub Actions
- Enable GitHub Pages

### 2. Add GitHub Secrets

Required secrets:
- `ANTHROPIC_API_KEY` - Claude API key
- `METABOB_API_KEY` - Activity backend API key

```bash
gh secret set ANTHROPIC_API_KEY
gh secret set METABOB_API_KEY
```

### 3. Create Initial Data Files

```bash
mkdir -p public/traces
echo "[]" > public/recent-executions.json
echo "{}" > public/metrics.json
date -u +"%Y-%m-%dT%H:%M:%SZ" > public/last-updated.txt
```

### 4. Test Workflow Locally

```bash
# Install Act (GitHub Actions local runner)
brew install act  # or equivalent

# Run workflow
act -j autonomous-development
```

### 5. Trigger First Run

**Option A: Push code**
```bash
git add .
git commit -m "feat: add MiniBob autonomous CI/CD"
git push
```

**Option B: Create issue**
```bash
gh issue create \
  --title "Fix JSON parse errors in documentation generation" \
  --body "Add validation to write tool to reject content >1000 chars" \
  --label "minibob"
```

**Option C: Manual dispatch**
```bash
gh workflow run minibob-autonomous-development.yml \
  -f goal="Create comprehensive activity composition documentation"
```

## Usage

### Autonomous Issue Resolution

1. User creates issue with `minibob` label
2. GitHub Actions triggers on issue open
3. MiniBob executes issue body as goal
4. MiniBob comments on issue with result + trace ID
5. If successful, creates PR with changes
6. If failed, comments with trace for debugging

### Scheduled Autonomous Development

Every 6 hours, MiniBob runs in boredom mode:
- Checks for pending tasks in backend queue
- Executes up to 3 tasks autonomously
- Commits improvements
- Creates PR for review

### Manual Goal Execution

```bash
gh workflow run minibob-autonomous-development.yml \
  -f goal="Your goal here"
```

## Monitoring

### GitHub Pages Dashboard

**URL**: `https://metabobproject.github.io/demo-minibob-cicd/traces.html`

**Metrics**:
- Success rate over time
- Average duration/cost trends
- Total executions
- Recent activity status

**Optimization Analysis**:
- Systematic bug detection
- Activity performance analysis
- Pattern recognition
- Actionable recommendations

### Trace Inspection

Individual traces available at:
`https://metabobproject.github.io/demo-minibob-cicd/traces/{trace-id}.json`

Contains:
- Input impulses
- Task execution sequence
- Tool calls and outputs
- Duration, cost, status
- Error messages (if failed)
- State transitions

## Feedback Loop

### 1. Execution → Traces
MiniBob records every execution to backend with full state

### 2. Traces → Patterns
Dashboard analyzes traces to identify:
- Repeated failures
- Performance bottlenecks
- Missing tools
- Sub-optimal activities

### 3. Patterns → Optimizations
System suggests:
- Bug fixes (JSON parse, tool registration)
- Activity improvements (max turns, validation)
- Composition patterns (known workflows)
- Thompson Sampling adjustments

### 4. Optimizations → Development
MiniBob uses optimization suggestions as goals:
```bash
# Dashboard identifies: "JSON parse errors (15 occurrences)"
# Creates issue automatically

# MiniBob executes issue goal
minibob --single "Fix JSON parse errors in write tool validation"

# Commits fix, traces improvement
# Dashboard verifies: "JSON parse errors: 0 occurrences" ✅
```

## Advanced: Continuous Optimization

### Automatic Issue Creation

Add to workflow:
```yaml
- name: Create issues from optimization points
  run: |
    curl https://metabobproject.github.io/demo-minibob-cicd/metrics.json | \
      jq -r '.optimizations[] | select(.priority == "high") | .title' | \
      while read TITLE; do
        gh issue create --title "$TITLE" --label "minibob" --label "optimization"
      done
```

### Thompson Sampling Monitoring

Query backend for activity α/β ratios:
```bash
curl "https://activity.metabob.com/v2/activities/templates" \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '.templates[] | {id, alpha, beta, successRate: (.alpha / (.alpha + .beta))}'
```

### Activity Variant Creation

When activity success rate <50% over 10 executions:
```bash
minibob --single "Create variant of low-performing activity with different approach"
```

## Troubleshooting

### Workflow fails with "minibob: command not found"
```bash
# Check Bun installation in workflow
bun --version
which minibob
```

### Traces not appearing on dashboard
```bash
# Check trace collection step
ls public/traces/
cat trace-ids.txt
```

### GitHub Pages not updating
```bash
# Verify deployment job
gh run list --workflow=minibob-autonomous-development.yml
gh run view <run-id> --log
```

### High cost/slow execution
Check dashboard optimization points for:
- Activities with >100s average duration
- High token usage per execution
- Improvisation vs. template usage ratio

## Success Metrics

**After 30 days of autonomous operation**:

- ✅ 100+ executions recorded
- ✅ Thompson Sampling converged (α >> β for good activities)
- ✅ Success rate >70%
- ✅ Average cost reduced by 40%+
- ✅ Zero critical bugs in production
- ✅ Dashboard shows continuous improvement trends

## Next Steps

1. Enable GitHub Pages
2. Add secrets
3. Trigger first workflow run
4. Monitor dashboard for optimizations
5. Review PRs created by MiniBob
6. Iterate on activities based on trace analysis

---

**Key Insight**: The dashboard doesn't just monitor - it drives improvement. Optimization points identified automatically become goals for MiniBob to execute, creating a continuous improvement loop.
