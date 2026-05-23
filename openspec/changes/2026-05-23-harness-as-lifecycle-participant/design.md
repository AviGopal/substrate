# Design — Harness as Lifecycle Participant

## A. Problem framing

Today's loop topology — what feeds what:

```
[failure-mode-harness.ts]  ─ script ─→  results/<date>-cycle-N.json (disk)
        │                                       │
        │ (script-only output, no impulse)      │
        ↓                                       ↓
   stdout                              [progression-driver.ts] ─→ cycles/cycle-N.json

[draft-gap-closing-activity] ─ activity ─→ proposals/proposal-<id>.json
                                              + activity_create_variant
                                              (writes to activity-api)
```

There is no edge from the variant-creation back to the harness — the
harness is rerun by a human. There is no edge from a registry quality pass
back to the harness either. The harness and the loops that affect its
result are decoupled in topology.

What we want:

```
[harness-run-matrix activity] ─→ failureModeReport impulse ─→ AET in activity-api
                ↑                              │
                │                              ↓
   lifecycle:execution:succeeded      Thompson posteriors update
                │                              │
                │                              ↓
                ├── from draft-gap-closing-activity
                ├── from prune-activity / replace-activity (via activityRegistryChange)
                └── from activity_create_variant on any template
```

The harness firing is downstream of any event that could change what it
measures. Its result is upstream of the same Thompson learning that the
loops it observes are tuning.

## B. Lifecycle subscription pattern

The reference pattern is `repos/concept-db/src/observers/execution-observer.ts`:

```typescript
ws.on("message", (raw) => {
  const event = JSON.parse(raw);
  if (event.type === "task.completed") {
    recordUsageIfRelevant(event).catch(/* swallow */);
  }
});
```

The concept-db observer subscribes to `task.completed`. For the harness
trigger we want `lifecycle:execution:succeeded` — a higher-level event
broadcast when an activity execution finishes successfully. The dev-vessel
analogue:

```typescript
// repos/development-vessel/src/observers/registry-change-observer.ts
ws.on("message", (raw) => {
  const event = JSON.parse(raw);
  if (event.type !== "lifecycle:execution:succeeded") return;
  if (!shouldRescore(event)) return;
  fireHarnessMatrix().catch((err) => log("harness re-run failed", err));
});

function shouldRescore(event: { activity_template_id?: string; output_shapes?: string[] }): boolean {
  // Fire when the completed activity is one that could have changed the
  // shape-discovery surface or registry: draft-gap-closing-activity,
  // prune-activity, replace-activity, or any execution that emitted an
  // activityRegistryChange impulse.
  const tid = event.activity_template_id ?? "";
  if (tid.includes("draft-gap-closing-activity")) return true;
  if (tid.includes("prune-activity")) return true;
  if (tid.includes("replace-activity")) return true;
  if (event.output_shapes?.includes("activityRegistryChange")) return true;
  return false;
}
```

The observer runs in the dev-vessel process. It does NOT execute the
template inline — it calls into the existing `run-activity` CLI path
(`src/cli.ts:runActivity`) which fetches `harness-run-matrix` by id and
runs it via the local resolver dispatch. The trace ends up in activity-api
via the normal write path.

Failure of the observer is non-fatal: log + continue. The harness will
re-run on the next qualifying event, or via the existing manual path.

## C. The aggregator template `harness-run-matrix`

The current `harness-check-scenario` template scores one scenario. We need
a fan-out aggregator. Two design options:

**Option 1: Iteration resolver inside the template.**
The template has one task that uses an iteration resolver to call
`harness-check-scenario` N times. The iteration resolver lives in
ias-executor-ts. Pro: pure template, no shell. Con: the iteration
resolver currently throws on `body.resolver="activity"` (see
2026-05-22-failure-mode-autonomous-loop/tasks.md DEV-2 note), so the
sub-template-dispatch path is broken.

**Option 2: Aggregator template + a `directory_listing` resolver.**
Add a small new resolver `fs_list_dir` that lists files in a directory and
returns them as a `string[]` impulse. The aggregator template has tasks:

1. `fs_list_dir` over `validation/failure-modes/scenarios/`
2. For each path, dispatch `harness-check-scenario` (still requires
   iteration support OR explicit sequential tasks)
3. `fs_read_many` (another new resolver) collecting all `out_path` results
4. Aggregator synth task that folds them into a single `failureModeReport`

This still needs iteration. So we have to fix iteration OR find another
path.

**Option 3 (chosen): aggregator is a deterministic resolver, not a
sub-template-dispatch chain.** Add one new resolver
`failure_mode_matrix_score` that:
- reads scenario dir (configurable),
- for each scenario, calls the activity-api `discover-by-shapes` endpoint
  directly using the same logic that `activity_discover_by_shapes`
  resolver uses,
- aggregates results into a `failureModeReport` impulse.

This is one resolver dispatch per matrix run. It produces one AET in
activity-api with one task: the matrix scoring. The trace is coarse but
real. Iteration limitations don't block us; we don't need to fix them in
this change.

The trade-off: the per-scenario scoring is no longer a separately observable
trace. We lose per-scenario credit attribution. We gain shipability now.
The follow-up `failure-mode-matrix-iteration` change can decompose this
back into N traces once iteration is wired (out of scope here, noted in
proposal.md).

The aggregator template is then trivial: one task wrapping the new
`failure_mode_matrix_score` resolver, with a configurable output path.

## D. Shape contract: `failureModeReport` and `activityRegistryChange`

### `failureModeReport`

Emitted by the harness aggregator. Schema (consumed by progression-driver
v2, by oracle corpus, by future Thompson stratification):

```typescript
{
  shape: "failureModeReport",
  body: {
    generated_at: string;  // ISO 8601
    label: string;         // cycle tag, e.g. "cycle-9-auto"
    endpoint: string;      // activity-api endpoint the harness queried
    scenarios_run: number;
    scenarios: Array<{
      scenario_id: string;
      emergence_class: "reuse" | "new" | "gap";
      matched_existing_activity_id: string | null;
      first_output_shapes: string[];
      // self_heal_seconds intentionally absent in the matrix-scoring tier;
      // the per-scenario harness template retains it.
    }>;
    summary: { reuse: number; new: number; gap: number };
  }
}
```

Compatible with `HarnessReport` from `failure-mode-harness.ts` so the
existing `progression-driver.ts` can consume the impulse body verbatim
once `loadReport` reads from activity-api impulses instead of disk JSON.

### `activityRegistryChange`

Emitted by loops that modify the registry. Defined here only as a contract;
the loops that emit it are wired in a follow-up change. Schema:

```typescript
{
  shape: "activityRegistryChange",
  body: {
    change_type: "create_variant" | "deprecate" | "update" | "prune" | "promote";
    template_id: string;
    variant_id?: string;
    actor_activity_id?: string;  // which activity caused the change
    occurred_at: string;
  }
}
```

The development-vessel's `activity_create_variant` resolver SHOULD emit
this impulse on success in addition to its current `variant_created`
output. That's the minimum wiring needed to test the lifecycle subscription
end-to-end. Other loops (prune, replace) emit it as they're updated.

## E. Test strategy

Per-resolver test for `failure_mode_matrix_score`:
- scripted fetch that returns `discover-by-shapes` results for each
  scenario from a fixture set.
- assert: aggregated `failureModeReport` body has correct counts.
- assert: scenario directory path is honored.
- assert: writes one output file if `out_path` is provided.

Integration test for the lifecycle subscription:
- boot dev-vessel with the observer enabled, point at a fake WebSocket.
- feed a synthetic `lifecycle:execution:succeeded` event for
  `draft-gap-closing-activity`.
- assert: observer dispatches `harness-run-matrix` exactly once.
- assert: dispatching a non-matching event (e.g. `task.completed` for
  `git_status`) does NOT trigger the harness.

Trace verification (manual, gated on canary): after running the activity
end-to-end, `GET /v2/activities/execution-traces?activity_template_id=
development-vessel:harness-run-matrix` returns ≥1 row, and its
`output_shapes` includes `failureModeReport`.

## F. Operational consequences

- This change is downstream of the single-container substrate work
  (`openspec/changes/2026-05-23-single-container-substrate/`). All
  endpoints in this section refer to the in-container activity-api
  (`http://localhost:8080`), not canary. Canary remains running for
  reference but is not the verification target.
- Harness output stops being a file under `validation/results/`. It becomes
  an AET in activity-api. The progression-driver needs to learn to read
  from activity-api (`failureModeReport` impulse) rather than disk. Until
  it does, the aggregator writes the file too as a transitional shim.
- The harness fires every time a relevant lifecycle event happens. In a
  fresh container that's ≤1/hour; we add debouncing only if we see
  runaway.
- The `draft-gap-closing-activity` runs trigger a re-score, which on the
  current 6-scenario matrix should still report reuse=6/gap=0 — i.e. the
  loop closes without changing state. That's the steady-state check.
- For the FIRST end-to-end verification, we manually run
  `draft-gap-closing-activity` against an artificial gap inside the
  container and observe the matrix re-score firing. After that the loop
  is self-sustaining within the substrate.
- Promotion outward: once the cross-substrate trust work
  (vessel-session-handshake / H1 / H2) lands, the lifecycle observer code
  is unchanged; it simply reaches a different activity-api. The behaviour
  characterised here generalises.

## G. Resolved

- *Why an aggregator resolver and not iteration?* — Iteration of
  template-dispatch tasks is broken (see DEV-2 note). Fixing it is out of
  scope; the aggregator resolver lets us ship the wiring now and decompose
  later.
- *Why subscribe to `lifecycle:execution:succeeded` instead of
  `task.completed`?* — The execution-level event fires once per activity
  run, not once per task. Subscribing at the task level would multiply the
  trigger rate by the average task count (~5).
- *Why does the dev-vessel host the observer rather than activity-api?* —
  The dev-vessel already runs templates via its CLI. activity-api is a
  trace store + learner; it should not be in the business of orchestrating
  activity runs. Triggering an activity belongs in a vessel that executes.
