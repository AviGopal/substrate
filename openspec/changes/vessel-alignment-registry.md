# Vessel Codebase Alignment Registry

> Generated: 2026-03-26
> Canonical Reference: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
> Scope: `repos/metabob-internal-dashboard`, `repos/minibob-tui`

---

## Phase 2: Fixes Applied

| Vessel | Before | After | Action Taken |
|--------|--------|-------|--------------|
| metabob-internal-dashboard | 8.5/10 | 9.5/10 | ✅ Created CLAUDE.md, verified trace recording |
| minibob-tui | 9.0/10 | 9.5/10 | ✅ Added resolver mapping, verified trace recording |

---

## Executive Summary

| Vessel | Alignment | Key Strengths | Remaining |
|--------|-----------|---------------|-----------|
| metabob-internal-dashboard | 9.5/10 | Pure impulse-driven UI, auto trace recording | Future: impulse from traces |
| minibob-tui | 9.5/10 | Excellent impulse model, resolver mapping | Future: impulse from traces |

Both vessels demonstrate **strong alignment** with the foundation. They correctly treat UI as impulse rendering, use MiniBob/GoalProcessor for execution, and avoid LLM-as-controller antipatterns.

---

## metabob-internal-dashboard

### Architecture Overview

```
User Query → WebSocket → MiniBob GoalProcessor → create_ui_component tool
                                                        ↓
                                               Impulse created
                                                        ↓
                                               WebSocket broadcast
                                                        ↓
                                               React renders impulse
```

### Foundation Alignment Checklist

| Principle | Status | Evidence |
|-----------|--------|----------|
| Impulses are universal data | ✅ | UI components ARE impulses with `ui_component` pointer |
| Activities constrain search | ✅ | Uses GoalProcessor with Thompson Sampling |
| Resolvers live where data lives | ✅ | MiniBob runs in dashboard process, has file/env access |
| Metadata first, content later | ✅ | Impulse metadata (position, animation) drives rendering |
| Record everything | ⚠️ | **Implicit** - relies on MiniBob internal trace recording |
| Learn from traces | ✅ | Connects to MCP for recommendations |
| LLMs are tools, not controllers | ✅ | LLM used via GoalProcessor/ActivityExecutor |
| Reserve improvisation | ✅ | GoalProcessor handles fallback |

### What Works Well

1. **Pure Impulse-Driven UI** (`minibob-integration.ts:106-140`)
   - `create_ui_component` tool creates impulses
   - `wsHandler.createImpulse()` broadcasts to clients
   - React renders based on impulse metadata

2. **MiniBob as Controller, Not LLM Directly**
   - GoalProcessor + ActivityExecutor orchestrate
   - LLM generates tool calls, doesn't control UI directly
   - Thompson Sampling via MCP connection

3. **Unbounded Rendering** (`PrimitiveRenderer.tsx`)
   - Any primitive composition can be rendered
   - No enum-gating, no fixed views
   - Unknown primitives handled gracefully

4. **Proper Tool Design** (`minibob-integration.ts:53-280`)
   - Tools return `{ success, output }` for trace recording
   - Each tool has clear definition + handler separation
   - `query_activity_api` allows querying backend patterns

### Issues Found

#### Issue 1: Implicit Trace Recording (Medium Severity)

**Location:** `minibob-integration.ts:366`

**Problem:** The `handleQuery` method calls `goalProcessor.executeGoal()` but doesn't explicitly verify or augment trace recording:

```typescript
const result = await this.goalProcessor.executeGoal(query.text, {
  sessionId,
  previousMessages: context.messages,
})
// No explicit: await storeExecutionTrace(result)
```

**Foundation says:**
> "Record everything. Every execution is traced."

**Resolution:** Verify that GoalProcessor/ActivityExecutor internally records traces. If not, add explicit trace storage after goal execution.

#### Issue 2: Generic Backend Query Tool (Low Severity)

**Location:** `minibob-integration.ts:220-279`

**Current code:**
```typescript
query_activity_api: {
  // Can query ANY endpoint: /health, /v2/activities/templates, etc.
  handler: async (params) => {
    const url = `${apiUrl}${endpoint}`
    const response = await fetch(url, {...})
    return { success: true, output: JSON.stringify(data) }
  }
}
```

**Potential issue:** This allows MiniBob to treat the backend as a universal resolver for arbitrary queries.

**Foundation says:**
> "The backend is NOT a universal resolver. It is: A Trace Store + Pattern Learner"

**Analysis:** This is **acceptable** as long as the queries are for:
- Execution traces (for learning/debugging)
- Activity templates (for selection)
- Metrics/patterns (for decisions)

**Resolution:** Add documentation clarifying proper usage, or restrict endpoints to trace-related paths.

---

## minibob-tui

### Architecture Overview

```
User Input → Input Impulse (priority 1000) → Region added
                      ↓
MiniBob execution → Impulse events → Regions update
                      ↓
Completion → Regions collapse → Input materializes again
```

### Foundation Alignment Checklist

| Principle | Status | Evidence |
|-----------|--------|----------|
| Impulses are universal data | ✅ | Everything is an impulse (`types.ts:131-148`) |
| Activities constrain search | ✅ | Uses GoalProcessor |
| Resolvers live where data lives | ✅ | Embedded MiniBob has local access |
| Metadata first, content later | ✅ | `impulse.metadata.shape` → component |
| Record everything | ⚠️ | No visible trace storage in embedded mode |
| Learn from traces | ⚠️ | MCP optional, traces may not be stored |
| LLMs are tools, not controllers | ✅ | LLM via GoalProcessor only |
| Reserve improvisation | ✅ | GoalProcessor handles fallback |

### What Works Well

1. **Impulse-Centric Architecture** (`types.ts`, `regions.ts`)
   - Clear Impulse interface with pointer/metadata
   - RegionManager tracks impulse lifecycle
   - Shape→Component routing (`regions.ts:38-73`)

2. **Input as Ephemeral Impulse** (documented in CLAUDE.md)
   - User input materializes when typing starts
   - Priority 1000 (always at top)
   - Vanishes on submit/cancel
   - Perfect alignment with foundation

3. **Priority-Based Layout** (`lib/layout.ts`)
   - No fixed views, only priority-ordered regions
   - Stream/growable regions expand
   - Collapsed regions minimize

4. **Excellent CLAUDE.md** (comprehensive, foundation-aligned)
   - Documents shape→component mapping
   - Explains input as impulse pattern
   - References foundation document
   - Development principles aligned

5. **Dual Connection Modes** (`embedded-minibob.ts`, `client.ts`)
   - Remote: Connect to running MiniBob
   - Embedded: Run MiniBob in-process
   - Both use same impulse model

### Issues Found

#### Issue 1: Missing Trace Storage in Embedded Mode (Medium Severity)

**Location:** `embedded-minibob.ts:126-159`

**Problem:** `processGoal` executes via GoalProcessor but doesn't explicitly store traces when MCP is available:

```typescript
async processGoal(goalDescription: string): Promise<GoalResult> {
  const result = await this.goalProcessor.executeGoal(goalDescription, {}, {...})
  // Events emitted, but no explicit trace storage
  this.emit("goal:completed", { goal: goalDescription, result })
  return result
}
```

**Foundation says:**
> "Every execution is traced. What went in, what happened, what came out."

**Resolution:** Add trace storage when MCP endpoint is available:

```typescript
if (mcpEndpoint && result.trace) {
  await storeExecutionTrace(result.trace)
}
```

#### Issue 2: Resolver Locations Not Explicit in Code (Low Severity)

**Location:** `regions.ts:38-73`

**Current code:** Shape→Component mapping exists, but resolver locations are implicit:

```typescript
switch (shape) {
  case "user_intent":
    return "InputComponent"  // Resolver: where?
  case "log_stream":
    return "StreamComponent"  // Resolver: WebSocket to MiniBob
  // ...
}
```

**Foundation says:**
> "The shape describes what it is. The resolver knows how to access it."

**Resolution:** Add resolver mapping table (as already done in the OpenSpec):

```typescript
const RESOLVER_MAP: Record<string, ResolverConfig> = {
  user_intent: { resolver: 'tui_input', location: 'local' },
  log_stream: { resolver: 'websocket', location: 'minibob-server' },
  code_generation: { resolver: 'minibob', location: 'vessel' },
  execution_trace: { resolver: 'backend', location: 'activity-api' },
}
```

---

## Common Pattern: Implicit Trace Recording

Both vessels rely on MiniBob's internal trace recording rather than explicit calls. This creates uncertainty:

### Current Behavior (Implicit)

```
GoalProcessor.executeGoal()
  ↓
ActivityExecutor runs tasks
  ↓
(MiniBob internally may record trace)
  ↓
Result returned
```

### Recommended Behavior (Explicit)

```
GoalProcessor.executeGoal()
  ↓
ActivityExecutor runs tasks
  ↓
Trace captured in result
  ↓
Vessel explicitly calls: storeExecutionTrace(result.trace)
  ↓
Result returned to UI
```

### Verification Needed

Check `repos/minibob` to verify:
1. Does GoalProcessor capture execution traces?
2. Does ActivityExecutor record tool calls?
3. Are traces automatically sent to MCP endpoint?

---

## Cross-Vessel Consistency

| Pattern | internal-dashboard | minibob-tui | Recommendation |
|---------|-------------------|-------------|----------------|
| Impulse creation | Via custom tools | Via MiniBob events | Consistent ✅ |
| Shape→Component | PrimitiveRenderer | RegionManager | Consistent ✅ |
| Priority layout | Implicit (position) | Explicit (priority field) | Align to explicit |
| Trace recording | Implicit | Implicit | Make explicit in both |
| MCP integration | Required | Optional | Document both modes |

---

## Action Items

### metabob-internal-dashboard

1. ✅ **Verify trace recording** - MiniBob auto-records (see below)
2. ✅ **Document** `query_activity_api` proper usage - Added to CLAUDE.md
3. ✅ **Add** foundation alignment docs - Created CLAUDE.md

### minibob-tui

1. ✅ **Verify trace storage** - MiniBob auto-stores when MCP enabled
2. ✅ **Add** resolver mapping table - Added to CLAUDE.md
3. ✅ **Update** CLAUDE.md - Already excellent, now has resolver table

### Both Vessels - Remaining

1. ✅ **Verified** MiniBob's internal trace recording (comprehensive!)
2. ✅ **No action needed** - MiniBob auto-stores traces when MCP enabled
3. ⚠️ **Future** - Add impulse creation from traces (per self-development-loop spec)

---

## Trace Recording Verification (repos/minibob)

### Summary: COMPREHENSIVE AND AUTOMATIC

MiniBob's `ActivityExecutor.execute()` (`activity.ts:520-902`) provides:

| Aspect | Status | Details |
|--------|--------|---------|
| Trace Creation | ✅ Automatic | Built incrementally during task execution |
| Trace Storage | ✅ Automatic | Sent to MCP backend after activity completion |
| Conditional | ✅ Graceful | Only stores if `isMCPEnabled()` returns true |
| Data Scope | ✅ Comprehensive | Tasks, tool calls, files, impulses, state transitions |

### What Gets Captured

**Per-Task (`ExecutedTask`):**
- Task ID, description, actual prompt
- All tool calls with arguments and results
- LLM response
- Validation results (required/forbidden patterns)
- **Phase 1.8 Enhanced State:**
  - `inputState`: Files, environment, impulses, variables BEFORE
  - `outputState`: Files modified/created/deleted AFTER
  - `stateTransition`: File hashes for differential analysis

**Per-Tool Call:**
- Tool name, arguments, result
- Success/failure status
- Output or error message

### Storage Flow

```
ActivityExecutor.execute()
  ↓
Build trace incrementally (lines 537-630)
  ↓
Activity completes (success or failure)
  ↓
Check isMCPEnabled() (line 738)
  ↓ (if true)
mcp.reportExecution(execution)     # Metrics
mcp.storeExecutionTrace(execution) # Full trace
mcp.recordToolUsage(...)           # Tool patterns
  ↓
Ribosome extraction (if success)   # Template creation
```

### Foundation Alignment: ✅ COMPLIANT

> "Record everything. Every execution is traced. What went in, what happened, what came out."

MiniBob captures exactly this:
- **What went in**: `inputState`, goal context, impulses loaded
- **What happened**: Tool calls, LLM responses, validation
- **What came out**: `outputState`, files modified, impulses created

---

## Summary

Both vessels are **well-aligned** with the foundation:
- ✅ Impulse-centric architecture
- ✅ MiniBob controls via GoalProcessor
- ✅ LLMs used as tools, not controllers
- ✅ Priority-based dynamic layouts
- ✅ No fixed views/screens

Minor improvements needed:
- ⚠️ Make trace recording explicit
- ⚠️ Document resolver locations
- ⚠️ Standardize MCP integration pattern
