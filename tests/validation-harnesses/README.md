# Validation Harnesses

This directory contains validation harnesses that test specifications without requiring an LLM.

## SurrealDB Learning Loop Integration Harness

**File**: `surrealdb-learning-loop-harness.sh`  
**Specification**: SurrealDB Learning Loop Integration  
**Test Cases**: `surrealdb-learning-loop-test-cases.json`

### What It Tests

This harness validates all 5 critical conditions for the learning loop:

1. **Persistent Storage** - Verifies SurrealDB has a volume mount (not memory-only)
2. **Authentication** - Checks for 401 errors and SurrealDB readiness
3. **API Server** - Confirms API server running on port 8080
4. **Schema Initialization** - Validates 5 tables exist with template_id field
5. **Dual-Write** - Tests both Redis and SurrealDB receive execution data
6. **Data Persistence** - Verifies data survives container restart

### Usage

```bash
# Run all tests
./tests/validation-harnesses/surrealdb-learning-loop-harness.sh

# Exit codes:
#   0 = All tests passed
#   1 = One or more tests failed
```

### Output Format

Color-coded results with detailed failure information:

```
✓ PASS: Test 1: Persistent storage - Volume mounted at /data
✗ FAIL: Test 2: Authentication
  Details: Found 3 recent 401 errors in API logs
```

### Features

- ✅ **No LLM Required** - Pure shell script validation
- ✅ **Historical Replay** - Can run against any environment state
- ✅ **Automatable** - Exit codes enable CI/CD integration
- ✅ **Container Aware** - Handles multiple container naming patterns
- ✅ **Comprehensive** - Tests all spec requirements end-to-end
