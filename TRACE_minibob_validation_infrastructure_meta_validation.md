# TRACE: minibob Validation Infrastructure Meta-Validation

**Specification**: minibob Validation Infrastructure Meta-Validation  
**Created**: 2026-03-16  
**Purpose**: Meta-validate that our validation infrastructure itself is production-ready and reliable

---

## Executive Summary

We have built comprehensive validation infrastructure for minibob consisting of:
- **4 validation harnesses** (complete system integration, self-configuration, testing infrastructure, standalone execution)
- **1 CLI runner** (run-minibob-validation.ts)
- **5 documentation files** (README, summary, trace, enforcement docs)

However, the validators themselves lack meta-validation:
- ❌ No dry-run mode to validate setup without deployment
- ❌ No prerequisite checking before execution
- ❌ Error messages lack actionable fix suggestions
- ❌ No quickstart guide for new users
- ❌ Documentation assumes expert knowledge
- ❌ Test cases don't capture prerequisite state

**This trace documents the gap between CURRENT STATE and DESIRED STATE for production-ready validation infrastructure.**

---

## Current State: What We Have

### 4 Validation Harnesses

1. **minibob-complete-system-integration-harness.ts**
   - 8 validation steps (6 quick + 2 optional)
   - Tests: local dev → deployment → self-config → capabilities → metrics → boredom → autonomous execution → git commits
   - Requires: kubectl, helmfile, docker, kind cluster, backend API, deployed minibob pods
   - Output: Pass/fail for each step with detailed results

2. **minibob-self-configuration-system-harness.ts**
   - Validates environment auto-detection (local, docker, k8s-single, k8s-cluster)
   - Tests: /health endpoint, /config endpoint, DNS discovery, startup logs
   - Requires: Running minibob pods, accessible endpoints
   - Output: Environment validation result with actual vs expected

3. **minibob-testing-infrastructure-harness.ts**
   - 7 phases: deployment state, activity execution, backend records, boredom system, metrics collection, visualization, helmfile state
   - Tests: kubectl pod status, test-vessel-capabilities.sh, backend API, metrics files, logs
   - Requires: Deployed infrastructure, backend API, metrics directory
   - Output: Phase-by-phase pass/fail with summary

4. **minibob-standalone-execution-harness.ts**
   - 13 test cases: pod health, activity execution, dynamic creation, trailblazing, ACP gossip, nested activities, boredom, impulse agent, learning loop, variants, debugging
   - Tests: Port-forward to pods, HTTP requests, backend queries
   - Requires: Running pods, backend API, port-forward capability
   - Output: Test-by-test results with timing

### CLI Runner

**run-minibob-validation.ts**
- Executes 4 test cases (quick validation, full validation, dev layer, staging layer)
- Hard-coded paths: repos/minibob, helm directory
- Usage: `bun run tests/validation-harnesses/run-minibob-validation.ts [1-4]`
- No flags or options supported

### Documentation

1. **tests/validation-harnesses/README.md** - Documents complete system integration harness only
2. **MINIBOB_VALIDATION_HARNESS_SUMMARY.md** - Comprehensive summary with architecture
3. **MINIBOB_COMPLETE_SYSTEM_INTEGRATION_TRACE.md** - Implementation status and data flow
4. **Enforcement docs** (implied) - Gap analysis and compliance

---

## Desired State: What We Need

### 1. Dry-Run Mode for All Harnesses

Each harness should support `--dry-run` flag that validates setup without deployment:

#### Complete System Integration Harness
```typescript
// Current: Directly executes kubectl, helmfile, docker commands
await execAsync(`cd ${repoPath} && bun test 2>&1`)
await execAsync(`helmfile -e ${environment} list 2>&1`)

// Desired: Check prerequisites first
if (dryRun) {
  return validatePrerequisites({
    commands: ['bun', 'kubectl', 'helmfile', 'docker'],
    paths: [repoPath, helmPath],
    cluster: true,
    namespace: getNamespaceForLayer(layer)
  })
}
```

#### Self-Configuration Harness
```typescript
// Current: Queries live endpoints
const response = await fetch(`${endpoint}/health`)

// Desired: Validate connectivity without waiting for readiness
if (dryRun) {
  return checkConnectivity({
    endpoint,
    namespace,
    podSelector: 'app=minibob'
  })
}
```

#### Testing Infrastructure Harness
```typescript
// Current: Runs test scripts and queries APIs
const testResult = await execAsync(`./scripts/test-vessel-capabilities.sh`)

// Desired: Validate scripts exist and are executable
if (dryRun) {
  return validateScripts({
    scripts: [
      'scripts/deploy-and-validate.sh',
      'scripts/test-vessel-capabilities.sh',
      'scripts/visualize-testing-infrastructure.sh'
    ]
  })
}
```

#### Standalone Execution Harness
```typescript
// Current: Port-forwards to pods immediately
portForward = startPortForward(pods[0], 8081)

// Desired: Check cluster connectivity first
if (dryRun) {
  return validateCluster({
    namespace: CONFIG.namespace,
    expectedPods: CONFIG.replicas,
    services: ['minibob']
  })
}
```

### 2. Prerequisite Validation Function

Common prerequisite checker used by all harnesses:

```typescript
interface PrerequisiteCheck {
  name: string
  check: () => Promise<boolean>
  fix: string // Actionable fix suggestion
  required: boolean
}

async function validatePrerequisites(checks: PrerequisiteCheck[]): Promise<{
  pass: boolean
  results: Array<{
    check: string
    pass: boolean
    fix?: string
  }>
}> {
  // Implementation checks each prerequisite
  // Returns detailed pass/fail with fix suggestions
}
```

### 3. Enhanced Error Handling

Transform generic errors into actionable messages:

```typescript
// Current
catch (error) {
  return { pass: false, error: String(error) }
}

// Desired
catch (error) {
  const actionableError = translateError(error)
  return {
    pass: false,
    error: actionableError.message,
    fix: actionableError.suggestedFix,
    docs: actionableError.documentationLink
  }
}

function translateError(error: Error): ActionableError {
  if (error.message.includes('kubectl: command not found')) {
    return {
      message: 'kubectl not found in PATH',
      suggestedFix: 'Install kubectl: https://kubernetes.io/docs/tasks/tools/',
      documentationLink: 'https://kubernetes.io/docs/tasks/tools/'
    }
  }
  // ... more translations
}
```

### 4. Updated CLI Runner

Add dry-run support and dependency checking:

```typescript
// Current usage:
// bun run run-minibob-validation.ts 1

// Desired usage:
// bun run run-minibob-validation.ts --dry-run 1
// bun run run-minibob-validation.ts --check-prerequisites 1
// bun run run-minibob-validation.ts --verbose 1

// Add flags
const args = parseArgs(process.argv.slice(2))
const dryRun = args.flags.includes('--dry-run')
const checkPrereqs = args.flags.includes('--check-prerequisites')

if (dryRun || checkPrereqs) {
  const prereqs = await validateAllPrerequisites(testCases[testCaseArg])
  printPrerequisiteReport(prereqs)
  process.exit(prereqs.pass ? 0 : 1)
}
```

### 5. Enhanced Documentation

#### tests/validation-harnesses/README.md

Add sections:
```markdown
## Prerequisites

### Required Dependencies
- kubectl >= 1.25 ([Install](https://kubernetes.io/docs/tasks/tools/))
- helmfile >= 0.150 ([Install](https://helmfile.readthedocs.io/en/latest/#installation))
- bun >= 1.0 ([Install](https://bun.sh/docs/installation))
- docker >= 20.10 ([Install](https://docs.docker.com/get-docker/))

### Cluster Setup
1. Start kind cluster: `kind create cluster --name minibob-test`
2. Verify cluster: `kubectl cluster-info`
3. Create namespace: `kubectl create namespace testing-minibob`

### Validation Readiness Check
Run dry-run to verify setup:
```bash
bun run tests/validation-harnesses/run-minibob-validation.ts --dry-run 1
```

Expected output:
```
✓ kubectl installed (v1.28.0)
✓ helmfile installed (v0.150.0)
✓ bun installed (v1.0.15)
✓ docker running (v24.0.5)
✓ kind cluster accessible
✓ namespace 'testing-minibob' exists
✓ scripts exist and are executable
✗ backend not deployed
  Fix: cd helm && helmfile -e testing sync -l app=metabob-rpc-api

Readiness: 7/8 checks passed (ALMOST READY)
```

## Quickstart Guide for New Users

### Step 1: Install Dependencies (5 minutes)
[Links and commands for kubectl, helmfile, bun, docker, kind]

### Step 2: Setup Cluster (2 minutes)
```bash
kind create cluster --name minibob-test
kubectl create namespace testing-minibob
kubectl create namespace metabob
```

### Step 3: Deploy Backend (5 minutes)
```bash
cd helm
helmfile -e testing sync -l app=metabob-rpc-api
```

### Step 4: Deploy minibob (3 minutes)
```bash
helmfile -e testing sync -l namespace=testing-minibob
```

### Step 5: Verify Deployment (1 minute)
```bash
bun run tests/validation-harnesses/run-minibob-validation.ts --dry-run 1
```

### Step 6: Run Validation (5 minutes)
```bash
bun run tests/validation-harnesses/run-minibob-validation.ts 1
```

### Step 7: Interpret Results
- ✅ PASS = All validation steps succeeded
- ⚠️ PARTIAL = Some steps failed (check details)
- ❌ FAIL = Critical failures (deployment or configuration issue)

## Troubleshooting

### Error: kubectl: command not found
**Fix**: Install kubectl following https://kubernetes.io/docs/tasks/tools/

### Error: Cannot connect to cluster
**Fix**: Verify cluster is running with `kubectl cluster-info`

### Error: Namespace 'testing-minibob' not found
**Fix**: Create namespace with `kubectl create namespace testing-minibob`

### Error: No pods found
**Fix**: Deploy minibob with `cd helm && helmfile -e testing sync -l namespace=testing-minibob`

### Error: Backend API unreachable
**Fix**: Deploy backend with `cd helm && helmfile -e testing sync -l app=metabob-rpc-api`

### Error: Metrics directory not found
**Fix**: Create directory with `mkdir -p repos/minibob/metrics`

## All Available Harnesses

1. **Complete System Integration** (recommended for full validation)
   - File: minibob-complete-system-integration-harness.ts
   - Runner: run-minibob-validation.ts
   - Purpose: End-to-end workflow validation

2. **Self-Configuration System** (validates auto-detection)
   - File: minibob-self-configuration-system-harness.ts
   - Purpose: Environment detection and capability configuration

3. **Testing Infrastructure** (validates feedback loop)
   - File: minibob-testing-infrastructure-harness.ts
   - Purpose: Development → deployment → runtime → refinement

4. **Standalone Execution** (validates individual capabilities)
   - File: minibob-standalone-execution-harness.ts
   - Purpose: 13 specific capability tests
```

#### MINIBOB_VALIDATION_HARNESS_SUMMARY.md

Add sections:
```markdown
## Prerequisites Checklist

Before running validation, ensure:

- [ ] kubectl installed and accessible
- [ ] helmfile installed and accessible
- [ ] bun installed and accessible
- [ ] docker installed and running
- [ ] kind cluster created and running
- [ ] testing-minibob namespace exists
- [ ] metabob namespace exists
- [ ] Backend (metabob-rpc-api) deployed
- [ ] minibob deployed (at least 1 pod running)
- [ ] repos/minibob directory exists
- [ ] helm directory exists
- [ ] Metrics directory exists or writable

Run prerequisite check:
```bash
bun run tests/validation-harnesses/run-minibob-validation.ts --check-prerequisites 1
```

## Troubleshooting Guide

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| kubectl: command not found | kubectl not installed | Install from https://kubernetes.io/docs/tasks/tools/ |
| Unable to connect to cluster | Cluster not running | Run `kubectl cluster-info` to verify |
| Namespace not found | Namespace not created | `kubectl create namespace testing-minibob` |
| No pods found | minibob not deployed | Deploy with helmfile |
| Backend unreachable | Backend not deployed | Deploy metabob-rpc-api |
| Metrics directory not found | Directory doesn't exist | `mkdir -p repos/minibob/metrics` |
| Port-forward failed | Pod not running | Check pod status with `kubectl get pods` |
| Script not executable | Missing execute permission | `chmod +x scripts/*.sh` |

## Validation Flow with Pre-flight Checks

```
┌─────────────────────────────────────────┐
│  User runs validation                   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Phase 0: Pre-flight Checks            │
│  - kubectl installed?                   │
│  - Cluster accessible?                  │
│  - Namespace exists?                    │
│  - Paths exist?                         │
└────────────┬────────────────────────────┘
             │
         [PASS] │ [FAIL]
             │      └──> Print fix suggestions, exit 1
             ▼
┌─────────────────────────────────────────┐
│  Phase 1-8: Actual Validation          │
│  (existing harness steps)               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Report Results                         │
└─────────────────────────────────────────┘
```

## Dry-Run Examples

### Check Prerequisites Without Running Tests
```bash
bun run tests/validation-harnesses/run-minibob-validation.ts --dry-run 1
```

Output:
```
=== Pre-flight Checks ===
✓ kubectl installed (v1.28.0)
✓ helmfile installed (v0.150.0)
✓ bun installed (v1.0.15)
✓ docker running (v24.0.5)
✓ kind cluster accessible
✓ namespace 'testing-minibob' exists
✓ namespace 'metabob' exists
✓ scripts executable
✓ paths exist
✓ backend deployed
✗ minibob pods not ready (0/3 running)
  Fix: Wait for pods or check deployment

Pre-flight: 10/11 checks passed
Ready to run validation: NO (1 check failed)
```

### Validate Specific Harness Setup
```bash
# Dry-run for self-configuration harness
bun run tests/validation-harnesses/minibob-self-configuration-system-harness.ts \
  k8s-cluster --namespace testing-minibob --dry-run
```
```

### 6. Enhanced Test Case Impulses

Update impulse structure to capture prerequisites:

```json
{
  "id": "validation-minibob-complete-system-integration-case-1",
  "type": "testCase",
  "pointer": {
    "type": "testCase",
    "harnessFile": "tests/validation-harnesses/minibob-complete-system-integration-harness.ts",
    "input": {
      "repoPath": "./repos/minibob",
      "helmPath": "./helm",
      "environment": "testing",
      "layer": "testing-cluster",
      "skipLongRunning": true
    },
    "expectedOutput": {
      "pass": true,
      "stepsCompleted": 6,
      "minPassedSteps": 5
    },
    "prerequisites": {
      "dependencies": {
        "kubectl": ">= 1.25",
        "helmfile": ">= 0.150",
        "bun": ">= 1.0",
        "docker": ">= 20.10"
      },
      "infrastructure": {
        "clusterRunning": true,
        "namespaceExists": "testing-minibob",
        "backendDeployed": true,
        "minibobDeployed": true,
        "podsReady": 3
      },
      "environment": {
        "workingDirectory": "/home/avi/documents/work/exp-repo/metabob-devbob",
        "paths": {
          "repoPath": "./repos/minibob",
          "helmPath": "./helm",
          "metricsDir": "./repos/minibob/metrics"
        }
      }
    }
  },
  "budget": 2000
}
```

---

## Implementation Plan

### Phase 1: Add Dry-Run Support (Priority: HIGH)

1. Create `validatePrerequisites()` utility function
2. Add `--dry-run` flag to all 4 harnesses
3. Implement prerequisite checks for each harness
4. Update CLI runner to support `--dry-run` flag

**Deliverables**:
- `tests/validation-harnesses/lib/prerequisites.ts` (new utility)
- Updated harness files with dry-run mode
- Updated CLI runner with flag support

### Phase 2: Enhance Error Handling (Priority: HIGH)

1. Create error translation function
2. Map common errors to actionable fixes
3. Update all error handling in harnesses
4. Add fix suggestions to error output

**Deliverables**:
- `tests/validation-harnesses/lib/error-translator.ts` (new utility)
- Updated error handling in all harnesses

### Phase 3: Documentation Updates (Priority: MEDIUM)

1. Add Prerequisites section to README.md
2. Add Quickstart guide to README.md
3. Add Troubleshooting section to SUMMARY.md
4. Add Pre-flight checks diagram to SUMMARY.md
5. Document all 4 harnesses in README.md
6. Add dry-run examples throughout

**Deliverables**:
- Updated README.md with 3 new sections
- Updated SUMMARY.md with troubleshooting
- Updated TRACE.md with validation readiness

### Phase 4: Test Case Enhancement (Priority: LOW)

1. Update all test case impulses to include prerequisites
2. Add environment snapshot to test cases
3. Document expected cluster state
4. Add deterministic test order

**Deliverables**:
- Updated impulse JSON files (4 test cases)
- Impulse schema documentation

---

## Gap Summary

| Component | Current State | Desired State | Gap |
|-----------|---------------|---------------|-----|
| **Dry-Run Mode** | None | All harnesses support --dry-run | ❌ Missing |
| **Prerequisite Checks** | None | Validates setup before execution | ❌ Missing |
| **Error Handling** | Generic exceptions | Actionable fix suggestions | ❌ Incomplete |
| **CLI Flags** | None | --dry-run, --check-prerequisites | ❌ Missing |
| **README** | Single harness | All harnesses + quickstart | ❌ Incomplete |
| **Troubleshooting** | Brief section | Comprehensive error guide | ❌ Missing |
| **Test Cases** | Input/output only | Include prerequisites snapshot | ❌ Incomplete |
| **New User Guide** | Assumes expertise | Step-by-step quickstart | ❌ Missing |

---

## Success Criteria

Meta-validation is successful when:

1. ✅ New user can run `--dry-run` and get clear readiness report
2. ✅ All harnesses support dry-run mode
3. ✅ Prerequisites are checked before execution starts
4. ✅ Error messages include actionable fix suggestions
5. ✅ Documentation includes quickstart guide for new users
6. ✅ Troubleshooting guide covers common setup issues
7. ✅ Test cases capture prerequisite state
8. ✅ Validation flow is reproducible across environments

---

## Conclusion

The minibob validation infrastructure is **functionally complete** but **not production-ready** because:

1. It assumes perfect setup (no prerequisite validation)
2. It fails with generic errors (no actionable fixes)
3. It lacks dry-run mode (can't validate setup without deployment)
4. Documentation assumes expert users (no quickstart guide)

**This trace provides the roadmap to make the validators themselves validated and production-ready.**

