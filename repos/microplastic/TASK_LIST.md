# Microplastic Development Task List

## Overview

This task list implements microplastic using **MiniBob for self-development** with the learning backend. Each commit milestone represents a working, testable state.

**API Configuration:**
- Key: `mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB`
- Backend: `http://activity.metabob.local`
- Instance: `microplastic-dev`

---

## Milestone 1: Foundation ✅ COMPLETE

**Status:** Done (commits: bbde1f4, 9d94336)
**Testable:** ImpulseStore predicates work, TUI renders full-screen

- ✅ ImpulseStateSpace with subscription predicates
- ✅ Full-screen responsive TUI
- ✅ Stateful region management
- ✅ Test suite passing (16 tests)

---

## Milestone 2: Impulse-Driven Flow ✅ COMPLETE

**Goal:** All execution events flow through ImpulseStateSpace
**Status:** Done (commits: fc52f2f, 2ef9626, e7e03f5, [final commit])
**Testable:** All execution flows through impulses, regions update correctly

### Tasks

**2.1 Fix Execution Hanging Issue** ✅ COMPLETE
- [x] Investigate race condition in `runGoalWithRegions()`
- [x] Ensure `executor.execute()` properly awaits completion
- [x] Verify completion events reach ExecutionBridge
- [x] Remove 500ms timeout workaround (reduced to 100ms)
- [x] Test: `bun run src/index.ts "echo hello"` completes without hanging

**Root Cause:** RegionRenderer event listeners weren't being cleaned up, keeping the event loop active. minibob ActivityExecutor also leaves handles open.

**Solution:**
- Added event listener cleanup in RegionRenderer.stop()
- Added bridge.shutdown() to clean impulse subscriptions
- Added process.exit(0) to force clean exit
- Reduced wait from 500ms to 100ms

**Commit:** fc52f2f

**2.2 User Input as Impulse Emission** ✅ COMPLETE
- [x] Create user_goal impulse when goal submitted
- [x] Subscribe executor to user_goal impulses
- [x] Update `runInteractiveWithRegions()` to emit impulses
- [x] Test: Goal submission creates impulse, executor picks it up

**Flow:** User Enter → user_goal impulse → subscription handler → executor.execute()
**Tests:** 3 pass (impulse creation, filtering, ordering)
**Commit:** 2ef9626

**2.3 Wire Impulse-to-Region Helper** ✅ COMPLETE
- [x] Use `getOrCreateRegionForImpulse()` in impulse handlers
- [x] Ensure 1:1 mapping prevents duplicate regions
- [x] Test: Multiple updates to same impulse update same region

**Implementation:** Refactored helper to use factory functions, updated all handlers
**Benefits:** No duplicate regions, stateful updates, proper state progression
**Tests:** 3 pass (1:1 mapping, different impulses, updates)
**Commit:** e7e03f5

**2.4 End-to-End Integration Test** ✅ COMPLETE
- [x] Create test: goal → impulses → regions → rendering
- [x] Verify all impulse shapes create correct regions
- [x] Test activity/task/tool_call/summary/error flows
- [x] Run: `bun test src/integration/impulse-flow.test.ts`

**Coverage:** Complete execution flow with all impulse shapes
**Tests:** 7 pass, 33 assertions (activity, task, tool_call, summary, error, full flow, 1:1 mapping)
**Commit:** [next]

**Verified:**
```bash
bun run src/index.ts "echo test"
# ✓ Executes without hanging
# ✓ Shows regions (activity, tool_call, summary)
# ✓ Completes cleanly with process.exit(0)

bun test src/integration/impulse-flow.test.ts
# ✓ 7 tests pass, 33 assertions
# ✓ All impulse shapes handled correctly
# ✓ 1:1 impulse-region mapping verified
```

---

## Milestone 3: Self-Development Command 🎯 NEXT

**Goal:** Use MiniBob to develop microplastic
**Commit:** `feat(microplastic): implement /dev self-development command`

### Tasks

**3.1 Create /dev Command Entry**
- [ ] Create `src/commands/dev.ts`
- [ ] Implement `devCommand(goal, options)` function
- [ ] Add CLI argument parsing for `/dev` or `--dev`
- [ ] Test: `microplastic /dev "test goal"` is recognized

**3.2 MiniBob Integration**
- [ ] Create `src/commands/minibob-integration.ts`
- [ ] Implement `initializeMiniBobForDev(config)`
- [ ] Configure MiniBob with:
  - workdir: `repos/microplastic`
  - backend: `http://activity.metabob.local`
  - apiKey: `mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB`
  - instanceId: `microplastic-dev`
- [ ] Test: MiniBob instance initializes successfully

**3.3 Execute Development Goals**
- [ ] Wire MiniBob GoalProcessor to execute goals
- [ ] Capture development execution traces
- [ ] Tag traces with `scope: "development"`
- [ ] Report results to user (files modified, success/failure)
- [ ] Test: MiniBob executes simple development goal

**3.4 Development Trace Capture**
- [ ] Ensure traces sent to backend
- [ ] Enable ribosome extraction for dev activities
- [ ] Feed Thompson Sampling for development templates
- [ ] Test: Backend receives development traces

**Testable State:**
```bash
export MINIBOB_API_KEY=mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB
bun run src/index.ts /dev "Add a console.log to index.ts"
# Should: MiniBob modifies code, shows diff, stores trace
```

---

## Milestone 4: Template Seeding 📚

**Goal:** Bootstrap templates available for selection
**Commit:** `feat(microplastic): seed development templates with verification`

### Tasks

**4.1 Verify Primordial Seeding**
- [ ] Implement `seedPrimordials()` with error handling
- [ ] Check seeding status before/after
- [ ] Report success/failure counts
- [ ] Store seeding state (don't repeat on every run)
- [ ] Test: Primordial templates appear in backend

**4.2 Create Microplastic Development Templates**
- [ ] Create `src/primordials/microplastic-templates.ts`
- [ ] Define templates:
  - `microplastic-add-impulse-shape`
  - `microplastic-add-region-component`
  - `microplastic-add-keyboard-shortcut`
  - `microplastic-optimize-rendering`
  - `microplastic-fix-race-condition`
- [ ] Test: Templates compile and validate

**4.3 Seed Microplastic Templates**
- [ ] Add microplastic templates to seeding
- [ ] Tag with `tags: ["microplastic", ...]`
- [ ] Set initial Thompson priors (alpha=1, beta=1)
- [ ] Test: Backend has microplastic-specific templates

**4.4 Template Selection Test**
- [ ] Query backend for templates
- [ ] Verify Thompson Sampling recommendations
- [ ] Test goal-to-template matching
- [ ] Run: `curl http://activity.metabob.local/v2/activities/templates?tags=microplastic`

**Testable State:**
```bash
bun run src/index.ts /dev --seed
# Seeds all templates

bun run src/index.ts /dev "Add new impulse shape"
# Should select microplastic-add-impulse-shape template
```

---

## Milestone 5: Instrumentation ⚙️

**Goal:** Zero-cost observability via non-LLM activities
**Commit:** `feat(microplastic): add instrumentation activities for tracing`

### Tasks

**5.1 Define Instrumentation Activities**
- [ ] Create `src/activities/instrumentation.ts`
- [ ] Define activities:
  - `instrument-impulse-lifecycle`
  - `instrument-subscription-match`
  - `instrument-resolver-invocation`
  - `instrument-region-lifecycle`
- [ ] Set `executionFormat: "tool"` (no LLM)
- [ ] Test: Activities validate correctly

**5.2 Create Trace Capture Tool**
- [ ] Implement `traceCaptureHandler(event, data, timestamp)`
- [ ] Send traces to backend asynchronously
- [ ] Fire-and-forget (don't block execution)
- [ ] Test: Traces arrive in backend

**5.3 Wire to ImpulseStore**
- [ ] Check `MICROPLASTIC_INSTRUMENT` env var
- [ ] Subscribe to all impulse events
- [ ] Capture: create, update, load, delete events
- [ ] Track: impulseId, shape, timestamp, metadata
- [ ] Test: Instrumentation traces captured

**5.4 Add --instrument Flag**
- [ ] Parse `--instrument` CLI argument
- [ ] Set `MICROPLASTIC_INSTRUMENT=true` when flag present
- [ ] Show instrumentation status in output
- [ ] Test: `microplastic --instrument "goal"` captures traces

**Testable State:**
```bash
MICROPLASTIC_INSTRUMENT=true bun run src/index.ts "test goal"
# Execution completes, instrumentation traces in backend

curl http://activity.metabob.local/v2/activities/execution-traces?activity=instrument-impulse-lifecycle
# Returns instrumentation traces (no LLM cost)
```

---

## Milestone 6: Cross-Pollination 🔄

**Goal:** Runtime issues create development goals
**Commit:** `feat(microplastic): implement cross-pollination feedback loop`

### Tasks

**6.1 Runtime Trace Analyzer**
- [ ] Create `src/commands/analyze.ts`
- [ ] Implement `analyzeRuntimeTraces()` function
- [ ] Query recent failing traces (last 24h)
- [ ] Identify failure patterns
- [ ] Group by: error type, frequency, impact
- [ ] Test: Analyzer identifies patterns from sample traces

**6.2 Development Goal Generation**
- [ ] Convert patterns to development goals
- [ ] Prioritize by frequency (high if >5 occurrences)
- [ ] Include context: traceIds, errorType, suggestedFix
- [ ] Format goals for MiniBob execution
- [ ] Test: Goals generated from patterns

**6.3 Create /dev --analyze Command**
- [ ] Add `--analyze` flag to /dev command
- [ ] Run trace analyzer
- [ ] Display suggestions to user
- [ ] Optionally execute top suggestion
- [ ] Test: `microplastic /dev --analyze` shows suggestions

**6.4 Improvement Suggestion Impulses**
- [ ] Create `improvement_suggestion` shape
- [ ] Emit impulses for each suggestion
- [ ] Include: goal, priority, context, evidence
- [ ] Subscribe boredom mode to these impulses
- [ ] Test: Suggestions appear as impulses

**6.5 Auto-Execute High-Priority Improvements**
- [ ] Subscribe to improvement_suggestion with minPriority=750
- [ ] Execute via `/dev` command
- [ ] Report outcome to user (if interactive)
- [ ] Update trace with improvement result
- [ ] Test: High-priority suggestion triggers dev execution

**Testable State:**
```bash
# Create some failing traces (manually or via tests)
# Then analyze:
bun run src/index.ts /dev --analyze
# Output:
# 🔍 Analyzing runtime traces...
# Found 2 patterns:
#   1. [HIGH] Region rendering timeout (6 occurrences)
#      Suggested: Optimize region layout calculation
#   2. [MEDIUM] Template selection slow (3 occurrences)
#      Suggested: Add index on activity_registry.tags

# Execute top suggestion
bun run src/index.ts /dev "Optimize region layout calculation"
# MiniBob implements fix, stores trace
```

---

## Milestone 7: Boredom Mode 🤖 FINAL

**Goal:** Autonomous improvement when idle
**Commit:** `feat(microplastic): implement boredom mode for autonomous improvement`

### Tasks

**7.1 Idle Detection**
- [ ] Create `src/boredom/detector.ts`
- [ ] Implement `BoredomDetector` class
- [ ] Track last activity time
- [ ] Configure threshold (default: 5 minutes)
- [ ] Test: Detector correctly identifies idle state

**7.2 Boredom Loop**
- [ ] Create `src/boredom/loop.ts`
- [ ] Implement `boredomLoop()` function
- [ ] Check for idle every 60 seconds
- [ ] When idle:
  - Run trace analyzer
  - Pick highest priority suggestion
  - Execute via `/dev` command
  - Mark activity time
- [ ] Test: Loop runs, executes improvements

**7.3 Enable Boredom Mode**
- [ ] Add `--boredom-mode` CLI flag
- [ ] Start boredom loop in background
- [ ] Show boredom activity in TUI (low priority region)
- [ ] Allow user to continue working (non-blocking)
- [ ] Test: Interactive session with boredom mode active

**7.4 Boredom Activity Display**
- [ ] Create `boredom_activity` shape
- [ ] Emit impulses when boredom executes
- [ ] Show in TUI: "[Boredom] Optimizing rendering..."
- [ ] Collapse after completion
- [ ] Test: Boredom activity visible but non-intrusive

**Testable State:**
```bash
bun run src/index.ts --boredom-mode
# Starts interactive session

# Wait 5+ minutes idle
# Output:
# [Boredom] Looking for improvements...
# [Boredom] Found issue: slow rendering
# [Boredom] Executing: Optimize region rendering
# [Boredom] ✓ Improvement applied: rendering now 30ms (was 250ms)

# User can continue working normally
❯ Fix the login bug
# Execution proceeds as normal, with autonomous improvements in background
```

---

## Testing Checklist

### Unit Tests
- [ ] ImpulseStore: predicates, query, subscribe
- [ ] RegionManager: add, update, complete, priority sorting
- [ ] ExecutionBridge: impulse routing, region mapping
- [ ] GoalExecutor: impulse emission, shape mapping
- [ ] BoredomDetector: idle detection logic
- [ ] TraceAnalyzer: pattern identification

### Integration Tests
- [ ] Goal → Execution → Trace → Backend flow
- [ ] Impulse → Region → Rendering pipeline
- [ ] Template selection → Thompson Sampling → Execution
- [ ] Ribosome extraction → Template registration
- [ ] Runtime traces → Development goals → Improvements

### End-to-End Tests
- [ ] `microplastic "create hello function"` executes cleanly
- [ ] `microplastic /dev "add feature"` modifies codebase
- [ ] `microplastic /dev --analyze` identifies issues
- [ ] `microplastic --boredom-mode` autonomously improves
- [ ] Templates learned via /dev reused in runtime

### Performance Tests
- [ ] Rendering latency < 50ms per frame
- [ ] Impulse subscription overhead < 5ms per event
- [ ] Template selection < 100ms (backend query)
- [ ] Instrumentation overhead < 2% total execution time

---

## Environment Setup

### Required for Development

```bash
# LLM Access
export ANTHROPIC_API_KEY="sk-ant-..."

# Backend Connection
export ACTIVITY_API_URL="http://activity.metabob.local"

# Self-Development
export MINIBOB_API_KEY="mb_live_9VKN3eT_JoGxFEIsErU1KSlltoOUiMJB"
export MINIBOB_INSTANCE_ID="microplastic-dev"
```

### Optional Features

```bash
# Instrumentation
export MICROPLASTIC_INSTRUMENT="true"

# Boredom Mode
export MICROPLASTIC_BOREDOM_MODE="true"
export MICROPLASTIC_BOREDOM_THRESHOLD_MS="300000"  # 5 minutes

# Development
export MICROPLASTIC_VERBOSE="true"
```

---

## Dependency Order

```
Milestone 2 (Fix execution flow)
    │
    ↓
Milestone 3 (/dev command) ← CRITICAL PATH
    │
    ├────────────────┐
    ↓                ↓
Milestone 4     Milestone 5
(Templates)     (Instrumentation)
    │                │
    └────────┬───────┘
             ↓
       Milestone 6
    (Cross-pollination)
             ↓
       Milestone 7
     (Boredom mode)
```

**Parallel Work:**
- Milestones 4 and 5 can be developed in parallel
- Unit tests can be written alongside feature development
- Documentation can be updated incrementally

---

## Success Metrics

| Milestone | Metric | Target |
|-----------|--------|--------|
| 2 | Execution completes without hanging | 100% success rate |
| 3 | /dev command modifies codebase | Working demo |
| 4 | Templates seeded and selectable | >10 templates in backend |
| 5 | Instrumentation traces captured | Zero LLM cost |
| 6 | Runtime issues create dev goals | 1+ suggestion per analyze |
| 7 | Boredom mode executes improvements | 1+ improvement per idle period |

---

## Current Status

**Completed Milestones:** 1 (Foundation)
**In Progress:** 2 (Impulse-driven flow)
**Blocked:** 3-7 (waiting on Milestone 2)

**Next Actions:**
1. Fix execution hanging (unblocks Milestone 2)
2. Implement /dev command (enables Milestones 3-7)
3. Test self-development loop (validates approach)

---

## Related Documentation

- [Complete Specification](./docs/COMPLETE_SPEC.md) - Full architecture
- [TUI Improvements](./docs/TUI_IMPROVEMENTS.md) - Rendering details
- [Impulse Activity Foundation](../../docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md) - Core ontology
- [MiniBob Integration](./CLAUDE.md) - Development guidance
