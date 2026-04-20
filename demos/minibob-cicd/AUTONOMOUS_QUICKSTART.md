# Autonomous CI/CD - Quick Start

Get up and running with the autonomous development system in 5 minutes.

## Prerequisites

```bash
# 1. Install MiniBob globally
npm install -g @metabob/minibob@latest

# 2. Verify installation
minibob --help

# 3. Configure API keys
cat > ~/.metabob/config.json << 'EOF'
{
  "metabob": {
    "apiKey": "your-metabob-api-key",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
EOF
```

## Step 1: Register Activities (One-Time)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos/minibob-cicd

# Register all three core activities
minibob doctor tutor activities/autonomous-loop/enforce-error-handling-activity.json
minibob doctor tutor activities/autonomous-loop/validate-enforcement-activity.json
minibob doctor tutor activities/autonomous-loop/autonomous-code-quality-loop.json
```

**Expected output:**
```
✓ Activity registered: enforce-error-handling-pattern
✓ Activity registered: validate-specification-enforcement
✓ Activity registered: autonomous-code-quality-loop
```

## Step 2: Run Your First Quality Loop

```bash
# Execute on this project
minibob --single "Execute autonomous-code-quality-loop \
  on repository . \
  with target_files ['src/**/*.ts'] \
  and patterns ['error-handling'] \
  and max_iterations 1"
```

**What happens:**
1. ✓ Learns specifications from codebase
2. ✓ Creates enforcement activities
3. ✓ Applies patterns to target files
4. ✓ Validates 100% compliance + 0 regressions
5. ✓ Reports results

**Check results:**
```bash
cat results/quality-loop/autonomous-loop-summary.json | jq .
```

## Step 3: Run a Chaos Test

```bash
# Test activity resilience
./scripts/run-chaos-test.sh invalid-input-data
```

**What happens:**
1. ✓ Injects fault (null input, corrupted file, etc.)
2. ✓ Activity fails as expected
3. ✓ Fault detected and categorized
4. ✓ Improved variant created automatically
5. ✓ Variant tested against same chaos
6. ✓ Variant deployed if successful

**View results:**
```bash
ls -la chaos/fault-reports/
ls -la activities/autonomous-loop/variants/
```

## Step 4: Set Up Automation

### Option A: Local Scheduler

```bash
# Start scheduler daemon
./scripts/run-scheduler.sh start

# Check status
./scripts/run-scheduler.sh status

# Monitor results
./scripts/monitor-results.sh --watch
```

### Option B: GitHub Actions

```bash
# Copy workflow to .github/workflows/
mkdir -p .github/workflows
cp workflows/autonomous-cicd-workflow.yml .github/workflows/

# Commit and push
git add .github/workflows/
git commit -m "feat(cicd): add autonomous workflow"
git push origin dev
```

### Option C: Git Hooks (Pre-Commit Quality Gate)

```bash
# Install git hooks
./scripts/setup-git-hooks.sh

# Now every commit will be validated
git commit -m "test: trigger quality gate"
```

## Step 5: Monitor

### View Dashboard

```bash
# Quick status
./scripts/monitor-results.sh

# Detailed metrics
./scripts/monitor-results.sh --metrics

# Compliance trends
./scripts/monitor-results.sh --compliance

# Chaos test results
./scripts/monitor-results.sh --chaos

# Watch mode (refresh every 10s)
./scripts/monitor-results.sh --watch
```

### Query Backend Directly

```bash
# Get activity performance metrics
curl https://activity.metabob.com/v2/activities/templates?category=autonomous-loop | jq .

# Get execution traces
curl https://activity.metabob.com/v2/activities/execution-traces?limit=10 | jq .
```

---

## Common Commands

### Manual Execution

```bash
# Run quality loop on specific files
minibob --single "Execute autonomous-code-quality-loop \
  on repository . \
  with target_files ['src/specific-file.ts']"

# Run enforcement only
minibob --single "Execute enforce-error-handling-pattern \
  on repository . \
  with target_files ['src/**/*.ts']"

# Run validation only
minibob --single "Execute validate-specification-enforcement \
  with enforcement_results ./results/enforcement/latest.json"
```

### Chaos Testing

```bash
# Run specific scenario
./scripts/run-chaos-test.sh invalid-input-data

# Run all scenarios
./scripts/run-chaos-test.sh all

# Run without auto-recovery
./scripts/run-chaos-test.sh timeout-conditions --no-recovery

# List available scenarios
./scripts/run-chaos-test.sh list
```

### Scheduler Management

```bash
# Start scheduler
./scripts/run-scheduler.sh start

# Stop scheduler
./scripts/run-scheduler.sh stop

# Restart scheduler
./scripts/run-scheduler.sh restart

# Run specific schedule once
./scripts/run-scheduler.sh run continuous-quality-enforcement

# View logs
tail -f logs/scheduler.log
```

---

## Verification Checklist

After setup, verify everything works:

- [ ] Activities registered in backend
  ```bash
  minibob --single "List available activities matching 'autonomous'"
  ```

- [ ] Quality loop executes successfully
  ```bash
  test -f results/quality-loop/autonomous-loop-summary.json
  ```

- [ ] Chaos test creates fault reports
  ```bash
  ls -la chaos/fault-reports/ | grep -c ".json"
  ```

- [ ] Variants created from faults
  ```bash
  ls -la activities/autonomous-loop/variants/ | grep -c ".json"
  ```

- [ ] Scheduler runs (if enabled)
  ```bash
  ./scripts/run-scheduler.sh status
  ```

- [ ] Git hooks installed (if enabled)
  ```bash
  test -x .git/hooks/pre-commit && echo "✓ Pre-commit hook installed"
  ```

---

## Troubleshooting

### Activities Not Registered

**Problem:** `minibob doctor tutor` fails

**Solution:**
```bash
# Check API key is configured
cat ~/.metabob/config.json | jq .metabob.apiKey

# Verify endpoint is accessible
curl -I https://activity.metabob.com/health

# Try registering with verbose output
minibob -vv doctor tutor activities/autonomous-loop/enforce-error-handling-activity.json
```

### Quality Loop Fails

**Problem:** Autonomous loop doesn't complete

**Solution:**
```bash
# Check the summary for error details
cat results/quality-loop/autonomous-loop-summary.json | jq '.status, .failed_phase, .error_message'

# View full output
cat results/quality-loop/*.log

# Try with single file first
minibob --single "Execute autonomous-code-quality-loop on repository . with target_files ['package.json']"
```

### Chaos Test Doesn't Create Variant

**Problem:** Fault detected but no variant created

**Solution:**
```bash
# Check fault report
cat chaos/fault-reports/latest.json | jq .

# Manually trigger variant creation
minibob --single "Create improved activity variant from fault report chaos/fault-reports/latest.json"

# Verify MiniBob can write to variants directory
test -w activities/autonomous-loop/variants/ && echo "✓ Directory is writable"
```

### Scheduler Not Running

**Problem:** `./scripts/run-scheduler.sh status` shows not running

**Solution:**
```bash
# Check for errors in log
tail -50 logs/scheduler.log

# Verify schedule file is valid JSON
jq . schedules/autonomous-development-schedule.json

# Start with foreground mode for debugging
./scripts/run-scheduler.sh start
```

---

## Next Steps

1. **Read Full Documentation**: See [AUTONOMOUS_CICD_README.md](AUTONOMOUS_CICD_README.md)

2. **Customize Schedules**: Edit `schedules/autonomous-development-schedule.json`

3. **Add Custom Chaos Scenarios**: Edit `chaos/chaos-scenarios.json`

4. **Create Custom Activities**: Build domain-specific enforcement patterns

5. **Deploy to Production**: Set up GitHub Actions for continuous autonomous development

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `minibob doctor tutor <file>` | Register activity in backend |
| `./scripts/run-scheduler.sh start` | Start automation daemon |
| `./scripts/run-chaos-test.sh <scenario>` | Run chaos test |
| `./scripts/monitor-results.sh` | View results dashboard |
| `./scripts/setup-git-hooks.sh` | Install quality gates |

**Files:**
- `activities/autonomous-loop/*.json` - Activity templates
- `schedules/*.json` - Automation schedules
- `chaos/*.json` - Chaos scenarios
- `results/` - Execution results
- `logs/` - Scheduler logs

**Support:**
- Full docs: `AUTONOMOUS_CICD_README.md`
- MiniBob help: `minibob --help`
- Backend API: `https://activity.metabob.com`

---

**You now have a fully autonomous development system!**
