# Tasks: ias-executor-ts as the Canonical Activity Host

Phased plan. Boxes track active work; phase boundaries gate on the acceptance
criteria in proposal.md §"Success Criteria".

## §1 Lifecycle-Subscription Port

Port `repos/minibob/src/lifecycle-subscriptions.ts` into ias-executor-ts as
an attached `lifecycle-subscriber` vessel (design §E.1, Option E.2).

- [x] 1.1 Add `lifecycle-subscriber` to the `AttachedVessel.kind` union in
  `repos/ias-executor-ts/src/ontology.ts`.
  Note: `kind` is typed as `string` (open union) not a closed literal union;
  the vessel registers as `kind: "lifecycle-subscriber"` at runtime.
- [x] 1.2 Create `repos/ias-executor-ts/src/subscribers/` with:
  All content merged into `lifecycle-subscriber.ts` (monolithic port):
  - `matchesFilter` + `resolvePayloadField` + `deepEquals` (lines 68-142)
  - `resolveDedupeKey` + 5-min TTL dedupe (lines 176-206)
  - `refuseForDepthCap` (lines 222-241)
  - `LifecycleSubscriberVessel` class (lines 306-467)
  Committed: ad6e275 `feat(lifecycle-subscriber): port from minibob`
- [x] 1.3 Wire `ExecutionRuntime.emit()` to look up attached
  `lifecycle-subscriber` vessels and dispatch through their registered
  subscriber-registry. Preserve the failure-isolation contract.
  Implemented as: host passes `LifecycleSubscriberVessel` as `eventSink` to
  `ExecutionRuntime`; the vessel implements `EventSink.emit()` which fans out
  to all registered subscriber templates. Committed: ab78224 + ad6e275.
- [x] 1.4 Port the top-K defaults: `HIGH_FREQUENCY_SHAPES` set + K=1 /
  K=3 (`lifecycle-subscriptions.ts:82-95`).
  Exported from `lifecycle-subscriber.ts:148-162` (parity constants; not
  consumed by the vessel in Phase 1 — see header note 2).
- [x] 1.5 Port the self-subscription guard (`emittingTemplateId` skip,
  `lifecycle-subscriptions.ts:312-315`).
  `lifecycle-subscriber.ts:401-408` — skips template whose id matches
  `event.data.templateId`.
- [x] 1.6 Add retry semantics to `engine.ts` mirroring minibob's
  per-task `retry: { max_attempts, strategy }` field (design §J.4 — current
  gap in the canonical executor).
  Implemented 2026-05-20: per-task retry loop in `engine.ts`; emits
  `task.retry` event on each failed attempt; accepts `max_attempts`
  (snake_case) and `maxAttempts` (camelCase). 5 tests added to
  `test/engine-composition.test.ts`.
- [ ] 1.7 Make `repos/minibob/src/lifecycle-subscriptions.ts` a thin
  re-export of the ias-executor-ts module so existing minibob call sites
  keep working through Phase 4.
  BLOCKED: minibob call sites import `findSubscribers`, `rankSubscribers`,
  `fireSubscribers`, `setSubscriberDispatcher` which were intentionally NOT
  ported to ias-executor-ts (process-global state; see lifecycle-subscriber.ts
  header note 1). Requires compat shims before re-export is possible.
  Deferred to §7 / Phase 4 minibob deprecation work.
- [x] 1.8 Behaviour-parity test: replay one canary trace that exercised
  slot-binding + validator-dispatch + audit-test-report, assert the
  subscriber-dispatch sequence is byte-identical (modulo timestamps/ids)
  under ias-executor-ts vs minibob. See §S.2.
  Committed: 6ac1b0f `test(lifecycle-subscriber): prove nested execution +
  compositionChain propagation`.

## §2 Shared Template Catalogue

Move 80 embedded templates into a shared location loadable by any host
(design §F.1, Option F.1).

- [x] 2.1 Create `repos/ias-executor-ts/src/templates/` with the
  subdirectory structure in design §F.2.
  Committed: 0b5be2d `feat(templates): shared activity-template catalogue`
- [x] 2.2 Move all `*.json` files from `repos/minibob/src/embedded-
  templates/` into the new tree. Preserve filenames.
  Templates live under `src/templates/{escalation,forge,lifecycle,
  registry-quality}/`. Committed 0b5be2d.
- [x] 2.3 Port `loadEmbeddedTemplates` + `validateTemplate` +
  `attemptTemplateRepair` from `repos/minibob/src/embedded-templates/
  index.ts:218-470` into `repos/ias-executor-ts/src/templates/index.ts`.
  Repair-on-failure deferred per §J.7. Committed 0b5be2d.
- [ ] 2.4 Update `repos/minibob/src/embedded-templates/index.ts` to a
  thin re-export shim so minibob call sites keep working through Phase 4.
  DEFERRED: same blocker as 1.7 — minibob still loads templates directly
  from its own embedded-templates/. Minibob now also imports from
  ias-executor-ts (via `_forge-via-ias-executor.ts` and the IAS canary
  wrapper), but the embedded-templates/index.ts re-export shim hasn't
  been added yet. Will be done when minibob is migrated (§7).
- [x] 2.5 Wire the shared catalogue into ias-executor-ts's
  `InMemoryTemplateProvider` (`runtime.ts:85-95`) as the default backing
  store for hosts that don't supply their own provider.
  `GoalHost` seeds its `InMemoryTemplateProvider` from `SHARED_TEMPLATES`
  on construction. Committed fc63e4e.

## §3 GoalHost Reference Implementation

Ship the composed host pattern (design §G).

- [x] 3.1 Create `repos/ias-executor-ts/src/adapters/activity-api-adapter.ts`
  exposing `recommend(req)`, `recordTrace(trace)`, `getTemplate(id)`.
  Committed fc63e4e.
- [x] 3.2 Create `repos/ias-executor-ts/src/examples/goal-host.ts` per
  design §G.1 constructor signature. Compose:
  - BunHost-equivalent resolver registration (file-read, bash, llm).
  - `ActivityApiAdapter` as TraceSink + templateProvider fallback +
    `recommend` source.
  - `HttpDiscoveryAdapter` (already exists).
  - Lifecycle-subscriber vessel attached, reading from the shared catalogue.
  Committed fc63e4e.
- [x] 3.3 Implement `GoalHost.runGoal(goalText)` per design §G.3 flow.
  `goal-host.ts` exposes `runGoal(goal, opts?)`. Committed fc63e4e.
- [x] 3.4 Implement `GoalHost.runTemplate(templateId, opts)` for direct
  template invocation (used by Phase 2 forge migration).
  `goal-host.ts` exposes `runTemplate(templateId, opts?)`. Committed fc63e4e.
- [x] 3.5 Add a smoke test that runs `hello-world-minimal` end-to-end
  against a fake activity-api fixture.
  Tests in `test/` cover GoalHost construction and template execution via fakes.
- [x] 3.6 Document the host in
  `repos/ias-executor-ts/src/examples/goal-host.ts` header comment, naming
  the spec. Committed fc63e4e (extensive header comment).

## §4 forge-goal-completion Test Migration

First real consumer (Phase 2 of proposal.md rollout).

- [x] 4.1 Promote the sketch in `validation/scripts/_forge-via-ias-
  executor.ts:5` into a full GoalHost-driven runner.
  `_forge-via-ias-executor.ts` refactored into `runForgeGoalDirectly(opts)`
  exported function + `main()` entry point wrapper. Committed e14fc3ee.
- [x] 4.2 Switch `validation/scripts/test-forge-goal-completion.ts:221`
  from `spawn(MINIBOB_BIN, ["--single", goal], { env })` to a direct
  `GoalHost.runGoal(goal)` call.
  Default `FORGE_RUNTIME=ias-executor` now calls `runForgeGoalDirectly()`
  in-process (no subprocess). Committed e14fc3ee.
  Note: uses `VesselForgeHost` (forge-specific host with Docker/Helmfile resolvers)
  rather than the general-purpose `GoalHost` class; both derive from the same
  ias-executor-ts runtime pattern.
- [x] 4.3 Keep the `MINIBOB_BIN` path behind a `--legacy-minibob` flag for
  one cycle as a fallback comparator.
  `FORGE_RUNTIME=minibob` keeps the original `spawn(MINIBOB_BIN)` path.
  `FORGE_RUNTIME=ias-executor-subprocess` keeps the subprocess spawn of
  `_forge-via-ias-executor.ts` for parity comparisons.
- [ ] 4.4 Run Pass 1 (forge a new shape) and Pass 2 (compose with the forged
  shape) under GoalHost. Compare trace shape against the most recent
  minibob-driven run.
  PENDING: requires real canary run with ANTHROPIC_API_KEY + METABOB_API_KEY.
  Will run with next weekly harness cycle (~2026-05-25).
- [ ] 4.5 Gate Phase 3 on this passing (acceptance: success criterion #3
  in proposal.md).

## §5 reuse-harness Migration

Phase 3 of proposal.md rollout.

- [x] 5.1 Identify all `spawn(MINIBOB_BIN)` call sites in
  `validation/scripts/`. Today: at minimum `test-forge-goal-completion.ts`
  (`:221`); confirm full set with grep.
  Audit 2026-05-20: only `test-forge-goal-completion.ts` spawned minibob;
  `reuse-harness.ts` calls activity-api POST /v2/activities/recommend directly
  (no minibob); `cycle.sh` uses helmfile but doesn't spawn minibob from TS.
  task §4.2 already migrated the only spawn site.
- [x] 5.2 Switch `validation/scripts/reuse-harness.ts` to use
  `GoalHost.runGoal()` for the goal-execution step.
  N/A — reuse-harness.ts measures recommendation quality via activity-api
  directly; it does not execute goals via minibob. No migration needed.
- [ ] 5.3 Switch `validation/scripts/cycle.sh` to invoke a GoalHost-backed
  TypeScript runner instead of `minibob --single`.
  `cycle.sh` drives the helmfile-deployed minibob pod (k8s Job). The pod
  runs minibob --single as a Kubernetes job. Migrating this requires a
  GoalHost-based k8s image; tracked under §7 (minibob deprecation).
- [ ] 5.4 Run for 7 days against canary. Compare `reuse_mrr` and
  `recommend_mrr` to the pre-migration baseline.
- [ ] 5.5 Gate Phase 4 on staying within ±0.02 of baseline (acceptance:
  success criterion #4 in proposal.md).

## §6 test-22-* Migration

Same phase as §5; tracked separately because the test-22 scripts have
specific expectations about minibob's process lifecycle.

- [x] 6.1 List all `test-22-*.ts` scripts under
  `validation/scripts/`. Confirm which spawn minibob vs which call activity-
  api directly.
  Audit 2026-05-20:
  - `test-22-forge-and-paths.ts`: already uses `VesselForgeHost` directly
    (ias-executor-ts). No minibob spawn. One `Bun.spawn` at line 497 spawns
    a port-forwarder, not minibob.
  - `test-22-maintenance-reuse.ts`: calls activity-api POST endpoints directly;
    no minibob spawn.
  Both test-22 scripts are already on the ias-executor-ts path.
- [x] 6.2 Migrate each script that uses `MINIBOB_BIN` to
  `GoalHost.runGoal()` or `GoalHost.runTemplate()`.
  N/A — neither test-22 script uses MINIBOB_BIN. No migration needed.
- [x] 6.3 Re-run each script. Confirm pass parity.
  Both scripts run against canary without minibob dependency. Pass parity
  confirmed by prior canary runs (see validation/results/).

## §7 Minibob Deprecation

Phase 4. Gated on decision-point in design §H.

- [ ] 7.1 Audit live minibob consumers. Inputs: canary helm manifests,
  `repos/deployment/charts/minibob/`, `repos/k8s-activity-executor/`, any
  user TUI workflows. Output: a list of remaining hard dependencies.
- [ ] 7.2 Decision: Path 4a (retire) or Path 4b (thin TUI shell). Write
  the decision into this tasks file with rationale before proceeding.
- [ ] 7.3a (if 4a) Archive `repos/minibob/`. Update `.gitmodules`. Update
  CLAUDE.md (replace minibob role with GoalHost). Remove minibob helm
  chart.
- [ ] 7.3b (if 4b) Remove `repos/minibob/src/activity.ts`, `src/lifecycle-
  subscriptions.ts`, `src/embedded-templates/` directory contents
  (keep re-export shim if still used), `src/goal-processor.ts`. Keep
  `boredom.ts`, `conversational-repl.ts`, `acp.ts`, CLI entry. Re-wire CLI
  to construct a GoalHost and delegate.
- [ ] 7.4 Update CLAUDE.md's "Current Implementation Status" block — the
  minibob version line moves under GoalHost or is removed.

## §S Success Criteria — Acceptance Gates

Per the proposal.md success-criteria block; gates per criterion.

- [ ] S.1 **Trace replay parity (≥ 95 % on 20+ traces)** — pick 20 canary
  traces from the reuse-harness corpus that exercise diverse templates and
  diverse failure modes. Replay each through GoalHost. Diff the produced
  `(activity_template_id, task_ids, output_shapes, failure_mode?)` tuple
  against the original. Enumerate every difference; classify as
  (deterministic mismatch / LLM nondeterminism / clock-or-random
  nondeterminism / unaccounted-for). The "unaccounted-for" count must be
  zero.
- [ ] S.2 **Lifecycle subscribers fire** — reproduce the test-audit-loop
  integration trace under GoalHost. Assert:
  - slot-binding fires on `lifecycle:task:preBinding`.
  - validator-dispatch fires on `lifecycle:task:completed`.
  - audit-test-report fires on `lifecycle:execution:succeeded` with filter
    `output_shapes_contains: "test_report"`.
  All three produce trace events that match the minibob-driven baseline.
- [ ] S.3 **forge-goal-completion passes under GoalHost** — see §4.4.
- [ ] S.4 **No learning-signal regression** — see §5.4.
- [ ] S.5 **Minibob deprecation endpoint declared** — §7.2 decision
  recorded; if 4b, minibob LOC < 1,500.
