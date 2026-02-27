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
