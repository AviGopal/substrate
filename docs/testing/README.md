# Testing Documentation

This directory contains documentation for testing and verifying the metabob-devbob system.

## Documents

### [Verification and Testing Inventory](./VERIFICATION_AND_TESTING_INVENTORY.md)

**Comprehensive inventory** of all tests, verification mechanisms, and testing infrastructure.

**Contents**:
- Test file inventory (all test files categorized)
- Test coverage matrix (what's tested vs what's not)
- Verification checklists for the three learning loops
- Testing strategies and frameworks
- Smoke test suite specification
- Production validation guide
- Testing gaps and recommendations
- How to add new tests

**Use when**:
- Understanding what tests exist
- Identifying testing gaps
- Adding new tests
- Planning testing improvements

### [Quick Verification Guide](./QUICK_VERIFICATION_GUIDE.md)

**Practical, actionable guide** for developers to quickly verify their changes.

**Contents**:
- 3-minute smoke test
- Verification by component (MiniBob, Activity API, templates, etc.)
- Verification for the three learning loops
- Common verification scenarios
- Production deployment verification
- Troubleshooting guide
- Quick reference card

**Use when**:
- Making changes and need to verify they work
- Debugging failed tests
- Deploying to production
- Need quick verification commands

## Quick Start

### Before Pushing Code

```bash
# Run quick verification (3 minutes)
./scripts/quick-verify.sh
```

### After Deployment

```bash
# Run smoke tests
./scripts/smoke-test.sh canary
./scripts/smoke-test.sh production
```

### Manual Verification

See the [Quick Verification Guide](./QUICK_VERIFICATION_GUIDE.md) for step-by-step instructions.

## Testing Philosophy

The system has **three learning loops** that must be verified:

### Loop 1: Impulse Flow
Data flows through the system correctly - impulses are created, loaded, resolved, and chained.

**Verify**: Impulses respect budgets, resolve correctly, chain between activities.

### Loop 2: Validation/Feedback
System learns from execution outcomes - Thompson parameters update, validation works, feedback is recorded.

**Verify**: α/β parameters update, validation rules work, manual feedback recorded.

### Loop 3: Discovery
System discovers missing capabilities - infers shapes, detects gaps, suggests prerequisites.

**Verify**: Shape inference works, missing impulses detected, state space queries return correct data.

## Test Locations

| Component | Test Location | Run Command |
|-----------|---------------|-------------|
| MiniBob | `repos/minibob/test/` | `cd repos/minibob && bun test` |
| Activity API | `repos/metabob-activity-api/src/` and `test/` | `cd repos/metabob-activity-api && bun test` |
| E2E Tests | `e2e/` | `bun test e2e/` |
| Cloud Dashboard | `repos/metabob-cloud-dashboard/e2e/` | `cd repos/metabob-cloud-dashboard && bun test` |
| Internal Dashboard | `repos/metabob-internal-dashboard/tests/` | `cd repos/metabob-internal-dashboard && bun test` |

## Scripts

All verification scripts are in `/scripts/`:

| Script | Purpose | Runtime |
|--------|---------|---------|
| `quick-verify.sh` | Essential checks before pushing | < 3 min |
| `smoke-test.sh` | Minimal system health check | < 1 min |
| `health-check.sh` | Production health validation | < 30 sec |

## Coverage Status

**Well Tested** ✅:
- Schema validation
- Authentication (API key, JWT)
- Thompson Sampling (Beta distribution)
- Multi-tenant isolation
- Database connection management

**Partially Tested** ⚠️:
- E2E goal flow
- Impulse chaining
- Schema transformations
- Execution trace storage

**Not Tested** ❌:
- Impulse lifecycle (lazy loading, budget enforcement)
- Activity execution in MiniBob
- Validation layer (requiredFiles, patterns, commands)
- WebSocket live updates
- Ribosome pattern
- Boredom system
- Loop 3 (Discovery)

See [Verification Inventory](./VERIFICATION_AND_TESTING_INVENTORY.md) for detailed coverage matrix.

## Adding Tests

See the [How to Add New Tests](./VERIFICATION_AND_TESTING_INVENTORY.md#how-to-add-new-tests) section in the Verification Inventory.

**Quick checklist**:
1. Determine test type (unit, integration, E2E)
2. Create test file following naming convention
3. Write test using Bun test framework
4. Add to CI/CD pipeline
5. Document in inventory
6. Run locally to verify

## Priority Actions

Based on the current testing gaps, these are the priority actions:

1. **Add impulse lifecycle tests** (2-3 hours)
   - Test lazy loading
   - Test budget enforcement
   - Test impulse chaining

2. **Add activity execution tests** (4-6 hours)
   - Test execution flow in MiniBob
   - Test task execution
   - Test tool calls

3. **Add Thompson Sampling integration test** (2-3 hours)
   - Verify α/β updates after execution
   - Test exploration vs exploitation
   - Verify variant selection

4. **Add validation layer tests** (3-4 hours)
   - Test requiredFiles validation
   - Test pattern matching
   - Test command execution validation

5. **Set up production monitoring** (variable)
   - Configure alerts
   - Set up dashboards
   - Add metrics tracking

## Resources

- **Main CLAUDE.md**: `/home/avi/documents/work/exp-repo/metabob-devbob/CLAUDE.md`
- **Architecture Docs**: `/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/`
- **Testing Guide**: See CLAUDE.md §Key Architectural Concepts for learning loop details
- **MiniBob CLAUDE.md**: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob/CLAUDE.md`
- **Activity API CLAUDE.md**: `/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api/CLAUDE.md`

## Questions?

For questions about testing:
1. Check the [Quick Verification Guide](./QUICK_VERIFICATION_GUIDE.md) for common scenarios
2. Check the [Verification Inventory](./VERIFICATION_AND_TESTING_INVENTORY.md) for detailed coverage
3. Check existing tests for examples
4. Consult the architecture docs for system design
