# Design — External-Resolver Vesselization

## A. The trace-filter pattern

`observe-external-resolver` reads `activity_execution_traces`
filtered by `(call_kind, target)` and computes a contract over the
matched set.

The per-task `resolver_id` and `resolver_tier` fields are already
present on traces since migration 086 (April 2026) and are written
by the activity executor for every task. Tasks dispatched via
`shell-exec` carry `resolver_id == "shell-exec"`; tasks dispatched
via `http-fetch` or `external-validation` carry the corresponding
resolver id.

What does NOT exist today is a structured `target` field. The target
is buried inside the task config:

- For `shell-exec`: `config.command[0]` (e.g. `"gh"`,
  `"docker"`, `"curl"`).
- For `http-fetch`: `config.url` (e.g.
  `"https://api.example.com/v1/items"`).
- For `external-validation`: depends on validation type —
  `config.connectionString` (db), `config.endpoint` (api),
  `config.command` (test/cmd/script).

The `observe-external-resolver` activity therefore does
**target extraction at scan time**:

```typescript
function extractTarget(task: TaskTrace): string | null {
  switch (task.resolver_id) {
    case "shell-exec":
      return Array.isArray(task.config?.command)
        ? task.config.command[0] ?? null
        : null;
    case "http-fetch":
      return canonicalizeUrl(task.config?.url);  // strip query, lowercase host
    case "external-validation":
      return extractExternalValidationTarget(task.config);
    case "mcp-call":
      return task.config?.method ?? null;
    default:
      return null;
  }
}
```

The scanner groups traces by `(resolver_id, extractTarget(task))`,
discarding tasks where extraction returns null.

**Required addition to activity-api**: the existing trace-list
endpoint (`GET /v2/activities/execution-traces`) does NOT support
filtering by `tasks[].resolver_id`. We add two optional query
parameters: `task_resolver_id` and `task_resolver_target_prefix`.
The first filters at the SurrealDB level via a `WHERE` predicate on
the task array (SurrealDB supports `tasks[WHERE resolver_id = $rid]`
syntax). The second is applied post-fetch by the
`observe-external-resolver` activity's target-extraction logic, not
in SurrealDB, because target extraction is resolver-kind-specific
and not a database concern.

This is the only schema-adjacent change: no new fields, no migration.
Pure query-path extension.

## B. Shape inference

Shape inference takes N example invocations (input impulses) and N
example responses (output impulses) and emits a best-effort JSON
schema for each.

The algorithm is **deterministic JSON schema unification with
pessimistic-union + optional-field detection + type-variance
unrolling**:

1. **Parse each example** into a JSON value. Reject non-JSON
   examples; if more than 20% reject, mark `shape_stability = 0`
   and abort.
2. **Per-key occurrence count**: for each key path (including nested
   paths via dotted notation), count how many examples contain that
   path. Paths appearing in 100% of examples are `required`; paths
   appearing in ≥50% but <100% are `optional`; paths appearing in
   <50% are dropped (treated as caller-specific noise).
3. **Per-key type unification**: for each retained key path,
   collect the set of observed JSON types
   (`string | number | boolean | object | array | null`). If the
   set has one type, the schema entry is that type. If two types
   and one is `null`, schema is `{type, nullable: true}`. If more
   than two types or two non-null types, the schema is
   `{type: "unknown", observed_types: […]}` and the field
   contributes a penalty to shape_stability.
4. **Pessimistic union of nested objects**: for object-typed
   fields, recurse step 2-3 on the nested key set. The unification
   is pessimistic: keys appearing in some-but-not-all nested
   instances are marked optional, never required.
5. **Array element schema**: if a field is array-typed, infer the
   element schema by unioning step 2-3 over the union of all
   elements across all examples. Arrays of mixed primitives degrade
   to `{type: "unknown"}`.
6. **shape_stability score**: starts at 1.0, decremented by:
   - 0.1 per optional top-level field (max 0.3 from this).
   - 0.15 per type-variance field (max 0.3 from this).
   - 0.2 if step 1 had any rejected examples (max 0.2).
   - 0.3 if N < 20 (below this floor, signal is weak).
   Final value clamped to [0, 1].

This is intentionally not a full JSON-schema-merge library. It is
the minimum that captures the substrate's empirical use of an
external — enough to type a vessel's input/output, not enough to
fully validate every edge case. The minted vessel inherits the
generic-resolver fallback for unmatched inputs.

## C. Vesselization composition

`vesselize-external-resolver` is an activity template whose tasks
compose `forge-vessel-for-shape`'s eight tasks plus one new task. The
exact composition:

| Position | Task | Source | Notes |
|---|---|---|---|
| 1 | `check_recursion_depth` | forge | unchanged |
| 2 | `compose_vessel_spec` | forge | input augmented with the contract impulse so the LLM produces a vesselSpec whose `inputSchema`/`outputSchema` match the contract |
| 3 | `scaffold_vessel_skeleton` | forge | unchanged |
| 4 | **`wire_external_call_pass_through`** | **new (this spec)** | inserts the proxy resolver implementation generated from the contract; sits between scaffold and discovery wiring because the proxy code is the vessel's *purpose*, and discovery + auth wraps it |
| 5 | `wire_discovery_registration` | forge | unchanged |
| 6 | `wire_auth_blueprint` | forge | unchanged |
| 7 | `docker_build_push` | forge | unchanged |
| 8 | `helmfile_sync` | forge | unchanged |
| 9 | `verify_three_invariants` | forge | unchanged |

The new task takes the `externalResolverContract` impulse and the
`vesselScaffold` impulse from task 3, writes a single TypeScript
file (`src/resolvers/external-proxy.ts`) into the scaffold, and
emits `vesselScaffoldWithProxy` for task 5 to consume in place of
`vesselScaffold`.

The forge pipeline's existing `vesselScaffold → vesselWithDiscovery
→ vesselWithAuth` chain is unmodified — the new task slots a
`vesselScaffoldWithProxy` step between scaffold and discovery,
preserving the rest of the chain by name. Existing forge tasks see
their expected input shapes; only task 5's `inputShapes` array is
amended in the composing template (`vesselScaffold` →
`vesselScaffoldWithProxy`).

The `vesselize-external-resolver` activity is the *only* place that
re-orders the forge pipeline. The forge primitive itself (the
eight-task template in `forge-vessel-for-shape.json`) is untouched
and continues to be dispatched directly from
`slot-binding/escalate_unbindable` for non-external shapes.

## D. The `wire-external-call-pass-through` resolver

A new substrate-resident resolver registered with `VesselForgeHost`
(in `repos/ias-executor-ts/src/examples/vessel-forge-host.ts` or
its successor host).

**Input impulses**:

- `externalResolverContract` (body per spec §R1).
- `vesselScaffold` (body `{ scaffold_path: string }` — the
  filesystem path under `/tmp/forge_<uuid>/` containing the scaffold
  tree).

**Output impulse**:

- `vesselScaffoldWithProxy` (body `{ scaffold_path, proxy_file_path,
  inferred_shape_name }`).

**Implementation outline**:

1. Read the contract impulse.
2. Generate a TypeScript file at
   `{scaffold_path}/src/resolvers/external-proxy.ts` with the
   following structure (the body is a code template, not LLM-
   generated — fully deterministic):

   ```typescript
   import { Resolver, Impulse } from "@avigopal/ias-executor-ts";
   import { dispatchGenericResolver } from "./dispatch-generic.ts";

   export const externalProxyResolver: Resolver = {
     id: "<inferred_shape_name>",
     resolve: async (impulse: Impulse): Promise<Impulse> => {
       // Translate input impulse → original call format
       const callArgs = translateInput(impulse, /* embedded contract */);

       // Invoke the original generic resolver via in-process dispatch
       const rawResponse = await dispatchGenericResolver(
         /* call_kind */, /* target */, callArgs
       );

       // Translate response → output impulse
       const outputBody = translateOutput(rawResponse, /* embedded contract */);

       // Compute signal_confidence_weight per design §E
       const weight = computeWeight(/* contract.shape_stability */,
                                    /* observed success rate */);

       return {
         shape: "<inferred_shape_name>",
         body: outputBody,
         signal_confidence_weight: weight,
       };
     },
   };
   ```

3. The embedded contract is JSON-stringified into the generated file
   as a constant. No runtime lookup back to activity-api.
4. The `dispatchGenericResolver` helper is also generated by this
   task in the same scaffold; it calls the appropriate generic
   resolver based on the `call_kind` in the contract.
5. The resolver advertises `<inferred_shape_name>` per the
   contract's `vesselization_readiness.recommended_shape_name`.

The resolver is deliberately simple. It does not parse the response
beyond the contract's inferred shape. It does not retry beyond what
the underlying generic resolver does. It does not learn — learning
happens at the trace layer, the same way it does for every other
vessel.

## E. Confidence weighting on external vessels

Every impulse emitted by a vesselized external resolver carries
`signal_confidence_weight` computed at resolution time:

```
weight = base × shape_stability × observed_success_rate
```

- `base = 0.7` — the external-source ceiling (per the trust-weighting
  sibling's default). External services are corroborable but not
  authoritative.
- `shape_stability` — taken from the contract; in [0, 1]. Computed
  by the §B inference and embedded in the generated proxy.
- `observed_success_rate` — recomputed by the proxy at resolve
  time, sliding-window over the most recent 100 calls through the
  proxy. Starts at the contract's `success_count / sample_size`.

Result clamped to [0.3, 0.7]:

- Lower bound 0.3 — a vessel still earns more credit than an
  un-vesselized generic-resolver call, because the contract has
  been verified to produce a typed shape.
- Upper bound 0.7 — external evidence never reaches in-substrate
  authority (1.0).

Operators may override per-vessel via the existing
operator-configurable trace-write contract (the
`signal_confidence_weight` field on the
`activity_execution_trace_write` impulse — set externally and the
formula above is replaced for that vessel until cleared).

## F. Relationship to existing external-validation resolver

The generic `external-validation` resolver stays as the **bootstrap
path** for first-N calls to any external service. The substrate has
no contract for an unseen external; it must call through the generic
resolver to accumulate the traces that will eventually become a
contract.

Once `observe-external-resolver` produces a contract with
`vesselization_readiness.passes_*` all true, the
`vesselize-external-resolver` activity can be dispatched (either
substrate-initiated or operator-initiated). After the minted vessel
boots and registers with discovery, calls for the matched shape are
routed through the new vessel by the standard discovery shape lookup.

Calls that *don't* match any vesselized shape — either because they
target a different external service, or because their input
signature falls outside the contract — continue to route through
`external-validation` / `shell-exec` / `http-fetch`. No breaking
change.

The bootstrap → vesselize transition is observable in the trace
stream: prior to vesselization, traces for the external carry
`resolver_id ∈ {shell-exec, http-fetch, external-validation}`; after
vesselization, they carry `resolver_id = <minted-vessel-resolver-id>`
and `resolver_tier = "deterministic"` (the proxy is deterministic
even though it ultimately calls an external service — the resolver
itself contains no LLM reasoning).

## G. Trust circle position

External-resolver vessels sit in a distinct position in the
substrate's trust topology:

|  | Substrate-internal vessels | External-resolver vessels (this spec) | Federation peers (H1/H6) |
|---|---|---|---|
| Discovery participant | yes | yes | yes (via peer-discovery) |
| Receives traces back into substrate posteriors | yes (weight=1.0) | yes (weight ≤ 0.7) | yes (weight per attestation) |
| Can sign its own traces (ZK attestation) | yes | **no** | yes |
| Trust derived from | shared substrate identity | empirical contract + corroboration | cryptographic attestation |

The external service the vessel proxies is not a substrate
participant and will not sign traces. ZK trace attestations
(sibling spec `2026-05-23-zk-trace-attestations`) do NOT apply to
external-resolver-vessel impulses. Trust comes from *corroboration*:
when multiple distinct activities reach the same conclusion via the
same external vessel, confidence in that vessel's outputs accrues
through the standard Thompson posterior, weighted by the §E formula.

This position is durable. Even after federation peers earn full
weight via H6, external-resolver vessels remain capped at 0.7
because the external service is structurally outside the trust
circle.

## H. Resolved questions

**Q1: Why not just import the OpenAPI / Swagger spec for the
external service?**

Three reasons. (1) Many externals don't publish a machine-readable
spec — `gh`, `docker`, custom MCP servers, internal corporate APIs.
The empirical-trace path covers all of them uniformly. (2) Documented
schemas frequently diverge from actual behavior — version skew,
undocumented optional fields, deprecated-but-still-returned fields.
The empirical shape is what the substrate actually uses. (3) The
trust model is corroboration-based, not authority-based; an
OpenAPI spec is a claim by the service vendor, while N successful
traces are evidence-of-behavior. The substrate prefers evidence.

**Q2: What if the external service changes its API?**

`shape_stability` will degrade on subsequent observation runs.
`observe-external-resolver` re-emits a contract with degraded
stability. Three responses are possible: (a) the substrate
re-vesselizes (mint a new vessel version, deprecate the old via
existing `activityTemplate_deprecate` flow); (b) operator
intervention if the change is breaking and ambiguous; (c) the
minted vessel's β-rate spikes from real failures, β > α + 5
threshold triggers retirement through the same machinery
`llm-to-deterministic-distillation` uses for distilled-resolver
retirement. No new mechanism.

**Q3: Bootstrap problem — how does the first external get
vesselized if vesselization requires N traces, and N traces only
accumulate if someone is calling the external in the first place?**

Operators pre-seed common externals through normal activity-template
authoring: an operator writes an activity that calls `gh pr list`
via `shell-exec`. After 50 successful runs, the substrate has the
trace history to vesselize autonomously. The bootstrap is the
substrate's existing operator-authored activity catalog. Future
spec may add explicit operator-declared "expected externals" hints,
but this spec does not need them.

**Q4: What if two external services produce the same shape name
(collision)?**

Same as the existing forge-vessel-for-shape collision case (see
that template's `openQuestions`): discovery-vessel will see two
vessels advertising the same shape. Today the system tolerates this
(slot-binding's `producer_selection` Thompson-samples among them).
The `recommended_shape_name` in the contract incorporates the
target into the name (e.g., `githubPrList` rather than `prList`)
to minimize accidental collision.

**Q5: Does this change break the existing `external-validation`
contract?**

No. R6 specifies non-breaking coexistence. The generic resolver's
public surface, error categorization, and Thompson weighting are
unchanged. Vesselization is purely additive.

## I. Open question (flagged, not resolved)

**Q6: SurrealDB array-element predicate filtering.** §A assumes
SurrealDB supports `tasks[WHERE resolver_id = $rid]` syntax in a
`WHERE` clause on a list endpoint. The activity-api codebase's
existing trace queries (`repos/metabob-activity-api/src/routes/
execution-traces.ts`) filter on top-level fields (`vessel_id`,
`activity_template_id`, time windows) but not on nested-task
predicates. If the SurrealDB query planner cannot push the
nested-task predicate down efficiently, the §A filter falls back
to application-side filtering after fetching a broader window
(activity-api already does this for some queries — see the
`legacy fallback path` in execution-traces.ts:641). The fallback
is correct but slower; the §A query parameters do not change
shape, only execution path. Flag for implementation triage.
