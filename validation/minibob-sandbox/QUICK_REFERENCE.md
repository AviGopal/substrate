# Sandbox Quick Reference

## Setup (First Time)

```bash
export METABOB_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
cd repos/minibob/sandbox
./setup.sh
```

## Run Tests

```bash
# All tests
bun run run-validation.ts

# High priority only
bun run run-validation.ts high

# Quick trace collection
./collect-traces.sh high
```

## View Results

```bash
# Latest report
cat reports/validation-report.json | jq

# Execution logs
tail -f logs/execution.log

# Summary
cat reports/validation-report.json | jq '.summary'
```

## Test Scenarios

| ID | Name | Resolvers | Duration |
|----|------|-----------|----------|
| test-001 | Simple Goal | GoalAnalysis, File | < 30s |
| test-002 | Complex Goal | GoalAnalysis, ActivityExecutor | < 60s |
| test-003 | Bootstrap | ImpulseStateAnalysis, DirectoryTree | < 45s |
| test-004 | Improvisation | Improviser, LLM | < 90s |
| test-005 | Composition | ActivityExecutor | < 60s |
| test-006 | State Navigation | StateNavigator, Bash | < 45s |
| test-011 | Thompson Sampling | GoalAnalysis, ActivityExecutor | < 60s |
| test-012 | Metadata Reasoning | DirectoryTree | < 20s |

## Configuration

**Key Files:**
- `sandbox.config.json` - Environment settings
- `validation-tests.json` - Test definitions
- `workspace/` - Test workspace
- `reports/` - Test results
- `logs/` - Execution logs

**Environment Variables:**
- `METABOB_API_KEY` - Backend authentication
- `ANTHROPIC_API_KEY` - LLM provider

## Common Tasks

**Clean workspace:**
```bash
rm -rf workspace/ && ./setup.sh
```

**Run specific test:**
```bash
# Edit validation-tests.json, filter by ID in run-validation.ts
```

**Submit traces manually:**
```bash
# Check reports/validation-report.json for trace IDs
curl -X POST https://activity.metabob.com/v2/activities/execution-traces \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @trace.json
```

## Integration Status

| Component | Status | File |
|-----------|--------|------|
| Environment Setup | ✓ Complete | setup.sh |
| Test Definitions | ✓ Complete | validation-tests.json |
| Test Runner | ⚠ Mock | run-validation.ts |
| Goal Execution | ❌ TODO | mockExecuteGoal() |
| Outcome Validation | ❌ TODO | validateOutcomes() |
| Resolver Detection | ❌ TODO | extractResolversUsed() |
| Trace Submission | ❌ TODO | submitTrace() |

See [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) for integration details.

## Success Criteria

- [ ] All high-priority tests pass (5/5)
- [ ] Tests complete within expected duration
- [ ] All resolvers tested at least once
- [ ] Traces submitted successfully (100%)
- [ ] Total cost < $0.50 per run
- [ ] No validation errors

## Troubleshooting

**Backend connection fails:**
- Check API key is valid
- Verify network connectivity
- Confirm endpoint is correct

**Tests fail:**
- Check workspace was set up
- Verify sample files exist
- Review logs/execution.log

**No traces submitted:**
- Check traceCollection.enabled = true
- Verify autoSubmit = true
- Check backend API key

## Resources

- [README.md](./README.md) - Full documentation
- [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) - Integration guide
- [Root CLAUDE.md](../../CLAUDE.md) - Project overview
