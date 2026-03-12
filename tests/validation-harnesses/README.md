# Validation Harnesses

This directory contains automated validation harnesses for testing specification compliance without requiring LLM execution.

## metabob-cli-to-dashboard-e2e-data-flow-harness.ts

**Specification**: metabob-cli-to-dashboard-e2e-data-flow  
**Purpose**: Validate complete E2E data flow from metabob-cli to dashboard  
**Test Cases**: 6 (V1-V6)

### Test Coverage

| Test | Description | Validates |
|------|-------------|-----------|
| V1 | CLI Project Registration | POST /auth/orgs/{org_id}/projects endpoint |
| V2 | Session-Project Linking | POST /v2/submit with project_id |
| V3 | SurrealDB Problem Persistence | Problems persist with correct schema |
| V4 | Dashboard Problem Query | GET /auth/orgs/{org_id}/projects/{project_id}/problems |
| V5 | Temporal Tracking | ORDER BY created_at DESC works |
| V6 | Stats Updates | Project stats update correctly |

### Usage

#### Standalone Execution

```bash
# Set required environment variables
export TEST_ORG_ID="your-org-uuid"
export JWT_TOKEN="your-jwt-token"
export RPC_API_URL="http://localhost:8000"

# Optional: SurrealDB configuration
export SURREALDB_URL="http://localhost:8000"
export SURREALDB_NS="test"
export SURREALDB_DB="test"

# Run validation
cd /path/to/metabob-devbob
npx ts-node tests/validation-harnesses/metabob-cli-to-dashboard-e2e-data-flow-harness.ts
```

#### Programmatic Usage

```typescript
import { runValidation } from './tests/validation-harnesses/metabob-cli-to-dashboard-e2e-data-flow-harness';

const config = {
  rpcApiUrl: 'http://localhost:8000',
  surrealDbUrl: 'http://localhost:8000',
  surrealDbNamespace: 'test',
  surrealDbDatabase: 'test',
  testOrgId: 'your-org-uuid',
  jwtToken: 'your-jwt-token'
};

const result = await runValidation(config);

console.log(`Pass: ${result.pass}`);
console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);
console.log(`Failed: ${result.summary.failed}`);
console.log(`Duration: ${result.summary.duration}ms`);

// Access individual test results
result.results.forEach(r => {
  console.log(`${r.testCase}: ${r.pass ? 'PASS' : 'FAIL'}`);
  if (!r.pass) {
    console.log(`  Error: ${r.error}`);
    console.log(`  Expected:`, r.expected);
    console.log(`  Actual:`, r.actual);
  }
});
```

### Output Format

```json
{
  "pass": true,
  "results": [
    {
      "pass": true,
      "testCase": "V1: CLI Project Registration",
      "actual": {
        "hasProjectId": true,
        "hasOrgId": true,
        "nameMatches": true,
        "project_id": "uuid"
      },
      "expected": {
        "hasProjectId": true,
        "hasOrgId": true,
        "nameMatches": true
      },
      "duration": 250
    }
  ],
  "summary": {
    "total": 6,
    "passed": 6,
    "failed": 0,
    "duration": 15000
  }
}
```

### Exit Codes

- `0`: All tests passed
- `1`: One or more tests failed or validation error

### Dependencies

```bash
npm install axios form-data
# or
yarn add axios form-data
```

### Test Case Impulses

Each test case has a corresponding impulse with expected inputs/outputs:

- `validation-metabob-cli-to-dashboard-e2e-data-flow-case-1` (V1)
- `validation-metabob-cli-to-dashboard-e2e-data-flow-case-2` (V2)
- `validation-metabob-cli-to-dashboard-e2e-data-flow-case-3` (V3)
- `validation-metabob-cli-to-dashboard-e2e-data-flow-case-4` (V4)
- `validation-metabob-cli-to-dashboard-e2e-data-flow-case-5` (V5)
- `validation-metabob-cli-to-dashboard-e2e-data-flow-case-6` (V6)

### Harness Impulse

The harness itself is tracked via impulse:
- `harness-metabob-cli-to-dashboard-e2e-data-flow`

### Integration with CI/CD

```yaml
# .github/workflows/e2e-validation.yml
name: E2E Validation

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - name: Run E2E Validation
        env:
          TEST_ORG_ID: ${{ secrets.TEST_ORG_ID }}
          JWT_TOKEN: ${{ secrets.JWT_TOKEN }}
          RPC_API_URL: ${{ secrets.RPC_API_URL }}
        run: |
          npx ts-node tests/validation-harnesses/metabob-cli-to-dashboard-e2e-data-flow-harness.ts
```

### Troubleshooting

**V1 Fails**: Check JWT token validity and org_id  
**V2 Fails**: Verify /v2/submit endpoint accepts multipart/form-data  
**V3 Fails**: Ensure Celery worker is running and SurrealDB is accessible  
**V4 Fails**: Verify GET /auth/orgs/{org_id}/projects/{project_id}/problems endpoint exists  
**V5 Fails**: Check temporal ordering in SurrealDB query (ORDER BY created_at DESC)  
**V6 Fails**: Verify project stats are updated via project_ops.update_project_stats  

### Historical Context

These test cases are **HISTORICAL** and can be run without LLM:
- Input/output expectations are stored in impulses
- Validation logic is deterministic (no LLM required)
- Can be executed in CI/CD pipelines
- Provides regression testing for specification compliance
