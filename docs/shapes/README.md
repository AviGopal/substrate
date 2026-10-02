# Impulse Shapes

A **shape** is the routing-and-reasoning key on an impulse: it names what kind
of data the impulse carries, which vessel can resolve it, and what a reasoner
can expect to find once it does. Shapes are not schemas. They are the vocabulary
the walk binds along — a producer of shape X and a consumer of shape X compose
because the names agree, not because a type checker proved it.

This file is the index for that vocabulary. It says where the authoritative
lists live, what invariant keeps them honest, and how to add a shape. It does
not restate each shape's fields: a per-shape document goes stale the moment its
vessel changes, and the vessel's advertisement is the thing routing actually
reads. Where per-family prose detail exists, the relevant section links to it.

Grounding for the model these shapes implement:
[IMPULSE_ACTIVITY_FOUNDATION.md](../architecture/IMPULSE_ACTIVITY_FOUNDATION.md).

## Shape design principles

1. **Metadata first, content later.** An impulse carries metadata a reasoner can
   act on before anything is loaded — `shape`, `summary`, `rowCount`, `columns`,
   `sample`, `availableOps`, `producedBy` (the metadata schema is
   `ImpulseMetadataObjectSchema` in `repos/activity-api/src/models/schemas.ts`).
   The point is that a walk can decide whether an impulse is worth resolving
   without paying to resolve it.
2. **Resolvers live where the data lives.** A shape is advertised by the vessel
   that holds its data. Moving the resolver is how you move the data, and
   discovery re-routes without any caller changing.
3. **Shapes are universal.** Any caller — an activity, a dashboard, another
   vessel, the operator cockpit — asks for a shape the same way, through
   `POST /v2/impulses/resolve` against whichever vessel discovery names.
4. **Every resolution is budgeted.** Impulses carry a `budget`, and resolvers
   are expected to return bounded results rather than everything they hold.

## The advertise-and-dispatch invariant

A vessel advertises shapes in one place and dispatches them in another, and the
two must agree. For activity-api that is the `discovery.shapes` array in
[`repos/activity-api/src/config.ts`](../../repos/activity-api/src/config.ts) and
the `switch (pointer.type)` cases in
[`repos/activity-api/src/routes/impulses.ts`](../../repos/activity-api/src/routes/impulses.ts).
Advertising a shape with no case produces a shape the registry promises and the
vessel then answers 404 `use_vessel_discovery` on, because the router's default
branch treats any unrecognised pointer type as somebody else's data. A case with
no advertisement is the mirror failure: a working resolver nothing can route to.

This is a checked invariant, not a convention. `packages/shape-dispatch-check/check.ts`
extracts both sets from source and exits non-zero on either kind of mismatch.
Vessels wire it in as `scripts/check-shape-dispatch.ts`; where the vessel's
`lint` script invokes it, a mismatch fails lint rather than reaching discovery.
Two escape hatches exist and both are explicit: a `// @shape-dispatch:private`
comment above a case excludes it from the orphan-handler check (used for
deprecated stubs that answer 410 Gone), and a `shape-dispatch.config.json` in
the vessel root maps an advertised shape onto differently-named dispatch cases.

The practical consequence for this document: **do not list a shape here that the
checker would not accept.** If it is not advertised and not dispatched, it does
not exist, however plausible the name.

## Shape naming

Names are camelCase for the activity-api families (`activityExecutionTrace`,
`executionTraceList`, `traceAggregateReport`). Snake_case names appear in the
tree — `shape_gap_resolution`, `test_audit_report`, `goal_verification_label` —
because families were added at different times, and they are correct exactly as
advertised. The pointer type is the advertised string, verbatim; there is no
normalisation step that would forgive a case difference.

Beyond casing: name the data the shape returns, not the query that produced it.
Indicate granularity where it matters (`Summary`, `List`, `Report`, `Metrics`).
Suffix `_write` for a mutation shape and keep the read shape's name as the stem,
so a reader can see the pair.

## Activity-api shapes

Resolver: `activity-api`. This is the largest shape family in the fleet because
the vessel holds the largest store: the execution traces, the activity registry,
the Thompson posteriors, and the composition graph all live here, so every shape
over them is advertised here too. The subsections below group them by what they
do to that store — read, search, write, or destroy — and the grouping matters
more than it looks, because a caller that reaches for a write shape when a read
would have answered the question has already changed the thing it was measuring.
The authoritative list is always `discovery.shapes` in the vessel's `config.ts`.

### Activity-api read and query shapes

`activity`, `activityTemplate`, `activityMetrics`,
`activityExecutionTrace`, `executionTraceList`, `executionTraces`,
`executionTraceWithSignatures`, `executionReplicationPull`, `goal`,
`goalExecutionPath`, `goal_verification_label`, `variantMetricsSummary`,
`thompson_posterior`, `contextThompsonScores`, `activityTemplateRecommendation`,
`activityTemplatesByMetrics`, `compositionSuccess`, `compositionGraph`,
`impulseRelevance`, `toolRiskProfile`, `preValidationResult`,
`templateAuditReport`, `traceAggregateReport`, `groupedExecutionStats`,
`topologyCoverage`, `shape_gap_resolution`, `shape_producer_inventory`,
`eventStream`, `mcpTool`, `discoverByShapesQuery`,
`test_registration`, `test_report`, `test_audit_report`,
`sensitivity_evidence`, `code_modification_proposal`.

`db_admin` is advertised alongside them but is not a read: it is the substrate's
surface for managing its own datastore, and it requires an authenticated caller.
The resolver — not the caller — enforces the operation and pattern allowlists,
a dry-run default, a row bound, rejection of catastrophic operations, and an
audit trail.

Three of these are worth calling out because they are the ones a report goal
should reach for. `traceAggregateReport` computes counts and sums in the
database and returns `{key, value}` rows — the answer, not the raw material.
`groupedExecutionStats` returns per-activity count, success rate, and dominant
failure mode in one row, which is how a livelocked family becomes visible.
`activityTemplatesByMetrics` orders templates by learned performance. Each ships
a one-line description in `discovery.shapeDescriptions`, merged across vessels
and served at `GET /registry/shape-descriptions`, so a planner can match a
resolver from its description without a hand-written hint.

### Activity-api search shapes

`activity_search`, `trace_search`, `tool_pattern_search` offer permissive,
non-exact search over the template registry, execution traces, and
tool-argument patterns. They exist for the cold-start path, where a hard shape
filter would return nothing useful: near-misses are surfaced deliberately and
the consuming activity ranks them, with declared output shapes contributing a
soft boost rather than acting as a gate. Reach for them when nothing in the
registry matches exactly and the walk still needs somewhere to start.

### Activity-api write shapes

Each delegates to the same handler as the corresponding REST
endpoint, so an activity can perform a learning-loop write through
`POST /v2/impulses/resolve` without hardcoding a route. The response envelope
suffixes `metadata.shape` with `_result` so a write ack is distinguishable from
a read payload. Advertised and dispatched:
`activityExecutionTrace_write`, `activityFeedback_write`,
`activityComposition_write`, `activityTemplate_write`, `activityVariant_write`,
`impulseRelevance_write`, `toolUsage_write`, `toolArgumentPattern_write`,
`executionSequences_write`, `shapeScore_write`, `shapeGapResolution_write`,
`similarState_write`, `goalSeeking_write`, `execution_write`,
`goal_verification_label_write`, `test_registration_write`,
`test_report_write`, `test_audit_report_write`, `sensitivity_evidence_write`,
`code_modification_proposal_write`. Field-by-field bodies:
[`../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md).
That document also lists `compositionEdge_write`, which is neither advertised
nor dispatched — write composition edges through `activityComposition_write`.

### Activity-api destructive and retired shapes

Three shapes mutate or remove what the learner has already recorded, and all
three require an authenticated caller at the route (`requireAuthenticated` in
activity-api's impulse router) rather than leaving that to the caller:
`activityTemplate_update`, `activityTemplate_deprecate`, and
`activityExecutionTrace_delete`. Past authentication the gates differ. For an
org-scoped template no admin role or scope is consulted: the caller must be in
the owning org, and the write itself is scoped to the caller's own tenant rows.
A global-scope template additionally needs either an admin role
or `admin` scope, or auditable evidence that passes the lifecycle evidence gate
(`validateEvidenceGate`), which answers 422 when the evidence is insufficient.
The trace delete is a hard delete of rows within the caller's own tenant scope,
bounded by a `limit`, and it defaults to a dry run — `dryRun: false` is what
makes it actually delete. Deprecating a template
is almost always the right move over editing one in place — an edited template
carries a posterior earned by a body that no longer exists. See
[`../guides/TEMPLATE_UPKEEP.md`](../guides/TEMPLATE_UPKEEP.md).

`analysisResult`, `cochangeSuggestions`, `impactAnalysis`,
`codebaseSearch`, and `problemCluster` still have cases in activity-api's
router, but each answers 410 Gone with a pointer to the analysis resolver. They
were a proxy path that violated "resolvers live where the data lives"; they are
marked `@shape-dispatch:private` and are not advertised. Resolve code-analysis
shapes against analysis-vessel directly.

## Code analysis shapes

Resolver: `analysis-vessel`, which is stateless — it builds a code property
graph per request through `@avigopal/cpg-inference` and holds no datastore.
Advertised in `repos/analysis-vessel/src/index.ts`: `source_code`, `error_log`,
`problem_detection`, `code_quality`, `code_annotation`, `cpg_query_result`.

## Concept and memory shapes

Resolver: `concept-db` for the concept graph and prose knowledge —
`concept`, `conceptGraph`, `relatedConcepts`, `conceptSearch`,
`conceptSequence`, `conceptUsageStats`, `impulseSignatureConcept`,
`impulseCooccurrenceEdges`, plus the write family (`concept_write`,
`concept_create_write`, `conceptLink_write`, `conceptSignatureUpsert_write`,
`conceptUsage_write`, `conceptSequence_write`,
`conceptCreditDecontaminate_write`) and the `embed` / `cluster` primitives.
This is the vessel whose lessons are read at prompt-build time, which is what
makes a concept written here teach the system rather than only the operator.

Resolver: `development-vessel` for substrate-resident memory and gap state —
`memoryNote` / `memoryNote_write`, `substrateGap` / `substrateGap_write`,
`poolImpulse` / `poolImpulse_write`. The memory store is a JSON file under the
workspace root written atomically, not a table; the shape is the interface and
the storage is the vessel's business.

## Local tool shapes

Resolver: `local-tools-vessel`. Result shapes: `shellResult`, `fileContent`,
`fileWriteResult`, `fileEditResult`, `gitStatus`, `gitDiff`,
`gitCommitResult`, `codeSearchResult`, `codeFindFunctionResult`,
`codeFindImportResult`, `codeInsertResult`, `codeReplaceResult`,
`codeReadResult`, `codeAddImportResult`, `codeTypecheckResult`,
`webSearchResult`.

The same resolvers are also advertised under their tool names — `shell`,
`bash`, `bounded_shell`, `fs_read`, `fs_write`, `fs_edit`, `git_status`,
`git_diff`, `git_commit`, `code_search`, `code_find_function`,
`code_find_import`, `code_insert_after_line`, `code_replace_lines`,
`code_read_lines`, `code_add_import`, `code_verify_typecheck`, `web_search` —
because edit paths drive tools by name. An unadvertised alias makes discovery
answer "no producer" for a resolver that was sitting right there, which is why
both sets are advertised even though they reach the same handlers.

## Inline pointers

Not every impulse is fetched. A resolver that has already computed its result
emits it with `pointer: { type: "memo" }`, `loaded: true`, and the content
inline; `metadata.shape` still names what the content *is*
(`activityExecutionSummary`, `activityExecutionError`, and so on). So `memo` is
a pointer type, not a shape — nothing advertises it, nothing resolves it, and
asking discovery for a `memo` producer is a category error. Read the shape from
the metadata.

## Discovery integration

A vessel registers with discovery at startup, posting its identity, its
endpoint, and its shape list:

```typescript
await fetch(`${DISCOVERY}/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `ApiKey ${key}` },
  body: JSON.stringify({
    vesselId: 'activity-api-local',
    endpoint: 'http://127.0.0.1:8080',
    shapes: ['activityExecutionTrace', 'activityTemplate', 'traceAggregateReport'],
    shape_descriptions: { traceAggregateReport: 'Already-aggregated {key,value} rows …' },
  }),
});
```

Callers do not need to know who serves what. `POST /resolve` on discovery takes
a pointer, finds the healthy vessels advertising that pointer type, picks one
(policy pins first, then a direct local producer over a federated facade), and
forwards the pointer to that vessel's resolve endpoint — `/v2/impulses/resolve`
unless the registration overrode it:

```typescript
const res = await fetch(`${DISCOVERY}/resolve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pointer: { type: 'traceAggregateReport', group_by: 'status' } }),
});
```

With no local producer, discovery forwards to peer instances before answering
404, so a shape served on another substrate resolves through the same call. To
inspect the vocabulary rather than use it: `GET /registry/shapes` returns the
shape names the registry holds, `GET /registry/shape-descriptions`
returns the merged one-liners, and `GET /vessels/:vesselId` returns a single
vessel's registration including the shapes it advertises. Both registry reads
accept `?org_ids=` to scope to shapes reachable by those tenants.

## Adding a new shape

1. **Find the producer first.** If some vessel already advertises a shape that
   covers the need, compose with it. A second name for the same data splits
   routing and teaches the learner nothing.
2. **Put the resolver where the data is.** If the data lives in another
   vessel's store, the shape belongs to that vessel, not to the one that
   happens to want it.
3. **Advertise and dispatch together.** Add the name to the vessel's
   `shapes` array and the matching case to its impulse router in the same
   change, then run the vessel's shape-dispatch check.
4. **Write a description.** One line in `shapeDescriptions` saying what it
   produces and when to use it. This is what a decomposition planner reads;
   without it the shape is reachable only by a caller who already knows it.
5. **Bound the result.** Respect the impulse budget and return a bounded,
   empty-but-valid response rather than a timeout when there is nothing to say.
6. **Return metadata worth reasoning over.** `summary` at minimum; `rowCount`,
   `columns`, and `sample` where the shape is tabular.
7. **Exercise it through a real dispatch** and read the trace. A shape that has
   never been resolved by a walk is a declaration, not a capability.

## Shape evolution

Shapes are living specifications. Fields get added as executions reveal what
callers actually need, `summary` and `sample` get richer as resolvers learn what
made reasoning work, `availableOps` grows as new operations become supported,
and budget guidance tightens as real usage patterns show up in traces.

Renames are the expensive case, because the name *is* the routing key: a rename
strands every stored pointer and every composition edge that referenced the old
string. Prefer adding a new shape and letting the old one age out under the
learner's selection, over renaming one in place.
