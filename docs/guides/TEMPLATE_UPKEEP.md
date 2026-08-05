# Template Upkeep Pipeline

**Source:** `repos/activity-api`, plus the generic dispatch primitive on the execution host.

Activity templates accumulate with use. Authors churn shape names (`gitDiff` vs `git_diff` vs `GitDiff`), skip `tags`, write one-line descriptions, hardcode URLs in prompts, or rely entirely on LLM tasks where a deterministic resolver would do. The system observes this drift and corrects it through the impulse-activity loop itself — no dedicated admin REST surface, no out-of-band scripts.

The observe and correct ends of the pipeline are in place: the shape-observation utility, the `templateAuditReport` read resolver, the generic `impulse-resolve` dispatch primitive, and the `activityTemplate_update` / `activityTemplate_deprecate` write resolvers. **What is missing is the activity in the middle.** No `audit-and-backfill-templates` template exists in any vessel, so nothing drives a read of the audit report into a write of the correction; the layers are wired but unattended. §4 describes the activity that closes the loop, and is the design for it rather than a description of something running.

> **Foundation alignment.** Templates are themselves impulses: an activity template is an impulse of shape `activity_template`. The upkeep pipeline is one vessel (activity-api) auditing and rewriting its own advertised shapes through the same resolve/write contract any other vessel would use — consistent with the decentralized "vessels contribute learning parameters arbitrarily" model. Shapes are learned types, not a canonical vocabulary; the descriptive-not-prescriptive stance below is the correct posture.

```
observed-shapes (util)          ← what's in use
       │
       ▼
templateAuditReport (read)      ← what's deficient
       │
       ▼
impulse-resolve (execution host)
       │
       ▼
an upkeep activity (design — no such template exists)
       │
       ▼
activityTemplate_update / _deprecate (write)   ← the correction
```

## 1. `observed-shapes` utility — descriptive, not prescriptive

**Location:** `repos/activity-api/src/utils/observed-shapes.ts`.

Shapes in this system are **learned** semantic types that emerge from template authorship and execution traces — not a fixed canonical vocabulary. The utility reports what is in use without enforcing an allow-list.

- **`observeShapes()`** — scans both the paradigm `activity` table and the legacy `activity_template` view/table, degrading gracefully if either is absent. Returns per-template and per-task shape sets.
- **`findAliasClusters()`** — conservative heuristic: normalized equality, bounded Levenshtein distance, guarded substring containment. Minimizes false merges. Surfaces probable alias groups like `{gitDiff, git_diff, GitDiff}` or `{errorLog, error_log}`.

**Deliberately descriptive:** no validation, no rejection, no gatekeeping. Downstream consumers decide what to do with drift signals.

## 2. `templateAuditReport` read resolver

**Shape:** `templateAuditReport`.
**Route:** advertised; resolve via `POST /v2/impulses/resolve` with pointer `{ type: "templateAuditReport", ... }`.
**Location:** `repos/activity-api/src/routes/template-audit.ts` (`runTemplateAuditReport`), dispatched from the `templateAuditReport` case in `src/routes/impulses.ts`.

Authenticated callers only — the dispatch case early-rejects anonymous requests before any query runs. It reads templates (deduplicated across paradigm + legacy sources) and returns a per-template deficiency report. Fields flagged:

- Missing or migration-044-default `input_shapes` / `output_shapes`
- Missing `tags`
- Weak descriptions (too short, boilerplate)
- All-LLM task graphs (no deterministic resolvers)
- Undeclared task outputs
- Hardcoded URLs in prompts / task configs

Optional enrichment:
- **Semantic-tags backfill proposals** — derived from `semantic-tags.ts` keyword mappings
- **Alias clusters** — reusing `findAliasClusters()` from the observe utility

This resolver is **read-only**. It writes nothing; it produces the evidence the correction layer acts on.

## 3. Host dispatch: the `impulse-resolve` resolver

**Location:** `makeImpulseResolveResolver` in
`repos/ias-executor-ts/src/resolvers/impulse-resolve.ts`, wired into the goal
host's resolver set.

A generic `pattern`-tier resolver that takes a pointer from task `config` and POSTs it to `{activityApiEndpoint}/v2/impulses/resolve`, returning the response as a single **memo** impulse whose `metadata.shape` is the pointer's type. Any shape the backend advertises becomes callable from an activity task's JSON without writing a bespoke resolver per shape.

**Contract:**
- **`config.pointer`** — required; an object with a non-empty `.type`. Validated before the network call, and a missing or empty type throws.
- **`config.pointerFromImpulseSlots`** — optional `{ "<pointerField>": "<slotName>" }` map. Each named slot is located among the task's input impulses (matching on `outputImpulseKey` or `shape`, most recent first), its content parsed, and the result merged into the pointer **as a value**. A referenced slot that is absent throws loudly rather than silently omitting the field — a silently-dropped `templateData` turns a write into a 400 the chain cannot see.
- **Slot parsing tolerance** — a slot's content may be an object, a fenced JSON block, an LLM envelope with the payload under `text` / `content` / `completion` / `body`, or prose with a JSON object embedded in it. The resolver unwraps envelopes, strips fences, and falls back to slicing the first balanced top-level object. Unparseable strings pass through as strings.
- **Never string-spliced.** Parsed slot content is assigned as a value, not interpolated into a JSON body — that splicing is how raw multi-line model output corrupts writes.
- **Graceful degradation** — with no endpoint or API key configured, the resolver returns an empty impulse carrying the requested shape so consumers can detect the unconfigured state instead of failing opaquely.

This is the mechanism that makes "all communication through resolvers and shapes" true at the task level. The shape vocabulary scales with the learning loop — no code change in the host per new shape. `pointerFromImpulseSlots` closes the loop: the pointer's fields are themselves data, so one task's decision becomes the next task's write without the host needing per-shape resolvers.

## 4. The upkeep activity — design, not shipped

**No such template exists in any vessel.** The layers above and below it are live; nothing joins them. This section is the design for the activity that would, and the gap it names is the reason the pipeline corrects nothing on its own.

It should be a **single-candidate-per-invocation** upkeep activity: drain the template-metadata-deficiency queue one item at a time, re-run until the deficient set converges. Each invocation is one execution trace — which is what Thompson Sampling needs in order to learn whether this variant is actually reducing deficiencies over time. A batch-everything variant would produce one trace covering many heterogeneous decisions and teach the loop nothing.

Four tasks:

1. **`fetchWorstCandidate`** *(deterministic, read-only)* — `impulse-resolve` with a static `templateAuditReport` pointer, requesting `includeProposals` + `includeAliasWarnings`, returning the single worst-scored template. No LLM, no write.
2. **`decideUpdate`** *(LLM)* — applies the safety rules below and emits **either** a full pointer object `{type: "activityTemplate_update", templateId, updates}` **or** a skip sentinel `{skip: true, reason: "..."}`. Pure decision, no side-effect.
3. **`applyUpdate`** *(deterministic, gated)* — runs only when **both** an `applyChanges` variable is true **and** the decision produced an apply-pointer. Uses `impulse-resolve` with `pointerFromImpulseSlots` to forward the model-produced fields straight into an `activityTemplate_update` pointer. No per-shape resolver, no host change, no string-splicing over nested objects.
4. **`summarize`** *(LLM, always runs)* — a short summary that explicitly flags any `hardcoded_urls` deficiency for human review.

### Safety defaults

- **`applyChanges` defaults to false.** Out-of-the-box behavior is observe-and-decide without writing. Flip it in the goal invocation when writes are actually wanted.
- **Description never auto-backfilled.** Description is too load-bearing for automated rewording at scale without human review.
- **Shapes never auto-backfilled for alias-warning entries.** If the auditor flagged a shape as part of an alias cluster (`{gitDiff, git_diff, GitDiff}`), the activity must not pick one — that is an explicit human decision.
- **Templates with non-empty `deficiencies.hardcoded_urls` are skipped** and flagged for human review. A URL in a prompt is almost always a deployment-specific accident that a model should not guess at.

### Why this shape of activity works

The four-task split maps cleanly onto the impulse-activity model: two deterministic reads (`impulse-resolve`) bookend the one LLM decision, with a gated write that reuses the decision as data. Every step is traced. The LLM appears only where genuine reasoning is needed. And because task 3 routes the pointer *through* the impulse system rather than interpolating strings into it, a new `activityTemplate_*` write resolver would be callable without any change to the template.

It composes into broader workflows: "tidy the registry then recommend a variant" is two activities, not a monolith.

## 5. `activityTemplate_update` / `activityTemplate_deprecate` write resolvers

Already documented in [`../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) §Destructive shapes. Briefly:

- `activityTemplate_update` — takes `templateId` plus an `updates` object, and rejects any field outside the allowlist `name`, `description`, `tags`, `tasks`, `input_shapes`, `optional_input_shapes`, `output_shapes`, `deprecated`, `retired`.
- `activityTemplate_deprecate` — soft-delete.
- Both emit an `upkeepAuditLog` impulse with before/after diff and reason.
- Unauthenticated callers get 401 before any SQL runs. On a **global-scope** template an admin caller passes straight through; a non-admin caller must supply auditable `evidence` — `validateEvidenceGate` (in `src/routes/impulses.ts`) requires a non-empty `reason` for an update, and for a deprecate additionally requires Thompson posteriors whose winner mean beats the loser by a configured delta over a minimum sample count. Evidence that does not clear the gate is rejected as `insufficient_evidence` rather than silently applied; the substrate's own posteriors are the intended safety mechanism, in place of an operator-only restriction. The 403 in these cases is for a different condition — a non-global template belonging to another org. An existence check is deliberately split from the permission check so a missing template returns 404 rather than conflating the two.

**`retired` is updatable in both directions, on purpose.** It is the operative lifecycle flag — selection, shape discovery and the template listing all filter on it — and for a period nothing could clear it: deprecation set it and no impulse, endpoint or service unset it. A lifecycle decision that can only be made one way is not a managed lifecycle, and the only recourse left was hand-editing the database, which this repo forbids. Restoring an arm is the safe direction (it returns a producer to the candidate pool rather than removing one), so it sits with the ordinary write-scope updates rather than behind the evidence gate that guards deprecation. The failure that motivated this: an automated sweep retired working arms on a miscomputed success rate, and there was no supported way to give them back.

## Design notes

**Why descriptive at every read layer?** Shapes are learned. A gatekeeper would ossify the vocabulary and suppress the drift signal the learning loop needs. Correction happens through explicit writes by explicit activities with explicit audit trails — not through implicit validation at read time.

**Why route mutations through impulses?** So every edit to the template registry is:
- traced (the activity execution trace records it)
- authenticated (same auth path as every other resolver call)
- audited (`upkeepAuditLog` impulse on success)
- composable (the upkeep activity is just another activity)

A dedicated REST API would have bypassed all four.

**Why `impulse-resolve` as a primitive?** It decouples the host's resolver set from the backend's shape advertisement. New shape on the backend → usable in task JSON the next run. No redeploy of the host, no code change per shape.

## Sibling upkeep flow: stale-trace cleanup

The same four-task pattern applied to execution traces rather than template metadata. Its resolver surface is live — `executionTraceList` reads candidates, `activityExecutionTrace_delete` is the destructive write, `upkeepAuditLog` is the record — and a runbook lives in the activity-api submodule at [`repos/activity-api/docs/testing/CLEANUP_UPKEEP_RUNBOOK.md`](../../repos/activity-api/docs/testing/CLEANUP_UPKEEP_RUNBOOK.md).

The activity template itself, like §4's, is absent. It once shipped through `repos/activity-api/sql/migrations/078-register-cleanup-templates.surql`; that migration's insert blocks were removed and it is retained as a numbered no-op, because re-running it on every redeploy inserted rows with no explicit ids and so minted duplicate records each time. **Templates do not belong in migrations** — a migration is applied repeatedly and a template insert without a stable id is not idempotent. Template ownership belongs with the vessel that serves them and with ribosome extraction.

The shape the flow takes:

```
executionTraceList (read)       ← candidates older than N days
       │
       ▼
activityExecutionTrace_delete   ← destructive write
       │
       ▼
upkeepAuditLog                  ← trace of what was deleted
```

Properties such an activity should hold:

- Scope global, so organisations see it via `SELECT PERMISSIONS` that include `scope='global'`.
- `dryRun` true by default: the decide task short-circuits to a preview report listing candidate ids without touching the database. Flipping it to false is what actually deletes.
- Admin-gating enforced by the destructive resolver at SurrealDB `PERMISSIONS`, not at the template metadata level. A non-admin invocation therefore fails at the write task with a database-level permission error rather than earlier — which is the right place for it, since the database is the thing that must not be fooled.
- Thompson priors neutral at Beta(1,1), so the recommend path surfaces it once it has at least one execution.

**Why this matters:** the pattern scales. Any "observe → decide → destructive write → audit" upkeep can follow the same four-task shape, so a cleanup-orphan-impulses or reconcile-variant-metrics activity would be a sibling, not a new mechanism. It is also why the missing activities are a gap rather than a design choice: every layer they need is live, and nothing joins them.

## Related

- [`../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) — the write/destructive resolver contract
- deprecation semantics and recommend-path filtering are handled via `activityTemplate_deprecate` (see `../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`)
- [`./ACTIVITY_TASK_CONTEXT_PROPAGATION.md`](./ACTIVITY_TASK_CONTEXT_PROPAGATION.md) — how task JSON sees the impulses `impulse-resolve` produces
- [`../shapes/README.md`](../shapes/README.md) — shape catalog and evolution semantics
