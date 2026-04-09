# MiniBob Development Policy

**Effective Date**: 2026-04-09
**Repository**: demos/minibob-cicd

## Policy Statement

**All development in this repository MUST be performed by MiniBob.** No manual code edits are permitted except for code review comments and emergency fixes.

## Rationale

1. **Dogfooding**: We use MiniBob to develop MiniBob's capabilities
2. **Learning**: Every change creates execution traces that improve Thompson Sampling
3. **Demonstration**: This repository showcases autonomous development
4. **Validation**: Proves activities work in real-world development scenarios

## Development Workflow

### For All Changes

```bash
# 1. Define the goal
GOAL="Add automatic feedback recording to activity executor"

# 2. Use MiniBob to implement
cd /home/avi/documents/work/exp-repo/metabob-devbob/demos/minibob-cicd
minibob --single "$GOAL"

# 3. Review the changes (human code review)
git diff

# 4. If approved, commit (MiniBob can do this too)
minibob --single "commit these changes with an appropriate message"

# 5. Push to trigger CI/CD
git push
```

### For Bug Fixes

```bash
# Introduce bug for testing (optional)
./scripts/introduce-bug.sh

# Get error log
ERROR_LOG="$(bun test 2>&1)"

# Use learning activity
minibob --template activities/learning/fix-test-failure.json \
  --var "errorLog=$ERROR_LOG" \
  --trace
```

### For New Features

```bash
# Use development activity or general goal
minibob --single "Add support for parallel discovery execution in goal-processor.ts"

# Or use composition for complex features
minibob --single "Implement complete Loop 3 discovery integration with:
1. Discovery phase in goal processor
2. Parallel activity executor
3. Impulse batch consolidation
4. Thompson Sampling updates"
```

### For Refactoring

```bash
minibob --single "Refactor impulse.ts to separate loading logic from relevance tracking"
```

## Permitted Human Actions

### ✅ Allowed
- Code review and approval
- Writing goals for MiniBob
- Executing MiniBob commands
- Reviewing execution traces
- Providing feedback (/cheer, /chide)
- Updating documentation (via MiniBob)
- Configuring CI/CD workflows
- Emergency rollbacks (critical production issues only)

### ❌ Not Allowed
- Direct file editing (use MiniBob with --single)
- Manual git commits (let MiniBob commit)
- Copy-paste code changes
- IDE refactoring tools
- Search-and-replace across files

## Exception Process

If MiniBob cannot complete a task after 3 attempts:

1. **Analyze the failure**:
   ```bash
   ./scripts/show-learning-metrics.sh
   # Check why activity failed
   ```

2. **Create an issue** (via MiniBob):
   ```bash
   minibob --template activities/github/create-issue-from-bug.json \
     --var "bugDescription=MiniBob failed to implement X after 3 attempts" \
     --trace
   ```

3. **Request human guidance**:
   - Provide more specific goal decomposition
   - Add missing context as impulses
   - Adjust activity template
   - Create new activity if needed

4. **Never bypass MiniBob** - improve the activities instead

## Activity Selection Priority

### High Priority (Use First)
- `fix-test-failure` - For test failures
- `fix-type-error` - For TypeScript errors
- `fix-lint-error` - For linting issues
- `run-test-suite` - For validation
- `run-typecheck` - For type checking
- `run-lint` - For linting

### Medium Priority (Use for Complex Tasks)
- `fix-test-failure-with-discovery` - When context is unclear
- `scan-file-system` - To discover relevant files
- `scan-git-history` - To find related changes
- `scan-execution-traces` - To learn from past fixes

### Experimental (Use Carefully)
- `introduce-change` - For intentional modifications
- `create-issue-from-failure` - For tracking failures
- `create-pr-for-fix` - For automated PRs
- GitHub activities (when resolver available)

## Tracing Requirements

**Every MiniBob execution MUST include `--trace`** to record:
- Execution duration
- Cost (tokens, API calls)
- Success/failure outcome
- Files modified
- Tools used
- Impulses loaded

This data feeds:
- Thompson Sampling for activity selection
- Impulse relevance scoring
- Discovery effectiveness tracking

## Validation Gates

### Before Commit
```bash
# MiniBob runs these automatically
minibob --template activities/deterministic/run-test-suite.json
minibob --template activities/deterministic/run-typecheck.json
minibob --template activities/deterministic/run-lint.json
```

### Before Merge
```bash
# CI/CD runs these automatically
- All tests pass
- Type checking passes
- Linting passes
- No regressions in trace analysis
```

## Metrics Tracking

Track these metrics over time:
- **Success rate**: % of goals achieved on first attempt
- **Cost per change**: Average tokens/$ per code modification
- **Time per change**: Average duration per successful change
- **Thompson Sampling convergence**: α/β ratios over time
- **Impulse relevance scores**: Which contexts are most useful
- **Discovery effectiveness**: Which scans provide value

**Goal**: Show measurable improvement over 10+ executions.

## Git Workflow

### Branch Strategy
- `main` - Stable, all tests pass
- `dev` - Active development (MiniBob works here)
- `experiment/*` - Experimental activities

### Commit Messages
MiniBob generates commit messages following conventional commits:

```
<type>(<scope>): <subject>

<body - explains why, not what>

Trace: execution_<timestamp>_<id>
Co-Authored-By: MiniBob <minibob@metabob.com>
```

### Pull Requests
MiniBob can create PRs (once GitHub resolver is available):

```bash
minibob --template activities/github/create-pr-from-branch.json \
  --var "branchName=dev" \
  --var "baseBranch=main" \
  --trace
```

## Monitoring and Observability

### View Activity Dashboard
```bash
# Show recent MiniBob executions
./scripts/show-learning-metrics.sh

# Analyze execution traces
minibob --template activities/monitoring/analyze-traces.json --trace
```

### Check Thompson Sampling Status
```bash
curl "https://activity.metabob.com/v2/activities/templates" \
  -H "Authorization: ApiKey <key>" | jq '.templates[] | {id, alpha: .thompsonSampling.alpha, beta: .thompsonSampling.beta}'
```

## Continuous Improvement

This policy itself can be updated via MiniBob:

```bash
minibob --single "Update MINIBOB_DEVELOPMENT_POLICY.md to add section on handling merge conflicts"
```

## Enforcement

- **Pre-commit hooks**: Check for manual edits (planned)
- **Code review**: Verify all commits have MiniBob trace IDs
- **CI/CD**: Reject PRs without execution traces
- **Audit**: Monthly review of policy adherence

## Success Criteria

After 30 days of MiniBob-only development:
- ✅ 50+ successful executions recorded
- ✅ Thompson Sampling shows convergence (α >> β for good activities)
- ✅ Impulse relevance scores stabilized
- ✅ Success rate improved by 40%+
- ✅ Cost per change reduced by 50%+
- ✅ Zero manual code edits (except emergencies)

## Questions?

For policy clarification or exceptions, ask MiniBob:

```bash
minibob --single "Explain the development policy for handling emergency production bugs"
```

---

**Remember**: The goal is not perfection, but **demonstrable learning**. Every MiniBob failure is valuable data that improves future executions.

Let MiniBob struggle, fail, retry, and learn. That's the point.
