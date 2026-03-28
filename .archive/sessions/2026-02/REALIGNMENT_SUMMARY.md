# Activity System Realignment - Summary

**Date**: February 12, 2026  
**Status**: Execution works, architecture needs realignment

---

## What We Achieved Today ✅

1. **Fixed 8 bugs** - Activity execution now works end-to-end
2. **Proven self-hosting** - activity-create successfully created hello-world template
3. **Committed changes** - Working state preserved in git
4. **Identified architectural gaps** - 4 critical misalignments documented

---

## Core Insight: We Built the Wrong Thing

**What we built**: Script executor
- Templates have hardcoded prompts
- Activities run like scripts
- No learning, no adaptation

**What we should build**: Instruction generator + Learning system
- Templates describe HOW to generate instructions
- Activities adapt based on context and past learnings
- System improves through experimentation and autopsy
- This conversation (analyzing what went wrong) should itself be an activity

---

## 4 Critical Issues Blocking Correct Architecture

### 1. Templates Read Filesystem (Dev-Only)
- activity-create reads `/server/proto/activity.proto`
- Breaks in production containers
- **Fix**: Embed schema as impulse references

### 2. No Parent Context Flow
- Activity doesn't receive calling agent's context
- Guesses intent from files instead of using conversation
- **Fix**: Pass parent context as impulses

### 3. New Session Per Step
- Each step spawns new agent, loses context
- Step 2 doesn't see Step 1's output
- **Fix**: Single session with impulse-based context accumulation

### 4. No TUI Visibility
- 14-minute activity runs silently
- User sees nothing until completion
- **Fix**: Stream progress events to TUI

---

## Implementation Plan

### Phase 1: Single Session + Impulse System (4-6 hours)
**Priority**: Critical - Blocks everything else

Create `ActivitySession` class that:
- Maintains one agent session for entire activity
- Loads template impulses at start
- Accumulates step outputs as impulses
- Passes cumulative context to each step

**File**: `packages/opencode/src/session/activity-session.ts` (new)  
**Modify**: `packages/opencode/src/tool/activity.ts`

### Phase 2: Parent Context Flow (2-3 hours)
**Priority**: High - Makes activities work correctly

Capture parent agent context:
- Conversation history
- User intent (reason parameter)
- Working files
- Convert to impulses and pass to activity

**Modify**: `packages/opencode/src/tool/activity.ts`

### Phase 3: Self-Contained Templates (2-3 hours)
**Priority**: High - Required for production

Update templates to include schema/examples as impulses:
- Add activity.proto as impulse
- Add example templates as impulses
- Remove filesystem reads from prompts

**Modify**: Backend template registration

### Phase 4: TUI Integration (4-6 hours)
**Priority**: Medium - UX improvement

Stream activity progress:
- Emit events from activity tool
- Display in message list
- Show status in sidebar

**Modify**: `packages/opencode/src/tool/activity.ts`, server, TUI

---

## After Foundation: The Learning System

Once foundation is fixed, build:

1. **InstructionGenerator** - Dynamic instruction creation based on context + learnings
2. **Outcome Analyzer** - Autopsy system (can be an activity itself!)
3. **Template Evolution** - Learn from executions, improve templates
4. **Meta-learning** - Activities that analyze other activities

---

## Key Architectural Principle

**Activities are not workflows, they are instruction generators that learn.**

The system should:
- Generate instructions dynamically (not execute hardcoded prompts)
- Record what was tried and why (not just success/fail)
- Analyze outcomes (autopsy - what we're doing now!)
- Evolve templates based on learnings
- Generalize to any arbitrary code execution via instruction generation

---

## Next Steps

**Option A**: Start Phase 1 (Single Session) immediately  
**Option B**: Review/refine plan first  
**Option C**: Different priority order

What would you like to do?

---

## Documents Created

1. **ACTIVITY_SYSTEM_PURPOSE_AND_FIX.md** - Core architecture and purpose
2. **IMMEDIATE_FIX_PLAN.md** - Detailed implementation plan for 4 fixes
3. **REALIGNMENT_SUMMARY.md** (this document) - Executive summary
4. **ACTIVITY_EXECUTION_COMPLETE_SUCCESS.md** - Bug fixes and testing
5. **SELF_HOSTING_SUCCESS.md** - Proof of self-hosting capability

All context preserved for continuation.
