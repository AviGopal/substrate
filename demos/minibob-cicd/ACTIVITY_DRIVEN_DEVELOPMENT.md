# Activity-Driven Development with MiniBob

**Goal**: Demonstrate MiniBob managing an entire web application lifecycle through activities only.

## The Web Application

We'll build a simple **Task Manager** web application hosted on GitHub Pages:
- Frontend: HTML/CSS/JavaScript (vanilla, no framework)
- Backend: GitHub Issues API (for task storage)
- Deployment: GitHub Pages + GitHub Actions
- Management: 100% MiniBob activities

## Complete Activity-Based Workflow

### Development Lifecycle Activities

All development is done through MiniBob activities:

```
┌─────────────────────────────────────────────────────────────┐
│           Activity-Driven Development Lifecycle             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. ISSUE CREATION (activity)                                │
│     ├─> Scan for bugs/improvements                          │
│     ├─> Create GitHub issue with template                   │
│     └─> Label and prioritize                                │
│                                                              │
│  2. BRANCH CREATION (activity)                               │
│     ├─> Create feature/fix branch from issue                │
│     ├─> Link branch to issue                                │
│     └─> Set up tracking                                     │
│                                                              │
│  3. DEVELOPMENT (activity)                                   │
│     ├─> Read issue requirements                             │
│     ├─> Implement changes                                   │
│     ├─> Write/update tests                                  │
│     └─> Validate locally                                    │
│                                                              │
│  4. PR CREATION (activity)                                   │
│     ├─> Generate PR description from commits                │
│     ├─> Run pre-flight checks                               │
│     ├─> Create PR with issue reference                      │
│     └─> Request review                                      │
│                                                              │
│  5. CI/CD VALIDATION (activity)                              │
│     ├─> Run tests                                           │
│     ├─> Check bundle size                                   │
│     ├─> Verify deployment preview                           │
│     └─> Report status to PR                                 │
│                                                              │
│  6. AUTO-FIX FAILURES (activity)                             │
│     ├─> Analyze CI failure                                  │
│     ├─> Apply fix                                           │
│     ├─> Push to PR branch                                   │
│     └─> Re-trigger CI                                       │
│                                                              │
│  7. PR MERGE (activity)                                      │
│     ├─> Verify CI passes                                    │
│     ├─> Squash commits                                      │
│     ├─> Merge to main                                       │
│     └─> Close linked issue                                  │
│                                                              │
│  8. DEPLOYMENT (activity)                                    │
│     ├─> Build static site                                   │
│     ├─> Deploy to GitHub Pages                              │
│     ├─> Verify deployment                                   │
│     └─> Update deployment status                            │
│                                                              │
│  9. MONITORING (activity)                                    │
│     ├─> Check page load times                               │
│     ├─> Monitor bundle size                                 │
│     ├─> Track error rates                                   │
│     └─> Create issues for degradation                       │
│                                                              │
│  10. MAINTENANCE (activity)                                  │
│      ├─> Update dependencies                                │
│      ├─> Refresh CI/CD workflows                            │
│      ├─> Clean up stale branches                            │
│      └─> Archive old issues                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Activity Catalog

### Issue Management Activities

**`activities/github/create-issue-from-bug.json`**
- Scans code/logs for bugs
- Creates GitHub issue with template
- Labels: bug, priority
- Assigns to project board

**`activities/github/create-issue-from-improvement.json`**
- Analyzes code for improvement opportunities
- Creates GitHub issue with proposal
- Labels: enhancement
- Links to relevant code

**`activities/github/resolve-issue.json`**
- Reads issue description
- Creates branch
- Implements fix/feature
- Creates PR linking issue

### Branch Management Activities

**`activities/github/create-branch-from-issue.json`**
- Reads issue title/number
- Creates branch: `feature/issue-123-description`
- Sets up tracking
- Comments on issue with branch link

**`activities/github/cleanup-merged-branches.json`**
- Lists merged branches
- Deletes remote branches
- Updates local references
- Reports cleanup summary

### PR Management Activities

**`activities/github/create-pr-from-branch.json`**
- Analyzes commits in branch
- Generates PR description
- Links to issues
- Sets labels and reviewers

**`activities/github/update-pr-description.json`**
- Reads new commits
- Updates description with changes
- Adds screenshots (if applicable)
- Updates checklist

**`activities/github/merge-pr.json`**
- Verifies CI passes
- Checks review approvals
- Squashes commits
- Merges to main
- Closes linked issues

### CI/CD Activities

**`activities/cicd/validate-pr.json`**
- Runs tests
- Checks type safety
- Validates bundle size
- Reports to PR

**`activities/cicd/auto-fix-ci-failure.json`**
- Analyzes failure logs
- Applies fix (similar to existing activity)
- Pushes to PR branch
- Comments on PR with fix

**`activities/cicd/deploy-to-pages.json`**
- Builds static site
- Uploads to GitHub Pages
- Verifies deployment
- Updates deployment URL in README

### Monitoring Activities

**`activities/monitoring/check-performance.json`**
- Loads deployed site
- Measures page load time
- Checks bundle size
- Creates issue if degraded

**`activities/monitoring/check-errors.json`**
- Scans browser console errors
- Checks HTTP errors
- Creates issues for new errors
- Links to error traces

### Maintenance Activities

**`activities/maintenance/update-dependencies.json`**
- Checks for outdated packages
- Updates to latest compatible versions
- Runs tests
- Creates PR with updates

**`activities/maintenance/refresh-cicd.json`**
- Checks for workflow updates
- Updates action versions
- Validates workflows
- Creates PR with changes

## The Web Application

### Simple Task Manager (GitHub Pages)

**Features**:
- Create/read/update/delete tasks
- Store tasks in GitHub Issues
- Filter by status/label
- Responsive design
- Offline support (localStorage cache)

**Tech Stack**:
- HTML5 + CSS3 + Vanilla JS
- GitHub Issues API (backend)
- GitHub Pages (hosting)
- GitHub Actions (CI/CD)

### File Structure

```
demos/minibob-cicd/
├── public/                    # GitHub Pages site
│   ├── index.html            # Task manager UI
│   ├── styles.css            # Styles
│   ├── app.js                # Application logic
│   └── api.js                # GitHub API client
├── activities/
│   ├── github/               # GitHub management
│   │   ├── create-issue-from-bug.json
│   │   ├── create-branch-from-issue.json
│   │   ├── create-pr-from-branch.json
│   │   └── merge-pr.json
│   ├── cicd/                 # CI/CD automation
│   │   ├── validate-pr.json
│   │   ├── auto-fix-ci-failure.json
│   │   └── deploy-to-pages.json
│   ├── monitoring/           # Performance tracking
│   │   ├── check-performance.json
│   │   └── check-errors.json
│   └── maintenance/          # Upkeep tasks
│       ├── update-dependencies.json
│       └── refresh-cicd.json
├── .github/
│   └── workflows/
│       ├── ci.yml            # PR validation
│       ├── deploy.yml        # Deploy to Pages
│       └── monitoring.yml    # Scheduled monitoring
└── scripts/
    ├── orchestrate-development.sh
    └── demo-full-cycle.sh
```

## Activity Composition Patterns

### Pattern 1: Issue → Branch → PR → Merge

**Orchestrated by**: `scripts/orchestrate-development.sh`

```bash
#!/usr/bin/env bash
# Complete development cycle as activities

ISSUE_TITLE="$1"

# Step 1: Create issue
ISSUE_NUM=$(bunx @metabob/minibob@latest \
  --template activities/github/create-issue-from-improvement.json \
  --var "title=$ISSUE_TITLE" \
  --trace | jq -r '.issue_number')

# Step 2: Create branch from issue
BRANCH=$(bunx @metabob/minibob@latest \
  --template activities/github/create-branch-from-issue.json \
  --var "issueNumber=$ISSUE_NUM" \
  --trace | jq -r '.branch_name')

# Step 3: Implement changes
bunx @metabob/minibob@latest \
  --template activities/github/resolve-issue.json \
  --var "issueNumber=$ISSUE_NUM" \
  --trace

# Step 4: Create PR
PR_NUM=$(bunx @metabob/minibob@latest \
  --template activities/github/create-pr-from-branch.json \
  --var "branch=$BRANCH" \
  --trace | jq -r '.pr_number')

# Step 5: Wait for CI, auto-fix if needed
while true; do
  CI_STATUS=$(gh pr view $PR_NUM --json statusCheckRollup --jq '.statusCheckRollup[0].conclusion')

  if [ "$CI_STATUS" = "SUCCESS" ]; then
    break
  elif [ "$CI_STATUS" = "FAILURE" ]; then
    # Auto-fix with activity
    bunx @metabob/minibob@latest \
      --template activities/cicd/auto-fix-ci-failure.json \
      --var "prNumber=$PR_NUM" \
      --trace
  fi

  sleep 30
done

# Step 6: Merge PR
bunx @metabob/minibob@latest \
  --template activities/github/merge-pr.json \
  --var "prNumber=$PR_NUM" \
  --trace

echo "✅ Complete cycle: Issue $ISSUE_NUM → Branch $BRANCH → PR $PR_NUM → Merged"
```

### Pattern 2: Scheduled Monitoring

**Triggered by**: GitHub Actions (cron schedule)

```yaml
# .github/workflows/monitoring.yml
name: Continuous Monitoring

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1

      - name: Check Performance
        run: |
          bunx @metabob/minibob@latest \
            --template activities/monitoring/check-performance.json \
            --var "siteUrl=https://$(gh repo view --json nameWithOwner -q .nameWithOwner).github.io" \
            --trace
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Check Errors
        run: |
          bunx @metabob/minibob@latest \
            --template activities/monitoring/check-errors.json \
            --var "siteUrl=https://$(gh repo view --json nameWithOwner -q .nameWithOwner).github.io" \
            --trace
```

### Pattern 3: Maintenance Loop

**Triggered by**: Weekly schedule

```bash
#!/usr/bin/env bash
# Weekly maintenance as activities

# Update dependencies
bunx @metabob/minibob@latest \
  --template activities/maintenance/update-dependencies.json \
  --trace

# Refresh CI/CD workflows
bunx @metabob/minibob@latest \
  --template activities/maintenance/refresh-cicd.json \
  --trace

# Clean up merged branches
bunx @metabob/minibob@latest \
  --template activities/github/cleanup-merged-branches.json \
  --trace
```

## Learning from Development Activities

All activities contribute traces to the learning backend:

**Issue Creation** (Loop 3 - Discovery):
- Learns what types of issues are common
- Learns which code patterns lead to bugs
- Thompson Sampling: Which issue templates are clearest?

**PR Creation** (Loop 1 - Impulse Flow):
- Learns what context is needed for PR descriptions
- Learns which commits should be highlighted
- Impulse relevance: Which files are most relevant?

**Auto-Fix** (Loop 2 - External Validation):
- Learns which CI failures are common
- Learns which fix patterns work
- Thompson Sampling: Which fix approaches succeed?

**Monitoring** (Loop 3 - Discovery):
- Learns what performance metrics matter
- Learns when to create issues vs ignore noise
- Thompson Sampling: Which degradations are real problems?

## Complete Demo Scenario

### Scenario: Build Task Manager from Scratch

**Input**: Natural language goal

```bash
bunx @metabob/minibob@latest --single \
  "Build a task manager web app that stores tasks in GitHub Issues,
   deploy it to GitHub Pages, and set up full CI/CD"
```

**What MiniBob Does** (through activity composition):

1. **Create issues for major components**:
   - Issue #1: "Create basic HTML/CSS structure"
   - Issue #2: "Implement task CRUD with GitHub API"
   - Issue #3: "Set up GitHub Pages deployment"
   - Issue #4: "Add CI/CD validation"

2. **For each issue, run development cycle**:
   - Create branch
   - Implement changes
   - Create PR
   - Auto-fix CI failures
   - Merge when green

3. **Set up continuous workflows**:
   - Monitoring activity (scheduled hourly)
   - Maintenance activity (scheduled weekly)
   - Auto-fix activity (triggered on CI failure)

4. **Deploy and verify**:
   - Build static site
   - Deploy to GitHub Pages
   - Verify deployment
   - Create issue if deployment fails

**Result**: Fully functional app with automated lifecycle management.

## Benefits of Activity-Driven Development

### 1. Everything is Traceable
- Every action recorded as execution trace
- Full history of development decisions
- Learning from all interactions

### 2. Everything Improves Over Time
- Thompson Sampling for activity selection
- Impulse relevance for context optimization
- Discovery effectiveness for better scanning

### 3. Everything is Composable
- Activities chain together
- Reusable across projects
- Customizable for different workflows

### 4. Everything is Observable
- Dashboard shows all activity executions
- Metrics track improvement
- Clear visibility into what's happening

## Next Steps

1. **Create the web application** (activities/development/)
2. **Create GitHub management activities** (activities/github/)
3. **Create CI/CD activities** (activities/cicd/)
4. **Create monitoring activities** (activities/monitoring/)
5. **Create orchestration scripts** (scripts/)
6. **Run complete demo**

This demonstrates MiniBob as a **development assistant that learns from everything** rather than just a one-off tool.

---

## Sources

Based on research from:
- [GitHub Pages Documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [GitHub Actions for GitHub Pages](https://github.com/peaceiris/actions-gh-pages)
- [Deploy to GitHub Pages (2026 Guide)](https://docs.bswen.com/blog/2026-03-26-how-to-deploy-static-site-github-pages/)
- [GitHub Actions Deploy Pages](https://github.com/actions/deploy-pages)
- [Using Custom Workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
