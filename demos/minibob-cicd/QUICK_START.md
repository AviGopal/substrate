# Quick Start: Autonomous CI/CD Deployment

## TL;DR

```bash
cd demos/minibob-cicd
./DEPLOY.sh
```

Follow the prompts and you're done!

## What You'll Get

- Fully autonomous MiniBob running on GitHub Actions
- Executes every 6 hours automatically
- Processes issues labeled "minibob"
- Collects execution traces
- Updates learning metrics
- Creates PRs for changes
- Self-improves through Thompson Sampling

## Prerequisites

1. **GitHub CLI installed**:
   ```bash
   # macOS
   brew install gh

   # Linux
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
   sudo apt update
   sudo apt install gh
   ```

2. **Authenticated with GitHub**:
   ```bash
   gh auth login
   ```

3. **API keys ready**:
   - Anthropic API key (for Claude)
   - Metabob API key (for backend)

## Deployment Steps

### 1. Run Deployment Script

```bash
cd demos/minibob-cicd
./DEPLOY.sh
```

The script will:
- Check prerequisites
- Create repository (if needed)
- Configure secrets
- Initialize git
- Push code
- Enable GitHub Pages
- Trigger first workflow

### 2. Monitor First Run

```bash
# Watch workflow execution
gh run watch --repo MetabobProject/demo-minibob-cicd

# Or check status
gh run list --repo MetabobProject/demo-minibob-cicd --limit 5
```

### 3. Verify Deployment

```bash
# Check traces collected
curl https://metabobproject.github.io/demo-minibob-cicd/recent-executions.json

# Check metrics
curl https://metabobproject.github.io/demo-minibob-cicd/metrics.json

# View GitHub Pages
open https://metabobproject.github.io/demo-minibob-cicd/
```

## Usage

### Create Issues for MiniBob

```bash
gh issue create --repo MetabobProject/demo-minibob-cicd \
  --title "Fix test failures" \
  --body "Run tests and fix any failures found" \
  --label "minibob"
```

MiniBob will:
1. Execute the issue body as a goal
2. Comment on the issue with results
3. Create a PR if changes were made
4. Include trace ID for debugging

### Manual Workflow Trigger

```bash
gh workflow run minibob-autonomous-development.yml \
  --repo MetabobProject/demo-minibob-cicd \
  -f goal="Create comprehensive documentation for all activities"
```

### View Traces

```bash
# List all traces
curl https://metabobproject.github.io/demo-minibob-cicd/traces/index.json

# View specific trace
curl https://metabobproject.github.io/demo-minibob-cicd/traces/{trace-id}.json | jq '.'
```

### Check Thompson Sampling

```bash
# View activity performance
curl https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '.templates[] | {id, alpha, beta, success_rate: (.alpha / (.alpha + .beta))}'
```

## Autonomous Loop

### How It Works

**Every 6 hours**, MiniBob:
1. Checks backend for pending tasks
2. Executes up to 3 autonomous tasks
3. Collects traces from all executions
4. Updates metrics on GitHub Pages
5. Commits any changes made
6. Creates PR if changes were made

**On issue creation** with "minibob" label:
1. Workflow triggers immediately
2. MiniBob executes issue body as goal
3. Results posted as issue comment
4. PR created if successful

**On push** to main/dev:
1. Workflow triggers
2. MiniBob performs maintenance tasks
3. Updates documentation
4. Cleans up workspace

### Boredom Mode

When there are no labeled issues, MiniBob enters "boredom mode":
- Scans codebase for improvements
- Checks for outdated documentation
- Looks for test failures
- Identifies code smells
- Self-generates improvement tasks

## Monitoring

### Workflow Execution

```bash
# List recent runs
gh run list --repo MetabobProject/demo-minibob-cicd

# View specific run
gh run view <run-id> --repo MetabobProject/demo-minibob-cicd --log

# Watch live
gh run watch --repo MetabobProject/demo-minibob-cicd
```

### Backend Metrics

```bash
# Recent executions
curl https://activity.metabob.com/v2/activities/execution-traces?limit=10 \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '.executions[] | {id, status, duration_ms, cost_usd}'

# Activity metrics
curl https://activity.metabob.com/v2/activities/metrics \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '.metrics | {total_executions, success_rate, avg_duration_ms, avg_cost_usd}'
```

### GitHub Pages

Visit: `https://metabobproject.github.io/demo-minibob-cicd/`

**Available data**:
- Latest metrics
- Recent executions
- Individual traces
- Learning progress

## Troubleshooting

### Workflow Fails with "minibob: command not found"

Check Bun installation in workflow logs:
```bash
gh run view <run-id> --repo MetabobProject/demo-minibob-cicd --log | grep -A5 "Setup Bun"
```

### Traces Not Appearing

```bash
# Check if traces were collected
gh run view <run-id> --repo MetabobProject/demo-minibob-cicd --log | grep "Trace saved"

# Verify GitHub Pages deployment
gh api repos/MetabobProject/demo-minibob-cicd/pages
```

### Secrets Not Working

```bash
# List secrets
gh secret list --repo MetabobProject/demo-minibob-cicd

# Update secrets
gh secret set ANTHROPIC_API_KEY --repo MetabobProject/demo-minibob-cicd
gh secret set METABOB_API_KEY --repo MetabobProject/demo-minibob-cicd
```

### GitHub Pages Not Updating

```bash
# Check Pages deployment status
gh api repos/MetabobProject/demo-minibob-cicd/pages/builds/latest

# Manually trigger deployment
gh workflow run deploy-pages.yml --repo MetabobProject/demo-minibob-cicd
```

## What's Next?

### After 24 Hours

Check:
- [ ] At least 3-4 autonomous executions completed
- [ ] Traces visible on GitHub Pages
- [ ] Thompson Sampling parameters updating
- [ ] Success rate trending upward

### After 1 Week

Check:
- [ ] 20+ executions recorded
- [ ] Success rate >60%
- [ ] Average cost decreasing
- [ ] Boredom mode working

### After 1 Month

Check:
- [ ] 100+ executions
- [ ] Success rate >70%
- [ ] Cost reduced by 30%+
- [ ] Self-improvement demonstrable

## Advanced

### Custom Activities

Create new activities in `activities/`:
```bash
minibob --single "Create activity for checking code coverage"
```

### Manual Trace Collection

```bash
# Extract trace ID from logs
TRACE_ID=$(gh run view <run-id> --log | grep -oP "Trace saved to backend: \K[a-z0-9_]+")

# Fetch trace
curl https://activity.metabob.com/v2/activities/execution-traces/$TRACE_ID \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq '.' > trace.json
```

### Thompson Sampling Monitoring

```bash
# Watch parameter convergence
watch -n 60 'curl -s https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" | \
  jq ".templates[] | {id, alpha, beta, rate: (.alpha / (.alpha + .beta))}"'
```

## Support

- **Documentation**: See `CICD_SETUP.md` for complete guide
- **Roadmap**: See `.metabob/autonomous-demo-roadmap.md` for future plans
- **Issues**: Create issue in repository with details

## Success!

Your autonomous development system is now running. MiniBob will:
- ✅ Work 24/7 without supervision
- ✅ Learn from every execution
- ✅ Improve over time
- ✅ Maintain its own codebase
- ✅ Create issues and PRs
- ✅ Optimize for cost and speed

**Watch AI develop itself in real-time!**
