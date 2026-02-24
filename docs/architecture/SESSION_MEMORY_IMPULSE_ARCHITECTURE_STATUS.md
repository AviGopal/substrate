# Session Memory & Impulse System Architecture Status

## Overview

The session memory management and impulse system is **architecturally complete** but needs verification and potential optimization before cleaning up logging.

**Date**: 2026-02-20  
**Status**: 🟡 Architecture complete, verification needed

---

## System Architecture

### 1. Lifecycle Hook (Entry Point)

**File**: `turn-lifecycle-hooks.ts` (lines 20-180)

**Flow**:
```
User sends message
  ↓
TurnLifecycle.preTurn hooks triggered
  ↓
"memory-management" hook (priority: 10)
  ↓
Execute "manage-session-memory" activity
  ↓
Transfer impulses from activity → parent session
  ↓
Main agent turn starts with prepared context
```

**Key Features**:
- ✅ Runs BEFORE main agent turn
- ✅ Uses `executeActivityInline()` for child session isolation
- ✅ Transfers impulses from activity scope → session scope
- ✅ Non-fatal: continues if hook fails (logs warning)

**Conditions** (hook runs when):
- ✅ `sessionMemory.enabled !== false` in config
- ✅ Agent mode is "primary" (not subagents)
- ✅ Message length > 10 chars (skip acknowledgments)

---

### 2. Memory Management Activity

**Template**: `manage-session-memory.json`  
**Category**: infrastructure  
**Tasks**: 5 sequential tasks

#### Task 1: analyze-intent (memory agent)
- Analyze user message
- Classify intent (code_fix, feature_request, question, etc.)
- Suggest impulses to create (unloaded state)
- Output: JSON with `suggestedImpulses` array

#### Task 2: create-impulses (memory agent)
- Create impulses from analysis using `impulse_create` tool
- Impulses created in **unloaded state** (pointer only, no content)
- Validate file paths before creating file impulses

#### Task 3: review-context-space (memory agent)
- Call `memory_context_view` to see current space
- Analyze token budget (target: 60-70% utilization)
- Load selected impulses with `impulse_load` based on priority
- Strategy: HIGH first, MEDIUM if budget allows, skip LOW

#### Task 4: optimize-if-needed (memory agent)
- Check utilization with `memory_budget`
- If > 75%: compress or unload impulses
- Use `memory_compress` and `memory_reorder` tools

#### Task 5: finalize-context (memory agent)
- Review final state
- Summarize loaded impulses and utilization
- Confirm context ready for main agent

**Context Requirements**:
```json
{
  "key": "contextSpace",
  "hint": "Current session context space...",
  "impulseTypes": ["memo"],
  "required": true,
  "budgetRange": [500, 1000]
}
```

---

### 3. Activity Context Gathering

**File**: `activity.ts` (lines 596-675)

**Flow for activities with `contextRequirements`**:
```
Activity execution starts
  ↓
Check template.contextRequirements[]
  ↓
Call SessionMemoryAgent.gatherContext()
  ↓
Memory agent analyzes requirements + recent messages
  ↓
Creates impulses (unloaded pointers)
  ↓
Load impulses for each requirement
  ↓
Map context → template variables
  ↓
Pass enriched variables to tasks
```

**Example**:
```json
{
  "contextRequirements": [
    {
      "key": "bugDescription",
      "hint": "The bug report details",
      "impulseTypes": ["memo", "file"],
      "required": true
    }
  ]
}
```

↓ Memory agent creates impulses
↓ Loads content
↓ Creates variable: `bugDescription = "<impulse content>"`
↓ Task can use `{{bugDescription}}` in prompt

---

### 4. SessionMemoryAgent.gatherContext()

**File**: `memory-agent.ts` (lines 444-609)

**Purpose**: Create impulses to satisfy activity context requirements

**Flow**:
1. Analyze context needs using LLM
2. For each requirement, create appropriate impulse types
3. Return impulses in **unloaded state** (pointers only)

**Impulse Types Supported**:
- `file`: Source code files
- `component`: Specific functions/classes
- `metabobPriorityIssues`: Code quality issues
- `metabobAnnotation`: Design decisions
- `metabobChangeImpact`: Dependency analysis
- `conversationHistory`: Recent turns
- `bashOutput`: Dynamic shell commands
- `memo`: Short notes/errors

**Error Handling**:
- Throws if **required** context not found
- Warns if **optional** context not found
- Writes debug info to `/tmp/memory-agent-debug.json`

---

### 5. Impulse Lifecycle in Activities

**File**: `activity.ts` (lines 1990-2050)

**Per-Task Flow**:
```
Task starts
  ↓
Load impulses for task.impulseReferences[]
  ↓
Extract loaded impulses for metadata enrichment
  ↓
Enrich variables with impulse metadata:
    {{impulseId.tokens}}, {{impulseId.budget}}, {{impulseId.loaded}}
  ↓
Interpolate prompt with enriched variables
  ↓
Inject impulse content into prompt
  ↓
Inject calling agent's reason
  ↓
Execute task with full context
```

**Key Function**: `loadAndFormatImpulses()`
- Loads impulses if not already loaded
- Formats content for injection
- Returns formatted section for prompt

---

## Current Status by Component

### ✅ Working Components

| Component | Status | Evidence |
|-----------|--------|----------|
| Turn lifecycle hook | ✅ Implemented | `turn-lifecycle-hooks.ts:20-180` |
| manage-session-memory activity | ✅ Template exists | `manage-session-memory.json` |
| executeActivityInline() | ✅ Implemented | `activity.ts:1029-1180` |
| Impulse transfer (activity→session) | ✅ Implemented | `turn-lifecycle-hooks.ts:92-118` |
| SessionMemoryAgent.gatherContext() | ✅ Implemented | `memory-agent.ts:444-609` |
| Context requirement mapping | ✅ Implemented | `activity.ts:596-675` |
| Impulse loading in tasks | ✅ Implemented | `activity.ts:1990-2050` |

### 🟡 Needs Verification

| Component | Issue | Action Needed |
|-----------|-------|---------------|
| Hook execution | Does it actually run? | Test with real session |
| Memory agent tools | Are they available? | Verify `impulse_create`, `impulse_load`, etc. |
| Context transfer | Do impulses transfer correctly? | Test impulse scope conversion |
| Token budget tracking | Is utilization calculated correctly? | Verify memory_budget tool |
| Impulse persistence | Do impulses survive session lifecycle? | Test SessionMemory storage |

### ⚠️ Potential Issues

1. **Performance Impact**
   - Pre-turn hook adds latency to EVERY user message
   - 5-task activity execution before main turn
   - Multiple LLM calls per turn

2. **Error Handling**
   - Hook failure is non-fatal (logs warning, continues)
   - May result in agent working without prepared context
   - No retry mechanism for failed context gathering

3. **Tool Availability**
   - Memory agent needs: `impulse_create`, `impulse_load`, `impulse_unload`, `memory_context_view`, `memory_budget`, `memory_compress`, `memory_reorder`
   - These must be available in memory agent configuration

4. **Impulse Scope Conversion**
   ```typescript
   // Convert from "activity" scope to "session" scope
   const sessionImpulse = {
     ...impulse,
     scope: "session" as const,
     sessionID: ctx.sessionID,
   }
   ```
   - Needs verification that SessionMemory.addImpulse() handles this correctly

5. **Context Requirement Validation**
   - `gatherContext()` throws if required context not found
   - May cause activity execution to fail
   - Alternative: make requirements optional by default?

---

## Verification Checklist

### Phase 1: Basic Functionality ✅ / ❌

- [ ] **Hook registration**: Verify hook is registered on import
  ```typescript
  // In turn-lifecycle-hooks.ts
  TurnLifecycle.registerHook({ name: "memory-management", ... })
  ```

- [ ] **Hook execution**: Test that hook runs on user message
  ```bash
  # Send message in OpenCode session
  # Check logs for: "executing memory management activity"
  ```

- [ ] **Activity template loading**: Verify template exists and loads
  ```typescript
  const template = await ActivityTemplateManager.getTemplate("manage-session-memory")
  // Should not be null
  ```

- [ ] **Memory agent tools**: Verify tools are available
  ```typescript
  const memoryAgent = await Agent.get("memory")
  // Check memoryAgent.tools includes: impulse_create, impulse_load, etc.
  ```

- [ ] **Impulse creation**: Test impulse_create tool
  ```typescript
  impulse_create({
    id: "test",
    pointer: { type: "memo", content: "test" },
    budget: 100,
    priority: "high"
  })
  ```

- [ ] **Impulse loading**: Test impulse_load tool
  ```typescript
  impulse_load({ id: "test" })
  // Verify impulse.loaded === true and content exists
  ```

- [ ] **Context space view**: Test memory_context_view tool
  ```typescript
  memory_context_view()
  // Should return impulse list with metadata
  ```

- [ ] **Impulse transfer**: Verify impulses transfer from activity→session
  ```typescript
  // After hook execution, check parent session
  const session = await SessionMemory.get(sessionID)
  // Should have impulses from activity
  ```

### Phase 2: Integration Testing ✅ / ❌

- [ ] **End-to-end hook flow**: Test complete lifecycle
  ```
  User message → Hook triggers → Activity runs → Impulses transferred → Main agent turn
  ```

- [ ] **Context gathering for activities**: Test activity with contextRequirements
  ```typescript
  activity({
    templateId: "fix-bug-complete",  // Has contextRequirements
    variables: { ... },
    reason: "Fix TypeError in bash tool"
  })
  // Verify gatherContext() creates impulses
  ```

- [ ] **Impulse metadata enrichment**: Verify {{impulseId.tokens}} works
  ```typescript
  // In task prompt: "Budget: {{myImpulse.budget}} tokens"
  // Should interpolate to: "Budget: 2000 tokens"
  ```

- [ ] **Token budget tracking**: Verify utilization calculations
  ```typescript
  memory_budget()
  // Should return accurate token counts
  ```

- [ ] **Impulse compression**: Test memory_compress tool
  ```typescript
  memory_compress({
    impulseId: "large-file",
    strategy: "extract-key-sections",
    targetTokens: 1500
  })
  ```

### Phase 3: Performance & Error Handling ✅ / ❌

- [ ] **Hook latency**: Measure pre-turn delay
  ```
  Target: < 2s for typical message
  Warning: > 5s indicates performance issue
  ```

- [ ] **Hook failure handling**: Test graceful degradation
  ```typescript
  // Simulate hook failure
  // Verify main turn still proceeds (logs warning)
  ```

- [ ] **Context gathering failure**: Test required context not found
  ```typescript
  // Activity with required context that doesn't exist
  // Should throw error with helpful message
  ```

- [ ] **Memory pressure**: Test with high token utilization
  ```typescript
  // Load many large impulses
  // Verify compression/unloading works
  ```

- [ ] **Long-running sessions**: Test impulse lifecycle over time
  ```
  Multiple turns → Impulses loaded → Used → Unloaded → GC'd
  ```

---

## Architecture Decisions to Review

### 1. Pre-Turn Hook Enabled by Default?

**Current**: Hook runs for ALL primary agent messages (if enabled in config)

**Pros**:
- Automatic context preparation
- No manual impulse management needed
- Proactive memory optimization

**Cons**:
- Adds latency to every turn
- Uses tokens for memory management
- May be unnecessary for simple messages

**Options**:
- A. Keep current: Enabled by default, skip for short messages (< 10 chars)
- B. Make opt-in: Only enable for specific agent modes or sessions
- C. Smart detection: Only run if session has existing impulses or complex history

**Recommendation**: Test performance first, then decide

### 2. Context Requirement Strictness

**Current**: `gatherContext()` throws if required context not found

**Pros**:
- Ensures activities don't run without critical context
- Fails fast with clear error message

**Cons**:
- May be too strict for some use cases
- Activity execution fails completely

**Options**:
- A. Keep current: Strict required validation
- B. Make lenient: Warn but continue with partial context
- C. Configurable: Template specifies strict vs lenient mode

**Recommendation**: Keep current (fail fast is better for debugging)

### 3. Impulse Scope Conversion

**Current**: Activity impulses → Session impulses (scope conversion)

**Pros**:
- Impulses survive activity completion
- Available for subsequent turns
- Enables cross-activity context sharing

**Cons**:
- May accumulate too many impulses over time
- Session scope vs activity scope semantics unclear

**Options**:
- A. Keep current: Transfer all impulses to session
- B. Selective: Only transfer HIGH priority impulses
- C. TTL-based: Set expiration times on transferred impulses

**Recommendation**: Keep current, add cleanup hook later

### 4. Memory Agent Autonomy

**Current**: Memory agent decides what to load/unload based on priority and budget

**Pros**:
- Autonomous context management
- Adapts to available token budget
- Reduces manual intervention

**Cons**:
- Agent may make suboptimal decisions
- Hard to debug why context was/wasn't loaded
- No override mechanism for human/agent preferences

**Options**:
- A. Keep current: Fully autonomous
- B. Hints: Provide loading hints to memory agent
- C. Explicit: Require explicit load/unload commands

**Recommendation**: Keep current, add debugging tools

---

## Next Steps

### Immediate (Before Logging Cleanup)

1. **Verify hook execution**
   - Start OpenCode session
   - Send message
   - Check logs for "executing memory management activity"
   - Verify activity completes successfully

2. **Test memory agent tools**
   - Verify memory agent has required tools
   - Test impulse_create, impulse_load, memory_context_view
   - Check tool permissions and availability

3. **Test impulse transfer**
   - Verify impulses transfer from activity→session
   - Check impulse scope conversion
   - Verify SessionMemory.addImpulse() works

4. **Measure performance**
   - Record pre-turn hook latency
   - Identify bottlenecks
   - Decide if optimization needed

### Short-Term (After Verification)

5. **Add debugging tools**
   - `memory_debug` tool: Show full context space state
   - `memory_stats` tool: Show token utilization over time
   - `impulse_trace` tool: Show impulse lifecycle history

6. **Optimize logging**
   - Remove verbose debug logs (or gate behind flag)
   - Keep critical lifecycle events
   - Add performance metrics

7. **Document behavior**
   - Update docs with hook flow diagrams
   - Document when/why context gathering runs
   - Provide troubleshooting guide

### Long-Term (Future Enhancements)

8. **Performance optimization**
   - Cache intent analysis for repeated patterns
   - Batch impulse operations
   - Lazy load content only when needed by tasks

9. **Smart context selection**
   - Learn from agent feedback on context usefulness
   - Track which impulses are actually used in responses
   - Prioritize based on historical relevance

10. **Context compression**
    - Implement semantic compression for large files
    - Summarize conversation history
    - Extract key sections from documentation

---

## Files to Review

### Core Implementation
- `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`
- `repos/metabob-opencode/packages/opencode/src/session/memory-agent.ts`
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts` (lines 596-675, 1990-2050)

### Templates
- `repos/metabob-proto/activities/bootstrap/manage-session-memory.json`

### Tests (if they exist)
- `repos/metabob-opencode/packages/opencode/test/session/turn-lifecycle-*.test.ts`
- `repos/metabob-opencode/packages/opencode/test/session/memory-*.test.ts`

### Configuration
- `opencode.json` - Check `sessionMemory.enabled` flag
- Agent definitions - Verify memory agent has required tools

---

## Questions to Answer

1. **Is the hook actually registered and running?**
   - Check: Does `turn-lifecycle-hooks.ts` import trigger registration?
   - Check: Does pre-turn hook list include "memory-management"?

2. **Are memory agent tools available?**
   - Check: Does memory agent config include impulse_* tools?
   - Check: Are tools properly implemented and registered?

3. **Does impulse transfer work correctly?**
   - Check: Do impulses appear in parent session after hook?
   - Check: Does scope conversion preserve all properties?

4. **What's the performance impact?**
   - Measure: Latency added by pre-turn hook
   - Measure: Token cost of memory management activity
   - Measure: Memory usage of loaded impulses

5. **How does it handle errors?**
   - Test: Hook execution fails (activity error)
   - Test: Context gathering fails (required context missing)
   - Test: Impulse loading fails (file not found, etc.)

6. **Is there excessive logging?**
   - Review: Log volume during normal operation
   - Review: Which logs are actually useful for debugging?
   - Review: Can logs be gated behind debug flag?

---

## Success Criteria

Before cleaning up logging, we need to verify:

- ✅ Hook executes successfully on user messages
- ✅ Memory agent tools are available and working
- ✅ Impulses transfer correctly from activity→session
- ✅ Token budget tracking is accurate
- ✅ Context gathering creates appropriate impulses
- ✅ Tasks can use impulse content via {{impulseId}} variables
- ✅ Performance is acceptable (< 2s latency for typical message)
- ✅ Errors are handled gracefully (non-fatal hook failures)

Once verified, we can:
- Remove/gate excessive debug logging
- Keep critical lifecycle event logs
- Add performance metrics
- Document expected behavior

---

## Conclusion

The **architecture is complete and well-designed**, but needs hands-on verification before we can confidently clean up logging. The logging is likely there for debugging the exact flow we need to verify now.

**Recommended approach**:
1. Run verification tests (Phase 1 checklist)
2. Measure performance and identify issues
3. Fix any critical bugs found
4. THEN clean up logging (keep what's useful, remove noise)

This ensures we don't remove logging that's actually helping us debug a real issue.
