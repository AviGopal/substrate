# Unified Activity Model Implementation

## Overview

We've implemented a unified model where **codebase functions ARE activities**. This eliminates the separation between "code" and "activities" - they're all state transformations that can be observed, measured, and learned from.

## What We Built

### 1. Schema Design (`sql/008-unified-activity-model.surql`)

**`activity_registry` table** - Unified storage for ALL activities:
```typescript
{
  id: string,  // "template-id" OR "{vessel}:{function}"
  execution_format: "template" | "vessel-function" | "native-binary" | "mcp-tool",

  // For vessel functions:
  source_location: {
    vesselId, file, line, functionName, className
  },
  intent: {
    purpose, confidence, source, rationale
  },

  // Learned from runtime (all formats):
  impulses: [],  // Which impulses this activity uses
  tools: [],     // Which tools this activity calls
  executions: 0,
  successes: 0,
  failures: 0,
  alpha: 1.0,    // Thompson Sampling
  beta: 1.0
}
```

**`activity_dataflows` table** - Function call chains:
```typescript
{
  caller_activity_id: string,
  callee_activity_id: string,
  data_passed: object,    // Impulses/args passed
  data_returned: object,  // Results returned
  success: boolean,
  call_count: number
}
```

### 2. Modified Vessel Registration

**`POST /v2/vessels/codebase/register`** now:

1. Stores vessel metadata (as before)
2. Stores function mappings (as before)
3. **NEW**: Creates an activity for each function:
   ```typescript
   {
     id: "{vesselName}:{functionName}",
     name: functionName,
     description: intent.purpose,
     execution_format: "vessel-function",
     source_location: { vesselId, file, line, functionName },
     intent: { purpose, confidence, source },
     // Thompson Sampling initialized
     alpha: 1.0,
     beta: 1.0
   }
   ```

### 3. Runtime Instrumentation (Already Operational)

**`plugin-minibob-runtime`** already captures:
- Session lifecycle
- Activity execution
- Task execution
- Tool calls
- Impulse loading

**Next step**: Link function executions to activity IDs for Thompson Sampling updates.

## Deployment Workflow

### Step 1: Apply Schema Migration

The schema must be created in SurrealDB. Options:

**A. Init Job (Recommended)**
Add to `helm/charts/surrealdb/templates/init-job.yaml`:
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: surrealdb-init
spec:
  template:
    spec:
      containers:
      - name: init
        image: metabob-activity-api:latest
        command: ["bun", "run", "scripts/init-database.ts"]
        env:
          - name: SURREALDB_URL
            value: "http://surrealdb:8000"
```

**B. Application Startup**
Modify `repos/metabob-activity-api/src/index.ts` to run migrations on startup.

**C. Manual Application (Development Only)**
```bash
kubectl exec -it deployment/metabob-activity-api -n activity-system -- \
  bun run scripts/init-database.ts
```

### Step 2: Re-deploy Activity API

```bash
cd helm
helmfile -f activity-system-minimal.yaml.gotmpl sync
```

This rebuilds and deploys the updated `metabob-activity-api` with vessel-function activity creation logic.

### Step 3: Re-burrow metabob-opencode

```bash
cd repos/minibob
bun run src/cli/burrow.ts --force /path/to/metabob-opencode
```

This will:
- Analyze 2,420 functions
- Create 500 activities (top confidence mappings)
- Initialize Thompson Sampling for each
- Register in `activity_registry`

### Step 4: Observe Runtime

As metabob-opencode runs:
- Functions execute
- Traces captured by plugin
- Linked to activity IDs
- Thompson Sampling updates
- Dataflows recorded

### Step 5: Query and Analyze

```bash
# List vessel function activities
curl "http://api.minibob.local/v2/activities/templates?execution_format=vessel-function"

# Find unused functions (execution_count = 0)
curl "http://api.minibob.local/v2/vessels/{id}/unused-functions"

# View dataflows between functions
curl "http://api.minibob.local/v2/vessels/{id}/dataflows"

# Find shadowed functions (same intent, different impl)
curl "http://api.minibob.local/v2/vessels/{id}/shadowed-functions"
```

## Key Capabilities Enabled

### 1. Unified Observability
- Same trace format for templates and functions
- Same Thompson Sampling algorithm
- Same impulse system
- Same learning loop

### 2. Runtime Analysis
- **Unused code detection**: Functions with 0 executions
- **Shadowed code detection**: Multiple functions, same intent
- **Intent misalignment**: Static intent ≠ runtime behavior
- **Dataflow visualization**: How data moves through the vessel

### 3. Activity Execution
Call vessel functions as activities:
```typescript
POST /v2/activities/execute
{
  activityId: "opencode:generateRootCauseHypothesis",
  impulses: [
    { id: "failurePatterns", pointer: { type: "activityExecutionTrace", id: "..." } },
    { id: "errorLogs", pointer: { type: "file", path: "test.log" } }
  ]
}
```

MiniBob:
1. Looks up activity metadata
2. Loads impulses (lazy, budget-aware)
3. Invokes the vessel function with impulse data
4. Captures execution trace
5. Updates Thompson Sampling

### 4. Development Insights

Use minibob to query and interpret the learned data:
```bash
# Which functions are never used?
minibob query --vessel opencode --unused

# Which functions have the same purpose?
minibob query --vessel opencode --duplicates

# Show me dataflow for "authentication"
minibob query --vessel opencode --dataflow auth

# What activities would help me fix this bug?
minibob recommend --vessel opencode --goal "Fix test failure in CI"
```

## Implementation Status

- ✅ Schema designed (`sql/008-unified-activity-model.surql`)
- ✅ Vessel registration creates activities
- ✅ Runtime instrumentation captures traces
- ⏳ Schema migration needs deployment
- ⏳ Runtime traces need linking to activity IDs
- ⏳ Analysis endpoints need implementation
- ⏳ Activity execution for vessel functions needs implementation

## Next Actions

1. **Add migration to deployment**: Init job or startup script
2. **Deploy**: `helmfile sync`
3. **Re-burrow metabob-opencode**: Test activity creation
4. **Implement Task #3**: Link runtime traces to activities
5. **Implement Task #4**: Analysis endpoints
6. **Implement Task #5**: Activity execution for vessel functions
7. **Test end-to-end**: Full observability and development loop

## Philosophy

This implementation realizes the core insight: **There is no separation between "code" and "activities"**. They are both transformations from instructional state to functional state. The serialization format (JSON template vs TypeScript function) is irrelevant - what matters is the transformation itself.

By treating vessel functions as activities, we enable:
- Learning which functions work (Thompson Sampling)
- Understanding how functions compose (dataflow analysis)
- Identifying code problems (unused, shadowed, misaligned)
- Developing with observed patterns (data-driven development)

The vessel's code IS a collection of activities. Activities ARE the development interface.
