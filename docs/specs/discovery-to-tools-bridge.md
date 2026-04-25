# Discovery-to-Tools Bridge

Status: draft (spec only — implementation pending).
Owners: minibob, discovery-vessel, concept-db, activity-api.
Companion to Wave 1 (resolver contract). See
`packages/vessel-discovery-client/src/types.ts:99-213` for the
resolver-contract precedent this spec mirrors.

## Problem

Wave 1 closed the **resolver path**: minibob can call any vessel that
advertises `resolve_endpoint`/`resolve_request_format`/`auth_scheme`/
`resolve_timeout_ms` to load impulse content, with zero per-vessel code
in minibob (`repos/minibob/src/vessel-discovery.ts:481-524`).

The **tool path** is still hardcoded. The LLM tool list comes from
`getAllToolDefinitions` (`repos/minibob/src/tools.ts:1732-1750`), which
returns only minibob's built-in handlers (`bash`, `read`, `write`,
`edit`, git, etc.) plus the optional `workspace-vessel` tools and any
`config.customTools` passed by the caller. There is no pathway by which
a vessel discovered at runtime — concept-db, activity-api, a future
vessel — can contribute tools the LLM is allowed to call directly.

The concrete consequence:
`templates/concept-learning/learn-impulse-relationships.json` task 3
(`upsert-signature-concepts-and-base-edges`) tells the LLM to call
`concept_upsert_by_signature` and `concept_link`. Those tools exist on
concept-db (`repos/concept-db/src/tools/definitions.ts:25-306`,
exposed via `POST /mcp/tools/call` at
`repos/concept-db/src/routes/mcp.ts:49-93`), but the LLM in minibob
never sees them in its tool list, so it either improvises bash `curl`
calls (brittle, often wrong shape) or silently degrades. The whole
"ribosome refines edges" loop is broken until the bridge exists.

This spec defines the minimum-viable bridge: a contract extension on
discovery + a single auto-registration loop in minibob, no per-vessel
wiring, leveraging the `/mcp/tools/call` endpoint that concept-db
already exposes.

## Constraints

- **Foundation alignment.** Tools are activities-as-resolvers in disguise;
  vessels own their tools the same way they own their data
  (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`, foundation principle 3:
  "resolvers live where data lives"). The bridge must not centralize tool
  registration in minibob source.
- **No regressions on the resolver path.** Wave 1's
  `resolve_endpoint`/`auth_scheme` contract stays untouched. The new
  fields are additive, all optional.
- **Backward compatible.** Vessels that don't advertise tools keep
  working. A minibob without bridge support keeps working against the
  extended discovery payload (it ignores unknown fields).
- **Concept-db stays exactly as-is on the wire.** Already exposes
  `GET /mcp/tools` and `POST /mcp/tools/call` with the shape we need.
  No new endpoints on concept-db.
- **Tool-filtering preserved.** `filterToolsForTask`
  (`repos/minibob/src/activity.ts:221-252`) must still be able to
  exclude/require tools by name on discovered tools, not just built-ins.
- **One mechanism, not two.** Today minibob has both `vessel-registry.ts`
  (legacy `/v2/vessels/*`, deprecated until July 2026) and
  `vessel-discovery.ts` (Wave 1 contract). The bridge plugs into the
  latter. We do not extend the legacy paths.
- **MCP backend delegation stays as a fallback.** `getMCPClient` /
  `isMCPEnabled` (`repos/minibob/src/mcp.ts:3209-3247`) remain the
  legacy escape hatch for activity-api specifically; the bridge is the
  general solution.

## Design alternatives

### A. Inline tool advertisement at registration

Vessel registers with `tools: ToolDescriptor[]` embedded in the
register payload. Discovery persists it. `vesselCapability` resolution
returns it. Minibob reads it on cache fill.

- Pro: One round trip per discovery cache miss. No new endpoints. Tools
  live alongside the resolver contract that already exists on the same
  payload — symmetric.
- Pro: Tool list is part of the registration record, so a vessel that
  changes tools only needs to re-register (heartbeat is enough — it
  re-asserts the registration).
- Con: Registration payload grows. Concept-db's 9 tools serialize to
  ~3-5 KB; activity-api could go larger.
- Con: Tool changes require a re-register. If a vessel hot-reloads
  tools without re-registering, minibob's cached view stays stale until
  TTL.

### B. Endpoint-based fetch (`tools_endpoint`)

Vessel advertises `tools_endpoint: string` (default `/mcp/tools`) at
registration. Minibob fetches `${endpoint}${tools_endpoint}` lazily on
first need or on cache fill.

- Pro: Tool changes don't require re-register; just bump a version
  header on the endpoint.
- Pro: Registration payload stays small.
- Con: Two round trips per cache miss (discovery query + tool fetch
  per vessel).
- Con: Adds a new failure mode (vessel registered but `/mcp/tools`
  unreachable). Different timeout/retry policy needed.

### C. Hybrid: inline list + version, fetch on version mismatch

Inline a `tools_version: string` plus the full list. Cached view holds
both. On heartbeat, vessel may include a bumped version; minibob
refetches `/mcp/tools` only on mismatch.

- Pro: Best of both — fresh on real change, cheap on the steady state.
- Con: More machinery (heartbeat-carries-version, conditional refetch).
  Premature given current churn.

## Recommended design

**Option A (inline at registration), with a small forward-compat hook
for B/C.**

Justification:

1. The resolver contract (Wave 1A-D) already established the pattern
   of "vessel advertises everything callers need on the registration
   payload." Tools are the parallel case for the imperative path.
   Symmetry minimizes cognitive load.
2. Tool lists for the vessels we currently have (concept-db: 9 tools,
   activity-api: ~5 likely candidates) are small enough that inline
   serialization isn't a problem. We can revisit if a vessel ever
   advertises hundreds.
3. Vessel-discovery cache TTL is already 5 min
   (`repos/minibob/src/vessel-discovery.ts:114`). Tool churn at that
   granularity is acceptable for v1.
4. The forward-compat hook: spec a single optional field
   `tools_endpoint?: string`. If a vessel advertises it instead of
   inlining `tools`, minibob fetches lazily. We don't implement that
   path now — but defining the field locks the door against
   incompatible alternative B later.

### Contract extension

Three new optional fields on `VesselRegistration` / `VesselCapability` /
`RegisterRequest` (the three places the Wave 1 fields live):

```typescript
/** MCP tools this vessel exposes for direct LLM tool calling.
 *  When present, minibob auto-registers each tool as an LLM-callable
 *  tool, namespaced as `${vesselId}.${tool.name}`. Inline form. */
tools?: VesselToolDescriptor[]

/** Optional alternative to `tools`: a path on this vessel where the
 *  tool manifest can be fetched as `{ tools: VesselToolDescriptor[] }`.
 *  When both are present, `tools` wins. Reserved for v1.1; v1 ignores. */
tools_endpoint?: string

/** Path on this vessel where tool calls are dispatched.
 *  Default when absent: `"/mcp/tools/call"`. Body is
 *  `{ tool: string, arguments: Record<string, unknown> }` per the
 *  concept-db pattern. Mirrors `resolve_endpoint`. */
tools_call_endpoint?: string
```

`VesselToolDescriptor`:

```typescript
export interface VesselToolDescriptor {
  /** Tool name as the vessel exposes it (e.g. "concept_link").
   *  Must be unique within the vessel's own tool set. */
  name: string

  /** Human-readable description shown to the LLM verbatim. */
  description: string

  /** JSONSchema for tool arguments. The MCP standard already uses
   *  JSONSchema, and concept-db's `MCPTool.inputSchema`
   *  (repos/concept-db/src/tools/definitions.ts:7-23) is already
   *  this shape. Anthropic's tool-calling API also expects JSONSchema
   *  under the `input_schema` key. So the fit is exact — no
   *  translation layer needed beyond key-renames. */
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
  }
}
```

Auth on tool dispatch: reuses `auth_scheme` from the resolver contract.
The same vessel can't reasonably want different auth on `/v2/impulses/resolve`
vs `/mcp/tools/call`, and concept-db already proves it: same `JwtAuth`
middleware on both routes. We do **not** introduce a separate
`tool_auth_scheme`.

### Auto-registration in minibob

A new module, `repos/minibob/src/discovered-tools.ts`, owns:

1. **Enumeration.** Given the vessel-discovery cache, walk all known
   vessels, collect each vessel's `tools[]`, build a flat list of
   `ToolDefinition` (the minibob LLM tool shape — see
   `repos/minibob/src/types.ts:1236-1252`).
2. **Namespacing.** Tool name as exposed to the LLM is
   `${vesselId}.${tool.name}` (e.g. `concept-db.concept_link`).
   Justification under "Tool name collisions" below.
3. **Schema translation.** `inputSchema` (JSONSchema) →
   `ToolDefinition.parameters` (JSONSchema-shaped). Already compatible
   — direct passthrough with the key rename
   `inputSchema` → `parameters`. The `properties.<key>.type/description/
   enum/items` shape is identical
   (`repos/concept-db/src/tools/definitions.ts:11-22` matches
   `repos/minibob/src/types.ts:1240-1250`).
4. **Handler synthesis.** For each discovered tool, generate a
   `ToolHandler` closure that:
   - Looks up the vessel record by id from the discovery cache.
   - POSTs `{ tool: <unnamespaced name>, arguments: <params> }` to
     `${vessel.endpoint}${vessel.tools_call_endpoint ?? "/mcp/tools/call"}`.
   - Applies auth per `vessel.auth_scheme` (reusing the
     `applyAuthHeader` helper from the resolver path —
     `repos/minibob/src/resolvers/vessel-resolve-call.ts` per Wave 1D).
   - Maps `200 + { result }` → `{ success: true, output: JSON.stringify(result) }`.
   - Maps non-2xx → `{ success: false, error: errorBody }`.
   - Records the call into `resolution-tracker.ts` with
     `resolver_id = "VesselClient"`, `resolver_tier = "DISCOVERY"`,
     `vessel_id = <vesselId>` so existing trace fields populate.
5. **Wiring point.** Modify `getAllToolDefinitions`
   (`repos/minibob/src/tools.ts:1732-1750`) to accept (or call internally)
   a `getDiscoveredToolDefinitions()` synchronous getter backed by an
   in-memory cache that's refreshed by step 6.
6. **Refresh trigger.** Refresh the in-memory cache:
   - Once at startup, after vessel-discovery finishes its first
     `discoverVesselsForShape` pass.
   - On every cache miss inside `vessel-discovery.ts` (already a 5-min
     boundary).
   - Optionally: on every activity start (cheap — just walks the
     existing in-memory cache, no HTTP).

   We do **not** refresh per-task. The 5-min boundary plus on-activity
   refresh is sufficient — and matches how the resolver path already
   handles staleness.

### Tool name collisions

**Decision: vessel-id-prefix namespacing, dotted form
`${vesselId}.${name}` (e.g. `concept-db.concept_link`).**

Why not bare `name`:
- Two vessels can legitimately advertise `search`.
- LLM tool dispatch is name-keyed; conflicts produce
  silent-wrong-vessel calls.

Why dotted prefix specifically:
- Vessel id is already unique by construction (single registry, single
  org). No further disambiguation needed.
- Anthropic's tool-name regex is `^[a-zA-Z0-9_-]{1,64}$` — dots are
  not allowed. **Use underscore instead: `${vesselId}_${name}`.**
  Vessel ids in the wild today (`concept-db`, `metabob-activity-api`,
  `minibob`) contain hyphens, which are allowed. So
  `concept-db_concept_link` is the on-the-wire form. (The internal
  data structure can carry the original name; only the LLM-visible
  name is normalized.)
- Dispatch path strips the prefix back off when forwarding to the
  vessel's `/mcp/tools/call` (the vessel's `tool` argument stays
  `concept_link`).

Conflict detection: at refresh time, if two vessels independently
advertise the same `vesselId` (shouldn't happen but discovery has been
known to expose duplicates during pod rollouts), the bridge logs a
warn and uses last-write-wins. Tool-level conflicts within a vessel
are the vessel's bug — log and skip duplicates.

### Tool dispatch path

```
LLM emits tool_use { name: "concept-db_concept_link", input: {...} }
    │
    ▼
minibob tool dispatcher (existing path in activity.ts ~line 4990)
    │
    ▼  matches synthesized handler for "concept-db_concept_link"
    │
    ▼
discovered-tools.ts handler:
    POST ${vessel.endpoint}${vessel.tools_call_endpoint ?? "/mcp/tools/call"}
    Headers: Content-Type: application/json
             + auth per vessel.auth_scheme (same as resolver path)
    Body: { tool: "concept_link", arguments: <input> }
    │
    ▼
Vessel returns { tool, result } or { error }
    │
    ▼
ToolResult { success, output: JSON.stringify(result), metadata: { vessel_id } }
    │
    ▼
LLM sees the tool_result block
```

Auth specifically: concept-db today expects
`Authorization: Bearer <jwt>` via `getJwtAuthFromContext`
(`repos/concept-db/src/middleware/jwtAuth.ts`). Its discovery
registration advertises `auth_scheme: 'ApiKey'`
(`repos/concept-db/src/services/discovery-client.ts:113`). That's a
known mismatch the resolver path also has — it's the
`auth_token_source` spec (#23 sibling) that addresses it. The tools
bridge inherits the same fix; no separate plumbing here.

### Tool filtering

`filterToolsForTask` (`repos/minibob/src/activity.ts:221-252`) operates
on a flat `ToolDefinition[]`. With the bridge, the merged list returned
by `getAllToolDefinitions` already includes namespaced discovered tools.
Filtering works unchanged with two convenience extensions to the
filter syntax:

- `excludeTools: ["concept-db_*"]` — wildcard prefix match (new).
- `excludeTools: ["concept-db_concept_link"]` — exact match (existing).
- `requiredTools: ["concept-db_concept_upsert_by_signature"]` — exact
  match (existing).

The wildcard form is a strict additive change to `filterToolsForTask`:
when an exclude entry ends with `_*`, glob-match by prefix. Required
tools intentionally don't get a wildcard form — "any tool from
concept-db" is too vague to fail-fast on.

`learn-impulse-relationships` task 3 doesn't need to filter; it just
needs the discovered tools to be visible. The filter-syntax extension
is for templates that want to be defensive ("I want concept-db tools
but **not** the destructive ones") — it's nice-to-have, not load-bearing.

### What this unblocks today

Activities that already depend on this and silently fail without it:

- `templates/concept-learning/learn-impulse-relationships.json` task 3
  (lines 88-119): `concept_upsert_by_signature`, `concept_link`.
- Same template task 4 (lines 122-161): `concept_link` again, plus
  `impulseSignatureConcept` resolution (already resolver path —
  unaffected).

After the bridge, the LLM sees `concept-db_concept_upsert_by_signature`
and `concept-db_concept_link` in its tool list and can call them
directly without curl improv.

Future activities this unblocks structurally:

- Any activity that wants to call `concept_search`, `concept_neighbors`,
  `concept_record_usage`, etc. as first-class tool calls.
- Any future vessel that exposes MCP tools (a "memory" vessel, a
  "deployment" vessel, etc.) gets free LLM access without a minibob
  PR.

## Implementation outline (per repo)

### discovery-vessel

Files to touch:

- `src/types.ts` — add `tools?`, `tools_endpoint?`, `tools_call_endpoint?`
  to `VesselRegistration`, `VesselCapability`, `RegisterRequest`.
  Add a `VesselToolDescriptor` type. Mirror the existing Wave 1 field
  layout: comment block above each new field referencing this spec by
  filename.
- `src/registry.ts` — pass-through the new fields on `register`,
  `list`, and `get`. No defaulting beyond the documented
  `tools_call_endpoint` default of `"/mcp/tools/call"`.
- `src/resolvers.ts` — `resolveVesselCapability` and
  `resolveVesselRegistry` already return `VesselCapability` /
  registry summaries. Add the new fields to the projection.
- `src/index.ts` — `POST /register` already spreads `request.*` into
  `registry.register`; add the three new fields to the explicit
  spread (lines 93-117).
- `test/` — extend the existing register/resolve tests to cover the
  new fields round-tripping.

Defaulting strategy: registry stores the raw values. Defaults apply at
the consumer (minibob), not the storage layer. That's how Wave 1
handled `resolve_endpoint`. Same here.

### @metabob/vessel-discovery-client (shared package)

Files to touch:

- `src/types.ts` — add `tools?`, `tools_endpoint?`,
  `tools_call_endpoint?` to `VesselRegistration`, `VesselCapability`,
  `RegisterRequest`. Add `VesselToolDescriptor`. Include in
  `DiscoveryConfig` so vessels can pass tools through the
  `VesselClient` constructor.
- `src/registration.ts` (or wherever `register()` builds the body) —
  forward the new fields from `DiscoveryConfig` to the POST body.
- No new helpers. The package stays a thin transport layer.

Versioning: bump minor (the four resolver-contract fields landed at
this rev). Document in CHANGELOG.

### concept-db

Files to touch:

- `src/services/discovery-client.ts` (lines 92-115) — extend the
  `VesselRegistration` literal with:
  ```typescript
  tools: conceptTools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
  tools_call_endpoint: '/mcp/tools/call',
  ```
  Import `conceptTools` from `../tools/definitions`.
- That's it. No new endpoints, no new code paths. The shape is already
  exactly what the bridge expects — `MCPTool`
  (`src/tools/definitions.ts:7-23`) ≡ `VesselToolDescriptor` apart
  from the field rename.

### activity-api

Files to touch:

- `src/services/discovery-client.ts` (lines 22-118) — same pattern
  as concept-db. Build a `tools` array from the activity-api MCP
  tools (today the MCP server lives in `src/index.ts` /
  `src/routes/mcp.ts` if present). Forward
  `tools_call_endpoint: '/mcp/tools/call'`.
- If activity-api doesn't currently expose `/mcp/tools/call`, this
  is a no-op — leave `tools` unset until a follow-up wires up the
  MCP server. Out of scope for v1 of the bridge; activity-api today
  is already reachable via the resolver path for the things minibob
  needs from it.

### minibob

New file: `src/discovered-tools.ts` (new module, ~250 LOC).

Responsibilities (one section per public function):

```typescript
// Walks the vessel-discovery cache, returns flat ToolDefinition[].
// Synchronous; reads only in-memory cache.
export function getDiscoveredToolDefinitions(): ToolDefinition[]

// Synthesizes a ToolHandler per discovered tool. Returns a
// `Record<string, ToolHandler>` keyed by namespaced tool name.
export function getDiscoveredToolHandlers(): Record<string, ToolHandler>

// Refresh hook. Called by vessel-discovery on cache fill, plus once
// at startup. Idempotent — can be called from anywhere.
export async function refreshDiscoveredTools(): Promise<void>

// Helper used by both of the above:
function namespaceToolName(vesselId: string, name: string): string
function denamespaceToolName(namespaced: string): { vesselId, name } | null
```

Files to modify:

- `src/tools.ts` (line 1732) — `getAllToolDefinitions` calls
  `getDiscoveredToolDefinitions()` and concatenates.
- `src/activity.ts` — at the spot where `wrappedHandlers` is built
  (~line 4988-5007), merge in `getDiscoveredToolHandlers()` for any
  tool name not already in `this.toolHandlers`. Discovered handlers
  are wrapped the same way for tool-call recording.
- `src/activity.ts` — `filterToolsForTask` (lines 221-252) gets the
  `_*` wildcard exclude support.
- `src/vessel-discovery.ts` — at the end of `discoverVesselsForShape`
  on a cache miss, call `refreshDiscoveredTools()`. At minibob
  startup (in `index.ts` after `getVesselDiscoveryClient()`
  initializes), schedule a one-shot refresh.
- `src/resolution-tracker.ts` — already handles `"VesselClient"` /
  `"DISCOVERY"` tier. Confirm that synthesized tool handlers route
  through `recordSuccess` / `recordFailure`. No code change expected.

What we explicitly do **not** add:

- No per-vessel files (no `src/clients/concept-db.ts` etc.). The whole
  point is that minibob source has zero per-vessel knowledge.
- No new global singletons beyond the in-memory tool cache (which
  lives inside `discovered-tools.ts`).

## Test plan

### Unit (minibob)

1. `discovered-tools.test.ts`:
   - `namespaceToolName` round-trips. Tool with name containing
     underscores survives.
   - `getDiscoveredToolDefinitions` returns empty when cache is empty.
   - With a fake cache containing one vessel + two tools, returns
     two `ToolDefinition`s with namespaced names and translated
     schemas.
   - Schema translation: `inputSchema.properties` → `parameters.properties`
     verbatim; `inputSchema.required` survives.
   - Handler dispatch: stub `httpPost`, verify
     `/mcp/tools/call` is hit with `{ tool: <unnamespaced>, arguments }`.
   - Auth header applied per `auth_scheme`.
   - Non-2xx response → `ToolResult.success = false`.

2. `tools.test.ts` extension:
   - `getAllToolDefinitions` includes discovered tools after refresh.

3. `activity.test.ts` extension:
   - `filterToolsForTask` with `excludeTools: ["concept-db_*"]`
     filters all concept-db tools and nothing else.
   - With a discovered required tool that exists, no failure.
   - With a discovered required tool that doesn't exist, fails fast
     with `missingRequired`.

### Unit (discovery-vessel)

- `register` accepts and stores `tools` / `tools_call_endpoint`.
- `resolveVesselCapability` returns them in the vessel record.
- Round-trip a 9-tool concept-db-shaped registration.

### Unit (concept-db)

- Discovery-client builds a registration body that includes all 9
  tools from `conceptTools`. Snapshot test against
  `tools/definitions.ts`.

### Integration

1. Bring up discovery-vessel locally, register concept-db, fire
   `vesselCapability` for shape `concept`. Verify response
   includes `tools` array.
2. Bring up minibob with `DISCOVERY_ENABLED=true` pointing at the
   local discovery. Run a goal that invokes
   `learn-impulse-relationships`. Verify task 3 logs:
   - `concept-db_concept_upsert_by_signature` in
     `toolFilterResult.tools` for the relevant task.
   - Tool-call traces at `resolver_tier: DISCOVERY`,
     `vessel_id: concept-db`.
   - `pairs_above_threshold=N edges_linked=K` matches dry-run
     expectation.
3. Negative path: stop concept-db mid-execution. Verify minibob
   gets `success: false` from the synthesized handler with a
   network-error message, and the activity surfaces the failure
   instead of hanging.
4. Cache staleness: register concept-db with 9 tools, run a goal
   (cache populated), redeploy concept-db with 10 tools. Within 5 min
   minibob still sees 9. After 5 min, sees 10. Document this as
   expected behavior.

### Canary validation

After deploying, hit `https://activity.metabob.com/v2/activities/recommend`
or run a `learn-impulse-relationships` goal via
`minibob --single`, and check:

- `https://discovery.metabob.com/registry/stats` reports concept-db
  with non-empty `tools`.
- An execution trace appears with `impulse_resolutions[].resolver_id`
  including a `VesselClient` entry that points at concept-db's
  `concept_link`.

## Open questions

1. **Tool-name length budget.** Anthropic's regex caps at 64 chars.
   `concept-db_concept_upsert_by_signature` = 38 — fine. Future
   vessel ids could push this. Do we want a fallback (truncate +
   hash suffix) for v1, or wait for the first hit?
   _Recommendation: defer. Add a startup warn if any synthesized
   name exceeds 64 chars; fail fast rather than silently truncate._

2. **Should tools be advertised per-shape or per-vessel?**
   Today: per-vessel (`tools` lives on `VesselCapability`, returned
   regardless of which shape was queried). Consequence: discovering
   *any* concept-db shape (e.g. `concept`) pulls in *all* concept-db
   tools (`concept_link`, `concept_search`, etc.).
   _Recommendation: per-vessel. Tools are vessel-scoped capabilities;
   tying them to a single shape is artificial._

3. **Does the bridge handle MCP `prompts` and `resources` too,
   eventually?** MCP defines three primitive types (tools, prompts,
   resources). This spec only covers tools.
   _Recommendation: out of scope for v1. Resources overlap with the
   resolver path conceptually; revisit when there's a concrete
   consumer._

4. **Discovery-vessel as authoritative tool source vs vessels
   self-serving via `tools_endpoint`.** This spec picks A (inline at
   registration) and reserves `tools_endpoint` for v1.1.
   Confirm the team is OK shipping A first, or skip straight to B/C.
   _Default: ship A. Inline form is simpler and the staleness
   window is acceptable._

5. **Should `filterToolsForTask` learn about vessel-id-level
   filtering?** I.e. `excludeVessels: ["concept-db"]` rather than
   wildcard string-match.
   _Recommendation: prefer wildcard. It composes with
   non-discovered tools (e.g. `excludeTools: ["bash", "concept-db_*"]`
   in one list). Vessel-level filtering can be a sugar layer later._

6. **Do we record an impulse per discovered tool call, like the
   resolver path does?** The resolver path emits an impulse and a
   resolution-tracker entry per resolve. Tool calls already create
   tool-output impulses (`activity.ts:5021-5050`).
   _Recommendation: keep tool-call impulse emission as today; do NOT
   double-emit. Only add a resolution-tracker entry to keep
   resolver-tier accounting consistent._

7. **MTLS / cluster-internal traffic.** When concept-db talks to
   discovery via mTLS, do tool calls from minibob also need mTLS
   to concept-db? Out of scope for the bridge; same answer as the
   resolver path.

---

**Length:** ~440 lines. Intentionally short.
**Total new code estimate:** ~250 LOC in minibob + ~30 LOC each in
discovery-vessel / vessel-discovery-client / concept-db. ~340 LOC total
plus tests.
