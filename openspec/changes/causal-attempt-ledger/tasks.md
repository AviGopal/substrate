> **Acceptance status (09-26):** the graded acceptance passed (CONSISTENT at 05:10:18Z, runs 10/11/12 each 10/10, the third after a
> cold boot), recorded in `validation/reports/causal-attempt-ledger/FINISH_LINE.md` with per-run reports. The checkboxes below were not
> kept in step during development and have NOT been individually re-verified; reconcile each against the landed commits named in
> FINISH_LINE.md and the RUN*.md diagnoses before ticking it. Open follow-ups are in `GAPS_OBSERVED.md` (#46, #47, #55–#61).

Tasks that name a `repos/<vessel>/src/` file are dispatched as a goal naming that one
file; verify by reading `reached`, the landed diff, and the stated observable, not the
dispatch status. Tasks in section 0, the bootstrap-tier tasks under `scripts/substrate/`
(the stated exception for code that runs before any activity can host it) and the
verification-only tasks cannot route through the edit-intent path and are operator-run;
each is recognizable by naming no `src/` file.

## 0. Pre-registration (operator, before any task lands)

- [ ] 0.1 Record the falsifier and the seeded-regression fixture (a change to a scratch vessel file that makes one baseline unit fail to start) in `validation/` before task 1.1 lands; verify the fixture reproduces the failure on an unmodified substrate.
- [ ] 0.2 Back up the container volume and confirm the dev seed templates survive a cold boot (seeder ordered after identity); if they do not, record the template loss as a known confound for tasks 1.5 and 7.1.
- [ ] 0.3 Record the unaccounted-commit baseline: count of commits on watched branches over the prior window with no provenance trailer, re-derived with the command in `sources.md`.

## 1. Ledger store and detector (observe only)

- [ ] 1.1 Add the append-only keyed ledger store for `attemptIntent`, `stateSnapshot`, `attemptOutcome`, `attemptSettlement` in `repos/development-vessel/src/resolvers/attempt-ledger.ts`; verify a duplicate-key append is a no-op by writing the same record twice and counting lines.
- [ ] 1.2 Register the ledger shapes and the policy shapes `baselineCheckSet`, `settlementPolicy` in `repos/development-vessel/src/config.ts`; verify they appear in discovery's `/registry/shapes`.
- [ ] 1.3 Route the ledger shapes in `repos/development-vessel/src/routes/impulses.ts`; verify a resolve of each returns its shape (positive control: a record written in 1.1 is returned).
- [ ] 1.4 Implement `unaccounted_landing_scan` in `repos/development-vessel/src/resolvers/unaccounted-landing-scan.ts`, reporting unreadable repositories as `unknown`; verify it files a gap for a commit made by hand in a scratch branch with no trailer.
- [ ] 1.5 Verify the ledger files survive a cold boot: recreate the container on the same volume and resolve the records written in 1.3.

## 2. Git-layer sensing (bootstrap tier)

- [ ] 2.1 Add the `post-commit` and `reference-transaction` hooks that spool commit and ref events and deliver them to the ledger, in `scripts/substrate/git-hooks-ledger/`; verify a `git commit --no-verify` in a push clone still produces a spooled event.
- [ ] 2.2 Install the hooks through the system git `core.hooksPath` in `scripts/substrate/entrypoint.sh`; verify on a fresh container that `git config --system core.hooksPath` names the hook directory.
- [ ] 2.3 Export `SUBSTRATE_EXECUTION_ID` into every spawned shell in `repos/local-tools-vessel/src/index.ts`; verify a `shell` resolve running `env` prints the dispatching execution id.
- [ ] 2.4 Export `SUBSTRATE_EXECUTION_ID` into the `bash` host's spawned processes in `repos/ias-executor-ts/src/hosts/goal-host.ts`; verify a template `bash` step running `env` prints its execution id.
- [ ] 2.5 Chain the ledger hooks to repository-local hooks in `scripts/substrate/git-hooks-ledger/`; verify a repository with a local `post-commit` hook still runs it.
- [ ] 2.6 Verify an LLM shell commit is recorded: dispatch a goal that makes the tool fallback commit to a scratch branch, and confirm an `unaccounted` record with that sha and the walk's execution id exists.
- [ ] 2.7 Verify the spool drains: stop development-vessel, commit, start it, and confirm the event is delivered exactly once.

## 3. Registration on cooperating routes

- [ ] 3.1 Implement `attempt_register` (intent + pre-snapshot request, idempotent on `attempt_id`) in `repos/development-vessel/src/resolvers/attempt-register.ts`; verify a second call with the same `attempt_id` returns the first record.
- [ ] 3.2 Call `attempt_register` before mutation and write the `Attempt-Id:` trailer in `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts`; verify a cutover commit carries the trailer and its intent's pre-snapshot timestamp precedes the commit.
- [ ] 3.3 Pass the caller's execution id as `authoring_execution_id` in `repos/development-vessel/src/resolvers/feature-compose.ts`; verify the landed attempt's `authoring_execution_id` resolves to an `execution` row with a `composition_chain`.
- [ ] 3.4 Record every sha of an attempt across rebase in `repos/development-vessel/src/resolvers/attempt-ledger.ts`; verify a rebased cutover yields one attempt with two shas.
- [ ] 3.5 Register attempts in `repos/development-vessel/src/resolvers/git-commit.ts`; verify a `git_commit` resolve produces a trailered commit and a registered attempt.

## 4. Snapshots and outcome

- [ ] 4.1 Implement `invariant_select` (baseline from `baselineCheckSet` plus gap predicate plus file-bound checks; never removes baseline) in `repos/development-vessel/src/resolvers/invariant-select.ts`; verify the output for a one-file attempt is a superset of the baseline.
- [ ] 4.2 Implement `invariant_evaluate` with per-check timeouts, five-valued verdicts, read-only invocation, and artifact identities in `repos/development-vessel/src/resolvers/invariant-evaluate.ts`; verify a check whose upstream returns 401 yields `unknown`, and that no gap `updated_at` changes during evaluation.
- [ ] 4.3 Seed `baselineCheckSet` with `systemd_unit_health_observer`, `gate_self_probe`, `code_verify_typecheck` in `repos/development-vessel/src/seed/baseline-check-set.ts`; verify a resolve of `baselineCheckSet` returns the three.
- [ ] 4.4 Implement `outcome_compare` (deterministic, no LLM) in `repos/development-vessel/src/resolvers/outcome-compare.ts`; verify on stored snapshot pairs that a pass→fail flip on an unpredicted check yields `surprise: true`, and unknown post-state yields `intended: unknown`.
- [ ] 4.5 Take the post-snapshot and emit `attemptOutcome` after push in `repos/development-vessel/src/resolvers/vessel-mitosis-cutover.ts`; verify the seeded-regression fixture (0.1) produces an outcome naming the failed unit.
- [ ] 4.6 Flag `surprise` when `touched_files` include a check definition in `repos/development-vessel/src/resolvers/outcome-compare.ts`; verify an attempt editing `gate-self-probe.ts` is flagged regardless of verdicts.

## 5. Settlement

- [ ] 5.1 Generalize `sweepPendingLandVerifications` to evaluate each pending attempt's `invariantSet` after the `settlementPolicy` window and emit `attemptSettlement` in `repos/development-vessel/src/resolvers/gap-to-feature.ts`; verify the seeded regression settles `regressed` and a clean change settles `held`.
- [ ] 5.2 Enforce `(attempt_id, settlement_seq)` idempotency in `repos/development-vessel/src/resolvers/attempt-ledger.ts`; verify two sweeps over the same attempt produce one settlement event.
- [ ] 5.3 Seed `settlementPolicy` in `repos/development-vessel/src/seed/settlement-policy.ts`; verify changing the impulse's window changes the next sweep's behavior without a restart.

## 6. Readers

- [ ] 6.1 Append a lesson to the targeted gap's `failure_lessons` on `surprise` or `regressed` in `repos/development-vessel/src/resolvers/attempt-ledger.ts`; verify the next `feature_compose` prompt for that gap contains the lesson (read from the compose trace).
- [ ] 6.2 Append the lesson to each touched file's compose lessons in `repos/development-vessel/src/resolvers/feature-compose.ts`; verify a later draft on the same file under a different gap contains it.
- [ ] 6.3 Defer extraction for executions with a registered landing until `held` in `repos/goal-host-vessel/src/index.ts` (`mintReachedTrace`); verify the seeded regression produces no template and the clean change produces one.
- [ ] 6.4 Apply the same deferral in `repos/ribosome-vessel/src/index.ts`; verify with the same pair.
- [ ] 6.5 Verify an execution linked to an unaccounted shell landing (task 2.6) produces no template.

## 7. Acceptance

- [ ] 7.1 Run the falsifier end to end (seeded regression, clean change, repeat of each, one direct unaccounted commit), then cold-boot and re-read; record the ledger contents, not the dispatch statuses, in `validation/`.
- [ ] 7.2 File the four credit-binding prerequisites in `design.md` as separate gaps with `source: human_reported`, each with a machine-checkable falsifier.
