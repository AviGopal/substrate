# Trace Analysis: MCP-Only Communication

**Specification**: metabob-opencode must ONLY communicate via metabob-cli MCP server, never direct HTTP to backend

**Caller Context**: Fix architectural violation where template-metrics-client.ts bypasses MCP with direct HTTP POST

**Date**: 2026-03-02

---

## Executive Summary

**VIOLATION CONFIRMED**: `template-metrics-client.ts:reportExecution()` makes direct HTTP POST to metabob-rpc-api backend, bypassing the MCP communication layer.

**Impact**: 
- Architectural boundary violation
- Inconsistent error handling
- Difficult to test/mock
- Breaks centralized metrics reporting pattern

**Root Cause**: Previous attempt to use MCP tool `metabob_post_activity_result` failed because:
1. Wrong tool name (correct name is `post_activity_result` without `metabob_` prefix)
2. Fell back to direct HTTP as "working solution"
3. Commented in lines 85-86 as a "fix" but actually introduced architectural violation

---

## Current State vs Desired State

### Current Architecture (WRONG)
```
Activity.complete() 
  → TemplateMetricsClient.reportExecution()
    → fetch(http://metabob-rpc-api:8000/api/v1/learning-loop/executions)
      → metabob-rpc-api backend
```

**Problems**:
- Direct HTTP bypasses MCP layer
- Uses `METABOB_RPC_API_URL` environment variable
- No centralized error handling
- Cannot be mocked for testing
- Violates architectural principle

### Desired Architecture (CORRECT)
```
Activity.complete()
  → TemplateMetricsClient.reportExecution()
    → callMCPTool('post_activity_result', {...})
      → metabob-cli MCP server
        → HTTP POST to metabob-rpc-api
```

**Benefits**:
- Consistent with all other Metabob integrations
- Centralized error handling in MCP layer
- Easy to test/mock
- Follows architectural principle
- Maintains clean separation of concerns

---

## Component Analysis

### 1. Primary Violation: template-metrics-client.ts

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Component**: `TemplateMetricsClient.reportExecution()`

**Lines**: 93-162

**Current Behavior**:
- Line 104: Gets backend URL from `process.env.METABOB_RPC_API_URL`
- Line 131: Makes direct `fetch()` call to backend API
- Lines 81-86: Comments document this was "fixed" from MCP (but actually broke architecture)

**Desired Behavior**:
- Use `callMCPTool('post_activity_result', {...})` instead of `fetch()`
- No direct environment variable access
- No direct HTTP calls

**Gap**: Replace lines 104-149 with MCP tool invocation

**Evidence from code**:
```typescript
// Line 85-86 (WRONG COMMENT - this is the violation!)
* Previous implementation attempted to use MCP tool 'metabob_post_activity_result' which
* did not exist in the MCP server. Fixed to use direct HTTP POST to backend API endpoint.

// Line 104 (VIOLATION - direct backend access)
const backendURL = process.env.METABOB_RPC_API_URL || "http://metabob-rpc-api:8000"

// Line 131 (VIOLATION - direct HTTP)
const response = await fetch(`${backendURL}/api/v1/learning-loop/executions`, {...})
```

---

### 2. Secondary Violation: boredom-manager.ts

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`

**Component**: `BoredomManager` (line 340)

**Current Behavior**:
- Directly calls `metabobClient.callTool({ name: "metabob_post_activity_result", ... })`
- Uses WRONG tool name (should be `post_activity_result` without prefix)
- Violates DRY principle (duplicates metrics reporting logic)

**Desired Behavior**:
- Call `TemplateMetricsClient.reportExecution(...)` abstraction
- Let the abstraction handle MCP communication

**Gap**: Replace direct MCP call with `TemplateMetricsClient.reportExecution()`

---

### 3. Reference Implementation: post-activity-result.ts

**File**: `repos/metabob-opencode/packages/opencode/src/tool/post-activity-result.ts`

**Status**: ✅ CORRECT

**Tool Name**: `post_activity_result` (without `metabob_` prefix)

**Purpose**: Defines the MCP tool that should be used by template-metrics-client.ts

**Parameters**:
```typescript
{
  activityId: string,
  result: {
    success: boolean,
    duration: number,
    cost: number,
    tokens?: { input, output, cache }
  },
  backend: "local" | "metabob" | "all"
}
```

---

### 4. Pattern Reference: metabob.ts

**File**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`

**Component**: `MetabobCLI.callMCPTool()` (lines 262-338)

**Status**: ✅ CORRECT PATTERN

**Purpose**: Shows how to properly call MCP tools

**Key Pattern**:
```typescript
async function callMCPTool<T>(toolName: string, args: Record<string, any>): Promise<T | undefined> {
  const clients = await MCP.clients()
  const metabobClient = clients["metabob"]
  
  if (!metabobClient) {
    log.debug("metabob mcp client not available")
    return undefined
  }
  
  const result = await metabobClient.callTool({
    name: toolName,  // NO PREFIX - tools are called directly
    arguments: args as Record<string, unknown>,
  })
  
  // Parse response...
}
```

**Note**: `template-metrics-client.ts` has its own `callMCPTool()` implementation (lines 31-75) which duplicates this logic. Should reuse or consolidate.

---

## Data Flow Trace

### Entry Points (Where reportExecution is called)

1. **Normal Activity Completion**
   - File: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
   - Line: 994
   - Context: `Activity.complete()` after successful execution

2. **Failed Activity Completion**
   - File: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
   - Line: 1247
   - Context: `Activity.fail()` after activity failure

### Transform Chain

```
activity.ts:994
  ↓
TemplateMetricsClient.reportExecution({
  activity_id, template_id, success, duration, cost, tokens
})
  ↓ [CURRENT: WRONG]
fetch(METABOB_RPC_API_URL/api/v1/learning-loop/executions)
  ↓
metabob-rpc-api backend

  ↓ [DESIRED: CORRECT]
callMCPTool('post_activity_result', {
  activityId, result: { success, duration, cost, tokens }
})
  ↓
metabob-cli MCP server
  ↓
metabob-rpc-api backend
```

---

## Key Findings

### 1. Tool Name Confusion

❌ **Incorrect**: `metabob_post_activity_result`
- Used in boredom-manager.ts:340
- Does not exist in MCP server
- Caused original implementation failure

✅ **Correct**: `post_activity_result`
- Defined in post-activity-result.ts:16
- Exists in MCP server
- Should be used by template-metrics-client.ts

### 2. Architectural Boundary Violation

**Current (WRONG)**:
```
metabob-opencode → direct HTTP → metabob-rpc-api
```

**Desired (CORRECT)**:
```
metabob-opencode → MCP → metabob-cli → HTTP → metabob-rpc-api
```

**Benefits of MCP layer**:
- Centralized error handling
- Consistent retry logic
- Easy mocking for tests
- Clean architectural separation
- Single communication channel

### 3. Code Duplication

**Issue**: `template-metrics-client.ts` has its own `callMCPTool()` implementation (lines 31-75)

**Problem**: Duplicates logic from `metabob.ts:callMCPTool()` (lines 262-338)

**Solution**: Either:
- Reuse `MetabobCLI.callMCPTool()` directly
- Extract shared utility function
- Document why duplication is necessary (if it is)

---

## Fix Strategy

### Step 1: Fix template-metrics-client.ts

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Action**: Replace direct HTTP with MCP tool call

**Lines to change**: 104-149

**Current Code** (WRONG):
```typescript
const backendURL = process.env.METABOB_RPC_API_URL || "http://metabob-rpc-api:8000"

const response = await fetch(`${backendURL}/api/v1/learning-loop/executions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(requestBody),
})

if (!response.ok) {
  const errorText = await response.text()
  log.warn("metrics reporting failed - backend returned error", { ... })
  return
}

const result = await response.json()
```

**New Code** (CORRECT):
```typescript
// Call MCP tool instead of direct HTTP
const result = await callMCPTool<{ success: boolean }>('post_activity_result', {
  activityId: data.activity_id,
  result: {
    success: data.success,
    duration: data.duration,
    cost: data.cost,
    tokens: data.tokens ? {
      input: data.tokens.input,
      output: data.tokens.output,
      cache: data.tokens.cache,
    } : undefined,
  },
  backend: 'all',
})

if (!result || !result.success) {
  log.warn("metrics reporting failed via MCP", {
    activityId: data.activity_id,
  })
  return
}

log.info("metrics reporting successful via MCP", {
  activityId: data.activity_id,
})
```

**Changes**:
- Remove `METABOB_RPC_API_URL` usage
- Remove `fetch()` call
- Remove request body transformation (MCP tool handles it)
- Use `callMCPTool('post_activity_result', ...)` instead
- Simplified error handling (MCP layer handles retries)

---

### Step 2: Fix boredom-manager.ts

**File**: `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts`

**Action**: Replace direct MCP call with abstraction layer

**Lines to change**: 339-354

**Current Code** (WRONG):
```typescript
await metabobClient.callTool({
  name: "metabob_post_activity_result",  // WRONG TOOL NAME
  arguments: {
    activity_id: result.activityId,
    template_id: template.id,
    success: result.success,
    duration: duration,
    cost: activity.stats?.cost?.total || 0,
    tokens: {
      input: activity.stats?.tokens?.input || 0,
      output: activity.stats?.tokens?.output || 0,
      cache: activity.stats?.tokens?.cache?.read || 0,
    },
    cancelled: result.cancelled || false,
  },
})
```

**New Code** (CORRECT):
```typescript
await TemplateMetricsClient.reportExecution({
  activity_id: result.activityId,
  template_id: template.id,
  success: result.success,
  duration: duration,
  cost: activity.stats?.cost?.total || 0,
  tokens: {
    input: activity.stats?.tokens?.input || 0,
    output: activity.stats?.tokens?.output || 0,
    cache: activity.stats?.tokens?.cache?.read || 0,
  },
})
```

**Changes**:
- Use `TemplateMetricsClient.reportExecution()` abstraction
- Remove direct MCP client access
- Remove `cancelled` parameter (not in interface)
- Consistent with rest of codebase

---

### Step 3: Update Documentation

**File**: `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts`

**Action**: Fix misleading comments

**Lines to change**: 81-90

**Current Comment** (MISLEADING):
```typescript
* Previous implementation attempted to use MCP tool 'metabob_post_activity_result' which
* did not exist in the MCP server. Fixed to use direct HTTP POST to backend API endpoint.
```

**New Comment** (ACCURATE):
```typescript
* This method uses the MCP tool 'post_activity_result' to delegate metrics reporting
* to metabob-cli, which forwards to metabob-rpc-api backend. This maintains the
* architectural boundary: opencode → MCP → cli → backend (no direct HTTP).
* 
* Previous implementations had issues:
* 1. Used wrong tool name 'metabob_post_activity_result' (should be 'post_activity_result')
* 2. Fell back to direct HTTP as workaround (violated architecture)
* 3. Now correctly uses MCP layer for all backend communication
```

---

### Step 4: Add Tests

**File**: `repos/metabob-opencode/packages/opencode/test/tool/template-metrics-client.test.ts`

**Action**: Verify MCP tool is called, not direct HTTP

**Test Cases**:
1. ✅ Verify `callMCPTool('post_activity_result', ...)` is invoked
2. ✅ Verify NO direct `fetch()` calls
3. ✅ Verify correct parameter mapping
4. ✅ Verify graceful degradation when MCP unavailable
5. ✅ Verify error handling

---

## Test Validation

### Unit Tests
- Mock MCP client
- Verify `post_activity_result` tool is called with correct parameters
- Verify NO `fetch()` calls occur

### Integration Tests
- Start metabob-cli MCP server
- Execute activity
- Verify metrics reported via MCP
- Verify backend receives data

### Expected Behavior
```typescript
// When: Activity completes
Activity.complete(activityId)

// Then: MCP tool should be called
expect(mcpClient.callTool).toHaveBeenCalledWith({
  name: 'post_activity_result',
  arguments: {
    activityId: expect.any(String),
    result: {
      success: true,
      duration: expect.any(Number),
      cost: expect.any(Number),
      tokens: expect.objectContaining({
        input: expect.any(Number),
        output: expect.any(Number),
        cache: expect.any(Number),
      }),
    },
    backend: 'all',
  },
})

// And: NO direct HTTP calls
expect(fetch).not.toHaveBeenCalled()
```

---

## Related Files

### Files Requiring Changes
1. ✏️ `repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts` - PRIMARY FIX
2. ✏️ `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts` - SECONDARY FIX
3. ✏️ `repos/metabob-opencode/packages/opencode/test/tool/template-metrics-client.test.ts` - ADD TESTS

### Reference Files (NO CHANGES)
1. ✅ `repos/metabob-opencode/packages/opencode/src/tool/post-activity-result.ts` - CORRECT TOOL DEFINITION
2. ✅ `repos/metabob-opencode/packages/opencode/src/util/metabob.ts` - CORRECT MCP PATTERN
3. ✅ `repos/metabob-opencode/packages/opencode/src/session/activity.ts` - CALLERS (no changes needed)

### Acceptable Non-Violations
- ✅ `repos/metabob-opencode/packages/opencode/src/util/rpc-http-client.ts`
  - Used for Thompson Sampling variant selection
  - Different use case (ML real-time decision)
  - Direct HTTP is acceptable here
  - NOT a violation of metrics reporting architecture

---

## Impulse Created

**ID**: `trace-MCP-Only-Communication`

**Type**: `templateDefinition`

**Budget**: 5000 tokens

**Content**: Full trace analysis (this document) in structured JSON format

**Usage**: This impulse will be consumed by downstream validation and enforcement tasks to:
1. Verify the architectural violation
2. Implement the fix strategy
3. Validate the fix with tests
4. Document the architectural principle

---

## Summary

**Specification**: MCP-Only Communication

**Violation Confirmed**: ✅ YES
- `template-metrics-client.ts:reportExecution()` uses direct HTTP
- `boredom-manager.ts` uses wrong MCP tool name

**Root Cause**: 
- Confusion about tool name (`metabob_post_activity_result` vs `post_activity_result`)
- Fell back to direct HTTP as "working solution"
- Documented as "fix" but actually violated architecture

**Fix Required**:
1. Replace `fetch()` with `callMCPTool('post_activity_result', ...)`
2. Fix tool name in boredom-manager
3. Update misleading comments
4. Add tests

**Impact**: 
- **Files to modify**: 2
- **Test files to add**: 1
- **Estimated effort**: 2-3 hours
- **Risk**: Low (well-isolated change)

**Next Steps**:
1. Implement fix in template-metrics-client.ts
2. Implement fix in boredom-manager.ts
3. Add unit tests
4. Run integration tests
5. Validate with enforcement activity
