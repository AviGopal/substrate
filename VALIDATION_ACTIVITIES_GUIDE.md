# Activity/Impulse System Validation Activities

**Date:** 2026-02-18  
**Purpose:** Comprehensive validation of the activity/impulse system architecture

---

## Overview

Created 3 activity templates to validate the three-component architecture:

1. **validate-backend-storage.json** - Backend (metabob-rpc-api)
2. **validate-cli-orchestration.json** - Orchestrator (metabob-cli)
3. **validate-impulse-system.json** - Executor (metabob-opencode)

---

## Activity 1: Validate Backend Storage

**File:** `validate-backend-storage.json`  
**Duration:** ~1 hour  
**Validates:** Template storage, Thompson Sampling, learning updates

### Tasks

1. **prepare-test-template** (5 min)
   - Creates simple test template
   - Output: Template JSON file

2. **test-template-registration** (15 min)
   - Registers template via CLI or API
   - Retrieves template to verify storage
   - Validates all fields preserved

3. **test-thompson-sampling** (30 min)
   - Creates template variant
   - Tests variant selection (5 iterations)
   - Records execution results (2 successes, 1 failure)
   - Verifies learning (alpha/beta updates)
   - Confirms probability shift

4. **cleanup-test-data** (5 min)
   - Deletes test template
   - Removes test files

### Success Criteria

- ✅ Template stored in backend database
- ✅ All fields preserved (tasks, variables, validation)
- ✅ Thompson Sampling selects variants
- ✅ Execution results recorded
- ✅ Learning updates alpha/beta
- ✅ Probabilities shift toward successful variants

### How to Run

```bash
cd repos/metabob-opencode

# Option 1: Via activity tool
bun run opencode activity \
  --template validate-backend-storage \
  --variables '{
    "backendUrl": "http://localhost:8000",
    "testTemplate": "{...template JSON...}"
  }' \
  --reason "Validate backend storage and Thompson Sampling"

# Option 2: Register and execute
# First register the template
impulse_create({
  id: "validate-backend-def",
  type: "templateDefinition",
  pointer: {
    type: "templateDefinition",
    definition: { /* contents of validate-backend-storage.json */ },
    source: "validation"
  },
  budget: 3000
})

register_activity_template({
  impulse_id: "validate-backend-def",
  register_with_metabob: true
})

# Then execute
activity({
  templateId: "validate-backend-storage",
  variables: {
    backendUrl: "http://localhost:8000",
    testTemplate: "{...}"
  },
  reason: "Backend validation"
})
```

### Expected Output

```json
{
  "status": "done",
  "tasks": [
    {
      "id": "prepare-test-template",
      "status": "completed",
      "output": {
        "templatePath": "./test-templates/validate-backend-test-template.json",
        "templateId": "validate-backend-test-template",
        "status": "created"
      }
    },
    {
      "id": "test-template-registration",
      "status": "completed",
      "output": {
        "registration": { "success": true, "statusCode": 200 },
        "retrieval": { "success": true, "tasksCount": 2, "variablesCount": 1 },
        "validation": { "passed": true, "issues": [] }
      }
    },
    {
      "id": "test-thompson-sampling",
      "status": "completed",
      "output": {
        "variantCreation": { "success": true, "variantId": "variant-1" },
        "sampling": { "distributionReasonable": true },
        "learning": { "executionsRecorded": 3, "probabilityShift": "base variant favored" },
        "validation": { "passed": true }
      }
    },
    {
      "id": "cleanup-test-data",
      "status": "completed",
      "output": { "cleanup": { "templateDeleted": true, "fileRemoved": true } }
    }
  ]
}
```

---

## Activity 2: Validate CLI Orchestration

**File:** `validate-cli-orchestration.json`  
**Duration:** ~2 hours  
**Validates:** MCP tools, state management, incremental delivery, trailblazing

### Tasks

1. **test-mcp-tool-availability** (15 min)
   - Verifies MCP tools exposed by CLI
   - Checks orchestration tools: start_activity_execution, get_next_step, report_step_result, enter_trailblazing
   - Validates tool parameters

2. **test-execution-state-management** (30 min)
   - Creates test script to validate ActivityExecution lifecycle
   - Tests state transitions (running → validating → done)
   - Verifies current_step_index advances
   - Tests step result reporting

3. **test-incremental-step-delivery** (30 min)
   - Verifies steps delivered one at a time
   - Ensures agent can't see future steps
   - Confirms no "lookahead" in responses

4. **test-trailblazing** (30 min)
   - Simulates validation failure
   - Enters trailblazing mode
   - Verifies dynamic fix steps generated
   - Tests recovery attempts

5. **cleanup-test-scripts** (5 min)
   - Removes test Python scripts

### Success Criteria

- ✅ All 4 orchestration MCP tools available
- ✅ ActivityExecution state persists across calls
- ✅ Steps delivered incrementally (one at a time)
- ✅ current_step_index advances on report_step_result
- ✅ Trailblazing activates on failure
- ✅ Fix steps generated dynamically

### How to Run

```bash
cd repos/metabob-opencode

activity({
  templateId: "validate-cli-orchestration",
  variables: {
    cliPath: "/path/to/metabob-cli"
  },
  reason: "Validate CLI orchestration and state management"
})
```

### Expected Output

```json
{
  "status": "done",
  "tasks": [
    {
      "id": "test-mcp-tool-availability",
      "output": {
        "toolAvailability": {
          "start_activity_execution": true,
          "get_next_step": true,
          "report_step_result": true,
          "enter_trailblazing": true,
          "totalMCPTools": 30
        },
        "validation": { "passed": true }
      }
    },
    {
      "id": "test-execution-state-management",
      "output": {
        "execution": {
          "passed": true,
          "stepsCompleted": 2,
          "stateTransitions": ["running", "done"],
          "stepIndexAdvanced": true
        }
      }
    },
    {
      "id": "test-incremental-step-delivery",
      "output": {
        "incrementalDelivery": {
          "verified": true,
          "stepsDelivered": 3,
          "oneAtATime": true,
          "noLookahead": true
        }
      }
    },
    {
      "id": "test-trailblazing",
      "output": {
        "trailblazing": {
          "activated": true,
          "fixStepGenerated": true,
          "recoveryAttempts": 1
        }
      }
    }
  ]
}
```

---

## Activity 3: Validate Impulse System

**File:** `validate-impulse-system.json`  
**Duration:** ~3 hours  
**Validates:** Impulse resolution, memory agent, ephemeral agents, cross-task sharing

### Tasks

1. **test-impulse-resolution** (45 min)
   - Tests all 12 impulse pointer types
   - Tests: file, memo, component, bashOutput, commit
   - Validates budget enforcement
   - Verifies usage statistics tracking
   - Creates comprehensive test suite

2. **test-memory-agent** (30 min)
   - Tests intent classification
   - Verifies impulse creation
   - Validates priority assignment
   - Tests budget management

3. **test-ephemeral-agents** (45 min)
   - Verifies task prompts become system instructions
   - Confirms different tasks have different instructions
   - Tests impulse context injection
   - Validates variable interpolation

4. **test-cross-task-impulse-sharing** (45 min)
   - Tests Pattern 5: Cross-task impulse sharing
   - Verifies Task 1 output captured as impulse
   - Confirms Task 2 receives Task 1 output
   - Validates impulse metadata available

5. **cleanup-test-files** (5 min)
   - Removes test files

### Success Criteria

- ✅ All 12 impulse types resolve correctly
- ✅ Budget enforcement prevents overloading
- ✅ Usage statistics tracked
- ✅ Memory agent creates impulses based on intent
- ✅ Priority-based loading works
- ✅ Task prompts create ephemeral agents
- ✅ Different tasks have different instructions
- ✅ Cross-task impulse sharing works

### How to Run

```bash
cd repos/metabob-opencode

activity({
  templateId: "validate-impulse-system",
  variables: {
    opencodePath: "/path/to/metabob-opencode",
    testFile: "path/to/test/file.ts"
  },
  reason: "Validate impulse system and dynamic agent specialization"
})
```

### Expected Output

```json
{
  "status": "done",
  "tasks": [
    {
      "id": "test-impulse-resolution",
      "output": {
        "testResults": { "passed": true, "testsRun": 7, "failures": [] },
        "impulseTypes": {
          "file": "tested",
          "memo": "tested",
          "component": "tested",
          "bashOutput": "tested",
          "commit": "tested",
          "budgetEnforcement": "tested",
          "usageTracking": "tested"
        }
      }
    },
    {
      "id": "test-memory-agent",
      "output": {
        "memoryAgent": {
          "intentClassification": "working",
          "impulseCreation": "working",
          "budgetManagement": "working",
          "priorityLoading": "working"
        }
      }
    },
    {
      "id": "test-ephemeral-agents",
      "output": {
        "ephemeralAgents": {
          "promptsCaptured": 2,
          "differentInstructions": true,
          "impulseContextInjected": true,
          "specializationsVerified": true
        }
      }
    },
    {
      "id": "test-cross-task-impulse-sharing",
      "output": {
        "impulseSharing": {
          "task1OutputCaptured": true,
          "task2ReceivedImpulse": true,
          "impulseContentAccessible": true,
          "metadataAvailable": true
        }
      }
    }
  ]
}
```

---

## Running All Validations

### Sequential Execution

```bash
# 1. Backend validation (1 hour)
activity({
  templateId: "validate-backend-storage",
  variables: { backendUrl: "http://localhost:8000", testTemplate: "{...}" },
  reason: "Phase 1: Backend validation"
})

# 2. CLI validation (2 hours)
activity({
  templateId: "validate-cli-orchestration",
  variables: { cliPath: "/path/to/metabob-cli" },
  reason: "Phase 2: CLI validation"
})

# 3. Impulse system validation (3 hours)
activity({
  templateId: "validate-impulse-system",
  variables: { 
    opencodePath: "/path/to/metabob-opencode",
    testFile: "src/test.ts"
  },
  reason: "Phase 3: Impulse system validation"
})
```

### Parallel Execution (if independent)

Activities 1 and 2 can run in parallel. Activity 3 depends on OpenCode being functional.

---

## Validation Matrix

| Component | Feature | Activity | Task | Pass Criteria |
|-----------|---------|----------|------|---------------|
| **Backend** | Template storage | validate-backend-storage | test-template-registration | HTTP 200, all fields preserved |
| **Backend** | Thompson Sampling | validate-backend-storage | test-thompson-sampling | Variant selection works, probabilities shift |
| **Backend** | Learning | validate-backend-storage | test-thompson-sampling | Alpha/beta updated correctly |
| **CLI** | MCP tools | validate-cli-orchestration | test-mcp-tool-availability | All 4 tools available |
| **CLI** | State management | validate-cli-orchestration | test-execution-state-management | State persists, index advances |
| **CLI** | Incremental delivery | validate-cli-orchestration | test-incremental-step-delivery | One step at a time, no lookahead |
| **CLI** | Trailblazing | validate-cli-orchestration | test-trailblazing | Activates on failure, generates fixes |
| **OpenCode** | Impulse resolution | validate-impulse-system | test-impulse-resolution | 12 types resolve, budget enforced |
| **OpenCode** | Memory agent | validate-impulse-system | test-memory-agent | Intent classification, priority loading |
| **OpenCode** | Ephemeral agents | validate-impulse-system | test-ephemeral-agents | Different instructions per task |
| **OpenCode** | Cross-task sharing | validate-impulse-system | test-cross-task-impulse-sharing | Task outputs shared as impulses |

---

## Troubleshooting

### Backend Validation Fails

**Issue:** Template registration returns 404/500  
**Solution:** 
1. Check backend is running: `curl http://localhost:8000/health`
2. Verify API endpoint: `curl http://localhost:8000/v2/activities/templates`
3. Check backend logs for errors

**Issue:** Thompson Sampling doesn't shift probabilities  
**Solution:**
1. Verify execution results recorded
2. Check alpha/beta values in database
3. Ensure sufficient executions (need 2+ for meaningful shift)

### CLI Validation Fails

**Issue:** MCP tools not found  
**Solution:**
1. Check MCP server running: `metabob-cli mcp --transport stdio`
2. Verify tools defined: `grep '@mcp.tool' repos/metabob-cli/src/metabob_cli/mcp/*.py`
3. Check OpenCode can connect to MCP

**Issue:** State not advancing  
**Solution:**
1. Check ActivityExecution object structure
2. Verify report_step_result updates current_step_index
3. Review activity_manager.py logic

### Impulse System Validation Fails

**Issue:** Impulse resolution errors  
**Solution:**
1. Check impulse-resolver.ts for errors
2. Verify pointer types registered
3. Test individual resolvers in isolation

**Issue:** Memory agent doesn't create impulses  
**Solution:**
1. Check memory-agent.ts turn lifecycle hooks
2. Verify impulse creation in SessionMemory
3. Test intent classification logic

---

## Success Summary

After running all 3 validation activities, you should have:

- ✅ **11 tasks completed** (4 backend + 5 CLI + 5 impulse system - 3 cleanup)
- ✅ **Backend storage validated**: Templates stored, Thompson Sampling works, learning updates
- ✅ **CLI orchestration validated**: MCP tools work, state managed, incremental delivery, trailblazing
- ✅ **Impulse system validated**: 12 types resolve, memory agent works, ephemeral agents, cross-task sharing
- ✅ **~6 hours total validation time**
- ✅ **Comprehensive system validation complete**

---

## Next Steps After Validation

1. **Document Results**
   - Record which tests passed/failed
   - Note any issues discovered
   - Update ARCHITECTURE_QUICK_REFERENCE.md

2. **Fix Issues**
   - Create tickets for failures
   - Prioritize by severity
   - Re-run validation after fixes

3. **Expand Validation**
   - Add integration tests (end-to-end)
   - Add performance benchmarks
   - Add load testing

4. **Continuous Validation**
   - Run validation suite in CI/CD
   - Monitor metrics over time
   - Alert on regressions

---

## Template Registration

To register these validation activities in the system:

```bash
cd repos/metabob-opencode

# Register via impulse (recommended)
impulse_create({
  id: "validate-backend-def",
  type: "templateDefinition",
  pointer: {
    type: "templateDefinition",
    definition: require("./validate-backend-storage.json"),
    source: "validation"
  },
  budget: 3000
})

register_activity_template({
  impulse_id: "validate-backend-def",
  register_with_metabob: true
})

# Repeat for other templates
```

Or use file-based registration:

```bash
register_activity_template({
  file_path: "./validate-backend-storage.json",
  register_with_metabob: true
})

register_activity_template({
  file_path: "./validate-cli-orchestration.json",
  register_with_metabob: true
})

register_activity_template({
  file_path: "./validate-impulse-system.json",
  register_with_metabob: true
})
```

Then search to verify:

```bash
search_activities({ category: "infrastructure", verbose: true })
```

You should see all 3 validation templates listed.
