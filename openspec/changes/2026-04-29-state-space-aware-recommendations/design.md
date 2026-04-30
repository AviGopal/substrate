# Design: State-Space-Aware Template and Pointer Recommendations

**Change ID**: `2026-04-29-state-space-aware-recommendations`

---

## Foundation note

This change sits at the intersection of two already-deployed subsystems. The impulse-binding-selection-layer spec (2026-04-26) established that binding decisions — which impulse to use for a shape — belong in resolvers, not in the executor. This spec applies the same principle one level up: the recommendation of *which template to run next* should account for the executor's current state. The `impulse_state_space` field is the executor declaring what it already has; the `pointer_state_space` is the executor declaring what it could get. Together they let the recommendation algorithm move from "which template is globally best" to "which template is best for me, right now."

This is also the consumer-side complement to the `thompson_posterior` shape gap noted in the impulse-binding-selection-layer design. Once `thompson_posterior` lands as a resolvable shape, the pointer recommendations generated here can include Thompson posteriors themselves as loadable context — enabling an executor to inspect the learning system's own state before choosing an activity. That connection is tracked as out-of-scope; no implementation dependency.

---

## 1. Two State Spaces

### Impulse state space (what the executor has)

The set of impulses currently in a `loaded: true` state in the executor's working memory at the moment of the recommendation request. Each entry describes one resolved impulse: its semantic shape type, an optional short summary of its content, the pointer it was loaded from (for provenance), and when it was loaded.

The impulse state space answers: "what domain context is the executor already reasoning about?" An executor with `["jwt_claims", "authenticated_user", "file:src/auth/jwt.ts"]` loaded is almost certainly in the authentication domain. Knowing this lets the recommendation algorithm surface auth-domain templates even when the goal string is sparse.

### Pointer state space (what the executor could get)

The set of shapes reachable via the executor's full key scope set — including cross-account scopes granted via active federation links. The query for pointer_state_space is `VesselDiscoveryClient.getAllRegisteredShapes()` filtered to shapes accessible given the key's scope claims. A shape is in the pointer state space if and only if at least one vessel advertises it in its registration payload AND the executor's key scopes permit access to that vessel's account.

Federation links are scope grants embedded in keys at issuance time, not runtime identity proxies. This means the pointer state space is stable for the lifetime of a key (no runtime negotiation required) and can be computed once per session with a short cache TTL (see §5).

The pointer state space answers: "what additional context is available to the executor, given the key it currently holds?" It is the universe of resolvable shapes scoped to the executor's access model, minus what has already been loaded.

Together the two spaces form the recommendation context. Templates whose inputs are fully covered by the impulse state space are immediately executable. Templates whose inputs are not yet loaded but present in the pointer state space are executable-after-fetch. Templates whose inputs are absent from both spaces require escalation (see blocking_shapes in §3).

---

## 2. Extended Recommend Request

```typescript
// POST /v2/activities/recommend — enhanced body
{
  // existing fields (unchanged)
  goal?: string
  expected_output_shapes?: string[]
  filters?: {
    category?: string
    tags?: string[]
    min_success_rate?: number
  }
  session_context?: {           // from impulse-state-query-augmentation spec
    loaded_shapes: string[]
    loaded_pointer_paths: string[]
    load_timestamps_ms: number[]
  }

  // NEW: executor's current loaded impulse pool
  impulse_state_space?: Array<{
    shape: string             // semantic type of the resolved impulse, e.g. "jwt_claims"
    summary?: string          // short description of content (may be absent for large impulses)
    pointer?: {               // where it came from (for provenance, mirrors ImpulsePointer)
      type: string
      [key: string]: unknown
    }
    loaded_at?: string        // ISO timestamp of when this impulse was resolved
  }>

  // NEW: shapes resolvable from the current vessel registry
  pointer_state_space?: Array<{
    shape: string                                        // semantic type, e.g. "concept"
    vessel_id: string                                    // which vessel can resolve it
    resolve_tier: 'deterministic' | 'pattern' | 'llm'  // resolver cost class
    resolve_timeout_ms?: number                          // from vessel's resolver contract
  }>
}
```

Both new fields are optional. When absent, behavior is identical to the current implementation (backward-compatible; see §6).

---

## 3. Extended Recommend Response

```typescript
// POST /v2/activities/recommend — enhanced response
{
  // existing (unchanged)
  templates: Array<{
    id: string
    name: string
    alpha: number
    beta: number
    sample_count: number
    // ...other existing fields
  }>

  // NEW: ordered list of shapes to resolve next, by expected utility
  pointer_recommendations: Array<{
    shape: string                     // shape to resolve next
    pointer_hint?: {                  // suggested pointer if inferrable from prior traces
      type: string
      [key: string]: unknown
    }
    rationale: string                 // human-readable: "loads 3 high-α templates' missing input"
    unlocks_template_ids: string[]    // IDs of top-N templates this shape would enable
    expected_utility: number          // 0.0–1.0, weighted by Thompson α/(α+β) of unlocked templates
    resolve_via: {
      vessel_id: string
      resolve_tier: 'deterministic' | 'pattern' | 'llm'
    }
  }>

  // NEW: shapes blocking the best templates
  blocking_shapes: Array<{
    shape: string
    required_by_template_ids: string[]  // which top-N templates need this shape
    gap_type: 'resolvable' | 'escalatable' | 'scope_upgradeable' | 'budget_blocked' | 'capability_blocked'
    // resolvable:         template exists, in current key scopes, just not loaded yet
    // escalatable:        no template in current scopes; goal-seeking can create one within budget
    // scope_upgradeable:  template exists but requires a federation link upgrade (human-actionable, not system-actionable)
    // budget_blocked:     goal-seeking possible but estimated cost exceeds the executor's budget envelope
    // capability_blocked: requires tools/data that do not exist anywhere in the system
    resolve_via?: {       // present when gap_type is 'resolvable'
      vessel_id: string
      resolve_tier: 'deterministic' | 'pattern' | 'llm'
    }
    gap_severity: 'blocking' | 'optional'
    // blocking: template cannot run without this shape (required input, no fallback)
    // optional: template degrades gracefully if absent (optional input or has default)
  }>
}
```

`pointer_recommendations` is present (possibly empty) whenever `pointer_state_space` is provided.
`blocking_shapes` is present (possibly empty) whenever `impulse_state_space` is provided.
When neither new field is provided in the request, neither is present in the response.

---

## 4. Recommendation Algorithm

The algorithm runs in three sequential steps after the existing Thompson Sampling posterior computation.

### Step 1: Template compatibility filtering

Prerequisite: `impulse_state_space` is present and non-empty. If absent, skip this step entirely and use existing Thompson ranking.

For each template in the full candidate set, compute a compatibility score:

- **Fully covered**: all `inputShapes` entries are present as shapes in `impulse_state_space`. No discount applied. Template ranks by Thompson α/(α+β) as before.

- **Partially covered (resolvable gap)**: one or more `inputShapes` are missing from `impulse_state_space` but present in `pointer_state_space` (gap_type `resolvable`). Apply a compatibility discount: multiply the effective score by `0.7`. This reflects the real cost of a fetch round-trip — the template is not executable immediately but is reachable without escalation.

- **Escalatable gap**: one or more `inputShapes` are absent from `pointer_state_space` but the shape gap index indicates goal-seeking can produce a template (gap_type `escalatable` or `scope_upgradeable`). Apply a stronger discount: multiply by `0.5`. The template is reachable but requires escalation cost.

- **Uncovered (budget or capability blocked)**: one or more `inputShapes` have gap_type `budget_blocked` or `capability_blocked`. Apply the maximum discount: multiply by `0.3`. These templates are candidates of last resort. If `expected_output_shapes` is set, templates with `capability_blocked` gaps that cannot produce any of the expected shapes are filtered out entirely.

The discounted score is used only for ranking order. The raw Thompson α/(α+β) values are still returned in the response unchanged so callers can display the true posterior.

**Template input shape discovery**: `inputShapes` for each template are read from the `input_shapes` field stored on the activity template record. If a template has no declared `input_shapes`, it is treated as fully covered (no gap to penalize).

### Step 2: Pointer recommendation generation

Prerequisite: `pointer_state_space` is present. If absent, skip this step and omit `pointer_recommendations` from the response.

For each shape in `pointer_state_space` that is NOT already present in `impulse_state_space`:

1. Find all templates in the top-20 by Thompson score whose `input_shapes` include this shape.
2. Compute raw utility: `Σ (template.alpha / (template.alpha + template.beta))` for each unlocked template. Use a uniform prior of `alpha=1, beta=1` (score=0.5) for templates with no recorded executions.
3. Normalise to 0–1 range across all candidate shapes (divide each raw utility by the maximum raw utility across the full candidate set; if all utilities are zero, set all to 0).
4. Construct `rationale` as a short string: `"unlocks N template(s) in top-20; highest-ranked: <template name>"`.
5. Set `resolve_via` from the `pointer_state_space` entry for this shape. If multiple vessels advertise the same shape, prefer `resolve_tier: 'deterministic'` over `pattern` over `llm`.

Return the top-5 pointer recommendations ordered by `expected_utility` DESC. If fewer than 5 shapes qualify, return all that qualify. If none qualify (all pointer_state_space shapes are already in impulse_state_space), return an empty array.

`pointer_hint` is populated when: (a) a previous execution trace for the top-unlocked template has a resolved impulse of this shape, and (b) that impulse's pointer can be read from the trace's `impulse_resolutions` field. This is a best-effort hint; it is absent when no trace history is available.

### Step 3: Blocking shape identification

Prerequisite: `impulse_state_space` is provided (may be empty). Always run this step when the field is present.

For the top-5 templates by Thompson score (after compatibility filtering):

1. For each template, identify `inputShapes` not present in `impulse_state_space`.
2. For each missing shape, classify `gap_type`:
   - `resolvable`: the shape is present in `pointer_state_space` (a vessel in the executor's key scopes can resolve it right now). Set `resolve_via` from the `pointer_state_space` entry.
   - `escalatable`: the shape is not in `pointer_state_space` but the shape gap index has no `scope_upgrade_needed` entry for this (shape, account_id) pair — meaning goal-seeking via `create-shape-provider-goal` should be able to produce a template within budget. This is the system-actionable escalation path.
   - `scope_upgradeable`: the shape gap index has an entry with `resolution_type = 'scope_upgrade_needed'` for this (shape, account_id) pair — a template exists but the executor's current key does not include the scope to access it. This is human-actionable (federation link upgrade); the workbench surfaces it explicitly rather than triggering automatic escalation.
   - `budget_blocked`: gap index has a prior `goal_created` entry whose recorded `cost_usd` exceeds the executor's current budget envelope, or the estimated goal-seeking cost from the recommendation service's cost model exceeds the budget. System cannot self-resolve without budget increase.
   - `capability_blocked`: no template exists, no scope upgrade would help, and there is no known path to create one (e.g., requires external data access that does not exist in any registered vessel).
3. Classify severity independently of gap_type:
   - `blocking`: the shape is marked as required in the template's task definitions (no fallback task). In the absence of per-task required/optional shape metadata, treat all declared `input_shapes` as `blocking` by default.
   - `optional`: at least one alternate task path in the template can proceed without this shape.
4. Deduplicate: if the same shape is missing from multiple top-5 templates, emit one `blocking_shapes` entry with `required_by_template_ids` listing all templates that need it.

**Important**: `blocking_shapes` is informational. Slot-binding cannot theoretically fail because the escalation chain always provides a next step: `resolvable` → load now; `escalatable` → `create-shape-provider-goal` creates a template; `scope_upgradeable` → human surfaces federation link upgrade; `budget_blocked` or `capability_blocked` are the only genuinely terminal states. The `blocking_shapes` array characterises the escalation cost and required human action — it does not indicate a dead end.

Return all blocking shapes for the top-5 templates, even if the list is empty.

---

## 5. MiniBob Integration

MiniBob already holds both pieces of information needed to populate the new fields. The integration requires wiring existing data into the recommend call — no new state tracking.

### `ImpulseStore.getLoadedImpulseSummaries()`

Add a new method to `ImpulseStore` (or its interface in `src/impulse.ts`) that returns the impulse state space payload:

```typescript
getLoadedImpulseSummaries(): Array<{
  shape: string
  summary?: string
  pointer?: ImpulsePointer
  loaded_at?: string
}>
```

Implementation: filter the store to impulses with `loaded: true`, map each to `{ shape: impulse.pointer.type, summary: impulse.summary, pointer: impulse.pointer, loaded_at: impulse.loadedAt?.toISOString() }`. The `summary` field is populated from the impulse's existing `description` or `title` metadata if present; omitted if absent. This method has no I/O.

### `VesselDiscoveryClient.getAllRegisteredShapes()`

Add a method to `VesselDiscoveryClient` (in `src/vessel-discovery.ts`) that returns the pointer state space payload:

```typescript
getAllRegisteredShapes(): Promise<Array<{
  shape: string
  vessel_id: string
  resolve_tier: 'deterministic' | 'pattern' | 'llm'
  resolve_timeout_ms?: number
}>>
```

Implementation: call `POST /resolve` on the discovery-vessel endpoint with an empty shapes query (or use the existing `/shapes` or `/registry/stats` endpoint if it returns per-vessel shape listings). Map each vessel's advertised shapes to entries in the return array. If a shape is advertised by multiple vessels, emit one entry per vessel. If discovery is unavailable (offline mode or discovery not configured), return `[]` gracefully — the pointer_state_space will be empty and no pointer recommendations will be generated.

**Caching**: the result should be cached for the session lifetime (until the MiniBob process exits or the user triggers a re-registration). Discovery-vessel registrations are TTL-based (5-minute default); a cache with a 4-minute TTL at the MiniBob layer prevents stale data without over-fetching. Store the cached result in the `VesselDiscoveryClient` instance.

### Goal processor wiring

In `src/goal-processor.ts`, at the point where `callRecommend()` is invoked, add the two new fields:

```typescript
const response = await callRecommend({
  goal: goalDescription,
  expected_output_shapes: expectedOutputShapes,
  // existing fields...

  // NEW
  impulse_state_space: impulseStore.getLoadedImpulseSummaries(),
  pointer_state_space: await vesselDiscovery.getAllRegisteredShapes(),
})
```

If `vesselDiscovery` is null (discovery not configured), pass `pointer_state_space: []` or omit the field entirely — both produce identical behavior (no pointer recommendations generated).

The `pointer_recommendations` and `blocking_shapes` from the response can be used to:
1. Log pointer recommendations at debug level so operators can see what the system suggests loading.
2. Surface `blocking_shapes` in the goal-processing activity's impulse pool as a `shape_gap_report` impulse (memo type), making the gap visible to subsequent tasks in the activity chain without requiring a new endpoint.

---

## 6. Backward Compatibility

Both new request fields are optional. The server MUST handle all four combinations:

| `impulse_state_space` | `pointer_state_space` | Behavior |
|---|---|---|
| absent | absent | Existing Thompson ranking; no new fields in response |
| present | absent | Compatibility filtering applied; `blocking_shapes` in response; `pointer_recommendations` absent |
| absent | present | No compatibility filtering; `pointer_recommendations` in response (based on top-20 Thompson); `blocking_shapes` absent |
| present | present | Full behavior: compatibility filtering + `pointer_recommendations` + `blocking_shapes` |

Empty arrays (`[]`) are treated identically to absent for filtering purposes (no impulses loaded = no compatibility filtering; no pointer shapes = no pointer recommendations).

Existing callers that do not send either new field see zero behavior change. The response schema is additive — no existing fields are modified or removed.

---

## 7. Pointer Resolution via Existing Path

Once MiniBob receives `pointer_recommendations` from the recommend response, it resolves shapes through the existing `callVesselResolve()` path in `src/vessel-discovery.ts` — the same path used for all discovery-vessel-routed impulse resolution. No new endpoint is needed for this step. The `resolve_via` field in each pointer recommendation provides the vessel ID and tier; `callVesselResolve()` already accepts these and handles routing through the vessel's advertised `resolve_endpoint`.

This means the full flow is:
1. Call `POST /v2/activities/recommend` with state spaces → receive `pointer_recommendations`
2. For each high-utility recommendation, call `callVesselResolve({ shape, vessel_id })` → impulse resolved
3. Add resolved impulse to pool, call recommend again → compatibility-filtered ranking improves

The loop terminates when `pointer_recommendations` is empty (all high-utility shapes loaded) or when the executor's impulse budget is exhausted.

---

## 8. Connection to `thompson_posterior` Shape (Phase 9)

The `impulse-binding-selection-layer` design notes that a future `thompson_posterior` shape would unify the read path for Thompson parameters — enabling an executor to load its own learning system's state as an impulse before choosing an activity. This spec is the consumer side of that future shape: once `thompson_posterior` is resolvable, it will appear in `pointer_state_space` returned by `getAllRegisteredShapes()`, and pointer recommendations will include it alongside domain shapes like `concept` and `activityExecutionTrace`.

This connection requires no implementation work here. The recommendation algorithm treats `thompson_posterior` the same as any other shape — no special casing. The spec is forward-compatible.

---

## 9. Implementation Scope

### activity-api

**`src/routes/activities.ts`** — extend the `POST /v2/activities/recommend` handler:
- Parse `impulse_state_space` and `pointer_state_space` from request body (optional; treat absent as `undefined`, not as validation error).
- Call the compatibility filter (new service function) if `impulse_state_space` is defined.
- Call the pointer recommendation generator (new service function) if `pointer_state_space` is defined and non-empty.
- Call the blocking shape identifier (new service function) if `impulse_state_space` is defined.
- Merge results into the response.

**`src/services/recommendation.ts`** (or the file that currently holds Thompson Sampling recommendation logic) — add three pure functions:
- `applyCompatibilityFilter(templates, impulse_state_space, pointer_state_space)`: returns templates with adjusted scores; does not mutate existing score fields.
- `generatePointerRecommendations(pointer_state_space, impulse_state_space, top20Templates)`: returns the `pointer_recommendations` array.
- `identifyBlockingShapes(top5Templates, impulse_state_space, pointer_state_space)`: returns the `blocking_shapes` array.

All three functions are pure (no DB calls, no I/O). The handler is responsible for fetching templates and passing them in.

**Schema/types** — extend the Zod (or equivalent) schema for the recommend request and response. No new database tables or migrations required.

**Tests** — add unit tests covering:
- Compatibility filter: fully covered template scores unchanged; partially covered scores multiplied by 0.7; uncovered scores multiplied by 0.3.
- Pointer recommendations: shapes ordered by expected utility DESC; shape already in impulse_state_space excluded; top-5 cap respected.
- Blocking shapes: missing input shapes identified; `gap_type` correctly classified (`resolvable | escalatable | scope_upgradeable | budget_blocked | capability_blocked`); deduplication across templates.
- Backward compatibility: empty `impulse_state_space` and absent `pointer_state_space` produce identical output to current behavior.

### minibob

**`src/impulse.ts`** — add `getLoadedImpulseSummaries()` to `ImpulseStore`.

**`src/vessel-discovery.ts`** — add `getAllRegisteredShapes()` to `VesselDiscoveryClient` with 4-minute session cache.

**`src/goal-processor.ts`** — pass both new fields to the recommend call; log pointer recommendations; optionally surface blocking_shapes as a `shape_gap_report` impulse.

---

## D1: Open Questions

**Q1**: Template `input_shapes` field population. The recommendation algorithm needs to read `input_shapes` per template. This field exists on templates that have been explicitly authored with shape declarations. Many legacy templates lack it. For templates with no declared `input_shapes`, the algorithm treats them as fully covered (no gap). This is conservative and correct for legacy templates — but it means those templates will always rank first in the compatibility-filtered order even if they are not actually compatible with the goal. A future cleanup pass (see `2026-04-27-activity-registry-quality-pass`) can add `input_shapes` to legacy templates.

**Q2**: `pointer_hint` population cost. The hint requires a DB lookup into `impulse_resolutions` for prior traces. This is a best-effort feature that adds one DB read per pointer recommendation (up to 5 reads). If the recommendation endpoint latency is already close to SLA, this lookup should be deferred (return hint absent) unless a trace lookup is already happening for another reason. Latency impact should be measured before enabling hint population in the hot path.

**Q3**: Discount factors (0.7 and 0.3) are placeholders. They are reasonable first values but have not been empirically validated. They should be configurable via environment variable (`RECOMMEND_PARTIAL_COVERAGE_DISCOUNT`, `RECOMMEND_NO_COVERAGE_DISCOUNT`) so they can be tuned from deployment configuration without a code change.

**Q4**: `blocking_shapes` `gap_severity` metadata. The current design defaults all `input_shapes` entries to `blocking` unless the template explicitly declares otherwise. This will produce false positives for templates that are tolerant of missing inputs. A follow-on improvement is to add an `optional_input_shapes` field to the template schema, allowing authors to declare which inputs are optional. Until that field exists, all gaps are reported as `blocking`.
