# Validation Harnesses

This directory contains validation harnesses for testing specifications through external observation.

## minibob Testing Infrastructure Harness

**File**: `minibob-testing-infrastructure-harness.ts`

**Purpose**: Validates the minibob Testing Infrastructure Development-Deployment-Runtime-Refinement Loop specification through external observation of the closed feedback loop.

### Validation Phases

1. **Deployment State** - kubectl namespace and pod status validation
2. **Activity Validation** - test-vessel-capabilities.sh execution and results
3. **Backend Records** - API queries for execution records and metrics
4. **Boredom System** - Pod logs and environment variable validation
5. **Metrics Collection** - Local metrics files validation
6. **Infrastructure Visualization** - visualize-testing-infrastructure.sh output
7. **Helmfile Orchestration** - Multi-namespace release state validation

### Usage

#### CLI Execution

```bash
# Validate testing-minibob namespace (single pod, boredom disabled)
ts-node tests/validation-harnesses/minibob-testing-infrastructure-harness.ts testing-minibob

# Validate minibob-cluster namespace (3 pods, boredom enabled)
ts-node tests/validation-harnesses/minibob-testing-infrastructure-harness.ts minibob-cluster

# Validate with custom backend namespace
ts-node tests/validation-harnesses/minibob-testing-infrastructure-harness.ts testing-minibob custom-backend
```

#### TypeScript Import

```typescript
import { runValidation } from './tests/validation-harnesses/minibob-testing-infrastructure-harness';

const result = await runValidation({
  namespace: 'testing-minibob',
  backendNamespace: 'metabob',
  skipBoredomValidation: true,
  metricsDir: 'repos/minibob/metrics'
});

if (result.pass) {
  console.log('✅ All validation phases passed');
} else {
  console.error('❌ Validation failed');
  console.error(`Failed phases: ${result.summary.failedPhases}`);
}
```

### Test Cases

Three test case impulses are provided for different deployment scenarios:

1. **validation-minibob-testing-infrastructure-case-1**: Single Pod (testing-minibob)
   - 1 pod, boredom disabled
   - Expected: 6 phases pass, 1 phase skipped (boredom)
   - Activity tests: 3/4 pass (ACP delegation skipped)

2. **validation-minibob-testing-infrastructure-case-2**: Cluster (minibob-cluster)
   - 3 pods, boredom enabled
   - Expected: 7 phases pass, 0 phases skipped
   - Activity tests: 4/4 pass (including ACP delegation)

3. **validation-minibob-testing-infrastructure-case-3**: Development Layer (minibob-dev)
   - 1 pod, minimal resources, boredom disabled
   - Expected: 6 phases pass, 1 phase skipped (boredom)
   - Activity tests: 3/4 pass (ACP delegation skipped)

### Return Value

```typescript
interface ValidationOutput {
  pass: boolean;  // Overall result
  phase1_deploymentState: PhaseResult;
  phase2_activityValidation: PhaseResult;
  phase3_backendRecords: PhaseResult;
  phase4_boredomSystem: PhaseResult;
  phase5_metricsCollection: PhaseResult;
  phase6_infrastructureVisualization: PhaseResult;
  phase7_helmfileOrchestration: PhaseResult;
  summary: {
    totalPhases: number;      // Non-skipped phases
    passedPhases: number;     // Phases that passed
    failedPhases: number;     // Phases that failed
    skippedPhases: number;    // Phases that were skipped
  };
}

interface PhaseResult {
  pass: boolean;
  skipped?: boolean;
  actual: unknown;     // Actual values observed
  expected: unknown;   // Expected values
  error?: string;      // Error message if failed
}
```

### External Observation Points

The harness validates the infrastructure through **external observation only** (no LLM required):

- **kubectl commands** - Pod status, logs, environment variables
- **Backend API queries** - Execution records, metrics endpoints
- **File system checks** - Metrics files, script outputs
- **Script execution** - test-vessel-capabilities.sh, visualize-testing-infrastructure.sh
- **Helmfile state** - Release list, deployment orchestration

### Integration with Specification

This harness validates the specification requirements:

| Requirement | Validated By |
|-------------|--------------|
| Progressive K8s Layers | Phase 1 (deployment state) + Phase 7 (helmfile) |
| Activity Validation | Phase 2 (activity validation) |
| Backend Integration | Phase 3 (backend records) |
| Metrics Collection | Phase 5 (metrics collection) |
| Boredom System | Phase 4 (boredom system) |
| Closed Loop | All phases combined |
| Traceability | Phase 3 + Phase 5 (partial - git SHA traceability is enhancement) |

### Prerequisites

- kubectl configured with access to K8s cluster
- Deployed minibob infrastructure (via helmfile)
- Backend API accessible (metabob-rpc-api pod running)
- Metrics directory exists (repos/minibob/metrics/)

### Exit Codes

- **0**: All validation phases passed
- **1**: One or more validation phases failed

### Example Output

```
=== Validating minibob Testing Infrastructure ===
Namespace: testing-minibob
Backend Namespace: metabob
Skip Boredom Validation: true
Metrics Directory: repos/minibob/metrics

Phase 1 (Deployment State): ✅ PASS
Phase 2 (Activity Validation): ✅ PASS
Phase 3 (Backend Records): ✅ PASS
Phase 4 (Boredom System): ⏭️ SKIPPED
Phase 5 (Metrics Collection): ✅ PASS
Phase 6 (Infrastructure Visualization): ✅ PASS
Phase 7 (Helmfile Orchestration): ✅ PASS

=== Validation Summary ===
Total Phases: 6
Passed: 6
Failed: 0
Skipped: 1
Overall: ✅ PASS
```
