# Agent Execution Tracking - Gap Analysis

**Date**: February 13, 2026  
**Status**: 🔴 **Critical Gap Discovered**  
**Issue**: Agent execution tracking infrastructure exists but is **never initialized**

---

## Executive Summary

Investigation of agent execution history revealed that **zero sessions have been recorded** despite having complete infrastructure in place. Root cause: The `AgentExecutionTracker.startSession()` method is never called in OpenCode's execution flow.

Additionally, there's a **signature mismatch** between OpenCode's tracker and CLI MCP tools that would cause failures even if tracking was initialized.

---

## What Exists (✅ Built, ❌ Not Active)

### 1. OpenCode AgentExecutionTracker ✅ Code Exists, ❌ Not Used
**File**: `repos/metabob-opencode/packages/opencode/src/session/agent-execution-tracker.ts` (567 lines)

**Capabilities Built**:
- ✅ Session lifecycle tracking (`startSession`, `completeSession`)
- ✅ Tool invocation recording (`recordToolCall`)
- ✅ Activity usage tracking (`recordActivityUsage`)
- ✅ Agent identity discovery (git version, hostname, etc.)
- ✅ MCP integration for enriched recording
- ✅ Local storage fallback (`.metabob/agent-executions/`)

**Status**: **Never initialized or called**

**Evidence**:
```bash
# No sessions found in backend
curl "http://localhost:8080/api/agent-execution/agent/activity-mode/sessions" 
# Result: {"sessions": [], "count": 0}

# No sessions under alternative agent_id
curl "http://localhost:8080/api/agent-execution/agent/metabob-opencode/sessions"
# Result: {"sessions": [], "count": 0}

# No local fallback files
ls .metabob/agent-executions/
# Result: Directory does not exist

# No calls to startSession in codebase
grep -r "AgentExecutionTracker.startSession" repos/metabob-opencode/packages/opencode/src/
# Result: (empty - only definition, no invocation)
```

### 2. Tool Instrumentation Layer ✅ Built, ⚠️ Conditionally Enabled
**File**: `repos/metabob-opencode/packages/opencode/src/tool/tool-instrumentation.ts` (113 lines)

**Status**: Instrumentation **disabled by default**

**Current Behavior**:
```typescript
// Line 85-86: Instrumentation is opt-in
let instrumentationEnabled = false

// Line 104-108: Auto-enable only if env var set
export function autoEnable(): void {
  if (process.env.OPENCODE_ENABLE_INSTRUMENTATION === "true") {
    enableInstrumentation()
  }
}

// Line 112: Auto-enable on import (but env var not set)
ToolInstrumentation.autoEnable()
```

**Verification**:
```bash
echo $OPENCODE_ENABLE_INSTRUMENTATION
# Result: (empty - not set)
```

### 3. CLI MCP Tools ✅ Implemented, ⚠️ Signature Mismatch
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

**Tools Exist**:
- ✅ `metabob_record_session_start` (lines 3755-3798)
- ✅ `metabob_record_tool_invocation` (lines 3800-3849)
- ✅ `metabob_record_session_complete` (lines 3851-3907)

**Signature Mismatch Problem**:

| OpenCode Sends | CLI Expects | Match? |
|---------------|-------------|--------|
| `agent_id` | `agent_mode` | ❌ Name mismatch |
| `agent_version` | `metadata` | ❌ Wrong field |
| `goal` | `user_request` | ❌ Name mismatch |
| `context` | `metadata` | ⚠️ Needs restructure |
| `started_at` | - | ❌ Not in signature |

**OpenCode Call** (agent-execution-tracker.ts lines 395-406):
```typescript
await metabobClient.callTool({
  name: "metabob_record_session_start",
  arguments: {
    session_id: session.session_id,
    agent_id: session.agent_identity.agent_id,        // ❌ CLI expects agent_mode
    agent_version: session.agent_identity.agent_version, // ❌ CLI expects metadata
    goal: session.goal,                                // ❌ CLI expects user_request
    context: session.context,                         // ⚠️ CLI expects metadata
    started_at: session.started_at.toISOString()     // ❌ Not in CLI signature
  }
})
```

**CLI Signature** (tools.py lines 3757-3760):
```python
async def metabob_record_session_start(
    session_id: str,
    agent_mode: str,      # ❌ OpenCode sends agent_id
    user_request: str,    # ❌ OpenCode sends goal
    metadata: Optional[dict] = None,  # ⚠️ OpenCode sends context + agent_version
) -> str:
```

### 4. Backend API ✅ Ready
**File**: `repos/metabob-rpc-api/server/routes/agent_execution.py`

**Endpoints Working**:
- ✅ `POST /api/agent-execution/session/start`
- ✅ `POST /api/agent-execution/tool/invocation`
- ✅ `POST /api/agent-execution/session/complete`
- ✅ `GET /api/agent-execution/agent/{agent_id}/sessions`

**Status**: Backend is ready and accepting requests

---

## Critical Gaps

### Gap 1: Session Tracking Never Starts 🔴 HIGH
**Problem**: No code path calls `AgentExecutionTracker.startSession()`

**Impact**: Even if signature mismatch was fixed, no sessions would be recorded

**Expected Integration Point** (doesn't exist):
```typescript
// repos/metabob-opencode/packages/opencode/src/session/index.ts
// Expected somewhere in Session.create() or similar:

export async function create(config: Config): Promise<Session> {
  const session = new Session(...)
  
  // MISSING: Initialize agent execution tracking
  await AgentExecutionTracker.startSession(
    session.id,
    "user request here",  // Need to capture from context
    { task_type: 'feature' }
  )
  
  return session
}
```

**Required Fix**: Add initialization hook in session lifecycle

### Gap 2: Signature Mismatch 🔴 HIGH
**Problem**: OpenCode and CLI have incompatible interfaces

**Impact**: Even if tracking starts, MCP calls would fail with argument errors

**Required Fix**: Align signatures between OpenCode and CLI

**Option A: Change OpenCode to Match CLI**
```typescript
// In agent-execution-tracker.ts recordSessionStart()
await metabobClient.callTool({
  name: "metabob_record_session_start",
  arguments: {
    session_id: session.session_id,
    agent_mode: session.agent_identity.agent_id,  // Rename agent_id → agent_mode
    user_request: session.goal,                    // Rename goal → user_request
    metadata: {                                    // Merge into metadata
      agent_version: session.agent_identity.agent_version,
      hostname: session.agent_identity.hostname,
      started_at: session.started_at.toISOString(),
      ...session.context
    }
  }
})
```

**Option B: Change CLI to Match OpenCode** (Preferred - more semantic)
```python
# In tools.py
@mcp.tool()
async def metabob_record_session_start(
    session_id: str,
    agent_id: str,        # Was: agent_mode
    goal: str,            # Was: user_request
    agent_version: str,
    context: Optional[dict] = None,
    started_at: Optional[str] = None,
) -> str:
```

### Gap 3: Instrumentation Disabled 🟡 MEDIUM
**Problem**: Tool instrumentation requires env var to enable

**Impact**: Even with session tracking, tool calls won't be recorded

**Current Behavior**:
```bash
# Instrumentation only enabled if:
export OPENCODE_ENABLE_INSTRUMENTATION=true
```

**Required Fix**: Either enable by default or set env var in deployment

### Gap 4: No Session Goal Capture 🟡 MEDIUM
**Problem**: User's original request/goal isn't captured anywhere

**Impact**: Sessions would start but have empty/generic goals

**Required Context Flow**:
```
User Input → Session.create() → AgentExecutionTracker.startSession(goal=user_input)
```

**Current State**: User input not propagated to tracker

---

## Testing Results

### What We Verified ✅
- [x] Backend API responding correctly
- [x] Backend can store session data (manual curl test)
- [x] CLI MCP tools exist and are registered
- [x] OpenCode tracker code exists
- [x] Tool instrumentation layer exists

### What Failed ❌
- [x] Zero sessions found in backend database
- [x] No local fallback files created
- [x] Signature mismatch prevents MCP calls from working
- [x] No code path initializes session tracking
- [x] Instrumentation disabled by default

---

## Root Cause Analysis

### Why Phase 2 Was Marked "Complete"

**Phase 2 Goal** (from docs): "Replace direct HTTP calls with MCP tool invocations"

**What Was Completed**:
- ✅ OpenCode tracker **code** was changed to use MCP calls
- ✅ File path extraction **logic** was added
- ✅ Backend **schema** supports code_context
- ✅ CLI **enrichment engine** exists

**What Was Missed**:
- ❌ No verification that tracker is **actually called**
- ❌ No end-to-end test with real session
- ❌ Signature compatibility not validated
- ❌ Initialization hooks not added

**Assessment**: Phase 2 completed **infrastructure changes** but didn't validate the **complete execution path**.

---

## Remediation Plan

### Phase 2.5: Complete Integration (4-6 hours)

#### Task 1: Fix Signature Mismatch (1 hour)
**Option B Recommended**: Update CLI to match OpenCode's more semantic naming

**Changes Required**:
```python
# File: repos/metabob-cli/src/metabob_cli/mcp/tools.py

# BEFORE (lines 3757-3760):
async def metabob_record_session_start(
    session_id: str,
    agent_mode: str,
    user_request: str,
    metadata: Optional[dict] = None,
) -> str:

# AFTER:
async def metabob_record_session_start(
    session_id: str,
    agent_id: str,              # Was: agent_mode (more semantic)
    goal: str,                  # Was: user_request (matches tracker)
    agent_version: str,         # Explicit field (not buried in metadata)
    context: Optional[dict] = None,  # Was: metadata (clearer purpose)
    started_at: Optional[str] = None,  # Explicit timestamp
) -> str:
```

**Also Update**:
- `repos/metabob-cli/src/metabob_cli/mcp/agent_execution_tools.py` (internal interface)
- `repos/metabob-rpc-api/server/actions/agent_execution.py` (if schema changes needed)

#### Task 2: Add Session Initialization Hook (2 hours)
**Where**: `repos/metabob-opencode/packages/opencode/src/session/index.ts`

**Integration Point**: Session lifecycle events

**Implementation**:
```typescript
// Option A: Hook into Session.create()
export namespace Session {
  export async function create(config: CreateConfig): Promise<Instance> {
    const session = await createImpl(config)
    
    // Initialize agent execution tracking
    try {
      await AgentExecutionTracker.startSession(
        session.id,
        config.initialMessage || "New session",  // Capture user's first message
        {
          task_type: inferTaskType(config.initialMessage),
          codebase: Instance.directory,
          framework: detectFramework()
        }
      )
    } catch (err) {
      // Non-blocking: tracking failure shouldn't prevent session creation
      log.debug("Failed to initialize execution tracking", { error: err })
    }
    
    return session
  }
}

// Option B: Hook into message processing
export namespace Session {
  export async function processUserMessage(session: Instance, message: string) {
    // If first message, initialize tracking
    if (session.messages.length === 0) {
      await AgentExecutionTracker.startSession(session.id, message)
    }
    
    // Process message normally
    // ...
  }
}
```

#### Task 3: Enable Instrumentation by Default (30 minutes)
**Option A: Change Default** (Preferred)
```typescript
// File: repos/metabob-opencode/packages/opencode/src/tool/tool-instrumentation.ts

// Line 85: Change default to true
let instrumentationEnabled = true  // Was: false

// Line 112: Always enable (no env var needed)
ToolInstrumentation.enableInstrumentation()
```

**Option B: Set Environment Variable**
```bash
# In docker-compose.yaml or deployment scripts
OPENCODE_ENABLE_INSTRUMENTATION=true
```

#### Task 4: Add Session Completion Hook (1 hour)
**Where**: Session cleanup/end lifecycle

**Implementation**:
```typescript
export namespace Session {
  export async function end(session: Instance, outcome: SessionOutcome) {
    // Record session completion
    try {
      await AgentExecutionTracker.completeSession(
        {
          success: outcome.success,
          goal_achieved: outcome.goalAchieved,
          tests_passed: outcome.testsPassed,
          error: outcome.error
        },
        {
          what_worked: outcome.reflection?.whatWorked,
          what_didnt_work: outcome.reflection?.whatDidntWork,
          improvements_suggested: outcome.reflection?.improvements
        }
      )
    } catch (err) {
      log.debug("Failed to record session completion", { error: err })
    }
    
    // Normal cleanup
    // ...
  }
}
```

#### Task 5: End-to-End Testing (1.5 hours)
**Test Plan**:
1. Start OpenCode with fixes
2. Create new session with user message
3. Verify session appears in backend API
4. Execute `read` tool on a file
5. Verify tool invocation recorded with enrichment
6. Complete session
7. Query session statistics

**Success Criteria**:
- Session created with correct `agent_id`, `goal`, `agent_version`
- Tool invocations recorded with `code_context` enrichment
- Session completion recorded with reflection
- No crashes or errors in logs
- Performance overhead < 200ms per tool

---

## Priority Assessment

### P0: Critical for Functionality
1. **Fix signature mismatch** - Blocks all MCP communication
2. **Add session initialization** - Tracking never starts without this

### P1: Important for Completeness
3. **Enable instrumentation** - Tool calls won't be recorded
4. **Add session completion** - Sessions won't be finalized

### P2: Nice to Have
5. **Goal inference** - Better session metadata
6. **Reflection prompts** - Richer learning data

---

## Documentation Updates Needed

After remediation:
1. Update `AGENT_EXECUTION_PHASE2_STATUS_FEB13.md`:
   - Change status from "✅ Complete" to "⚠️ Integration Gaps Identified"
   - Add section on signature mismatch and initialization gaps
   
2. Create `AGENT_EXECUTION_PHASE2_REMEDIATION.md`:
   - Document signature fix
   - Document initialization hooks
   - Include test results
   
3. Update `GOALS_ALIGNMENT_ASSESSMENT.md`:
   - Agent execution tracking: Change from ❓ to current status
   - Add as tracked work item

---

## Why This Matters

**Impact of Gaps**:
- 🔴 **Zero learning data**: System can't self-improve without execution history
- 🔴 **No tool usage analytics**: Can't identify which tools work best
- 🔴 **No session patterns**: Can't detect success/failure patterns
- 🔴 **No code intelligence**: Enrichment layer unused (Phase 2 wasted)

**Value of Fix**:
- ✅ **Self-improvement foundation**: System learns from every session
- ✅ **Tool optimization**: Identify which tools to improve
- ✅ **Pattern detection**: Automatic discovery of success patterns
- ✅ **Code-aware tracking**: Rich context for every file operation

---

## Confidence Assessment

**Gap Analysis**: 99% confidence
- Multiple verification methods confirm no sessions exist
- Code inspection confirms no initialization
- Signature mismatch is provable from code

**Remediation Plan**: 95% confidence
- Clear fix paths identified
- Minimal code changes required
- Non-breaking (graceful degradation maintained)

**Effort Estimate**: 4-6 hours for complete fix + testing

---

## Next Actions

### Immediate (This Session)
1. ✅ Document gap analysis (this file)
2. ⏭️ Decide: Fix now or defer to next session?
3. ⏭️ If fixing now: Start with Task 1 (signature fix)

### Next Session
1. Execute remediation plan (Tasks 1-5)
2. Create test results document
3. Update status documents
4. Verify end-to-end flow with real session

---

**Status**: Gap analysis complete, awaiting remediation decision  
**Created**: February 13, 2026  
**Estimated Fix Time**: 4-6 hours
