# Session State Tracing Documentation Index

**Date**: 2026-02-24 (Updated)  
**Purpose**: Index for complete session memory and impulse state tracing documentation  
**Analysis**: How lifecycle hooks and activities share state slices, and how memory agent optimizes context

---

## Overview

This documentation suite provides a complete trace of how **session memory agents** and **impulses** link up to calling agents when activities run as **lifecycle hooks**, with detailed guidelines on state slice sharing, transfer architecture, and optimization strategies for reducing LLM calls.

**NEW**: Comprehensive documentation on memory agent's multi-task architecture and path to zero LLM calls.

---

## Documentation Suite

### 📘 1. Implementation Tracing (Primary Document)
**File**: [`SESSION_MEMORY_LIFECYCLE_TRACING.md`](./SESSION_MEMORY_LIFECYCLE_TRACING.md)  
**Size**: 23KB  
**Contents**: Complete implementation trace with code walkthrough

**Key Sections**:
- ✅ Current Architecture: State Slice Sharing (2-stage transfer model)
- ✅ Implementation Trace: Step-by-Step (7 detailed steps)
- ✅ State Slice Guidelines: Ownership, visibility, scope conversion rules
- ✅ Planned Architecture: Unified State Slice (no transfer needed)
- ✅ Execution Flow Trace: Complete example with "Fix auth bug" scenario
- ✅ Guidelines for Activity Template Authors
- ✅ Testing Traceability with debug points

**Use This For**:
- Understanding current implementation deeply
- Finding specific code locations (with line numbers)
- Learning transfer logic mechanics
- Writing lifecycle hook activities
- Debugging impulse flow issues

---

### 📊 2. Visual Diagrams
**File**: [`SESSION_STATE_FLOW_DIAGRAM.md`](./SESSION_STATE_FLOW_DIAGRAM.md)  
**Size**: 12KB  
**Contents**: 10 Mermaid diagrams visualizing state flow

**Diagrams Included**:
1. **Current Architecture** - Transfer-Based Flow (complete flow)
2. **State Slice Ownership** - Before/during/after transfer
3. **Planned Architecture** - Unified State (no transfer)
4. **Session Hierarchy** - Parent/child/sub-session relationships
5. **Execution Graph (Planned)** - Budget allocations and impulse ownership
6. **Scope Conversion Rules** - Activity → session transformation
7. **Budget Allocation (Planned)** - Per-activity/hook tracking
8. **Impulse Lifecycle (Current)** - Creation → transfer → usage → deletion
9. **Impulse Lifecycle (Planned)** - Simplified with no transfer
10. **Multi-Activity Composition** - Nested activities sharing state

**Use This For**:
- Visual understanding of state flow
- Presenting architecture to team
- Comparing current vs. planned implementation
- Understanding session hierarchy
- Planning migration strategy

---

### 📋 3. Summary & Analysis
**File**: [`SESSION_STATE_TRACING_SUMMARY.md`](./SESSION_STATE_TRACING_SUMMARY.md)  
**Size**: 12KB  
**Contents**: Executive summary with key questions answered

**Key Sections**:
- ✅ Executive Summary (3 key findings)
- ✅ Documentation Created (overview of suite)
- ✅ Key Questions Answered (4 critical Q&As)
- ✅ Guidelines for Developers (DO/DON'T examples)
- ✅ Code References (key files with line numbers)
- ✅ Migration Roadmap (3 phases with estimates)
- ✅ Related Documentation (architecture/implementation/tests)

**Use This For**:
- Quick understanding of entire analysis
- Finding answers to specific questions
- Getting code references quickly
- Planning migration work
- Linking to related documentation

---

### 🎯 4. Memory Agent Optimization Architecture (NEW)
**File**: [`MEMORY_AGENT_IMPULSE_OPTIMIZATION_ARCHITECTURE.md`](./MEMORY_AGENT_IMPULSE_OPTIMIZATION_ARCHITECTURE.md)  
**Size**: 35KB  
**Contents**: Multi-task memory agent architecture and optimization roadmap

**Key Sections**:
- ✅ Executive Summary (3 key findings)
- ✅ Documentation Created (overview of suite)
- ✅ Key Questions Answered (4 critical Q&As)
- ✅ Guidelines for Developers (DO/DON'T examples)
- ✅ Code References (key files with line numbers)
- ✅ Migration Roadmap (3 phases with estimates)
- ✅ Related Documentation (architecture/implementation/tests)

**Use This For**:
- Quick understanding of entire analysis
- Finding answers to specific questions
- Getting code references quickly
- Planning migration work
- Linking to related documentation

---

## Quick Reference

### For Understanding Current Implementation

**Question**: How do lifecycle hooks share state?  
**Answer**: See [`SESSION_MEMORY_LIFECYCLE_TRACING.md`](./SESSION_MEMORY_LIFECYCLE_TRACING.md#current-architecture-state-slice-sharing) → "Current Architecture"

**Question**: Where is the transfer logic?  
**Answer**: See [`SESSION_STATE_FLOW_DIAGRAM.md`](./SESSION_STATE_FLOW_DIAGRAM.md#diagram-1-current-architecture---transfer-based-flow) → Diagram 1 + Code: `src/session/turn-lifecycle-hooks.ts` (lines 92-118)

**Question**: How are impulses traced?  
**Answer**: See [`SESSION_STATE_TRACING_SUMMARY.md`](./SESSION_STATE_TRACING_SUMMARY.md#q2-how-are-impulses-traced-through-the-system) → Q2 with session hierarchy tree

---

### For Planning Migration

**Question**: What's the planned architecture?  
**Answer**: See [`SESSION_MEMORY_LIFECYCLE_TRACING.md`](./SESSION_MEMORY_LIFECYCLE_TRACING.md#planned-architecture-unified-state-slice) → "Planned Architecture"

**Question**: What are the migration phases?  
**Answer**: See [`SESSION_STATE_TRACING_SUMMARY.md`](./SESSION_STATE_TRACING_SUMMARY.md#migration-roadmap) → Migration Roadmap (3 phases, 35-50 hours)

**Question**: How does the new architecture compare visually?  
**Answer**: See [`SESSION_STATE_FLOW_DIAGRAM.md`](./SESSION_STATE_FLOW_DIAGRAM.md#diagram-3-planned-architecture---unified-state) → Diagram 3 vs Diagram 1

---

### For Writing Code

**Question**: Guidelines for lifecycle hook activities?  
**Answer**: See [`SESSION_MEMORY_LIFECYCLE_TRACING.md`](./SESSION_MEMORY_LIFECYCLE_TRACING.md#guidelines-for-activity-template-authors) → "Guidelines for Activity Template Authors"

**Question**: DO/DON'T examples?  
**Answer**: See [`SESSION_STATE_TRACING_SUMMARY.md`](./SESSION_STATE_TRACING_SUMMARY.md#guidelines-for-developers) → "Guidelines for Developers"

**Question**: Test trace points?  
**Answer**: See [`SESSION_MEMORY_LIFECYCLE_TRACING.md`](./SESSION_MEMORY_LIFECYCLE_TRACING.md#testing-traceability) → "Testing Traceability"

---

### For Debugging

**Question**: Complete execution flow example?  
**Answer**: See [`SESSION_MEMORY_LIFECYCLE_TRACING.md`](./SESSION_MEMORY_LIFECYCLE_TRACING.md#execution-flow-trace-complete-example) → "Execution Flow Trace"

**Question**: Visual session hierarchy?  
**Answer**: See [`SESSION_STATE_FLOW_DIAGRAM.md`](./SESSION_STATE_FLOW_DIAGRAM.md#diagram-4-session-hierarchy-current) → Diagram 4

**Question**: Where does impulse creation happen?  
**Answer**: See [`SESSION_STATE_TRACING_SUMMARY.md`](./SESSION_STATE_TRACING_SUMMARY.md#q2-how-are-impulses-traced-through-the-system) → Q2 trace points

---

## Code Location Quick Reference

### Primary Files
| Component | File | Key Lines |
|-----------|------|-----------|
| **Lifecycle Hook Registration** | `src/session/turn-lifecycle-hooks.ts` | 20-180 |
| **Impulse Transfer Logic** | `src/session/turn-lifecycle-hooks.ts` | 92-118 |
| **executeActivityInline** | `src/tool/activity.ts` | 1190-1450 |
| **Child Session Creation** | `src/tool/activity.ts` | 1268-1284 |
| **Impulse Collection** | `src/tool/activity.ts` | 1411-1425 |
| **SessionMemory Storage** | `src/session/session-memory.ts` | 160-220 |
| **Scope Validation** | `src/session/session-memory.ts` | 169-179 |
| **Memory Agent Intent** | `src/session/memory-agent.ts` | 140-300 |

### Test Files
| Test Suite | File | Purpose |
|------------|------|---------|
| **Lifecycle Hooks** | `test/session/turn-lifecycle-hooks.test.ts` | Hook execution and transfer |
| **Memory Integration** | `test/session/memory-optimization-integration.test.ts` | Full memory agent flow |
| **Impulse E2E** | `test/session/impulse-system-e2e.test.ts` | End-to-end impulse system |

---

## Architecture Documents

### Related Specifications
- **Shared Instructional State**: [`docs/architecture/SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md`](./docs/architecture/SHARED_INSTRUCTIONAL_STATE_COMPLETE_ARCHITECTURE.md)
  - Complete architecture spec for unified state
  - Phase 1, 2, 3 implementation roadmap
  - Design decisions and tradeoffs

- **Memory Agent Implementation**: [`repos/metabob-opencode/packages/opencode/docs/MEMORY_AGENT_IMPLEMENTATION.md`](./repos/metabob-opencode/packages/opencode/docs/MEMORY_AGENT_IMPLEMENTATION.md)
  - Memory agent architecture
  - Codebase awareness fixes
  - Intent analysis and impulse suggestions

---

## Key Findings Summary

### Current Architecture (Transfer-Based)
**How It Works**:
1. Lifecycle hook executes in isolated child session
2. Memory agent creates impulses in child session
3. Transfer logic converts scope (activity → session)
4. Impulses moved to parent session
5. Main agent sees transferred impulses

**Characteristics**:
- ✅ Agent messages isolated from parent
- ✅ Impulses eventually visible
- ⚠️  Complex transfer logic required
- ⚠️  Temporary isolation during execution

### Planned Architecture (Unified)
**How It Will Work**:
1. Lifecycle hook executes in parent session (no child)
2. Impulses created directly in parent SessionMemory
3. No transfer needed (single source of truth)
4. Main agent sees impulses immediately

**Characteristics**:
- ✅ Simpler architecture (no transfer)
- ✅ Immediate visibility
- ✅ Nested activities share state automatically
- ✅ Budget tracking per activity/hook
- ✅ Execution graph shows full hierarchy

---

## State Slice Guidelines (Quick Reference)

### Ownership Rules (Current)
- **Parent Session**: Owns transferred impulses (scope="session")
- **Child Session**: Owns impulses during execution (scope="activity")
- **Task Sub-Sessions**: Create impulses in their own SessionMemory

### Visibility Rules (Current)
- **During execution**: Child CANNOT see parent impulses
- **After transfer**: Parent CAN see child impulses
- **Main agent**: Sees only parent session impulses

### Scope Conversion (Current)
| Stage | Scope | SessionID | Storage Location |
|-------|-------|-----------|------------------|
| Creation | "activity" | ses_child | SessionMemory[ses_child] |
| Transfer | "session" | ses_parent | SessionMemory[ses_parent] |
| Usage | "session" | ses_parent | SessionMemory[ses_parent] |

---

## Migration Path

### Phase 1: Unify Impulse Storage ⚡ CRITICAL
- **Estimated**: 10-15 hours
- **Goal**: Remove Activity.impulses, use SessionMemory exclusively
- **Impact**: Breaking change, requires migration script

### Phase 2: Budget Allocation & Execution Graph
- **Estimated**: 15-20 hours
- **Goal**: Track budget per activity/hook, build execution graph
- **Impact**: New features, additive (no breaking changes)

### Phase 3: Visualization & Tooling
- **Estimated**: 10-15 hours
- **Goal**: CLI tools for inspection, Mermaid graphs
- **Impact**: Developer experience improvements

**Total Estimated**: 35-50 hours

---

## Use Cases

### I want to...
- **Understand current implementation** → Read [`SESSION_MEMORY_LIFECYCLE_TRACING.md`](./SESSION_MEMORY_LIFECYCLE_TRACING.md)
- **See visual flow** → View diagrams in [`SESSION_STATE_FLOW_DIAGRAM.md`](./SESSION_STATE_FLOW_DIAGRAM.md)
- **Get quick answers** → Check [`SESSION_STATE_TRACING_SUMMARY.md`](./SESSION_STATE_TRACING_SUMMARY.md)
- **Plan migration** → Review roadmap in summary + architecture spec
- **Write lifecycle hook** → Follow guidelines in tracing document
- **Debug impulse flow** → Use trace points from tracing document
- **Present to team** → Show diagrams + summary key findings

---

## Documentation Quality

### Coverage
- ✅ Implementation fully traced (7 detailed steps)
- ✅ Code locations with line numbers provided
- ✅ Visual diagrams for all key concepts (10 diagrams)
- ✅ Current vs. planned architecture documented
- ✅ Guidelines for developers (DO/DON'T)
- ✅ Testing traceability included
- ✅ Migration roadmap with estimates
- ✅ Related documentation linked

### Validation
- ✅ Code references verified against actual implementation
- ✅ Diagrams match code flow
- ✅ Guidelines tested against real use cases
- ✅ Architecture spec aligned with planned changes

---

## Next Steps

1. **Review Documentation**: Team review of all three documents
2. **Validate Architecture**: Confirm planned architecture aligns with team vision
3. **Prioritize Migration**: Decide on Phase 1 implementation timeline
4. **Update Tests**: Add tests for planned architecture
5. **Execute Phase 1**: Begin migration to unified state

---

## Document Metadata

| Document | Size | Created | Status |
|----------|------|---------|--------|
| Implementation Tracing | 23KB | 2026-02-24 | ✅ Complete |
| Visual Diagrams | 12KB | 2026-02-24 | ✅ Complete |
| Summary & Analysis | 12KB | 2026-02-24 | ✅ Complete |
| **Total Suite** | **47KB** | **2026-02-24** | **✅ Ready** |

---

## Questions?

For specific questions about:
- **Current implementation**: See Implementation Tracing document
- **Architecture decisions**: See Shared Instructional State architecture spec
- **Visual understanding**: See Visual Diagrams document
- **Quick reference**: See Summary & Analysis document
- **Code locations**: See Code Reference section above
- **Migration**: See Migration Roadmap section

**Contact**: Reference this index when discussing session memory/impulse architecture

---

### 🎯 4. Memory Agent Optimization Architecture (NEW)
**File**: [`MEMORY_AGENT_IMPULSE_OPTIMIZATION_ARCHITECTURE.md`](./MEMORY_AGENT_IMPULSE_OPTIMIZATION_ARCHITECTURE.md)  
**Size**: 35KB  
**Contents**: Multi-task memory agent architecture and optimization roadmap

**Key Sections**:
- ✅ Why Transfer-Based Design Is Good (isolation, transparency, composability)
- ✅ Multi-Task Breakdown: Analyze Intent (LLM) → Create Impulses (no LLM) → Load/Unload
- ✅ Per-Turn and Per-Task Optimization Strategies
- ✅ Learning System: Path to Zero LLM Calls (5 phases with estimates)
- ✅ Implementation Roadmap (60-80 hours total, phased approach)
- ✅ Performance Characteristics (current vs. optimized: 85-90% reduction)
- ✅ Complete code walkthrough with line numbers

**Use This For**:
- Understanding why transfer-based design is **intentional and beneficial**
- Learning memory agent's multi-task architecture (what each task does)
- Planning optimization work (pattern recognition, per-task recalculation, learning)
- Understanding path to eliminating LLM calls (from ~25-40s to ~3-8s overhead)
- Finding immediate optimization opportunities (Phase 1: pattern recognition)
- Designing activities with impulseReferences (per-task context optimization)

**Key Insights**:
- Transfer-based design **prevents pollution** of main session (LLM analysis isolated)
- Memory agent already **multi-task**: intent analysis, impulse creation, loading
- **60-70% context reduction** possible with per-task recalculation
- **80% of turns** can skip LLM with pattern recognition + learning
- Activities can run with **0 LLM overhead** using template requirements

