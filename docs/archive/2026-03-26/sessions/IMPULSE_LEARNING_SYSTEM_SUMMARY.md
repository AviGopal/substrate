# Impulse Learning System - Summary

**Date**: 2026-02-25  
**Status**: Requirements Defined, Activities Created  
**Goal**: Skip memory agent LLM calls through pattern learning

---

## Quick Overview

### The Problem

The session memory agent runs an LLM call on **every turn** to analyze user intent and determine what impulses to create. This adds ~1.5-2.5s overhead per turn and costs ~$0.001 per turn.

### The Solution

**Learn by observing what works**, then replay successful patterns without LLM calls.

```
Learning Phase (turns 1-20):
  User: "Fix bug in auth.ts" 
  → Memory agent LLM analyzes
  → Creates impulses: [errorFile, authTests]
  → Task succeeds
  → CAPTURE: "fix bug in X" → [errorFile, tests]

Skip Phase (turns 21+):
  User: "Fix bug in payment.ts"
  → Pattern match: "fix bug in X" (90% confidence)
  → SKIP memory agent LLM call
  → Replay pattern: create [errorFile, paymentTests]
  → Task succeeds ✓
```

### Target Metrics

- **Skip rate**: 60-80% of turns skip memory agent LLM call
- **Quality maintained**: Success rate unchanged (skip >= baseline)
- **Time savings**: 85-90% reduction in memory agent overhead
- **Pattern coverage**: >80% of common intents covered by patterns

---

## System Requirements

### 1. Data Capture Requirements

**What to capture per turn**:
```typescript
interface ImpulseMappingRecord {
  userIntent: {
    rawText: string                // "Fix bug in auth.ts"
    normalizedPattern: string      // "fix_bug_in_{file}"
    intentType: string             // "code_fix"
    confidence: number             // 0.95
  }
  
  impulses: Array<{
    id: string                     // "errorFile"
    type: string                   // "file"
    pointer: ImpulsePointer        // { type: "file", path: "src/auth.ts" }
    priority: "high" | "medium" | "low"
    created: boolean               // Was it created?
    loaded: boolean                // Was it loaded?
    used: boolean                  // Was it referenced in response?
  }>
  
  outcome: {
    taskSucceeded: boolean         // Did the task complete?
    responseQuality: number        // 0-1
    impulsesUsedCount: number      // How many were actually used?
  }
}
```

**Where to capture**:
- After `analyzeIntent()` in memory-agent.ts (capture userIntent)
- After `prepare()` in memory-agent.ts (capture impulses)
- After task completion (capture outcome)

### 2. Pattern Learning Requirements

**Pattern extraction**:
```typescript
extractPattern("Fix bug in auth.ts")
→ {
  template: "fix bug in {file}",
  variables: ["file"],
  normalized: "fix_bug_in_X"
}
```

**Pattern matching**:
```typescript
matchPattern("Fix bug in payment.ts", learnedPatterns)
→ {
  pattern: { template: "fix bug in {file}", ... },
  confidence: 0.90,
  variableBindings: { file: "payment.ts" }
}
```

**Impulse replay**:
```typescript
replayImpulsesFromPattern(match, sessionID)
→ {
  errorFile: { type: "file", path: "src/payment.ts", priority: "high" },
  tests: { type: "file", path: "test/payment.test.ts", priority: "medium" }
}
```

### 3. Skip Conditions

**When to skip memory agent LLM call**:

1. **Trivial messages**: "hi", "thanks", "ok", short messages
2. **Continuations**: "continue", "go on", "next"
3. **Pattern match**: Confidence >85%, success rate >75%
4. **Activity templates**: Has `contextRequirements` defined

**Fallback strategies**:
- Pattern replay → use learned pattern
- Template requirements → use activity's contextRequirements
- Keep existing → reuse impulses from previous turn

### 4. Learning Loop Architecture

```
┌─────────────────────────────────────────────────────────┐
│ TURN LIFECYCLE (Pre-Prompt)                            │
│                                                         │
│ 1. shouldSkipMemoryAgentLLM(userMessage)               │
│                                                         │
│ 2a. IF SKIP:                                           │
│     - Use pattern replay / template requirements       │
│     - Create impulses WITHOUT LLM call                 │
│     - Track skip (increment metrics)                   │
│                                                         │
│ 2b. IF NO SKIP:                                        │
│     - Run memory agent LLM (current behavior)          │
│     - CAPTURE mapping for learning                     │
│     - Track LLM call (increment metrics)               │
│                                                         │
│ 3. After task completion:                              │
│     - Update pattern metrics (success/failure)         │
│     - Refine pattern success rates                     │
│     - Prune unreliable patterns                        │
└─────────────────────────────────────────────────────────┘
```

---

## Deliverables

### 1. Requirements Specification ✅

**File**: `IMPULSE_LEARNING_REQUIREMENTS_SPECIFICATION.md`

Comprehensive specification covering:
- Part 1: Data Capture Requirements (what, where, how)
- Part 2: Pattern Learning Requirements (extraction, matching, replay)
- Part 3: Skip Conditions & Decision Logic (when to skip, fallbacks)
- Part 4: Learning Loop Integration (architecture, storage)
- Part 5: Activity Template Integration (learn from contextRequirements)
- Part 6: Validation & Metrics (success criteria, monitoring)
- Part 7: Implementation Phases (4-week plan)
- Part 8: Validation Checklist (pre/post deployment)
- Part 9: Activity Templates (for tracing and enforcement)

### 2. Activity Templates ✅

#### Activity 1: Trace Impulse Learning Requirements

**File**: `templates/trace-impulse-learning-requirements.json`

**Purpose**: Systematically trace all learning requirements

**Tasks** (6):
1. Trace data capture points (memory-agent.ts, activity.ts)
2. Document pattern learning algorithm
3. Document skip decision logic
4. Document learning loop architecture
5. Document validation metrics
6. Create 4-week implementation plan

**Output**: Complete tracing documentation with implementation roadmap

---

#### Activity 2: Enforce Impulse Learning Loop

**File**: `templates/enforce-impulse-learning-loop.json`

**Purpose**: Implement and enforce the learning system in code

**Tasks** (7):
1. Implement data capture hooks
2. Implement pattern learning engine (extraction, matching, replay)
3. Implement skip decision logic
4. Implement learning feedback loop
5. Implement activity template learning
6. Implement monitoring dashboard
7. Create integration tests

**Output**: Working learning system with tests and monitoring

---

#### Activity 3: Validate Learning Effectiveness

**File**: `templates/validate-learning-effectiveness.json`

**Purpose**: Validate learning is working through metrics

**Tasks** (5):
1. Run baseline tests (WITHOUT learning)
2. Run learning tests (WITH learning, same inputs)
3. Analyze pattern utilization
4. Compare baseline vs learning
5. Generate effectiveness report

**Output**: Effectiveness report with pass/fail verdict and recommendations

---

## How Learning Works (By Skipping Turns)

### Phase 1: Observation (Turns 1-20)

```
Turn 1: "Fix bug in auth.ts"
  → Memory agent LLM call
  → Creates impulses: [errorFile, authTests]
  → Task succeeds
  → CAPTURE: { pattern: "fix_bug_in_X", impulses: [...], success: true }

Turn 5: "Fix bug in payment.ts"
  → Memory agent LLM call
  → Creates impulses: [errorFile, paymentTests]
  → Task succeeds
  → UPDATE pattern: observation_count++, success_count++

Turn 10: "Add feature to dashboard"
  → Memory agent LLM call
  → Creates impulses: [featureFile, relatedFiles]
  → Task succeeds
  → CAPTURE new pattern: "add_feature_to_X"
```

**After 20 turns**: Pattern library has 5-10 patterns with metrics

### Phase 2: Pattern Matching (Turns 21-50)

```
Turn 21: "Fix bug in utils.ts"
  → Pattern match: "fix_bug_in_X" (confidence: 0.92)
  → Pattern success rate: 10/10 = 100%
  → SKIP memory agent LLM call
  → Replay pattern: create [errorFile, utilsTests]
  → Task succeeds
  → UPDATE pattern: success_count++, last_used=now

Turn 25: "Fix bug in api.ts"
  → Pattern match: "fix_bug_in_X" (confidence: 0.95)
  → SKIP (pattern has 12/12 success rate)
  → Task succeeds
  → UPDATE pattern: success_count++
```

**After 50 turns**: Skip rate reaching 40-50%

### Phase 3: Activity Learning (Turns 51+)

```
Turn 51: Execute activity with contextRequirements
  → Activity template: "fix-bug-complete"
  → gatherContext() called (uses LLM)
  → Resolves to impulses: [bugFile, tests, recentChanges]
  → Activity succeeds
  → CAPTURE: { activityId, variables, resolvedImpulses }

Turn 60: Execute same activity with different variables
  → Check learned mapping for "fix-bug-complete"
  → Learned mapping found (confidence: 0.90)
  → SKIP gatherContext() LLM call
  → Replay impulses from mapping
  → Activity succeeds
  → UPDATE mapping: success_count++
```

**After 100 turns**: Skip rate reaching 60-80% (target achieved)

---

## Success Criteria

### Must Achieve

- ✅ **Skip rate: 60-80%** - Most turns skip memory agent LLM call
- ✅ **Quality maintained**: Skip success rate >= LLM success rate
- ✅ **Time savings: 85-90%** - Dramatic reduction in memory agent overhead
- ✅ **Pattern coverage: >80%** - Most common intents covered by patterns

### Nice to Have

- Pattern utilization >80% (patterns used / patterns learned)
- Avg response time <500ms when skipping (vs ~1.5-2.5s with LLM)
- Pattern library stays manageable (<100 patterns)
- Automatic pruning of unreliable patterns

---

## Implementation Timeline

### Phase 1: Data Capture (Week 1)

**Tasks**:
- Add capture hooks in memory-agent.ts
- Create ImpulseMappingRecord storage
- Implement impulse usage tracking
- Persist to learning database

**Deliverable**: Data flowing to learning database

### Phase 2: Pattern Learning (Week 2)

**Tasks**:
- Implement pattern extraction
- Implement pattern matching
- Implement impulse replay
- Build pattern library

**Deliverable**: Pattern matching achieving >80% accuracy

### Phase 3: Skip Integration (Week 3)

**Tasks**:
- Add skip decision logic to turn lifecycle
- Implement fallback strategies
- Track skip metrics
- Validate quality maintained

**Deliverable**: Skip rate reaching 20-30% (trivial + patterns)

### Phase 4: Activity Template Learning (Week 4)

**Tasks**:
- Capture activity-impulse mappings
- Skip gatherContext when learned
- Monitor activity skip rates
- Generate effectiveness report

**Deliverable**: Skip rate reaching 60-80%, quality maintained

---

## Next Steps

### Immediate (This Week)

1. **Review specification**: Ensure requirements are complete and accurate
2. **Execute trace activity**: Run `trace-impulse-learning-requirements` to document all implementation points
3. **Plan sprint**: Break down Phase 1 into daily tasks

### Short Term (Next 2 Weeks)

1. **Implement Phase 1**: Data capture hooks and storage
2. **Implement Phase 2**: Pattern learning engine
3. **Test pattern accuracy**: Validate >80% matching accuracy

### Medium Term (Next 4 Weeks)

1. **Implement Phase 3**: Skip integration with turn lifecycle
2. **Implement Phase 4**: Activity template learning
3. **Execute validation activity**: Run `validate-learning-effectiveness`
4. **Deploy to production**: If effectiveness report passes

---

## Key Insights

### Why This Works

1. **Observation-based**: Learn from actual successful executions, not synthetic data
2. **Conservative**: High confidence thresholds (>85%) ensure quality maintained
3. **Adaptive**: Pattern success rates continuously updated with new observations
4. **Composable**: Works with existing activity template system

### Why Skipping Turns Matters

- **Every turn avoided** = ~1.5-2.5s saved + ~$0.001 cost saved
- **100 turns at 70% skip rate** = ~105-175s saved (~1.75-2.9 minutes)
- **1000 turns at 70% skip rate** = ~1050-1750s saved (~17.5-29 minutes)
- **Quality maintained** because we only skip when confident (>85% match, >75% success)

### Learning By Doing

The system doesn't try to predict what impulses are needed. Instead, it:
1. **Observes** what impulses actually worked
2. **Captures** the pattern that led to success
3. **Replays** the pattern when similar input appears
4. **Validates** the replay still works
5. **Updates** success metrics to refine confidence

This is more robust than trying to predict, because predictions can be wrong. Observations are facts.

---

## Conclusion

The impulse learning system will **dramatically reduce memory agent overhead** (85-90%) while **maintaining response quality**. It achieves this by:

1. **Learning from observation** - capture what works
2. **Pattern matching** - recognize similar requests
3. **Confident skipping** - only skip when sure it will work
4. **Continuous validation** - update success rates, prune bad patterns
5. **Activity integration** - learn from contextRequirements

**Target**: 60-80% skip rate within 4 weeks of implementation.

**Risk**: Low - conservative thresholds ensure quality maintained. Can rollback if issues arise.

**Effort**: 4 weeks (1 phase per week) with comprehensive testing and validation.

---

## Files Created

1. **IMPULSE_LEARNING_REQUIREMENTS_SPECIFICATION.md** - Full requirements (69 pages)
2. **templates/trace-impulse-learning-requirements.json** - Tracing activity (6 tasks)
3. **templates/enforce-impulse-learning-loop.json** - Implementation activity (7 tasks)
4. **templates/validate-learning-effectiveness.json** - Validation activity (5 tasks)
5. **IMPULSE_LEARNING_SYSTEM_SUMMARY.md** - This summary

All committed to: `prompts/metabob-devbob-mlpu1y8l` branch
