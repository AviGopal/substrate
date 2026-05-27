# External Validation Guide

> **Status (2026-05-27).** The `external-validation` resolver pattern described here predates the failure-mode taxonomy (migration 091, `FailureModeSchema`). The current canonical failure model is `verifier_negative` / `budget_exhausted` / `safety_breach` / `cascading` / `user_abort` — see `openspec/changes/2026-04-26-validators-and-failure-modes/`. Use this guide for the error-type taxonomy, retry-strategy guidance, and validation-as-resolver pattern; treat the Thompson Sampling penalty weight tables as directionally correct but not wired through the current `writeImpulseRelevancePenalty` / `propagateCreditAlongChain` paths.
>
> **Foundation alignment.** A "validator" in the corrected foundation model is a derived primitive: a resolver whose output impulse has shape `validation_result`. The "external-validation" resolver below is one such resolver. Thompson Sampling is now production-active (activity-api 1.20.9+); the weighted-penalty mechanism below is aspirational — the live path applies stratified β updates via the failure-mode taxonomy, not the 13-category weight table.

## Overview

External validation enables activities to validate outputs against real external systems (databases, APIs, test suites) instead of just internal pattern matching. This closes the 25% gap between internal validation success and external reality.

## The Problem

Activities currently validate outputs using pattern matching:

```typescript
// Internal validation (pattern-only)
validation: {
  requiredPatterns: ["CREATE TABLE", "PRIMARY KEY"],
  forbiddenPatterns: ["DROP DATABASE"]
}
```

**Problem**: Code passes internal validation but fails when executed:
- SQL syntax is valid but violates schema constraints
- API request is well-formed but authentication fails
- Tests are written but don't pass

Result: Thompson Sampling thinks template works, but users experience failures.

## The Solution

External validation executes validations against real systems:

```typescript
// External validation (actual execution)
{
  id: "validate-sql",
  resolver: "external-validation",
  config: {
    validationType: "database",
    dbType: "postgres",
    connectionString: "${DATABASE_URL}",
    dryRun: true
  }
}
```

**Result**: Template only succeeds if output actually works in the real world.

## Five Validation Types

### 1. Database Validation

Validates SQL against a database using dry-run mode.

```json
{
  "id": "validate-migration",
  "resolver": "external-validation",
  "resolverRequirements": {
    "resolver": "external-validation",
    "config": {
      "validationType": "database",
      "dbType": "postgres",
      "connectionString": "${DATABASE_URL}",
      "dryRun": true,
      "timeout": 5000
    }
  }
}
```

**Supported databases**: `postgres`, `mysql`, `sqlite`, `surreal`

**What it checks**:
- SQL syntax validity
- Schema compatibility (table/column existence)
- Constraint violations (foreign keys, unique constraints)
- Data type compatibility

**Error types**:
- `syntax_error` - Invalid SQL syntax
- `constraint_violation` - Foreign key/unique constraint issues
- `schema_violation` - Referenced table/column doesn't exist
- `auth_failure` - Permission denied
- `timeout` - Query took too long
- `connection_error` - Can't connect to database

### 2. API Validation

Validates API requests by making actual HTTP calls.

```json
{
  "id": "test-api-request",
  "resolver": "external-validation",
  "resolverRequirements": {
    "resolver": "external-validation",
    "config": {
      "validationType": "api",
      "endpoint": "${API_BASE_URL}/users",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer ${API_TOKEN}"
      },
      "expectedStatus": 201,
      "expectedPatterns": [
        "\"id\":",
        "\"created_at\":"
      ],
      "timeout": 10000
    }
  }
}
```

**What it checks**:
- HTTP status code matches expected
- Response body matches patterns
- Authentication/authorization works
- API contract compliance

**Error types**:
- `auth_failure` - 401 Unauthorized
- `permission_denied` - 403 Forbidden
- `not_found` - 404 Not Found
- `rate_limit` - 429 Too Many Requests
- `invalid_response` - Response doesn't match expected patterns
- `timeout` - Request took too long
- `connection_error` - Network failure

### 3. Test Suite Validation

Runs test commands and parses results.

```json
{
  "id": "run-tests",
  "resolver": "external-validation",
  "resolverRequirements": {
    "resolver": "external-validation",
    "config": {
      "validationType": "test_suite",
      "command": "bun test src/auth.test.ts",
      "framework": "bun",
      "minimumPassed": 5,
      "timeout": 30000
    }
  }
}
```

**Supported frameworks**: `jest`, `pytest`, `bun`, `mocha`, `vitest`, `generic`

**What it checks**:
- Tests execute successfully
- Minimum number of tests pass
- No test failures
- Coverage thresholds (optional)

**Error types**:
- `tests_failed` - One or more tests failed
- `test_failure` - Individual test failure
- `test_execution_error` - Test command failed to run

### 4. Command Validation

Executes shell commands and checks exit codes.

```json
{
  "id": "run-lint",
  "resolver": "external-validation",
  "resolverRequirements": {
    "resolver": "external-validation",
    "config": {
      "validationType": "command",
      "command": "eslint src/",
      "expectedOutput": "0 errors",
      "retriable": false,
      "timeout": 10000
    }
  }
}
```

**What it checks**:
- Command exits with 0
- Output matches expected string (optional)

**Error types**:
- `command_failed` - Non-zero exit code

### 5. Script Validation

Runs custom validation scripts.

```json
{
  "id": "custom-validation",
  "resolver": "external-validation",
  "resolverRequirements": {
    "resolver": "external-validation",
    "config": {
      "validationType": "script",
      "scriptPath": "./scripts/validate-security.sh",
      "args": ["--strict", "--output=json"],
      "retriable": false,
      "timeout": 60000
    }
  }
}
```

**What it checks**:
- Script exits with 0
- Custom validation logic (implemented in script)

**Error types**:
- `script_failed` - Script returned non-zero exit code

## Error Classification

External validation errors are classified by:

### 1. Error Type

14 error types across all validation types:

| Error Type | Description | Example |
|------------|-------------|---------|
| `syntax_error` | Invalid syntax | SQL parse error |
| `constraint_violation` | Database constraint violated | Foreign key mismatch |
| `schema_violation` | Schema incompatibility | Table doesn't exist |
| `auth_failure` | Authentication failed | 401 Unauthorized |
| `permission_denied` | Authorization failed | 403 Forbidden |
| `not_found` | Resource not found | 404 Not Found |
| `rate_limit` | Rate limit exceeded | 429 Too Many Requests |
| `timeout` | Operation timed out | Query timeout |
| `connection_error` | Network/connection issue | Can't connect |
| `server_error` | External service error | 500 Internal Server Error |
| `invalid_response` | Response doesn't match expected | Missing required field |
| `tests_failed` | Test suite had failures | 3 tests failed |
| `command_failed` | Command returned non-zero | Exit code 1 |
| `missing_input` | Required input not provided | No SQL query impulse |

### 2. Retriability

Determines if error can be retried:

**Retriable** (transient errors):
- `timeout`
- `connection_error`
- `rate_limit` (with backoff)
- `server_error`

**Non-retriable** (permanent errors):
- `syntax_error`
- `constraint_violation`
- `auth_failure`
- `tests_failed`

### 3. Failure Category

13 categories for weighted Thompson Sampling:

| Category | Weight | Description | Examples |
|----------|--------|-------------|----------|
| `code_quality` | 0.8 | Syntax/linting errors | Syntax error, lint failure |
| `schema_mismatch` | 0.9 | Database schema issues | Missing table, constraint violation |
| `auth` | 0.5 | Authentication failures | 401, 403 errors |
| `resource` | 0.6 | Resource not found | 404 errors |
| `rate_limit` | 0.2 | Rate limiting | 429 errors |
| `timeout` | 0.3 | Timeouts | Query timeout |
| `network` | 0.1 | Network issues | Connection refused |
| `external_service` | 0.4 | External service down | 500 errors |
| `contract_violation` | 0.7 | API contract mismatch | Missing response field |
| `behavior` | 0.85 | Test failures | Tests explicitly failed |
| `environment` | 0.3 | Environment issues | Test command not found |
| `execution` | 0.5 | Command execution errors | Script failed |
| `input` | 0.6 | Missing/invalid input | No SQL query provided |

**Higher weight** = stronger penalty in Thompson Sampling (template is worse)

**Lower weight** = weaker penalty (may be environment issue, not template's fault)

## Integration with Activity Execution

### Option 1: Separate Validation Task (Recommended)

Add external validation as an explicit task after generation:

```json
{
  "tasks": [
    {
      "id": "generate-sql",
      "resolver": "llm",
      "description": "Generate SQL migration",
      "validation": {
        "requiredPatterns": ["CREATE TABLE"]
      }
    },
    {
      "id": "validate-sql",
      "resolver": "external-validation",
      "description": "Validate SQL against database",
      "impulseReferences": ["task-generate-sql-output"],
      "resolverRequirements": {
        "resolver": "external-validation",
        "config": {
          "validationType": "database",
          "dbType": "postgres",
          "connectionString": "${DATABASE_URL}",
          "dryRun": true
        }
      }
    }
  ]
}
```

**Benefits**:
- Clear separation of internal vs external validation
- External validation can be retried independently
- Easier to debug validation failures
- Execution traces show exactly where validation happened

### Option 2: Post-Task Hook (Alternative)

Add `externalValidation` field to task (future enhancement):

```json
{
  "id": "generate-sql",
  "resolver": "llm",
  "validation": {
    "requiredPatterns": ["CREATE TABLE"]
  },
  "externalValidation": {
    "validationType": "database",
    "dbType": "postgres",
    "connectionString": "${DATABASE_URL}",
    "dryRun": true
  }
}
```

**Note**: Option 2 requires activity executor changes (not yet implemented).

## Thompson Sampling Integration

### Differentiated Feedback

Backend tracks internal vs external validation separately:

```typescript
// After activity execution
{
  internal_validation_passed: true,   // Pattern matching succeeded
  external_validation_passed: false,  // But database rejected SQL
  external_error_type: "constraint_violation",
  external_failure_category: "schema_mismatch"
}
```

### Weighted Penalties

Thompson Sampling applies weighted penalties based on failure category:

```typescript
if (external_validation_failed) {
  const weight = CATEGORY_WEIGHTS[failureCategory] || 0.5
  beta += weight
}

// Examples:
// schema_mismatch → beta += 0.9 (very strong penalty)
// timeout → beta += 0.3 (weak penalty)
// network → beta += 0.1 (very weak penalty)
```

### Success Criteria

Activity only succeeds if BOTH validations pass:

```typescript
const success = internal_validation_passed && external_validation_passed
```

**Result**: Templates that produce valid-looking but non-functional output get penalized.

## Retry Strategies

### Simple Retry

Retry on failure up to max attempts:

```json
{
  "retry": {
    "maxAttempts": 3,
    "strategy": "simple"
  }
}
```

**Use when**: Transient errors (timeout, connection) might resolve

### Progressive Context Retry

Add failure details to context on retry:

```json
{
  "retry": {
    "maxAttempts": 2,
    "strategy": "progressive-context"
  }
}
```

**Use when**: LLM can fix the issue given error details (test failures, validation errors)

### No Retry

Fail immediately:

```json
{
  "retry": {
    "maxAttempts": 1
  }
}
```

**Use when**: Error won't fix itself (schema mismatch, syntax error)

## Example Workflows

### SQL Migration with Validation

```
1. Analyze schema → LLM
2. Generate SQL → LLM (internal validation: pattern check)
3. Validate syntax → External validation (database dry-run)
4. Save migration → File resolver

If validation fails:
  - Classify error (e.g., constraint_violation)
  - Categorize (schema_mismatch)
  - Thompson: beta += 0.9
  - Create variant with schema awareness
```

### API Request with Authentication

```
1. Generate request → LLM (internal validation: JSON syntax)
2. Test API call → External validation (actual HTTP request)
3. Process response → LLM

If validation fails (401):
  - Classify error (auth_failure)
  - Categorize (auth)
  - Thompson: beta += 0.5
  - May be env-specific (weaker penalty)
```

### Feature Implementation with Tests

```
1. Write tests → LLM
2. Implement feature → LLM (internal validation: no console.log)
3. Run tests → External validation (test suite)
4. Run lint → External validation (command)

If tests fail:
  - Classify error (tests_failed)
  - Categorize (behavior)
  - Thompson: beta += 0.85
  - Retry with failure details in context
```

## Configuration

### Environment Variables

External validation often requires environment-specific configuration:

```bash
DATABASE_URL=postgresql://user:pass@localhost/db
API_BASE_URL=https://api.service.com
API_TOKEN=secret-token
```

Use in activity templates:

```json
{
  "connectionString": "${DATABASE_URL}",
  "endpoint": "${API_BASE_URL}/users",
  "headers": {
    "Authorization": "Bearer ${API_TOKEN}"
  }
}
```

### Variables

Define required variables in activity template:

```json
{
  "variables": [
    {
      "name": "DATABASE_URL",
      "type": "string",
      "fromEnv": true,
      "description": "PostgreSQL connection string"
    }
  ]
}
```

## Dashboard Metrics

External validation adds new metrics to activity dashboard:

### Per-Template Metrics

- **Internal validation rate**: % of executions passing pattern checks
- **External validation rate**: % of executions passing external validation
- **Gap**: Difference between internal and external rates
- **Failure breakdown**: Count by failure category

### System-Wide Metrics

- **External validation adoption**: % of activities using external validation
- **Category distribution**: Histogram of failure categories
- **Retriability rate**: % of failures that are retriable
- **Thompson adjustment**: Average beta adjustment by category

## Migration Path

### Phase 1: Add External Validation to Existing Templates

Identify templates with low external success:

1. Check user feedback/manual testing results
2. Find templates where users report failures
3. Add external validation task

### Phase 2: Create Variants

When external validation fails:

1. System detects non-retriable failure
2. Creates variant with enhanced validation
3. Tracks variant lineage

### Phase 3: Tune Category Weights

Based on data:

1. Analyze which categories correlate with user satisfaction
2. Adjust weights in `CATEGORY_WEIGHTS`
3. Monitor Thompson Sampling accuracy

## Best Practices

### 1. Start with Internal, Add External

Don't skip internal validation:

```json
{
  "tasks": [
    {
      "id": "generate",
      "validation": {
        "requiredPatterns": ["..."]  // Fast internal check
      }
    },
    {
      "id": "validate",
      "resolver": "external-validation"  // Slower external check
    }
  ]
}
```

### 2. Use Dry-Run When Possible

For databases, use dry-run mode:

```json
{
  "dryRun": true  // Validate without executing
}
```

### 3. Set Appropriate Timeouts

External validation is slower:

```json
{
  "timeout": 10000  // 10 seconds for API calls
}
```

### 4. Mark Retriability Correctly

Help system know if retry makes sense:

```json
{
  "retriable": false  // Schema errors won't fix themselves
}
```

### 5. Use Progressive Context for Tests

Let LLM fix test failures:

```json
{
  "retry": {
    "strategy": "progressive-context"  // Add failure details to context
  }
}
```

## Troubleshooting

### External Validation Always Fails

**Check**:
1. Environment variables set? (`DATABASE_URL`, etc.)
2. Network connectivity to external service
3. Authentication credentials valid
4. Timeout set appropriately

### External Validation Always Passes

**Check**:
1. Validation actually executing? (check logs)
2. Expected patterns too loose?
3. Command returning 0 even on error?

### Thompson Sampling Not Improving

**Check**:
1. Enough executions? (need statistical significance)
2. Category weights appropriate?
3. External validation actually differentiating good/bad templates?

## Related Documentation

- [Validation Resolver Design](/tmp/validation-resolver-design.md) - Complete design document
- [IMPULSE_ACTIVITY_FOUNDATION.md](architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Core architecture
- [CLAUDE.md](../CLAUDE.md) - Development philosophy
