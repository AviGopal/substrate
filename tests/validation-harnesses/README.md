# Validation Harnesses

This directory contains validation harnesses for high-priority specifications. Each harness is a standalone script that can verify a specification is correctly implemented without requiring LLM inference.

## Dual-Write Activity Metrics Harness

**File**: `dual-write-activity-metrics-harness.ts`

**Specification**: Activity execution metrics must be written to both Redis (fast cache with 7-day TTL) and SurrealDB (permanent storage) for Thompson Sampling optimization.

### Usage

```bash
# Run validation with activity execution
bun run tests/validation-harnesses/dual-write-activity-metrics-harness.ts hello-world-minimal

# Run validation without executing activity (validate existing data)
bun run tests/validation-harnesses/dual-write-activity-metrics-harness.ts hello-world-minimal --skip-execution

# Run with custom template
bun run tests/validation-harnesses/dual-write-activity-metrics-harness.ts add-rest-endpoint
```

### What It Validates

**Phase 1 (Current)**:
- ✅ JSON file exists at `~/.metabob/activities/{template_id}.json`
- ✅ JSON file has metrics (execution_count, success_rate)
- ✅ Redis key exists (tries multiple key patterns)
- ✅ Redis has metrics (success, duration, cost)
- ✅ Redis has TTL (~7 days)

**Phase 2 (Future)**:
- ⏳ SurrealDB record exists in `activity_execution` table
- ⏳ SurrealDB has complete metrics
- ⏳ SurrealDB record is permanent (no expiry)

### Pass/Fail Criteria

**Phase 1 Pass Criteria**:
- JSON file found with metrics
- Redis key found with metrics
- No errors

**Phase 2 Pass Criteria** (not yet enforced):
- Phase 1 criteria met
- SurrealDB record found with metrics
- SurrealDB record has no expiry

### Output Format

```
Dual-Write Activity Metrics Validation Harness
============================================================
Template ID: hello-world-minimal
Skip Execution: false

Executing activity: hello-world-minimal
Querying storage backends...

============================================================
VALIDATION RESULTS
============================================================

JSON File (Path A - MCP):
  Found: ✓
  Has Metrics: ✓
  Execution Count: 5
  Success Rate: 1.0

Redis (Path B - MetabobCLI):
  Found: ✓
  Has Metrics: ✓
  Has TTL: ✓
  TTL: 6.98 days

SurrealDB (Path C - Not Implemented):
  Found: ✗
  Has Record: ✗
  Is Permanent: ✗

Warnings:
  ⚠ SurrealDB not implemented yet (Phase 2) - Path C (SurrealDB write) not active

============================================================
RESULT: PASS ✓
============================================================
```

### Test Cases

**Case 1: Successful Activity Execution Dual-Write**
- Input: `{ templateId: "hello-world-minimal", skipExecution: false }`
- Expected: JSON and Redis both have metrics, warnings about SurrealDB
- Impulse ID: `validation-dual-write-activity-metrics-case-1`

**Case 2: Validate Existing Execution**
- Input: `{ templateId: "hello-world-minimal", skipExecution: true }`
- Expected: JSON and Redis both have metrics from previous execution
- Impulse ID: `validation-dual-write-activity-metrics-case-2`

**Case 3: Failed Activity Execution**
- Input: `{ templateId: "intentionally-failing-activity", skipExecution: false }`
- Expected: Failure metrics recorded in both JSON and Redis
- Impulse ID: `validation-dual-write-activity-metrics-case-3`

### Integration with CI/CD

```bash
# Add to CI pipeline
bun run tests/validation-harnesses/dual-write-activity-metrics-harness.ts hello-world-minimal
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "Dual-write validation PASSED"
else
  echo "Dual-write validation FAILED"
  exit 1
fi
```

### Troubleshooting

**Redis not found**:
- Check Redis is running: `redis-cli ping`
- Check backend API is running and writing to Redis
- Check key patterns in harness match backend implementation

**JSON file not found**:
- Check MCP backend is configured and running
- Check `~/.metabob/activities/` directory exists
- Check activity actually executed (not just planned)

**TTL not set**:
- Check backend API adds `EXPIRE` command after Redis write
- Default should be 7 days (604800 seconds)

**SurrealDB warnings**:
- Expected in Phase 1 - SurrealDB integration is Phase 2
- Warnings don't cause test to fail
