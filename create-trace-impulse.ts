#!/usr/bin/env node
import { ImpulseManager } from './repos/metabob-opencode/src/session/impulse/impulse-manager.js';
import { ImpulseKnowledgeId } from './repos/metabob-opencode/src/session/impulse/types.js';

const traceContent = `# Trace Analysis: Kubernetes-Deployment-Validation-Exit-Codes

## Executive Summary

**Status:** ✅ FULLY IMPLEMENTED AND VALIDATED

The deployment validation script \`repos/platform/scripts/validate-local-deployment.sh\` has been fixed to return proper exit codes for CI/CD automation. Previously, the script always returned exit code 0 even when detecting deployment failures (pods in CrashLoopBackOff/ImagePullBackOff, services without endpoints). This made it unusable for automated pipelines.

**Fix:** Added explicit \`exit 1\` when validation fails, enabling programmatic failure detection.

---

## Specification Requirements

1. **Detect Deployment Failures:**
   - Pods not in Running/Completed state (CrashLoopBackOff, ImagePullBackOff, Pending, Error)
   - Services without backing endpoints (<none>)

2. **Exit Code Behavior:**
   - Return exit code 0 when deployment is healthy
   - Return exit code 1 when deployment has issues

3. **CI/CD Integration:**
   - Scripts and pipelines can check \`$?\` to detect failures
   - GitHub Actions can use \`if: failure()\` conditions
   - Enables automated rollback and alerting

---

## Implementation Components

### 1. Validation Summary Logic (lines 90-101)

**File:** \`repos/platform/scripts/validate-local-deployment.sh:90-101\`

**Current Implementation:**
\`\`\`bash
if [ "$PODS_NOT_READY" -eq 0 ] && [ "$SERVICES_WITHOUT_ENDPOINTS" -eq 0 ]; then
  echo "✅ VALIDATION PASSED: Local deployment is healthy"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "❌ VALIDATION FAILED: Deployment has issues"
  echo "   Run: kubectl get pods -n metabob"
  echo "   Run: kubectl logs -n metabob <pod-name>"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi
\`\`\`

**Gap:** NONE - Fully matches specification

**Changes Made (commit cf4e0d0):**
- Changed message from \`⚠️ VALIDATION WARNING\` to \`❌ VALIDATION FAILED\`
- Added explicit \`exit 0\` in success branch
- Added explicit \`exit 1\` in failure branch
- Moved closing separator inside conditional branches

---

### 2. Pod Health Check (lines 42-61)

**File:** \`repos/platform/scripts/validate-local-deployment.sh:42-61\`

**Implementation:**
\`\`\`bash
PODS_NOT_READY=$(kubectl get pods -n metabob --no-headers 2>/dev/null | grep -v "Running\\|Completed" | wc -l)
TOTAL_PODS=$(kubectl get pods -n metabob --no-headers 2>/dev/null | wc -l)

if [ "$PODS_NOT_READY" -gt 0 ]; then
  echo "⚠️  WARNING: Some pods are not ready"
  kubectl get pods -n metabob
else
  echo "✅ All pods are Running"
fi
\`\`\`

**Detection Logic:**
- Uses \`grep -v "Running\\|Completed"\` to catch all non-healthy states
- Captures: CrashLoopBackOff, ImagePullBackOff, Pending, Error, Terminating
- Stores count in \`PODS_NOT_READY\` variable for final validation

**Gap:** NONE - Already implemented correctly

---

### 3. Service Endpoint Check (lines 64-77)

**File:** \`repos/platform/scripts/validate-local-deployment.sh:64-77\`

**Implementation:**
\`\`\`bash
SERVICES_WITHOUT_ENDPOINTS=$(kubectl get endpoints -n metabob --no-headers 2>/dev/null | awk '$2 == "<none>"' | wc -l)
TOTAL_SERVICES=$(kubectl get endpoints -n metabob --no-headers 2>/dev/null | wc -l)

if [ "$SERVICES_WITHOUT_ENDPOINTS" -gt 0 ]; then
  echo "⚠️  WARNING: Some services have no endpoints"
  kubectl get endpoints -n metabob | grep "<none>"
else
  echo "✅ All services have endpoints"
fi
\`\`\`

**Detection Logic:**
- Uses \`awk '$2 == "<none>"'\` to find services without backing pods
- Indicates pods failed to start or selector mismatch
- Stores count in \`SERVICES_WITHOUT_ENDPOINTS\` for final validation

**Gap:** NONE - Already implemented correctly

---

## Data Flow

\`\`\`
kubectl cluster check → namespace validation → pod status count → service endpoint check → conditional exit (exit 0 if healthy, exit 1 if issues)
\`\`\`

**Detailed Flow:**
1. Check cluster connectivity (exit 1 if cluster not running)
2. Verify kubectl context (warn if not docker-desktop)
3. Check metabob namespace exists (exit 1 if missing)
4. Count pods not in Running state → PODS_NOT_READY
5. Count services without endpoints → SERVICES_WITHOUT_ENDPOINTS
6. Display NodePort services and access URLs
7. Conditional exit:
   - IF PODS_NOT_READY == 0 AND SERVICES_WITHOUT_ENDPOINTS == 0
   - THEN exit 0
   - ELSE exit 1

---

## Current State vs Desired State

| Component | Previous State | Current State | Desired State | Gap |
|-----------|----------------|---------------|---------------|-----|
| **Pod Health Check** | grep -v "Running\\|Completed" | grep -v "Running\\|Completed" | Detect all non-healthy states | ✅ NONE |
| **Service Endpoint Check** | awk '$2 == "<none>"' | awk '$2 == "<none>"' | Detect missing endpoints | ✅ NONE |
| **Success Message** | ✅ VALIDATION PASSED | ✅ VALIDATION PASSED | Clear success indicator | ✅ NONE |
| **Failure Message** | ⚠️ VALIDATION WARNING | ❌ VALIDATION FAILED | Clear failure indicator | ✅ NONE |
| **Success Exit Code** | Implicit (reached end) | \`exit 0\` | Return 0 | ✅ NONE |
| **Failure Exit Code** | **BUG: Returned 0** | \`exit 1\` | Return 1 | ✅ FIXED |
| **CI/CD Compatibility** | **NOT USABLE** | **READY** | Programmatic detection | ✅ FIXED |

---

## Git History

**Fix Commit:** \`cf4e0d097aa7f8ce6d47d2a1cabe8836fdd6f32f\`
**Author:** Avi Gopal <avi@metabob.com>
**Date:** Thu Feb 26 19:13:19 2026 -0800
**Wrapper Commit:** \`02c8de45993b4d40597f6c1f8b64e15b0632f80a\` (updated submodule pointer)

**Changes:**
- Changed status from WARNING to FAILED when issues detected
- Added explicit exit 1 when pods not ready or services have no endpoints
- Script now properly returns exit code 1 for CI/CD automation
- Previously always returned 0 despite detecting CrashLoopBackOff/ImagePullBackOff

---

## Validation Testing

**Test Execution:**
\`\`\`bash
cd repos/platform
./scripts/validate-local-deployment.sh
echo "Exit code: $?"
\`\`\`

**Test Results:**
- Current deployment has 2 pods not ready (devbob CrashLoopBackOff, redis ImagePullBackOff)
- Current deployment has 1 service without endpoints (redis-replicas <none>)
- Script output: "❌ VALIDATION FAILED: Deployment has issues"
- Exit code: **1** (CORRECT)
- Expected exit code: **1**
- ✅ Programmatic detection works correctly

---

## CI/CD Integration Patterns

### Bash Script
\`\`\`bash
cd repos/platform
./scripts/validate-local-deployment.sh
if [ $? -eq 0 ]; then
  echo "✅ Deployment validated"
else
  echo "❌ Deployment failed"
  exit 1
fi
\`\`\`

### GitHub Actions
\`\`\`yaml
- name: Validate Deployment
  run: |
    cd repos/platform
    ./scripts/validate-local-deployment.sh
  timeout-minutes: 5

- name: Handle Failure
  if: failure()
  run: |
    kubectl get pods -n metabob
    kubectl logs -n metabob --tail=100
\`\`\`

---

## Compliance Assessment

**Overall Compliance: 100%**

✅ Pod Health Detection: Implemented correctly
✅ Service Endpoint Detection: Implemented correctly
✅ Exit Code 0 on Success: Implemented correctly
✅ Exit Code 1 on Failure: Implemented correctly (FIXED)
✅ Clear Failure Messages: Implemented correctly (IMPROVED)
✅ CI/CD Automation Ready: Verified working

---

## Files Involved

- **Primary:** \`repos/platform/scripts/validate-local-deployment.sh\` (102 lines)
- **Documentation:**
  - \`deployment-validation-report-local.md\`
  - \`tests/validation-harnesses/local-docker-desktop-deployment-README.md\`
- **Related:**
  - \`repos/platform/deployments/metabob/helmfile.yaml.gotmpl\`
  - \`repos/platform/deployments/metabob/environments/local.values.yaml\`

---

## Summary

**Before:** Always returned 0, even when detecting CrashLoopBackOff and missing endpoints
**After:** Returns 1 when issues detected, enabling programmatic failure detection
**Impact:** Scripts and pipelines can now reliably detect deployment failures
**Status:** 100% compliant with specification requirements

**Recommendation:** READY FOR PRODUCTION USE in automated pipelines.`;

async function main() {
  const impulseManager = new ImpulseManager({
    storageDir: '/home/avi/.local/share/opencode/storage',
    logger: console
  });

  const impulse = await impulseManager.create({
    id: 'trace-Kubernetes-Deployment-Validation-Exit-Codes' as ImpulseKnowledgeId,
    type: 'traceAnalysis',
    pointer: {
      type: 'memo',
      content: traceContent,
      source: 'trace-task'
    },
    budget: 5000,
    metadata: {
      specificationName: 'Kubernetes-Deployment-Validation-Exit-Codes',
      compliance: '100%',
      status: 'FULLY_IMPLEMENTED_AND_VALIDATED',
      components: [
        {
          file: 'repos/platform/scripts/validate-local-deployment.sh',
          component: 'Validation Summary Logic',
          lineRange: '90-101',
          gap: 'NONE'
        },
        {
          file: 'repos/platform/scripts/validate-local-deployment.sh',
          component: 'Pod Health Check',
          lineRange: '42-61',
          gap: 'NONE'
        },
        {
          file: 'repos/platform/scripts/validate-local-deployment.sh',
          component: 'Service Endpoint Check',
          lineRange: '64-77',
          gap: 'NONE'
        },
        {
          file: 'repos/platform/scripts/validate-local-deployment.sh',
          component: 'Exit Code Logic',
          lineRange: '91-101',
          gap: 'NONE - FIXED'
        }
      ],
      gitCommits: {
        fixCommit: 'cf4e0d097aa7f8ce6d47d2a1cabe8836fdd6f32f',
        wrapperCommit: '02c8de45993b4d40597f6c1f8b64e15b0632f80a'
      }
    }
  });

  console.log('\n✅ Impulse created successfully:');
  console.log(`   ID: ${impulse.id}`);
  console.log(`   Type: ${impulse.type}`);
  console.log(`   Budget: ${impulse.budget} tokens`);
  console.log(`   Status: ${impulse.metadata?.status}`);
  console.log(`   Compliance: ${impulse.metadata?.compliance}`);
  console.log(`   Components: ${impulse.metadata?.components?.length} traced`);
  console.log('\nImpulse ready for downstream validation and enforcement tasks.');
}

main().catch(console.error);
