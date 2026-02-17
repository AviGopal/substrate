# Next Session: Agent Execution Tracking Remediation

**Priority**: P0 - Critical Infrastructure Gap  
**Estimated Time**: 4-6 hours  
**Status**: Ready to execute  
**Context**: See `AGENT_EXECUTION_TRACKING_GAP_ANALYSIS.md` for full details

---

## Quick Start

### What We're Fixing
Agent execution tracking infrastructure exists but is **never initialized** and has **signature mismatches** preventing MCP communication.

**Impact**: Zero sessions recorded, enrichment layer unused, no self-improvement data.

---

## 5-Step Remediation Plan

### Step 1: Fix Signature Mismatch (1 hour) 🔴 P0

**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`  
**Line**: 3757-3760

**Change**:
```python
# BEFORE:
@mcp.tool()
async def metabob_record_session_start(
    session_id: str,
    agent_mode: str,
    user_request: str,
    metadata: Optional[dict] = None,
) -> str:

# AFTER:
@mcp.tool()
async def metabob_record_session_start(
    session_id: str,
    agent_id: str,              # Was: agent_mode (more semantic)
    goal: str,                  # Was: user_request (matches OpenCode)
    agent_version: str,         # Explicit (not in metadata)
    context: Optional[dict] = None,  # Was: metadata (clearer purpose)
    started_at: Optional[str] = None,  # New: explicit timestamp
) -> str:
```

**Also Update**:
- Internal call in same file (forward to AgentExecutionTools)
- `repos/metabob-cli/src/metabob_cli/mcp/agent_execution_tools.py` if signature differs

**Verification**:
```bash
# Check OpenCode still calls with correct args
grep -A 10 "metabob_record_session_start" repos/metabob-opencode/packages/opencode/src/session/agent-execution-tracker.ts
```

---

### Step 2: Add Session Initialization (2 hours) 🔴 P0

**File**: `repos/metabob-opencode/packages/opencode/src/session/index.ts`

**Find Hook Point**: Look for `Session.create()` or similar session initialization

**Add Initialization**:
```typescript
import { AgentExecutionTracker } from "./agent-execution-tracker"

export namespace Session {
  export async function create(config: CreateConfig): Promise<Instance> {
    const session = await createSessionImpl(config)
    
    // Initialize agent execution tracking
    try {
      await AgentExecutionTracker.startSession(
        session.id,
        config.initialMessage || "New session",  // User's goal
        {
          task_type: inferTaskType(config.initialMessage),
          codebase: Instance.directory
        }
      )
    } catch (err) {
      // Non-blocking: tracking failure shouldn't break session
      log.debug("Agent execution tracking initialization failed", { 
        error: err instanceof Error ? err.message : String(err) 
      })
    }
    
    return session
  }
}

// Helper: Infer task type from user message
function inferTaskType(message?: string): string {
  if (!message) return 'other'
  const lower = message.toLowerCase()
  if (lower.includes('fix') || lower.includes('bug')) return 'bugfix'
  if (lower.includes('add') || lower.includes('implement')) return 'feature'
  if (lower.includes('refactor') || lower.includes('clean')) return 'refactor'
  if (lower.includes('test') || lower.includes('check')) return 'analysis'
  return 'other'
}
```

**Verification**:
```bash
# After restart, check backend for new sessions
curl "http://localhost:8080/api/agent-execution/agent/metabob-opencode/sessions?limit=5" | jq '.'
# Should see new sessions appearing
```

---

### Step 3: Enable Instrumentation (30 minutes) 🟡 P1

**File**: `repos/metabob-opencode/packages/opencode/src/tool/tool-instrumentation.ts`

**Option A: Change Default** (Recommended):
```typescript
// Line 85: Change false → true
let instrumentationEnabled = true  // Enable by default

// Line 112: Always enable
ToolInstrumentation.enableInstrumentation()
```

**Option B: Environment Variable**:
```bash
# Add to docker-compose.yaml or deployment
environment:
  - OPENCODE_ENABLE_INSTRUMENTATION=true
```

**Verification**:
```bash
# Check logs for "tool instrumentation enabled"
# After tool execution, check backend for tool_invocations with code_context
```

---

### Step 4: Add Session Completion (1 hour) 🟡 P1

**File**: `repos/metabob-opencode/packages/opencode/src/session/index.ts`

**Find Cleanup Hook**: Look for session end/close/cleanup method

**Add Completion**:
```typescript
export namespace Session {
  export async function end(session: Instance) {
    // Capture outcome
    const outcome = {
      success: !session.hasErrors,
      goal_achieved: session.goalAchieved || false,
      tests_passed: session.testsPassed,
      error: session.lastError
    }
    
    // Record completion
    try {
      await AgentExecutionTracker.completeSession(outcome)
    } catch (err) {
      log.debug("Failed to record session completion", { error: err })
    }
    
    // Normal cleanup
    await cleanupSession(session)
  }
}
```

**Verification**:
```bash
# End session in OpenCode
# Check backend for completed_at timestamp and outcome
```

---

### Step 5: End-to-End Testing (1.5 hours) 🔴 P0

**Test Script**:
```bash
#!/bin/bash
# File: scripts/test-agent-execution-e2e.sh

echo "=== Agent Execution E2E Test ==="

# 1. Check backend running
echo "1. Checking backend..."
curl -s http://localhost:8080/ > /dev/null || {
  echo "❌ Backend not running"
  exit 1
}
echo "✅ Backend running"

# 2. Start OpenCode (in separate terminal or background)
echo "2. Start OpenCode and create session..."
# Manual step: Start opencode, wait for session creation

# 3. Verify session created
echo "3. Checking for new session..."
SESSIONS=$(curl -s "http://localhost:8080/api/agent-execution/agent/metabob-opencode/sessions?limit=1")
SESSION_COUNT=$(echo $SESSIONS | jq '.count')

if [ "$SESSION_COUNT" -gt 0 ]; then
  echo "✅ Session created"
  SESSION_ID=$(echo $SESSIONS | jq -r '.sessions[0].session_id')
  echo "   Session ID: $SESSION_ID"
else
  echo "❌ No sessions found"
  exit 1
fi

# 4. Execute tool in OpenCode
echo "4. Execute 'read' tool in OpenCode..."
# Manual step: Run read command

# 5. Check for tool invocations
sleep 2  # Give time for recording
echo "5. Checking for tool invocations..."
# Query Redis or backend for tool invocations
# TODO: Add API endpoint to query tool invocations by session

# 6. Verify enrichment
echo "6. Verifying code_context enrichment..."
# Check that tool_invocations have code_context field
# TODO: Implement

echo "=== Test Complete ==="
```

**Manual Test Steps**:
1. Start OpenCode
2. Check backend: `curl "http://localhost:8080/api/agent-execution/agent/metabob-opencode/sessions"`
3. In OpenCode: `> read packages/opencode/src/session/agent-execution-tracker.ts`
4. Check Redis or backend for enriched tool invocation
5. Exit OpenCode
6. Verify session marked complete

**Success Criteria**:
- [ ] Session appears in backend within 5 seconds of OpenCode start
- [ ] Session has correct `agent_id`, `goal`, `agent_version`
- [ ] Tool invocation recorded with `file_path`
- [ ] Tool invocation has `code_context` with:
  - [ ] `components` (array of function/class names)
  - [ ] `impact_score` (0.0-1.0)
  - [ ] `dependents_count` (integer)
  - [ ] `similar_files` (array of paths)
- [ ] Session completion recorded with `completed_at` timestamp
- [ ] No errors in OpenCode or backend logs
- [ ] Performance: tool call latency < 200ms additional overhead

---

## Verification Checklist

### After Each Step

**Step 1 Complete**:
- [ ] CLI tool signature matches OpenCode call
- [ ] Code compiles without errors
- [ ] MCP tool registered correctly

**Step 2 Complete**:
- [ ] Session.create() calls AgentExecutionTracker.startSession()
- [ ] Non-blocking error handling in place
- [ ] Initial goal captured from user message

**Step 3 Complete**:
- [ ] Instrumentation enabled (check env or default)
- [ ] Tool calls wrapped with tracking
- [ ] Logs show "tool instrumentation enabled"

**Step 4 Complete**:
- [ ] Session end calls AgentExecutionTracker.completeSession()
- [ ] Outcome captured (success/failure)
- [ ] Reflection optional but supported

**Step 5 Complete**:
- [ ] Backend shows sessions with all fields populated
- [ ] Tool invocations include code_context enrichment
- [ ] No errors in logs
- [ ] Performance acceptable

---

## Quick Commands

### Check Backend Health
```bash
curl http://localhost:8080/
```

### Query Sessions
```bash
curl "http://localhost:8080/api/agent-execution/agent/metabob-opencode/sessions?limit=10" | jq '.'
```

### Query Statistics
```bash
curl "http://localhost:8080/api/agent-execution/agent/metabob-opencode/statistics" | jq '.'
```

### Check Redis Data
```bash
docker exec metabob-redis redis-cli --scan --pattern "agent_execution:session:*"
docker exec metabob-redis redis-cli GET "agent_execution:session:<session_id>" | jq '.'
```

### Check OpenCode Logs
```bash
# Look for tracking initialization
grep -i "agent execution" ~/.opencode/logs/*.log
grep -i "session.*start" ~/.opencode/logs/*.log
```

---

## Troubleshooting

### Issue: Sessions Not Appearing
**Check**:
1. Is `AgentExecutionTracker.startSession()` being called?
   - Add log statement at start of function
   - Check logs for "session tracking started"
2. Is MCP client available?
   - Check for "metabob MCP client not available" in logs
   - Verify opencode.json has metabob MCP config
3. Is backend receiving requests?
   - Check backend logs for POST /api/agent-execution/session/start
   - Check for errors in backend response

### Issue: Tool Invocations Missing code_context
**Check**:
1. Is file_path being extracted?
   - Add log in recordToolInvocation() to show filePath variable
2. Is CLI enrichment working?
   - Check CLI logs for enrichment activity
   - Verify CPG initialized (check watcher)
3. Is backend storing code_context?
   - Query Redis directly to see raw data
   - Check backend logs for storage confirmation

### Issue: Signature Mismatch Errors
**Check**:
1. Did you update CLI tool signature?
2. Did you restart CLI MCP server?
3. Check OpenCode logs for "unexpected argument" errors
4. Verify argument names match exactly (case-sensitive)

---

## Expected Timeline

| Step | Time | Cumulative |
|------|------|------------|
| 1. Fix signature | 1h | 1h |
| 2. Add initialization | 2h | 3h |
| 3. Enable instrumentation | 0.5h | 3.5h |
| 4. Add completion | 1h | 4.5h |
| 5. E2E testing | 1.5h | 6h |

**Total**: 6 hours (with testing)  
**Minimum**: 4 hours (without extensive testing)

---

## Success Definition

**Phase 2.5 Complete When**:

1. ✅ Sessions automatically created on OpenCode start
2. ✅ Tool invocations automatically recorded
3. ✅ Code context enrichment appears in all file operations
4. ✅ Sessions finalize with completion metadata
5. ✅ Backend API returns rich execution data
6. ✅ No errors or warnings in logs
7. ✅ Performance overhead < 200ms per tool
8. ✅ End-to-end test passes

---

## Files to Modify

**Primary Changes**:
1. `repos/metabob-cli/src/metabob_cli/mcp/tools.py` (signature fix)
2. `repos/metabob-opencode/packages/opencode/src/session/index.ts` (initialization)
3. `repos/metabob-opencode/packages/opencode/src/tool/tool-instrumentation.ts` (enable default)

**Possible Updates**:
4. `repos/metabob-cli/src/metabob_cli/mcp/agent_execution_tools.py` (if signature changes)

**Documentation Updates**:
5. `AGENT_EXECUTION_PHASE2_STATUS_FEB13.md` (update status)
6. Create: `AGENT_EXECUTION_PHASE2_REMEDIATION_COMPLETE.md` (test results)

---

## Context Documents

**Read Before Starting**:
- `AGENT_EXECUTION_TRACKING_GAP_ANALYSIS.md` - Full gap analysis and remediation details
- `SESSION_SUMMARY_AGENT_EXECUTION_GAP_DISCOVERY_FEB13.md` - How we discovered the gaps

**Reference During Work**:
- `AGENT_EXECUTION_CLI_ARCHITECTURE.md` - System design
- `AGENT_EXECUTION_PHASE2_STATUS_FEB13.md` - Current status

---

## Post-Remediation Actions

1. **Update Documentation**:
   - Mark Phase 2.5 complete
   - Update GOALS_ALIGNMENT_ASSESSMENT.md
   - Create test results document

2. **Commit Changes**:
   ```bash
   git add -A
   git commit -m "fix: Complete agent execution tracking integration

   - Fix MCP tool signature mismatch (agent_mode → agent_id, etc.)
   - Add session initialization hooks in Session.create()
   - Enable tool instrumentation by default
   - Add session completion hooks
   - End-to-end test passing
   
   Resolves: Agent execution tracking now fully functional with enrichment"
   ```

3. **Validate Ongoing**:
   - Run a few more sessions to verify consistency
   - Check that enrichment data quality is good
   - Monitor performance impact

---

**Ready to Execute**: All prep work complete  
**Context Available**: Full gap analysis in linked documents  
**Clear Path**: 5-step plan with examples  
**Success Criteria**: Well-defined and testable

**Next session: Execute this plan and achieve working agent execution tracking!** 🚀
