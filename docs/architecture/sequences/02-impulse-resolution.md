# Impulse Resolution During Activity Execution

## Overview

This document maps the complete lifecycle of impulse resolution during activity execution, from filtering through resolution to context injection into LLM prompts. The impulse resolution system is the core data access mechanism in MiniBob, enabling metadata-first reasoning and lazy-loaded content.

## Key Concepts

1. **Relevance Filtering** - Impulses filtered by learned relevance scores before loading
2. **6-Step Resolver Dispatch** - Priority-ordered resolution chain (local → custom → discovery → MCP → fallback)
3. **Budget Enforcement** - Content truncated to fit token budgets with metadata capture
4. **Dual-Mode Formatting** - Pointer-mode (metadata only) vs content-mode (full content)
5. **Impulse Evolution Tracking** - Before/after hashes track state transitions (P3.2)
6. **State Capture** - Input/output/transition states recorded for learning
7. **Discovery Integration** - Dynamic vessel discovery for capability-based resolution

## Main Sequence Diagram: Complete Resolution Flow

```mermaid
sequenceDiagram
    actor User as Task Executor
    participant Act as ActivityExecutor<br/>(activity.ts)
    participant IF as ImpulseFilter<br/>(impulse-filter.ts)
    participant ImpStore as ImpulseStore<br/>(impulse.ts)
    participant IR as ImpulseResolver<br/>(impulse.ts)
    participant Local as LocalResolvers
    participant Disc as DiscoveryVessel
    participant MCP as MCPBackend<br/>(mcp.ts)
    participant Cache as DiscoveryCache

    User->>Act: executeTask()
    activate Act

    rect rgb(200, 220, 255)
    Note over Act,IF: PHASE 1: Impulse Filtering (Phase 1.8)<br/>Query relevance metrics if MCP enabled
    Act->>IF: Query task impulses IDs<br/>(taskImpulseIds = task.impulseReferences || impulses)
    IF->>MCP: queryImpulseRelevance(activityId, impulseIds)
    activate MCP
    MCP-->>IF: ImpulseRelevanceMetric[]
    deactivate MCP

    rect rgb(230, 245, 230)
    Note over IF: Apply Decision Rules:<br/>1. score ≥ 0.8 → always load<br/>2. irrelevance > relevance → skip<br/>3. score ≥ threshold → load<br/>4. enforce maxImpulses limit (default: 5)
    IF->>IF: filterImpulsesByRelevance(impulseIds, metrics)
    IF-->>Act: FilterResult {toLoad, toSkip, reasoning}
    end

    Note over Act: impulsesToLoad = filterResult.toLoad<br/>calculateSavings(skipped_tokens, cost)
    end

    rect rgb(255, 245, 200)
    Note over Act,ImpStore: PHASE 2: Sequential Impulse Loading<br/>Load filtered impulses with budget enforcement
    Act->>Act: loadImpulses(impulsesToLoad)
    activate Act as LoadLoop

    loop For each impulseId in impulsesToLoad
        Act->>ImpStore: load(impulseId)
        activate ImpStore

        rect rgb(255, 255, 220)
        Note over ImpStore,IR: PHASE 3: Pointer Resolution Chain<br/>Try resolvers in priority order
        ImpStore->>IR: resolvePointer(pointer)
        activate IR

        alt Step 1: LOCAL - memo (embedded content)
        IR->>IR: Check pointer.type === "memo"
        IR-->>IR: Return pointer.content

        else Step 2: LOCAL - file/directoryTree/gitDiff
        IR->>Local: Resolve file/tree/diff
        activate Local

        rect rgb(200, 255, 200)
        Note over Local: - file: read from filesystem<br/>- directoryTree: Bun.Glob() scan<br/>- gitDiff: git diff --stat<br/>- packageConfig: parse package.json<br/>- toolList: return available tools
        Local-->>IR: file_content | tree_structure | diff_output
        deactivate Local

        else Step 3: CUSTOM - registered resolvers
        IR->>IR: Check customResolvers.has(type)
        IR->>IR: resolver(pointer)
        IR-->>IR: resolver_result

        else Step 4: DISCOVERY - vessel discovery
        IR->>Disc: discoverVesselsForShape(shape)
        activate Disc

        rect rgb(200, 240, 255)
        Note over Cache: Cache TTL: 5 min<br/>Check cache first
        Disc->>Cache: Check discovery cache
        alt Cache HIT (< 5 min)
        Cache-->>Disc: CacheEntry {shape, vessels}
        else Cache MISS
        Disc->>MCP: GET /v2/vessels/discover?shape=X
        MCP-->>Disc: VesselCapability[]
        Disc->>Cache: Store {shape, vessels, cachedAt, expiresAt}
        end
        end

        Disc-->>IR: DiscoveryResult {found, vessels, shape}
        deactivate Disc

        rect rgb(240, 200, 240)
        Note over IR: Iterate through discovered vessels<br/>until one succeeds
        loop For each vessel in discovery.vessels
            alt vessel.vesselId === "metabob-activity-api" && isMCPEnabled
            IR->>MCP: mcp.resolveImpulse(pointer)
            else General case: MCP tool interface
            IR->>IR: POST {endpoint}/mcp/tools/call
            IR->>MCP: Tool: {pointer.type}_resolve<br/>Arguments: pointer
            end
            MCP-->>IR: {result: {content, metadata?}}
            Note over IR: Dynamic registration:<br/>registerResolver(type, cached_resolver)
        end
        end

        else Step 5: BACKEND - MCP fallback
        IR->>MCP: mcp.resolveImpulse(pointer)
        MCP-->>IR: content | error

        else Step 6: FALLBACK - in-memory cache
        IR->>IR: Check activityOutput store
        IR-->>IR: cached_output | throw error
        end
        end

        deactivate IR

        rect rgb(255, 230, 230)
        Note over ImpStore: PHASE 4: Budget Enforcement<br/>Truncate if over budget
        ImpStore->>ImpStore: estimateTokens(content)<br/>(4 chars ≈ 1 token)
        ImpStore->>ImpStore: Calculate:<br/>- originalTokenCount<br/>- wasTruncated = tokenCount > budget<br/>- truncationRatio = originalTokenCount / budget

        alt tokenCount > budget
        ImpStore->>ImpStore: Truncate to (budget / originalTokenCount * 90%)
        ImpStore->>ImpStore: Append "... (truncated to fit budget)"
        end

        ImpStore->>ImpStore: Store budget metadata:<br/>originalTokenCount, wasTruncated,<br/>truncationRatio, priorityLevel
        end

        rect rgb(240, 255, 240)
        Note over ImpStore: PHASE 5: Content Hashing & Metadata<br/>P3.2 - Impulse Evolution Tracking
        ImpStore->>ImpStore: captureImpulseHashes(impulsesToLoad)
        ImpStore->>ImpStore: hashes[impulseId] = Bun.hash(content)
        ImpStore->>ImpStore: Merge resolver metadata if provided<br/>(metadata.shape, metadata.rowCount, etc.)
        end

        ImpStore-->>Act: Impulse {loaded, content, tokenCount, metadata}
        deactivate ImpStore
    end
    deactivate LoadLoop
    end

    rect rgb(245, 230, 255)
    Note over Act: PHASE 6: State Capture<br/>Record input state BEFORE task execution
    Act->>Act: captureInputState(workdir, impulses, variables)
    Act->>Act: captureFileHashes(workdir, filesAvailable)
    end

    rect rgb(255, 245, 200)
    Note over Act: PHASE 7: Context Formatting & Injection<br/>Dual-mode impulse formatting
    Act->>Act: formatImpulsesForContext(loadedImpulses)
    activate Act as Format

    loop For each loadedImpulse
        alt impulse.metadata (pointer-mode)
        Note over Act: <impulse_ref id type shape<br/>row_count summary available_ops />
        else impulse.loaded && impulse.content (content-mode)
        Note over Act: <impulse id type tokens=X/Y>content</impulse>
        else unloaded + no metadata
        Note over Act: (skip - return null)
        end
    end

    Act-->>Act: <impulse_context>...impulses...</impulse_context>
    deactivate Format
    end

    rect rgb(200, 245, 200)
    Note over Act: PHASE 8: Build Prompt & Execute<br/>Inject impulse context into LLM prompt
    Act->>Act: prompt = task.prompt.template
    Act->>Act: substituteImpulses(template, impulseIds)
    Act->>Act: interpolate(prompt, variables, taskResults)
    Act->>Act: Add impulseContext to prompt head<br/>Add argumentRecommendations (Task 7.5)

    rect rgb(240, 255, 240)
    Note over Act: Tool argument recommendations<br/>(proven patterns from prior executions)
    Act->>Act: Get argumentRecommendations<br/>from backend (top 5 by success rate)
    Act->>Act: Format as context hints:<br/>- {toolName}: args (X% success, N uses)
    Act->>Act: Inject into prompt
    end

    Note over Act: Tool Filtering<br/>(goal-execution-foundation-alignment)
    Act->>Act: filterToolsForTask(allTools, task)
    Note over Act: - Check resolverRequirements.excludeTools<br/>- Validate resolverRequirements.requiredTools

    Act->>Act: llm.completeWithTools({<br/>  model: selectedModel,<br/>  messages: [system, user with impulse_context],<br/>  tools: filteredTools,<br/>  maxTokens: task.prompt.maxTokens<br/>})
    end

    rect rgb(255, 230, 230)
    Note over Act: PHASE 9: Output Impulse Creation<br/>& Trace Storage
    Act->>Act: For each tool call:<br/>- Create output impulse from result<br/>- Create argument impulse (Task 7.2/7.3)<br/>- Record tool execution data

    Act->>ImpStore: createImpulse({<br/>  id: impulseId,<br/>  pointer: {type: "memo", content: output},<br/>  budget: min(length/4, 2000),<br/>  priority: "medium"<br/>})

    Note over Act: Record metrics for learning:<br/>- impulseRelevance<br/>- toolArgumentPatterns<br/>- activityExecutionTrace
    Act->>MCP: storeImpulse(impulse)<br/>(with retry & backoff)
    Alt: Store succeeds
    MCP-->>Act: stored = true
    Else: Store fails (unavailable)
    MCP-->>Act: stored = false (cached for sync)
    end
    end

    deactivate Act
```

## Decomposition: Relevance-Based Filtering

```mermaid
sequenceDiagram
    participant Act as ActivityExecutor
    participant Filter as ImpulseFilter
    participant MCP as MCPBackend
    participant Config as Environment<br/>Config

    Act->>Filter: filterImpulsesByRelevance(impulseIds, activityId)

    Filter->>Config: Get thresholds
    Config-->>Filter: {<br/>  RELEVANCE_THRESHOLD: 0.5,<br/>  ALWAYS_LOAD_THRESHOLD: 0.8,<br/>  MAX_LOAD: 5<br/>}

    Filter->>MCP: queryImpulseRelevance(activityId, impulseIds)
    activate MCP

    alt MCP Available
        MCP-->>Filter: ImpulseRelevanceMetric[]<br/>{<br/>  impulseId,<br/>  relevance_score: 0.0-1.0,<br/>  irrelevance_score: 0.0-1.0,<br/>  contextual_factors<br/>}
    else MCP Unavailable
        MCP-->>Filter: null (fallback mode)
    end
    deactivate MCP

    Filter->>Filter: For each impulse:<br/>applyDecisionRules()

    rect rgb(240, 255, 240)
    Note over Filter: DECISION RULES (sequential)

    Filter->>Filter: Rule 1: relevance_score >= 0.8?
    alt Yes
        Filter->>Filter: → ALWAYS LOAD (high confidence)
    else No
        Filter->>Filter: Rule 2: irrelevance_score > relevance_score?
        alt Yes
            Filter->>Filter: → SKIP (better without it)
        else No
            Filter->>Filter: Rule 3: relevance_score >= threshold?
            alt Yes
                Filter->>Filter: → LOAD (meets threshold)
            else No
                Filter->>Filter: → SKIP (below threshold)
            end
        end
    end
    end

    Filter->>Filter: Enforce maxImpulses limit<br/>(sort by relevance, take top N)

    Filter->>Filter: calculateSavings(skippedImpulses)
    Note over Filter: Estimate tokens saved:<br/>skipped_tokens * $0.003 / 1000

    Filter-->>Act: FilterResult {<br/>  toLoad: impulseId[],<br/>  toSkip: impulseId[],<br/>  reasoning: {<br/>    per_impulse_decisions,<br/>    tokens_saved,<br/>    cost_saved<br/>  }<br/>}
```

**Implementation:** `repos/minibob/src/impulse-filter.ts`

**Environment Variables:**
- `IMPULSE_RELEVANCE_THRESHOLD` (default: 0.5)
- `IMPULSE_ALWAYS_LOAD_THRESHOLD` (default: 0.8)
- `IMPULSE_MAX_LOAD` (default: 5)
- `IMPULSE_FALLBACK_BEHAVIOR` (default: "load-top-n")

## Decomposition: Pointer Resolution by Type

```mermaid
graph TD
    Start([Impulse with Pointer]) --> CheckType{pointer.type?}

    CheckType -->|"memo"| Memo["LOCAL: Return embedded content<br/>latency: <1ms<br/>offline: yes"]

    CheckType -->|"file"| File["LOCAL: Read filesystem<br/>with offset/limit support<br/>latency: 10-100ms<br/>offline: yes"]

    CheckType -->|"directoryTree"| Tree["LOCAL: Bun.Glob() scan<br/>with depth limit + exclusions<br/>latency: 50-200ms<br/>offline: yes"]

    CheckType -->|"gitDiff"| GitDiff["LOCAL: git diff --stat<br/>with time range<br/>latency: 100-500ms<br/>offline: yes"]

    CheckType -->|"packageConfig"| Package["LOCAL: Parse package.json<br/>extract dependencies<br/>latency: 10-50ms<br/>offline: yes"]

    CheckType -->|"toolList"| ToolList["LOCAL: Return available tools<br/>from tool registry<br/>latency: <1ms<br/>offline: yes"]

    CheckType -->|"custom type"| Custom["CUSTOM: Registered resolver<br/>latency: variable<br/>offline: depends on resolver"]

    CheckType -->|"activityExecutionTrace"<br/>"activityTemplate"<br/>"activityMetrics"| Discovery["DISCOVERY: Query vessel discovery<br/>shape mapping → vessels<br/>latency: 100-500ms<br/>offline: no"]

    CheckType -->|"fallback"| MCPFallback["MCP BACKEND: mcp.resolveImpulse()<br/>latency: 100-300ms<br/>offline: no"]

    CheckType -->|"activityOutput"| InMemory["IN-MEMORY: Check activityOutput map<br/>latency: <1ms<br/>offline: yes (limited)"]

    Memo --> BudgetCheck
    File --> BudgetCheck
    Tree --> BudgetCheck
    GitDiff --> BudgetCheck
    Package --> BudgetCheck
    ToolList --> BudgetCheck
    Custom --> BudgetCheck
    Discovery --> BudgetCheck
    MCPFallback --> BudgetCheck
    InMemory --> BudgetCheck

    BudgetCheck{Content exceeds<br/>budget?} -->|Yes| Truncate["Truncate to budget * 0.9<br/>Store metadata:<br/>- originalTokenCount<br/>- wasTruncated<br/>- truncationRatio"]

    BudgetCheck -->|No| NoTruncate["Use full content<br/>wasTruncated = false"]

    Truncate --> Hash
    NoTruncate --> Hash

    Hash["Compute content hash<br/>for evolution tracking"] --> Return([Return loaded Impulse])

    style Start fill:#e1f5ff
    style Memo fill:#c8e6c9
    style File fill:#c8e6c9
    style Tree fill:#c8e6c9
    style Discovery fill:#fff9c4
    style MCPFallback fill:#ffcc80
    style Return fill:#b39ddb
```

## Decomposition: Discovery-Based Resolution

```mermaid
sequenceDiagram
    participant IR as ImpulseResolver
    participant Mapper as ShapeMapper
    participant Disc as DiscoveryClient
    participant Cache as DiscoveryCache
    participant Vessel as DiscoveredVessel
    participant MCP as MCPBackend

    IR->>Mapper: mapPointerTypeToShape(pointer.type)
    Note over Mapper: Shape mapping:<br/>- activityExecutionTrace → execution_trace<br/>- activityTemplate → template<br/>- activityMetrics → metrics<br/>- file → source_code
    Mapper-->>IR: shape (e.g., "execution_trace")

    IR->>Disc: discoverVesselsForShape(shape)
    activate Disc

    Disc->>Cache: getCachedVessels(shape)
    alt Cache HIT (< 5 min)
        Cache-->>Disc: VesselCapability[]
        Note over Disc: Use cached vessels
    else Cache MISS or expired
        Disc->>MCP: GET /v2/vessels/discover?shape={shape}
        MCP-->>Disc: VesselCapability[] {<br/>  vesselId,<br/>  endpoint,<br/>  shapes: [{name, operations}]<br/>}
        Disc->>Cache: storeInCache(shape, vessels, TTL=5min)
    end
    deactivate Disc

    Disc-->>IR: DiscoveryResult {<br/>  found: boolean,<br/>  vessels: VesselCapability[],<br/>  shape<br/>}

    alt Vessels discovered
        loop For each vessel (until success)
            IR->>Vessel: POST {endpoint}/mcp/tools/call
            Note over IR: Tool: {pointer.type}_resolve<br/>Arguments: pointer<br/>Timeout: 30s

            alt Success
                Vessel-->>IR: {result: {content, metadata}}
                IR->>IR: registerResolver(type, vessel_resolver)<br/>(dynamic registration for future use)
                Note over IR: ✓ Content resolved
            else Timeout or Error
                Note over IR: Try next vessel
            end
        end
    else No vessels found
        IR->>MCP: Fallback to MCP direct
    end
```

**Implementation:** `repos/minibob/src/vessel-discovery.ts`

**Configuration:**
- Discovery cache TTL: 5 minutes
- Discovery query timeout: 10 seconds
- Vessel resolution timeout: 30 seconds

## Decomposition: Dual-Mode Content Formatting

```mermaid
graph TD
    Start([Loaded Impulses]) --> Loop["For each impulse"]

    Loop --> HasMetadata{Has metadata<br/>from resolver?}

    HasMetadata -->|Yes| PointerMode["POINTER MODE<br/>(metadata-first)"]
    HasMetadata -->|No| CheckLoaded{Has loaded<br/>content?}

    PointerMode --> FormatPointer["Format as:<br/>&lt;impulse_ref<br/>  id='...'<br/>  type='...'<br/>  shape='...'<br/>  row_count='...'<br/>  summary='...'<br/>  available_ops='...'<br/>/&gt;"]

    CheckLoaded -->|Yes| ContentMode["CONTENT MODE<br/>(backward compatible)"]
    CheckLoaded -->|No| Skip["Skip impulse<br/>(not loaded)"]

    ContentMode --> FormatContent["Format as:<br/>&lt;impulse<br/>  id='...'<br/>  type='...'<br/>  tokens='X/Y'&gt;<br/>[content here]<br/>&lt;/impulse&gt;"]

    FormatPointer --> Accumulate
    FormatContent --> Accumulate
    Skip --> Accumulate

    Accumulate["Accumulate formatted strings"] --> Wrap["Wrap in:<br/>&lt;impulse_context&gt;<br/>...all impulses...<br/>&lt;/impulse_context&gt;"]

    Wrap --> Return([Return formatted context string])

    style Start fill:#e1f5ff
    style PointerMode fill:#c8e6c9
    style ContentMode fill:#fff9c4
    style Return fill:#b39ddb
```

**Pointer Mode Example:**
```xml
<impulse_ref
  id="trace-123"
  type="activityExecutionTrace"
  shape="execution_trace"
  row_count="42"
  summary="Fix login bug execution, 3 tasks completed"
  available_ops="debug,filter,aggregate"
/>
```

**Content Mode Example:**
```xml
<impulse id="file-auth" type="file" tokens=247/2000>
// src/auth.ts
export function authenticate(user: User) {
  // ... content here ...
}
</impulse>
```

**Implementation:** `repos/minibob/src/impulse.ts:742-755`

## Budget Enforcement and Truncation

### Budget Metadata Structure

```typescript
{
  originalTokenCount: number      // Tokens before truncation
  wasTruncated: boolean           // Whether truncation occurred
  truncationRatio: number         // originalTokenCount / budget
  budgetRequested: number         // Original allocation
  priorityLevel: string           // critical|high|medium|low
}
```

### Truncation Algorithm

```typescript
function enforceBudget(content: string, budget: number): {
  finalContent: string
  tokenCount: number
  wasTruncated: boolean
  metadata: BudgetMetadata
} {
  const estimatedTokens = Math.ceil(content.length / 4);

  if (estimatedTokens <= budget) {
    return {
      finalContent: content,
      tokenCount: estimatedTokens,
      wasTruncated: false,
      metadata: {
        originalTokenCount: estimatedTokens,
        wasTruncated: false,
        truncationRatio: 1.0,
        budgetRequested: budget,
        priorityLevel: impulse.priority
      }
    };
  }

  // Truncate with 10% safety margin
  const targetChars = Math.floor(content.length * budget / estimatedTokens * 0.9);
  const truncated = content.substring(0, targetChars) + "\n... (truncated to fit budget)";

  return {
    finalContent: truncated,
    tokenCount: Math.min(estimatedTokens, budget),
    wasTruncated: true,
    metadata: {
      originalTokenCount: estimatedTokens,
      wasTruncated: true,
      truncationRatio: estimatedTokens / budget,
      budgetRequested: budget,
      priorityLevel: impulse.priority
    }
  };
}
```

**Implementation:** `repos/minibob/src/impulse.ts:151-181`

## State Transition Tracking (P3.2)

### Before/After Hashing

```typescript
// BEFORE task execution
const impulseHashesBefore = {};
for (const impulseId of taskImpulses) {
  const impulse = impulseStore.get(impulseId);
  if (impulse.loaded && impulse.content) {
    impulseHashesBefore[impulseId] = Bun.hash(impulse.content);
  }
}

// AFTER task execution
const impulseHashesAfter = {};
for (const impulseId of taskImpulses) {
  const impulse = impulseStore.get(impulseId);
  if (impulse.loaded && impulse.content) {
    impulseHashesAfter[impulseId] = Bun.hash(impulse.content);
  }
}

// Calculate evolution
const impulseEvolution = {
  unchanged: impulseIds.filter(id =>
    impulseHashesBefore[id] === impulseHashesAfter[id]
  ),
  modified: impulseIds.filter(id =>
    impulseHashesBefore[id] && impulseHashesAfter[id] &&
    impulseHashesBefore[id] !== impulseHashesAfter[id]
  ),
  created: impulseIds.filter(id =>
    !impulseHashesBefore[id] && impulseHashesAfter[id]
  ),
  deleted: impulseIds.filter(id =>
    impulseHashesBefore[id] && !impulseHashesAfter[id]
  )
};
```

### State Transition Structure

```typescript
{
  inputState: {
    filesAvailable: string[]
    environment: Record<string, string>
    impulses: string[]               // Loaded impulse IDs
    variables: Record<string, unknown>
  },
  outputState: {
    filesModified: string[]
    filesCreated: string[]
    filesDeleted: string[]
    exitCode?: number
    stderr?: string
  },
  stateTransition: {
    before: Record<string, string>   // File → hash
    after: Record<string, string>    // File → hash
    workingDirectory: string
  },
  impulseEvolution: {
    unchanged: string[]
    modified: string[]
    created: string[]
    deleted: string[]
  }
}
```

## Key Configuration Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `IMPULSE_RELEVANCE_THRESHOLD` | 0.5 | Minimum relevance score to load |
| `IMPULSE_ALWAYS_LOAD_THRESHOLD` | 0.8 | Always load above this score |
| `IMPULSE_MAX_LOAD` | 5 | Maximum impulses to load per task |
| `IMPULSE_FALLBACK_BEHAVIOR` | "load-top-n" | Behavior when no metrics available |
| `DISCOVERY_ENABLED` | false | Enable vessel discovery |
| `DISCOVERY_VESSEL_ENDPOINT` | (none) | Discovery service URL |

**Fallback Behaviors:**
- `"load-all"` - Load all impulses (backward compatible)
- `"load-none"` - Skip all impulses (conservative)
- `"load-top-n"` - Load top N by priority (default)

## Performance Characteristics

| Resolution Type | Latency | Offline | Caching |
|-----------------|---------|---------|---------|
| memo (embedded) | <1ms | Yes | N/A (always instant) |
| file (local) | 10-100ms | Yes | OS file cache |
| directoryTree | 50-200ms | Yes | None |
| gitDiff | 100-500ms | Yes | None |
| packageConfig | 10-50ms | Yes | File cache |
| toolList | <1ms | Yes | In-memory |
| custom resolver | Variable | Depends | Resolver-specific |
| discovery | 100-500ms | No | 5 min TTL |
| MCP backend | 100-300ms | No | Backend-specific |
| activityOutput | <1ms | Yes | In-memory (session) |

## File References

| Component | File | Purpose |
|-----------|------|---------|
| Impulse Store | `repos/minibob/src/impulse.ts` | Core impulse lifecycle (1056 lines) |
| Filtering | `repos/minibob/src/impulse-filter.ts` | Relevance-based filtering |
| State Space Manager | `repos/minibob/src/state-space-manager.ts` | Shape querying, compatibility |
| Discovery Integration | `repos/minibob/src/vessel-discovery.ts` | Vessel discovery client |
| MCP Backend | `repos/minibob/src/mcp.ts` | Backend integration |
| Activity Executor | `repos/minibob/src/activity.ts` | Lines 2920-3110 (impulse integration) |

## Related Documentation

- [Activity Selection](./01-activity-selection.md) - How activities are chosen
- [Resolver Processing](./03-resolver-processing.md) - How resolvers use impulses
- [IMPULSE_ACTIVITY_FOUNDATION.md](../IMPULSE_ACTIVITY_FOUNDATION.md) - Foundational model
- [DISCOVERY_INTEGRATION.md](../../DISCOVERY_INTEGRATION.md) - Vessel discovery system

---

**Last Updated:** 2026-04-16
