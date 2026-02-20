# Bridging Instructional State → Functional State

## The Fundamental Problem

**Instructional State**: Tokens in LLM context window
**Functional State**: Real world (codebase, filesystem, services)

**Challenge**: Make instructional state reliably produce correct functional state transitions.

## The Gap

```
Intent (tokens) → LLM Decision (tokens) → ??? → Tool Calls → Codebase Changes
                                          ↑
                                       THE GAP
```

## Why Recommendations Must Always Be Enabled

### The Core Insight

**Activity templates are learned functional state transitions.**

Each template encodes:
- Proven sequence of operations
- Success rate (measurement)
- When to use it (context)

Disabling recommendations = **removing learned transitions from instructional state** = forcing LLM to guess.

### The Bug

```typescript
// This was WRONG:
if (promptLower.includes("activity")) {
  return false  // Disable recommendations
}
```

**Result**: "Create an activity template" got NO recommendations, so agent invented approach (0% success).

### The Fix

```typescript
// ALWAYS provide recommendations (except read-only agents)
return ctx.agent.name !== "plan" && ctx.agent.name !== "review"
```

**Why**: Every functional state transition needs instructional state enriched with proven approaches.

## Activity Composition

Activities can compose other activities:

```
build-auth-system
  ├─ add-feature (user model)      85% success
  ├─ add-feature (auth endpoints)  85% success  
  ├─ add-tests (test suite)        90% success
  └─ commit-changes (atomic)       95% success

Composed success: ~85% × 85% × 90% × 95% ≈ 62%
```

**Activity agents need recommendations to know what sub-activities exist!**

## The Learning Loop

1. **Enrich instructional state**: Inject activity recommendations
2. **LLM chooses**: Activity template vs direct execution
3. **Execute**: Functional state transitions
4. **Measure**: Success/failure, cost, duration
5. **Update**: Thompson Sampling, annotations
6. **Repeat**: Better recommendations next time

## Measurement = Learning

Can't improve what you don't measure:
- Success rate per activity
- Success rate per variant  
- Success rate per task
- Failure modes (categorized)
- Cost and duration

Measurements feed back into instructional state via Thompson Sampling.

## Implementation

**File**: `repos/metabob-opencode/packages/opencode/src/session/turn-lifecycle-hooks.ts`

**Remove lines 151-156**:
```typescript
// DELETE THIS:
const promptLower = ctx.promptText.toLowerCase()
if (promptLower.includes("activity") || promptLower.includes("template")) {
  return false
}
```

**Also remove lines 136-139**:
```typescript
// DELETE THIS:
if (currentActivity) {
  return false
}
```

**Why**: Activities compose activities. Subagents need recommendations too.

**Keep only**:
```typescript
enabled: async (ctx) => {
  // Disable for read-only agents
  if (ctx.agent.name === "plan" || ctx.agent.name === "review") {
    return false
  }
  
  // Need meaningful prompt
  if (ctx.promptText.length < 10) {
    return false
  }
  
  // Otherwise: ALWAYS ENABLE
  return true
}
```

---

**Core Principle**: Never disable the bridge between instructional and functional state.

**Next**: Fix the hook, test "create an activity template", measure success rate.
