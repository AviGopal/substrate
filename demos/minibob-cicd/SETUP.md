# MiniBob CI/CD Demo Setup

Complete demonstration of MiniBob's three learning loops in a CI/CD environment.

## What This Demo Shows

This demo demonstrates how MiniBob learns from every CI/CD interaction through three interconnected feedback loops:

### Loop 1: Impulse Flow (Context Management)
- **What**: How data (impulses) flows between tasks with lazy loading and budget management
- **Demo**: Watch impulses get discovered → filtered by relevance → loaded on-demand → usage tracked
- **Learning**: System learns which impulses are actually useful (high relevance) vs discovered but unused (low relevance)

### Loop 2: External Validation (Outcome Learning)
- **What**: How external validation (tests, typecheck, build) provides signals for Thompson Sampling
- **Demo**: Internal checks → external tests → error classification → Thompson parameter updates
- **Learning**: Activity templates improve their α/β parameters, better templates selected over time

### Loop 3: Discovery (Environment Scanning)
- **What**: How the system discovers available data sources and learns which discoveries are useful
- **Demo**: Goal arrives → shape inference → parallel scans → impulse consolidation → effectiveness tracking
- **Learning**: Over time, low-value scans are automatically skipped

## Prerequisites

### 1. API Keys

You need two API keys:

```bash
# Anthropic API key (for LLM reasoning)
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Metabob API key (for learning backend)
export METABOB_API_KEY="your-metabob-api-key"
```

Get your Metabob API key from:
- Dashboard: https://app.metabob.com/settings/api-keys
- Or ask your organization admin

### 2. Install Dependencies

```bash
cd demos/minibob-cicd
bun install
```

### 3. Verify Setup

```bash
# Test that activities can be loaded
bunx @metabob/minibob@latest --template activities/deterministic/run-test-suite.json --dry-run

# Test backend connection
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/health
```

Expected output: `{"status": "healthy"}`

## Quick Start

### Run All Scenarios

```bash
# Scenario 1: Cold start (no history)
./scripts/run-scenario-1-cold-start.sh

# View learning metrics
./scripts/show-learning-metrics.sh

# Scenario 2: Warm start (with history)
./scripts/run-scenario-2-warm-start.sh

# View improvements
./scripts/show-learning-metrics.sh
```

### Manual Scenario Walkthrough

If you want to see each step in detail:

#### Step 1: Cold Start Baseline

```bash
# Introduce a bug
sed -i 's/a + b/a - b/' src/calculator.ts

# Capture test failure
bun test 2>&1 | tee /tmp/error.log

# Run discovery (Loop 3)
bunx @metabob/minibob@latest \
  --template activities/discovery/scan-file-system.json \
  --trace

bunx @metabob/minibob@latest \
  --template activities/discovery/scan-execution-traces.json \
  --var goalCategory=bugfix \
  --trace

# Run fix with all three loops
ERROR_LOG="$(cat /tmp/error.log)"
bunx @metabob/minibob@latest \
  --template activities/learning/fix-test-failure-with-discovery.json \
  --var "errorLog=$ERROR_LOG" \
  --trace

# Verify fix
bun test
```

**What you'll see:**
- Loop 3: scan-file-system finds 8 files, scan-execution-traces finds 0 (no history)
- Loop 1: All discovered impulses loaded (no relevance data yet)
- Loop 2: Tests pass, Thompson Sampling: α=2, β=1

#### Step 2: Warm Start (Similar Bug)

```bash
# Introduce similar bug again
sed -i 's/a + b/a - b/' src/calculator.ts

# Run fix again
ERROR_LOG="$(bun test 2>&1)"
bunx @metabob/minibob@latest \
  --template activities/learning/fix-test-failure-with-discovery.json \
  --var "errorLog=$ERROR_LOG" \
  --trace

bun test
```

**What you'll see:**
- Loop 3: scan-execution-traces now finds 1 trace (previous fix!)
- Loop 1: Only high-relevance impulses loaded (learned from first execution)
- Loop 2: Faster fix, Thompson Sampling: α=3, β=1 (higher confidence)

**Improvements:**
- ⚡ 35% faster execution (fewer impulses loaded)
- 💰 40% cheaper (less LLM context)
- ✅ Higher confidence (improved α/β ratio)

## Understanding the Learning Loops

### How Loop 1 Works (Impulse Flow)

**Flow**: Discover → Filter → Load → Use → Track

1. **Discovery** (Loop 3 output): 15 impulses discovered
2. **Filtering**: Based on learned relevance scores
   - error_log: 0.95 relevance → load first
   - execution_trace: 0.85 relevance → load second
   - test_file: 0.45 relevance → skip
3. **Lazy Loading**: Load on-demand with budget enforcement
   - error_log: 3,000 token budget
   - execution_trace: 2,000 token budget
   - Total budget: 10,000 tokens (enforced)
4. **Usage Tracking**: Which impulses were referenced in prompts? Which were used in tool calls?
5. **Relevance Update**: P(success | loaded) → adjusts relevance scores

**Learning**: After 10 executions, test_file drops from 0.45 → 0.25 relevance (often loaded, rarely used).

### How Loop 2 Works (External Validation)

**Flow**: Internal → External → Classify → Update

1. **Internal Validation**: Syntax checks, pattern matching, forbidden content
2. **External Validation**: Run actual tests (`bun test`)
3. **Error Classification**: If failed, classify into 22 error types
   - test_assertion_mismatch
   - test_missing_mock
   - test_timeout
   - etc.
4. **Thompson Sampling Update**:
   - Success: α += 1
   - Failure: β += weight (based on error type)
   - Retriable errors: weight = 1.5
   - Non-retriable errors: weight = 3.0

**Learning**: Activities with high α/β ratio get selected more often.

### How Loop 3 Works (Discovery)

**Flow**: Infer → Scan → Consolidate → Track

1. **Shape Inference**: Extract expected shapes from goal
   - "Fix test failures" → [error_log, test_file, source_code, execution_trace]
2. **Parallel Scanning**: Run discovery activities in parallel
   - scan-file-system → finds source_code, test_file
   - scan-git-history → finds git_commit
   - scan-execution-traces → finds execution_trace (if exists)
3. **Consolidation**: Merge all discovered impulses into batch
4. **Effectiveness Tracking**: Which scans produced impulses that were actually used?

**Learning**: After 10 executions:
- scan-file-system: α=10, β=0 (always useful)
- scan-execution-traces: α=7, β=3 (useful when history exists)
- scan-git-history: α=2, β=8 (rarely useful, auto-skipped)

## Observability

### Backend Dashboard

View all activity executions:
- Dashboard: https://internal.metabob.com
- Login with your Metabob account

**What you can see:**
- Thompson Sampling parameters (α, β) for each activity
- Impulse relevance scores over time
- Discovery activity effectiveness
- Success rate trends
- Cost and duration trends

### Command Line Metrics

```bash
# Show comprehensive learning metrics
./scripts/show-learning-metrics.sh

# Query specific activity
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates/fix-test-failure-with-discovery | jq

# Query impulse relevance
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/impulse-suggestions?goal_shape=bugfix&activity_id=fix-test-failure-with-discovery" | jq

# Query discovery effectiveness
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/discovery-metrics?activity_id=scan-file-system" | jq
```

## Expected Results

After running 10 executions of the fix-test-failure activity:

### Thompson Sampling Parameters
```
fix-test-failure-with-discovery:
  α = 8, β = 2 (80% success rate)

scan-file-system:
  α = 10, β = 0 (100% useful)

scan-git-history:
  α = 2, β = 8 (20% useful, auto-skipped)

scan-execution-traces:
  α = 7, β = 3 (70% useful)
```

### Impulse Relevance Scores
```
error_log:         0.95 (always needed)
execution_trace:   0.85 (very useful when available)
source_code:       0.75 (often useful)
test_file:         0.45 (sometimes useful)
git_commit:        0.25 (rarely useful)
```

### Performance Improvements
```
Execution 1:  60s, $0.12, 15 impulses loaded
Execution 5:  45s, $0.08, 8 impulses loaded
Execution 10: 35s, $0.05, 5 impulses loaded

Improvement: 42% faster, 58% cheaper
```

## CI/CD Integration

### GitHub Actions Workflows

Three workflows are provided:

**1. `ci.yml` - Direct Commit**
- Triggers: Push to `main`, `dev`, `feature/**`
- Behavior: Auto-remediate and commit directly
- Use for: Hotfixes, automated fixes

**2. `ci-with-pr.yml` - PR Creation**
- Triggers: Push to `feature/**`, `dev`
- Behavior: Create PR with fixes for review
- Use for: Team review, non-urgent fixes

**3. `ci-gated.yml` - Manual Approval**
- Triggers: Manual workflow dispatch
- Behavior: Run checks, wait for approval, then fix
- Use for: Production deployments

### Trigger Demo Workflows

```bash
# Push to trigger CI
git add .
git commit -m "test: introduce bug for CI demo"
git push origin feature/demo-three-loops

# Watch workflow
gh run list --limit 5
gh run view <run-id> --log
```

## Troubleshooting

### Tests Don't Fail After Bug Introduction

**Problem**: `sed` command didn't modify file

**Solution**:
```bash
# Verify file was modified
git diff src/calculator.ts

# If not, manually edit the file
# Change: a + b
# To: a - b
```

### MiniBob Can't Connect to Backend

**Problem**: `Error: Failed to connect to activity.metabob.com`

**Solutions**:
1. Check API key: `echo $METABOB_API_KEY`
2. Test connection: `curl -H "Authorization: ApiKey $METABOB_API_KEY" https://activity.metabob.com/health`
3. Check endpoint: `echo $ACTIVITY_API_ENDPOINT` (should be https://activity.metabob.com)

### Discovery Activities Return Empty

**Problem**: No files discovered by scan-file-system

**Solution**:
```bash
# Verify files exist
ls -la src/
ls -la tests/

# Check activity output
bunx @metabob/minibob@latest \
  --template activities/discovery/scan-file-system.json \
  --debug
```

### Learning Metrics Show No Improvement

**Problem**: After 10 runs, still no improvement

**Possible causes**:
1. **Traces not recorded**: Add `--trace` flag to all MiniBob commands
2. **Feedback not sent**: Check that learning activities have `tracing.recordTrace: true`
3. **Backend not updating**: Verify backend logs show Thompson Sampling updates

**Debug**:
```bash
# Check if traces are being stored
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/execution-traces?limit=10 | jq

# Should show recent executions with timestamps
```

## Advanced Usage

### Create Custom Bug Scenarios

```bash
# Type error scenario
echo 'export function add(a: string, b: string) { return a + b; }' > src/calculator.ts

# Lint error scenario
echo 'var x = 1' >> src/calculator.ts  # Use var instead of const

# Complex multi-file scenario
./scripts/introduce-complex-bug.sh
```

### Monitor Learning in Real-Time

```bash
# Terminal 1: Run scenarios in loop
while true; do
  ./scripts/run-scenario-1-cold-start.sh
  sleep 60
done

# Terminal 2: Watch metrics update
watch -n 10 './scripts/show-learning-metrics.sh'
```

### Export Learning Data

```bash
# Export Thompson Sampling data
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates | \
  jq '[.templates[] | {id, alpha: .thompson_alpha, beta: .thompson_beta}]' \
  > thompson-data.json

# Export impulse relevance data
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  "https://activity.metabob.com/v2/activities/impulse-relevance?limit=1000" | \
  jq '.relevance_data' \
  > relevance-data.json

# Visualize with your favorite tool
python3 scripts/plot-learning-curves.py thompson-data.json
```

## Next Steps

1. **Run all scenarios**: Execute all 5 scenarios to see complete learning loop
2. **Integrate with your CI**: Copy workflows to your repository
3. **Create custom activities**: Add activities specific to your codebase
4. **Monitor learning**: Set up dashboards to track improvement over time
5. **Tune parameters**: Adjust budgets, relevance thresholds, Thompson Sampling weights

## Questions?

- Documentation: https://docs.metabob.com/minibob
- Issues: https://github.com/MetabobProject/minibob/issues
- Community: https://discord.gg/metabob
