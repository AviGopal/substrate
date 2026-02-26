# Validation Harness: local-docker-desktop-deployment

## Purpose

Automated validation of Metabob service deployment to local docker-desktop kubernetes context.

## What It Validates

1. **Cluster Accessibility**: Verifies docker-desktop kubernetes cluster is running and accessible
2. **Helmfile Syntax**: Validates helmfile.yaml.gotmpl parses correctly with local environment
3. **Pod Health**: Monitors pods until all reach Running/Ready state
4. **Service Endpoints**: Verifies required services have registered endpoints
5. **Deployment Completeness**: Confirms all expected services are deployed

## Test Cases

### Case 1: Full Deployment Validation
- **ID**: `validation-local-docker-desktop-deployment-case-1`
- **Description**: Deploy all services and validate health
- **Expected Pods**: 5 (config, redis, metabob-rpc-api worker, metabob-rpc-api service, metabob-dashboard)
- **Expected Services**: 3 (redis, metabob-rpc-api, metabob-dashboard)
- **Max Wait**: 5 minutes

### Case 2: Syntax Validation Only
- **ID**: `validation-local-docker-desktop-deployment-case-2`
- **Description**: Validate helmfile parsing without deployment
- **Expected Pods**: 0 (no deployment check)
- **Expected Services**: 0 (no service check)
- **Max Wait**: 0 seconds

### Case 3: Minimal Deployment
- **ID**: `validation-local-docker-desktop-deployment-case-3`
- **Description**: Validate core services only (no istio)
- **Expected Pods**: 4 (config, redis, metabob-rpc-api x2, metabob-dashboard)
- **Expected Services**: 3 (redis, metabob-rpc-api, metabob-dashboard)
- **Max Wait**: 5 minutes

## Usage

### Prerequisites

1. Docker Desktop installed and running
2. Kubernetes enabled in Docker Desktop
3. kubectl context set to `docker-desktop`
4. Node.js and TypeScript installed

### Run Validation

```bash
# Run harness directly (uses test case 1 by default)
cd tests/validation-harnesses
ts-node local-docker-desktop-deployment-harness.ts

# Or compile and run
tsc local-docker-desktop-deployment-harness.ts
node local-docker-desktop-deployment-harness.js
```

### Programmatic Usage

```typescript
import { runValidation } from './local-docker-desktop-deployment-harness';

const testCase = {
  id: 'custom-test',
  description: 'Custom validation',
  input: {
    environment: 'local',
    context: 'docker-desktop',
    deploymentPath: 'repos/platform/deployments/metabob'
  },
  expectedOutput: {
    clusterAccessible: true,
    helmfileParses: true,
    podsRunning: 5,
    servicesWithEndpoints: 3,
    requiredServices: ['redis', 'metabob-rpc-api', 'metabob-dashboard'],
    maxWaitSeconds: 300
  }
};

const result = await runValidation(testCase);

if (result.pass) {
  console.log('✅ Validation PASSED');
} else {
  console.error('❌ Validation FAILED:', result.errors);
}
```

## Output Format

```json
{
  "pass": true,
  "actual": {
    "clusterAccessible": true,
    "helmfileParses": true,
    "deployed": true,
    "podsRunning": 5,
    "pods": [
      { "name": "config-abc123", "status": "Running", "ready": "1/1" },
      { "name": "redis-xyz789", "status": "Running", "ready": "1/1" },
      ...
    ],
    "servicesWithEndpoints": 3,
    "services": [
      { "name": "redis", "endpoints": "10.1.0.5:6379" },
      { "name": "metabob-rpc-api", "endpoints": "10.1.0.6:8080" },
      ...
    ]
  },
  "expected": {
    "clusterAccessible": true,
    "helmfileParses": true,
    "podsRunning": 5,
    "servicesWithEndpoints": 3,
    "requiredServices": ["redis", "metabob-rpc-api", "metabob-dashboard"],
    "maxWaitSeconds": 300
  },
  "errors": [],
  "summary": "Validation PASSED: All checks successful. 5 pods running, 3 services with endpoints."
}
```

## Integration with CI/CD

```yaml
# .github/workflows/validate-local-deployment.yml
name: Validate Local Deployment

on:
  push:
    branches: [main]
    paths:
      - 'repos/platform/deployments/metabob/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Kubernetes
        uses: engineerd/setup-kind@v0.5.0
      
      - name: Install Helmfile
        run: |
          wget https://github.com/helmfile/helmfile/releases/download/v1.2.3/helmfile_linux_amd64
          chmod +x helmfile_linux_amd64
          sudo mv helmfile_linux_amd64 /usr/local/bin/helmfile
      
      - name: Run Validation Harness
        run: |
          cd tests/validation-harnesses
          npm install -g typescript ts-node
          ts-node local-docker-desktop-deployment-harness.ts
```

## Troubleshooting

### Cluster Not Accessible

```bash
# Check docker-desktop cluster status
kubectl cluster-info --context docker-desktop

# If not running, start Docker Desktop and enable Kubernetes
# Open Docker Desktop → Settings → Kubernetes → Enable Kubernetes
```

### Helmfile Parsing Failed

```bash
# Test helmfile parsing
cd repos/platform/deployments/metabob
helmfile -e local list

# Expected output: List of 13 releases
# If error, check helmfile.yaml.gotmpl syntax
```

### Pods Not Ready

```bash
# Check pod status
kubectl get pods -n metabob

# View pod logs for errors
kubectl logs -n metabob <pod-name>

# Describe pod for events
kubectl describe pod -n metabob <pod-name>
```

### Services Without Endpoints

```bash
# Check endpoints
kubectl get endpoints -n metabob

# Check if pods have matching labels
kubectl get pods -n metabob --show-labels

# Verify service selectors
kubectl get svc -n metabob -o yaml
```

## Validation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Check Cluster Accessibility                             │
│    → kubectl cluster-info --context docker-desktop         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Validate Helmfile Syntax                                │
│    → helmfile -e local list                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Check Deployment Status                                 │
│    → kubectl get namespace metabob                         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Monitor Pod Status (up to 5 minutes)                   │
│    → kubectl get pods -n metabob (every 10 seconds)       │
│    → Wait for all pods: Running + Ready                   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Verify Service Endpoints                               │
│    → kubectl get endpoints -n metabob                      │
│    → Check required services have endpoints                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Return PASS/FAIL                                        │
│    → All checks passed: PASS                               │
│    → Any check failed: FAIL with error details             │
└─────────────────────────────────────────────────────────────┘
```

## Maintenance

### Updating Expected Values

If deployment configuration changes (e.g., new services added), update test case expected values:

```typescript
// In local-docker-desktop-deployment-harness.ts
const testCase = {
  // ...
  expectedOutput: {
    podsRunning: 6,  // Updated from 5 to 6
    servicesWithEndpoints: 4,  // Updated from 3 to 4
    requiredServices: ['redis', 'metabob-rpc-api', 'metabob-dashboard', 'new-service'],
    // ...
  }
};
```

### Adding New Test Cases

Create a new test case with different expectations:

```typescript
const newTestCase: TestCase = {
  id: 'validation-local-docker-desktop-deployment-case-4',
  description: 'Test with postgres enabled',
  input: {
    environment: 'local',
    context: 'docker-desktop',
    deploymentPath: 'repos/platform/deployments/metabob'
  },
  expectedOutput: {
    clusterAccessible: true,
    helmfileParses: true,
    podsRunning: 6,  // Including postgres pod
    servicesWithEndpoints: 4,  // Including postgres service
    requiredServices: ['redis', 'postgres', 'metabob-rpc-api', 'metabob-dashboard'],
    maxWaitSeconds: 300
  }
};
```

## Related Documentation

- [Enforcement Summary](../../repos/platform/DEPLOYMENT-QUICK-START.md)
- [Local Deployment Guide](../../repos/platform/deployments/metabob/README.md)
- [Validation Script](../../repos/platform/scripts/validate-local-deployment.sh)
