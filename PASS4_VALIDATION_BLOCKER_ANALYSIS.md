# Pass 4 Validation Blocker Analysis

## Issue Summary

Pass 4 validation harness fails with CLI interface mismatch. The validation was designed based on incorrect assumptions about how activity templates are executed.

## Root Cause

### What the Validation Harness Expected
```bash
kubectl exec -n metabob devbob-pod -- opencode activity create-activity \
  --variables '{"activityName":"..."}' \
  --reason 'Pass 4: Validate meta-template execution'
```

### What Actually Exists
```bash
# Available commands:
opencode activity list
opencode activity template
opencode activity run <directory>
opencode activity init
opencode activity evolve [template-id]

# NO direct template execution by name
# NO --variables or --reason flags
```

### Actual Error
```
ERROR: Unknown arguments: variables, reason, create-activity
command terminated with exit code 1
```

## Architecture Reality

### How Activity Templates Actually Work

1. **Bootstrap templates** are loaded at startup:
   - Located in `/metabob-proto/activities/bootstrap/`
   - Named: `create-activity-self-contained.json`, `debug-activity-self-contained.json`, etc.
   - Automatically registered by OpenCode on startup

2. **Execution happens via Activity tool** in interactive sessions:
   - User starts OpenCode session (CLI or ACP)
   - Within session, calls Activity tool with template ID
   - Template is resolved, variables injected, tasks executed

3. **NOT accessible as direct CLI commands**:
   - Cannot run `opencode activity create-activity` 
   - Cannot pass `--variables` or `--reason` flags to activity command
   - Templates are internal to the Activity tool system

## Infrastructure Status

✅ **Infrastructure is WORKING**:
- DevBob pod: `devbob-766dcccf49-hfql6` (Running, Ready)
- RPC API pod: `metabob-rpc-api-5c5dfb6b9b-rbhm8` (Running)
- SurrealDB pod: `surrealdb-5bdddd9989-sdm5g` (Running)
- Redis pod: `redis-master-0` (Running)

✅ **Bootstrap templates loaded**:
```
INFO service=bootstrap-templates count=6 source=embedded-imports 
     loaded bootstrap templates from embedded data
```

✅ **Lifecycle hooks registered**:
- memory-management
- activity-recommendation-injection
- metabob-context-preparation
- impulse-learning-init
- impulse-learning-flush

❌ **Validation harness uses wrong interface**

## Solutions

### Option 1: Use ACP Delegation (Architecturally Correct)

**Approach**: Start ACP server in devbob pod, delegate tasks via ACP client

```typescript
// From host
import { ACPClient } from '@agentclientprotocol/sdk';

const client = new ACPClient('http://devbob-pod:8080');
const session = await client.startSession({
  directory: '/workspace',
  prompt: 'Use the Activity tool to execute create-activity template with variables: ...'
});

// This properly invokes the Activity tool within an OpenCode session
```

**Pros**:
- Matches actual OpenCode architecture
- Tests real agent workflow
- Exercises ACP communication layer
- Can observe tool calls and results

**Cons**:
- More complex setup
- Requires ACP server running in pod (already available based on logs)

### Option 2: Use activity run with Prompt Directory

**Approach**: Create prompt files, use `opencode activity run`

```bash
# Create test directory with prompts
kubectl exec -n metabob devbob-pod -- sh -c '
mkdir -p /tmp/test-activity
echo "Execute create-activity template" > /tmp/test-activity/01-create.txt
opencode activity run /tmp/test-activity
'
```

**Pros**:
- Uses documented CLI interface
- Simpler than ACP
- Direct execution path

**Cons**:
- Doesn't test Activity tool interface directly
- Prompt-based, not template-variable-based

### Option 3: Fix Validation Harness CLI Assumptions

**Approach**: Rewrite harness to start OpenCode sessions, use stdin prompts

```bash
# Start interactive session, pipe commands
kubectl exec -i -n metabob devbob-pod -- opencode << EOF
Use the Activity tool to execute create-activity with these variables:
- activityName: "REST API for user management"
- purpose: "Pass 4 validation test"
EOF
```

**Pros**:
- Tests user-facing workflow
- No ACP complexity

**Cons**:
- Hard to parse structured output
- Difficult to extract activity_id
- Interactive session management complex

## Recommended Solution

**Use Option 1 (ACP Delegation)** because:

1. **Architecturally sound**: Matches how devbob agents actually work
2. **Already available**: ACP server runs in devbob pod (seen in logs: `service=acp-command setup connection`)
3. **Observable**: Can track tool calls, extract activity_id, verify data flow
4. **Testable**: Can verify trailblazing, lifecycle hooks, database records
5. **Matches Pass 4 goals**: "Actually execute meta-templates and track real behavior"

## Implementation Plan

### Phase 1: ACP Client Validation Script

Create `tests/validation-harnesses/dynamic-activity-creation-devbob-execution-tracking-harness-acp.ts`:

```typescript
import { ACPClient } from '@agentclientprotocol/sdk';

// Connect to devbob ACP server
const podIP = getPodIP('devbob-pod');
const client = new ACPClient(`http://${podIP}:8080`);

// Start session with Activity tool invocation
const session = await client.startSession({
  directory: '/workspace',
  prompt: `Use the Activity tool to execute the create-activity template with these variables:
- activityName: "REST API for user management"  
- purpose: "Pass 4 validation - execution tracking"

Reason: Pass 4: Validate meta-template execution with trailblazing and lifecycle hooks`
});

// Monitor tool calls
session.on('tool_call', (tool) => {
  if (tool.name === 'activity') {
    console.log('✅ Activity tool called');
    console.log('Template ID:', tool.input.templateId);
    console.log('Variables:', tool.input.variables);
  }
});

// Wait for completion
await session.waitForCompletion();

// Extract activity_id from output
const activityId = extractActivityIdFromResponse(session.response);

// Verify in SurrealDB, Redis, etc.
```

### Phase 2: Update Execution Script

Update `execute-meta-templates-pass4.sh` to:
1. Verify ACP server is listening (already checked in deployment)
2. Get pod IP for ACP connection
3. Execute ACP-based validation
4. Parse structured results

### Phase 3: Update Documentation

- Mark CLI-based approach as incorrect
- Document ACP-based validation as canonical
- Update EXECUTION_GUIDE_pass4.md with correct workflow

## Timeline

- **Immediate**: Document this finding ✅ (this file)
- **Next**: Implement ACP-based validation harness
- **Then**: Run validation, verify PASS status
- **Finally**: Update Pass 4 spec with architecture learnings

## Key Learnings

1. **Activity templates ≠ CLI commands**
   - Templates are data structures, not executables
   - Executed via Activity tool in sessions
   - Cannot be called directly from bash

2. **Pass 4 spec was based on incorrect assumptions**
   - Assumed CLI interface: `opencode activity <template-name>`
   - Reality: Activity tool in interactive sessions
   - Need ACP or prompt-based execution

3. **Infrastructure is ready, interface was wrong**
   - All pods running correctly
   - Bootstrap templates loaded successfully  
   - Lifecycle hooks registered
   - Just need correct execution method

## Status

- **Infrastructure**: ✅ READY
- **Templates**: ✅ LOADED
- **Validation Harness**: ❌ WRONG INTERFACE
- **Fix Required**: ACP-based validation harness
- **ETA**: ~2 hours to implement + test

## Next Actions

1. ✅ Document blocker (this file)
2. ⏳ Implement ACP-based validation harness
3. ⏳ Test with real devbob pod
4. ⏳ Verify PASS criteria
5. ⏳ Update Pass 4 documentation

---

**Created**: 2026-03-03 05:30 PST  
**Author**: OpenCode Agent  
**Context**: Pass 4 validation execution attempt #2  
**Blocker**: CLI interface mismatch discovered during execution
