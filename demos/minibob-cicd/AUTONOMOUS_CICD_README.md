# Autonomous CI/CD with MiniBob

Complete demonstration of self-improving, self-healing CI/CD using MiniBob's activity-driven development system.

## What This Is

A **fully autonomous development pipeline** that:

1. **Learns specifications** from codebases automatically
2. **Enforces quality** continuously via scheduled activities
3. **Detects faults** through chaos engineering
4. **Creates improved variants** when activities fail
5. **Self-heals** by testing and deploying better versions
6. **Commits improvements** autonomously with 100% compliance gates

**Key Innovation**: Activities create activities (ribosome pattern), enabling true self-improvement.

---

## Quick Start

### 1. Register Activities (One-Time Setup)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos/minibob-cicd

# Register the three core activities
minibob doctor tutor activities/autonomous-loop/enforce-error-handling-activity.json
minibob doctor tutor activities/autonomous-loop/validate-enforcement-activity.json
minibob doctor tutor activities/autonomous-loop/autonomous-code-quality-loop.json
```

**What this does:**
- Uploads activities to `https://activity.metabob.com`
- Makes them available to all MiniBob instances
- Enables Thompson Sampling tracking
- Allows composition and reuse

### 2. Run Manual Quality Loop

```bash
# Execute the complete autonomous loop on this codebase
minibob --single "Execute autonomous-code-quality-loop \
  on repository /home/avi/documents/work/exp-repo/metabob-devbob/demos/minibob-cicd \
  with target_files ['src/**/*.ts', 'tests/**/*.ts'] \
  and patterns ['error-handling', 'parameter-validation', 'test-coverage'] \
  and max_iterations 3 \
  and output_path ./results/quality-loop"
```

**Expected output:**
```
Phase 1: Learn specifications       → 3+ patterns identified
Phase 2: Create enforcement activities → Activities generated
Phase 3: Enforce on target files    → 100% compliance
Phase 4: Validate no regressions    → 0 regressions
Phase 5: Decide next action         → COMPLETE or IMPROVE
Phase 6: Create improved variants   → (if needed)
Phase 7: Finalize and report        → Summary generated
```

### 3. Run Chaos Test

```bash
# Test activity resilience with chaos engineering
./scripts/run-chaos-test.sh invalid-input-data
```

**What happens:**
1. Injects fault scenario (null inputs, corrupted files, etc.)
2. Captures fault report if activity fails
3. Creates improved variant automatically
4. Tests variant against same scenario
5. Deploys variant if successful

### 4. Set Up GitHub Actions (Automated)

```bash
# Copy workflow to .github/workflows/
mkdir -p .github/workflows
cp workflows/autonomous-cicd-workflow.yml .github/workflows/

# Push to trigger
git add .github/workflows/autonomous-cicd-workflow.yml
git commit -m "feat(cicd): add autonomous CI/CD workflow"
git push origin dev
```

**Workflow runs:**
- **Every 4 hours**: Quality enforcement loop
- **Weekly (Mondays)**: Chaos testing + recovery
- **Weekly (Sundays)**: Thompson Sampling updates
- **On push/PR**: Quality gates + auto-commits

---

## Architecture

### The Three Activities

#### 1. enforce-error-handling-activity.json

**Purpose:** Apply error handling patterns to code

**Tasks:**
1. Identify functions needing validation
2. Add parameter type checks
3. Verify validations added

**Input:** Target files, specification
**Output:** Modified files with validations

#### 2. validate-enforcement-activity.json

**Purpose:** Verify specification preservation and detect regressions

**Tasks:**
1. Load enforcement results
2. Verify specification preservation (100% required)
3. Check for regressions (0 required)
4. Generate compliance report

**Input:** Enforcement results
**Output:** Compliance report, regression report

#### 3. autonomous-code-quality-loop.json

**Purpose:** Meta-activity orchestrating the complete loop

**7 Phases:**
1. **Learn**: Extract specifications from codebase
2. **Create**: Generate enforcement activities (ribosome)
3. **Enforce**: Apply patterns to target files
4. **Validate**: Check compliance and regressions
5. **Decide**: COMPLETE (100% compliance) or IMPROVE
6. **Improve**: Create better variants (if needed, loop to phase 3)
7. **Complete**: Generate final summary

**Composition Type:** Sequential with conditional loop
**Max Iterations:** 3 (configurable)

### Activity Composition Flow

```
┌─────────────────────────────────────────────────────┐
│ autonomous-code-quality-loop (Meta-Activity)        │
│                                                     │
│  Phase 1: Learn Specifications                     │
│           ↓                                         │
│  Phase 2: Create Activities (Ribosome)             │
│           ↓ (generates)                             │
│           ├─ enforce-error-handling-activity        │
│           └─ validate-enforcement-activity          │
│           ↓                                         │
│  Phase 3: Execute → enforce-error-handling          │
│           ↓                                         │
│  Phase 4: Execute → validate-enforcement            │
│           ↓                                         │
│  Phase 5: Decision Logic                           │
│           ├─ 100% compliance? → Phase 7            │
│           └─ < 100%? → Phase 6                     │
│                ↓                                    │
│  Phase 6: Improve Variants → Loop to Phase 3       │
│           ↓                                         │
│  Phase 7: Complete & Report                        │
└─────────────────────────────────────────────────────┘
```

### Chaos Engineering System

**6 Scenario Categories:**

1. **Invalid Input Data**
   - Null/undefined parameters
   - Empty arrays
   - Corrupted JSON

2. **Missing Dependencies**
   - Deleted files
   - Missing tools
   - Broken imports

3. **Timeout Conditions**
   - Large file processing
   - Infinite loops
   - Slow operations

4. **Resource Exhaustion**
   - Memory limits
   - Disk space
   - Impulse budgets

5. **Concurrent Conflicts**
   - File lock conflicts
   - Race conditions
   - Concurrent modifications

6. **Malicious Input**
   - Path traversal
   - Command injection
   - XSS attempts

**Recovery Workflow:**

```
Inject Chaos → Activity Fails → Detect Fault → Create Variant
                                                      ↓
                                              Test Variant
                                                      ↓
                                            Pass? Deploy : Retry
```

### Scheduling System

Defined in `schedules/autonomous-development-schedule.json`:

| Schedule | Activity | Frequency | Purpose |
|----------|----------|-----------|---------|
| `0 */4 * * *` | autonomous-code-quality-loop | Every 4 hours | Continuous quality enforcement |
| `0 2 * * *` | learn-specifications | Nightly at 2 AM | Discover new patterns |
| `0 * * * *` | enforce-error-handling | Hourly | Quick enforcement on changed files |
| `git-pre-commit` | validate-enforcement | On commit | Blocking quality gate |
| `0 12 * * 1` | chaos-break-and-recover | Mondays at noon | Chaos testing + recovery |
| `0 0 * * 0` | thompson-sampling-update | Sundays midnight | Update activity scores |

---

## File Structure

```
demos/minibob-cicd/
├── activities/
│   └── autonomous-loop/
│       ├── autonomous-code-quality-loop.json       # Meta-activity (7 phases)
│       ├── enforce-error-handling-activity.json    # Enforcement activity
│       └── validate-enforcement-activity.json      # Validation activity
├── chaos/
│   ├── chaos-scenarios.json                        # Chaos test definitions
│   ├── results/                                    # Chaos test outputs
│   └── fault-reports/                              # Detected faults
├── schedules/
│   └── autonomous-development-schedule.json        # Cron-like scheduling
├── workflows/
│   └── autonomous-cicd-workflow.yml                # GitHub Actions
├── scripts/
│   ├── run-scheduler.sh                            # Local scheduler daemon
│   ├── run-chaos-test.sh                           # Chaos testing script
│   └── monitor-results.sh                          # Results monitoring
├── results/
│   ├── quality-loop/                               # Quality loop outputs
│   ├── enforcement/                                # Enforcement results
│   └── performance/                                # Performance reports
└── AUTONOMOUS_CICD_README.md                       # This file
```

---

## Scripts

### run-scheduler.sh

Local daemon that executes activities on schedule.

```bash
# Start scheduler (runs in background)
./scripts/run-scheduler.sh start

# Stop scheduler
./scripts/run-scheduler.sh stop

# Check status
./scripts/run-scheduler.sh status

# Run one-off scheduled task
./scripts/run-scheduler.sh run continuous-quality-enforcement
```

**Features:**
- Cron-like scheduling from JSON config
- Respects conditional execution (only_if_changes, skip_if_pr_open)
- Handles on_success and on_failure actions
- Logs all executions to `logs/scheduler.log`

### run-chaos-test.sh

Execute chaos scenarios and trigger recovery.

```bash
# Run specific scenario
./scripts/run-chaos-test.sh invalid-input-data

# Run all scenarios
./scripts/run-chaos-test.sh all

# Run with auto-recovery disabled
./scripts/run-chaos-test.sh timeout-conditions --no-recovery
```

**Output:**
- Fault reports in `chaos/fault-reports/`
- Test results in `chaos/results/`
- Improved variants in `activities/autonomous-loop/variants/`

### monitor-results.sh

Monitor and report on autonomous execution.

```bash
# Show recent activity results
./scripts/monitor-results.sh

# Show performance metrics
./scripts/monitor-results.sh --metrics

# Show compliance trends
./scripts/monitor-results.sh --compliance
```

---

## Usage Examples

### Example 1: Run Quality Loop on Specific Files

```bash
minibob --single "Execute autonomous-code-quality-loop \
  on repository . \
  with target_files ['src/bugfix/*.ts'] \
  and patterns ['error-handling'] \
  and max_iterations 1"
```

### Example 2: Test Chaos Scenario Manually

```bash
# Run path-traversal attack scenario
./scripts/run-chaos-test.sh malicious-input

# Check if variant was created
ls -la activities/autonomous-loop/variants/

# If variant exists, test it
minibob --single "Test variant activities/autonomous-loop/variants/enforce-error-handling-v2.json \
  against chaos scenario malicious-input"
```

### Example 3: Pre-Commit Hook Integration

```bash
# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
minibob --single "Execute validate-specification-enforcement \
  on files $(git diff --cached --name-only | tr '\n' ',') \
  with require_100_percent_compliance true"

if [ $? -ne 0 ]; then
  echo "❌ Quality gate failed. Fix issues before committing."
  exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

### Example 4: CI/CD Integration

The GitHub Actions workflow automatically:

1. **On every push to main/dev:**
   - Runs quality enforcement loop
   - Checks for 100% compliance
   - Commits improvements if achieved

2. **Every 4 hours (scheduled):**
   - Full quality loop on all files
   - Auto-creates PR if improvements made

3. **Weekly (Monday):**
   - Runs all chaos scenarios
   - Creates recovery variants
   - Tests and deploys improvements

4. **Weekly (Sunday):**
   - Updates Thompson Sampling scores
   - Generates performance reports
   - Creates variants for low performers

---

## Metrics and Success Criteria

### Quality Loop Metrics

**Target:** 100% compliance, 0 regressions

Check results:
```bash
cat results/quality-loop/autonomous-loop-summary.json | jq '{
  compliance: .final_compliance,
  regressions: .regressions,
  iterations: .iterations_needed,
  ready: .ready_for_production
}'
```

### Chaos Testing Metrics

**Goals:**
- Fault detection rate: 100%
- Variant success rate: ≥ 80%
- Average recovery time: ≤ 30 minutes
- Regression rate: 0%

Check results:
```bash
./scripts/monitor-results.sh --chaos
```

### Thompson Sampling Metrics

Track activity performance over time:
```bash
curl http://activity.metabob.com/v2/activities/templates?category=autonomous-loop | jq '.templates[] | {
  id: .id,
  success_rate: .metrics.success_rate,
  avg_cost: .metrics.avg_cost_usd,
  executions: .metrics.total_executions
}'
```

---

## Troubleshooting

### Scenario: Quality Loop Fails

**Check:**
```bash
cat results/quality-loop/autonomous-loop-summary.json | jq .status
```

**If status is "FAILED":**
1. Check which phase failed: `jq .failed_phase`
2. View error details: `jq .error_message`
3. Inspect trace: `jq .trace_id` then fetch from backend

### Scenario: Chaos Test Doesn't Create Variant

**Possible causes:**
1. Activity didn't actually fail (check exit code)
2. Fault detection activity not registered
3. Insufficient permissions to write variants

**Debug:**
```bash
# Check fault reports
ls -la chaos/fault-reports/
cat chaos/fault-reports/latest.json | jq .

# Try manual variant creation
minibob --single "Create improved activity variant \
  from fault report chaos/fault-reports/latest.json \
  for activity enforce-error-handling-pattern"
```

### Scenario: GitHub Actions Not Running

**Check:**
1. Workflow file in `.github/workflows/` (not just `workflows/`)
2. Branch protection rules allow auto-commits
3. `METABOB_CONFIG` secret is set in GitHub repo settings
4. MiniBob API key has write permissions

---

## Advanced Configuration

### Custom Chaos Scenarios

Add to `chaos/chaos-scenarios.json`:

```json
{
  "scenarios": [
    {
      "id": "custom-scenario-name",
      "category": "your-category",
      "test_cases": [
        {
          "case": "specific-test-case",
          "activity": "target-activity-id",
          "inject": {
            "parameter_name": "fault_value"
          },
          "expected_behavior": "How activity should handle this",
          "recovery_strategy": "How to fix this fault"
        }
      ]
    }
  ]
}
```

### Custom Schedules

Edit `schedules/autonomous-development-schedule.json`:

```json
{
  "schedules": [
    {
      "id": "custom-schedule",
      "activity": "your-activity-id",
      "schedule": "0 */2 * * *",  // Every 2 hours (cron syntax)
      "enabled": true,
      "parameters": {
        "custom_param": "value"
      }
    }
  ]
}
```

### Environment Variables

```bash
# Activity API endpoint
export ACTIVITY_API_ENDPOINT="https://activity.metabob.com"

# MiniBob configuration
export METABOB_API_KEY="your-api-key"
export ANTHROPIC_API_KEY="sk-ant-..."

# Scheduler settings
export SCHEDULER_LOG_LEVEL="debug"
export SCHEDULER_MAX_CONCURRENT=3
```

---

## What Makes This Special

### 1. Activities Create Activities (Ribosome Pattern)

Traditional CI/CD: Humans write scripts → Scripts execute

Autonomous CI/CD: Activities extract patterns → Activities create activities → Activities execute

**Evidence:**
- Phase 2 of autonomous-code-quality-loop generates enforcement activities
- MiniBob trace `act_1776541957909_e26vbj` shows this happening
- Created activities are immediately executable

### 2. Self-Healing Through Chaos

Traditional: Tests fail → Human investigates → Human fixes

Autonomous: Chaos injected → Fault detected → Variant created → Variant tested → Variant deployed

**No human intervention required.**

### 3. Continuous Learning

Every execution feeds Thompson Sampling:
- Successful activities get higher selection probability
- Failed activities get lower selection probability
- New variants start with neutral probability
- System converges on best-performing templates

### 4. Specification Preservation Guarantee

Unlike typical refactoring tools, this system:
- Extracts specifications from existing code
- Validates 100% preservation after modifications
- Detects regressions through before/after comparison
- Blocks changes that don't preserve specifications

---

## Next Steps

### Immediate (5 minutes)

1. **Register activities:**
   ```bash
   cd /home/avi/documents/work/exp-repo/metabob-devbob/demos/minibob-cicd
   minibob doctor tutor activities/autonomous-loop/*.json
   ```

2. **Run first quality loop:**
   ```bash
   minibob --single "Execute autonomous-code-quality-loop on repository . with target_files ['src/**/*.ts']"
   ```

### Short-term (1 hour)

3. **Set up GitHub Actions:**
   ```bash
   cp workflows/autonomous-cicd-workflow.yml .github/workflows/
   git add .github/workflows/ && git commit -m "feat: autonomous CI/CD"
   git push origin dev
   ```

4. **Run chaos test:**
   ```bash
   ./scripts/run-chaos-test.sh invalid-input-data
   ```

### Medium-term (1 day)

5. **Enable pre-commit hooks:**
   ```bash
   ./scripts/setup-git-hooks.sh
   ```

6. **Monitor autonomous execution:**
   ```bash
   ./scripts/monitor-results.sh --watch
   ```

### Long-term (1 week)

7. **Extend to other repositories:**
   - Apply to production codebases
   - Create domain-specific enforcement activities
   - Build custom chaos scenarios

8. **Deploy continuous improvement:**
   - Run MiniBob in daemon mode
   - Configure boredom queue with improvement tasks
   - Monitor learning metrics in dashboard

---

## Summary

This demonstrates a **fully autonomous development system** where:

✅ **Learning** happens automatically from codebases
✅ **Enforcement** runs on schedule without human intervention
✅ **Validation** ensures 100% specification preservation
✅ **Fault detection** identifies activity weaknesses
✅ **Self-healing** creates and deploys improved variants
✅ **Continuous improvement** through Thompson Sampling

**The system develops itself.**

---

## References

- **Activity Templates:** `activities/autonomous-loop/*.json`
- **Chaos Scenarios:** `chaos/chaos-scenarios.json`
- **Schedules:** `schedules/autonomous-development-schedule.json`
- **GitHub Actions:** `workflows/autonomous-cicd-workflow.yml`
- **Demonstration Report:** `/tmp/COMPOSITION_READY.md`
- **Backend API:** `https://activity.metabob.com`

**Questions?** Check the main MiniBob documentation or run `minibob --help`.
