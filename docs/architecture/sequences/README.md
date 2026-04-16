# MiniBob Sequence Diagrams

This directory contains comprehensive sequence diagrams mapping the complete implementation of MiniBob's core workflows. All diagrams are implementation-based, with line numbers and file references from the actual codebase.

## Overview

**MiniBob operates through activity composition** - a recursive architecture where everything is an activity, including the goal processing system itself. Goal processing is a meta-activity that orchestrates other activities through composition edges, not a separate code path.

The system is built on five core workflows that work together to create a self-improving development system:

1. **Activity Selection** - How goals are matched to activities via Thompson Sampling and composition
2. **Impulse Resolution** - How data is loaded, filtered, and injected into execution context
3. **Resolver Processing** - How different resolvers (LLM, bash, git, activity, ribosome) process impulses
4. **Improvisation & Trailblazing** - How the system learns from failures and successes (as an activity)
5. **Hooks & Behavior Injection** - How behavior can be customized and extended

**Key Architectural Principle:** There are no special code paths. Goal processing, improvisation, template extraction - all are activities that compose other activities. This unified model enables unlimited composition depth and systematic learning across all workflows.

## Activity Composition Model

### Composition-Based Architecture

MiniBob uses **composition edges** to orchestrate activities, not procedural control flow:

```
goal_processing_standard.json (meta-activity)
  └─> Composes: activity_selection.json
        └─> Executes: task_implementation.json
              └─> May compose: file_operation.json

improvise_solution.json (activity)
  └─> Composes: checkpoint_creation.json
  └─> Composes: exploratory_execution.json
  └─> Composes: ribosome_extraction.json
```

**Thompson Sampling learns composition strategies:**
- Which activities to compose for which goals
- Optimal composition depth for different scenarios
- Effective composition sequences (patterns)
- When to use direct execution vs composition

### Example Composition Tree

```
User Goal: "Fix the failing tests"
    |
    v
goal_processing_standard (meta-activity)
    |
    +--[input impulse]---> goalDescription: "Fix the failing tests"
    |
    +--[composes]--------> activity_selection
    |                          |
    |                          +--[queries backend]---> Thompson Sampling
    |                          |
    |                          +--[returns]-----------> test_failure_debug.json
    |
    +--[composes]--------> test_failure_debug
                               |
                               +--[composes]--------> test_execution
                               |
                               +--[composes]--------> error_analysis
                               |
                               +--[composes]--------> fix_implementation
```

**Composition Depth:** Unlimited (recursive). Activities can compose activities that compose activities, with Thompson Sampling learning optimal depths.

### Resolvers in Composition

Resolvers are execution endpoints that process impulses and produce outputs:

- **LLM Resolver:** Reasoning and code generation (when logic is needed)
- **Bash Resolver:** Shell command execution
- **Git Resolver:** Version control operations
- **File Resolver:** Read/write/edit operations
- **Activity Resolver:** Compose and execute another activity
- **Ribosome Resolver:** Extract patterns from successful executions → new templates

The **activity resolver** enables composition. The **ribosome resolver** enables learning.

## Diagrams by Workflow

### [1. Activity Selection from Impulse State Space](./01-activity-selection.md)

Maps the complete flow from user goal → Thompson Sampling recommendation → activity execution, **now showing composition-based orchestration**.

**Key Concepts:**
- Goal processing as meta-activity (not procedural code)
- Activity selection activity (composition-based matching)
- Impulse state space querying
- Tiered fallback system (exact match → compatible → full-text search)
- Thompson Sampling with 8-point heuristic boosts
- Shape-conditioned scoring
- Correlation tracking for learning loop
- **Composition edges** for activity orchestration

**Files Covered:**
- `goal-processor.ts` (lines 2565-2625) - Now wraps meta-activity execution
- `activities.ts` (lines 3080-3116, 3285-3340) - Activity resolver for composition
- `paradigm.ts` (lines 2915-3049, 797-909) - Thompson Sampling logic

---

### [2. Impulse Resolution During Activity Execution](./02-impulse-resolution.md)

Shows the complete 11-phase flow from impulse filtering through resolution to context injection.

**Key Concepts:**
- Relevance-based filtering with threshold logic
- 6-step resolver dispatch chain (local → custom → discovery → MCP → fallback)
- Budget enforcement with truncation
- Dual-mode formatting (pointer-mode vs content-mode)
- Impulse evolution tracking (P3.2)
- State capture (before/after/transition)

**Files Covered:**
- `impulse.ts` (complete, 1056 lines)
- `impulse-filter.ts`
- `activity.ts` (lines 2920-3110)
- `vessel-discovery.ts`
- `mcp.ts`

---

### [3. Processing of Required Input Impulses by Resolvers](./03-resolver-processing.md)

Documents how each resolver type processes impulses and creates output impulses, **including activity and ribosome resolvers**.

**Key Concepts:**
- LLM resolver with tool calling loop
- Deterministic resolvers (bash, git, file operations)
- **Activity resolver** for composition (nested execution)
- **Ribosome resolver** for template extraction
- Impulse context injection into prompts
- Tool argument patterns
- Output impulse creation

**Files Covered:**
- `llm.ts` (lines 360-448) - LLM resolver
- `tools.ts` (lines 790-1722) - Deterministic resolvers
- `activity.ts` (lines 3213-3273) - Activity resolver (composition)
- `template-extractor.ts` - Ribosome resolver (learning)

---

### [4. Improvisation, Trailblazing, Checkpoints, and Rollbacks](./04-improvisation-trailblazing.md)

Shows how the system handles failures, creates variants, and extracts new templates. **Improvisation is now an activity**, not a fallback mechanism.

**Key Concepts:**
- Activity matching failure → improvisation activity trigger
- `improvise_solution.json` composes checkpoint + exploration + ribosome
- Git checkpoint creation (activity composition)
- Execution rollback with verification (activity composition)
- Trailblazing (failure → variant template via ribosome)
- Ribosome pattern (success → template extraction via resolver)
- **No special code paths** - improvisation uses same composition model

**Files Covered:**
- `goal-processor.ts` (lines 650-6800+) - Now wraps improvisation activity
- `improviser.ts` (lines 125-1650+) - Improvisation activity implementation
- `template-extractor.ts` (lines 24-400+) - Ribosome resolver
- `rollback.ts` (lines 79-250+) - Rollback activity

---

### [5. Hook Registration and Behavior Injection](./05-hooks-behavior-injection.md)

Maps the hook system for customizing and extending behavior at all lifecycle points.

**Key Concepts:**
- Lifecycle hooks (before/after prompt, complete/failed)
- Vessel hooks with state-based injection
- Impulse verification hooks
- Hook chain execution (multiple hooks per trigger)
- Promotion hooks for template registration
- Behavior modification through impulse injection
- **Hooks work uniformly across all activities** (composition-aware)

**Files Covered:**
- `lifecycle-hooks.ts`
- `vessel-hooks.ts`
- `promotion-hooks.ts`
- `impulse-verification-hooks.ts`

---

## Diagram Conventions

### Participants

All diagrams use consistent naming for key participants:
- **User/CLI** - User interaction layer
- **GoalProcessor** - Meta-activity orchestrator (wraps goal_processing_standard.json)
- **ActivityExecutor** - Activity/task execution engine (includes composition)
- **ImpulseResolver** - Impulse pointer resolution
- **LLM** - Large language model (Claude, OpenAI)
- **Backend/MCP** - metabob-activity-api (learning backend)
- **DiscoveryVessel** - Vessel capability registry

### Notation

- **Blue boxes** - Core execution phases
- **Green boxes** - Success paths
- **Red boxes** - Error/failure paths
- **Yellow boxes** - Decision points
- **Purple boxes** - Learning/storage operations
- **Orange boxes** - Composition edges (activity → activity)

### Line Number References

All function calls include line number references in this format:
```
File: repos/minibob/src/activity.ts:2990-3020
```

## How to Use These Diagrams

### For Understanding the System

1. Start with **Activity Selection** to understand how goals become executions via composition
2. Read **Impulse Resolution** to understand data flow
3. Study **Resolver Processing** to understand execution mechanics (including activity/ribosome resolvers)
4. Review **Improvisation** to understand learning and adaptation (now an activity)
5. Explore **Hooks** to understand extensibility

### For Implementation Work

Each diagram includes:
- Exact file paths and line numbers
- Function names and signatures
- Data structures passed between components
- Decision logic and branching conditions
- Error handling paths
- **Composition edges** showing activity relationships

Use these to:
- Locate code quickly during debugging
- Understand component interactions before making changes
- Validate that changes align with intended flow
- Document new features with similar diagrams
- **Understand composition patterns** before adding new activities

### For Architecture Decisions

The diagrams reveal:
- **Separation of concerns** - Which components own which responsibilities
- **Data flow patterns** - How information moves through the system
- **Coupling points** - Where components interact
- **Extension points** - Where hooks and customization occur
- **Learning loops** - Where execution feedback improves future behavior
- **Composition patterns** - How activities orchestrate other activities
- **Recursive nature** - How meta-activities enable unlimited composition depth

## Relationship to Other Documentation

These sequence diagrams complement:
- [`IMPULSE_ACTIVITY_FOUNDATION.md`](../IMPULSE_ACTIVITY_FOUNDATION.md) - The foundational model
- [`COMPOSITION_AND_CONTROL_FLOW.md`](../COMPOSITION_AND_CONTROL_FLOW.md) - Activity composition patterns
- [`IMPULSE_DRIVEN_COMPOSITION.md`](../IMPULSE_DRIVEN_COMPOSITION.md) - Composition-based architecture
- [`DISCOVERY_INTEGRATION.md`](../../../DISCOVERY_INTEGRATION.md) - Vessel discovery system
- [`DEPLOYMENT_WORKFLOW.md`](../../../repos/deployment/DEPLOYMENT_WORKFLOW.md) - CI/CD and deployment

## Diagram Format

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and can be rendered in:
- GitHub (automatic rendering)
- VS Code (with Mermaid extension)
- Obsidian (with Mermaid plugin)
- Any Markdown viewer with Mermaid support

## Contributing

When adding new workflows or modifying existing ones:

1. Update the corresponding diagram file
2. Include line number references for all code citations
3. Add decision points and error paths
4. Document data structures in notes
5. **Document composition edges** between activities
6. Update this README with new content

## Quick Reference

| Workflow | Main Entry Point | Primary Files | Learning Output | Composition |
|----------|------------------|---------------|-----------------|-------------|
| Activity Selection | `goal-processor.ts:processGoal()` | goal-processor, activities | Thompson α/β updates | Meta-activity: `goal_processing_standard.json` |
| Impulse Resolution | `impulse.ts:load()` | impulse, impulse-filter | Relevance scores | No composition (resolver layer) |
| Resolver Processing | `activity.ts:execute()` | llm, tools, activity | Tool argument patterns | Activity resolver enables composition |
| Improvisation | `improviser.ts:improvise()` | improviser, template-extractor | New templates (ribosome) | Activity: `improvise_solution.json` |
| Hooks | `lifecycle-hooks.ts:register()` | lifecycle-hooks, vessel-hooks | Behavior customization | Hooks work across all composed activities |

**Composition depth:** Unlimited (recursive)
**Learning mechanism:** Thompson Sampling learns composition strategies

---

**Last Updated:** 2026-04-16
**MiniBob Version:** Latest (feature/autonomous-cicd branch)
**Architecture:** Composition-based (everything is an activity)
