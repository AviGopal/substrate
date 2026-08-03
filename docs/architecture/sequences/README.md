# Substrate Execution Sequence Diagrams

> **Status (2026-06):** Execution has fully moved off minibob. **minibob is deprecated** — it is now a thin CLI wrapper that POSTs goals to `goal-host-vessel` and has no in-process execution engine; the agent-facing dispatch surface is the metabob-mcp tool `mcp__metabob__run_goal`. The work that these diagrams narrate (goal processing, activity selection, impulse resolution, resolver dispatch, improvisation, ribosome extraction) runs inside the **substrate vessels**: `goal-host-vessel` (`:8210`, `POST /run-goal` + `/resolve`) hosts the `GoalHost` / ActivityExecutor / goal-processor / resolvers from `ias-executor-ts`; `llm-resolver-vessel` (`:8220`) owns LLM calls; `local-tools-vessel` (`:8230`) owns filesystem/process resolvers; `ribosome-vessel` (`:8240`) owns template extraction; `boredom-vessel` owns the autonomous loop. The conceptual flows (Thompson sampling, impulse resolution, resolver dispatch, lifecycle hooks) remain accurate; wherever older text below says "MiniBob" as the **executor**, read **goal-host-vessel**, and wherever participant labels say `GoalProcessor`/`ActivityExecutor`, read `GoalHost (goal-host-vessel / ias-executor-ts)`. Per-file line-number citations are stale; navigate via `repos/goal-host-vessel/` and `@avigopal/ias-executor-ts`.
>
> **New (June 2026), reflected in `01` and `04`:** a goal no longer succeeds on exit status alone. After execution, the **goal-reaching gate** (`verifyGoalReached`, goal-host) runs an LLM judge that emits `completion_shapes` and decides `reached` vs not; a `status=completed` run that did not produce the asked output is `reached:false` and β-penalises the selected template. On `reached:false` the `/resolve` loop performs **in-flight recovery** — β-penalise + exclude the failed approach (`recommendExcluding`) and retry a *different* approach until reached or exhausted; the reached trace is what the ribosome mints. Per-goal learning is recorded in `goal_execution_paths` keyed by `goal_hash`. See [`GOAL_EXECUTION_PATHS_SCHEMA.md`](../GOAL_EXECUTION_PATHS_SCHEMA.md).

This directory contains comprehensive sequence diagrams mapping the complete implementation of the substrate vessel execution workflows. All diagrams are implementation-based, with line numbers and file references that historically pointed at the actual codebase; after Phase 8 (2026-05-24) the live equivalents are the substrate vessels named above. Participant labels referencing `GoalProcessor`/`ActivityExecutor` in former minibob source now refer to `GoalHostVessel` / `GoalHost (ias-executor-ts)`.

## Overview

**The substrate operates through activity composition** - a recursive architecture where everything is an activity, including the goal processing system itself. Goal processing is a meta-activity that orchestrates other activities through composition edges, not a separate code path.

The system is built on five core workflows that work together to create a self-improving development system:

1. **Activity Selection** - How goals are matched to activities via Thompson Sampling and composition
2. **Impulse Resolution** - How data is loaded, filtered, and injected into execution context
3. **Resolver Processing** - How different resolvers (LLM, bash, git, activity, ribosome) process impulses
4. **Improvisation & Trailblazing** - How the system learns from failures and successes (as an activity)
5. **Hooks & Behavior Injection** - How behavior can be customized and extended

**Key Architectural Principle:** There are no special code paths. Goal processing, improvisation, template extraction - all are activities that compose other activities. This unified model enables unlimited composition depth and systematic learning across all workflows.

## Activity Composition Model

### Composition-Based Architecture

The substrate (goal-host-vessel's `GoalHost`) uses **composition edges** to orchestrate activities, not procedural control flow:

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

Each diagram now includes an **Implementation Architecture** section that clarifies:
- Which responsibilities belong to goal-host-vessel and its resolver vessels (execution environment)
- Which responsibilities belong to activity-api (storage & learning backend)
- What data structures are stored in SurrealDB
- Why this separation matters

### [1. Activity Selection from Impulse State Space](./01-activity-selection.md)

Maps the complete flow from user goal → Thompson Sampling recommendation → activity execution, **now showing composition-based orchestration**.

**Key Concepts:**
- Goal processing as meta-activity (not procedural code)
- Activity selection activity (composition-based matching)
- Impulse state space querying
- Tiered fallback system (exact match → compatible → full-text search)
- Thompson Sampling with 8-point heuristic boosts (state-conditioned where a state signature is present)
- Shape-conditioned scoring
- Correlation tracking for learning loop
- **Composition edges** for activity orchestration
- **Goal-reaching gate** (`verifyGoalReached`) as the post-execution success determinant

**Files Covered (live equivalents in `goal-host-vessel` / `ias-executor-ts`):**
- `goal-processor.ts` → GoalHost meta-activity execution
- `activities.ts` (activity-api) - recommend + composition resolver
- `paradigm.ts` (activity-api) - Thompson Sampling logic

**Architecture Split:**
- **goal-host-vessel**: Meta-activity orchestration, trace capture, goal-reaching gate
- **Activity-API**: Thompson Sampling, template storage, learning

---

### [2. Impulse Resolution During Activity Execution](./02-impulse-resolution.md)

Shows the complete 11-phase flow from impulse filtering through resolution to context injection.

**Key Concepts:**
- Relevance-based filtering with threshold logic
- **6-step resolver dispatch chain (local → custom → discovery → backend → fallback)** - lives in goal-host-vessel
- Budget enforcement with truncation
- Dual-mode formatting (pointer-mode vs content-mode)
- Impulse evolution tracking (P3.2)
- State capture (before/after/transition)

**Files Covered (live equivalents in `goal-host-vessel` / `ias-executor-ts`):**
- `impulse.ts` - **Contains the 6-step dispatch**
- `impulse-filter.ts`
- `activity.ts`
- `vessel-discovery.ts`
- backend client (formerly `mcp.ts`; now HTTP to activity-api via discovery contract)

**Architecture Split:**
- **goal-host-vessel**: 6-step resolver dispatch (local → custom → discovery → backend → fallback); `local-tools-vessel` owns the filesystem/process resolvers it dispatches to
- **Activity-API**: Relevance scores, activity-related shape resolution
- **Discovery-Vessel**: Capability-based routing (shape → vessels)

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

**Files Covered (live equivalents):**
- `llm.ts` → `llm-resolver-vessel` (`:8220`) - LLM resolver
- `tools.ts` → `local-tools-vessel` (`:8230`) - deterministic resolvers (bash/git/file/process)
- `activity.ts` → `goal-host-vessel` - Activity resolver (composition)
- `template-extractor.ts` → `ribosome-vessel` (`:8240`) - Ribosome resolver (learning)

**Architecture Split:**
- **goal-host-vessel + resolver vessels**: All resolvers (LLM via llm-resolver-vessel, bash/git/file via local-tools-vessel, activity, ribosome via ribosome-vessel), tool execution
- **Activity-API**: Tool argument pattern storage, proven pattern recommendations

---

### [4. Improvisation, Failure Modes, Checkpoints, and Rollbacks](./04-improvisation-failure-modes.md)

Shows how the system handles failures, creates variants, and extracts new templates. **Improvisation is now an activity**, not a fallback mechanism.

**Key Concepts:**
- Activity matching failure → improvisation activity trigger
- `improvise_solution.json` composes checkpoint + exploration + ribosome
- Git checkpoint creation (activity composition)
- Execution rollback with verification (activity composition)
- Trailblazing (failure → variant template via ribosome)
- Ribosome pattern (success → template extraction via resolver)
- **In-flight recovery loop** — on `reached:false`, β-penalise + `recommendExcluding` the failed approach + retry a different approach
- **No special code paths** - improvisation uses same composition model

**Files Covered (live equivalents in `goal-host-vessel` / `ias-executor-ts`, plus `ribosome-vessel`):**
- `goal-processor.ts` → GoalHost improvisation + goal-reaching gate + recovery loop
- `improviser.ts` - Improvisation activity implementation
- `template-extractor.ts` → `ribosome-vessel` - Ribosome resolver
- `rollback.ts` - Rollback activity

**Architecture Split:**
- **goal-host-vessel**: Improvisation execution, goal-reaching gate, in-flight recovery, checkpoint/rollback (ribosome extraction in `ribosome-vessel`)
- **Activity-API**: Template storage (improvise_solution + extracted + variants), per-goal `goal_execution_paths`

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
- **CRITICAL: Hooks are vessel configuration, NOT activity schema**

**Files Covered:**
- `lifecycle-hooks.ts`
- `vessel-hooks.ts`
- `promotion-hooks.ts`
- `impulse-verification-hooks.ts`

**Architecture Split:**
- **goal-host-vessel (and vessel subscribers)**: ALL hook logic — now event-driven; lifecycle events (`lifecycle:task:*`, `lifecycle:execution:*`, `lifecycle:gap:*`, `lifecycle:llm:*`) flow on the activity-api WebSocket bus and are handled by vessel subscribers rather than an in-process registry
- **Activity-API**: hosts the broadcast bus, but hook *logic* is not backend data

**Key Point:** Hooks customize **how the executing vessel behaves** (instance/subscriber-specific), while activities define **what work gets done** (portable templates).

---

## Diagram Conventions

### Participants

All diagrams use consistent naming for key participants. After Phase 8 these map to substrate vessels:
- **User/CLI** - dispatch surface: the metabob-mcp tool `mcp__metabob__run_goal` (or the deprecated `minibob` CLI, which forwards to goal-host-vessel)
- **GoalProcessor** - Meta-activity orchestrator (`GoalHost` in goal-host-vessel; wraps goal_processing_standard.json)
- **ActivityExecutor** - Activity/task execution engine (in goal-host-vessel / ias-executor-ts; includes composition)
- **ImpulseResolver** - Impulse pointer resolution (in goal-host-vessel)
- **LLM** - Large language model, reached via `llm-resolver-vessel` (`:8220`)
- **Backend/MCP** - metabob-activity-api (learning backend), reached over HTTP via the discovery resolver contract (not a local MCP client)
- **DiscoveryVessel** - Vessel capability registry

### Notation

- **Blue boxes** - Core execution phases
- **Green boxes** - Success paths
- **Red boxes** - Error/failure paths
- **Yellow boxes** - Decision points
- **Purple boxes** - Learning/storage operations
- **Orange boxes** - Composition edges (activity → activity)

### Line Number References

All function calls include line number references in this historical format (paths are now stale — read them as the live equivalents in `goal-host-vessel` / `ias-executor-ts`):
```
File: repos/goal-host-vessel/...
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

## Neutral Bus and Sequence Topology

The sequence diagrams in this directory describe message flows between substrate participants. The execution sequences (`01`–`05`) were written when lifecycle events were in-process only — consumers were tightly coupled to emitters. The substrate now uses a neutral broadcast bus (the activity-api WebSocket broadcaster) as the event transport. Key changes to the sequence topology:

- All `lifecycle:task:*`, `lifecycle:execution:*`, `lifecycle:gap:*`, and `lifecycle:llm:*` events flow on the bus. Workbench, ribosome-vessel, concept-db, and any future vessel subscribe rather than being explicitly wired to the emitter.
- Discovery-vessel emits `vessel.registered`, `vessel.heartbeat`, `vessel.deregistered`, and `vessel.expired` on the same bus. Goal-host-vessel subscribes to `vessel.registered` to reactively register proxy resolvers when new vessels appear.
- The `sequences/05-hooks-behavior-injection.md` hook registration sequence describes the in-process registration model. On the bus model, "hook registration" becomes WebSocket subscription; the payload contract is the same.

When reading the sequence diagrams, substitute: any participant that previously received a lifecycle event via direct in-process callback now receives it via WebSocket bus subscription. Arrows that show a direct push from emitter to consumer pass through the bus; the consumer's subscription filter determines which events reach it. This decoupling means new vessels can observe the full execution event stream without requiring changes to goal-host-vessel or activity-api.

## Relationship to Other Documentation

These sequence diagrams complement:
- [`IMPULSE_ACTIVITY_FOUNDATION.md`](../IMPULSE_ACTIVITY_FOUNDATION.md) - The foundational model; activity composition patterns and composition-based architecture
- [`DEPLOYMENT_WORKFLOW.md`](../../../repos/deployment/DEPLOYMENT_WORKFLOW.md) - CI/CD and deployment

## Architectural Clarity: goal-host-vessel vs Activity-API

Each sequence document now includes an **Implementation Architecture** section that clarifies the separation of concerns. Here's the high-level split. (Historically "MiniBob" was the execution environment; that role moved to **goal-host-vessel** and its resolver vessels in Phase 8, 2026-05-24.)

### goal-host-vessel + resolver vessels (Execution Environment)

**What the execution environment does:**
- Execute activities (meta-activities and domain-specific) — `GoalHost` in goal-host-vessel
- **6-step resolver dispatch** (local → custom → discovery → backend → fallback)
- Resolve LOCAL impulse types (memo, file, directoryTree, gitDiff) — filesystem/process via `local-tools-vessel`
- Execute all resolvers (LLM via `llm-resolver-vessel`, bash/git/file via `local-tools-vessel`, activity, ribosome via `ribosome-vessel`)
- Capture execution traces (structure and state)
- Run the **goal-reaching gate** (`verifyGoalReached`) and **in-flight recovery** after execution
- React to lifecycle events on the activity-api bus (subscriber model; replaces in-process hook registries)
- Create impulses (output, error, argument)
- Checkpoints and rollbacks

**What the execution environment does NOT do:**
- Does NOT store templates (backend owns)
- Does NOT compute Thompson Sampling (backend owns)
- Does NOT aggregate metrics (backend owns)
- Does NOT persist beyond session (backend owns)

### Activity-API (Storage & Learning Backend)

**What Activity-API Does:**
- Store activity templates persistently
- Implement Thompson Sampling (α/β scoring)
- Execute tiered fallback queries (exact → compatible → full-text)
- Compute heuristic boosts (8-point system)
- Track shape-conditioned performance
- Store execution traces for learning
- Provide tool argument recommendations
- Register with discovery-vessel (advertises 7 activity shapes)

**What Activity-API Does NOT Do:**
- Does NOT execute activities (goal-host-vessel does)
- Does NOT resolve LOCAL impulses (goal-host-vessel / local-tools-vessel do)
- Does NOT manage hooks (vessel configuration, not activity schema)
- Does NOT own resolver dispatch (goal-host-vessel does)

### Key Architectural Points

1. **Resolver Dispatch is goal-host-vessel** - The 6-step chain (local → custom → discovery → backend → fallback) lives in goal-host-vessel, not the backend. The backend is one resolver among many.

2. **Hooks are subscriber behavior** - Lifecycle reactions live in the executing vessel and its bus subscribers (per-instance customization), not the backend (portable templates). They customize how a vessel executes; activities define what work gets done.

3. **Improvisation is an Activity** - `improvise_solution.json` is stored in the backend and selected via Thompson Sampling. No special code paths.

4. **Success is reach, not exit status** - The goal-reaching gate (`verifyGoalReached`) judges whether the asked output was produced; `reached:false` drives β-penalty and in-flight recovery even when the activity returned `status=completed`.

5. **Learning is Backend, Execution is goal-host-vessel** - goal-host-vessel executes and captures; backend aggregates and learns. Per-goal paths are recorded in `goal_execution_paths` keyed by `goal_hash`.

6. **Composition Edges Link Activities** - Parent→child activity relationships are stored in the backend for learning orchestration patterns.

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
| Activity Selection | `goal-host-vessel:/run-goal` → `GoalHost.processGoal()` | goal-processor, activities, goal-reaching gate | Thompson α/β updates + per-goal `goal_execution_paths` | Meta-activity: `goal_processing_standard.json` |
| Impulse Resolution | `impulse.ts:load()` | impulse, impulse-filter | Relevance scores | No composition (resolver layer) |
| Resolver Processing | `activity.ts:execute()` | llm, tools, activity | Tool argument patterns | Activity resolver enables composition |
| Improvisation | `improviser.ts:improvise()` | improviser, template-extractor | New templates (ribosome) | Activity: `improvise_solution.json` |
| Hooks | `lifecycle-hooks.ts:register()` | lifecycle-hooks, vessel-hooks | Behavior customization | Hooks work across all composed activities |

**Composition depth:** Unlimited (recursive)
**Learning mechanism:** Thompson Sampling learns composition strategies

---

**Last Updated:** 2026-06 (re-narrated: execution moved minibob → goal-host-vessel + resolver vessels; added goal-reaching gate + in-flight recovery)
**Execution surface:** goal-host-vessel (`:8210`) + llm-resolver-vessel (`:8220`) + local-tools-vessel (`:8230`) + ribosome-vessel (`:8240`); dispatch via `mcp__metabob__run_goal`
**Architecture:** Composition-based (everything is an activity)
