# MiniBob Learning Loops Demonstration

**Purpose**: Demonstrate the three feedback loops that enable MiniBob to learn and improve from CI/CD interactions.

## The Three Learning Loops

### Loop 1: Impulse Flow (Context Management)
**What**: How impulses (data with metadata) flow between tasks with lazy loading and budget management.

**Demonstration**:
- Task 1: Scan environment → produces file impulses (metadata only, not loaded)
- Task 2: Analyze error → loads relevant file impulses (budget-constrained)
- Task 3: Apply fix → receives previous task output as impulse
- Task 4: Validate → uses chained impulses from all previous tasks

**Learning**: System learns which impulses are actually useful (loaded but unused → low relevance score).

### Loop 2: External Validation (Outcome Learning)
**What**: How external validation (tests, typecheck, build) provides signals for Thompson Sampling.

**Demonstration**:
- Internal validation: Pattern checks, required files, forbidden patterns
- External validation: `bun test`, `tsc --noEmit`, `eslint`
- Error classification: test_failure, type_error, lint_error (22 types)
- Thompson Sampling update: Success → α+1, Failure → β+(weight based on error type)

**Learning**: Activity templates improve their α/β parameters, better templates selected over time.

### Loop 3: Discovery (Environment Scanning)
**What**: How the system discovers available data sources and learns which discoveries are useful.

**Demonstration**:
- Goal arrives: "Fix test failures"
- Shape inference: Extracts expected shapes [error_log, source_code, test_file]
- Parallel scanning:
  - scan-file-system → discovers test files and source files
  - scan-git-history → discovers recent changes
  - scan-execution-traces → discovers similar past failures
- Thompson Sampling: Learns which scans are valuable for which goal types

**Learning**: Over time, low-value scans are automatically skipped.

## Demo Scenarios

### Scenario 1: First Bug Fix (Cold Start)

**Setup**: Introduce a bug in calculator.ts

**Execution**:
```bash
# Introduce bug
bun run dev:introduce-bug

# CI runs, fails, MiniBob remediates
git push origin main
```

**What You'll See**:
1. **Loop 3 (Discovery)**:
   - Goal: "Fix test failures"
   - Shape inference: [error_log, test_result, source_code, test_file]
   - Parallel scans discover 8 impulses (metadata only)
   - Missing: execution_trace (first time, no history)

2. **Loop 1 (Impulse Flow)**:
   - Task 1 loads error_log impulse (2,000 tokens)
   - Task 2 loads source_code impulse (4,000 tokens budget)
   - Task 3 receives Task 2 output as impulse (chained)
   - Usage tracking: error_log referenced ✓, source_code used ✓

3. **Loop 2 (External Validation)**:
   - Internal: Pattern checks pass ✓
   - External: `bun test` → exit code 0 ✓
   - Thompson update: fix-test-failure α=2 (was 1)
   - Impulse relevance: error_log +0.1, source_code +0.1

**Trace Recorded**: Full execution trace stored at activity.metabob.com

### Scenario 2: Similar Bug Fix (Warm Start)

**Setup**: Introduce similar bug

**Execution**:
```bash
# Introduce similar bug
bun run dev:introduce-bug

# CI runs again
git push origin main
```

**What You'll See**:
1. **Loop 3 (Discovery)**:
   - Shape inference: Same shapes [error_log, test_result, source_code, test_file]
   - Parallel scans:
     - scan-file-system → 8 impulses (same as before)
     - scan-execution-traces → 1 impulse (previous successful fix!)
   - IntentProxy: Suggests error_log (0.9 relevance), source_code (0.8 relevance)

2. **Loop 1 (Impulse Flow)**:
   - Task 1 loads error_log + execution_trace impulse (previous fix pattern)
   - LLM sees: "Similar to previous fix at line 42"
   - Task 2 loads only source_code (skips test_file based on learned irrelevance)
   - Faster execution (fewer impulses loaded)

3. **Loop 2 (External Validation)**:
   - External: `bun test` → exit code 0 ✓
   - Thompson update: fix-test-failure α=3 (was 2) → higher confidence
   - Impulse relevance: execution_trace +0.15 (very useful!)

**Improvements**:
- ⚡ 40% faster (fewer impulses loaded)
- 💰 30% cheaper (less LLM context)
- ✅ Higher confidence (α/β improved)

### Scenario 3: Different Bug Type (Exploration)

**Setup**: Introduce type error

**Execution**:
```bash
# Introduce type error
sed -i 's/number/string/' src/calculator.ts

# CI runs
git push origin main
```

**What You'll See**:
1. **Loop 3 (Discovery)**:
   - Shape inference: [error_log, type_error, source_code]
   - Parallel scans:
     - scan-file-system → 8 impulses
     - scan-execution-traces → 0 impulses (no type errors in history)
   - IntentProxy: No strong suggestions (low confidence)

2. **Loop 1 (Impulse Flow)**:
   - Task 1 loads error_log (type error signature detected)
   - Task 2 loads source_code + tsconfig impulse
   - Different impulse set than test failures

3. **Loop 2 (External Validation)**:
   - External: `tsc --noEmit` → exit code 0 ✓
   - Thompson update: fix-type-error α=2 (was 1)
   - NEW activity template learned for type errors

**Learning**: System now has two distinct fix patterns (test failures vs type errors).

### Scenario 4: Failure → Variant → Retry

**Setup**: Introduce complex bug that initial fix can't solve

**Execution**:
```bash
# Complex multi-file bug
bun run scripts/introduce-complex-bug.sh

# CI runs
git push origin main
```

**What You'll See**:
1. **Loop 2 (External Validation)**: First attempt fails
   - External: `bun test` → exit code 1 ✗
   - Error classification: test_expects_specific_behavior
   - Thompson update: fix-test-failure β=1 (was 0)

2. **Variant Creation** (from agent a5670ca design):
   - Backend analyzes failure
   - Creates variant with modified validation rules
   - Adds impulse: "previous-attempt-trace"
   - Retry with variant

3. **Loop 1 (Impulse Flow)**: Retry with variant
   - Task 1 loads: error_log + previous-attempt-trace
   - LLM sees: "Previous attempt fixed wrong file, check related files"
   - Task 2 loads additional source_code impulses
   - Fix applied to correct file

4. **Loop 2 (External Validation)**: Variant succeeds
   - External: `bun test` → exit code 0 ✓
   - Thompson update: fix-test-failure-variant-1 α=1, β=0
   - Recovery strategy: (test_failure, create-variant) α=1, β=0

**Learning**: System learns when to create variants for specific error types.

### Scenario 5: Automatic Improvement (After 10 Executions)

**What You'll See**:

**Discovery (Loop 3)**:
- scan-git-history: α=2, β=8 → rarely used (learned to skip)
- scan-file-system: α=10, β=0 → always useful
- scan-execution-traces: α=8, β=2 → useful when history exists

**Impulse Flow (Loop 1)**:
- error_log relevance: 0.95 (almost always needed)
- execution_trace relevance: 0.85 (very useful when available)
- test_file relevance: 0.45 (often loaded but not used)
- Budget allocation: High-relevance impulses get higher budgets

**External Validation (Loop 2)**:
- fix-test-failure: α=8, β=2 → 80% success rate
- fix-type-error: α=5, β=1 → 83% success rate
- Selection probability: fix-test-failure sampled at 0.82 (confident)

**Metrics**:
- Average execution time: 35s (was 60s) - 42% improvement
- Average cost: $0.05 (was $0.12) - 58% reduction
- Success rate: 90% (was 50%) - 80% improvement

## Implementation Status

### ✅ Already Implemented
- Deterministic activities (run-test-suite, run-typecheck, run-lint)
- Learning activities with impulses (fix-test-failure, fix-type-error)
- CI/CD workflows with auto-remediation
- Activity backend connection (activity.metabob.com)
- Trace recording (`tracing.recordTrace: true`)

### 🚧 Partially Implemented
- External validation (tests run, but results not sent to backend)
- Impulse relevance tracking (structure exists, not integrated)
- Thompson Sampling (backend supports it, MiniBob doesn't send feedback)

### ❌ Not Yet Implemented
- Environment scanning activities (from agent a6d86d7 design)
- Automatic variant creation (from agent a5670ca design)
- IntentProxy evolution (from agent aa2c5e4 design)
- Recovery strategy learning

## Next Steps to Complete Demo

### Phase 1: External Validation Feedback (2-4 hours)
**Goal**: Close Loop 2 - Send validation results to backend

**Tasks**:
1. Add manual feedback endpoint calls to CI workflow
2. Create activity wrapper that sends feedback after each remediation
3. Verify Thompson Sampling parameters update

**Files to modify**:
- `.github/workflows/ci.yml`: Add feedback recording after each fix
- `activities/learning/*.json`: Add `learning.onSuccess.sendFeedback: true`

### Phase 2: Environment Scanning Activities (4-6 hours)
**Goal**: Implement Loop 3 - Discovery activities

**Tasks**:
1. Create 5 scanning activities (from agent a6d86d7 design)
2. Add Thompson Sampling for scan selection
3. Integrate with goal processor

**Files to create**:
- `activities/discovery/scan-file-system.json`
- `activities/discovery/scan-git-history.json`
- `activities/discovery/scan-execution-traces.json`
- `activities/discovery/scan-dependencies.json`
- `activities/discovery/scan-test-suite.json`

### Phase 3: Impulse Relevance Integration (2-3 hours)
**Goal**: Complete Loop 1 - Impulse usage tracking

**Tasks**:
1. Modify activities to track which impulses were loaded vs used
2. Send impulse relevance data to backend
3. Query backend for relevance-based suggestions

**Files to modify**:
- `activities/learning/*.json`: Add impulse usage tracking
- Add relevance queries to activity templates

### Phase 4: Demo Scripts and Dashboards (2-3 hours)
**Goal**: Observable demonstration

**Tasks**:
1. Create scripts to run all scenarios
2. Add metrics collection
3. Create dashboard showing learning over time

**Files to create**:
- `scripts/run-scenario-1.sh`: First bug fix
- `scripts/run-scenario-5.sh`: Show improvement after 10 executions
- `scripts/show-metrics.sh`: Display learning metrics

## How to Run Complete Demo

**Prerequisites**:
```bash
# Export API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export METABOB_API_KEY="your-api-key"

# Install dependencies
cd demos/minibob-cicd
bun install
```

**Run Scenarios**:
```bash
# Scenario 1: Cold start
./scripts/run-scenario-1.sh

# Wait for CI to complete, check metrics
./scripts/show-metrics.sh

# Scenario 2: Warm start (similar bug)
./scripts/run-scenario-2.sh

# Scenario 5: After 10 executions
./scripts/run-scenario-5.sh
```

**View Learning Dashboard**:
```bash
# Open activity dashboard
open https://internal.metabob.com/activities/fix-test-failure

# Check Thompson Sampling parameters
curl -H "Authorization: ApiKey $METABOB_API_KEY" \
  https://activity.metabob.com/v2/activities/templates/fix-test-failure \
  | jq '.thompson_alpha, .thompson_beta'
```

## Expected Outcomes

After running all scenarios, you should see:

**Thompson Sampling Convergence**:
- fix-test-failure: α≈10, β≈2 (high confidence)
- fix-type-error: α≈5, β≈1 (moderate confidence)
- Variants created: 2-3 (for complex failures)

**Impulse Relevance Learning**:
- error_log: 0.90+ relevance (always needed)
- execution_trace: 0.80+ relevance (very useful)
- test_file: 0.40-0.60 relevance (sometimes useful)
- git_history: 0.20- relevance (rarely useful)

**Discovery Optimization**:
- scan-file-system: α≈10, β≈0 (always run)
- scan-execution-traces: α≈8, β≈2 (run when history exists)
- scan-git-history: α≈2, β≈8 (rarely useful, stopped)

**Performance Improvements**:
- Execution time: 60s → 35s (42% faster)
- Cost per fix: $0.12 → $0.05 (58% cheaper)
- Success rate: 50% → 90% (80% improvement)

**Observability**:
- All traces visible at activity.metabob.com
- Thompson Sampling parameters visible in dashboard
- Impulse relevance scores visible in backend
- Learning curves visible over time

## Success Criteria

The demo successfully demonstrates the three loops when:

1. ✅ **Loop 1 (Impulse Flow)**: Task outputs chain to next task inputs, budget enforcement visible, usage tracking shows loaded vs used
2. ✅ **Loop 2 (External Validation)**: Test results trigger Thompson Sampling updates, α/β parameters improve, variants created on failures
3. ✅ **Loop 3 (Discovery)**: Environment scans discover impulses, Thompson Sampling learns which scans help, low-value scans automatically skipped

All three loops should feed each other:
- Better discovery → better impulses → higher success rate (Loop 3 → Loop 1 → Loop 2)
- Higher success rate → better Thompson parameters → better activity selection (Loop 2 → Loop 1)
- Better activity selection → better impulse usage → better relevance scores (Loop 1 → Loop 3)

This creates a **continuous learning cycle** that improves with every CI/CD run.
