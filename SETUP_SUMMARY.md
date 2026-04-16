# Contract Validation Environment - Setup Summary

## What Was Created

Four files have been created to set up the contract enforcement testing environment:

### 1. docker-compose.contract-testing.yml
**Location:** `/tmp/docker-compose.contract-testing.yml`

**Purpose:** Docker Compose configuration for isolated contract testing environment

**Key Features:**
- `contract-runner` service: MiniBob instance configured for contract testing
- `trace-analyzer` service: Analyzes collected traces (profile: analysis)
- Uses production backend (activity.metabob.com) not local SurrealDB
- Mounts test fixtures, workspace, activities, and output directories
- Fast iteration: rebuild/rerun quickly

**Usage:**
```bash
# Interactive REPL
docker-compose -f docker-compose.contract-testing.yml run contract-runner

# Single goal
docker-compose -f docker-compose.contract-testing.yml run contract-runner \
  --single "validate contract for user-auth spec"

# Trace analysis
docker-compose -f docker-compose.contract-testing.yml run --profile=analysis trace-analyzer
```

---

### 2. test-fixtures-structure.md
**Location:** `/tmp/test-fixtures-structure.md`

**Purpose:** Documentation for test fixtures organization

**Key Sections:**
- Directory structure (specifications, implementations, traces, expected-results)
- Specification format (OpenSpec requirements)
- Implementation categories (good/drift/fail)
- Trace corpus management
- Fixture creation workflow
- Maintenance guidelines

**Directory Structure:**
```
test-fixtures/
├── specifications/       # OpenSpec documents
├── implementations/      # Code under test (good/drift/fail)
├── traces/              # Historical execution traces
└── expected-results/    # Pre-computed compliance reports
```

---

### 3. run-contract-test.sh
**Location:** `/tmp/run-contract-test.sh`

**Purpose:** Single-command script to run contract validation and collect traces

**Key Features:**
- Takes spec path and implementation path as input
- Executes MiniBob with contract validation activity
- Stores trace to production backend automatically
- Fetches compliance report from backend
- Optional verification against expected results
- Comprehensive error handling and logging

**Usage:**
```bash
# Basic validation
./run-contract-test.sh \
  --spec test-fixtures/specifications/user-auth.md \
  --impl test-fixtures/implementations/user-auth/good

# Verify expected result
./run-contract-test.sh \
  --spec test-fixtures/specifications/user-auth.md \
  --impl test-fixtures/implementations/user-auth/good \
  --verify-expected test-fixtures/expected-results/user-auth-good.json

# Custom activity
./run-contract-test.sh \
  --activity validate-performance-contract \
  --spec specs/api-latency.md \
  --impl src/api/
```

---

### 4. contract-validation-setup.md
**Location:** `/tmp/contract-validation-setup.md`

**Purpose:** Comprehensive setup and usage guide

**Key Sections:**
- Architecture overview and design decisions
- Component descriptions (Docker services, test fixtures, scripts)
- Setup instructions (prerequisites, installation)
- Usage examples (quick start, Docker workflow, regression testing)
- Learning loop integration (how traces feed Thompson Sampling)
- Iteration workflow (create activity → test → collect traces → analyze)
- Troubleshooting guide
- Next steps (immediate tasks, medium-term goals, long-term vision)

**Key Design Decisions:**
1. Production backend only (activity.metabob.com)
2. Docker Compose for isolation
3. Test fixtures as training data
4. Fast feedback loop (single command)

---

### 5. sample-user-auth-spec.md (BONUS)
**Location:** `/tmp/sample-user-auth-spec.md`

**Purpose:** Example OpenSpec specification demonstrating the validation-contracts.md format

**What It Shows:**
- Complete metadata section (spec_id, version, status, category)
- Functional requirements (5 testable requirements)
- Performance requirements (cost/duration/quality thresholds)
- Validation rules (required files, patterns, forbidden patterns, commands)
- Drift thresholds (0% functional, ±20% cost, ±10% duration)
- Examples (successful/failed login, protected routes)
- Test cases (7 minimum tests)

**Use As:**
- Template for creating new specifications
- Reference for OpenSpec format
- Sample fixture for initial testing

---

## Next Steps

### 1. Install Files in Repository

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Docker Compose
cp /tmp/docker-compose.contract-testing.yml .

# Test fixtures documentation
mkdir -p test-fixtures
cp /tmp/test-fixtures-structure.md test-fixtures/README.md

# Quick-start script
mkdir -p scripts
cp /tmp/run-contract-test.sh scripts/
chmod +x scripts/run-contract-test.sh

# Setup guide
cp /tmp/contract-validation-setup.md .

# Sample specification (for initial testing)
mkdir -p test-fixtures/specifications
cp /tmp/sample-user-auth-spec.md test-fixtures/specifications/user-auth.md
```

### 2. Create Initial Test Fixtures

```bash
# Create directory structure
mkdir -p test-fixtures/{specifications,implementations,traces,expected-results}

# Create sample implementations
mkdir -p test-fixtures/implementations/user-auth/{good,drift,fail}

# TODO: Implement good/drift/fail cases based on user-auth.md spec
```

### 3. Verify Setup

```bash
# Set API keys
export METABOB_API_KEY="your-api-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# Test Docker Compose
docker-compose -f docker-compose.contract-testing.yml build

# Test script
./scripts/run-contract-test.sh --help

# Run first contract test (once fixtures are created)
./scripts/run-contract-test.sh \
  --spec test-fixtures/specifications/user-auth.md \
  --impl test-fixtures/implementations/user-auth/good
```

### 4. Start Collecting Traces

```bash
# Run contract tests frequently
# Each execution stores trace to activity.metabob.com
# Thompson Sampling learns from successes/failures
# Patterns extracted via ribosome

# Monitor learning progress
curl https://activity.metabob.com/v2/activities/templates/validate-spec-compliance \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.metrics'
```

## Key Configuration

### Environment Variables

```bash
# Required
export METABOB_API_KEY="your-metabob-api-key"
export ANTHROPIC_API_KEY="your-anthropic-api-key"

# Optional
export METABOB_ENDPOINT="https://activity.metabob.com"  # Default
export MINIBOB_PROVIDER="anthropic"  # Default
export MINIBOB_MODEL="claude-sonnet-4-20250514"  # Default
```

### User Config (~/.metabob/config.json)

```json
{
  "metabob": {
    "apiKey": "your-metabob-api-key",
    "endpoint": "https://activity.metabob.com"
  },
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." }
  },
  "defaults": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

## Learning Loop Flow

```
1. Create spec (OpenSpec format)
   ↓
2. Create implementations (good/drift/fail)
   ↓
3. Run contract test
   ./run-contract-test.sh --spec ... --impl ...
   ↓
4. MiniBob executes contract validation activity
   ↓
5. Trace stored to activity.metabob.com
   ↓
6. Thompson Sampling updated (α++ or β++)
   ↓
7. Patterns extracted (ribosome)
   ↓
8. Next execution: Better activity recommendation
   ↓
9. Repeat (continuous learning)
```

## Files Location Summary

All files are in `/tmp/`:

1. `docker-compose.contract-testing.yml` - Docker environment
2. `test-fixtures-structure.md` - Fixtures documentation
3. `run-contract-test.sh` - Test execution script
4. `contract-validation-setup.md` - Setup guide
5. `sample-user-auth-spec.md` - Example specification

**Action Required:** Copy files from `/tmp/` to repository locations (see "Install Files in Repository" above)

## Quick Reference

### Run Contract Test
```bash
./scripts/run-contract-test.sh \
  --spec test-fixtures/specifications/user-auth.md \
  --impl test-fixtures/implementations/user-auth/good
```

### Docker Interactive Mode
```bash
docker-compose -f docker-compose.contract-testing.yml run contract-runner
```

### Query Traces
```bash
curl https://activity.metabob.com/v2/activities/execution-traces \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{"activityId": "validate-spec-compliance", "limit": 10}'
```

### View Metrics
```bash
curl https://activity.metabob.com/v2/activities/templates/validate-spec-compliance \
  -H "Authorization: ApiKey $METABOB_API_KEY" | jq '.metrics'
```

## Success Criteria

✅ **Setup Complete When:**
- Docker Compose builds successfully
- run-contract-test.sh executes without errors
- First trace stored to activity.metabob.com
- Compliance report generated and displayed

✅ **Learning Loop Active When:**
- Multiple contract tests executed (10+ traces)
- Thompson Sampling metrics show α and β increasing
- Activity selection probability adapts based on success rate
- Patterns extracted from successful traces

✅ **System Improving When:**
- Success rate increases over time
- Average duration decreases
- Contract violations detected more reliably
- New activity variants generated from patterns

## Related Documentation

- `openspec/meta/validation-contracts.md` - Contract format specification
- `CLAUDE.md` - Development philosophy
- `repos/minibob/CLAUDE.md` - MiniBob guidelines
- `repos/metabob-activity-api/CLAUDE.md` - Activity API integration

---

**Ready to start collecting traces for contract enforcement learning!**
