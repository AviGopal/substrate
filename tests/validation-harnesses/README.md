# Validation Harnesses

This directory contains validation harnesses for testing specifications without LLM involvement. Each harness is a standalone script that can be run to verify implementation correctness.

## impulse-learning-storage-complete

**File**: `impulse-learning-storage-complete-harness.ts`

### Purpose

Validates the complete impulse learning storage infrastructure:
- POST /api/v1/learning-loop/record-turn endpoint
- Pattern extraction logic (file paths, line numbers)
- Quality calculation (success/failure, impulse usage)
- SurrealDB record creation and structure
- Duplicate detection (UPSERT behavior)

### Prerequisites

1. **RPC API running**: 
   ```bash
   cd repos/metabob-rpc-api
   python -m uvicorn server.main:app --host 0.0.0.0 --port 8001
   ```

2. **SurrealDB running**:
   ```bash
   surreal start --bind 0.0.0.0:8000 --user root --pass root memory
   ```

3. **Environment variables** (optional):
   ```bash
   export RPC_API_URL=http://localhost:8001
   export SURREALDB_URL=http://localhost:8000
   export SURREALDB_NAMESPACE=metabob
   export SURREALDB_DATABASE=learning_loop
   ```

### Running the Harness

```bash
# Install dependencies
npm install node-fetch surrealdb.js

# Run validation
ts-node tests/validation-harnesses/impulse-learning-storage-complete-harness.ts
```

### Test Cases

1. **case-1-simple-file-fix**: Basic file path and line number extraction
   - Input: "Fix the bug in src/auth.ts line 42"
   - Expected pattern: "fix the bug in {file0} line {num0}"
   - Expected quality: 1.0 (success + impulse used)

2. **case-2-multiple-files**: Multiple file path extraction
   - Input: "Refactor src/utils/parser.ts and tests/parser.test.ts to use async/await"
   - Expected pattern: "refactor {file0} and {file1} to use async/await"
   - Expected quality: 1.0

3. **case-3-failed-task**: Quality calculation for failed tasks
   - Input: "Add type annotations to database.py line 156"
   - Expected quality: 0.3 (failure base score, no bonus)

4. **case-4-no-impulses-used**: Quality when impulses not mentioned in response
   - Input: "Explain the authentication flow"
   - Expected quality: 0.6 (success, but no impulse usage detected)

5. **case-5-duplicate-detection**: UPSERT prevents duplicates
   - Input: "Update config.json with new settings"
   - Behavior: Submit twice, verify same record_id returned

### Expected Output

```
================================================================================
Validation Harness: impulse-learning-storage-complete
================================================================================
RPC API URL: http://localhost:8001
SurrealDB URL: http://localhost:8000
Test cases: 5

[case-1-simple-file-fix] Running test case...
  → Calling POST /api/v1/learning-loop/record-turn
  ✓ API responded: record_id=test_session_001_turn_1
  → Validating pattern extraction
  ✓ Pattern extraction correct
  → Validating quality score
  ✓ Quality score correct
  → Querying SurrealDB for record
  ✓ Record found in database
  → Validating record structure
  ✓ Record structure correct
  → Validating record field values
  ✓ All field values correct
[case-1-simple-file-fix] ✅ PASS

... (4 more test cases)

================================================================================
Summary
================================================================================
Total:  5
Passed: 5
Failed: 0
```

### Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

### Related Impulses

- **Harness**: `harness-impulse-learning-storage-complete`
- **Test cases**: `validation-impulse-learning-storage-complete-case-{1-5}`
- **Trace**: `trace-impulse-learning-storage-complete`
- **Enforcement**: `enforcement-impulse-learning-storage-complete`

### Troubleshooting

**API not reachable**:
```
Error: API call failed: 500 Internal Server Error
```
- Check RPC API is running on port 8001
- Verify SurrealDB is accessible

**Database connection failed**:
```
Error: Record not found in database
```
- Check SurrealDB is running on port 8000
- Verify namespace/database names match

**Pattern mismatch**:
```
Pattern mismatch:
  Expected: "fix the bug in {file0} line {num0}"
  Actual:   "fix the bug in src/auth.ts line 42"
```
- Pattern extraction logic not working correctly
- Check `normalize_pattern()` in `impulse_learning.py`

**Quality score mismatch**:
```
Quality score mismatch:
  Expected: 1.0
  Actual:   0.6
```
- Usage tracking not detecting impulse in response
- Check `track_usage()` in `impulse_learning.py`
