# Validation Harness: Activity Template Scope Assignment

## Specification

When a user registers an activity template via `POST /v2/activities/templates` with `scope` and `org_id` fields in the JSON payload, the RPC API backend MUST extract these fields and persist them to SurrealDB.

### Requirements

1. Extract `scope` field from request body (default to 'org' if not provided)
2. Extract `org_id` from the authenticated user's Bearer token context
3. Store both fields in the `activity_templates` table in SurrealDB

### Expected Behavior

After registering a template with explicit `scope='org'`, querying `GET /v2/activities/templates/<template-id>` should return the template with:
- `scope='org'`
- `org_id='3135883c-8be3-4b2b-bdd8-dbe2e427358f'` (for devbob-test@local.dev)

## Test Cases

The harness validates 4 test scenarios:

### 1. Explicit Scope Assignment
- **Input**: Register template with explicit `scope='org'`
- **Expected**: Template stored with `scope='org'` and `org_id` from Bearer token
- **Validates**: Requirement #1 and #3

### 2. Default Scope Assignment
- **Input**: Register template WITHOUT scope field
- **Expected**: Template defaults to `scope='org'` and includes `org_id`
- **Validates**: Default behavior (requirement #1)

### 3. org_id Extraction from Bearer Token
- **Input**: Register template with Bearer token authentication
- **Expected**: `org_id='3135883c-8be3-4b2b-bdd8-dbe2e427358f'` extracted from token
- **Validates**: Requirement #2 and #3

### 4. Scope Persistence in Variants
- **Input**: Create multiple variants of same template with `scope='org'`
- **Expected**: Both variants have `scope='org'` persisted
- **Validates**: Scope field persists across template variants

## Usage

### Local Environment

```bash
cd tests/validation-harnesses
./run-activity-template-scope-assignment-validation.ts
```

### Kubernetes Environment

```bash
cd tests/validation-harnesses
K8S_ENV=true ./run-activity-template-scope-assignment-validation.ts
```

### Environment Variables

- `RPC_API_URL`: RPC API endpoint (default: `http://metabob-rpc-api:8080`)
- `BEARER_TOKEN`: Session token for authentication (default: devbob-test@local.dev token)
- `K8S_ENV`: Set to `true` for K8s execution via kubectl exec

## Files

- `activity-template-scope-assignment-harness.ts` - Main validation harness
- `run-activity-template-scope-assignment-validation.ts` - CLI runner
- `test-cases/activity-template-scope-assignment-test-cases.json` - Test case definitions
- `validation-results-activity-template-scope-assignment.json` - Output results (generated)

## Output Format

The harness returns a JSON result with:

```json
{
  "overallPass": boolean,
  "results": [
    {
      "pass": boolean,
      "testCase": "test-case-name",
      "actual": { ... },
      "expected": { ... },
      "error": "error message if failed",
      "details": "additional context"
    }
  ],
  "summary": {
    "total": number,
    "passed": number,
    "failed": number
  }
}
```

## Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed or harness error

## Integration with CI/CD

This harness can be integrated into pre-push quality gates:

```bash
# In pre-push hook
cd tests/validation-harnesses
./run-activity-template-scope-assignment-validation.ts || exit 1
```

## Troubleshooting

### Template Creation Fails

- Verify RPC API is running and accessible
- Check Bearer token is valid
- Ensure SurrealDB schema has `scope` and `org_id` fields defined

### scope or org_id is null

- Check the enforcement changes were applied:
  - `scripts/init-surrealdb-devbob-schema.sql` has scope and org_id fields
  - `repos/metabob-rpc-api/server/actions/activity.py` includes scope and org_id in template dict
  - `repos/metabob-rpc-api/server/routes/activity.py` extracts scope and org_id

### org_id doesn't match expected value

- The expected `org_id` is `3135883c-8be3-4b2b-bdd8-dbe2e427358f` for devbob-test@local.dev
- Verify Bearer token corresponds to this user
- Check `session_id_from_token()` utility is extracting the correct session ID

## Related Documentation

- Trace Analysis: `impulses/trace-activity-template-scope-assignment.md`
- Enforcement Summary: `impulses/enforcement-activity-template-scope-assignment.md`
- Specification: activity-template-scope-assignment

## Maintenance

When updating the specification or implementation:

1. Update test cases in `test-cases/activity-template-scope-assignment-test-cases.json`
2. Update expected outputs in harness code
3. Re-run validation to ensure continued compliance
4. Update this README if behavior changes
