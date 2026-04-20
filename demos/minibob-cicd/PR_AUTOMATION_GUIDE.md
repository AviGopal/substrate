# MiniBob PR Automation Guide

**Complete CI/CD integration for autonomous development with automatic PR creation and merging.**

---

## Overview

This system enables MiniBob to:
1. **Execute tasks from local host** → Create PRs
2. **Execute tasks from GitHub Actions** → Create PRs
3. **Auto-merge PRs** when all checks pass
4. **Maintain code quality** through CI gates

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PR Automation System                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐          ┌──────────────────────┐
│  Local Host      │          │  GitHub Actions       │
│  Execution       │          │  Workflows            │
└────────┬─────────┘          └──────────┬───────────┘
         │                               │
         │ ./minibob-pr.sh              │ on: issues (labeled)
         │                               │ on: schedule (*/4h)
         │                               │
         ▼                               ▼
┌────────────────────────────────────────────────────┐
│            MiniBob Executes Goal                   │
│  - Reads issue or accepts goal string             │
│  - Creates branch: minibob/[type]-[timestamp]     │
│  - Executes with LLM + tools                      │
│  - Commits changes                                 │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│            Create Pull Request                      │
│  - Push branch to remote                           │
│  - Create PR with description                      │
│  - Add labels: minibob, automated                  │
│  - Link to issue (closes #N)                       │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│            CI - Quality Checks                      │
│  ✓ Lint                                            │
│  ✓ Type Check                                      │
│  ✓ Tests                                           │
│  ✓ Build                                           │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────┐
│            Auto-Merge Decision                      │
│  Checks:                                           │
│  - All CI checks passed?                           │
│  - Mergeable (no conflicts)?                       │
│  - Review approved or not required?                │
│                                                     │
│  If YES → Squash merge + delete branch             │
│  If NO → Wait for next trigger                     │
└────────────────────────────────────────────────────┘
```

---

## Workflows

### 1. CI - Quality Checks (`ci.yml`)

**Triggers:**
- Push to main, dev, feature/*, fix/*
- Pull requests to main, dev

**Steps:**
1. Checkout code
2. Install dependencies
3. Run lint
4. Run type check
5. Run tests
6. Build verification
7. Generate summary

**Purpose:** Validate code quality for all PRs before merging.

---

### 2. MiniBob Issue to PR (`minibob-issue-to-pr.yml`)

**Triggers:**
- Issue labeled with 'minibob'
- Issue comment contains '/minibob'
- Manual workflow dispatch

**Steps:**
1. Fetch issue details
2. Create branch: `minibob/issue-{num}-{timestamp}`
3. Execute MiniBob with issue as goal
4. Commit changes
5. Create PR
6. Comment on issue with PR link

**Purpose:** Convert issues into PRs automatically.

---

### 3. MiniBob Auto-Merge (`minibob-auto-merge.yml`)

**Triggers:**
- PR opened/synchronized/reopened
- Check suite completed
- CI workflow completed

**Steps:**
1. Identify PR (must have 'minibob' or 'automated' label)
2. Check PR status:
   - Mergeable?
   - All checks passed?
   - Review approved or not required?
3. Wait up to 5 minutes for checks
4. Auto-merge if all conditions met
5. Delete branch
6. Comment on PR

**Purpose:** Automatically merge PRs when safe to do so.

---

### 4. Autonomous Development (`autonomous.yml`)

**Triggers:**
- Schedule: Every 4 hours
- Manual workflow dispatch

**Steps:**
1. Auto-select highest priority issue with 'minibob' label
2. Create branch: `minibob/autonomous-{timestamp}`
3. Execute MiniBob
4. Create PR
5. Comment on issue

**Purpose:** Continuous autonomous development.

---

## Usage

### From Local Host

#### Basic Usage

```bash
# Execute a goal and create PR
./minibob-pr.sh "Fix the authentication bug"
```

#### Work on Specific Issue

```bash
# Fetch issue details and create PR
./minibob-pr.sh --issue 123
```

#### Create Draft PR

```bash
# Useful for work-in-progress
./minibob-pr.sh --draft "Add new experimental feature"
```

#### Use Different Base Branch

```bash
# Target 'dev' instead of 'main'
./minibob-pr.sh --base dev "Fix linting errors"
```

#### Required Environment Variables

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export METABOB_API_KEY="mb_..."
export ACTIVITY_API_ENDPOINT="https://activity.metabob.com"  # Optional
```

---

### From GitHub Actions

#### Trigger on Issue Label

1. Create an issue
2. Add label: `minibob`
3. MiniBob automatically creates PR

```bash
# Create issue via CLI
gh issue create --title "Fix bug in calculator" --label "minibob"
```

#### Trigger via Comment

1. Comment `/minibob` on any issue
2. MiniBob processes the issue

```bash
# Add comment via CLI
gh issue comment 123 --body "/minibob"
```

#### Manual Trigger

```bash
# Trigger issue-to-pr workflow manually
gh workflow run minibob-issue-to-pr.yml -f issue_number=123

# Trigger autonomous cycle manually
gh workflow run autonomous.yml
```

---

## Auto-Merge Criteria

A PR will be automatically merged when **ALL** of these conditions are met:

### ✅ Required Conditions

1. **Labels**: PR has `minibob` or `automated` label
2. **CI Checks**: All checks completed successfully
3. **Mergeable**: No merge conflicts
4. **Merge State**: Clean (no blocking requirements)
5. **Reviews**: Either approved OR no review required

### ⚠️ Manual Merge Needed

If any condition fails:
- Check fails → Fix code and push
- Merge conflicts → Resolve conflicts
- Review required but not approved → Request review

---

## Monitoring

### Check PR Status

```bash
# View PR details
gh pr view <pr-number>

# Check CI status
gh pr checks <pr-number>

# Watch for auto-merge
gh pr view <pr-number> --web
```

### View Workflow Runs

```bash
# List recent workflow runs
gh run list --limit 10

# Watch a specific run
gh run watch <run-id>

# View logs of failed run
gh run view <run-id> --log-failed
```

### Monitor Auto-Merge

```bash
# Check auto-merge workflow runs
gh run list --workflow=minibob-auto-merge.yml --limit 5

# View specific auto-merge attempt
gh run view <run-id>
```

---

## Configuration

### Repository Secrets

Required secrets in GitHub repository settings:

```
ANTHROPIC_API_KEY    - API key for Claude (MiniBob LLM)
METABOB_API_KEY      - API key for activity backend
GITHUB_TOKEN         - Auto-provided by GitHub Actions
```

### Branch Protection (Optional)

**For `main` branch:**
- Require pull request before merging: ✓
- Require approvals: 0 (auto-merge works)
- Require status checks: ✓
  - ci / quality-checks
- Require branches to be up to date: ✓

**For `dev` branch:**
- Same as main, or more lenient

---

## Troubleshooting

### PR Not Auto-Merging

**Check:**
```bash
# 1. Verify PR has correct labels
gh pr view <pr-number> --json labels

# 2. Check CI status
gh pr checks <pr-number>

# 3. Check merge status
gh pr view <pr-number> --json mergeable,mergeStateStatus,reviewDecision

# 4. View auto-merge workflow logs
gh run list --workflow=minibob-auto-merge.yml --limit 5
```

**Common Issues:**
- Missing `minibob` or `automated` label → Add label manually
- CI checks failing → Fix code and push
- Merge conflicts → Resolve conflicts
- Review required → Approve or disable requirement

---

### MiniBob Execution Failed

**Check:**
```bash
# View execution logs
gh run view <run-id> --log

# Check MiniBob environment
gh run view <run-id> --json jobs --jq '.jobs[].steps[] | select(.name == "Execute MiniBob")'
```

**Common Issues:**
- Missing API keys → Add secrets to repository
- Goal unclear → Improve issue description
- Timeout → Increase timeout in workflow

---

### Local Script Issues

**Check:**
```bash
# Verify script is executable
ls -la minibob-pr.sh

# Verify MiniBob installed
which minibob
minibob --help

# Verify GitHub CLI
which gh
gh auth status

# Check environment
echo $ANTHROPIC_API_KEY  # Should be set
echo $METABOB_API_KEY    # Should be set
```

**Common Issues:**
- Script not executable → `chmod +x minibob-pr.sh`
- MiniBob not installed → `bun add -g @metabob/minibob@latest`
- GitHub CLI not authenticated → `gh auth login`
- Missing API keys → Export environment variables

---

## Examples

### Example 1: Fix Bug from Issue

```bash
# 1. Create issue
gh issue create \
  --title "Fix division by zero in calculator" \
  --body "The calculator crashes when dividing by zero. Add proper error handling." \
  --label "bug,minibob"

# 2. Wait for MiniBob (auto-triggers on 'minibob' label)
# Or trigger manually:
gh workflow run minibob-issue-to-pr.yml -f issue_number=<issue-num>

# 3. Monitor PR
gh pr list --label "minibob"

# 4. PR auto-merges when checks pass
```

### Example 2: Add Feature from Local

```bash
# 1. Execute MiniBob locally
./minibob-pr.sh "Add user authentication with JWT tokens"

# 2. Script creates branch, executes, creates PR

# 3. Monitor CI
gh pr checks <pr-url>

# 4. PR auto-merges when checks pass
```

### Example 3: Autonomous Improvement

```bash
# 1. Add issues with 'minibob' label
gh issue create --title "Improve error messages" --label "minibob,enhancement"
gh issue create --title "Add input validation" --label "minibob,enhancement"

# 2. Every 4 hours, autonomous workflow processes one issue

# 3. Monitor autonomous cycles
gh run list --workflow=autonomous.yml --limit 10

# 4. PRs created and auto-merged
```

---

## Metrics

Track PR automation effectiveness:

```bash
# Count MiniBob PRs
gh pr list --label "minibob" --state all | wc -l

# Success rate
TOTAL=$(gh pr list --label "minibob" --state all --json number | jq '. | length')
MERGED=$(gh pr list --label "minibob" --state merged --json number | jq '. | length')
echo "Success Rate: $(($MERGED * 100 / $TOTAL))%"

# Average time to merge
gh pr list --label "minibob" --state merged --json createdAt,mergedAt --jq '.[] | (.mergedAt | fromdateiso8601) - (.createdAt | fromdateiso8601)' | awk '{sum+=$1; n++} END {print sum/n/60 " minutes"}'
```

---

## Best Practices

### For Issues

- **Clear titles**: Describe the goal concisely
- **Detailed body**: Provide context and requirements
- **Add labels**: Use 'minibob' label to trigger automation
- **One goal per issue**: Keep issues focused

### For Local Execution

- **Clean working tree**: Commit or stash changes first
- **Test locally first**: Run `bun test` before creating PR
- **Use descriptive goals**: Help MiniBob understand intent
- **Review before merge**: Check PR even if auto-merge enabled

### For Maintenance

- **Monitor metrics**: Track success rates
- **Review failures**: Learn from failed executions
- **Update activities**: Improve MiniBob templates
- **Adjust timeouts**: Based on actual execution times

---

## Advanced Usage

### Custom Workflows

Create custom workflows that trigger MiniBob:

```yaml
name: Custom MiniBob Workflow

on:
  push:
    paths:
      - 'docs/**'

jobs:
  update-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update Docs
        run: |
          minibob --single "Update documentation to reflect latest code changes"
          # ... create PR logic ...
```

### Integration with Other Tools

Combine MiniBob with other automation:

```yaml
- name: Run Security Scan
  run: bun audit

- name: Fix Vulnerabilities
  if: failure()
  run: |
    ./minibob-pr.sh "Fix security vulnerabilities reported by bun audit"
```

---

## Summary

**PR automation system provides:**

✅ **Local→PR**: Execute MiniBob locally, auto-create PR
✅ **Issue→PR**: Label issue, auto-create PR
✅ **Autonomous→PR**: Scheduled execution, auto-create PR
✅ **Auto-Merge**: Merge when checks pass
✅ **Quality Gates**: CI validates all changes
✅ **Full Traceability**: Every change tracked and traceable

**Result**: Continuous autonomous development with human oversight only when needed.

---

**Questions?** Check workflow logs with `gh run list` and `gh run view <id> --log`

**Issues?** Create an issue with the 'minibob' label and let the system fix itself! 🚀
