# microplastic Architecture Design

## Context

**Current State:**
- MiniBob exists as standalone server with HTTP/WebSocket interfaces
- metabob-mcp provides code analysis tools via MCP protocol
- Activity dashboard shows execution state in web browser
- No unified terminal experience that combines execution + analysis + narrative

**Constraints:**
- Must use existing minibob library (not fork)
- Must use existing metabob-mcp analysis (not reimplement)
- Must work offline (analysis) and online (Thompson Sampling)
- Must be composable (new vessels can join later)

**Stakeholders:**
- Developers: Primary users, interact via terminal
- MiniBob: Execution engine, provides activity/impulse/ribosome
- MCP: Analysis resolver, provides CPG/embeddings
- Activity-API: Learning backend, provides Thompson Sampling

## Goals / Non-Goals

**Goals:**
- Unified terminal agent-IDE experience
- Capabilities emerge through use (gain-of-function)
- Work presented as narrative, not logs
- Extensible vessel composition

**Non-Goals:**
- Not replacing MiniBob (microplastic IS a minibob vessel)
- Not a general-purpose TUI framework
- Not a plugin system (vessels are composited at build time)
- Not an IDE (no editor, no file browser - just agent execution)

## Decisions

### Decision 1: Three-Vessel Composition in Single Process

**Choice:** Embed @metabob/minibob, @metabob/tui, and @metabob/mcp as libraries in a single Bun process. All three share a single impulse state space.

**Alternatives Considered:**
- Microservices: Each vessel as separate process with RPC
  - Pro: Process isolation, can scale independently
  - Con: Network overhead, complex deployment, harder debugging
- Plugin architecture: Load vessels as plugins at runtime
  - Pro: Dynamic extension
  - Con: Versioning nightmares, security concerns

**Rationale:**
- Single process = single impulse store = no sync issues
- Bun handles concurrent async well
- Simpler deployment (one binary)
- Can still separate later if needed (impulse store abstraction)

**Implementation:**
```typescript
// microplastic/src/index.ts
import { MiniBobCore } from '@metabob/minibob'
import { TUIRenderer } from '@metabob/tui'
import { MCPAnalysisProvider } from '@metabob/mcp'
import { ImpulseStore } from './impulse-store'

const impulseStore = new ImpulseStore()

const vessels = [
  new MiniBobCore({ impulseStore }),
  new TUIRenderer({ impulseStore }),
  new MCPAnalysisProvider({ impulseStore })
]

// All vessels share impulseStore
// Impulses flow between them via shared state
```

### Decision 2: VesselProvider Interface

**Choice:** Define a VesselProvider interface that all vessels implement. This enables composition without tight coupling.

**Interface:**
```typescript
interface VesselProvider {
  // Identity
  readonly id: string
  readonly name: string
  readonly version: string

  // Lifecycle
  initialize(context: VesselContext): Promise<void>
  shutdown(): Promise<void>

  // Capabilities
  getCapabilities(): VesselCapability[]

  // Impulse resolution
  canResolve(pointer: ImpulsePointer): boolean
  resolve(impulse: Impulse): Promise<ResolverResult>

  // Activity registration
  getActivityTemplates(): ActivityTemplate[]
}
```

**Rationale:**
- Clear contract for what vessels must provide
- Enables discovery (what can this vessel do?)
- Supports graceful degradation (if vessel can't resolve, try another)
- Future-proof for new vessels

### Decision 3: Shared Impulse State Space

**Choice:** All vessels read/write to the same ImpulseStore. Impulse resolution routes to the appropriate vessel based on pointer type.

**Alternatives Considered:**
- Isolated stores: Each vessel has its own impulse store
  - Pro: No interference between vessels
  - Con: Can't share context, duplicated data
- Message passing: Vessels exchange impulses via messages
  - Pro: Decoupled
  - Con: Async complexity, ordering issues

**Rationale:**
- Shared context is the whole point (minibob needs analysis, tui needs state)
- Resolver routing handles "who resolves what"
- Simplest mental model

**Implementation:**
```typescript
class ImpulseStore {
  private impulses: Map<string, Impulse> = new Map()
  private resolvers: Map<string, VesselProvider> = new Map()

  registerResolver(pointerType: string, vessel: VesselProvider) {
    this.resolvers.set(pointerType, vessel)
  }

  async resolve(impulse: Impulse): Promise<string> {
    const resolver = this.findResolver(impulse.pointer.type)
    if (!resolver) throw new Error(`No resolver for ${impulse.pointer.type}`)
    return resolver.resolve(impulse)
  }

  private findResolver(type: string): VesselProvider | undefined {
    // Direct match
    if (this.resolvers.has(type)) return this.resolvers.get(type)

    // Wildcard/fallback
    for (const [pattern, vessel] of this.resolvers) {
      if (vessel.canResolve({ type } as ImpulsePointer)) return vessel
    }
    return undefined
  }
}
```

### Decision 4: Resolver Routing by Impulse Type

**Choice:** Pointer type determines which vessel resolves the impulse.

**Routing Table:**
| Pointer Type | Resolver | Vessel |
|--------------|----------|--------|
| `file` | Filesystem | minibob |
| `memo` | In-memory | minibob |
| `ui_component` | Terminal renderer | tui |
| `narrative` | Story formatter | tui |
| `cpg_query` | Code graph | mcp |
| `embedding_search` | Semantic search | mcp |
| `activityExecutionTrace` | HTTP | activity-api |
| `activityTemplate` | HTTP | activity-api |
| `activityMetrics` | HTTP | activity-api |

**Rationale:**
- Pointer type already encodes "what kind of data"
- Natural extension of impulse system
- New vessels add new pointer types

### Decision 5: TUI as Narrative Engine (Not Generic Widgets)

**Choice:** The TUI doesn't render arbitrary widgets. It renders narrative: what's happening, why, and how confident the agent is.

**Alternatives Considered:**
- Generic widget system: Like internal-dashboard primitives
  - Pro: Maximum flexibility
  - Con: Complexity, unfocused UX
- Log streaming: Just show tool calls and output
  - Pro: Simple
  - Con: Not understandable, information overload

**Rationale:**
- Terminal has limited real estate
- Narrative is what users actually need
- Specific purpose > general capability

**Narrative Components:**
```
┌─────────────────────────────────────────────────────────┐
│ [Goal] Fix the authentication bug                       │
├─────────────────────────────────────────────────────────┤
│ [Thinking] Analyzing error logs...                      │
│   Found null pointer at auth.ts:42                      │
│   Similar to issue fixed in commit abc123               │
│                                                         │
│ [Confidence: HIGH] I've seen this pattern before        │
│                                                         │
│ [Action] Applying fix from template debug-null-pointer  │
│   ├─ Reading auth.ts                                    │
│   ├─ Modifying line 42                                  │
│   └─ Running tests...                                   │
├─────────────────────────────────────────────────────────┤
│ [Status] 3/5 tasks complete | 12s elapsed | $0.04       │
└─────────────────────────────────────────────────────────┘
```

### Decision 6: Gain-of-Function Cycle

**Choice:** Implement the full gain-of-function loop: goal -> execute -> trace -> extract -> learn.

**Cycle:**
```
1. GOAL: User submits goal
   └─ "Fix the authentication bug"

2. SEARCH: Thompson Sampling finds matching templates
   └─ debug-null-pointer (93% success) vs generic-debug (61%)

3. EXECUTE: Run selected activity
   └─ Tasks execute, tools called, state changes

4. TRACE: Record full execution trace
   └─ Input impulses, steps, output impulses, state transition

5. EVALUATE: Check if goal achieved
   └─ Success: increment alpha | Failure: increment beta

6. EXTRACT (on improvisation success): Ribosome creates template
   └─ New activity registered with alpha=1, beta=0

7. LEARN: Pattern recognition improves future selections
   └─ Impulse relevance, tool sequences, composition patterns
```

**Why This Matters:**
On day 1, microplastic might improvise 80% of goals. By day 30, it might have extracted 50+ templates and improvise only 20%. Capabilities emerge from use.

### Decision 7: Bootstrap Templates (Immutable Primordials)

**Choice:** Ship with a hierarchy of bootstrap templates that provide core capabilities. Level 0 templates are immutable.

**Hierarchy:**
- **Level 0: Primordial** - Cannot be modified or overridden
  - `create-activity-template` - Creates new templates from traces
  - `execute-goal` - The goal execution meta-activity
  - `validate-template` - Validates template structure

- **Level 1: Meta** - Templates that create templates
  - `extract-from-trace` - Ribosome extraction
  - `create-variant` - Creates variants from failed executions

- **Level 2: Spec Generation** - Create specifications
  - `generate-implementation-spec` - Create implementation plans
  - `generate-test-spec` - Create test specifications

- **Level 3: Core Development** - Common development tasks
  - `implement-feature` - Implement from spec
  - `fix-bug` - Debug and fix issues
  - `refactor-code` - Refactor patterns

- **Level 4: TUI Choreography** - Control the narrative
  - `update-narrative` - Update what's shown to user
  - `request-clarification` - Ask user for input

**Rationale:**
- Ensures core capabilities are always available
- Prevents accidental self-destruction
- Lower levels can create higher levels (meta-programming)

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                       microplastic                            │
│                    (Single Bun Process)                       │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Shared Impulse Store                  │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │  │
│  │  │  goal   │  │  file   │  │   ui    │  │   cpg   │   │  │
│  │  │ impulse │  │ impulse │  │ impulse │  │ impulse │   │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │  │
│  └───────┼────────────┼────────────┼────────────┼────────┘  │
│          │            │            │            │            │
│  ┌───────┴───────┐ ┌──┴───┐ ┌─────┴─────┐ ┌────┴────┐     │
│  │   MiniBob     │ │MiniBob│ │    TUI    │ │   MCP   │     │
│  │  (execution)  │ │(file) │ │(narrative)│ │(analysis)│    │
│  └───────────────┘ └───────┘ └───────────┘ └─────────┘     │
│          │                          │            │          │
│  ┌───────┴───────────────────────────────────────┴───────┐ │
│  │                     Activity-API                       │ │
│  │  (Thompson Sampling, Traces, Patterns, Learning)       │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

**Risk: Single process = single point of failure**
- Mitigation: Graceful degradation - if MCP crashes, minibob continues without analysis
- Trade-off: Accepted for simplicity

**Risk: Shared impulse store = potential conflicts**
- Mitigation: Impulse IDs are UUIDs, no overwrites, only creates
- Trade-off: More memory usage (no deduplication)

**Risk: Bootstrap templates become stale**
- Mitigation: Level 0 is minimal, higher levels can evolve
- Trade-off: Some templates may need manual updates on major changes

**Risk: TUI complexity explodes**
- Mitigation: Narrative-only focus limits scope
- Trade-off: Can't do everything internal-dashboard can

**Trade-off: Library embedding vs standalone**
- Chose embedding for simplicity
- Limits deployment options (can't run minibob separately)
- Future: Could extract ImpulseStore to shared service

## Data Flow Example

User types: "Fix the auth bug in src/auth.ts"

```
1. Input parsed as goal impulse
   { pointer: { type: "goal" }, content: "Fix the auth bug..." }

2. TUI shows: "[Thinking] Understanding your request..."
   { pointer: { type: "narrative" }, content: "Understanding..." }

3. MiniBob enriches goal (LLM call)
   { pointer: { type: "goal_enrichment" }, content: { intent: "bugfix", ... } }

4. Activity-API called for recommendations
   GET /v2/activities/recommend?goal=...
   Returns: [{ id: "debug-null-pointer", score: 0.93 }, ...]

5. TUI shows: "[Selecting] debug-null-pointer (93% success rate)"
   { pointer: { type: "narrative" }, content: "Selecting template..." }

6. MiniBob requests code analysis
   { pointer: { type: "cpg_query" }, params: { file: "src/auth.ts" } }

7. MCP resolves CPG impulse
   Returns: { nodes: [...], edges: [...], analysis: "null check missing" }

8. MiniBob executes activity tasks
   - Task 1: Analyze error (LLM)
   - Task 2: Locate bug (file read)
   - Task 3: Generate fix (LLM)
   - Task 4: Apply fix (file write)
   - Task 5: Validate (test run)

9. TUI shows progress for each task
   { pointer: { type: "narrative" }, content: "Task 2/5: Locating bug..." }

10. Execution completes, trace stored
    POST /v2/traces { ... full execution data ... }

11. TUI shows: "[Complete] Bug fixed, tests passing"
    { pointer: { type: "narrative" }, content: "Success!" }

12. Thompson Sampling updated
    activity "debug-null-pointer": alpha += 1
```

## Related Documentation

- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Core model
- `repos/minibob/src/lib.ts` - Library entry point
- `repos/minibob/src/types.ts` - Type definitions
- `repos/metabob-mcp/src/` - MCP analysis tools
- `openspec/changes/internal-dashboard/design.md` - UI impulse patterns
