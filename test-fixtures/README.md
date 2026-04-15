# Contract Testing: Test Fixtures Structure

## Overview

Test fixtures provide sample specifications, implementations, and expected outcomes for contract enforcement testing. This enables rapid iteration on contract validation activities without needing to set up full projects.

## Directory Structure

```
test-fixtures/
├── specifications/           # OpenSpec documents (requirements)
│   ├── user-auth.md         # Sample feature specification
│   ├── api-endpoint.md      # Sample API contract
│   ├── data-migration.md    # Sample schema change
│   └── bugfix-template.md   # Sample bugfix specification
│
├── implementations/         # Code under test (actual implementations)
│   ├── user-auth/
│   │   ├── good/           # Compliant implementations
│   │   │   ├── src/
│   │   │   ├── test/
│   │   │   └── package.json
│   │   ├── drift/          # Within tolerance but not perfect
│   │   │   └── ...
│   │   └── fail/           # Non-compliant implementations
│   │       └── ...
│   │
│   ├── api-endpoint/
│   │   ├── good/
│   │   ├── drift/
│   │   └── fail/
│   │
│   └── README.md           # Implementation test cases
│
├── traces/                  # Historical execution traces (sample data)
│   ├── successful/
│   │   ├── trace-001.json  # Successful contract validation
│   │   └── trace-002.json
│   ├── failed/
│   │   ├── trace-003.json  # Failed validation with reasons
│   │   └── trace-004.json
│   └── README.md           # Trace corpus description
│
├── expected-results/        # Expected compliance reports
│   ├── user-auth-good.json      # Expected PASS
│   ├── user-auth-drift.json     # Expected DRIFT
│   ├── user-auth-fail.json      # Expected FAIL
│   └── README.md
│
└── README.md               # Test fixtures documentation

```

## Specification Format (OpenSpec)

All specifications follow the validation-contracts.md format:

**Required sections:**
1. Metadata (spec_id, version, status, category)
2. Functional Requirements (testable checklist)
3. Performance Requirements (cost, duration, quality thresholds)
4. Validation Rules (files, patterns, commands)
5. Drift Thresholds (tolerance levels)

**Example:** `test-fixtures/specifications/user-auth.md`

## Implementation Categories

### Good Implementations
- Meet all functional requirements
- Within performance thresholds
- Pass all validation rules
- Expected result: `PASS`

### Drift Implementations
- Meet all functional requirements
- Exceed performance thresholds by 10-20%
- Pass validation but with warnings
- Expected result: `DRIFT`

### Fail Implementations
- Missing functional requirements
- Exceed performance thresholds by >20%
- Fail validation rules
- Expected result: `FAIL`

## Trace Corpus

Historical traces provide training data for learning:

**Successful traces:**
- Activities that correctly validated contracts
- Used to improve Thompson Sampling scores
- Extract patterns for contract checking

**Failed traces:**
- Activities that missed violations
- Used to identify weaknesses
- Generate trailblazing variants

**Trace format:** Standard MiniBob execution trace JSON

## Expected Results

Pre-computed compliance reports for regression testing:

```json
{
  "testCase": "user-auth-good",
  "expectedStatus": "PASS",
  "expectedDrift": {
    "functional": 0,
    "performance": -5,
    "overall": -2.5
  },
  "expectedChecks": {
    "filesExist": 4,
    "patternsFound": 6,
    "commandsPassed": 3
  }
}
```

## Creating New Fixtures

### 1. Start with Specification

```bash
# Create new spec based on template
cp test-fixtures/specifications/_template.md test-fixtures/specifications/my-feature.md

# Edit to define requirements
vim test-fixtures/specifications/my-feature.md
```

### 2. Create Good Implementation

```bash
# Create compliant implementation
mkdir -p test-fixtures/implementations/my-feature/good
cd test-fixtures/implementations/my-feature/good

# Implement according to spec
# (use MiniBob or manual implementation)
```

### 3. Create Drift/Fail Variants

```bash
# Copy good implementation
cp -r good drift
cp -r good fail

# Modify drift: performance slightly over threshold
# Modify fail: missing requirements, validation failures
```

### 4. Generate Expected Results

```bash
# Run contract validation manually
./scripts/run-contract-test.sh \
  --spec test-fixtures/specifications/my-feature.md \
  --impl test-fixtures/implementations/my-feature/good \
  --output test-fixtures/expected-results/my-feature-good.json
```

## Using Fixtures in Testing

### Docker Compose

```bash
# Mount fixtures into container
docker-compose -f docker-compose.contract-testing.yml run contract-runner \
  --single "validate contract for /test-fixtures/specifications/user-auth.md against /test-fixtures/implementations/user-auth/good"
```

### MiniBob Directly

```bash
# Run from host
cd repos/minibob
bun run index.ts --single "validate contract compliance" \
  --var spec="/path/to/test-fixtures/specifications/user-auth.md" \
  --var impl="/path/to/test-fixtures/implementations/user-auth/good"
```

### Automated Regression Tests

```bash
# Run all fixtures through contract validation
for spec in test-fixtures/specifications/*.md; do
  for impl in test-fixtures/implementations/$(basename $spec .md)/*; do
    ./scripts/run-contract-test.sh --spec $spec --impl $impl
  done
done
```

## Fixture Maintenance

### Adding New Test Cases

1. Identify contract patterns not yet covered
2. Create minimal spec + good/drift/fail implementations
3. Run validation to generate expected results
4. Commit to git for regression testing

### Updating Existing Fixtures

When contract validation logic changes:

1. Re-run all fixtures through updated validation
2. Compare new results against expected results
3. Update expected results if changes are intentional
4. Document changes in fixture README

### Corpus Growth

As MiniBob executes contract activities:

1. Successful executions → `traces/successful/`
2. Failed executions → `traces/failed/`
3. Periodically review corpus for patterns
4. Extract common patterns into reusable activities

## Trace Collection Strategy

### Immediate Collection

Every contract validation execution stores trace to production backend:
- `activity.metabob.com/v2/activities/execution-traces`
- Traces include full input/output state
- Impulse references captured

### Batch Export

Periodically export traces for local analysis:

```bash
# Export last 100 contract validation traces
curl https://activity.metabob.com/v2/activities/execution-traces \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{"activityId": "validate-spec-compliance", "limit": 100}' \
  > test-fixtures/traces/batch-export-$(date +%F).json
```

### Trace Deduplication

Multiple executions of same spec/impl pair:
- Keep only unique outcomes (PASS, DRIFT, FAIL per case)
- Preserve first successful trace
- Preserve all failure modes
- Archive duplicates

## Fixture Validation

Before committing new fixtures:

```bash
# Validate spec format
./scripts/validate-spec-format.sh test-fixtures/specifications/my-feature.md

# Verify implementations build/run
cd test-fixtures/implementations/my-feature/good
npm install && npm test

# Confirm expected results match actual
./scripts/run-contract-test.sh --spec ... --impl ... --verify-expected
```

## Related Documentation

- `openspec/meta/validation-contracts.md` - Contract format specification
- `CLAUDE.md` - Development philosophy
- `docker-compose.contract-testing.yml` - Testing environment
- `scripts/run-contract-test.sh` - Test execution script
