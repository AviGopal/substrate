# Validation Harness: Dashboard Activity History Viewing Flow

## Overview

This validation harness implements a comprehensive 15-step validation suite for the Dashboard Activity History Viewing Flow specification. It validates the complete end-to-end flow from Kubernetes infrastructure through backend API to dashboard UI rendering.

## Features

- **15 Validation Steps**: Complete coverage of all specification requirements
- **Automated Testing**: 8 steps fully automated (infrastructure, API, authentication)
- **Manual Testing Guide**: 7 steps with clear manual testing procedures
- **Detailed Reporting**: Step-by-step results with pass/fail status and timing
- **Historical Test Cases**: Stored as impulses for reproducibility

## Quick Start

### Prerequisites

1. **Kubernetes Setup**:
   ```bash
   # Switch to docker-desktop context
   kubectx docker-desktop
   
   # Verify pods are running
   kubectl get pods -n metabob
   ```

2. **DNS Configuration** (`/etc/hosts`):
   ```
   127.0.0.1 app.metabob.local
   127.0.0.1 api.metabob.local
   ```

3. **Port Forwarding**:
   ```bash
   # Dashboard
   kubectl port-forward -n metabob svc/metabob-dashboard 3000:80 &
   
   # Backend API
   kubectl port-forward -n metabob svc/metabob-rpc-api 8081:8081 &
   
   # SurrealDB
   kubectl port-forward -n metabob svc/surrealdb 8000:8000 &
   ```

4. **Test User** (in SurrealDB):
   - Email: `test@example.com`
   - Password: `password`
   - Organization: `test-org`

### Running the Harness

#### Command Line
```bash
cd tests/validation-harnesses
npx ts-node Dashboard-Activity-History-Viewing-Flow-harness.ts
```

#### Programmatic
```typescript
import { runValidation } from './Dashboard-Activity-History-Viewing-Flow-harness';

const result = await runValidation({
  kubeContext: 'docker-desktop',
  namespace: 'metabob',
  dashboardUrl: 'http://app.metabob.local:3000',
  apiUrl: 'http://localhost:8081',
  testCredentials: {
    email: 'test@example.com',
    password: 'password'
  }
});

console.log(`Result: ${result.pass ? 'PASS' : 'FAIL'}`);
console.log(`Passed: ${result.summary.passed}/${result.summary.total}`);
console.log(`Failed: ${result.summary.failed}`);
console.log(`Skipped: ${result.summary.skipped}`);
```

## Validation Steps

### Automated Steps (8)

| Step | Name | Description |
|------|------|-------------|
| 1 | Infrastructure: Kubernetes Context | Verify `docker-desktop` context is active |
| 2 | Pod: Dashboard Pod Running | Verify `metabob-dashboard` pod is Running (1/1) |
| 3 | Service: Dashboard Service Valid | Verify dashboard service exists with valid type |
| 4 | DNS: /etc/hosts Entries | Verify DNS entries for app/api.metabob.local |
| 6 | Dashboard: HTTP Access | Verify dashboard responds to HTTP requests |
| 7 | Authentication: Login Success | Verify JWT token generation works |
| 8 | API: Activity List Schema | Verify API returns valid activity list schema |

### Manual Steps (7)

| Step | Name | Instructions |
|------|------|--------------|
| 5 | Port-Forward: Dashboard Access | Run `kubectl port-forward` commands (see prerequisites) |
| 9 | Activity: Execution Test | Execute test activity via OpenCode CLI |
| 10 | Data: SurrealDB Persistence | Query SurrealDB to verify activity record |
| 11 | Dashboard: Activity Display | Reload dashboard, verify activity appears |
| 12 | Dashboard: Detail Page Navigation | Click activity card, verify detail page |
| 13 | API: Activity Detail | Call `/api/activities/{id}` endpoint |
| 14 | Dashboard: Filtering | Test status filtering in UI |
| 15 | Integration: Multiple Activities | Execute 3 activities, verify all appear correctly |

## Test Cases (Impulses)

Test cases are stored as impulses for reproducibility:

1. **case-1**: Infrastructure validation (Kubernetes context)
2. **case-2**: Pod validation (Dashboard pod running)
3. **case-3**: API validation (Activity list schema)
4. **case-4**: Authentication validation (JWT token)
5. **case-5**: Integration validation (Multiple activities)

Each impulse contains:
- Test input parameters
- Expected output schema
- Pass/fail criteria

## Output Format

```json
{
  "pass": true,
  "steps": [
    {
      "stepNumber": 1,
      "name": "Infrastructure: Kubernetes Context",
      "status": "PASS",
      "message": "Kubernetes context 'docker-desktop' is active",
      "details": { ... },
      "duration": 123
    },
    ...
  ],
  "summary": {
    "total": 15,
    "passed": 8,
    "failed": 0,
    "skipped": 7
  },
  "actual": [ ... ],
  "expected": { ... }
}
```

## Pass Criteria

**Overall PASS** requires:
- All automated steps (1-4, 6-8) pass
- No failures in any step
- Manual steps completed successfully (verified by human operator)

**Overall FAIL** triggers:
- Any automated step fails
- Infrastructure not properly configured
- API returns invalid responses
- Authentication fails

## Troubleshooting

### Step 1 Fails (Kubernetes Context)
```bash
# List available contexts
kubectx

# Switch to docker-desktop
kubectx docker-desktop
```

### Step 2 Fails (Dashboard Pod)
```bash
# Check pod status
kubectl get pods -n metabob

# View logs
kubectl logs -n metabob deployment/metabob-dashboard --tail=50

# Restart pod if needed
kubectl rollout restart -n metabob deployment/metabob-dashboard
```

### Step 4 Fails (DNS)
```bash
# Add entries to /etc/hosts
sudo bash -c 'echo "127.0.0.1 app.metabob.local" >> /etc/hosts'
sudo bash -c 'echo "127.0.0.1 api.metabob.local" >> /etc/hosts'
```

### Step 6 Fails (Dashboard Access)
```bash
# Verify port-forward is running
ps aux | grep "port-forward"

# Restart port-forward
kubectl port-forward -n metabob svc/metabob-dashboard 3000:80 &

# Test access
curl -I http://app.metabob.local:3000
```

### Step 7 Fails (Authentication)
```bash
# Check API is running
curl http://localhost:8081/health

# Verify test user exists in SurrealDB
surreal sql --conn http://localhost:8000 --user root --pass root \
  --ns metabob --db main \
  "SELECT * FROM users WHERE email = 'test@example.com'"
```

### Step 8 Fails (Activity List API)
```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.token')

# Test endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8081/auth/orgs/test-org/activity
```

## Integration with CI/CD

### GitHub Actions Example
```yaml
name: Validate Dashboard Flow

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Kubernetes
        uses: helm/kind-action@v1
        
      - name: Deploy Metabob
        run: |
          kubectl apply -f k8s/
          kubectl wait --for=condition=ready pod -l app=metabob-dashboard -n metabob
      
      - name: Run Validation Harness
        run: |
          npm install
          npx ts-node tests/validation-harnesses/Dashboard-Activity-History-Viewing-Flow-harness.ts
      
      - name: Upload Results
        uses: actions/upload-artifact@v2
        with:
          name: validation-results
          path: validation-results.json
```

## Extending the Harness

### Adding New Validation Steps

1. Add step function:
```typescript
async function validateMyFeature(input: ValidationInput): Promise<StepResult> {
  const startTime = Date.now();
  
  try {
    // Perform validation
    const isValid = checkSomething();
    
    return {
      stepNumber: 16,
      name: 'My Feature: Validation',
      status: isValid ? 'PASS' : 'FAIL',
      message: 'Validation result message',
      details: { ... },
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      stepNumber: 16,
      name: 'My Feature: Validation',
      status: 'FAIL',
      message: `Error: ${error.message}`,
      details: { error: error.message },
      duration: Date.now() - startTime
    };
  }
}
```

2. Add to validation runner:
```typescript
console.log('\n[16/16] My Feature Validation...');
const step16 = await validateMyFeature(input);
steps.push(step16);
console.log(`  ${step16.status}: ${step16.message}`);
```

3. Create test case impulse:
```json
{
  "id": "validation-Dashboard_Activity_History_Viewing_Flow-case-6",
  "type": "memo",
  "pointer": {
    "type": "memo",
    "content": {
      "testCase": "My Feature Validation",
      "input": { ... },
      "expectedOutput": { ... }
    },
    "source": "validation harness extension"
  },
  ...
}
```

## References

- **Trace Documentation**: `docs/data-flows/Dashboard-Activity-History-Viewing-Flow-flow.md`
- **Enforcement Summary**: `ENFORCEMENT_SUMMARY_Dashboard_Activity_History.md`
- **Trace Impulse**: `impulses/trace-Dashboard_Activity_History_Viewing_Flow.json`
- **Enforcement Impulse**: `impulses/enforcement-Dashboard_Activity_History_Viewing_Flow.json`
- **Harness Impulse**: `impulses/harness-Dashboard_Activity_History_Viewing_Flow.json`

---

**Created**: 2026-03-05  
**Version**: 1.0  
**Maintainer**: OpenCode DevBob  
**Status**: Ready for Use
