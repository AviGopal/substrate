# Validation Harnesses

LLM-free validation tests for OpenCode implementations. Each harness is a standalone TypeScript module that can run validation without requiring LLM calls.

## Purpose

These harnesses enable:
- **Regression Testing**: Run tests after code changes to verify nothing broke
- **CI/CD Integration**: Automated testing in pipelines
- **Performance Testing**: Measure execution time and resource usage
- **Historical Validation**: Test cases stored as impulses can be replayed anytime

## Structure

Each harness follows this pattern:

```typescript
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  // 1. Load application/component
  // 2. Feed in test inputs
  // 3. Capture actual outputs
  // 4. Compare against expected outputs
  // 5. Return PASS/FAIL
}
```

## Available Harnesses

### user-authentication-login-flow-fix-harness.ts

**Purpose**: Validates end-to-end authentication flow from user creation to dashboard access.

**Stages**:
1. User creation via CLI
2. Database verification (SurrealDB query)
3. Login endpoint validation (HTTP POST)
4. JWT token validation
5. Protected route access (/cloud/activity)
6. Playwright end-to-end test

**Usage**:
```bash
# Install dependencies
npm install

# Run validation
npm run test:auth

# Or directly
ts-node user-authentication-login-flow-fix-harness.ts
```

**Test Cases**:
- Case 1: Standard user login flow (demo@metabob.com)
- Case 2: Member role user login
- Case 3: Invalid password rejection (401 expected)
- Case 4: Non-existent user rejection (401 expected)

**Expected Output**:
```
=== VALIDATION RESULTS ===
Overall: PASS ✅

Stage Results:
  userCreation: PASS ✅ - User created successfully
  databaseVerification: PASS ✅ - User found in database
  loginEndpoint: PASS ✅ - Login endpoint returned valid response
  jwtValidation: PASS ✅ - JWT token structure valid
  protectedRoute: PASS ✅ - Protected route accessible with JWT
  playwrightE2E: PASS ✅ - Playwright E2E test passed
```

## Environment Setup

### Prerequisites

1. **Kubernetes cluster** with deployed services:
   - metabob-rpc-api (namespace: metabob)
   - metabob-dashboard (accessible at devbob.metabob.local)
   - SurrealDB (accessible via rpc-api pod)

2. **kubectl** configured with access to cluster

3. **Node.js** 18+ with npm

4. **Port forwards** (if running locally):
   ```bash
   kubectl port-forward -n metabob svc/metabob-rpc-api 8080:8080
   ```

### Configuration

Test cases are defined in `user-authentication-login-flow-fix-test-cases.json`. Update URLs and namespace as needed:

```json
{
  "rpcApiUrl": "http://localhost:8080",
  "dashboardUrl": "http://devbob.metabob.local",
  "namespace": "metabob"
}
```

## Impulse Integration

Test cases are stored as impulses for historical validation:

```typescript
// Load impulse
const impulse = await impulseManager.get('validation-user-authentication-login-flow-fix-case-1');
const testCase = impulse.pointer.content;

// Run validation
const result = await runValidation(testCase.input);

// Compare
assert(result.pass === testCase.expectedOutput.allStagesPassed);
```

## CI/CD Integration

Add to your pipeline:

```yaml
test:
  script:
    - cd tests/validation-harnesses
    - npm install
    - npm run test:auth
  artifacts:
    when: always
    paths:
      - screenshots/
    reports:
      junit: test-results.xml
```

## Troubleshooting

### "Pod not found" error
- Check namespace is correct
- Verify pod is running: `kubectl get pods -n metabob`
- Update pod name pattern in harness if deployment changed

### "Connection refused" on localhost:8080
- Ensure port-forward is active
- Or update rpcApiUrl to use cluster service name

### "User already exists" error
- Delete test users between runs:
  ```bash
  kubectl exec -n metabob metabob-rpc-api-XXX -- python -c "
  import asyncio
  from server.db.surrealdb_client import get_surreal_client
  db = asyncio.run(get_surreal_client())
  asyncio.run(db.query('DELETE FROM users WHERE email = \"validation-test@metabob.com\"'))
  "
  ```

### Playwright browser launch fails
- Install Playwright browsers: `npx playwright install`
- Run in headless mode (default)
- Check dashboard URL is accessible

## Best Practices

1. **Idempotent tests**: Each run should clean up after itself
2. **Isolated test data**: Use unique emails/IDs per test case
3. **Fail fast**: Stop at first failure for faster feedback
4. **Comprehensive logging**: Log each stage result for debugging
5. **Screenshot on failure**: Capture UI state when Playwright tests fail

## Adding New Harnesses

1. Create new harness file: `my-feature-harness.ts`
2. Implement `runValidation(input): Promise<ValidationOutput>`
3. Define test cases in `my-feature-test-cases.json`
4. Add to `package.json` scripts
5. Document in this README

## License

MIT
