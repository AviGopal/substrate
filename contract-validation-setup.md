# Contract Validation Setup Guide

## Overview

This document describes the validation environment for contract enforcement testing. The goal is to rapidly collect execution traces for the contract enforcement system by running contract validation activities against test fixtures and storing traces in the production backend.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Contract Testing Flow                    │
└─────────────────────────────────────────────────────────────┘

Test Fixtures                Contract Runner              Production Backend
    (Local)                     (Docker)                (activity.metabob.com)
       │                            │                             │
       │  1. Mount specs/impls      │                             │
       ├───────────────────────────>│                             │
       │                            │                             │
       │                            │  2. Execute activity        │
       │                            │  (validate contract)        │
       │                            │                             │
       │                            │  3. Store trace             │
       │                            ├────────────────────────────>│
       │                            │                             │
       │                            │  4. Query traces            │
       │                            │<────────────────────────────┤
       │                            │                             │
       │  5. Compliance report      │                             │
       │<───────────────────────────┤                             │
       │                            │                             │

       Learning Loop:
       - Successful executions → Thompson Sampling α++
       - Failed executions → Thompson Sampling β++
       - Patterns extracted → New activity variants
       - Corpus grows → Better recommendations
```

## Key Design Decisions

### 1. Production Backend Only

**Decision:** Use `activity.metabob.com` instead of local SurrealDB

**Rationale:**
- Traces immediately available for learning
- Thompson Sampling updated in real-time
- No local infrastructure to manage
- Aligns with "canary first" development philosophy
- Shared corpus across all developers

**Configuration:**
```bash
METABOB_ENDPOINT=https://activity.metabob.com
METABOB_API_KEY=<your-api-key>
```

### 2. Docker Compose for Isolation

**Decision:** Use docker-compose.contract-testing.yml

**Rationale:**
- Isolated environment for testing
- Reproducible setup across machines
- Easy to mount fixtures and collect output
- Fast iteration (rebuild/rerun quickly)
- No interference with development environment

**Usage:**
```bash
# Interactive REPL mode
docker-compose -f docker-compose.contract-testing.yml run contract-runner

# Single goal execution
docker-compose -f docker-compose.contract-testing.yml run contract-runner \
  --single "validate contract for user-auth spec"

# Batch testing
docker-compose -f docker-compose.contract-testing.yml up --build
```

### 3. Test Fixtures as Training Data

**Decision:** Structured test fixtures with known outcomes

**Rationale:**
- Rapid iteration without full project setup
- Known good/drift/fail cases for validation
- Regression testing for contract validation logic
- Training corpus for Thompson Sampling
- Reusable across different contract activities

**Structure:**
```
test-fixtures/
├── specifications/       # OpenSpec requirements
├── implementations/      # Code under test (good/drift/fail)
├── traces/              # Historical execution traces
└── expected-results/    # Pre-computed compliance reports
```

### 4. Fast Feedback Loop

**Decision:** Single-command test execution

**Rationale:**
- Developer runs test, sees result immediately
- Trace stored automatically in backend
- Learning loop updates in real-time
- No manual trace upload or analysis
- Encourages frequent testing

**Command:**
```bash
./scripts/run-contract-test.sh \
  --spec test-fixtures/specifications/user-auth.md \
  --impl test-fixtures/implementations/user-auth/good
```

## Components

### 1. Docker Compose Services

**contract-runner:**
- MiniBob instance configured for contract testing
- Mounts test fixtures and workspace
- Executes contract validation activities
- Stores traces to production backend

**trace-analyzer:**
- Analyzes collected traces
- Extracts patterns
- Generates reports
- Only runs when needed (profile: analysis)

### 2. Test Fixtures

**Specifications (`test-fixtures/specifications/`):**
- OpenSpec documents following validation-contracts.md format
- Define functional/performance/validation requirements
- Specify drift thresholds

**Implementations (`test-fixtures/implementations/`):**
- Good: Compliant implementations (expected: PASS)
- Drift: Within tolerance but not perfect (expected: DRIFT)
- Fail: Non-compliant (expected: FAIL)

**Traces (`test-fixtures/traces/`):**
- Historical execution traces (sample data)
- Successful and failed validations
- Training corpus for learning

**Expected Results (`test-fixtures/expected-results/`):**
- Pre-computed compliance reports
- Used for regression testing
- Verify contract validation logic

### 3. Quick-Start Script

**run-contract-test.sh:**
- Single command to run contract test
- Handles environment setup
- Executes MiniBob with contract activity
- Fetches compliance report from backend
- Verifies against expected results (optional)

## Setup Instructions

### Prerequisites

1. **API Keys:**
   ```bash
   export METABOB_API_KEY="<your-metabob-api-key>"
   export ANTHROPIC_API_KEY="<your-anthropic-api-key>"
   ```

   Or configure in `~/.metabob/config.json`:
   ```json
   {
     "metabob": {
       "apiKey": "your-metabob-api-key",
       "endpoint": "https://activity.metabob.com"
     },
     "providers": {
       "anthropic": { "apiKey": "sk-ant-..." }
     }
   }
   ```

2. **Docker:**
   - Docker Desktop or Docker Engine
   - docker-compose v1.29+ or Docker Compose v2

3. **Test Fixtures:**
   ```bash
   # Create test fixtures directory
   mkdir -p test-fixtures/{specifications,implementations,traces,expected-results}
   ```

### Installation

1. **Copy files to repository:**
   ```bash
   # Docker compose
   cp /tmp/docker-compose.contract-testing.yml repos/metabob-devbob/

   # Test fixtures structure
   mkdir -p repos/metabob-devbob/test-fixtures
   cp /tmp/test-fixtures-structure.md repos/metabob-devbob/test-fixtures/README.md

   # Quick-start script
   mkdir -p repos/metabob-devbob/scripts
   cp /tmp/run-contract-test.sh repos/metabob-devbob/scripts/
   chmod +x repos/metabob-devbob/scripts/run-contract-test.sh
   ```

2. **Create sample fixtures:**
   ```bash
   # TODO: Create initial test fixtures
   # - user-auth specification
   # - good/drift/fail implementations
   # - expected results
   ```

## Usage

### Quick Start

```bash
# 1. Set environment variables
export METABOB_API_KEY="your-api-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# 2. Run contract test
./scripts/run-contract-test.sh \
  --spec test-fixtures/specifications/user-auth.md \
  --impl test-fixtures/implementations/user-auth/good

# 3. View results
# - Compliance report printed to console
# - Trace stored at activity.metabob.com
# - View in dashboard: https://internal.metabob.com/executions/<trace-id>
```

### Docker Compose Workflow

```bash
# Build images
docker-compose -f docker-compose.contract-testing.yml build

# Interactive REPL (explore contract activities)
docker-compose -f docker-compose.contract-testing.yml run contract-runner

# Single goal execution
docker-compose -f docker-compose.contract-testing.yml run contract-runner \
  --single "validate spec compliance for /test-fixtures/specifications/api-endpoint.md"

# Batch testing (all fixtures)
for spec in test-fixtures/specifications/*.md; do
  docker-compose -f docker-compose.contract-testing.yml run contract-runner \
    --single "validate contract for $spec"
done

# Analyze traces
docker-compose -f docker-compose.contract-testing.yml run --profile=analysis trace-analyzer
```

### Regression Testing

```bash
# Verify contract validation logic hasn't regressed
./scripts/run-contract-test.sh \
  --spec test-fixtures/specifications/user-auth.md \
  --impl test-fixtures/implementations/user-auth/good \
  --verify-expected test-fixtures/expected-results/user-auth-good.json

# Exit code 0 = pass, 1 = fail
```

### Trace Collection

```bash
# 1. Run contract tests (traces stored automatically)
./scripts/run-contract-test.sh --spec ... --impl ...

# 2. Query traces from backend
curl https://activity.metabob.com/v2/activities/execution-traces \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{"activityId": "validate-spec-compliance", "limit": 100}' \
  > contract-traces.json

# 3. Analyze patterns (TODO: create analyzer script)
bun run scripts/analyze-contract-traces.ts contract-traces.json
```

## Learning Loop Integration

### How Traces Feed Learning

1. **Execute Contract Validation:**
   - MiniBob runs contract activity (e.g., `validate-spec-compliance`)
   - Activity validation checks spec against implementation
   - Success/failure recorded with full state transition

2. **Store Trace:**
   - Trace sent to `activity.metabob.com/v2/activities/execution-traces`
   - Includes: input impulses, output impulses, tool calls, state changes
   - Tagged with activity ID, spec ID, implementation path

3. **Thompson Sampling Update:**
   - Success → activity's α (success count) incremented
   - Failure → activity's β (failure count) incremented
   - Selection probability updated: `α / (α + β)`

4. **Pattern Extraction:**
   - Ribosome analyzes successful traces
   - Extracts common patterns (file checks, command sequences)
   - Generates activity variants (trailblazing)

5. **Recommendation Improvement:**
   - Next time similar spec/impl combo → better activity recommendation
   - Thompson Sampling balances exploration vs exploitation
   - System learns which activities work for which contract types

### Monitoring Learning Progress

```bash
# View activity metrics
curl https://activity.metabob.com/v2/activities/templates/validate-spec-compliance \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.metrics'

# Expected output:
{
  "successCount": 15,
  "failureCount": 3,
  "averageDuration": 45000,
  "averageCost": 0.12,
  "thompsonAlpha": 15,
  "thompsonBeta": 3,
  "selectionProbability": 0.833
}

# View execution history
curl https://activity.metabob.com/v2/activities/execution-traces?activityId=validate-spec-compliance&limit=10 \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.traces[] | {id, status, duration, cost}'
```

## Iteration Workflow

### 1. Create New Contract Activity

```bash
# Start from template
cp repos/metabob-proto/activities/validation/validate-spec-compliance.json \
   repos/metabob-proto/activities/validation/validate-performance-contract.json

# Edit activity template
vim repos/metabob-proto/activities/validation/validate-performance-contract.json

# Register with backend (TODO: create registration script)
# Or: Let MiniBob discover it via MCP
```

### 2. Test Against Fixtures

```bash
# Run new activity against test fixtures
./scripts/run-contract-test.sh \
  --activity validate-performance-contract \
  --spec test-fixtures/specifications/api-latency.md \
  --impl test-fixtures/implementations/api-latency/good
```

### 3. Collect Traces

```bash
# Traces stored automatically
# View in dashboard or query via API
```

### 4. Analyze Patterns

```bash
# Extract patterns from traces
bun run scripts/analyze-contract-traces.ts

# Generate activity variants based on patterns
# Update activity template
# Repeat cycle
```

### 5. Compare Variants

```bash
# Thompson Sampling automatically compares variants
# Run same spec/impl with different activities
# Best-performing activity gets higher selection probability
```

## Advanced Usage

### Custom Contract Activities

Create specialized contract validators:

```json
{
  "id": "validate-security-contract",
  "category": "validation",
  "tasks": [
    {
      "id": "check-auth",
      "description": "Verify authentication requirements",
      "validation": {
        "requiredPatterns": ["bcrypt", "jwt"],
        "forbiddenPatterns": ["password:"]
      }
    }
  ]
}
```

### Batch Testing

```bash
# Test all implementations against all specs
for spec in test-fixtures/specifications/*.md; do
  spec_name=$(basename "$spec" .md)
  for impl in test-fixtures/implementations/${spec_name}/*; do
    impl_variant=$(basename "$impl")
    echo "Testing: $spec_name / $impl_variant"
    ./scripts/run-contract-test.sh --spec "$spec" --impl "$impl"
  done
done
```

### Continuous Integration

```yaml
# .github/workflows/contract-validation.yml
name: Contract Validation

on: [push, pull_request]

jobs:
  validate-contracts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Set up environment
        run: |
          echo "METABOB_API_KEY=${{ secrets.METABOB_API_KEY }}" >> $GITHUB_ENV
          echo "ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}" >> $GITHUB_ENV

      - name: Run contract tests
        run: |
          for spec in test-fixtures/specifications/*.md; do
            ./scripts/run-contract-test.sh --spec "$spec" --impl ...
          done
```

## Troubleshooting

### Trace Not Stored

**Symptom:** Execution completes but trace not in backend

**Solution:**
```bash
# Check API key
echo $METABOB_API_KEY

# Verify backend connectivity
curl https://activity.metabob.com/health

# Check MiniBob logs for errors
docker-compose -f docker-compose.contract-testing.yml logs contract-runner
```

### Validation Fails Unexpectedly

**Symptom:** Good implementation marked as FAIL

**Solution:**
```bash
# Review compliance report details
jq '.compliance' compliance-report.json

# Check validation rules in spec
grep -A 20 "## Validation Rules" test-fixtures/specifications/user-auth.md

# Verify implementation has required files/patterns
grep -r "bcrypt" test-fixtures/implementations/user-auth/good/
```

### Docker Build Fails

**Symptom:** Cannot build contract-runner image

**Solution:**
```bash
# Build manually for better error messages
cd repos/minibob
docker build -t contract-runner .

# Check Dockerfile exists
ls repos/minibob/Dockerfile

# Verify Bun installation
docker run --rm contract-runner bun --version
```

### Performance Issues

**Symptom:** Contract validation takes too long

**Solution:**
```bash
# Profile execution
time ./scripts/run-contract-test.sh --spec ... --impl ...

# Check activity metrics
curl https://activity.metabob.com/v2/activities/templates/validate-spec-compliance \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.metrics.averageDuration'

# Optimize validation rules (reduce command executions)
# Use deterministic resolvers instead of LLM reasoning
```

## Next Steps

### Immediate Tasks

1. **Create Initial Test Fixtures:**
   - User authentication specification
   - Good/drift/fail implementations
   - Expected results for regression testing

2. **Build Sample Traces:**
   - Run contract validation 10-20 times
   - Export traces to test-fixtures/traces/
   - Analyze patterns manually

3. **Implement Trace Analyzer:**
   - Script to extract patterns from trace corpus
   - Generate activity variants based on patterns
   - Report Thompson Sampling statistics

### Medium-Term Goals

1. **Expand Fixture Coverage:**
   - API contracts, schema migrations, bugfix specs
   - Edge cases: ambiguous requirements, performance trade-offs
   - Complex contracts: multi-file validation, integration tests

2. **Automate Variant Generation:**
   - Ribosome pattern for contract activities
   - Automatic trailblazing on validation failures
   - Template repository for contract validators

3. **Dashboard Integration:**
   - Contract validation dashboard
   - Real-time trace visualization
   - Thompson Sampling metrics

### Long-Term Vision

1. **Self-Improving Validation:**
   - System learns from validation failures
   - Generates better contract validators over time
   - Thompson Sampling optimizes activity selection

2. **Closed-Loop Development:**
   - Specs compiled to activities automatically
   - Implementation validated against spec continuously
   - Drift detected and corrected autonomously

3. **Production Deployment:**
   - Contract enforcement in CI/CD pipeline
   - Real-time compliance monitoring
   - Automatic variant generation and testing

## Related Documentation

- `openspec/meta/validation-contracts.md` - Contract format specification
- `CLAUDE.md` - Development philosophy (MiniBob first, canary always)
- `repos/minibob/CLAUDE.md` - MiniBob development guidelines
- `repos/metabob-activity-api/CLAUDE.md` - Activity API integration
- `test-fixtures-structure.md` - Test fixtures organization
- `docker-compose.contract-testing.yml` - Environment configuration
- `run-contract-test.sh` - Test execution script

## Conclusion

This validation environment provides:

✅ **Fast Iteration:** Single command runs contract test, stores trace
✅ **Production Backend:** Traces feed learning immediately
✅ **Reproducible Setup:** Docker Compose isolates environment
✅ **Learning Integration:** Thompson Sampling updates in real-time
✅ **Regression Testing:** Expected results verify validation logic

Start with simple fixtures, run tests frequently, let the learning loop improve contract enforcement over time.
