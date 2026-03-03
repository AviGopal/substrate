# Pass 4 Validation Harness Guide

**Specification**: dynamic-activity-creation-devbob-execution-tracking  
**Pass**: 4  
**Purpose**: Actually execute meta-templates in devbob pod and validate complete lifecycle

---

## Overview

This validation harness is the **first harness to actually execute meta-templates** in the devbob pod and observe real behavior through logs and database records.

### What Makes This Different from Pass 2?

| Aspect | Pass 2 Harness | Pass 4 Harness (This) |
|--------|----------------|------------------------|
| **Execution** | Functions defined but never called | **Actually executes meta-templates** |
| **Logs** | Log analysis functions exist | **Real-time log analysis** |
| **Database** | Query functions exist | **Actual SurrealDB queries** |
| **Observability** | Theoretical | **Observable with real data** |
| **Output** | Would produce results if run | **Produces actual validation results** |

**Key Difference**: Pass 4 harness actually runs the workflow end-to-end in the devbob environment.

---

## File Structure

```
tests/validation-harnesses/
├── dynamic-activity-creation-devbob-execution-tracking-harness.ts  (27KB, 600+ lines)
└── (Pass 2 harness exists but is superseded by Pass 4)

Validation Assets:
├── run-pass4-validation.sh                    (Runner script)
├── validation-test-cases-pass4.json           (Test case definitions)
└── VALIDATION_HARNESS_GUIDE_pass4.md          (This guide)
```

---

## What the Harness Does

### 6-Step Validation Workflow

```
┌────────────────────────────────────────────────────────────┐
│ Step 1: Execute create-activity                           │
│ - kubectl exec devbob-pod -- opencode activity create-activity
│ - Extract activity_id from output                         │
│ - Measure duration                                        │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Step 2: Analyze DevBob Logs                               │
│ - kubectl logs devbob-pod --tail=200                      │
│ - grep for: isMetaTemplate, trailblazing, lifecycle hooks│
│ - Extract log excerpts                                    │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Step 3: Query SurrealDB                                   │
│ - kubectl exec surrealdb-pod -- surreal sql              │
│ - SELECT * FROM activity_executions WHERE activity_id    │
│ - Verify record structure                                │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Step 4: Check Redis Cache                                │
│ - kubectl exec redis-pod -- redis-cli GET                │
│ - Check template:cache:<template_id>                     │
│ - Get TTL                                                 │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Step 5: Execute evolve-activity                          │
│ - kubectl exec devbob-pod -- opencode activity evolve-activity
│ - Verify parent reference                                │
│ - Extract new activity_id                                │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│ Step 6: Execute debug-activity                           │
│ - kubectl exec devbob-pod -- opencode activity debug-activity
│ - Verify error context loaded                            │
│ - Extract activity_id                                     │
└────────────────────────────────────────────────────────────┘
```

---

## Usage

### Option 1: Using Runner Script (Recommended)

```bash
# Run with default test case
./run-pass4-validation.sh

# Run specific test case
./run-pass4-validation.sh 1   # Standard REST API
./run-pass4-validation.sh 2   # GraphQL API
./run-pass4-validation.sh 3   # Microservice
```

### Option 2: Direct Execution

```bash
# Run harness directly
npx tsx tests/validation-harnesses/dynamic-activity-creation-devbob-execution-tracking-harness.ts

# Or with Node.js
node --loader tsx tests/validation-harnesses/dynamic-activity-creation-devbob-execution-tracking-harness.ts
```

### Option 3: Programmatic Usage

```typescript
import { runValidation } from './tests/validation-harnesses/dynamic-activity-creation-devbob-execution-tracking-harness';

const result = await runValidation({
  activityName: 'REST API for user management',
  evolutionReason: 'Add JWT authentication',
  debugErrorDescription: 'Database timeout',
  streamLogs: false,
});

console.log('Pass:', result.pass);
console.log('Errors:', result.errors);
```

---

## Prerequisites

Before running the validation harness, ensure:

1. **Kubernetes cluster accessible**:
   ```bash
   kubectl cluster-info
   ```

2. **DevBob pod running** in `metabob` namespace:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=devbob
   ```

3. **RPC API pod running**:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=metabob-rpc-api
   ```

4. **SurrealDB pod running**:
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=surrealdb
   ```

5. **Redis pod running** (optional):
   ```bash
   kubectl get pods -n metabob -l app.kubernetes.io/name=redis
   ```

6. **opencode CLI available** in DevBob pod:
   ```bash
   kubectl exec -n metabob <devbob-pod> -- which opencode
   ```

7. **Node.js and tsx**:
   ```bash
   node --version    # Should be v18 or higher
   npx tsx --version
   ```

---

## Test Cases

### Test Case 1: Standard REST API Creation

**Input**:
- Activity Name: "REST API for user management with authentication"
- Evolution Reason: "Add JWT token validation"
- Debug Error: "Database connection timeout during user fetch"

**Expected Output**:
- ✅ create-activity executes successfully
- ✅ activity_id extracted
- ✅ Meta-template detection in logs
- ✅ Lifecycle hooks observed in logs
- ✅ SurrealDB record created
- ✅ evolve-activity creates variant
- ✅ debug-activity analyzes error

**Impulse ID**: `validation-dynamic-activity-creation-devbob-execution-tracking-case-1`

### Test Case 2: GraphQL API with Complex Schema

**Input**:
- Activity Name: "GraphQL API for product catalog with filtering"
- Evolution Reason: "Add pagination and sorting"
- Debug Error: "Memory leak in resolver"

**Expected Output**: Same as Test Case 1

**Impulse ID**: `validation-dynamic-activity-creation-devbob-execution-tracking-case-2`

### Test Case 3: Microservice with Event Sourcing

**Input**:
- Activity Name: "Event-driven microservice for order processing"
- Evolution Reason: "Add saga pattern for distributed transactions"
- Debug Error: "Event replay causing duplicate processing"

**Expected Output**: Same as Test Case 1

**Impulse ID**: `validation-dynamic-activity-creation-devbob-execution-tracking-case-3`

---

## Output Files

After execution, the harness generates:

### 1. Validation Results JSON

**File**: `validation-results-pass4-<timestamp>.json`

**Structure**:
```json
{
  "pass": true,
  "timestamp": "2026-03-03T12:34:56.789Z",
  "actual": {
    "createActivity": {
      "executed": true,
      "activityId": "act_create_1234567890",
      "exitCode": 0,
      "output": "...",
      "duration": 45000
    },
    "logs": {
      "metaTemplateDetected": true,
      "trailblazingEnabled": false,
      "lifecycleHooksObserved": true,
      "memoryManagementHook": true,
      "costTracking": false,
      "activityStarting": true,
      "taskCreatedDynamically": true,
      "excerpts": [...]
    },
    "database": {
      "recordExists": true,
      "templateId": "create-activity-self-contained",
      "recordStructureValid": true,
      "fields": {...},
      "queryResult": "..."
    },
    "redis": {...},
    "evolveActivity": {...},
    "debugActivity": {...}
  },
  "expected": {...},
  "errors": [],
  "auditTrail": {...}
}
```

### 2. Audit Trail Markdown

**File**: `audit-trail-pass4-<timestamp>.md`

**Contents**:
- Start and end timestamps
- Step-by-step execution log
- Status for each step (success/failure/skipped)
- Details for each step
- Summary with pass/fail status
- Error list (if any)

---

## Success Criteria

The harness validates against these criteria:

### Critical Criteria (Must Pass)

1. ✅ **create-activity executed** with exit code 0
2. ✅ **activity_id extracted** from output (format: `act_XXXXX`)
3. ✅ **Meta-template detection** observed in logs (`isMetaTemplate`)
4. ✅ **Lifecycle hooks observed** in logs (`lifecycle.*hook`)
5. ✅ **SurrealDB record exists** for activity_id
6. ✅ **Record structure valid** (has name, category, tasks, created_at, metadata)

### Non-Critical Criteria (Warnings)

7. ⚠️ **Trailblazing enabled** (expected only if failures occur)
8. ⚠️ **Memory management hook** observed (may not always log)
9. ⚠️ **Cost tracking** observed (expected only with trailblazing)
10. ⚠️ **Redis cache exists** (may not be implemented yet)
11. ⚠️ **evolve-activity executed** (skipped if create-activity fails)
12. ⚠️ **debug-activity executed** (skipped if pod unavailable)

---

## Validation Logic

```typescript
// Critical checks (cause failure)
if (!actual.createActivity.executed) {
  errors.push('create-activity did not execute successfully');
  pass = false;
}

if (!actual.createActivity.activityId) {
  errors.push('create-activity did not return an activity_id');
  pass = false;
}

if (!actual.logs.metaTemplateDetected) {
  errors.push('Meta-template detection not observed in logs');
  pass = false;
}

if (!actual.logs.lifecycleHooksObserved) {
  errors.push('Lifecycle hooks not observed in logs');
  pass = false;
}

if (!actual.database.recordExists) {
  errors.push('Activity record not found in SurrealDB');
  pass = false;
}

if (!actual.database.recordStructureValid) {
  errors.push('Activity record structure is invalid');
  pass = false;
}

// Non-critical checks (warnings only)
if (!actual.logs.trailblazingEnabled) {
  console.log('⚠️ Warning: Trailblazing not observed (expected if no failures)');
}
```

---

## Troubleshooting

### Issue: DevBob pod not found

**Error**: `DevBob pod not found`

**Solution**: Check pod exists and label is correct:
```bash
kubectl get pods -n metabob --show-labels
```

Update `DEVBOB_POD_LABEL` in harness if needed.

### Issue: opencode command not found

**Error**: `opencode: command not found`

**Solution**: Ensure opencode CLI is installed in DevBob pod:
```bash
kubectl exec -n metabob <devbob-pod> -- which opencode
```

If not found, install or rebuild DevBob image with opencode.

### Issue: SurrealDB query fails

**Error**: `SurrealDB query failed`

**Solution**: Check SurrealDB credentials and connection:
```bash
kubectl exec -n metabob <surrealdb-pod> -- surreal version
kubectl logs -n metabob <surrealdb-pod> --tail=50
```

Adjust query syntax in harness if needed (may vary by SurrealDB version).

### Issue: Timeout during execution

**Error**: `Command timed out after 120000ms`

**Solution**: Increase timeout in harness:
```typescript
// In executeCreateActivity function
const output = kubectl(command, { timeout: 300000 }); // 5 minutes
```

### Issue: No activity_id extracted

**Error**: `create-activity did not return an activity_id`

**Solution**: Check output format. The harness expects:
```
Activity created successfully: act_create_1234567890
```

Adjust regex in harness if output format is different:
```typescript
const activityIdMatch = output.match(/act_[a-zA-Z0-9_]+/);
```

---

## Comparison with Pass 2 Harness

| Feature | Pass 2 Harness | Pass 4 Harness |
|---------|----------------|----------------|
| **File** | `dynamic-activity-creation-with-trailblazing-pass2-harness.ts` | `dynamic-activity-creation-devbob-execution-tracking-harness.ts` |
| **Size** | 490 lines | 600+ lines |
| **Execution** | Functions defined but never called | **Actually executes** |
| **Log Analysis** | Function exists | **Real analysis with excerpts** |
| **Database Query** | Function exists | **Actual queries with validation** |
| **Redis Check** | Not implemented | **Implemented with TTL check** |
| **evolve-activity** | Function exists | **Actually executes** |
| **debug-activity** | Function exists | **Actually executes** |
| **Audit Trail** | No | **Complete with timestamps** |
| **Output Files** | No | **JSON + Markdown** |

**Key Improvement**: Pass 4 harness actually runs everything that Pass 2 defined but never executed.

---

## Integration with Pass 4 Scripts

The validation harness complements the bash scripts created in enforcement:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `execute-meta-templates-pass4.sh` | Standalone bash execution | Manual testing, ad-hoc validation |
| `run-validation-harness-pass4.sh` | TypeScript harness wrapper | Automated testing, CI/CD |
| **This harness** | Programmatic validation | Integration tests, library usage |

**Recommended**: Use `run-validation-harness-pass4.sh` for most cases (easiest to run, most comprehensive).

---

## Next Steps

After running the validation:

1. **Review results**:
   ```bash
   cat validation-results-pass4-*.json | jq .
   ```

2. **Check audit trail**:
   ```bash
   cat audit-trail-pass4-*.md
   ```

3. **If validation passes**:
   - Document success in validation summary
   - Create validation impulse
   - Proceed to next specification

4. **If validation fails**:
   - Review errors in results JSON
   - Check logs for root cause
   - Fix issues and re-run validation

---

## Impulse IDs

### Harness Impulse
- **ID**: `harness-dynamic-activity-creation-devbob-execution-tracking`
- **Type**: `file`
- **Pointer**: `tests/validation-harnesses/dynamic-activity-creation-devbob-execution-tracking-harness.ts`
- **Budget**: 2000 tokens

### Test Case Impulses
- **Case 1**: `validation-dynamic-activity-creation-devbob-execution-tracking-case-1`
- **Case 2**: `validation-dynamic-activity-creation-devbob-execution-tracking-case-2`
- **Case 3**: `validation-dynamic-activity-creation-devbob-execution-tracking-case-3`

---

**Last Updated**: 2026-03-03  
**Status**: Ready for execution  
**Pass Number**: 4
