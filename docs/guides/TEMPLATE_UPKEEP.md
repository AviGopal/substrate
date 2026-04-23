# Template Upkeep Pipeline

**Status:** All five layers landed 2026-04-22. The consuming activity (`audit-and-backfill-templates`) landed in `minibob` v0.8.0 (`22ec545`).
**Sources:** `repos/metabob-activity-api`, `repos/minibob`

Activity templates accumulate with use. Authors churn shape names (`gitDiff` vs `git_diff` vs `GitDiff`), skip `tags`, write one-line descriptions, hardcode URLs in prompts, or rely entirely on LLM tasks where a deterministic resolver would do. The system observes this drift and corrects it through the impulse-activity loop itself — no dedicated admin REST surface, no out-of-band scripts. Five layers:

```
observed-shapes (util)          ← what's in use
       │
       ▼
templateAuditReport (read)      ← what's deficient
       │
       ▼
impulse-resolve + template-upkeep wrappers (minibob)
       │
       ▼
audit-and-backfill-templates (activity)
       │
       ▼
activityTemplate_update / _deprecate (write)   ← the correction
```

## 1. `observed-shapes` utility — descriptive, not prescriptive

**Landed:** activity-api commit `c373bb4` (2026-04-22).
**Location:** `repos/metabob-activity-api/src/utils/observed-shapes.ts`.

Shapes in this system are **learned** semantic types that emerge from template authorship and execution traces — not a fixed canonical vocabulary. The utility reports what's currently in use without enforcing an allow-list.

- **`observeShapes()`** — scans both the paradigm `activity` table and the legacy `activity_template` view/table, degrading gracefully if either is absent. Returns per-template and per-task shape sets.
- **`findAliasClusters()`** — conservative heuristic: normalized equality, bounded Levenshtein distance, guarded substring containment. Minimizes false merges. Surfaces probable alias groups like `{gitDiff, git_diff, GitDiff}` or `{errorLog, error_log}`.

**Deliberately descriptive:** no validation, no rejection, no gatekeeping. Downstream consumers decide what to do with drift signals.

## 2. `templateAuditReport` read resolver

**Landed:** activity-api commit `5a70e13` (2026-04-22).
**Shape:** `templateAuditReport`.
**Route:** advertised; resolve via `POST /v2/impulses/resolve` with pointer `{ type: "templateAuditReport", ... }`.

Reads templates (deduplicated across paradigm + legacy sources) and returns a per-template deficiency report. Fields flagged:

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

## 3. Minibob dispatch: `impulse-resolve` + typed wrappers

**Landed:** minibob commits `13c84b2` (impulse-resolve, 2026-04-22 17:55) and `5725da9` (typed wrappers, 17:45).

### `impulse-resolve` — generic primitive

**Location:** `repos/minibob/src/resolvers/impulse-resolve.ts` (new), registered in `activity.ts` alongside `RibosomeResolver`.

A generic resolver that takes a pointer from task `config` and dispatches it through `MCPClient.resolveImpulse`, returning the backend content as a single **memo** impulse. Any shape the backend advertises becomes callable from an activity task's JSON without writing a bespoke resolver per shape.

**Contract (two pointer-source variants, exactly one required):**
- **`config.pointer`** — static pointer object literal in task JSON, validated before the network call. Use when the target shape and arguments are known at authoring time (e.g. `{ type: "templateAuditReport" }`).
- **`config.pointerFromImpulse`** *(minibob `095f05c`, 2026-04-22)* — names an input impulse whose content is a JSON-encoded pointer object. The resolver parses it at runtime and forwards it to `MCPClient.resolveImpulse`. Use when a previous task produced the pointer (e.g. Task 2 of `audit-and-backfill-templates` emits `{ type: "activityTemplate_update", templateId, updates }` for Task 3 to execute). The referenced impulse is loaded through an injectable loader — defaults to module-level `loadImpulses`, same pattern as `git-resolver` — so tests stub loading without touching the global impulse store.
- **Errors:** setting both variants or neither throws; missing-or-malformed JSON and missing `type` each throw descriptively naming the source impulse.
- Pointer is forwarded to `MCPClient.resolveImpulse` unchanged — no variable interpolation (executor's job), no JSON parsing of the response (consumer's job).
- Output: one `memo` impulse; metadata records `shape` (the pointer type) and `resolver: "impulse-resolve"` for learning-loop attribution.
- Transport errors propagate with `impulse-resolve(<type>) failed: ...` prefix so trace analysis can attribute failures.
- `enabled` tracks MCP client availability; registration gated on `isMCPEnabled()` + a live client (same pattern as `RibosomeResolver`).

This is the mechanism that makes "all communication through resolvers and shapes" true at the task level. The shape vocabulary scales with the learning loop — no code change in minibob per new shape. `pointerFromImpulse` closes the loop: the pointer itself is data, so one task's LLM decision becomes the next task's write without the executor needing per-shape resolvers or string-template gymnastics over nested objects.

### `template-upkeep` typed wrappers

**Location:** `repos/minibob/src/clients/template-upkeep.ts`.

Thin TypeScript wrappers around `activityTemplate_update`, `activityTemplate_deprecate`, and `templateAuditReport` that go through `POST /v2/impulses/resolve` (never direct REST — per the [LEARNING_LOOP_WRITE_RESOLVERS](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) contract) and `JSON.parse` the returned memo content into typed results. Used by code paths that want compile-time types on these shapes without paying the generic-pointer serialization cost.

## 4. `audit-and-backfill-templates` activity

**Landed:** minibob commits `22ec545` (activity JSON, 2026-04-22 19:17) and `a556338` (conditional-idiom fix, 19:21). Bundled into v0.8.0.
**Location:** `repos/minibob/src/embedded-templates/audit-and-backfill-templates.json`.

A **single-candidate-per-invocation** upkeep activity: it drains the template-metadata-deficiency queue one item at a time. Re-run until the deficient set converges. Each invocation is one execution trace — which is what Thompson Sampling needs to learn whether this variant is actually reducing deficiencies over time.

Four tasks:

1. **`fetchWorstCandidate`** *(deterministic, read-only)* — `impulse-resolve` with a static `templateAuditReport` pointer, requesting `includeProposals` + `includeAliasWarnings`, returning the single worst-scored template. No LLM, no write.
2. **`decideUpdate`** *(LLM)* — applies the safety rules below and emits **either** a full pointer object `{type: "activityTemplate_update", templateId, updates}` **or** a skip sentinel `{skip: true, reason: "..."}`. Pure decision, no side-effect.
3. **`applyUpdate`** *(deterministic, gated)* — only runs when **both** `applyChanges = true` (activity variable) **and** the decision produced an apply-pointer. Uses `impulse-resolve` with `pointerFromImpulse: "decision"` to forward the LLM-produced pointer straight to `activityTemplate_update`. No per-shape resolver; no executor change; no string-template gymnastics over nested objects.
4. **`summarize`** *(LLM, always runs)* — 3–5 bullet summary; explicitly flags any `hardcoded_urls` deficiency for human review.

### Safety defaults

- **`applyChanges = false` by default.** Phase 2 is gated off, so the out-of-the-box behavior is observe-and-decide without writing. Flip to `true` in the goal invocation when you actually want writes.
- **Description never auto-backfilled.** Description is too load-bearing for LLM rewording at scale without human review.
- **Shapes never auto-backfilled for alias-warning entries.** If the auditor flagged a shape as part of an alias cluster (`{gitDiff, git_diff, GitDiff}`), the activity won't pick one — that's an explicit human decision.
- **Templates with non-empty `deficiencies.hardcoded_urls` are skipped** and flagged for human review. URLs in prompts are almost always a deployment-specific accident the LLM shouldn't guess at.

### Why this shape of activity works

The four-task split maps cleanly onto the impulse-activity model: two deterministic reads (`impulse-resolve`) bookend the one LLM decision, with a gated write that reuses the decision as data. Every step is traced. The LLM only appears where genuine reasoning is needed. And because Task 3 routes the pointer *through* the impulse system rather than interpolating strings into it, a new kind of `activityTemplate_*` write resolver (e.g. `activityTemplate_restore`) would be callable without any activity-template change.

Composes trivially into broader workflows: "tidy the registry then recommend a variant" is two activities, not a monolith.

## 5. `activityTemplate_update` / `activityTemplate_deprecate` write resolvers

Already documented in [`../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) §Destructive shapes. Briefly:

- `activityTemplate_update` — whitelisted MERGE (fields: `name`, `description`, `tags`, `tasks`, `input_shapes`, `output_shapes`, `deprecated`)
- `activityTemplate_deprecate` — soft-delete: sets `deprecated = true`
- Both emit an `upkeepAuditLog` impulse with before/after diff and reason
- Admin-only via SurrealDB `PERMISSIONS`; unauthenticated callers get 401 before SQL runs

## Design notes

**Why descriptive at every read layer?** Shapes are learned. A gatekeeper would ossify the vocabulary and suppress the drift signal the learning loop needs. Correction happens through explicit writes by explicit activities with explicit audit trails — not through implicit validation at read time.

**Why route mutations through impulses?** So every edit to the template registry is:
- traced (the activity execution trace records it)
- authenticated (same auth path as every other resolver call)
- audited (`upkeepAuditLog` impulse on success)
- composable (the upkeep activity is just another activity)

A dedicated REST API would have bypassed all four.

**Why `impulse-resolve` as a primitive?** It decouples minibob's resolver set from the backend's shape advertisement. New shape on the backend → usable in task JSON the next run. No redeploy of minibob, no code change per shape.

## Sibling upkeep flow: `cleanup-stale-traces-v1`

**Landed:** activity-api commit `c4c95ba` (2026-04-22), registered via migration `078-register-cleanup-templates.surql`. Runbook lives in the activity-api submodule at [`repos/metabob-activity-api/docs/testing/CLEANUP_UPKEEP_RUNBOOK.md`](../../repos/metabob-activity-api/docs/testing/CLEANUP_UPKEEP_RUNBOOK.md).

A second concrete upkeep activity that exercises the same resolver surface as audit-and-backfill — but against execution traces rather than template metadata:

```
executionTraceList (read)       ← candidates older than N days
       │
       ▼
activityExecutionTrace_delete   ← destructive write
       │
       ▼
upkeepAuditLog                  ← trace of what was deleted
```

- Scope is global (seeded with the system `org_id`, matching migration 058's bootstrap pattern); organisations see it via `SELECT PERMISSIONS` that include `scope='global'`.
- `dryRun=true` by default: task 2 short-circuits to a preview report listing candidate ids without touching the DB. Flip to `dryRun=false` to actually delete.
- Admin-gating is not enforced at the template metadata level — the destructive resolver itself enforces it at SurrealDB `PERMISSIONS`. A non-admin invocation therefore fails at task 3 with a DB-level permission error, not earlier.
- Thompson priors seeded `Beta(1,1)` neutral, so the recommend path surfaces it once it has at least one execution.

**Why this matters for the narrative:** the pattern scales. Any "observe → decide → destructive write → audit" upkeep can follow the same four-task shape. A future `cleanup-orphan-impulses-v1` or `reconcile-variant-metrics-v1` is a sibling, not a new mechanism.

## Related

- [`../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md`](../impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) — the write/destructive resolver contract
- [`./ACTIVITY_LIFECYCLE_DEPRECATION.md`](./ACTIVITY_LIFECYCLE_DEPRECATION.md) — deprecation semantics and recommend-path filtering
- [`./ACTIVITY_TASK_CONTEXT_PROPAGATION.md`](./ACTIVITY_TASK_CONTEXT_PROPAGATION.md) — how task JSON sees the impulses `impulse-resolve` produces
- [`../shapes/README.md`](../shapes/README.md) — shape catalog and evolution semantics
