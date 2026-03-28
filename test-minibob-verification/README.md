# MiniBob Verification Test Suite

Comprehensive verification of MiniBob capabilities and OpenCode integration.

See: `/home/avi/documents/work/exp-repo/metabob-devbob/MINIBOB_VERIFICATION_SUITE.md` for complete test specifications.

## Quick Start

```bash
# 1. Ensure backend is running
curl http://api.minibob.local/health

# 2. Setup environment
bun run setup.ts

# 3. Run all tests
bun run all-tests.ts

# 4. Run individual test
bun run tests/01-goal-seeking-improvisation.ts
```

## Test Coverage

1. ✅ Goal-Seeking Improvisation (when no templates match)
2. ✅ Activity Execution and Selection (Thompson Sampling relevance)
3. ✅ Impulse System Integration (context + tool data)
4. ✅ In-Situ Debugging (on-the-fly variant creation)
5. ✅ Post-Hoc Improvement (state analysis and optimization)
6. ✅ Activity Composition (workflow reuse with impulses)

## Dashboard

Real-time verification: http://dashboard.minibob.local
