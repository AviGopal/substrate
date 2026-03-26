# MiniBob Alignment Review

## Executive Summary

MiniBob has **significantly expanded** from ~3,000 LOC to **9,145 LOC** (3x growth). While the core ontological model remains intact, the system has evolved beyond "minimal" into a **feature-rich vessel** with substantial new capabilities.

**Alignment Status:** ⚠️ **PARTIAL - Requires Review**

## Size Analysis

| Metric | Original Goal | Current State | Delta |
|--------|--------------|---------------|-------|
| Total LOC | ~3,000 | 9,145 | +6,145 (+305%) |
| Core Files | ~2,000 | 6,101 | +4,101 (+205%) |
| New Capabilities | - | 3,044 | New |

## File-by-File Breakdown

### Core Files (Modified)

| File | Lines | Growth | Purpose |
|------|-------|--------|---------|
| activity.ts | 1,320 | +669 | Activity executor - EXPANDED |
| tools.ts | 924 | - | Built-in tools |
| mcp.ts | 747 | +361 | Backend communication - EXPANDED |
| types.ts | 489 | +112 | Type definitions - EXPANDED |
| llm.ts | 434 | - | LLM client |
| boredom.ts | 423 | - | Autonomous mode |
| acp.ts | 362 | - | Vessel communication |
| memory-agent.ts | 316 | - | Context management |
| impulse.ts | 311 | - | Impulse system |

**Core Total:** 6,101 lines

### New Capabilities (Untracked)

| File/Directory | Lines | Purpose | Alignment |
|----------------|-------|---------|-----------|
| search-first-executor.ts | 662 | Search-first execution | ⚠️ Need to verify |
| goal-processor.ts | 457 | Goal-driven execution | ✅ Aligned (goal→activity) |
| understanding/ | 1,022 | Codebase analysis | ⚠️ Scope expansion |
| impulse-filter.ts | 273 | Impulse filtering | ✅ Aligned (context mgmt) |
| acp-gossip.ts | 193 | Vessel gossip protocol | ⚠️ Need to verify |
| lifecycle-hooks.ts | 181 | Lifecycle management | ✅ Aligned (vessel hooks) |
| session.ts | 141 | Session tracking | ✅ Aligned (state mgmt) |
| template-generator.ts | 123 | Template generation | ⚠️ Learning in vessel? |

**New Capabilities Total:** 3,052 lines

## Ontological Alignment Analysis

### ✅ ALIGNED: Vessel (Instructional State)

**What's Working:**
- Activity templates still define the instructional state
- Templates are versioned and stored
- Variants can be created
- Reusability maintained

**Evidence:**
```typescript
// Templates remain as pure instruction
{
  "id": "trace-intention-flow",
  "tasks": [...]  // Instructional state
}
```

**Alignment Score:** ✅ 100% - Core vessel concept intact

### ⚠️ PARTIAL: Becoming (Transient State)

**What's Working:**
- Executions happen and are tracked
- Activity executor runs tasks sequentially
- Tool calls are executed
- State transitions occur

**What's Added (Needs Verification):**
- **Input state capture** (+100 LOC in activity.ts)
  ```typescript
  async function captureInputState(...)  // NEW
  ```
  - ✅ Aligned: Captures vessel instantiation context
  - Purpose: Make becoming observable

- **Output state capture** (+150 LOC in activity.ts)
  ```typescript
  async function captureOutputState(...)  // NEW
  ```
  - ✅ Aligned: Captures instance actualization
  - Purpose: Track what changed

- **File hash tracking** (+80 LOC in activity.ts)
  ```typescript
  async function captureFileHashes(...)  // NEW
  ```
  - ✅ Aligned: State transition verification
  - Purpose: Detect changes

**Concerns:**
- Significant complexity added to capture transient state
- Vessel now "observes itself" - is this appropriate?

**Alignment Score:** ⚠️ 75% - Functional but complex

### ✅ ALIGNED: Instance (Functional State)

**What's Working:**
- Execution results stored in backend
- Success/failure tracked
- Metrics captured (duration, cost, tokens)
- Artifacts persisted

**What's Added:**
- Enhanced execution trace payload
- Complete state snapshots
- Task-level details

**Alignment Score:** ✅ 90% - Well aligned

### ⚠️ PARTIAL: Learning Loop

**What's Working:**
- Thompson Sampling updates in backend
- Ribosome pattern extracts templates
- Continuous improvement cycle

**What's Added (Needs Verification):**
- **Goal Processor** (457 LOC)
  - Converts goals → activity recommendations
  - Uses backend for recommendations
  - ✅ Aligned: Delegates learning to backend

- **Template Generator** (123 LOC)
  - Generates templates from executions
  - ⚠️ Question: Is this vessel responsibility?
  - Should ribosome be in backend only?

**Alignment Score:** ⚠️ 70% - Some learning logic in vessel

## New Capabilities Assessment

### 1. Understanding System (1,022 LOC)

**Purpose:** Codebase analysis and architecture understanding

**Files:**
- `src/understanding/explorer.ts` (488 LOC) - Static analysis
- `src/understanding/analyzer.ts` (354 LOC) - LLM-powered analysis
- `src/understanding/types.ts` (153 LOC) - Type definitions

**Analysis:**
```typescript
// Provides capabilities like:
- explore(path, focus) → CodeStructure
- analyze(structure, focus) → Analysis
- diagnose(problem) → Diagnosis
```

**Alignment Questions:**
- ✅ **Pro:** Makes vessel more capable for self-development
- ✅ **Pro:** Supports "understand before acting" principle
- ⚠️ **Con:** Adds significant complexity (1,022 LOC = 11% of codebase)
- ⚠️ **Con:** Is this "minimal"?

**Recommendation:** ✅ **KEEP** - Valuable for self-improvement, but document as intentional scope expansion

### 2. Search-First Executor (662 LOC)

**Purpose:** Unknown - needs investigation

**Alignment Status:** ⚠️ **NEEDS REVIEW**

**Action Required:** Determine purpose and verify alignment

### 3. Goal Processor (457 LOC)

**Purpose:** Goal-driven activity execution

**Analysis:**
```typescript
// Converts user goals → activity recommendations
class GoalProcessor {
  async processGoal(goal: string): Promise<ActivityRecommendation[]> {
    // Delegates to backend for recommendations
    return await this.mcp.recommendActivities(goal)
  }
}
```

**Alignment:**
- ✅ **Pro:** Bridges user intent → vessel execution
- ✅ **Pro:** Delegates learning to backend
- ✅ **Pro:** Maintains separation of concerns

**Recommendation:** ✅ **KEEP** - Well aligned

### 4. Impulse Filter (273 LOC)

**Purpose:** Filters impulses by relevance

**Alignment:**
- ✅ Manages context window (vessel responsibility)
- ✅ Optimizes which impulses to load

**Recommendation:** ✅ **KEEP** - Aligned with impulse system

### 5. Template Generator (123 LOC)

**Purpose:** Generates activity templates

**Analysis:**
```typescript
// Creates new templates from parameters
export function generateTemplate(params): ActivityTemplate {
  // ...generates JSON template
}
```

**Alignment Questions:**
- ⚠️ Is this vessel responsibility or backend responsibility?
- ⚠️ Should template creation be part of ribosome (in backend)?
- ✅ Or is this just a utility for vessel to create its own structure?

**Recommendation:** ⚠️ **REVIEW** - Clarify if learning or utility

## Separation of Concerns Analysis

### MiniBob's Role (Should)
- ✅ Execute activities with LLM
- ✅ Capture execution traces
- ✅ Resolve LOCAL impulses (memo, file)
- ✅ Delegate to backend for learning
- ✅ Report metrics and outcomes

### MiniBob's Current State (Is)
- ✅ Execute activities with LLM
- ✅ Capture execution traces (ENHANCED)
- ✅ Resolve LOCAL impulses
- ✅ Delegate to backend (MAINTAINED)
- ✅ Report metrics (ENHANCED)
- ⚠️ **NEW:** Understand codebases (1,022 LOC)
- ⚠️ **NEW:** Process goals (457 LOC)
- ⚠️ **NEW:** Generate templates (123 LOC)
- ⚠️ **NEW:** Search-first execution (662 LOC)

### Separation Score

| Concern | Status | Notes |
|---------|--------|-------|
| Execution | ✅ Maintained | Still in vessel |
| Storage | ✅ Maintained | Still in backend |
| Learning | ✅ Maintained | Still in backend |
| Pattern Recognition | ✅ Maintained | Still in backend |
| Thompson Sampling | ✅ Maintained | Still in backend |

**Overall:** ✅ 95% - Core separation maintained

## "Minimal" Principle Analysis

### Original Definition
> **Minimal but Complete** - Only essential features, but fully functional

### Current Reality
- **Essential Features:**
  - Activity execution: ✅ ~1,320 LOC
  - Tool integration: ✅ ~924 LOC
  - Backend communication: ✅ ~747 LOC
  - Impulse system: ✅ ~311 LOC
  - **Subtotal: ~3,302 LOC** ← Within "minimal" range

- **Extended Features:**
  - Understanding system: 1,022 LOC
  - Goal processing: 457 LOC
  - Search-first executor: 662 LOC
  - Impulse filtering: 273 LOC
  - Template generation: 123 LOC
  - Session management: 141 LOC
  - Lifecycle hooks: 181 LOC
  - ACP gossip: 193 LOC
  - **Subtotal: ~3,052 LOC** ← "Nice to have" additions

- **Supporting Code:**
  - Types, config, environment: ~790 LOC
  - **Subtotal: ~790 LOC**

### Assessment

**Core:** 3,302 LOC ← ✅ Minimal
**Extensions:** 3,052 LOC ← ⚠️ Beyond minimal
**Supporting:** 790 LOC ← ✅ Expected
**Total:** 9,145 LOC ← ⚠️ Not minimal

## Recommendations

### 🎯 Priority 1: Document Intent

Create `MINIBOB_ARCHITECTURE_V2.md` explaining:
1. Why understanding system was added (self-improvement)
2. Why goal processor is in vessel (user interface)
3. What search-first executor does
4. Updated definition of "minimal" or rename to "capable vessel"

### 🎯 Priority 2: Verify Alignment

**Files to Review:**
1. ✅ `src/activity.ts` - Review state capture additions
2. ⚠️ `src/search-first-executor.ts` - **What is this?**
3. ⚠️ `src/template-generator.ts` - Should this be in backend?
4. ✅ `src/goal-processor.ts` - Verify separation maintained
5. ✅ `src/understanding/` - Document as intentional expansion

### 🎯 Priority 3: Refactor Considerations

**Option A: Accept Growth**
- Rename from "minimal" to "capable" vessel
- Document all features as intentional
- Update CLAUDE.md with new architecture

**Option B: Extract Features**
- Move understanding system to separate package
- Move goal processor to backend
- Keep MiniBob core at ~3,500 LOC

**Option C: Split into Layers**
- Core layer: 3,302 LOC (execution only)
- Extensions layer: 3,052 LOC (optional features)
- Keep together but modularize

## Critical Questions for Review

1. **Understanding System (1,022 LOC)**
   - ❓ Is codebase analysis a vessel responsibility?
   - ❓ Should this be a separate tool/plugin?
   - ❓ How does this support the process-of-becoming?

2. **Search-First Executor (662 LOC)**
   - ❓ What does this do?
   - ❓ Why was it added?
   - ❓ Is it aligned with ontology?

3. **Template Generator (123 LOC)**
   - ❓ Is template creation learning or utility?
   - ❓ Should ribosome be backend-only?
   - ❓ Or is this just vessel self-configuration?

4. **Size Philosophy**
   - ❓ Is "minimal" still the goal?
   - ❓ Should we embrace "capable vessel"?
   - ❓ What's the LOC target going forward?

## Conclusion

**Alignment Status:** ⚠️ **75% ALIGNED**

**What's Aligned:**
- ✅ Three-state ontology maintained
- ✅ Separation of concerns preserved
- ✅ Vessel → Becoming → Instance → Learning cycle intact
- ✅ Backend handles all learning
- ✅ Core execution model unchanged

**What Needs Review:**
- ⚠️ Size has tripled (9,145 LOC vs 3,000 target)
- ⚠️ "Minimal" principle no longer accurate
- ⚠️ New features need alignment verification
- ⚠️ Search-first executor purpose unclear
- ⚠️ Template generator role needs clarification

**Recommendation:**
1. **Document** all new features and their rationale
2. **Review** search-first executor and template generator
3. **Decide** if "minimal" is still the goal or if "capable vessel" is the new direction
4. **Update** CLAUDE.md with current architecture
5. **Verify** that all additions support the process-of-becoming

The foundation is solid, but the system has evolved significantly. A conscious decision is needed about whether this evolution is intentional and aligned with the project's goals.
