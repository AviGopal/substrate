# Vessel and Impulse Foundations

> **Status**: Working notes from exploration session
> **Date**: 2026-03-27
> **Context**: Reviewing ACP protocol, removing it, clarifying foundational concepts

---

## Decision: Remove ACP ✅ COMPLETED

ACP (Activity Communication Protocol) has been **removed** (2026-03-27). It was an RPC-style vessel-to-vessel communication pattern that didn't align with the foundation:

**Files deleted:**
- `repos/minibob/src/acp.ts`
- `repos/minibob/src/acp-gossip.ts`
- `repos/minibob/src/cli/acp-server.ts`

**Files updated:**
- `repos/minibob/src/types.ts` - ACP types removed
- `repos/minibob/src/lib.ts` - ACP exports removed
- `openspec/meta/terminology-glossary.md` - ACP marked as REMOVED
- `openspec/changes/schema-paradigm-alignment/specs/resolution-protocol.md` - ACP removed from hierarchy

**Why it was removed:**

- ACP treated vessels as services that call each other
- Foundation says vessels share impulse spaces, not direct calls
- ACP bypassed activity selection, trace recording, and learning
- ACP made vessels dependent on knowing about each other

**Replacement**: Shared impulse spaces with resolution routing (see below).

---

## What is a Vessel?

A vessel is a **resolution domain** - the context in which certain types of data can be accessed and certain types of operations can be performed.

```
Vessel = Resolvers + Environment + Identity

Resolvers:    What pointer types can I access?
Environment:  What credentials/connections do I have?
Identity:     Who am I for trace attribution?
```

### Where Vessels Reside

Vessels exist where their resolution capabilities exist:

| Resolver Type | Vessel Must Have Access To |
|---------------|---------------------------|
| `file` | Filesystem (mounted volume, local disk) |
| `sql` | Database credentials |
| `llm` | API keys |
| `cpg` | Code analysis engine |
| `sensor` | Hardware connection |
| `trace` | Backend connection |

The vessel doesn't choose where to run. Its resolution capabilities determine where it *can* run.

### Mental Model Shift

**Old**: "A vessel is an AI agent that does things"

**New**: "A vessel is a resolution context that enables activities to execute by providing access to data"

The vessel doesn't DO the activity. The vessel ENABLES the activity by resolving the impulses the activity needs.

---

## Impulse Slice Management

Each task in an activity needs a specific slice of available impulses. This is determined by:

### 1. Activity Template (Design Time)

The template explicitly specifies what each task needs:

```typescript
tasks:
  - id: "analyze"
    inputs:
      - ref: "$error_log"      // Explicit reference
      - ref: "$test_file"
    resolver: "llm"

  - id: "locate"
    inputs:
      - ref: "$analysis"       // Output from previous task
      - ref: "$source_code"
    resolver: "code_search"    // NOT LLM - deterministic
```

### 2. Memory Agent (Runtime)

When the explicit slice exceeds token budget, memory agent reduces based on learned relevance:

```
Task needs: A, B, C, D, E (6500 tokens)
Budget: 4000 tokens

Relevance scores (learned from traces):
  A: 0.92, B: 0.88, C: 0.71, D: 0.45, E: 0.23

Keep: A, B, C (4100 tokens)
Drop: D, E (recorded for learning)
```

### 3. NOT the LLM

The LLM does not decide what context to load. The activity template specifies it. This is deterministic and learnable.

---

## Resolution Flow

### Preparation Phase (Before Execution)

```
1. Activity selected (Thompson Sampling)
2. Input impulses identified (from inputSchema)
3. All impulse refs collected from all tasks
4. Each impulse routed to appropriate resolver:
   - Local vessel resolvers (file, memo)
   - Backend (trace, template, metrics)
   - Other registered resolvers
5. Content loaded into impulses
6. Fully-loaded impulse set passed to activity
```

### Execution Phase

Activity executes with pre-resolved impulses. Resolution during execution is rare (only for dynamic refs).

---

## Why LLM is Often Not Needed

### LLM IS Needed For:
- Reasoning about ambiguous input
- Generating novel text/code
- Improvisation (no matching activity)
- Tasks explicitly marked `resolver: "llm"`

### LLM is NOT Needed For:
- Activity selection (Thompson Sampling)
- Impulse slice determination (activity template)
- Impulse resolution (pointer → content)
- Deterministic transformations (parse, format, query)
- Code search (AST/grep)
- Test execution
- File operations
- Database queries

### Target Ratio (Mature System)

```
~20% of tasks use LLM (reasoning/generation)
~80% of tasks use deterministic resolvers

Current state (everything is improvisation):
~95% LLM
~5% deterministic
```

---

## Impulse Taxonomy

### Content Types

| Category | Examples | Resolver |
|----------|----------|----------|
| **Text/Documents** | File, memo, URL, git blob | file, memo, http, git |
| **Structured Data** | JSON, SQL result, API response | memo, sql, http |
| **Code Artifacts** | Source, AST, CPG, diff | file, ast, cpg, git |
| **Execution Artifacts** | Trace, template, metrics | trace (backend) |
| **Signals/Events** | User intent, trigger, sensor | memo, event, hardware |

### Impulse Lifecycle

```
1. CREATION    - Pointer only, no content
2. RESOLUTION  - Content loaded via resolver
3. INJECTION   - Formatted for task context
4. OUTPUT      - New impulse from task result
```

---

## Key Reframes

| Old Model | New Model |
|-----------|-----------|
| LLM orchestrates everything | Activity template orchestrates; LLM is one resolver |
| Vessel "does" things | Vessel "enables" things via resolution |
| Vessels call each other (ACP) | Vessels share impulse space |
| Context is whatever LLM decides | Context is what template specifies |
| Resolution during execution | Resolution in preparation phase |
| Every execution is improvisation | Most tasks are deterministic |

---

## Open Questions

1. **Vessel Composability**: How do vessels compose like activities and impulses do?
2. **Distributed Impulse Spaces**: How do impulses flow between vessels in different processes?
3. **Resolution Routing**: Who coordinates resolution across multiple vessels?
4. **Backend Role**: Is the backend the natural federation layer for impulse spaces?
