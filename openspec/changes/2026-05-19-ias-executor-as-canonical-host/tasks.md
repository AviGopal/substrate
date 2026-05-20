# Tasks: ias-executor-ts as the Canonical Activity Host

Phased plan. Boxes track active work; phase boundaries gate on the acceptance
criteria in proposal.md §"Success Criteria".

## §1 Lifecycle-Subscription Port

Port `repos/minibob/src/lifecycle-subscriptions.ts` into ias-executor-ts as
an attached `lifecycle-subscriber` vessel (design §E.1, Option E.2).

- [ ] 1.1 Add `lifecycle-subscriber` to the `AttachedVessel.kind` union in
  `repos/ias-executor-ts/src/ontology.ts`.
- [ ] 1.2 Create `repos/ias-executor-ts/src/subscribers/` with:
  - `subscriber-registry.ts` — `findSubscribers`, `rankSubscribers`,
    `fireSubscribers` ported verbatim from `lifecycle-subscriptions.ts:302-
    551`.
  - `filter-match.ts` — `matchesFilter` + `resolvePayloadField` +
    `deepEquals` (suffix predicates, snake-case fallback). Source:
    `lifecycle-subscriptions.ts:203-283`.
  - `dedupe.ts` — 5-minute TTL Map + `resolveDedupeKey`. Source:
    `lifecycle-subscriptions.ts:381-422`.
  - `depth-cap.ts` — `refuseForDepthCap` for audit-tagged templates.
    Source: `lifecycle-subscriptions.ts:424-457`.
- [ ] 1.3 Wire `ExecutionRuntime.emit()` to look up attached
  `lifecycle-subscriber` vessels and dispatch through their registered
  subscriber-registry. Preserve the failure-isolation contract from
  `lifecycle-subscriptions.ts:541-548`.
- [ ] 1.4 Port the top-K defaults: `HIGH_FREQUENCY_SHAPES` set + K=1 /
  K=3 (`lifecycle-subscriptions.ts:82-95`).
- [ ] 1.5 Port the self-subscription guard (`emittingTemplateId` skip,
  `lifecycle-subscriptions.ts:312-315`).
- [ ] 1.6 Add retry semantics to `engine.ts` mirroring minibob's
  per-task `retry: { max_attempts, strategy }` field (design §J.4 — current
  gap in the canonical executor).
- [ ] 1.7 Make `repos/minibob/src/lifecycle-subscriptions.ts` a thin
  re-export of the ias-executor-ts module so existing minibob call sites
  keep working through Phase 4.
- [ ] 1.8 Behaviour-parity test: replay one canary trace that exercised
  slot-binding + validator-dispatch + audit-test-report, assert the
  subscriber-dispatch sequence is byte-identical (modulo timestamps/ids)
  under ias-executor-ts vs minibob. See §S.2.

## §2 Shared Template Catalogue

Move 80 embedded templates into a shared location loadable by any host
(design §F.1, Option F.1).

- [ ] 2.1 Create `repos/ias-executor-ts/src/templates/` with the
  subdirectory structure in design §F.2.
- [ ] 2.2 Move all `*.json` files from `repos/minibob/src/embedded-
  templates/` into the new tree. Preserve filenames.
- [ ] 2.3 Port `loadEmbeddedTemplates` + `validateTemplate` +
  `attemptTemplateRepair` from `repos/minibob/src/embedded-templates/
  index.ts:218-470` into `repos/ias-executor-ts/src/templates/index.ts`.
  Decision on repair-on-failure self-heal: defer (design §J.7). For the
  port, the loader logs and skips; the repair meta-activity stays as a
  catalogue entry but is not auto-invoked by the loader.
- [ ] 2.4 Update `repos/minibob/src/embedded-templates/index.ts` to a
  thin re-export shim so minibob call sites keep working through Phase 4.
- [ ] 2.5 Wire the shared catalogue into ias-executor-ts's
  `InMemoryTemplateProvider` (`runtime.ts:85-95`) as the default backing
  store for hosts that don't supply their own provider.

## §3 GoalHost Reference Implementation

Ship the composed host pattern (design §G).

- [ ] 3.1 Create `repos/ias-executor-ts/src/adapters/activity-api-adapter.ts`
  exposing `recommend(req)`, `recordTrace(trace)`, `getTemplate(id)`. Model
  after `HttpTraceSink` (`bun-host.ts:187-207`).
- [ ] 3.2 Create `repos/ias-executor-ts/src/examples/goal-host.ts` per
  design §G.1 constructor signature. Compose:
  - BunHost-equivalent resolver registration (file-read, bash, llm).
  - `ActivityApiAdapter` as TraceSink + templateProvider fallback +
    `recommend` source.
  - `HttpDiscoveryAdapter` (already exists).
  - Lifecycle-subscriber vessel attached, reading from the shared catalogue.
- [ ] 3.3 Implement `GoalHost.runGoal(goalText)` per design §G.3 flow.
- [ ] 3.4 Implement `GoalHost.runTemplate(templateId, opts)` for direct
  template invocation (used by Phase 2 forge migration).
- [ ] 3.5 Add a smoke test that runs `hello-world-minimal` end-to-end
  against a fake activity-api fixture.
- [ ] 3.6 Document the host in
  `repos/ias-executor-ts/src/examples/goal-host.ts` header comment, naming
  the spec.

## §4 forge-goal-completion Test Migration

First real consumer (Phase 2 of proposal.md rollout).

- [ ] 4.1 Promote the sketch in `validation/scripts/_forge-via-ias-
  executor.ts:5` into a full GoalHost-driven runner.
- [ ] 4.2 Switch `validation/scripts/test-forge-goal-completion.ts:221`
  from `spawn(MINIBOB_BIN, ["--single", goal], { env })` to a direct
  `GoalHost.runGoal(goal)` call.
- [ ] 4.3 Keep the `MINIBOB_BIN` path behind a `--legacy-minibob` flag for
  one cycle as a fallback comparator.
- [ ] 4.4 Run Pass 1 (forge a new shape) and Pass 2 (compose with the forged
  shape) under GoalHost. Compare trace shape against the most recent
  minibob-driven run.
- [ ] 4.5 Gate Phase 3 on this passing (acceptance: success criterion #3
  in proposal.md).

## §5 reuse-harness Migration

Phase 3 of proposal.md rollout.

- [ ] 5.1 Identify all `spawn(MINIBOB_BIN)` call sites in
  `validation/scripts/`. Today: at minimum `test-forge-goal-completion.ts`
  (`:221`); confirm full set with grep.
- [ ] 5.2 Switch `validation/scripts/reuse-harness.ts` to use
  `GoalHost.runGoal()` for the goal-execution step.
- [ ] 5.3 Switch `validation/scripts/cycle.sh` to invoke a GoalHost-backed
  TypeScript runner instead of `minibob --single`.
- [ ] 5.4 Run for 7 days against canary. Compare `reuse_mrr` and
  `recommend_mrr` to the pre-migration baseline.
- [ ] 5.5 Gate Phase 4 on staying within ±0.02 of baseline (acceptance:
  success criterion #4 in proposal.md).

## §6 test-22-* Migration

Same phase as §5; tracked separately because the test-22 scripts have
specific expectations about minibob's process lifecycle.

- [ ] 6.1 List all `test-22-*.ts` scripts under
  `validation/scripts/`. Confirm which spawn minibob vs which call activity-
  api directly.
- [ ] 6.2 Migrate each script that uses `MINIBOB_BIN` to
  `GoalHost.runGoal()` or `GoalHost.runTemplate()`.
- [ ] 6.3 Re-run each script. Confirm pass parity.

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
