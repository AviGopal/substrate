## 1. Dependencies and Setup

- [x] 1.1 Add `@stdlib/random-base-beta` to package.json in repos/metabob-activity-api
- [x] 1.2 Run `bun install` to install the Beta distribution sampling library
- [x] 1.3 Verify library compatibility with Bun by importing and running basic test

## 2. Core Implementation

- [x] 2.1 Import betaFactory from @stdlib/random-base-beta in repos/metabob-activity-api/src/routes/activities.ts
- [x] 2.2 Initialize Beta sampler with optional seed from THOMPSON_SAMPLING_SEED environment variable
- [x] 2.3 Replace line 1320 `const sample = alpha / (alpha + beta)` with `const sample = betaSample(alpha, beta)`
- [x] 2.4 Remove or update comment on line 1318-1319 to reflect actual sampling implementation
- [x] 2.5 Verify that alpha/beta defaults (lines 1315-1316) still work correctly with Beta sampling

## 3. Testing - Beta Distribution Sampling

- [x] 3.1 Create test file `repos/metabob-activity-api/src/routes/activities.test.ts` if it doesn't exist
- [x] 3.2 Add test: "Beta sampling produces values between 0 and 1"
- [x] 3.3 Add test: "Beta sampling produces different values on repeated calls with same alpha/beta"
- [x] 3.4 Add test: "Beta(1,1) produces approximately uniform distribution over 1000 samples"
- [x] 3.5 Add test: "Beta sampling with seed produces reproducible sequences"

## 4. Testing - Exploration Behavior

- [x] 4.1 Add test: "Thompson Sampling explores uncertain templates (low alpha+beta)"
- [x] 4.2 Add test: "Thompson Sampling exploits proven templates (high alpha, low beta)"
- [x] 4.3 Add test: "Templates with same success rate but different confidence get selected at different rates"
- [x] 4.4 Run tests 100+ times with different seeds to verify probabilistic behavior

## 5. Testing - Edge Cases

- [x] 5.1 Add test: "Handle alpha=0 or beta=0 with defaults"
- [x] 5.2 Add test: "Handle very large alpha/beta values (alpha=10000, beta=1000)"
- [x] 5.3 Add test: "Handle extremely skewed distributions (alpha=1, beta=1000)"
- [x] 5.4 Add test: "Verify numerical stability - no NaN, Infinity, or out-of-bounds values"

## 6. Performance Testing

- [x] 6.1 Create benchmark test for Beta sampling with 10 templates
- [x] 6.2 Verify Beta sampling completes in under 10ms for typical workload
- [x] 6.3 Compare performance before/after (expected value vs actual sampling)
- [ ] 6.4 Profile recommendation endpoint to ensure sampling is not a bottleneck

## 7. Integration Testing

- [x] 7.1 Deploy to local Kubernetes cluster using helmfile
- [ ] 7.2 Call /v2/activities/recommend endpoint multiple times with same criteria
- [ ] 7.3 Verify that different templates are selected across calls (probabilistic behavior)
- [ ] 7.4 Check logs for sample values in selection_metadata
- [ ] 7.5 Verify that templates with high uncertainty are explored in practice

**Note:** Integration testing blocked by multiple schema mismatches (separate from Thompson Sampling fix):
- `task_steps[*].dependencies` - SCHEMAFULL table doesn't support nested structure
- `org_id` type - schema expects `record<organizations>`, API sends string
- These are pre-existing schema alignment issues, not related to Thompson Sampling

**Core Thompson Sampling implementation is complete and unit tested (14 tests pass).**

## 8. Documentation and Cleanup

- [x] 8.1 Update inline comments to document that actual Beta sampling is now used
- [x] 8.2 Add JSDoc comment explaining betaSample initialization and seeding
- [x] 8.3 Document THOMPSON_SAMPLING_SEED environment variable in repos/metabob-activity-api/README.md
- [x] 8.4 Remove "simplified for deterministic testing" comment since that no longer applies

## 9. Verification and Deployment

- [x] 9.1 Run full test suite: `bun test` in repos/metabob-activity-api
- [ ] 9.2 Run type checking: `bun run typecheck` in repos/metabob-activity-api
- [x] 9.3 Build Docker image for metabob-activity-api
- [ ] 9.4 Deploy to staging environment and monitor for 24 hours
- [ ] 9.5 Check dashboard for template selection frequency distribution
- [ ] 9.6 Verify that exploration is happening (uncertain templates selected occasionally)
- [ ] 9.7 Deploy to production cluster
