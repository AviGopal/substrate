# Validation Harnesses

Automated validation harnesses for testing specifications without requiring an LLM.

## minibob Complete System Integration Harness

**File**: `minibob-complete-system-integration-harness.ts`  
**Specification**: minibob Complete System Integration - End-to-End Vessel Development Workflow  
**Impulse**: `harness-minibob-complete-system-integration`

### Purpose

Validates the complete minibob vessel development workflow end-to-end:
- deployment → auto-configuration → validation → observation → refinement → repeat

This harness proves that "minibob is a vessel for developing vessels" by verifying the complete autonomous development cycle.

### Validation Steps

The harness executes 8 validation steps:

1. **Local Development Phase** - Tests pass, type check passes, Docker image ready
2. **Deployment Phase** - Helmfile deployment successful, pods running
3. **Self-Configuration** - Environment detected, capabilities match expected
4. **Capability Tests** - Activity execution, ACP delegation, boredom system
5. **Metrics Collection** - Metrics files exist with valid structure
6. **Boredom Task Queue** - Backend endpoint accessible, tasks queryable
7. **Autonomous Execution** - Boredom system executes tasks (optional, requires time)
8. **Autonomous Commits** - Git log shows vessel commits (optional, requires time)

Steps 7-8 are optional and can be skipped with `skipLongRunning: true` for quick validation.

### Test Cases

Four test cases are provided as impulses:

#### Test Case 1: Quick Validation (testing-cluster)
- **Impulse**: `validation-minibob-complete-system-integration-case-1`
- **Layer**: `testing-cluster` (3 pods, boredom + gossip enabled)
- **Skip Long Running**: Yes
- **Steps**: 6
- **Expected**: All 6 steps pass

#### Test Case 2: Full Validation (testing-cluster)
- **Impulse**: `validation-minibob-complete-system-integration-case-2`
- **Layer**: `testing-cluster` (3 pods, boredom + gossip enabled)
- **Skip Long Running**: No
- **Steps**: 8
- **Expected**: At least 7 steps pass (autonomous behavior may take time)

#### Test Case 3: Single Pod Validation (dev)
- **Impulse**: `validation-minibob-complete-system-integration-case-3`
- **Layer**: `dev` (1 pod, no boredom, no gossip)
- **Skip Long Running**: Yes
- **Steps**: 6
- **Expected**: All 6 steps pass, capabilities = [activities, impulses, git, acp]

#### Test Case 4: Staging Validation
- **Impulse**: `validation-minibob-complete-system-integration-case-4`
- **Layer**: `staging` (3 pods, production simulation)
- **Skip Long Running**: Yes
- **Steps**: 6
- **Expected**: All 6 steps pass, capabilities = [activities, impulses, git, acp, acp-gossip, boredom]

## Quickstart Guide for New Users

Complete setup guide from scratch:

### Step 1: Install Dependencies (5 minutes)

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# Install helmfile
curl -LO https://github.com/helmfile/helmfile/releases/download/v0.150.0/helmfile_linux_amd64
chmod +x helmfile_linux_amd64 && sudo mv helmfile_linux_amd64 /usr/local/bin/helmfile

# Install bun
curl -fsSL https://bun.sh/install | bash

# Install kind
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind
```

### Step 2: Setup Cluster (2 minutes)

```bash
# Create kind cluster
kind create cluster --name minibob-test

# Verify cluster is running
kubectl cluster-info

# Create namespaces
kubectl create namespace testing-minibob
kubectl create namespace metabob
```

### Step 3: Deploy Backend (5 minutes)

```bash
cd helm
helmfile -e testing sync -l app=metabob-rpc-api

# Wait for backend to be ready
kubectl wait --for=condition=ready pod -l app=metabob-rpc-api -n metabob --timeout=300s
```

### Step 4: Deploy minibob (3 minutes)

```bash
cd helm
helmfile -e testing sync -l namespace=testing-minibob

# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=minibob -n testing-minibob --timeout=300s
```

### Step 5: Verify Deployment (1 minute)

```bash
# Check prerequisites
bun run tests/validation-harnesses/run-minibob-validation.ts --dry-run 1

# Should show all checks passing
```

### Step 6: Run Validation (5 minutes)

```bash
# Run quick validation (6 steps)
bun run tests/validation-harnesses/run-minibob-validation.ts 1

# Should complete with ✅ PASS
```

### Step 7: Interpret Results

- ✅ **PASS** = All validation steps succeeded - system is working correctly
- ⚠️ **PARTIAL** = Some steps failed - check step details for issues
- ❌ **FAIL** = Critical failures - deployment or configuration issue

### Usage

#### As TypeScript Module

```typescript
import runValidation from "./minibob-complete-system-integration-harness"

const result = await runValidation({
  repoPath: "./repos/minibob",
  helmPath: "./helm",
  environment: "testing",
  layer: "testing-cluster",
  skipLongRunning: true
})

if (result.pass) {
  console.log("✅ Validation passed!")
  console.log(result.summary)
} else {
  console.log("❌ Validation failed")
  for (const step of result.steps) {
    if (!step.pass) {
      console.log(`Failed step ${step.step}: ${step.name}`)
      console.log(`  ${step.message}`)
    }
  }
}
```

#### As CLI Script

```bash
# Check prerequisites first (recommended)
bun run tests/validation-harnesses/run-minibob-validation.ts --dry-run 1

# Quick validation (test case 1)
bun run tests/validation-harnesses/run-minibob-validation.ts 1

# Full validation (test case 2)
bun run tests/validation-harnesses/run-minibob-validation.ts 2

# Dev layer validation (test case 3)
bun run tests/validation-harnesses/run-minibob-validation.ts 3

# Staging layer validation (test case 4)
bun run tests/validation-harnesses/run-minibob-validation.ts 4

# Check prerequisites for staging
bun run tests/validation-harnesses/run-minibob-validation.ts --check-prerequisites 4
```

### Prerequisites

Before running validation, ensure these dependencies are installed:

#### Required Dependencies
- **kubectl** >= 1.25 - [Install Guide](https://kubernetes.io/docs/tasks/tools/)
- **helmfile** >= 0.150 - [Install Guide](https://helmfile.readthedocs.io/en/latest/#installation)
- **bun** >= 1.0 - [Install Guide](https://bun.sh/docs/installation)
- **docker** >= 20.10 - [Install Guide](https://docs.docker.com/get-docker/)

#### Cluster Setup
1. **Kubernetes cluster** - Running kind cluster or similar
2. **Namespace** - `testing-minibob` (or appropriate for your layer)
3. **Backend namespace** - `metabob` (for metabob-rpc-api)
4. **Backend deployed** - metabob-rpc-api running and accessible
5. **minibob deployed** - At least 1 pod running (3 for cluster mode)

#### File Structure
- `repos/minibob` - minibob repository clone
- `helm` - Helm charts and helmfile configuration
- `repos/minibob/metrics` - Metrics directory (auto-created if missing)

### Validation Readiness Check

Before running the full validation, check if your system is ready:

```bash
# Check prerequisites without running tests
bun run tests/validation-harnesses/run-minibob-validation.ts --dry-run 1
```

Expected output:
```
=== Pre-flight Checks ===

DEPENDENCY:
  ✓ kubectl installed: PASS
    Version: Client Version: v1.28.0
  ✓ helmfile installed: PASS
    Version: helmfile version 0.150.0
  ✓ bun installed: PASS
    Version: 1.0.15
  ✓ docker running: PASS
    Version: Docker version 24.0.5

INFRASTRUCTURE:
  ✓ kubernetes cluster accessible: PASS
  ✓ namespace 'testing-minibob' exists: PASS
  ✓ namespace 'metabob' exists: PASS
  ✗ deployment 'metabob-rpc-api' exists: FAIL
    Fix: Deploy backend: cd helm && helmfile -e testing sync -l app=metabob-rpc-api
  ✗ pods exist in namespace 'testing-minibob': FAIL
    Fix: Deploy minibob: cd helm && helmfile -e testing sync -l namespace=testing-minibob

FILESYSTEM:
  ✓ minibob repository exists: PASS
  ✓ helm directory exists: PASS
  ✓ metrics directory exists: PASS

Pre-flight: 10/12 checks passed
Ready to run validation: NO
```

If checks fail, follow the fix suggestions before running validation.

### Expected Output

```
================================================================================
VALIDATION RESULTS
================================================================================
Status: ✅ PASS
Summary: ✅ ALL VALIDATION STEPS PASSED (6/6)
Timestamp: 2026-03-16T10:30:00.000Z

Step Results:
================================================================================

✅ Step 1: Local Development Phase
   Tests pass, types check, Docker ready

✅ Step 2: Deployment Phase
   Deployed to minibob-cluster, pods running

✅ Step 3: Self-Configuration Verification
   Environment detected, capabilities: activities, impulses, git, acp, acp-gossip, boredom

✅ Step 4: Capability Tests
   4 tests passed (>= 4 expected)

✅ Step 5: Metrics Collection
   Metrics file found: metrics-20260316-103000.json, 42 executions

✅ Step 6: Boredom Task Queue
   Boredom task queue accessible, 3 tasks

================================================================================
Final Status: ✅ PASS
================================================================================
```

### Architecture

The harness is designed to be:

- **LLM-Free**: No language model required for validation
- **Deterministic**: Same inputs always produce same pass/fail results
- **Observable**: Detailed step-by-step output for debugging
- **Historical**: Test cases stored as impulses can be replayed anytime
- **Fast**: Quick mode (6 steps) completes in ~2 minutes
- **Comprehensive**: Full mode (8 steps) validates autonomous behavior

### Integration with CI/CD

Add to your CI/CD pipeline:

```yaml
# .github/workflows/validate-minibob.yml
name: Validate minibob System Integration

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - name: Setup kind cluster
        run: ./scripts/setup-kind-cluster.sh
      - name: Deploy minibob
        run: cd helm && helmfile -e testing sync -l namespace=minibob-cluster
      - name: Run validation
        run: bun run tests/validation-harnesses/run-minibob-validation.ts 1
      - name: Collect results
        if: always()
        run: |
          kubectl logs -n minibob-cluster minibob-0 > validation-logs.txt
          ls -la repos/minibob/metrics/
```

### Extending the Harness

To add new validation steps:

1. Add a new `validateXYZ()` function following the pattern
2. Return a `StepResult` with pass/fail status
3. Add the step to `runValidation()` steps array
4. Update test case impulses with new expected step count
5. Document the new step in this README

### Troubleshooting

#### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `kubectl: command not found` | kubectl not installed | Install from https://kubernetes.io/docs/tasks/tools/ |
| `Unable to connect to cluster` | Cluster not running | Run `kubectl cluster-info` to verify or start cluster |
| `namespace 'testing-minibob' not found` | Namespace not created | `kubectl create namespace testing-minibob` |
| `No pods found` | minibob not deployed | Deploy with `cd helm && helmfile -e testing sync -l namespace=testing-minibob` |
| `Backend unreachable` | Backend not deployed | Deploy with `cd helm && helmfile -e testing sync -l app=metabob-rpc-api` |
| `Metrics directory not found` | Directory doesn't exist | `mkdir -p repos/minibob/metrics` |
| `Port-forward failed` | Pod not running | Check with `kubectl get pods -n testing-minibob` |
| `Script not executable` | Missing execute permission | `chmod +x scripts/*.sh` |

#### Validation Step Failures

**Step 1 fails (Local Development)**: 
- Check that `bun test` works in repos/minibob
- Verify `bun run typecheck` passes
- Ensure Docker is running

**Step 2 fails (Deployment)**: 
- Verify helmfile is installed: `helmfile version`
- Check cluster is accessible: `kubectl cluster-info`
- Run helmfile manually: `cd helm && helmfile -e testing list`

**Step 3 fails (Self-Configuration)**: 
- Check pod logs: `kubectl logs -n testing-minibob minibob-0`
- Verify pods are running: `kubectl get pods -n testing-minibob`
- Check /health endpoint accessibility

**Step 4 fails (Capability Tests)**: 
- Run test script manually: `./scripts/test-vessel-capabilities.sh`
- Check which specific test failed
- Verify pod can execute activities

**Step 5 fails (Metrics Collection)**: 
- Verify metrics directory exists: `ls -la repos/minibob/metrics/`
- Create if missing: `mkdir -p repos/minibob/metrics`
- Check pod has write permissions

**Step 6 fails (Boredom Task Queue)**: 
- Verify backend is deployed: `kubectl get deployment metabob-rpc-api -n metabob`
- Check backend /boredom-tasks endpoint
- Ensure cluster mode is enabled (3 pods)

**Step 7 fails (Autonomous Execution)**: 
- This step requires time (15-30 minutes)
- Verify boredom system is enabled
- Check pod logs for boredom activity
- Skip with `skipLongRunning: true` for quick validation

**Step 8 fails (Autonomous Commits)**: 
- Requires Step 7 to complete first
- Check git log in pod: `kubectl exec -it minibob-0 -n testing-minibob -- git log`
- Verify git is configured in pod
- Skip with `skipLongRunning: true` for quick validation

### Related Files

- **Harness**: `minibob-complete-system-integration-harness.ts`
- **Runner**: `run-minibob-validation.ts`
- **Test Cases**: `impulses/validation-minibob-complete-system-integration-case-*.json`
- **Harness Impulse**: `impulses/harness-minibob-complete-system-integration.json`
- **Trace**: `MINIBOB_COMPLETE_SYSTEM_INTEGRATION_TRACE.md`
- **Enforcement**: `MINIBOB_COMPLETE_SYSTEM_INTEGRATION_ENFORCEMENT.md`

---

## All Available Harnesses

### 1. Complete System Integration Harness (Recommended)

**File**: `minibob-complete-system-integration-harness.ts`  
**Purpose**: End-to-end workflow validation (development → deployment → execution → observation)  
**Validation Steps**: 8 (6 quick + 2 optional)  
**Use Case**: Primary validation harness for full system testing

**Quick Check**:
```bash
bun run tests/validation-harnesses/run-minibob-validation.ts --dry-run 1
```

**Run Validation**:
```bash
bun run tests/validation-harnesses/run-minibob-validation.ts 1
```

### 2. Self-Configuration System Harness

**File**: `minibob-self-configuration-system-harness.ts`  
**Purpose**: Validates environment auto-detection (local, docker, k8s-single, k8s-cluster)  
**Validation Steps**: Environment detection, capability configuration, DNS discovery  
**Use Case**: Testing self-configuration logic independent of full deployment

**Usage**:
```typescript
import { validateSelfConfiguration } from "./minibob-self-configuration-system-harness"

const result = await validateSelfConfiguration({
  environment: "k8s-cluster",
  namespace: "testing-minibob",
  expectedCapabilities: ["activities", "impulses", "git", "acp", "acp-gossip", "boredom"]
})
```

### 3. Testing Infrastructure Harness

**File**: `minibob-testing-infrastructure-harness.ts`  
**Purpose**: Validates feedback loop (deployment → execution → metrics → refinement)  
**Validation Steps**: 7 phases covering deployment state, activity execution, backend records, metrics collection  
**Use Case**: Testing the development-to-deployment feedback loop

**Usage**:
```typescript
import { validateTestingInfrastructure } from "./minibob-testing-infrastructure-harness"

const result = await validateTestingInfrastructure({
  namespace: "testing-minibob",
  helmPath: "./helm",
  environment: "testing"
})
```

### 4. Standalone Execution Harness

**File**: `minibob-standalone-execution-harness.ts`  
**Purpose**: Validates individual capabilities with 13 specific tests  
**Validation Steps**: Pod health, activity execution, dynamic creation, trailblazing, ACP, boredom, learning loop  
**Use Case**: Testing specific capabilities in isolation

**Usage**:
```typescript
import { validateStandaloneExecution } from "./minibob-standalone-execution-harness"

const result = await validateStandaloneExecution({
  namespace: "testing-minibob",
  backendUrl: "http://localhost:8080",
  expectedTestsPassing: 10 // out of 13
})
```

### Choosing the Right Harness

- **Start here**: Use **Complete System Integration** for initial validation
- **Environment issues**: Use **Self-Configuration** to debug auto-detection
- **Feedback loop**: Use **Testing Infrastructure** to validate development workflow
- **Specific capabilities**: Use **Standalone Execution** for focused testing

---

*"Validation without LLM proves the specification through observable, deterministic outcomes."*

---

## activity-system-minimal-deployment Harness

**File**: `activity-system-minimal-deployment-harness.ts`  
**Specification**: activity-system-minimal-deployment - Complete infrastructure deployment for activity system  
**Impulse**: `harness-activity-system-minimal-deployment`

### Overview

Validates the complete activity system infrastructure deployment including Kubernetes resources, health endpoints, and API functionality. Tests all 11 requirements from the specification plus Thompson Sampling learning loop closure.

### Tests (11 total)

1. **Namespace Existence** - Verify activity-system namespace exists and is Active
2. **Service Creation Verification** - Verify all 4 services exist (redis-master, surrealdb, metabob-activity-api, minibob)
3. **Persistent Volume Binding** - Verify at least 1 PVC is bound (for SurrealDB storage)
4. **Pod Running Status** - Verify all 5 pods are Running (redis, surrealdb, 2x activity-api, minibob)
5. **SurrealDB Health Endpoint** - Test /health endpoint via port-forward on 8000
6. **Activity API Health Endpoint** - Test /health endpoint via port-forward on 8080
7. **Minibob Health Endpoint** - Test /health endpoint via port-forward on 8081
8. **Session Creation API** - Test POST /v2/session returns Bearer token
9. **Template Listing API** - Test GET /v2/activities/templates returns templates with Thompson metrics
10. **Execution Recording API** - Test POST /v2/activities/executions records execution and updates metrics
11. **SurrealDB Database Query** - Test SQL query via HTTP API returns database metadata

### Prerequisites

- `kubectl` installed and configured
- Kubernetes cluster running (Docker Desktop recommended for local testing)
- Activity system deployed: `ENVIRONMENT=local bash scripts/deploy-activity-system.sh`
- Bun runtime installed (`curl -fsSL https://bun.sh/install | bash`)

### Usage

```bash
# Run validation harness
bun run tests/validation-harnesses/activity-system-minimal-deployment-harness.ts

# Check exit code
echo $?  # 0 = all tests passed, 1 = one or more tests failed
```

### Expected Output

```
[INFO] Starting Activity System Validation
[INFO] Namespace: activity-system

[✓] Namespace Existence (125ms)
[✓] Service Creation Verification (89ms)
[✓] Persistent Volume Binding (76ms)
[✓] Pod Running Status - All 5 Pods (112ms)
[✓] SurrealDB Health Endpoint (2345ms)
[✓] Activity API Health Endpoint (2156ms)
[✓] Minibob Health Endpoint (2234ms)
[✓] Session Creation API (398ms)
[✓] Template Listing API (456ms)
[✓] Execution Recording API (512ms)
[✓] SurrealDB Database Query (289ms)

[INFO] ==========================================
[INFO] Validation Summary
[INFO] ==========================================
[✓] Passed: 11
[✓] All tests passed!
[INFO] Activity System is fully operational
```

### Test Case Impulses

Each test case is stored as an impulse in `impulses/validation-cases/`:

- `validation-activity-system-minimal-deployment-case-1.json` - Namespace existence
- `validation-activity-system-minimal-deployment-case-2.json` - Service creation
- `validation-activity-system-minimal-deployment-case-3.json` - PVC binding
- `validation-activity-system-minimal-deployment-case-4.json` - Pod running status
- `validation-activity-system-minimal-deployment-case-5.json` - SurrealDB health
- `validation-activity-system-minimal-deployment-case-6.json` - Activity API health
- `validation-activity-system-minimal-deployment-case-7.json` - Minibob health
- `validation-activity-system-minimal-deployment-case-8.json` - Session creation
- `validation-activity-system-minimal-deployment-case-9.json` - Template listing
- `validation-activity-system-minimal-deployment-case-10.json` - Execution recording
- `validation-activity-system-minimal-deployment-case-11.json` - SurrealDB query

### Implementation Details

**Test Categories**:
- **Infrastructure** (4 tests): namespace, services, PVCs, pods
- **Health Endpoints** (3 tests): SurrealDB, Activity API, minibob
- **API Endpoints** (4 tests): session, templates, executions, database

**Retry Strategy**:
- 5 retries with 3-second delay for HTTP requests
- 2-second startup delay for port-forwarding
- Automatic cleanup of port-forward processes

**Port-Forwarding**:
- SurrealDB: localhost:8000 → svc/surrealdb:8000
- Activity API: localhost:8080 → svc/metabob-activity-api:8080
- Minibob: localhost:8081 → svc/minibob:8080

### Troubleshooting

**Port-forward failures**:
```bash
# Check if services are running
kubectl get svc -n activity-system

# Kill stale port-forwards
pkill -f "kubectl port-forward"
```

**Pod not running**:
```bash
# Check pod status
kubectl get pods -n activity-system

# View logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=50

# Describe pod for events
kubectl describe pod -n activity-system <pod-name>
```

**API endpoint failures**:
```bash
# Port-forward manually and test
kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080 &
curl http://localhost:8080/health

# Check API logs
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api
```

**SurrealDB query failures**:
```bash
# Verify SurrealDB is accessible
kubectl port-forward -n activity-system svc/surrealdb 8000:8000 &
curl -u root:surrealdb123 http://localhost:8000/health

# Check SurrealDB logs
kubectl logs -n activity-system -l app=surrealdb
```

### CI/CD Integration

```yaml
# .github/workflows/validate-activity-system.yml
name: Validate Activity System

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Setup Kubernetes (kind)
        uses: helm/kind-action@v1.10.0
        with:
          cluster_name: activity-system-test
      
      - name: Deploy Activity System
        run: |
          ENVIRONMENT=local bash scripts/deploy-activity-system.sh
      
      - name: Run Validation Harness
        run: |
          bun run tests/validation-harnesses/activity-system-minimal-deployment-harness.ts
      
      - name: Cleanup
        if: always()
        run: |
          kubectl delete namespace activity-system
```
