# MiniBob Sequence Diagrams

This directory contains comprehensive sequence diagrams mapping the complete implementation of MiniBob's core workflows. All diagrams are implementation-based, with line numbers and file references from the actual codebase.

## Overview

MiniBob operates through five core workflows that work together to create a self-improving development system:

1. **Activity Selection** - How goals are matched to activities via Thompson Sampling
2. **Impulse Resolution** - How data is loaded, filtered, and injected into execution context
3. **Resolver Processing** - How different resolvers (LLM, bash, git, etc.) process impulses
4. **Improvisation & Trailblazing** - How the system learns from failures and successes
5. **Hooks & Behavior Injection** - How behavior can be customized and extended

## Diagrams by Workflow

### [1. Activity Selection from Impulse State Space](./01-activity-selection.md)

Maps the complete flow from user goal → Thompson Sampling recommendation → activity execution.

**Key Concepts:**
- Goal enrichment with semantic analysis
- Impulse state space querying
- Tiered fallback system (exact match → compatible → full-text search)
- Thompson Sampling with 8-point heuristic boosts
- Shape-conditioned scoring
- Correlation tracking for learning loop

**Files Covered:**
- `goal-processor.ts` (lines 2565-2625)
- `activities.ts` (lines 3080-3116, 3285-3340)
- `paradigm.ts` (lines 2915-3049, 797-909)

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

Documents how each resolver type processes impulses and creates output impulses.

**Key Concepts:**
- LLM resolver with tool calling loop
- Deterministic resolvers (bash, git, file operations)
- Impulse context injection into prompts
- Tool argument patterns
- Output impulse creation
- Activity composition (nested execution)

**Files Covered:**
- `llm.ts` (lines 360-448)
- `tools.ts` (lines 790-1722)
- `activity.ts` (lines 3213-3273)

---

### [4. Improvisation, Trailblazing, Checkpoints, and Rollbacks](./04-improvisation-trailblazing.md)

Shows how the system handles failures, creates variants, and extracts new templates.

**Key Concepts:**
- Activity matching failure → improvisation trigger
- LLM-based improvisation with tool selection
- Git checkpoint creation
- Execution rollback with verification
- Trailblazing (failure → variant template)
- Ribosome pattern (success → template extraction)

**Files Covered:**
- `goal-processor.ts` (lines 650-6800+)
- `improviser.ts` (lines 125-1650+)
- `template-extractor.ts` (lines 24-400+)
- `rollback.ts` (lines 79-250+)

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
- **GoalProcessor** - Goal parsing and activity recommendation
- **ActivityExecutor** - Activity/task execution engine
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

### Line Number References

All function calls include line number references in this format:
```
File: repos/minibob/src/activity.ts:2990-3020
```

## How to Use These Diagrams

### For Understanding the System

1. Start with **Activity Selection** to understand how goals become executions
2. Read **Impulse Resolution** to understand data flow
3. Study **Resolver Processing** to understand execution mechanics
4. Review **Improvisation** to understand learning and adaptation
5. Explore **Hooks** to understand extensibility

### For Implementation Work

Each diagram includes:
- Exact file paths and line numbers
- Function names and signatures
- Data structures passed between components
- Decision logic and branching conditions
- Error handling paths

Use these to:
- Locate code quickly during debugging
- Understand component interactions before making changes
- Validate that changes align with intended flow
- Document new features with similar diagrams

### For Architecture Decisions

The diagrams reveal:
- **Separation of concerns** - Which components own which responsibilities
- **Data flow patterns** - How information moves through the system
- **Coupling points** - Where components interact
- **Extension points** - Where hooks and customization occur
- **Learning loops** - Where execution feedback improves future behavior

## Relationship to Other Documentation

These sequence diagrams complement:
- [`IMPULSE_ACTIVITY_FOUNDATION.md`](../IMPULSE_ACTIVITY_FOUNDATION.md) - The foundational model
- [`COMPOSITION_AND_CONTROL_FLOW.md`](../COMPOSITION_AND_CONTROL_FLOW.md) - Activity composition patterns
- [`DISCOVERY_INTEGRATION.md`](../../DISCOVERY_INTEGRATION.md) - Vessel discovery system
- [`DEPLOYMENT_WORKFLOW.md`](../../repos/deployment/DEPLOYMENT_WORKFLOW.md) - CI/CD and deployment

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
5. Update this README with new content

## Quick Reference

| Workflow | Main Entry Point | Primary Files | Learning Output |
|----------|------------------|---------------|-----------------|
| Activity Selection | `goal-processor.ts:processGoal()` | goal-processor, activities | Thompson α/β updates |
| Impulse Resolution | `impulse.ts:load()` | impulse, impulse-filter | Relevance scores |
| Resolver Processing | `activity.ts:execute()` | llm, tools, activity | Tool argument patterns |
| Improvisation | `improviser.ts:improvise()` | improviser, template-extractor | New templates (ribosome) |
| Hooks | `lifecycle-hooks.ts:register()` | lifecycle-hooks, vessel-hooks | Behavior customization |

---

**Last Updated:** 2026-04-16
**MiniBob Version:** Latest (feature/autonomous-cicd branch)
