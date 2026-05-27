# Discovery-to-Tools Bridge

Status: draft (spec only — implementation pending).
Owners: minibob, discovery-vessel, concept-db, activity-api.
Companion to the resolver-contract work (`packages/vessel-discovery-client/src/types.ts:99-213`)
and the impulse-write resolver path (`docs/specs/impulse-write-resolver.md`).

## Problem

Wave 1 closed the **resolver path**: minibob can call any vessel that
advertises `resolve_endpoint`/`resolve_request_format`/`auth_scheme`/
`resolve_timeout_ms` to load impulse content, with zero per-vessel code
in minibob (`repos/minibob/src/vessel-discovery.ts:481-524`).

The **tool path** is still hardcoded. The LLM tool list comes from
`getAllToolDefinitions` (`repos/minibob/src/tools.ts:1732-1750`), which
returns only minibob's built-in handlers (`bash`, `read`, `write`,
`edit`, git, etc.) plus any optional `workspace-vessel` tools and
`config.customTools` passed by the caller. There is no pathway by which
a vessel discovered at runtime — concept-db, activity-api, a future
vessel — can contribute tools the LLM is allowed to call directly.

The concrete consequence:
`templates/concept-learning/learn-impulse-relationships.json` task 3
(`upsert-signature-concepts-and-base-edges`, lines 88-119) tells the
LLM to call `concept_upsert_by_signature` and `concept_link`. Those
tools exist on concept-db
(`repos/concept-db/src/tools/definitions.ts:25-306`, exposed via
`POST /mcp/tools/call` at `repos/concept-db/src/routes/mcp.ts:49-93`),
but the LLM in minibob never sees them in its tool list, so it either
improvises bash `curl` calls (brittle, often wrong shape) or silently
degrades. The whole "ribosome refines edges" loop is broken until the
bridge exists.

A naïve fix is to pull every discovered vessel's tools into the LLM's
tool list at startup. **That doesn't scale.** The target deployment is
a network with 10000s of vessels, each potentially advertising 5-20
tools. Eagerly loading 100,000+ tool definitions per minibob session
would: (a) blow the LLM's tool-list context budget (Anthropic's hard
limit is ~256 KB of tool JSON before degradation kicks in); (b) make
selection essentially random — the LLM can't reliably pick from
100,000 options; (c) couple every vessel join/leave to every minibob's
LLM context. A naïve push model is structurally wrong, not just
inefficient.

The system already has the right machinery to avoid this: the
**impulse-activity foundation**. Impulses carry metadata; the executor
asks "what is relevant for this task" and resolvers respond with the
impulses that match; Thompson Sampling and EMA-relevance pick winners
within the candidate set. We should reuse that, not invent a parallel
"tools registry" alongside it.

This spec defines tools-as-impulses: a vessel's tool is an impulse
with shape `mcpTool`, advertised through the existing shape-discovery
contract, queried per-task through the existing `POST /v2/impulses/resolve`
path, and ranked through the existing relevance-scoring machinery.

## Constraints

- **Foundation alignment.** Tools must travel through the same plumbing
  as everything else: impulses with metadata, resolvers where data
  lives, Thompson Sampling for selection, EMA relevance for learning.
  See `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` principles 1, 3,
  4, 6. **No new global registry** of tools owned by minibob.
- **Scale to 10000s of vessels × N tools each.** A typical task should
  surface tens of relevant tools to the LLM, not thousands. The wire
  cost per task should be `O(relevant)`, not `O(network)`.
- **No regressions on the resolver path.** Wave 1's
  `resolve_endpoint`/`auth_scheme` contract stays untouched. The new
  field is additive, optional, ignorable by older clients.
- **Backward compatible.** Vessels that don't advertise tool impulses
  keep working. concept-db's `GET /mcp/tools` and `POST /mcp/tools/call`
  endpoints stay exactly as-is — they're the human-facing MCP surface
  (metabob-mcp, IDE integrations) and are not what the bridge replaces.
  See `repos/concept-db/src/routes/mcp.ts`.
- **One mechanism, not two.** Today minibob has both `vessel-registry.ts`
  (legacy `/v2/vessels/*`, deprecated until July 2026) and
  `vessel-discovery.ts` (Wave 1 contract). The bridge plugs into the
  latter only.
- **MCP backend delegation stays as a fallback.** `getMCPClient` /
  `isMCPEnabled` (`repos/minibob/src/mcp.ts:3209-3247`) remain the
  legacy escape hatch for activity-api specifically.
- **Tool-filtering preserved.** `filterToolsForTask`
  (`repos/minibob/src/activity.ts:221-252`) keeps working — the
  candidate set it filters is now per-task instead of global.
- **Coordinate with the impulse-write spec.** Many tools are write
  operations. The write spec proposes that those *also* become impulse
  shapes (`conceptLink_write`, etc.). This spec is about **how minibob
  finds and chooses** tool impulses; the write spec is about **what
  those tool impulses look like and how vessels execute them**. The
  two are complementary — see "Relationship to impulse-write resolver"
  below.

## Design alternatives

### A. Eager bolt-on (the prior version of this spec)

Vessel registers with `tools: VesselToolDescriptor[]` embedded in the
register payload. Discovery persists it. minibob walks the cache at
startup, namespaces every tool, registers all of them as
`ToolDefinition` for every LLM call.

- Pro: One round trip per discovery cache miss, simple wiring.
- Con: **Doesn't scale.** With 10000 vessels × 10 tools = 100k tools.
  LLM context blown, selection degraded, every vessel churn flushes
  every minibob's context.
- Con: Parallel mechanism. Tools become a special kind of advertisement
  rather than first-class data the system already knows how to reason
  about.
- Con: No selection signal. The LLM sees every tool every time;
  Thompson Sampling can't help because the candidate set is the
  whole network.

**Rejected.** This was the design in the previous revision of this
spec; it's the rejection-baseline for the redesign.

### B. Tools-as-impulses, on-demand resolution (recommended)

A tool is an impulse of shape `mcpTool`. The vessel that owns the tool
advertises that it resolves `mcpTool` via the standard
`shapes` array on registration. When minibob is about to run a task,
it builds a context query (declared input/output shapes, goal text,
recent successes), calls `POST /v2/impulses/resolve` against
discovery to find vessels-that-resolve-`mcpTool`-for-this-context,
collects the returned tool impulses, and presents the (small,
ranked) result to the LLM.

- Pro: Reuses every existing primitive — discovery, impulse-resolve,
  Thompson Sampling, EMA relevance.
- Pro: Wire cost per task is `O(relevant)`, not `O(network)`. Vessels
  with no relevant tools are never queried.
- Pro: Selection signal is real. Each tool invocation is already an
  event in the trace; `impulseRelevance_write` (per the impulse-write
  spec) feeds back into the same EMA scorer that ranks every other
  impulse. After N executions, frequently-successful tools rise to the
  top of the candidate set automatically.
- Pro: No new global registry; no namespacing required.
- Con: Per-task latency hit (one resolve round trip before the LLM
  call). Mitigated by caching at the vessel-discovery layer (already
  5 min) and by caching the resolved tool list per-task (1 hop reuse
  inside an activity).
- Con: Cold-start: the very first run for a new task has no usage
  history; the candidate set comes from declared-shape match alone.
  Acceptable — the cold-start is one-shot.

**Recommended.** Walked end-to-end below.

### C. Hybrid: eager-cache popular tools, on-demand for the long tail

Every minibob keeps a cache of the top-K tools by global relevance
(say K=100) and resolves the rest on demand.

- Pro: No per-task latency for the popular path.
- Con: "Global relevance" is meaningless without a task context — what's
  popular for goal A is irrelevant for goal B. Either we commit to
  context-aware ranking (which is just option B) or we ship a
  semantically-empty top-K.
- Con: More machinery (cache invalidation, top-K computation).

**Rejected.** Revisit if option B's per-task latency turns out to be
a real cost in practice.

## Recommended design

**Tools are impulses of shape `mcpTool`. Vessels resolve them via the
existing impulse-resolve contract. Selection per task uses existing
relevance-scoring + Thompson Sampling primitives.**

### The `mcpTool` impulse shape

A single tool is one impulse. Its content is the tool's definition
(name, description, JSONSchema input). Its metadata carries the
vessel binding and how to invoke it.

```typescript
// Impulse content (what the resolver returns under `content`)
interface McpToolContent {
  name: string                   // Plain name, no namespacing.
  description: string            // Shown verbatim to the LLM.
  inputSchema: {                 // JSONSchema; fits Anthropic's
    type: "object"               // input_schema directly.
    properties: Record<string, unknown>
    required?: string[]
  }
}

// Impulse metadata
interface McpToolMetadata {
  shape: "mcpTool"
  vessel_id: string              // Where this tool lives.
  call_endpoint?: string         // Default: "/mcp/tools/call".
  call_request_format?: "mcp-tool"  // For future format variants.
  // Standard relevance fields populated by the relevance-scoring path:
  relevance?: number             // EMA-updated success rate.
  times_loaded?: number
  times_succeeded?: number
  // Free-form match hints (set by the resolver):
  matched_input_shapes?: string[]    // Shapes this tool produces from.
  matched_output_shapes?: string[]   // Shapes this tool produces.
  summary?: string               // One-line summary for ranking display.
}
```

The **tool name stays plain**. No `vesselId_toolName` namespacing. The
LLM dispatches by name; minibob's per-task tool list is small (tens at
most), so collisions are rare; when they do occur, the dispatch table
already knows which vessel owns each name (it's in the impulse
metadata) — see "Collisions" below.

### How a vessel produces tool impulses

A vessel that owns MCP tools advertises `mcpTool` in its
`config.discovery.shapes` (the same array that lists every other
shape it resolves). It then handles `POST /v2/impulses/resolve`
with `pointer.type = "mcpTool"` like any other shape.

The resolver implementation is thin: the vessel already knows its
tool definitions (e.g. `conceptTools` in
`repos/concept-db/src/tools/definitions.ts:25`), so the resolver
walks that list, scores each tool against the request's context
fields, and returns matching tools as a list of impulses. Each tool
returned is one `{content, metadata}` pair.

Concretely for concept-db: a new case in
`repos/concept-db/src/routes/impulses.ts` for `pointer.type === "mcpTool"`
that takes the pointer's context fields, scores each entry in
`conceptTools`, and returns the top-N matches (e.g. N=20). See
"Resolver scoring" below.

A vessel can also choose to advertise `mcpTool` lazily — only when it
receives a query for it — which means the contract addition is
**zero new fields** beyond the existing `shapes` array.

### What a `mcpTool` resolution request looks like

The pointer carries the context the resolver needs to score:

```typescript
interface McpToolPointer {
  type: "mcpTool"
  // Activity-context filters; all optional, AND-combined:
  goal_keywords?: string[]       // E.g. ["upsert", "concept", "edge"].
  input_shapes?: string[]        // Shapes the task's inputs will have.
  output_shapes?: string[]       // Shapes the task is expected to produce.
  task_description?: string      // Free text, ribosome may keyword-extract.
  task_id?: string               // For per-task usage replay.
  prior_template_id?: string     // For Thompson Sampling per-template tools.
  // Result-shaping:
  limit?: number                 // Max tools to return (default 20).
  min_relevance?: number         // Default 0 (cold-start friendly).
}
```

A request flows through discovery the same way every other resolve
request does:

1. Minibob asks discovery: "who resolves shape `mcpTool`?" Discovery
   returns the list of vessels that include `mcpTool` in their
   `shapes` array.
2. For each candidate vessel, minibob sends the same `mcpTool`
   pointer to that vessel's `resolve_endpoint`. Each vessel returns
   the subset of *its own* tools that match the context.
3. Minibob merges, applies a final pass of cross-vessel ranking
   (relevance-scoring), trims to `limit`, and presents.

This is exactly the topology of every other multi-vessel impulse
resolution in the system — fanout to vessels-that-resolve-this-shape,
each vessel filters its own data, minibob ranks across the union.

### Resolver scoring (vessel-side)

Each vessel runs its own scoring function over its tool list. The
inputs are the `mcpTool` pointer fields above plus the vessel's local
state (its tool definitions, plus any per-tool relevance EMA it
maintains for *its own* invocations).

A reasonable starting scoring function, in pseudocode:

```
score(tool, pointer) =
  0.4 * shape_match(tool, pointer.input_shapes, pointer.output_shapes)
+ 0.3 * keyword_match(tool, pointer.goal_keywords, pointer.task_description)
+ 0.3 * (relevance_ema_for_tool ?? 0.5)   // 0.5 = uninformed prior
```

`shape_match` is Jaccard between the tool's declared input/output
shapes (a future small extension to `MCPTool`; today, omit and treat
as 0) and the pointer's. `keyword_match` is bag-of-words overlap
between the tool's name+description and the pointer's keywords.
`relevance_ema_for_tool` is the per-(tool, org) EMA maintained by
`recordUsage` once an `mcpToolUsage_write` (or equivalent) is wired
up (see "Relationship to impulse-write resolver" below).

The exact weights are not load-bearing; they get tuned the same way
every other heuristic in the system gets tuned: by the learning loop,
via Thompson Sampling on tool-selection variants.

For concept-db, even a trivial scorer (return all `conceptTools`
when the pointer mentions "concept" or any concept-relevant keyword;
empty otherwise) is enough to unblock `learn-impulse-relationships`
task 3.

### Selection on the minibob side (cross-vessel ranking)

After fan-out, minibob has a flat list of `mcpTool` impulses from
multiple vessels. It applies one pass of cross-vessel ranking before
trimming to `pointer.limit`:

```
final_score(tool_impulse) =
    vessel_returned_score
  + global_ema_for_(tool_name, vessel_id)
  + thompson_sample_for_(template_id, tool_name)
```

`global_ema_for_(tool_name, vessel_id)` is the EMA tracked across all
templates and orgs, lives in concept-db (or activity-api) as a
relevance impulse, and is updated through the same
`impulseRelevance_write` path the rest of the system uses.

`thompson_sample_for_(template_id, tool_name)` plugs into the
existing `thompson-sampling.ts` machinery. Today that file ranks
**activity templates**. Extending it to rank **(template, tool)
pairs** as a second channel is additive: the (alpha, beta) state
moves into a `tool_arm` table or composite impulse, and
`computeThompsonSamplingUpdates` is reused with the same
`(executionSuccess, shapeMatchScore)` inputs (where
`shapeMatchScore` is re-purposed as "did the tool's actual output
shape match its declared output shape"). Same primitive, second
channel; this is what "reuse, don't reinvent" means.

Ship without the Thompson channel initially — the EMA-relevance term
alone is enough to bias selection within a few executions per
template. Add the Thompson channel only if EMA proves too noisy;
flag it as an open question rather than initial scope.

### When does minibob query for tools?

**Per task, before LLM dispatch.** Granularity rationale:

- Per-session is too coarse: a session may run many activities with
  very different tool needs.
- Per-activity is borderline: a 5-task activity probably benefits
  from the *same* tools across tasks, but cheap to re-query and the
  cache makes it almost free.
- Per-task is the right granularity for selection: each task already
  has its declared `inputShapes`/`outputShapes`/prompt, which is the
  exact signal the resolver scores against. The query result can be
  cached for the rest of the activity (since context typically
  shifts only at task boundaries).

The hook lives in `repos/minibob/src/activity.ts` at the spot where
tool definitions are merged for the task's LLM call (~line 4988-5007,
where `wrappedHandlers` is built). Replace the static `getAllToolDefinitions()`
read with a `await getDiscoveredToolsForTask(task, activityContext)`
that returns a per-task tool list. Built-in tools (`bash`, `read`,
`write`, etc.) are concatenated as today.

The activity-level executor-hooks spec (`docs/specs/activity-level-executor-hooks.md`)
describes the natural insertion point; the bridge plugs into the
"pre-task" hook.

### Concrete walkthrough: `learn-impulse-relationships` task 3

Today (broken):

1. Task 3's prompt tells the LLM to call `concept_upsert_by_signature`
   and `concept_link`.
2. minibob builds the LLM call with `getAllToolDefinitions()`. Those
   names are not in the list.
3. LLM either guesses with `bash curl` calls (brittle) or skips the
   step (template fails validation).

Under the new design:

1. Activity executor reaches task 3. Before LLM dispatch, it builds
   a `mcpTool` pointer:
   ```
   { type: "mcpTool",
     goal_keywords: ["upsert", "signature", "concept", "link", "edge"],
     input_shapes: ["impulseCooccurrenceMatrix"],
     output_shapes: ["concept", "concept_edge"],
     task_description: "<task 3 prompt template>",
     prior_template_id: "learn-impulse-relationships",
     limit: 20 }
   ```
2. minibob asks discovery for vessels resolving `mcpTool`. Discovery
   returns `[concept-db, activity-api, …]` (whichever vessels have
   advertised `mcpTool` in their shapes).
3. minibob fans out the pointer to each candidate vessel via the
   existing `resolveImpulse` plumbing.
4. concept-db's resolver scores its 9 tools against the pointer. The
   "concept" / "edge" keyword overlap pushes
   `concept_upsert_by_signature`, `concept_link`,
   `concept_create`, `concept_neighbors`, `concept_search`,
   `concept_cooccurrence_edges`, `concept_record_usage`,
   `concept_resolve`, `concept_sequence_record` to the top — likely
   all 9 are candidates, ranked by overlap.
5. activity-api returns 0-2 tools at most (none of activity-api's
   write surface keyword-matches "concept", though
   `activityFeedback_write` might tangentially).
6. minibob merges, ranks, trims to 20. Final list ≈ 9 concept-db
   tools + 0-2 activity-api tools + 7-8 minibob built-ins
   (`bash`, `read`, `write`, `edit`, `git`, etc., kept always).
   **Total: ~16-19 tools** in the LLM's tool list — well within the
   "tens, not thousands" target.
7. LLM calls `concept_upsert_by_signature` and `concept_link` by
   plain name. Dispatch table (built from the impulse metadata)
   knows the call lives at concept-db's `/mcp/tools/call`.
8. After the activity completes, `impulseRelevance_write`-style
   feedback updates the per-(template, tool) EMA. Next time
   `learn-impulse-relationships` runs task 3, those two tools rank
   higher; the long-tail concept-db tools that weren't called
   slowly fall.

End-to-end, no auto-registration, no global tool list, no
namespace prefixes — just the existing impulse-activity pipeline,
applied to tools.

### Tool dispatch (after the LLM picks one)

The LLM emits `tool_use { name: "concept_upsert_by_signature", input: {...} }`.
The dispatch table built per task (alongside the tool list) maps tool
name → vessel binding from the impulse metadata. Dispatch:

```
POST ${vessel.endpoint}${tool.metadata.call_endpoint ?? "/mcp/tools/call"}
Headers: Content-Type: application/json
         + auth per vessel.auth_scheme (resolver-path mechanism)
Body: { tool: "concept_upsert_by_signature", arguments: <input> }
```

This is exactly the `POST /mcp/tools/call` shape concept-db already
supports. No new endpoint needed.

The result is wrapped into a `ToolResult` and recorded into
`resolution-tracker.ts` with `resolver_id = "VesselClient"`,
`resolver_tier = "DISCOVERY"`, `vessel_id = <vesselId>` so existing
trace fields populate.

### Collisions

With small per-task tool lists and metadata-carried vessel bindings,
collisions are rare and easy to handle:

- **Same tool name, different vessels in candidate set**: the dispatch
  table is keyed by tool name. On collision, prefer the higher-ranked
  candidate; log a warn. If the LLM needs to disambiguate, the
  resolver returns one of them as `<name>` and the other as
  `<vessel_id>__<name>` (double-underscore, Anthropic-tool-name-safe).
- **Same vessel, duplicate tool**: vessel bug; resolver dedupes,
  warn-logs.

The previous spec's eager namespacing (`concept-db_concept_link`)
becomes unnecessary because the dispatch is per-task and the LLM
sees a small list. Defer disambiguation to the cases where it's
actually needed.

### Relationship to impulse-write resolver

The impulse-write spec (`docs/specs/impulse-write-resolver.md`)
proposes that several concept-db tools become **write-shape impulses**:
`conceptLink_write`, `conceptSignatureUpsert_write`, etc. Two
approaches stack cleanly:

1. The `mcpTool` resolver is the **discovery and selection** layer:
   "what tools are relevant to this task?"
2. The write-shape impulses are the **invocation** layer for tools
   that mutate state: "call this tool by resolving its `_write`
   pointer."

Both paths coexist:
- Read-shaped tools (e.g. `concept_search`) and pre-write-spec tools
  (`concept_upsert_by_signature` before its write-shape exists)
  are dispatched via `POST /mcp/tools/call`.
- Tools that have a `_write` shape can be dispatched two ways: as
  an MCP tool call (legacy) or by resolving the `_write` pointer
  directly (preferred once available). Both produce the same trace
  shape; the latter integrates better with the resolver-tier
  accounting because every step is one impulse-resolve.

The `mcpTool` selection layer doesn't care which dispatch path is
used — it returns tool impulses; the LLM picks one; the dispatcher
chooses the wire format based on whether the tool name corresponds
to a known `_write` shape. Long-term, every tool-that-mutates becomes
a `_write` shape and this branch collapses; both paths exist initially.

The write spec ships standalone; this spec doesn't depend on it.

### Tool filtering

`filterToolsForTask` (`repos/minibob/src/activity.ts:221-252`) keeps
working unchanged. Its `excludeTools`/`requiredTools` lists operate
on the per-task tool list, which already includes only the relevant
discovered tools plus built-ins. A task that wants to forbid
`concept_link` says `excludeTools: ["concept_link"]`; a task that
requires it says `requiredTools: ["concept_link"]`.

No wildcard syntax extensions needed — the per-task list is small
enough that name-level filtering is precise.

### Backward compatibility

- concept-db's `GET /mcp/tools` and `POST /mcp/tools/call` routes are
  untouched. metabob-mcp and IDE callers keep working.
- Vessels that don't advertise `mcpTool` in their shapes are
  ignored by the bridge. Their tools simply don't appear in any
  task's tool list.
- minibob without bridge support (older deployment) sees no
  difference: discovery returns vessels for `mcpTool`, but minibob's
  built-in tool path ignores them and the LLM gets the static
  `getAllToolDefinitions()` list as today. Forward-compat is via
  feature detection in minibob (see "Implementation outline" → minibob).

### Scale check: 10000 vessels × 10 tools each

Walk through the worst case:

- Discovery `resolve` for shape `mcpTool` returns the list of vessels
  that advertise `mcpTool`. **Not all 10000 vessels do** — only
  vessels that own MCP tools. For a typical deployment that's
  concept-db, activity-api, perhaps a memory vessel, perhaps an
  analysis vessel — call it 10-100 vessels with `mcpTool` in their
  shapes.
- Minibob fans out the `mcpTool` pointer to those 10-100 vessels.
  Each vessel scores its own tools (say 10-20 each), returns the
  top-N (default cap N=20). Worst-case payload: 100 vessels × 20
  tools = 2000 tool impulses crossing the wire.
- minibob ranks across 2000, trims to `pointer.limit` (default 20).
  LLM tool list ends up at 20 + ~7 built-ins = ~27 tools.
- **Total LLM tool-list size for any task: tens, not thousands.**
- Per-task latency: 1 discovery query (cached 5 min, so ~free
  steady-state) + 10-100 parallel resolver fanouts (each typically
  <50ms because each vessel just scores its own list). End-to-end
  added latency: ~100-200ms p99, dominated by the slowest resolver.

If the fanout count grows unwieldy, add a `limit_vessels` field on
the discovery query so minibob asks for only the top-K vessels by
recent relevance. That's a future extension.

### What this unblocks today

Activities that already depend on the bridge and silently fail
without it:

- `templates/concept-learning/learn-impulse-relationships.json` task 3
  (lines 88-119): `concept_upsert_by_signature`, `concept_link`.
- Same template task 4 (lines 122-161): `concept_link` again, plus
  `impulseSignatureConcept` resolution (already resolver path —
  unaffected).

After the bridge, the LLM sees these tools in its per-task list and
calls them by plain name.

Future activities this unblocks structurally:

- Any activity that wants to call `concept_search`, `concept_neighbors`,
  `concept_record_usage`, etc. as first-class tool calls.
- Any future vessel that exposes MCP tools gets free LLM access by
  advertising `mcpTool` in its shapes — no minibob PR.

## Implementation outline (per repo)

### discovery-vessel

**No code changes required.** `mcpTool` is just another shape string
in vessel registrations. The existing `register`/`resolve` paths
handle it transparently.

Test: round-trip a registration with `shapes: ["mcpTool"]` and
verify it's queryable.

### @metabob/vessel-discovery-client (shared package)

**No contract change.** The package's `VesselCapability.shapes`
already accepts arbitrary strings.

### concept-db

Files to touch:

1. `src/config.ts` — add `"mcpTool"` to `discovery.shapes` (line
   181-189).
2. `src/routes/impulses.ts` — add a `case "mcpTool":` branch in the
   resolve dispatch. Implementation:
   - Read `pointer.goal_keywords`, `input_shapes`, `output_shapes`,
     `task_description`, `limit`, `min_relevance` (all optional).
   - Score each entry in `conceptTools` using the keyword + shape
     scoring sketched above.
   - Return the top-N as a list of impulses, each `{content, metadata}`
     with `metadata.shape = "mcpTool"`,
     `metadata.vessel_id = "concept-db"`,
     `metadata.call_endpoint = "/mcp/tools/call"`.
3. Tests: `src/routes/impulses-mcptool.test.ts` covering keyword
   match, limit, empty pointer (returns all by uninformed prior).

### activity-api

Files to touch:

1. `src/config.ts` — add `"mcpTool"` to discovery shapes if
   activity-api ever exposes MCP tools (none today). This
   is a no-op.

If activity-api wires up an MCP surface in a follow-up, the same
pattern applies.

### minibob

Files to touch:

1. New file: `src/discovered-tools.ts` (~200 LOC). Public surface:
   ```typescript
   // Per-task tool list builder. Resolves mcpTool impulses via
   // discovery+resolve, returns merged ToolDefinition[] and the
   // dispatch metadata.
   export async function getDiscoveredToolsForTask(
     task: ActivityTask,
     activityContext: ActivityContext,
   ): Promise<{
     tools: ToolDefinition[]
     dispatch: Map<string, McpToolDispatchInfo>  // name → vessel binding
   }>

   // Synthesizes a ToolHandler given a name + vessel binding.
   // Wraps the call in a fetch to vessel.endpoint + call_endpoint.
   export function makeDispatchHandler(
     name: string,
     binding: McpToolDispatchInfo,
   ): ToolHandler
   ```

2. `src/activity.ts` — at the spot where `wrappedHandlers` is built
   (~line 4988-5007), call `getDiscoveredToolsForTask(task, ctx)`
   and merge the returned tools/handlers with the static built-ins.
   Per-activity cache so multiple tasks within the same activity
   share the resolution result if their context is identical.

3. `src/tools.ts` (~line 1732) — `getAllToolDefinitions` keeps
   returning built-ins only. The dynamic per-task path lives in
   `discovered-tools.ts`, not in `getAllToolDefinitions`.

4. `src/resolution-tracker.ts` — confirm dispatched tool calls
   route through `recordSuccess` / `recordFailure` with
   `resolver_tier = "DISCOVERY"`. No code change expected.

5. Feature detection: `getDiscoveredToolsForTask` returns an empty
   merge result if discovery is disabled or no vessels resolve
   `mcpTool`. The activity executor stays correct in either case.

What we explicitly do **not** add:

- No per-vessel client files (no `src/clients/concept-db.ts`).
- No global tool registry beyond the built-ins. The per-task
  resolution result is held only for the duration of the task.
- No tool-name namespacing.

## Test plan

### Unit (concept-db)

1. `impulses-mcptool.test.ts`:
   - Resolving `mcpTool` with `goal_keywords: ["concept", "edge"]`
     returns at least `concept_link`, `concept_upsert_by_signature`,
     `concept_create` in the top-5.
   - `limit: 3` caps the result.
   - Empty pointer returns all tools (unranked).
   - Each returned impulse has `metadata.vessel_id = "concept-db"`,
     `metadata.shape = "mcpTool"`, content schema valid.

### Unit (minibob)

1. `discovered-tools.test.ts`:
   - `getDiscoveredToolsForTask` with a stub discovery returning two
     vessels merges correctly.
   - Per-activity cache reuses the result across tasks with the
     same context.
   - Built-ins always present; merge is additive.
   - `makeDispatchHandler` POSTs to the right endpoint with the
     right body and applies `auth_scheme`.
   - Non-2xx response → `ToolResult.success = false`.
   - Recorded into resolution-tracker with `resolver_tier = "DISCOVERY"`.

2. `activity.test.ts` extension:
   - End-to-end task simulation: pre-LLM hook resolves `mcpTool`,
     LLM dispatch resolves to vessel, tool result roundtrips.
   - Discovery disabled → per-task list = built-ins only,
     activity still completes.

### Integration

1. Bring up discovery-vessel locally, register concept-db with
   `mcpTool` in its shapes. Run a goal that invokes
   `learn-impulse-relationships` task 3. Verify:
   - Pre-task `mcpTool` resolution log shows concept-db responding
     with the 9 concept tools.
   - LLM tool list for task 3 includes
     `concept_upsert_by_signature` and `concept_link` (plain names,
     no namespace).
   - Tool-call traces at `resolver_tier: DISCOVERY`,
     `vessel_id: concept-db`.
   - Task 3's validation pattern `pairs_above_threshold=N` matches
     dry-run expectation.

2. Negative path: stop concept-db mid-execution. minibob's
   per-task tool resolution returns 0 concept tools; LLM falls
   back to bash/curl improvisation (today's broken behavior, which
   the bridge degrades-to gracefully — not a regression).

3. Scale-shape check: register 50 stub vessels each advertising
   `mcpTool`. For a task with no concept-db-relevant context,
   verify the per-task tool list stays under 30 entries (the
   resolver scoring filters non-matching vessels' contributions
   to ~0).

### Canary validation

After deploying, run a `learn-impulse-relationships` goal via
`minibob --single` against canary, and check:

- An execution trace appears with task 3 having a pre-task
  `mcpTool` impulse resolution recorded.
- `impulse_resolutions[]` includes a `VesselClient` entry pointing
  at concept-db's `concept_link` invocation.
- Per-(template, tool) relevance EMA updates after the run (visible
  in concept-db's relevance impulses).

## Open questions

1. **Should `mcpTool` resolution support pagination, or is `limit`
   alone enough?** Pagination on tool selection is probably
   over-engineering — if `limit=20` isn't enough, the scoring
   function is the problem, not the page size.
   _Recommendation: defer until a real use case demands it._

2. **Per-task vs per-activity tool resolution.** Picks per-task
   with per-activity caching. Should the cache key include task
   id, or normalize to activity id? If normalized, tasks with
   diverging contexts within an activity get a stale list.
   _Recommendation: cache keyed by `(activityId, task.inputShapes,
   task.outputShapes, task.descriptionHash)` — drops cold when any
   of those change. Cheap to compute, sharp enough to avoid
   staleness._

3. **Thompson Sampling for tool selection — own channel or
   piggyback on activity-template Thompson?** Today
   `thompson-sampling.ts` ranks templates. Ranking
   (template, tool) pairs is a second channel; piggybacking would
   conflate "the template was good" with "this tool was good for
   this template", which are different signals.
   _Recommendation: separate channel, same primitive
   (`computeThompsonSamplingUpdates`). Defer if EMA-relevance
   alone proves enough._

4. **Tool-name length budget.** Anthropic's regex caps at 64 chars.
   Plain names today are well under that. If a future vessel
   exposes a long tool name, fail-fast with a startup warning is
   better than truncating.
   _Recommendation: warn and skip; do not synthesize a hash suffix
   silently._

5. **Should the bridge handle MCP `prompts` and `resources` too,
   eventually?** MCP defines three primitive types (tools, prompts,
   resources). This spec only covers tools.
   _Recommendation: out of scope. Resources overlap with the
   resolver path conceptually; revisit when there's a concrete
   consumer._

6. **Discovery query: do we want a `shape: ["mcpTool"]` filter at
   the discovery layer to avoid fanning out to vessels that don't
   resolve tools at all?** Yes — that's already how
   `discoverVesselsForShape` works. Confirm at implementation
   time that the existing path is reused, not bypassed.

7. **MTLS / cluster-internal traffic.** Same answer as the
   resolver path — out of scope for the bridge; inherits whatever
   the resolver path inherits.

8. **Cold-start tool ranking.** Before any usage history exists,
   the EMA term is uninformed. The keyword + shape match terms
   alone should be enough for cold-start. Validate with a
   from-scratch deployment (no traces yet) running
   `learn-impulse-relationships` and confirming task 3 works.

9. **Coordination with the impulse-write spec.** When `_write`
   shapes ship, the `mcpTool` resolver should preferentially
   surface the `_write` shape (e.g. `conceptLink_write`) over the
   raw MCP tool name (`concept_link`). This is a one-line scoring
   bias. Note in the implementation; not load-bearing.

---

**Length:** ~640 lines.
**Total new code estimate:** ~200 LOC in minibob (per-task resolver
+ dispatcher) + ~80 LOC in concept-db (new `mcpTool` resolve case +
scorer) + ~20 LOC in concept-db config. ~300 LOC total plus tests.
