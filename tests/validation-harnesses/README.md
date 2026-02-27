# Validation Harnesses

This directory contains validation harnesses for deployment constraints.

## Vessel Registry Constraint Harness

**File:** `vessel-registry-constraint-harness.js`

**Purpose:** Validates that SurrealDB vessel_registry table contains all 3 vessels (devbob-0, devbob-1, devbob-2) with their pod IPs, ACP endpoints, status, and heartbeat timestamps.

### Usage

#### Standalone (with port-forward)
```bash
# Terminal 1: Port-forward to SurrealDB
kubectl port-forward -n metabob svc/surrealdb 8000:8000

# Terminal 2: Run validation
node tests/validation-harnesses/vessel-registry-constraint-harness.js
```

#### With custom SurrealDB host
```bash
SURREAL_HOST=surrealdb.metabob.svc.cluster.local \
SURREAL_PORT=8000 \
node tests/validation-harnesses/vessel-registry-constraint-harness.js
```

#### Programmatic usage
```javascript
import { runValidation } from './vessel-registry-constraint-harness.js'

const result = await runValidation({
  host: 'localhost',
  port: 8000,
  namespace: 'metabob',
  database: 'devbob'
})

console.log(`Validation: ${result.pass ? 'PASS' : 'FAIL'}`)
console.log(`Vessels found: ${result.actual.recordCount}`)
result.errors.forEach(err => console.log(`Error: ${err}`))
```

### Validation Checks

The harness performs the following checks:

1. **Record Count:** At least 3 vessels registered
2. **Vessel Names:** devbob-0, devbob-1, devbob-2 all present
3. **Required Fields:** All vessels have pod_name, pod_ip, acp_endpoint, status, last_heartbeat, registered_at
4. **Pod IP:** Not "unknown" or empty
5. **ACP Endpoint:** Contains "devbob-headless" in correct format
6. **Heartbeat Freshness:** last_heartbeat within 5 minutes of current time

### Expected Output

#### PASS (all constraints met)
```
================================================================================
Vessel Registry Constraint Validation Harness
================================================================================

Configuration: localhost:8000

[INFO] Starting vessel registry validation
[INFO] Found 3 vessels: devbob-0, devbob-1, devbob-2
[INFO] ✅ Vessel registry validation PASSED (0 warnings)

Results:
  Status: ✅ PASS
  Records found: 3

Details:
  - devbob-0: 10.1.0.63 → devbob-0.devbob-headless:3000
  - devbob-1: 10.1.0.64 → devbob-1.devbob-headless:3000
  - devbob-2: 10.1.0.65 → devbob-2.devbob-headless:3000
```

#### FAIL (constraints not met)
```
[ERROR] ❌ Vessel registry validation FAILED (2 errors)

Results:
  Status: ❌ FAIL
  Records found: 1

Errors:
  ❌ Insufficient vessels: found 1, expected at least 3
  ❌ Missing vessels: devbob-1, devbob-2
```

### Integration with CI/CD

Add to your deployment validation pipeline:

```bash
#!/bin/bash
set -e

echo "Validating vessel registry..."

# Port-forward in background
kubectl port-forward -n metabob svc/surrealdb 8000:8000 &
PF_PID=$!
sleep 3

# Run validation
node tests/validation-harnesses/vessel-registry-constraint-harness.js

# Cleanup
kill $PF_PID

echo "✅ Vessel registry validation passed"
```

### Test Cases

See `/tmp/vessel-registry-validation-summary.json` for detailed test case specifications.

---

## DevBob Container Clean Environment Constraints Harness

**File:** `devbob-container-clean-environment-harness.ts`

**Purpose:** Validates that the DevBob container is a clean binary deployment with NO source code leakage, ensuring intellectual property protection and minimal attack surface.

### Specification

The DevBob container must be a clean, production-ready environment:
- ✅ Contains ONLY: standalone binary, venv, entrypoint, runtime deps, plugins
- ❌ Must NOT contain: repos/ directory, .ts files, workspace source code
- ✅ Multi-stage build discards all source code
- ✅ Final image is production-ready with minimal attack surface

### Usage

#### Run harness
```bash
bun run tests/validation-harnesses/devbob-container-clean-environment-harness.ts
```

#### Exit codes
- 0 = All tests pass (container meets clean environment constraints)
- 1 = Some tests fail (violations detected)

#### Programmatic usage
```typescript
import { runValidation } from './devbob-container-clean-environment-harness'

const result = runValidation()

console.log(`Pass: ${result.overallPass}`)
console.log(`Tests: ${result.passed}/${result.totalTests}`)

result.results.forEach(test => {
  console.log(`${test.testCase}: ${test.pass ? 'PASS' : 'FAIL'}`)
})
```

### Test Cases

1. **Multi-stage Build Structure** - Verifies 3-stage build (metabob-cli-builder, opencode-binary, runtime)
2. **No Source Code in Runtime Stage** - Ensures NO COPY commands for source code
3. **Bootstrap Templates Copied** - Verifies templates exist at /metabob-proto/activities/bootstrap/
4. **Build Script Dockerfile Reference** - Ensures build uses docker/Dockerfile.devbob
5. **Unconditional Activity Execution** - Verifies config activity runs without backend dependency
6. **Validation Template Clean Environment** - Ensures validation tests for clean deployment
7. **Container Runtime Clean Environment** - Runtime verification (requires built image)

### Validation Strategy

**Phase 1: Static Analysis** (fast, no Docker required)
- Parse Dockerfile, scripts, templates
- Verify configuration matches specification
- Test cases: 1-6

**Phase 2: Runtime Verification** (slow, requires Docker image)
- Build container, start it, exec commands
- Verify clean environment at runtime
- Test case: 7

### Expected Output

#### PASS (all constraints met)
```
================================================================================
Validation Harness: DevBob Container Clean Environment Constraints
================================================================================

✅ PASS - Multi-stage Build Structure
  Dockerfile uses correct multi-stage build structure

✅ PASS - No Source Code in Runtime Stage
  Runtime stage only copies artifacts from builders, no source code

✅ PASS - Bootstrap Templates Copied
  Bootstrap templates are copied to container

✅ PASS - Build Script Dockerfile Reference
  Build script uses correct production Dockerfile (docker/Dockerfile.devbob)

✅ PASS - Unconditional Activity Execution
  Activity execution is unconditional with backend_available variable

✅ PASS - Validation Template Clean Environment
  Validation template correctly tests for clean binary deployment

✅ PASS - Container Runtime Clean Environment
  Container runtime environment is clean - NO source code leakage detected

================================================================================
Results: 7/7 tests passed
Status: ✅ ALL TESTS PASSED
================================================================================
```

#### FAIL (constraints violated)
```
❌ FAIL - No Source Code in Runtime Stage
  Runtime stage contains source code COPY commands
  Expected: { "copiesRepos": false }
  Actual: { "copiesRepos": true }

❌ FAIL - Container Runtime Clean Environment
  Container runtime has issues - source code leakage detected
  Expected: { "hasRepos": false }
  Actual: { "hasRepos": true }
```

### Integration with CI/CD

Add to your build pipeline:

```yaml
# .github/workflows/validate-devbob.yml
name: Validate DevBob Clean Environment

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Validate Clean Environment (Static)
        run: bun run tests/validation-harnesses/devbob-container-clean-environment-harness.ts
      
      - name: Build DevBob Image
        run: ./scripts/build-devbob.sh
      
      - name: Validate Clean Environment (Runtime)
        run: bun run tests/validation-harnesses/devbob-container-clean-environment-harness.ts
```

### Compliance Matrix

| Constraint | Test Case | Validates |
|------------|-----------|-----------|
| Standalone binary | 2, 7 | Only binary at /usr/local/bin/opencode, no source |
| metabob-cli venv | 2, 7 | Only venv at /opt/metabob-cli/.venv, no source |
| Entrypoint script | 5, 7 | Unconditional config at /usr/local/bin/entrypoint.sh |
| Runtime deps | 2 | Only runtime dependencies (git, python3, bun, ca-certs) |
| Pre-installed plugins | 7 | Plugins at /root/.cache/opencode |
| NO repos/ directory | 2, 7 | NO source code leakage |
| NO TypeScript source | 2, 7 | NO .ts files in runtime paths |
| NO workspace source | 2, 7 | NO workspace source code |
| Minimal size | 1, 2 | Multi-stage build discards all source |
| Explicit documentation | 2 | Dockerfile comments state 'NO source code' |

### Test Cases File

Detailed test case specifications: `devbob-container-clean-environment-test-cases.json`

### Related Documentation

- Trace: `TRACE_DEVBOB_CONTAINER_CLEAN_ENVIRONMENT.md`
- Enforcement: `ENFORCEMENT_DEVBOB_CONTAINER_CLEAN_ENVIRONMENT.md`
- Specification: DevBob Container Clean Environment Constraints
