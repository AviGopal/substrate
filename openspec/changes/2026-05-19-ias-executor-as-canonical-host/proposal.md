# Proposal: ias-executor-ts as the Canonical Activity Host

## Why

The system has a layering principle, articulated by the user:

> "The purpose of a pure vessel is to contain some typescript code that can be
> driven by activities. At some level we need to establish a tradeoff between the
> rote consistent behavior of code and the variable behavior of llms, the middle
> ground is activities."

Three layers, no smuggling:

- **TypeScript code (vessels)** — fully deterministic, rote, version-controlled,
  testable. Owns a contract: shapes advertised, resolvers exposed, auth boundary.
- **Activities** — structured templates with `input_shapes` / `output_shapes` /
  `tasks`. Constrain the search space. Selectively invoke LLMs where reasoning is
  required.
- **LLMs** — variable, used only where deterministic resolution is impossible
  (semantic inference, novel composition, free-form generation).

Today minibob violates this layering. The `repos/minibob/src/` directory has 80
embedded templates (`embedded-templates/index.ts:26-213`), a 7,932-line activity
executor (`src/activity.ts`), a 273-line lifecycle-subscription engine
(`src/lifecycle-subscriptions.ts`), a 602-line goal processor
(`src/goal-processor.ts`), an 834-line boredom loop (`src/boredom.ts`), a
389-line ACP transport (`src/acp.ts`), a 182-line REPL
(`src/conversational-repl.ts`), CLI entry, daemon mode, and discovery /
vessel-registration code. Each piece in isolation has a justification; together
they form a god-object that fuses concerns that belong in distinct layers. The
executor (deterministic substrate) and the REPL (a user-facing shell) live in
the same package and share globals (`config`, `vessel-registry`, `llm`, `mcp` —
see `repos/ias-executor-ts/src/examples/bun-host.ts:17`).

`repos/ias-executor-ts/` already exists as the pure execution substrate
(`README.md:1-14`, Milestones A–D complete per recent archive commit
`eada6e3a chore(spec): archive ias-executor-ts`). Its README declares the
non-goals explicitly: "It is **not** a MiniBob shell. CLI, daemon/server,
websocket transport, boredom, vessel registration, and deployment bootstrap
belong in downstream hosts." (`README.md:14`). The piece missing from ias-
executor-ts is **lifecycle-subscription dispatch** — minibob's
`lifecycle-subscriptions.ts` is what makes slot-binding, validator-dispatch,
ribosome-extract, and the test-audit loop work, and it is the one piece of
minibob's god-object that *does* belong in the canonical executor (everything
else belongs elsewhere or nowhere).

Additionally, the 80 embedded templates are co-located with the minibob source
tree, so any other host (forge tests, validation harness, dashboard) that wants
to use them today must either depend on the entire minibob package or duplicate
the templates. They are pure JSON; they should live in a shared catalogue.

The fix is structural: declare **ias-executor-ts as the canonical activity
host**, port lifecycle-subscription dispatch into it, move embedded templates
into a shared catalogue, ship a reference `GoalHost` example that composes
BunHost + activity-api recommend + discovery + identity, and walk minibob's
usages down to either retirement or a thin TUI/REPL shell.

## What Changes

- **Lifecycle-subscription dispatch into ias-executor-ts**. Port
  `repos/minibob/src/lifecycle-subscriptions.ts` (subscriber lookup,
  suffix-predicate matching `_contains` / `_equals`, dedupe via per-process
  Map, depth-cap enforcement) into the executor core. Attached as a
  `lifecycle-subscriber` vessel kind so the dispatch path is explicit and
  inspectable, not a hidden built-in (per README dev-loop rule 4
  `repos/ias-executor-ts/README.md:32`).
- **Shared template catalogue**. Move the embedded templates from
  `repos/minibob/src/embedded-templates/` into a shared location consumed by
  any host. The slot-binding / validator-dispatch / audit-test-report /
  ribosome-extract / forge-vessel-for-shape / registry-quality six-pack /
  goal_processing_* / create-shape-provider-goal templates that are referenced
  by specs across the IAL stack are no longer minibob-private.
- **GoalHost reference implementation**. A new
  `repos/ias-executor-ts/src/examples/goal-host.ts` composing BunHost +
  activity-api adapter (for `POST /v2/activities/recommend` and trace writes)
  + discovery adapter + lifecycle subscriber. `runGoal(goalText)` returns a
  trace. No CLI, no REPL, no boredom. The single entry point a validation
  script or a thin shell calls.
- **Migration of `validation/scripts/test-forge-goal-completion.ts`** from
  `spawn(MINIBOB_BIN, ["--single", goal])`
  (`validation/scripts/test-forge-goal-completion.ts:221`) to a direct
  `GoalHost.runGoal()` call — `_forge-via-ias-executor.ts` already sketches
  this path (`validation/scripts/_forge-via-ias-executor.ts:5`).
- **Minibob deprecation plan**. `src/activity.ts`, `src/lifecycle-
  subscriptions.ts`, `src/embedded-templates/`, and `src/goal-processor.ts`
  shrink to thin re-exports or are removed. Minibob becomes either retired or
  a thin TUI/REPL shell over GoalHost; that decision is made at Phase 4 of the
  migration after the harness data is in.
- **No schema changes**. activity-api and discovery-vessel are unchanged.

## Success Criteria

The change is complete when, against canary at `activity.metabob.com`:

1. **Trace replay parity** — ias-executor-ts (via GoalHost) replays ≥ 20
   canary traces drawn from the existing reuse-harness corpus, and the
   produced trace's `(activity_template_id, task_ids, output_shapes,
   failure_mode?)` tuple matches the original for ≥ 95 % of replayed cases.
   Differences attributed to non-determinism (LLM, clock, random) are
   explicitly enumerated, not unaccounted-for.
2. **Lifecycle subscribers fire correctly under GoalHost** — slot-binding
   (`lifecycle:task:preBinding`), validator-dispatch
   (`lifecycle:task:completed`), and audit-test-report
   (`lifecycle:execution:succeeded`, filter `output_shapes_contains:
   "test_report"`) all dispatch and produce trace events when their canonical
   filters match. Verified by reproducing the test-audit-loop integration
   trace under GoalHost.
3. **forge-goal-completion test passes under GoalHost** — `test-forge-goal-
   completion.ts` Pass 1 (forge shape) and Pass 2 (compose with forged shape)
   both pass when run through GoalHost directly, no `MINIBOB_BIN` spawn.
4. **No learning-signal regression** — over a 7-day window, the canary
   `reuse_mrr` and `recommend_mrr` numbers from `validation/scripts/reuse-
   harness.ts` remain within ±0.02 of the pre-migration baseline when traces
   are driven through GoalHost instead of minibob.
5. **Minibob deprecation endpoint declared** — by Phase 4 of the migration,
   either (a) minibob is archived (no remaining live consumers) or (b) the
   minibob package is < 1,500 LOC and contains only the TUI/REPL shell +
   re-exports, with no business logic.

## Capabilities

### New Capabilities

- `goal-host` — the composed-host pattern. BunHost + activity-api adapter +
  discovery adapter + identity adapter + lifecycle subscriber, wired
  explicitly with one constructor and one method (`runGoal(text)`). Spec:
  `specs/goal-host/spec.md`.
- `lifecycle-subscription-dispatch` — port of `repos/minibob/src/lifecycle-
  subscriptions.ts` into ias-executor-ts. Attached as a `lifecycle-subscriber`
  vessel. Carries forward suffix-predicate matching, dedupe, depth-cap, and
  `must_fire` semantics verbatim from the minibob implementation.
- `shared-template-catalog` — embedded-template loader pattern from
  `repos/minibob/src/embedded-templates/index.ts:26-213` relocated so any host
  can load it. Location is decided in design §F.

## Impact

- `repos/ias-executor-ts/src/` — new files for lifecycle-subscription
  dispatch + GoalHost example + shared template loader. No port changes
  beyond a new `LifecycleSubscriberPort` (or equivalent attached-vessel kind
  — design §E).
- `repos/minibob/src/` — `activity.ts`, `lifecycle-subscriptions.ts`,
  `embedded-templates/`, and `goal-processor.ts` shrink to re-exports during
  the transition, then are removed. `boredom.ts`, `acp.ts`,
  `conversational-repl.ts`, and CLI either stay (as the thin TUI shell) or
  are retired with minibob entirely.
- `repos/metabob-activity-api/` — **no schema changes**. The
  `POST /v2/activities/recommend` and trace-write endpoints are unchanged;
  GoalHost calls them via the existing `HttpTraceSink` pattern
  (`repos/ias-executor-ts/src/examples/bun-host.ts:187-207`).
- `repos/discovery-vessel/` — no changes. GoalHost uses the existing
  `HttpDiscoveryAdapter` (already referenced by
  `vessel-forge-host.ts:19`).
- `validation/scripts/test-forge-goal-completion.ts` — switches from
  `spawn(MINIBOB_BIN)` to `GoalHost.runGoal()`. Other scripts in
  `validation/scripts/` migrate in Phase 3.
- `validation/scripts/cycle.sh` and reuse-harness — switch backend in Phase 3.
- **No operator-blocked items**. This is an internal architectural refactor.

## Dependencies

- **Depends on** `repos/ias-executor-ts/` Milestones A–D complete
  (archive commit `eada6e3a`, 2026-05-15).
- **Depends on** `2026-05-18-test-audit-loop` landed — the lifecycle-
  subscription port must carry forward the test-audit-loop's filter semantics
  (`output_shapes_contains`, dedupe key, depth-cap), and the audit-test-report
  / debug-failing-audit templates must move into the shared catalogue.
- **Depends on** Phase 22 vessel-forge deployment — the forge-goal-completion
  test is the first migration target (success criterion #3), and the
  `vessel-forge-host.ts` precedent is the model for GoalHost composition.
- **Does not block on** any external infra, identity-vessel changes,
  discovery-vessel changes, or activity-api schema changes.

## Phased Rollout

| Phase | Scope | Behaviour change |
|-------|-------|------------------|
| 1     | Port lifecycle-subscription dispatch into ias-executor-ts. Move embedded templates into shared catalogue. Ship GoalHost reference. | None — minibob still primary. |
| 2     | forge-goal-completion test switches to GoalHost. | Canary metrics confirm parity. |
| 3     | reuse-harness, cycle.sh, test-22-* migrate to GoalHost. | Weekly metrics confirm no regression. |
| 4     | Minibob's `activity.ts`, `lifecycle-subscriptions.ts`, `embedded-templates/`, `goal-processor.ts` deleted or shrunk to re-exports. Minibob retired or becomes the thin TUI shell. | Per success criterion #5. |
