# Testing Documentation

This directory contains documentation for testing and verifying the metabob-devbob system.

## Documents

### [Quick Verification Guide](./QUICK_VERIFICATION_GUIDE.md)

**Primary reference** for developers verifying changes, debugging failures, and validating deployments.

**Contents**:
- Substrate endpoint configuration
- Primary validation harnesses (failure-mode and stratified)
- Pre-push smoke test steps
- Verification by component (minibob, activity-api, auth, schema)
- Learning loop verification (Thompson α/β, dense search / MRR)
- Common scenarios: new template, debug failure, A/B variant learning
- Canary / production deployment verification
- Troubleshooting guide
- Quick reference card

**Use when**:
- Verifying a change before pushing
- Debugging a failed test or deployment
- Confirming the learning loop is working
- Deploying to canary or production

---

## Primary Validation Harnesses (2026-05-27)

```bash
# Failure-mode classification (63 modes)
bun run validation/scripts/failure-mode-harness.ts

# Thompson learning + MRR (dense search)
bun run validation/scripts/stratified-harness.ts
```

Both harnesses read `~/.metabob/config.json` for the substrate endpoint — no hardcoded URLs.

---

## Test Locations

| Component | Test Location | Run Command |
|-----------|---------------|-------------|
| MiniBob | `repos/minibob/test/` | `cd repos/minibob && bun test` |
| Activity API | `repos/activity-api/test/` | `cd repos/activity-api && bun test` |
| Identity Vessel | `repos/identity-vessel/test/` | `cd repos/identity-vessel && bun test` |
| Cloud Dashboard | `repos/metabob-cloud-dashboard/e2e/` | `cd repos/metabob-cloud-dashboard && bun test` |

---

## Adding Tests

1. Determine test type (unit, integration, E2E)
2. Create test file in `<vessel>/test/` following the Bun test framework conventions
3. Write tests using the Arrange-Act-Assert pattern
4. Add to CI/CD pipeline if integration-level
5. Run locally to verify

Pattern:
```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

describe('Feature', () => {
  beforeAll(async () => { /* setup */ })
  afterAll(async () => { /* cleanup */ })

  test('should do X when Y', async () => {
    const result = await featureUnderTest(input)
    expect(result).toBe(expected)
  })
})
```

---

## Resources

- **CLAUDE.md** (project root): Authentication model, substrate configuration, deployment workflow
- **Architecture**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- **Substrate guide**: `docs/SUBSTRATE.md`
