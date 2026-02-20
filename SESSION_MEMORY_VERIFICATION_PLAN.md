# Session Memory System Verification Plan

**Date**: 2026-02-20  
**Status**: 🟢 Architecture Complete - Ready for Verification  
**Goal**: Verify session memory management before logging optimization

---

## Executive Summary

The **session memory management, impulse system, and lifecycle hooks are FULLY IMPLEMENTED** and architecturally sound. Before optimizing logging, we need to verify the system works end-to-end in a live session.

### What's Already Built ✅

1. **Turn Lifecycle Hook** - Registered and ready (`turn-lifecycle-hooks.ts:20-180`)
2. **Memory Management Activity** - 5-task workflow (`manage-session-memory.json`)
3. **Memory Agent** - Configured with all required tools (`agent.ts:383-540`)
4. **Impulse Tools** - All 9 tools implemented and exported:
   - `impulse_create`, `impulse_load`, `impulse_unload`, `impulse_delete`, `impulse_update`, `impulse_list`
   - `memory_outline`, `memory_budget`, `memory_optimize`
5. **SessionMemoryAgent.gatherContext()** - Context gathering for activities (`memory-agent.ts:444-615`)
6. **Impulse Transfer** - Activity → Session scope conversion (`turn-lifecycle-hooks.ts:92-118`)

### What We Need to Verify 🔍

1. **Hook Execution**: Does the `memory-management` hook run on user messages?
2. **Tool Availability**: Are impulse_* and memory_* tools accessible to memory agent?
3. **Impulse Transfer**: Do impulses correctly transfer from activity → session scope?
4. **Performance**: What's the actual latency impact? (target: < 2s)
5. **Error Handling**: Does the system gracefully handle failures?

---

## Verification Approach

### Option 1: Live Session Test (Recommended)
**Time**: 5-10 minutes  
**Risk**: Low (system is non-fatal, logs warnings on failure)

```bash
# 1. Start OpenCode session
cd repos/metabob-opencode && bun run dev

# 2. Send a test message
> "Fix the bug in turn-lifecycle-hooks.ts"

# 3. Monitor logs for:
- "executing memory management activity"
- "memory management completed" 
- Activity execution time
- Impulse transfer count

# 4. Check impulses transferred:
> "Show me the current context space"

# Expected: Memory agent should have created and transferred impulses
```

**Success Criteria**:
- ✅ Hook executes before main turn
- ✅ Activity completes in < 2s
- ✅ Impulses transferred to session (count > 0)
- ✅ No critical errors in logs

### Option 2: Unit Test (If Live Session Unavailable)
**Time**: 15-20 minutes  
**Risk**: Medium (may not catch integration issues)

Create test: `repos/metabob-opencode/packages/opencode/test/session/turn-lifecycle-memory.test.ts`

```typescript
import { TurnLifecycle } from "../../src/session/turn-lifecycle"
import { SessionMemory } from "../../src/session/session-memory"

test("memory-management hook executes and transfers impulses", async () => {
  const sessionID = ulid()
  const ctx = {
    sessionID,
    agent: { name: "activity", mode: "primary" },
    promptText: "Fix the bug in auth.ts",
    messageID: ulid(),
  }
  
  // Execute hook
  const result = await TurnLifecycle.executeHook("memory-management", ctx)
  
  // Verify success
  expect(result.success).toBe(true)
  expect(result.metadata.impulsesTransferred).toBeGreaterThan(0)
  
  // Verify impulses in session
  const session = await SessionMemory.get(sessionID)
  expect(session.impulses.length).toBeGreaterThan(0)
})
```

---

## Detailed Verification Checklist

### Phase 1: Basic Functionality (5 min)

- [ ] **1. Hook Registration**
  ```bash
  cd repos/metabob-opencode
  rg "registerHook.*memory-management" --type ts
  # Should find: turn-lifecycle-hooks.ts:20
  ```

- [ ] **2. Hook Enabled Check**
  ```typescript
  // In turn-lifecycle-hooks.ts:24-42
  // Conditions:
  // - config.sessionMemory?.enabled !== false ✓
  // - ctx.agent.mode === "primary" ✓
  // - ctx.promptText.length >= 10 ✓
  ```

- [ ] **3. Activity Template Exists**
  ```bash
  find repos/metabob-proto -name "manage-session-memory.json"
  # Should find: repos/metabob-proto/activities/bootstrap/manage-session-memory.json
  ```

- [ ] **4. Memory Agent Tools**
  ```bash
  cd repos/metabob-opencode
  rg "impulse_create.*true" packages/opencode/src/agent/agent.ts
  # Should find: agent.ts:514 (and 8 other impulse/memory tools)
  ```

### Phase 2: Integration Testing (10 min)

- [ ] **5. Live Session Test**
  1. Start OpenCode: `cd repos/metabob-opencode && bun run dev`
  2. Send message: `"Fix the bug in turn-lifecycle-hooks.ts"`
  3. Check logs for:
     - `"executing memory management activity"`
     - `"memory management completed"`
     - `"impulsesTransferred": <number>`
  4. Verify latency: Should be < 2s added to turn

- [ ] **6. Impulse Transfer Verification**
  ```
  After hook execution, check:
  - Parent session has impulses (scope: "session")
  - Activity session has impulses (scope: "activity")
  - Impulse IDs match between scopes
  ```

- [ ] **7. Memory Agent Tool Execution**
  ```
  In activity logs, look for:
  - impulse_create tool calls
  - memory_outline tool calls
  - impulse_load tool calls
  ```

### Phase 3: Performance & Error Handling (5 min)

- [ ] **8. Performance Measurement**
  ```bash
  # Check activity execution time in logs
  grep "memory management completed" <logfile> | jq '.duration'
  # Target: < 2000ms
  # Warning: > 5000ms
  ```

- [ ] **9. Error Handling Test**
  ```
  Simulate failure:
  1. Temporarily break template: rename manage-session-memory.json
  2. Send message
  3. Verify: Non-fatal error, main turn proceeds
  4. Restore template
  ```

- [ ] **10. Context Requirements Test**
  ```
  Execute activity with context requirements:
  - fix-bug-complete (has contextRequirements)
  - Verify gatherContext() creates impulses
  - Verify task prompts include impulse content
  ```

---

## Expected Log Output (Success Case)

```json
{
  "level": "info",
  "service": "turn-lifecycle-hooks",
  "message": "executing memory management activity",
  "sessionID": "01JFG...",
  "templateId": "manage-session-memory",
  "agent": "activity",
  "promptLength": 42
}

{
  "level": "info",
  "service": "turn-lifecycle-hooks",
  "message": "memory management completed",
  "sessionID": "01JFG...",
  "activityId": "act_01JFG...",
  "success": true,
  "duration": 1847,
  "impulsesCreated": 3,
  "impulsesTransferred": 3
}
```

---

## Potential Issues & Fixes

### Issue 1: Hook Not Executing
**Symptom**: No "executing memory management activity" log  
**Diagnosis**:
1. Check config: `config.sessionMemory?.enabled !== false`
2. Check agent mode: Should be "primary" (not subagent)
3. Check import: `turn-lifecycle-hooks.ts` must be imported somewhere

**Fix**: Verify hook registration happens on module import

---

### Issue 2: Activity Template Not Found
**Symptom**: "Template not found: manage-session-memory"  
**Diagnosis**:
1. Check file exists: `repos/metabob-proto/activities/bootstrap/manage-session-memory.json`
2. Check template ID matches: `"id": "manage-session-memory"`
3. Check template loading: TemplateLibrary.initialize()

**Fix**: Ensure bootstrap templates are loaded

---

### Issue 3: Memory Tools Not Available
**Symptom**: "Tool not found: impulse_create"  
**Diagnosis**:
1. Check tool export: `impulse-create.ts` exports `ImpulseCreateTool`
2. Check tool registration: Tool registry includes impulse tools
3. Check agent config: `memory.tools.impulse_create === true`

**Fix**: Verify tool registration in Tool registry

---

### Issue 4: Impulse Transfer Fails
**Symptom**: "failed to transfer impulse to parent session"  
**Diagnosis**:
1. Check SessionMemory.addImpulse() implementation
2. Check scope conversion: `activity` → `session`
3. Check sessionID assignment

**Fix**: Review impulse scope conversion logic in hook (lines 98-117)

---

### Issue 5: High Latency (> 5s)
**Symptom**: Activity takes too long  
**Diagnosis**:
1. Check LLM calls in memory agent tasks (5 tasks = 5 LLM calls)
2. Check impulse loading time
3. Check context requirement gathering

**Optimization**:
- Cache intent analysis for repeated patterns
- Use faster model for memory agent (claude-haiku-4-5)
- Skip hook for simple messages (< 10 chars)

---

## Success Metrics

After verification, we should see:

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| Hook execution rate | 100% (primary agent) | N/A | < 95% |
| Activity completion time | < 2s | > 3s | > 5s |
| Impulse transfer success | 100% | < 95% | < 90% |
| Tool availability | 100% | < 100% | < 90% |
| Error rate (non-fatal) | < 5% | > 10% | > 20% |

---

## Next Steps

### Immediate (Before Logging Cleanup)

1. **Run Verification** (30 min)
   - Execute Phase 1 checklist (basic functionality)
   - Execute Phase 2 checklist (integration testing)
   - Execute Phase 3 checklist (performance & error handling)

2. **Document Findings** (15 min)
   - Record actual performance metrics
   - Note any errors or warnings
   - Identify optimization opportunities

3. **Fix Critical Issues** (1-2 hours if found)
   - Only fix blocking issues (hook not running, tools missing)
   - Defer non-critical optimizations
   - Re-test after fixes

### After Verification (Logging Optimization)

4. **Categorize Logs** (30 min)
   - **Keep**: Critical lifecycle events (hook execution, activity completion, errors)
   - **Gate**: Verbose debug logs (impulse creation, loading, transfer)
   - **Remove**: Redundant logs (duplicate information)

5. **Add Debug Flag** (1 hour)
   ```typescript
   const DEBUG = process.env.OPENCODE_DEBUG_MEMORY === "true"
   
   if (DEBUG) {
     log.debug("verbose diagnostic information", { ... })
   }
   ```

6. **Performance Metrics** (30 min)
   - Add duration tracking for key operations
   - Add token utilization metrics
   - Add impulse lifecycle stats

---

## Recommendation

**DO NOT optimize logging yet.** The current verbose logging is **helping us verify** the system works correctly. Once we verify end-to-end functionality, we can confidently:

1. Keep critical lifecycle logs (hook execution, errors)
2. Gate verbose debug logs behind `OPENCODE_DEBUG_MEMORY=true`
3. Add performance metrics (duration, tokens, utilization)
4. Remove redundant logs

**Estimated Timeline**:
- Verification: 30-60 min
- Fixes (if needed): 1-2 hours
- Logging optimization: 2-3 hours
- **Total**: 4-6 hours

---

## Testing Script

Save as `test-session-memory.sh`:

```bash
#!/bin/bash
set -e

echo "=== Session Memory System Verification ==="
echo ""

echo "1. Checking hook registration..."
cd repos/metabob-opencode
if rg -q "registerHook.*memory-management" packages/opencode/src/session/turn-lifecycle-hooks.ts; then
  echo "   ✓ Hook registered"
else
  echo "   ✗ Hook not found"
  exit 1
fi

echo ""
echo "2. Checking activity template..."
if [ -f "repos/metabob-proto/activities/bootstrap/manage-session-memory.json" ]; then
  echo "   ✓ Template exists"
else
  echo "   ✗ Template not found"
  exit 1
fi

echo ""
echo "3. Checking memory agent tools..."
TOOLS=("impulse_create" "impulse_load" "impulse_unload" "memory_outline" "memory_budget" "memory_optimize")
for tool in "${TOOLS[@]}"; do
  if rg -q "$tool.*true" packages/opencode/src/agent/agent.ts; then
    echo "   ✓ $tool"
  else
    echo "   ✗ $tool missing"
    exit 1
  fi
done

echo ""
echo "4. Checking tool implementations..."
for tool in "${TOOLS[@]}"; do
  if [ -f "packages/opencode/src/tool/$tool.ts" ]; then
    echo "   ✓ $tool.ts"
  else
    echo "   ✗ $tool.ts missing"
    exit 1
  fi
done

echo ""
echo "=== All Static Checks Passed ==="
echo ""
echo "Next: Run live session test"
echo "  cd repos/metabob-opencode && bun run dev"
echo "  > 'Fix the bug in turn-lifecycle-hooks.ts'"
echo ""
echo "Look for logs:"
echo "  - 'executing memory management activity'"
echo "  - 'memory management completed'"
echo "  - 'impulsesTransferred': <number>"
```

Make executable: `chmod +x test-session-memory.sh`

Run: `./test-session-memory.sh`

---

## Conclusion

The session memory system is **architecturally complete and well-designed**. We have:

- ✅ Turn lifecycle hooks registered and ready
- ✅ Memory management activity template with 5-task workflow
- ✅ Memory agent with all 9 required tools
- ✅ Impulse system with creation, loading, transfer
- ✅ Context gathering for activity templates
- ✅ Error handling (non-fatal, graceful degradation)

**Next Action**: Run verification to confirm it works end-to-end, then optimize logging.

This ensures we don't remove logging that's helping us debug real issues.
