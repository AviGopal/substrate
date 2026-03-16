# minibob Self-Configuration System Validation Harness

## Overview

This validation harness tests the minibob self-configuration system's ability to auto-detect runtime environment and dynamically configure capabilities.

## Test Coverage

### 4 Runtime Environments

1. **Local** - Development environment on local machine
2. **Docker** - Container running locally or in non-K8s environment  
3. **K8s Single Pod** - Single minibob pod in Kubernetes
4. **K8s Cluster** - 3+ minibob pods in Kubernetes cluster mode

### Validation Points

For each environment, the harness validates:

- **Health Endpoint** (`/health`) - Returns 200 OK with vessel info
- **Config Endpoint** (`/config`) - Returns manifest with dynamic capabilities
- **Environment Detection** - Correct environment detected and exposed in metadata
- **Cluster Mode** - Correct cluster mode flag based on peer count
- **Capabilities** - Correct capabilities enabled/disabled based on environment
- **DNS Resolution** (K8s only) - Headless service resolves to correct peer count
- **Startup Logs** (optional) - Environment detection logged correctly

## Usage

### Run Single Test Case

```bash
# Local environment
bun run tests/validation-harnesses/minibob-self-configuration-system-harness.ts local

# Docker environment
bun run tests/validation-harnesses/minibob-self-configuration-system-harness.ts docker \
  --endpoint http://minibob:8080

# K8s single pod
bun run tests/validation-harnesses/minibob-self-configuration-system-harness.ts k8s-single \
  --endpoint http://minibob.testing.svc.cluster.local:8080 \
  --namespace testing \
  --check-logs

# K8s cluster (3+ pods)
bun run tests/validation-harnesses/minibob-self-configuration-system-harness.ts k8s-cluster \
  --endpoint http://minibob-cluster.testing.svc.cluster.local:8080 \
  --namespace testing \
  --peer-count 3 \
  --check-logs
```

### Run All Test Cases

```bash
# Load test cases from JSON
for case in $(jq -r '.testCases[].id' tests/validation-harnesses/minibob-self-configuration-system-test-cases.json); do
  echo "Running $case..."
  # Extract input and run validation
  # (Implementation left as exercise)
done
```

### Programmatic Usage

```typescript
import { runValidation, type ValidationInput } from "./minibob-self-configuration-system-harness"

const input: ValidationInput = {
  environment: "k8s-cluster",
  minibobEndpoint: "http://minibob-cluster.testing.svc.cluster.local:8080",
  namespace: "testing",
  expectedPeerCount: 3,
  checkStartupLogs: true
}

const result = await runValidation(input)

if (result.pass) {
  console.log("✓ All checks passed")
} else {
  console.error("✗ Validation failed")
  console.error("Failed checks:", result.summary.failedChecks)
}
```

## Test Cases

### Case 1: Local Environment

**Input:**
```json
{
  "environment": "local",
  "minibobEndpoint": "http://localhost:8080"
}
```

**Expected:**
- Environment: `local`
- Cluster Mode: `false`
- Boredom: `disabled`
- ACP Gossip: `disabled`
- Capabilities: `["activities", "impulses", "git", "acp"]`

### Case 2: Docker Environment

**Input:**
```json
{
  "environment": "docker",
  "minibobEndpoint": "http://minibob:8080"
}
```

**Expected:**
- Environment: `docker`
- Cluster Mode: `false`
- Boredom: `disabled`
- ACP Gossip: `disabled`
- Capabilities: `["activities", "impulses", "git", "acp"]`

### Case 3: K8s Single Pod

**Input:**
```json
{
  "environment": "k8s-single",
  "minibobEndpoint": "http://minibob.testing.svc.cluster.local:8080",
  "namespace": "testing",
  "expectedPeerCount": 1,
  "checkStartupLogs": true
}
```

**Expected:**
- Environment: `k8s-single`
- Cluster Mode: `false`
- Peer Count: `1`
- Boredom: `disabled`
- ACP Gossip: `disabled`
- Capabilities: `["activities", "impulses", "git", "acp"]`
- DNS: 1 address
- Logs: Environment detection present

### Case 4: K8s Cluster (3+ pods)

**Input:**
```json
{
  "environment": "k8s-cluster",
  "minibobEndpoint": "http://minibob-cluster.testing.svc.cluster.local:8080",
  "namespace": "testing",
  "expectedPeerCount": 3,
  "checkStartupLogs": true
}
```

**Expected:**
- Environment: `k8s-cluster`
- Cluster Mode: `true`
- Peer Count: `>= 3`
- Boredom: `enabled`
- ACP Gossip: `flag set` (implementation deferred)
- Capabilities: `["activities", "impulses", "git", "acp", "boredom"]`
- DNS: 3+ addresses
- Logs: Environment detection, cluster mode, boredom enabled

## Validation Output

The harness returns a structured result:

```typescript
interface ValidationOutput {
  pass: boolean  // Overall pass/fail
  
  health: {
    pass: boolean
    actual: { status, vessel, responseTime }
    expected: { status, vessel }
  }
  
  config: {
    pass: boolean
    actual: { capabilities, metadata }
    expected: { baseCapabilities, conditionalCapabilities, hasMetadata }
  }
  
  environment: {
    pass: boolean
    actual: { environment, clusterMode, peerCount, boredomEnabled, acpGossipEnabled, backendAvailable }
    expected: { environment, clusterMode, minPeerCount, boredomEnabled, acpGossipEnabled }
  }
  
  dns?: {  // K8s only
    pass: boolean
    actual: { addresses, count }
    expected: { minCount }
  }
  
  logs?: {  // Optional
    pass: boolean
    actual: { hasEnvironmentDetection, hasClusterModeLog, hasBoredomLog, detectedEnvironment, detectedClusterMode }
    expected: { hasEnvironmentDetection, hasClusterModeLog, hasBoredomLog }
  }
  
  summary: {
    totalChecks: number
    passedChecks: number
    failedChecks: number
  }
}
```

## Exit Codes

- `0` - All checks passed
- `1` - One or more checks failed

## Dependencies

- Bun runtime (for TypeScript execution)
- `kubectl` (for K8s test cases)
- Network access to minibob endpoints

## Notes

- ACP Gossip is marked as "flag set" but not implemented yet - validation skips this check
- Backend health check timeout is 5 seconds
- DNS lookups use `nslookup` command
- Logs validation requires K8s access and pod name resolution

## Troubleshooting

### "Config endpoint unreachable"
- Check minibob is running: `curl http://localhost:8080/health`
- Check endpoint URL is correct
- Check network connectivity

### "DNS lookup failed"
- Ensure running from within K8s cluster or with proper kubeconfig
- Verify headless service name: `kubectl get svc -n <namespace>`
- Check service DNS: `nslookup minibob-cluster.<namespace>.svc.cluster.local`

### "Failed to fetch logs"
- Verify kubectl access: `kubectl get pods -n <namespace>`
- Check pod is running: `kubectl get pods -n <namespace> -l app=minibob`
- Verify RBAC permissions for log access

## Future Enhancements

- [ ] ACP gossip validation (when implemented)
- [ ] Backend health check validation
- [ ] Boredom task execution validation
- [ ] Metrics endpoint validation
- [ ] CI/CD integration with automated test matrix
