# Impulse Loading Decision Report

**Generated**: 2026-03-19
**Context**: minibob Integration & Refactoring Analysis
**User Goal**: Understand how to use minibob library instead of metabob-cli, make opencode a UI frontend

---

## Context Space Analysis

### Available Budget
- **Total Context**: 200,000 tokens (session limit)
- **Recommended Target**: 12,000-15,000 tokens (60-75% of safe limit)
- **Reserve**: 40% for agent response and continuation
- **Safe Utilization**: 60-70%

### Current Utilization
- **Specified Impulses**: 14,400 tokens (from impulse specification)
- **Projected Usage**: 12,000-14,000 tokens (if high+medium priority loaded)
- **Utilization Rate**: 6-7% of total budget
- **Status**: ✅ Well within safe limits

---

## Impulse Loading Strategy

### Phase 1: HIGH Priority Load (Immediate, 7 impulses)
Load these first to understand current state and architecture:

#### ✅ Load Order 1: Architecture Understanding

1. **minibob-vessel-overview** (3000 tokens)
   - **Type**: File + recursive directory listing
   - **Path**: `repos/minibob/`
   - **Includes**: src/*.ts, *.md documentation
   - **Reason**: Foundation - understand what minibob provides as library
   - **Critical Files**:
     - `src/activity.ts` (100 lines) - Activity executor
     - `src/impulse.ts` (200+ lines) - Impulse system
     - `src/mcp.ts` (100+ lines) - Backend integration
     - `src/types.ts` - Type definitions
     - `ARCHITECTURE.md` - Design documentation

2. **refactoring-plan** (1000 tokens)
   - **Type**: Memo
   - **Content**: 4-phase refactoring roadmap
   - **Reason**: Structure the effort with clear responsibilities
   - **Expected Content**:
     - Phase 1: Analysis & Design
     - Phase 2: Library Setup
     - Phase 3: Migration
     - Phase 4: Testing & Validation

3. **minibob-activity-api** (2000 tokens)
   - **Type**: File
   - **Path**: `repos/minibob/src/types.ts`
   - **Reason**: Understand type contracts that opencode must depend on
   - **Key Interfaces**:
     - ActivityTemplate
     - ActivityExecution
     - ExecutorConfig
     - Impulse
     - ImpulsePointer

**Subtotal Phase 1**: ~6000 tokens (3% utilization)
**Decision**: ✅ **LOAD ALL** - Foundation understanding is critical

---

#### ✅ Load Order 2: Current State Analysis

4. **opencode-memory-agent** (2500 tokens)
   - **Type**: File
   - **Path**: `repos/metabob-opencode/packages/plugin-activities/src/`
   - **Reason**: What impulse/lifecycle management exists now that must move to minibob
   - **Components**:
     - MemoryManager
     - ImpulseOptimizer
     - ContextNegotiator
   - **Why Critical**: Shows exactly what opencode currently does that minibob should take over

5. **opencode-activity-management** (1500 tokens)
   - **Type**: Bash output
   - **Command**: Find activity/impulse files in opencode
   - **Reason**: Quantify the refactoring scope
   - **Metrics**: How many activity-related files need migration

**Subtotal Phase 2**: ~4000 tokens (2% utilization)
**Total Phase 1+2**: ~10,000 tokens (5% utilization)

**Decision**: ✅ **LOAD ALL** - Understanding current state is essential for planning

---

### Phase 2: MEDIUM Priority Load (Load If Space Available, 3 impulses)

These should be loaded after Phase 1 to guide implementation:

6. **mcp-config-design** (1500 tokens)
   - **Type**: File
   - **Path**: `repos/minibob/src/mcp.ts`
   - **Reason**: Design how opencode passes MCP configs to minibob
   - **Critical Section**: MCPClient constructor and config handling
   - **Decision**: ✅ **LOAD** - MCP passthrough is a core requirement

7. **minibob-impulse-system** (2000 tokens)
   - **Type**: File
   - **Path**: `repos/minibob/src/impulse.ts`
   - **Reason**: Understand impulse creation, loading, resolution lifecycle
   - **Key Methods**: create(), load(), unload(), resolvePointer()
   - **Decision**: ✅ **LOAD** - Impulse system is core to opencode refactoring

**Subtotal Phase 2**: ~3500 tokens (1.75% utilization)
**Total Phase 1+2+Phase 2**: ~13,500 tokens (6.75% utilization)

**Decision**: ✅ **LOAD ALL** - Still well within budget

---

### Phase 3: MEDIUM Priority Load (Conditional, 2 impulses)

8. **dependency-analysis** (1200 tokens)
   - **Type**: Bash output
   - **Purpose**: Count import/export dependencies
   - **Decision**: ⏳ **LOAD IF NEEDED** - Low token cost, helps measure scope
   - **Timing**: Load after Phase 2 to quantify complexity

9. **opencode-ui-components** (1800 tokens)
   - **Type**: Bash output
   - **Purpose**: Identify UI components that stay in opencode
   - **Decision**: ⏳ **LOAD IF NEEDED** - Important for Phase 3 (Migration)
   - **Timing**: Load when planning UI-specific changes

**Subtotal Phase 3**: ~3000 tokens (1.5% utilization)
**Total All Phases**: ~16,500 tokens (8.25% utilization)

**Decision**: ✅ **LOAD CONDITIONALLY** - Only if detailed UI analysis needed

---

## Summary: Recommended Loading Plan

### Immediate Load (EXECUTE NOW)
```
Impulse ID                    | Priority | Tokens | Status
----------------------------------------------------------
minibob-vessel-overview       | HIGH     | 3000   | ✅ LOAD
refactoring-plan              | HIGH     | 1000   | ✅ LOAD
minibob-activity-api          | HIGH     | 2000   | ✅ LOAD
opencode-memory-agent         | HIGH     | 2500   | ✅ LOAD
opencode-activity-management  | HIGH     | 1500   | ✅ LOAD
mcp-config-design             | MEDIUM   | 1500   | ✅ LOAD
minibob-impulse-system        | MEDIUM   | 2000   | ✅ LOAD
----------------------------------------------------------
TOTAL RECOMMENDED:                                 | 13,500 tokens
UTILIZATION:                                      | 6.75%
RESERVE REMAINING:                                | 93.25%
```

### Conditional Load (LOAD ON DEMAND)
```
Impulse ID                    | Priority | Tokens | When
----------------------------------------------------------
dependency-analysis           | MEDIUM   | 1200   | For scope analysis
opencode-ui-components        | MEDIUM   | 1800   | For UI planning
----------------------------------------------------------
TOTAL IF ALL LOADED:                              | 16,500 tokens
MAX UTILIZATION IF ALL:                           | 8.25%
```

---

## Load Validation Checklist

Before loading, verify:

- ✅ Path exists: `repos/minibob/` 
- ✅ Path exists: `repos/minibob/src/activity.ts` (100 lines of code)
- ✅ Path exists: `repos/minibob/src/impulse.ts` (200+ lines)
- ✅ Path exists: `repos/minibob/src/mcp.ts` (100+ lines)
- ✅ Path exists: `repos/minibob/src/types.ts` (type definitions)
- ✅ Path exists: `repos/metabob-opencode/packages/plugin-activities/src/` (memory management)

All paths validated. Ready to load.

---

## Expected Context After Loading

### Architecture Overview
- minibob capabilities: Activity execution, impulse system, MCP integration, ACP protocol
- opencode current state: Memory agent, impulse optimizer, context negotiator
- Integration points: Type definitions, API boundaries, MCP config passthrough

### Implementation Roadmap
- Phase 1: Analysis & Design (current state)
- Phase 2: Library Setup (minibob as npm dependency)
- Phase 3: Migration (move activity/impulse/lifecycle code)
- Phase 4: Testing & Validation

### Code Path Architecture
```
opencode (UI frontend)
    ↓
minibob (library)
    ↓
metabob-activity-api (backend)
```

---

## Next Actions After Loading

1. **Map Dependencies** (using loaded impulses)
   - Review opencode-memory-agent for what needs to move
   - Review minibob-vessel-overview for what already exists
   - Identify gaps and overlaps

2. **Design Interfaces** (using minibob-activity-api)
   - Review ActivityExecutor, ExecutorConfig
   - Design opencode-to-minibob method signatures
   - Plan MCP config passthrough

3. **Create Migration Plan** (using refactoring-plan)
   - Define Phase 2: Add minibob to opencode package.json
   - Define Phase 3: Replace activity execution code
   - Define Phase 4: UI adjustments

4. **Estimate Scope** (using dependency-analysis and opencode-activity-management)
   - Count files to refactor
   - Identify which components depend on activity system
   - Plan incremental migration

---

## Risk Assessment

### Low Risk (✅ Safe to Load All)
- Token usage: 6.75% of budget (well below 70% threshold)
- Available space: Plenty of room for expansion
- No conflicts: Different files, no overlaps

### Dependency Risks
- **None identified**: Impulses are independent reads
- **No circular dependencies**: Clear hierarchy (minibob → opencode understands it)

### Migration Complexity
- **High**: Architectural refactoring affecting core systems
- **Mitigation**: Phased approach with testing between phases
- **Timeline**: 4-6 weeks estimated

---

## Impulse Commands to Execute

Once impulse management tools are available, use these commands:

```typescript
// Phase 1: Architecture Understanding
impulse_create({
  id: "minibob-vessel-overview",
  type: "file",
  pointer: { type: "file", path: "repos/minibob/" },
  budget: 3000,
  priority: "high"
})

impulse_create({
  id: "refactoring-plan",
  type: "memo",
  pointer: { type: "memo", content: "... 4-phase plan ..." },
  budget: 1000,
  priority: "high"
})

impulse_create({
  id: "minibob-activity-api",
  type: "file",
  pointer: { type: "file", path: "repos/minibob/src/types.ts" },
  budget: 2000,
  priority: "high"
})

// Phase 2: Current State
impulse_create({
  id: "opencode-memory-agent",
  type: "file",
  pointer: { type: "file", path: "repos/metabob-opencode/packages/plugin-activities/src/" },
  budget: 2500,
  priority: "high"
})

impulse_create({
  id: "opencode-activity-management",
  type: "bash",
  pointer: { type: "bashOutput", command: "..." },
  budget: 1500,
  priority: "high"
})

// Phase 2: Integration Design
impulse_create({
  id: "mcp-config-design",
  type: "file",
  pointer: { type: "file", path: "repos/minibob/src/mcp.ts" },
  budget: 1500,
  priority: "medium"
})

impulse_create({
  id: "minibob-impulse-system",
  type: "file",
  pointer: { type: "file", path: "repos/minibob/src/impulse.ts" },
  budget: 2000,
  priority: "medium"
})

// Then load in order
impulse_load({ id: "minibob-vessel-overview" })
impulse_load({ id: "refactoring-plan" })
impulse_load({ id: "minibob-activity-api" })
impulse_load({ id: "opencode-memory-agent" })
impulse_load({ id: "opencode-activity-management" })
impulse_load({ id: "mcp-config-design" })
impulse_load({ id: "minibob-impulse-system" })
```

---

## Document Metadata

| Field | Value |
|-------|-------|
| Intent Type | Refactor |
| Confidence | 0.95 |
| Total Budget Allocated | 13,500-16,500 tokens |
| Context Utilization | 6.75-8.25% |
| Status | Ready for loading |
| Validation | ✅ All paths verified |
| Estimated Complexity | High (architectural) |
| Timeline | 4-6 weeks |

---

**Analysis Complete** ✅

This impulse loading plan provides a structured approach to understanding:
1. What minibob provides (library capabilities)
2. What opencode currently does (memory/impulse management)
3. How to integrate them (type contracts, MCP passthrough)
4. What needs to change (4-phase migration)

All decisions are data-driven and conservative with token usage (6.75% utilization).
