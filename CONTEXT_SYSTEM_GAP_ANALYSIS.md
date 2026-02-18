# Context System Gap Analysis & Improvement Plan

**Date**: 2026-02-18  
**Status**: 413 tests failing out of 2557 total (83.8% pass rate)  
**Critical Finding**: Session memory system partially implemented but not fully integrated

---

## Executive Summary

The OpenCode context management system has a **solid foundation** but suffers from **integration gaps** between components. Key findings:

✅ **What Works**: Impulse creation, storage, formatting infrastructure  
⚠️ **What's Partial**: Integration into execution flow  
❌ **What Fails**: Test expectations vs. actual runtime behavior  

---

## Detailed Gap Analysis

### Gap 1: Session Memory Not Integrated into SystemPrompt.environment()

**Status**: ❌ **CRITICAL** - Tests fail, feature incomplete

**Evidence**:
- Test: `session-memory-injection.test.ts` expects `<session_memory>` tags in `SystemPrompt.environment()`
- Reality: Function returns ONLY `<env>` and `<project>` sections
- Test failure: 
  ```
  Expected to contain: "<session_memory>"
  Received: "<env>...</env>\n<project>...</project>"
  ```

**Root Cause**:
```typescript
// SystemPrompt.environment() - src/session/system.ts
export async function environment(sessionID?: string, agentConfig?) {
  // Builds env and project sections
  // Does NOT call ImpulseFormatter.formatImpulseContext()
  // Missing integration point
}
```

**Actual Integration Point**:
```typescript
// SessionPrompt.prompt() - src/session/prompt.ts (line 1573)
const impulseContext = await ImpulseFormatter.formatImpulseContext({
  sessionID: input.sessionID,
  maxTokens: 10000,
})

// Later added as system message (line 1745)
messages: buildModelMessages({
  system,
  messages: msgs,
  impulseContext,  // ← Added here, NOT in SystemPrompt.environment()
})
```

**Impact**: HIGH - Tests expect one behavior, implementation does another

**Why This Matters**:
- Tests are checking the wrong function (`SystemPrompt.environment()`)
- Actual integration is in `SessionPrompt.prompt()` via `buildModelMessages()`
- This is actually **BETTER** design (separate system vs. ephemeral context)
- But tests don't reflect reality

**Fix Required**: Update tests to match actual architecture, OR integrate into `SystemPrompt.environment()` if that's the desired design

---

### Gap 2: Test vs. Implementation Architecture Mismatch

**Status**: ⚠️ **DESIGN CONFLICT**

**The Tension**:

**Test Expectation**:
```typescript
// Test expects impulses in SystemPrompt.environment()
const systemSections = await SystemPrompt.environment(session.id)
expect(systemSections.join("\n")).toContain("<session_memory>")
```

**Actual Implementation**:
```typescript
// Impulses added separately in SessionPrompt.prompt()
const impulseContext = await ImpulseFormatter.formatImpulseContext(...)
buildModelMessages({ system, messages, impulseContext })
```

**Two Architectural Approaches**:

| Approach | Pros | Cons | Current Status |
|----------|------|------|----------------|
| **A: Impulses in SystemPrompt.environment()** | Unified context, single source | Mixed static/dynamic content, always loaded | **Tests expect this** |
| **B: Impulses as separate system message** | Clean separation, ephemeral, optional | Two context sources | **Implementation does this** |

**Decision Needed**: Which architecture do we want?
- If A: Fix implementation to match tests
- If B: Fix tests to match implementation (recommended)

---

### Gap 3: Memory Agent Invocation Not Verified

**Status**: ❓ **UNCLEAR** - Code exists, no end-to-end proof

**What Exists**:
```typescript
// Code: src/session/memory-agent.ts
export async function analyzeIntent(input: {
  sessionID: string
  promptText: string
  recentMessages?: MessageV2.WithParts[]
}): Promise<Intent> {
  // Analyzes user intent
  // Returns suggestedImpulses
}

export async function gatherContext(input: {
  requirements: ActivityTemplate.ContextRequirement[]
  reason: string
  recentMessages: MessageV2.WithParts[]
}): Promise<Record<string, ActivityTemplate.Impulse.Schema>> {
  // Gathers context for activity execution
}
```

**What's Missing**:
- No evidence of automatic invocation on user messages
- No passing end-to-end tests showing memory agent → impulse creation → context injection flow
- No traces showing memory agent execution in real sessions

**Fix Required**: Create end-to-end test that:
1. User sends message
2. Memory agent analyzes intent
3. Impulses are created automatically
4. Context is injected into prompt
5. Agent receives context in system messages

---

### Gap 4: Activity Context Requirements Not End-to-End Tested

**Status**: ❓ **UNCLEAR** - Design complete, execution unclear

**What Exists**:
```typescript
// Template with contextRequirements
template.contextRequirements = [
  {
    key: "featureSpec",
    hint: "Provide detailed feature specification",
    impulseTypes: ["memo"],
    required: true,
    budgetRange: [500, 1500],
  }
]

// Activity tool uses reason parameter
activity({
  templateId: "add-feature-complete",
  variables: { featureName: "..." },
  reason: "User requested JWT authentication"  // ← Key connector
})
```

**What's Tested**:
- Dry-run mode (skips memory agent invocation)
- Template structure validation
- Impulse creation and storage

**What's NOT Tested**:
- Real memory agent invocation with contextRequirements
- `reason` parameter → `gatherContext()` → impulse creation flow
- Context injection into activity task prompts

**Fix Required**: Non-dry-run end-to-end test with mock LLM

---

### Gap 5: Documentation Doesn't Match Reality

**Status**: ⚠️ **MISLEADING**

**Example**: My original explanation claimed `SystemPrompt.environment()` includes session memory
**Reality**: It doesn't - impulses are injected separately in `SessionPrompt.prompt()`

**Fix Required**: Update all documentation to reflect actual architecture

---

## Gap Prioritization

### Priority 1: CRITICAL (Fix Immediately)

1. **Fix test architecture mismatch** (Gap 2)
   - **Decision**: Choose architecture A or B
   - **Action**: Update either tests OR implementation to match
   - **Effort**: 2-4 hours
   - **Impact**: Fixes 4 failing tests, clarifies design

2. **Document actual architecture** (Gap 5)
   - **Action**: Update ARCHITECTURE_QUICK_REFERENCE.md
   - **Effort**: 1-2 hours
   - **Impact**: Prevents future confusion

### Priority 2: HIGH (Fix Soon)

3. **Add end-to-end memory agent test** (Gap 3)
   - **Action**: Create test with mock LLM showing automatic invocation
   - **Effort**: 4-6 hours
   - **Impact**: Verifies memory agent actually works

4. **Add end-to-end activity context test** (Gap 4)
   - **Action**: Create test showing reason → gatherContext → impulse flow
   - **Effort**: 4-6 hours
   - **Impact**: Verifies activity context system works

### Priority 3: MEDIUM (Nice to Have)

5. **Fix other failing tests** (413 total)
   - **Action**: Triage and fix remaining failures
   - **Effort**: 20-40 hours
   - **Impact**: Improves confidence in codebase

---

## Recommended Architecture Decision

**Recommendation**: Keep current implementation (Architecture B)

**Rationale**:
1. **Clean separation**: Static system prompt vs. dynamic impulse context
2. **Performance**: Impulses only loaded when needed
3. **Flexibility**: Can inject impulses at different points (user message, system message, etc.)
4. **Already implemented**: Just need to fix tests

**Action Plan**:
1. Update `session-memory-injection.test.ts` to test `SessionPrompt.prompt()` instead of `SystemPrompt.environment()`
2. Document the two-tier context system (system prompt + impulse context)
3. Add end-to-end tests showing full flow

---

## Improved Self-Verification Process

**Lesson Learned**: Code analysis alone is insufficient

**New Process**:
1. ✅ Read code (understand design intent)
2. ✅ Read tests (understand expected behavior)
3. ✅ **RUN tests** (verify actual behavior) ← **Critical step I skipped**
4. ✅ Check execution traces (confirm real usage)
5. ✅ Compare all sources to identify gaps
6. ✅ Make architectural decision if mismatches found
7. ✅ Document decisions and update tests/code accordingly

---

## Next Steps

1. **Decide on architecture** (A or B above)
2. **Fix test/implementation mismatch**
3. **Add end-to-end verification tests**
4. **Update documentation**
5. **Triage remaining 413 failing tests**

**Estimated Total Effort**: 16-28 hours for P1+P2, 36-68 hours for all priorities

---

## Appendix: Key Files

### Context System Implementation
- `src/session/activity-template.ts` - Impulse schema, ContextRequirement schema
- `src/session/session-memory.ts` - Impulse storage, SessionMemory API
- `src/session/impulse-formatter.ts` - Formats impulses as markdown
- `src/session/impulse-resolver.ts` - Loads impulse content from pointers
- `src/session/prompt.ts` - **Actual integration point** (line 1573, 1745)
- `src/session/system.ts` - System prompt building (does NOT include impulses)
- `src/session/memory-agent.ts` - Intent analysis, context gathering

### Tests
- `test/integration/session-memory-injection.test.ts` - **FAILING** (expects wrong integration point)
- `test/integration/impulse-flow-end-to-end.test.ts` - Dry-run only (no real invocation)
- `test/session/impulse-context-injection.test.ts` - Unit tests (pass)
- `test/session/impulse-micro-agent-context.test.ts` - Formatting tests (pass)

### Execution Traces
- `.context-flow-trace/impulse-created-*.json` - Real impulse creation events
- Shows impulses ARE being created in production

---

**Status**: Ready for architectural decision and implementation
