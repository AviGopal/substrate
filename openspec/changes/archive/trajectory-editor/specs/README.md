# Trajectory Editor Specification Documents

> **Purpose**: Complete architectural specification for the trajectory editor based on IMPULSE_ACTIVITY_FOUNDATION.md
>
> **Created**: 2026-04-24
>
> **Status**: Analysis Complete - Ready for Implementation

---

## Overview

This directory contains the complete specification for aligning the trajectory editor with the foundational impulse-activity model. The analysis identified **significant conceptual misalignment** between the current implementation and the intended architecture.

### Key Documents

1. **[PROPER_END_TO_END_FLOW.md](./PROPER_END_TO_END_FLOW.md)** - Complete end-to-end flow specification
   - Part 1: Goal-to-Trajectory Flow
   - Part 2: Impulse Integration
   - Part 3: Execution Model
   - Part 4: Learning from Execution
   - Part 5: Integration Points Summary
   - Part 6: Gaps Between Current and Intended Design
   - Part 7: Phased Implementation Roadmap
   - Part 8: Success Criteria

2. **[KEY_QUESTIONS_ANSWERED.md](./KEY_QUESTIONS_ANSWERED.md)** - Direct answers to architectural questions
   - Q1: Goal-to-Trajectory Flow
   - Q2: Impulse Integration
   - Q3: Execution Model
   - Q4: Learning from Execution
   - Summary table and next actions

3. **[VISUAL_FLOW_DIAGRAMS.md](./VISUAL_FLOW_DIAGRAMS.md)** - Visual representations
   - Diagram 1: Current vs Proper Goal-to-Trajectory Flow
   - Diagram 2: Impulse Flow Through Trajectory
   - Diagram 3: Execution Model (Sequential + Parallel)
   - Diagram 4: Learning Loop (Trace → Thompson Sampling)
   - Diagram 5: User Workflow Comparison
   - Diagram 6: Frontend Component Architecture

---

## Executive Summary

### Current State (Misaligned)

**What it does:**
- Generates complete paths upfront via `/goal-paths/recommend`
- Treats trajectories as static templates
- No execution integration
- No learning feedback loop

**Problems:**
- Only works for previously-seen goal + path combinations
- Contradicts "process-of-becoming" (trajectory appears "finished" before execution)
- No dynamic composition
- No connection to Thompson Sampling learning

### Proper Flow (Foundation-Aligned)

**What it should do:**
- Goals become **impulses** with metadata
- Iterative **Thompson Sampling** recommendations after each activity addition
- **Automatic impulse flow** from activity outputs
- **Execution integration** via MiniBob
- **Learning feedback** through trace storage and variant creation

**Benefits:**
- Works for new goal + shape combinations (not just historical)
- Trajectory **emerges** through user + system collaboration
- Dynamic composition based on current state
- Continuous learning improves recommendations

---

## Core Architectural Shifts

### 1. Goal Processing

**Before:**
```typescript
// Complete path generated upfront
const path = await fetch('/goal-paths/recommend', {
  body: { goal_text: "Fix auth bug" }
});
// Returns: ['debug-bug', 'write-test', 'commit']
```

**After:**
```typescript
// Iterative recommendations
const goalImpulse = createGoalImpulse("Fix auth bug");

// Step 1
const recs1 = await recommend({ shapes: ['goal'] });
addActivity(recs1[0]); // Adds 'debug-bug'

// Step 2
const shapes2 = computeAvailableShapes(); // ['goal', 'error_analysis', 'patch']
const recs2 = await recommend({ shapes: shapes2 });
addActivity(recs2[0]); // Adds 'write-test'

// Continues...
```

### 2. Impulse Management

**Before:**
- Impulses are invisible
- Only shape validation shows mismatches

**After:**
- Impulses flow automatically from activity outputs
- AvailableImpulsesPanel shows current state space
- Manual insertion only for testing/override

### 3. Execution Model

**Before:**
- No execution (saves to localStorage only)
- No connection to MiniBob

**After:**
```typescript
// Execute via MiniBob
const result = await fetch('http://localhost:8080/execute-composition', {
  body: { composition: trajectory, goal_impulse: goalImpulse }
});

// MiniBob executes activities sequentially
// Stores traces to backend
// Returns execution result
```

### 4. Learning Loop

**Before:**
- No traces stored
- No Thompson Sampling updates

**After:**
```typescript
// Execution automatically:
// 1. Stores trace to backend
// 2. Updates Thompson α/β
// 3. Creates variants if modified
// 4. Records composition patterns

// Next user gets improved recommendations
```

---

## Implementation Roadmap

### Phase 1: Foundation Alignment (1-2 weeks)

**Goal**: Fix goal → recommendation flow

**Tasks:**
1. Replace `/goal-paths/recommend` with `/activities/recommend` iterations
2. Add `computeAvailableShapes()` to trajectoryStore
3. Implement AvailableImpulsesPanel component
4. Show SuggestNextActivity after each activity addition
5. Update GoalInputBox to create goal impulse

**Success Criteria:**
- User can build trajectory step-by-step with recommendations
- Available shapes update as activities are added
- Impulse flow is visible in UI

### Phase 2: Execution Integration (2-3 weeks)

**Goal**: Connect trajectory editor to MiniBob execution

**Tasks:**
1. Implement MiniBob `/execute-composition` endpoint
2. Add "Execute Trajectory" button to editor
3. Convert trajectory to composition structure
4. Display execution results with sub-activity breakdown
5. Navigate to execution trace view after completion

**Success Criteria:**
- User can execute trajectory from editor
- Execution creates trace in backend
- Results are visible in execution details page

### Phase 3: Learning Loop (2-3 weeks)

**Goal**: Close the learning feedback loop

**Tasks:**
1. Implement automatic variant creation on trace storage
2. Add ribosome extraction for successful trajectories
3. Display Thompson Sampling changes after execution
4. Show "Save as Template" option after successful execution
5. Track composition edges in database

**Success Criteria:**
- Successful executions update Thompson params
- Modified trajectories create new variants
- Composition patterns are learned and influence recommendations

### Phase 4: Advanced Features (3-4 weeks)

**Goal**: Real-time monitoring and advanced composition

**Tasks:**
1. Add WebSocket integration for live execution updates
2. Implement side-by-side trace diff view
3. Support parallel activities (multiple rows in same column)
4. Add execution replay functionality
5. Conditional activity execution (if/else branches)

**Success Criteria:**
- User sees real-time updates during execution
- Trace diff highlights modifications
- Parallel activities execute concurrently
- Conditional logic works as expected

---

## Key Metrics

### Before (Current)

- **Time to create trajectory**: ~10 minutes (manual activity selection)
- **Execution rate**: 0% (no execution integration)
- **Variant creation**: 0% (manual only)
- **Learning feedback**: 0% (no loop)
- **Success rate**: 30-40% (many abandoned attempts)

### After (Target)

- **Time to create trajectory**: ~3 minutes (recommendation-driven)
- **Execution rate**: 80%+ (one-click execute)
- **Variant creation**: 50%+ (automatic on modification)
- **Learning feedback**: 100% (every execution updates)
- **Success rate**: 80-90% (guided by recommendations)

---

## Integration Points

### Frontend (Workbench)

**Components to modify:**
- `TrajectoryEditorPage.tsx` - Main orchestration
- `GoalInputBox.tsx` - Create goal impulse, request initial recommendations
- `SuggestNextActivity.tsx` - Iterative recommendations
- `trajectoryStore.ts` - Add impulse management, execution state

**Components to create:**
- `AvailableImpulsesPanel.tsx` - Show impulse state space
- `ActivityRecommendations.tsx` - Display Thompson-sampled options
- `ExecutionProgressPanel.tsx` - Real-time execution monitoring

### Backend (Activity API)

**Existing endpoints (use as-is):**
- ✅ `POST /v2/activities/recommend` - Thompson Sampling recommendations
- ✅ `POST /v2/activities/execution-traces` - Store traces
- ✅ `POST /v2/activities/composition` - Composition edges

**Endpoints to implement:**
- ❌ `POST /v2/activities/discover-by-shapes` - Shape-based discovery (optional)

### MiniBob (Executor)

**Endpoints to implement:**
- ❌ `POST /execute-composition` - Execute trajectory structure
- ❌ WebSocket `/ws/execution/:trace_id` - Real-time updates (Phase 4)

---

## Alignment Checklist

From IMPULSE_ACTIVITY_FOUNDATION.md principles:

- [x] **Impulses are universal data**: Goals and outputs are impulses with metadata
- [x] **Activities constrain search**: Thompson Sampling ranks options at each step
- [x] **Resolvers live where data is**: MiniBob executes, backend stores/learns
- [x] **Metadata first, content later**: Goal impulse has metadata; content loaded during execution
- [x] **Record everything**: Every execution stores complete trace
- [x] **Learn from traces**: Thompson α/β updates, composition patterns, variant creation
- [x] **Reserve improvisation**: Manual activity insertion recorded as exploration
- [x] **LLMs are tools, not controllers**: Activities use LLMs where needed; validation is deterministic

---

## Next Steps

1. **Review with team** - Discuss specification and validate approach
2. **Prioritize Phase 1** - Focus on foundation alignment first
3. **Create detailed tasks** - Break down Phase 1 into sprint-ready stories
4. **Begin implementation** - Start with `/activities/recommend` integration

---

## Related Documentation

**Foundation:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Core principles

**Activity Selection:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/sequences/01-activity-selection.md` - Thompson Sampling flow
- `/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/GOAL_AWARE_RECOMMENDATION.md` - Goal processing architecture

**Original Design:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/trajectory-editor/design.md` - Initial design decisions
- `/home/avi/documents/work/exp-repo/metabob-devbob/openspec/changes/trajectory-editor/proposal.md` - Feature goals

**Implementation:**
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/workbench/src/pages/TrajectoryEditorPage.tsx` - Current implementation
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/workbench/src/stores/trajectoryStore.ts` - State management
- `/home/avi/documents/work/exp-repo/metabob-devbob/repos/workbench/src/components/trajectory/` - UI components

---

**Questions or Feedback**: Contact the architecture team or open an issue in the deployment repository.
