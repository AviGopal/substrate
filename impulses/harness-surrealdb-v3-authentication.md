# Validation Harness: surrealdb-v3-authentication

**Type**: Validation Harness  
**File**: tests/validation-harnesses/surrealdb-v3-authentication-harness.ts  
**Specification**: surrealdb-v3-authentication  
**Budget**: 2000 tokens  

---

## Purpose

Validates that Activity API successfully authenticates to SurrealDB v3.0.0 using proper scope-based credentials (NS/DB parameters in signin).

## Test Strategy

Multi-layer validation approach:

### Layer 1: Application Layer
- Templates endpoint returns HTTP 200 (not 500)
- Activity API logs show successful connection

### Layer 2: Database Layer
- SurrealDB logs show no authentication errors
- Direct SQL connection with NS/DB scope works

### Layer 3: Infrastructure Layer
- Credentials are properly rendered (not template placeholders)
- Namespace configuration is consistent

## Harness Features

- **Automated Port-Forward**: Sets up and tears down kubectl port-forward automatically
- **Multi-Layer Testing**: Tests application, database, and infrastructure layers
- **Detailed Diagnostics**: Provides actionable error messages for failures
- **Exit Codes**: 0=pass, 1=fail, 2=setup error
- **Log Analysis**: Checks Activity API and SurrealDB logs for success/error patterns
- **Direct Connection Test**: Validates authentication at protocol level with kubectl exec

## Prerequisites

1. Kubernetes cluster accessible via kubectl
2. SurrealDB pod running in activity-system namespace
3. Activity API pod running in activity-system namespace
4. Enforcement changes applied (signin() with NS/DB, namespace config fix)

## Usage

```bash
# Command line
ts-node tests/validation-harnesses/surrealdb-v3-authentication-harness.ts

# Programmatic
import { runValidation } from './tests/validation-harnesses/surrealdb-v3-authentication-harness';
const exitCode = await runValidation();
```

## Test Cases

1. **Templates Endpoint HTTP 200**: GET /v2/activities/templates returns HTTP 200
2. **Activity API Logs**: Logs show "Connected to SurrealDB successfully" with verified: true
3. **SurrealDB Logs**: No authentication rejection errors in server logs
4. **Direct Connection**: kubectl exec SQL query with NS/DB scope succeeds
5. **Namespace Config**: Configuration is consistent (activity-system)

## Success Criteria

All 5 test cases must pass. Critical tests: 1, 2, 4.

## Related Files

- Test Cases: `tests/validation-harnesses/surrealdb-v3-authentication-test-cases.json`
- README: `tests/validation-harnesses/surrealdb-v3-authentication-README.md`
- Trace: `impulses/trace-surrealdb-v3-authentication.md`
- Enforcement: `impulses/enforcement-surrealdb-v3-authentication.md`

## Historical Execution

This impulse represents a validation harness that can be run without LLM involvement. It captures the validation logic in executable form for future regression testing.
