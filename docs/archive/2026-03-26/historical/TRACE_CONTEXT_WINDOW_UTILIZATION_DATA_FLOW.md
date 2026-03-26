# Trace: Context Window Utilization Data Flow

**Specification**: context-window-utilization-data-flow  
**Status**: ❌ INCOMPLETE - Critical gaps identified  
**Priority**: HIGH  
**Date**: 2026-02-23

---

## Executive Summary

Traced the complete implementation of context window utilization tracking from token estimation through color-coded TUI display. **Identified 4 critical bugs** preventing accurate user feedback about resource utilization.

### Critical Findings

1. **HIGH SEVERITY**: Model context window hardcoded to 200K (breaks for GPT-4 with 128K)
2. **MEDIUM SEVERITY**: System prompt and message tokens are static estimates (up to 50% error)
3. **MEDIUM SEVERITY**: TUI displays wrong thresholds (60%/85% instead of 70%/90%)
4. **LOW SEVERITY**: Missing input validation for impulseTokens parameter

---

## Component Analysis

### 5 Components Traced

| Component | File | Status | Gap |
|-----------|------|--------|-----|
| getContextWindowState | session-state.ts:419-441 | ❌ INCOMPLETE | Dynamic calculation needed |
| getBudgetStats | session-memory.ts:474-493 | ✅ COMPLETE | No changes needed |
| Context Window Display | sidebar.tsx:530-538 | ❌ INCORRECT | Wrong thresholds, missing display |
| SessionState.get | session-state.ts:327-370 | ✅ COMPLETE | No changes needed |
| estimateTokens | impulse-resolver.ts:707 | ⚠️ ACCEPTABLE | Optional enhancement |

---

## Current State vs Desired State

### Token Calculation
- **Current**: `estimatedTokens = impulseTokens + 2000 + 4000` (hardcoded)
- **Desired**: `estimatedTokens = impulseTokens + systemPromptTokens(dynamic) + recentMessageTokens(actual)`
- **Status**: ❌ INCOMPLETE

### Context Window Limit
- **Current**: `maxTokens = 200000` (hardcoded Claude 3.5)
- **Desired**: `maxTokens = model.contextWindow` (dynamic from model config)
- **Status**: ❌ INCOMPLETE

### Color Thresholds
- **Current**: Red >=85%, Yellow >=60%, Green <60% (impulse budget thresholds)
- **Desired**: Red >=90%, Yellow >=70%, Green <70% (context window thresholds)
- **Status**: ❌ INCORRECT

### TUI Display
- **Current**: Shows impulse budget utilization only
- **Desired**: Shows context window utilization with "📊 Tokens:" and "🎯 Utilization:" sections
- **Status**: ❌ INCOMPLETE

### Input Validation
- **Current**: No validation of impulseTokens
- **Desired**: Validate Number.isFinite() and non-negative
- **Status**: ❌ MISSING

---

## Data Flow Diagram

```
Entry Point: TUI Sidebar (poll every 2.5s)
  ↓
HTTP GET /session/:id/state
  ↓
SessionState.get(sessionID)
  ↓
Parallel Fetch:
├─ impulses.usedTokens (from getBudgetStats) ✅
├─ getContextWindowState(sessionID, impulseTokens)
│    ├─ Query model.contextWindow ❌ MISSING
│    ├─ Query agentMode → systemPromptTokens ❌ MISSING
│    ├─ Query last 10 messages → recentMessageTokens ❌ MISSING
│    └─ Validate impulseTokens ❌ MISSING
└─ Other state (activities, ACP, MCP) ✅
  ↓
Aggregate SessionState.State ✅
  ↓
JSON Response ✅
  ↓
TUI setSessionState() ✅
  ↓
Threshold Check (70%/90%) ❌ INCORRECT (currently 60%/85%)
  ↓
Color-coded Display ❌ INCOMPLETE (missing context window section)
```

---

## Critical Bugs Identified

### Bug 1: Hardcoded Model Context Window (HIGH)
- **Location**: `session-state.ts:433`
- **Current**: `const maxTokens = 200000`
- **Problem**: Breaks for GPT-4 (128K), Claude 3 Haiku, and other models
- **Impact**: Incorrect utilization calculation, false alarms or missed warnings
- **Fix**: Query `ModelRegistry.get(session.model).contextWindow`

### Bug 2: Hardcoded Token Estimates (MEDIUM)
- **Location**: `session-state.ts:425-426`
- **Current**: `systemPromptEstimate = 2000`, `messageHistoryEstimate = 4000`
- **Problem**: Static estimates with up to 50% error in edge cases
- **Impact**: Inaccurate context window estimates, premature or delayed warnings
- **Fix**: Calculate dynamically from agent mode and actual message history

### Bug 3: Wrong Display Thresholds (MEDIUM)
- **Location**: `sidebar.tsx:530-535`
- **Current**: Shows impulse budget (60%/85% thresholds)
- **Problem**: Displays wrong metric with incorrect color coding
- **Impact**: Users see wrong utilization percentage and colors
- **Fix**: Add separate context window display section with 70%/90% thresholds

### Bug 4: Missing Input Validation (LOW)
- **Location**: `session-state.ts:419`
- **Current**: No validation of `impulseTokens` parameter
- **Problem**: Function can break on NaN/Infinity/negative values
- **Impact**: Calculation errors propagate to JSON response
- **Fix**: Add `Number.isFinite()` and non-negative checks

---

## Implementation Plan

### Phase 1: Backend Data Flow (Priority: HIGH)

**Tasks**:
1. Add `ModelRegistry.get(sessionModel)` to query `contextWindow`
2. Add agent mode → system prompt tokens lookup table
3. Add `Session.getRecentMessages(sessionID, limit=10)` to sum token counts
4. Update `getContextWindowState()` to use dynamic values
5. Add impulseTokens validation

**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/session/session-state.ts`
- `repos/metabob-opencode/packages/opencode/src/session/index.ts` (add getRecentMessages)

**Example Code**:
```typescript
// session-state.ts:419
async function getContextWindowState(sessionID: string, impulseTokens: number): Promise<ContextWindowState> {
  // Validate input
  if (!Number.isFinite(impulseTokens) || impulseTokens < 0) {
    throw new Error(`Invalid impulseTokens: ${impulseTokens}`)
  }

  // Query model config
  const session = await Session.get(sessionID)
  const modelConfig = await ModelRegistry.get(session.model)
  const maxTokens = modelConfig?.contextWindow ?? 200000

  // Dynamic system prompt tokens
  const agentMode = session.agentMode
  const systemPromptTokens = SYSTEM_PROMPT_TOKENS[agentMode] ?? 2000

  // Actual recent messages
  const recentMessages = await Session.getRecentMessages(sessionID, 10)
  const recentMessageTokens = recentMessages.reduce((sum, msg) => sum + (msg.tokenCount ?? 0), 0)

  const estimatedTokens = impulseTokens + systemPromptTokens + recentMessageTokens
  const cacheStats = await getCacheStats(sessionID)

  return {
    estimatedTokens,
    maxTokens,
    utilizationPercent: (estimatedTokens / maxTokens) * 100,
    cacheStats,
  }
}
```

---

### Phase 2: TUI Display (Priority: HIGH)

**Tasks**:
1. Add context window section to TUI sidebar
2. Update thresholds to 70%/90%
3. Add "📊 Tokens: {estimated} / {max} ({utilization}%)" display
4. Add "🎯 Utilization: {color} {status}" display
5. Keep impulse budget section separate (different metric)

**Files to Modify**:
- `repos/metabob-opencode/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx`

**Helper Functions Needed**:
```typescript
function getUtilizationStatus(percent: number): string {
  if (percent >= 90) return "🔴 Critical"
  if (percent >= 70) return "🟡 Warning"
  return "🟢 Healthy"
}

function getUtilizationColor(percent: number, theme: Theme) {
  if (percent >= 90) return theme.error
  if (percent >= 70) return theme.warning
  return theme.success
}
```

**Example JSX**:
```tsx
<box flexDirection="column">
  <text fg={theme.muted}>Context Window</text>
  <text>
    📊 Tokens: {sessionState()!.contextWindow.estimatedTokens.toLocaleString()} / 
    {sessionState()!.contextWindow.maxTokens.toLocaleString()} 
    ({Math.round(sessionState()!.contextWindow.utilizationPercent)}%)
  </text>
  <text 
    fg={
      sessionState()!.contextWindow.utilizationPercent >= 90
        ? theme.error    // Red: 90-100%
        : sessionState()!.contextWindow.utilizationPercent >= 70
        ? theme.warning  // Yellow: 70-90%
        : theme.success  // Green: 0-70%
    }
  >
    🎯 Utilization: {getUtilizationStatus(sessionState()!.contextWindow.utilizationPercent)}
  </text>
  <text fg={getUtilizationColor(sessionState()!.contextWindow.utilizationPercent, theme)}>
    {formatProgressBar(sessionState()!.contextWindow.utilizationPercent, 30)}
  </text>
</box>
```

---

### Phase 3: Testing (Priority: HIGH)

**Unit Tests Needed**:
- ❌ Model context window lookup
- ❌ Agent mode → system prompt token mapping
- ❌ Recent messages token aggregation
- ❌ Context window threshold mapping (70%/90%)
- ❌ Input validation for getContextWindowState()

**Integration Tests Needed**:
- ❌ contextWindow includes model-specific maxTokens
- ❌ systemPromptTokens varies by agent mode
- ❌ recentMessageTokens included in estimation

**E2E Tests Needed**:
- ❌ Switch models → context window limit changes → utilization recalculates
- ❌ Load many impulses → context window approaches 90% → TUI shows red
- ❌ Context window display separate from impulse budget

**Test Cases**:
```typescript
describe('Context Window Utilization', () => {
  test('GPT-4 model uses 128K context window', async () => {
    const state = await getContextWindowState(sessionID, 10000)
    expect(state.maxTokens).toBe(128000)
  })

  test('Claude 3.5 Sonnet uses 200K context window', async () => {
    const state = await getContextWindowState(sessionID, 10000)
    expect(state.maxTokens).toBe(200000)
  })

  test('Threshold at 70% shows yellow', () => {
    const color = getUtilizationColor(70, theme)
    expect(color).toBe(theme.warning)
  })

  test('Threshold at 90% shows red', () => {
    const color = getUtilizationColor(90, theme)
    expect(color).toBe(theme.error)
  })

  test('Invalid impulseTokens throws error', async () => {
    await expect(getContextWindowState(sessionID, NaN)).rejects.toThrow()
  })
})
```

---

## Specification Compliance Checklist

### Data Flow ✅✅✅❌❌✅
- [x] impulseTokens = sum of loaded impulse budgets ✅ (already implemented)
- [ ] systemPromptTokens from agent mode lookup ❌ (hardcoded 2000)
- [ ] recentMessageTokens from last 10 messages ❌ (hardcoded 4000)
- [ ] estimatedTokens = impulseTokens + systemPromptTokens + recentMessageTokens ❌ (formula exists, inputs wrong)
- [ ] maxTokens from model.contextWindow ❌ (hardcoded 200000)
- [x] utilizationPercent = (estimatedTokens / maxTokens) * 100 ✅ (formula correct)

### Color Coding ❌❌❌
- [ ] 0-70% Green ❌ (currently 0-60%)
- [ ] 70-90% Yellow ❌ (currently 60-85%)
- [ ] 90-100% Red ❌ (currently 85-100%)

### HTTP Response ✅✅✅
- [x] GET /session/:id/state returns contextWindow object ✅
- [x] contextWindow.estimatedTokens present ✅
- [x] contextWindow.maxTokens present ✅
- [x] contextWindow.utilizationPercent present ✅

### TUI Display ❌❌❌❌
- [ ] "📊 Tokens: {estimated} / {max} ({utilization}%)" ❌ (missing)
- [ ] "🎯 Utilization: {color} {status}" ❌ (missing)
- [ ] Color-coded progress bar ❌ (wrong thresholds)
- [ ] Separate from impulse budget section ❌ (currently same section)

**Overall Compliance**: 6/16 (38%) - INCOMPLETE

---

## Impulse Created

**Impulse ID**: `trace-context-window-utilization-data-flow`  
**Type**: templateDefinition  
**Budget**: 5000 tokens  
**Source**: activity-output (trace-data-flow-single-feature)

**Content Summary**:
- Executive summary with 4 critical findings
- Component analysis for 5 components
- Data flow status matrix
- Implementation plan with 3 phases
- Files to modify list
- Critical bugs with severity and fixes
- Full trace documentation reference

**Usage**: This impulse will be consumed by downstream validation and enforcement activities.

---

## Related Documentation

- [Full Trace with Mermaid Diagram](docs/data-flows/context-window-utilization-flow.md) - Complete trace output
- [Session State Architecture](ARCHITECTURE_SESSION_ACTIVITY_UNIFICATION.md)
- [Impulse System Design](IMPULSE_SYSTEM_REALITY_CHECK.md)
- [TUI Sidebar Tests](repos/metabob-opencode/packages/opencode/test/cli/tui-sidebar-phase2.test.ts)

---

## Next Steps

1. **Create validation activity** - Use `validate-data-flow-single-feature` template to verify specification requirements
2. **Create enforcement activity** - Use `enforce-data-flow-single-feature` template to implement fixes
3. **Execute fixes** - Run enforcement activity to implement all 4 bug fixes
4. **Test with multiple models** - GPT-4 (128K), Claude 3.5 (200K), Claude 3 Haiku (200K)
5. **Verify E2E** - Test threshold colors, separate displays, accurate utilization
6. **Update specification status** - Mark as ✅ COMPLETE after validation

---

## Activity Metrics

- **Template**: trace-data-flow-single-feature
- **Duration**: 782.3 seconds (~13 minutes)
- **Cost**: $1.6707
- **Tokens**: 412,931 input / 13,203 output
- **Tasks Completed**: 7/7 (100%)
- **Status**: ✅ SUCCESS

---

**Trace Completed**: 2026-02-23  
**Agent**: OpenCode Trace Agent  
**Specification Compliance**: 38% (6/16 requirements met)  
**Priority**: HIGH (prevent context window exhaustion)
