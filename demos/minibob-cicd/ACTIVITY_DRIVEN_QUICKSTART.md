# Activity-Driven Development: Quick Start

**Goal**: Deploy a complete web application to GitHub Pages with the entire development lifecycle managed by MiniBob activities.

## What You'll Build

A **Task Manager** web application that:
- Frontend: HTML/CSS/JavaScript hosted on GitHub Pages
- Backend: GitHub Issues API (tasks stored as issues)
- Development: 100% managed by MiniBob activities
- Deployment: Automated via GitHub Actions
- Monitoring: Continuous performance tracking
- Maintenance: Automated dependency updates and CI/CD refresh

## Quick Start (5 minutes)

### 1. Initial Setup

```bash
cd demos/minibob-cicd

# Export API keys
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
export METABOB_API_KEY="your-metabob-key"
export GITHUB_TOKEN="your-github-token"  # or use gh auth login

# Install dependencies
bun install

# Verify setup
gh auth status
```

### 2. Deploy Initial App

```bash
# Create initial deployment
git add public/
git commit -m "feat: initial task manager app"
git push origin main

# GitHub Actions will automatically deploy to Pages
# Wait ~2 minutes, then visit:
# https://<your-username>.github.io/minibob-cicd-demo/
```

### 3. Run Complete Activity-Driven Workflow

```bash
# This runs the ENTIRE development lifecycle as activities:
./scripts/orchestrate-development.sh "Add dark mode toggle to task manager"
```

**What happens:**
1. **Create Issue** (activity) → GitHub issue created with analysis
2. **Create Branch** (activity) → Branch created from issue
3. **Implement** (activity) → MiniBob implements the feature
4. **Create PR** (activity) → PR created with auto-generated description
5. **CI/CD** (workflow + activity) → Tests run, auto-fix if needed
6. **Merge PR** (activity) → PR merged after CI passes
7. **Deploy** (workflow) → Deployed to GitHub Pages

All in ~5-10 minutes, fully automated!

## Activity Catalog

### GitHub Management

**`activities/github/create-issue-from-bug.json`**
```bash
bunx @metabob/minibob@latest \
  --template activities/github/create-issue-from-bug.json \
  --var "bugDescription=Task deletion not working" \
  --trace
```

**`activities/github/create-pr-from-branch.json`**
```bash
bunx @metabob/minibob@latest \
  --template activities/github/create-pr-from-branch.json \
  --var "baseBranch=main" \
  --trace
```

**`activities/github/merge-pr.json`**
```bash
bunx @metabob/minibob@latest \
  --template activities/github/merge-pr.json \
  --var "prNumber=5" \
  --trace
```

### CI/CD Management

**Auto-fix CI failures** (from existing activities):
```bash
bunx @metabob/minibob@latest \
  --template activities/cicd/auto-fix-ci-failure.json \
  --var "prNumber=5" \
  --trace
```

### Discovery & Learning

**Discovery activities** (Loop 3):
```bash
# Scan for bugs
bunx @metabob/minibob@latest \
  --template activities/discovery/scan-file-system.json \
  --var "goalCategory=bugfix" \
  --trace

# Check execution history
bunx @metabob/minibob@latest \
  --template activities/discovery/scan-execution-traces.json \
  --var "goalCategory=bugfix" \
  --trace
```

## Complete Workflow Example

### Scenario: Add Feature from Scratch

```bash
# Step 1: Create issue
ISSUE=$(bunx @metabob/minibob@latest \
  --template activities/github/create-issue-from-bug.json \
  --var "bugDescription=Add filter by priority" \
  --trace | grep -oP 'issues/\K\d+')

echo "Created issue #$ISSUE"

# Step 2: Create branch
git checkout -b "feature/issue-${ISSUE}-priority-filter"

# Step 3: Implement (using MiniBob single mode)
bunx @metabob/minibob@latest --single \
  "Implement priority filter for tasks. Read public/app.js and add filter dropdown for priority (high, medium, low)"

# Step 4: Commit
git add -A
git commit -m "feat: add priority filter

Implements issue #${ISSUE}
- Add priority dropdown filter
- Update task rendering logic
- Add priority colors"

# Step 5: Push
git push -u origin HEAD

# Step 6: Create PR
PR=$(bunx @metabob/minibob@latest \
  --template activities/github/create-pr-from-branch.json \
  --trace | grep -oP 'pull/\K\d+')

echo "Created PR #$PR"

# Step 7: Wait for CI (automatic in GitHub Actions)
gh pr view $PR --web

# Step 8: Merge (after CI passes)
bunx @metabob/minibob@latest \
  --template activities/github/merge-pr.json \
  --var "prNumber=$PR" \
  --trace
```

## Learning from Activities

All activities record traces to the learning backend. After 10 runs:

**Issue Creation**:
- Learns common bug patterns
- Learns which issue templates are clearest
- Thompson Sampling: Best issue creation strategies

**PR Creation**:
- Learns what makes good PR descriptions
- Learns which commit patterns are common
- Impulse relevance: Which files are most relevant

**Auto-Fix**:
- Learns which CI failures are common
- Learns which fix patterns work
- Thompson Sampling: Best fix approaches

**View Learning Metrics**:
```bash
./scripts/show-learning-metrics.sh
```

## Integration with Existing Processes

### GitHub Issues API

The app uses GitHub Issues as a backend:
- Each task = 1 GitHub issue with `task` label
- Task completion = Close issue
- Task deletion = Close + add `deleted` label

**Why?** Demonstrates integration with existing workflows. Issues can be created:
- Via the web app
- Via GitHub UI
- Via MiniBob activities
- Via gh CLI

All sync automatically!

### GitHub Actions CI/CD

Standard workflows:
- `ci.yml` - Runs on every PR
- `deploy-pages.yml` - Deploys to GitHub Pages on main

**Enhanced with MiniBob**:
- Auto-fix failing CI (activity)
- Auto-update dependencies (activity)
- Performance monitoring (activity)

### GitHub Projects

Issues auto-added to project board via activities:
```bash
# In create-issue-from-bug.json
gh project item-add 1 --owner @me --content-id $ISSUE_NUM
```

## Advanced Usage

### Scheduled Monitoring

Add to `.github/workflows/monitoring.yml`:

```yaml
on:
  schedule:
    - cron: '0 * * * *'  # Every hour

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Check Performance
        run: |
          bunx @metabob/minibob@latest \
            --template activities/monitoring/check-performance.json \
            --var "siteUrl=https://user.github.io/repo" \
            --trace
```

### Automated Maintenance

Weekly dependency updates:
```yaml
on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday

jobs:
  maintain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Update Dependencies
        run: |
          bunx @metabob/minibob@latest \
            --template activities/maintenance/update-dependencies.json \
            --trace
```

## Troubleshooting

### "Failed to create issue"

**Cause**: GitHub token doesn't have `repo` scope

**Fix**:
```bash
gh auth refresh -s repo
```

### "Cannot find activity template"

**Cause**: Running from wrong directory

**Fix**:
```bash
cd demos/minibob-cicd
```

### "CI checks never complete"

**Cause**: GitHub Actions not set up in repo

**Fix**:
1. Go to repo Settings → Pages
2. Set Source to "GitHub Actions"
3. Enable workflows in Actions tab

## File Structure

```
demos/minibob-cicd/
├── public/                      # GitHub Pages site ✨
│   ├── index.html              # Task manager UI
│   ├── styles.css              # Styles
│   ├── app.js                  # Application logic
│   └── api.js                  # GitHub API client
├── activities/
│   ├── github/                 # GitHub management ⚙️
│   │   ├── create-issue-from-bug.json
│   │   ├── create-pr-from-branch.json
│   │   └── merge-pr.json
│   ├── cicd/                   # CI/CD automation 🚀
│   │   └── auto-fix-ci-failure.json (existing)
│   ├── discovery/              # Loop 3: Discovery 🔍
│   │   ├── scan-file-system.json
│   │   ├── scan-git-history.json
│   │   └── scan-execution-traces.json
│   ├── learning/               # Loop 1+2: Learning 🧠
│   │   ├── fix-test-failure.json
│   │   └── fix-test-failure-with-discovery.json
│   └── monitoring/             # Performance tracking 📊
│       └── check-performance.json (planned)
├── .github/workflows/
│   ├── ci.yml                  # PR validation (existing)
│   └── deploy-pages.yml        # Deploy to Pages ✨ NEW
└── scripts/
    ├── orchestrate-development.sh    # Complete workflow ✨ NEW
    └── show-learning-metrics.sh      # Learning dashboard

✨ = New for activity-driven development
```

## Benefits

### 1. Everything is Traceable
- Every action recorded as activity execution
- Full development history in backend
- Learning from all interactions

### 2. Everything Improves
- Thompson Sampling selects better activities
- Impulse relevance optimizes context
- Discovery effectiveness learns what to scan

### 3. Everything is Composable
- Activities chain together
- Reusable across projects
- Customizable workflows

### 4. Everything is Automated
- Issue creation → automated
- PR creation → automated
- CI/CD fixes → automated
- Deployment → automated
- Monitoring → automated
- Maintenance → automated

## Next Steps

1. **Run the quickstart** - Deploy the app and run a complete workflow
2. **Add your features** - Use activities to implement new features
3. **Monitor learning** - Watch Thompson Sampling improve over time
4. **Customize activities** - Adapt for your specific workflow
5. **Scale up** - Apply to larger projects

## Resources

- **Activity Documentation**: `ACTIVITY_DRIVEN_DEVELOPMENT.md`
- **Learning Loops**: `LEARNING_LOOPS_DEMO.md`
- **Setup Guide**: `SETUP.md`
- **Implementation Status**: `THREE_LOOPS_STATUS.md`

---

**Based on**:
- [GitHub Pages Deployment Guide (2026)](https://docs.bswen.com/blog/2026-03-26-how-to-deploy-static-site-github-pages/)
- [GitHub Actions for Pages](https://github.com/peaceiris/actions-gh-pages)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
