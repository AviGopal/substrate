## Context

A landing is the substrate's most consequential act, and the least linked. What exists:

- **Landing routes.** The mitosis cutover (`vessel-mitosis-cutover.ts`) is the only gated
  route; it is reached from `feature_compose`, `patch_with_tools`, the mitosis tick (which
  lands what `apply_proposal_as_patch` and `doc_drift_fix` stage) and a direct impulse.
  Ungated routes also write git: the local-tools shell resolvers (`shell`, `bash`,
  `bounded_shell`) offered to the walk's tool fallback, `bash` steps executed inside
  goal-host's embedded executor, development-vessel `git_commit`/`git_push`, local-tools
  `git_commit`, the pull-sync self-heal in `substrate-pull-sync.sh`, and an off-box
  submodule-bump workflow. The `self-maintenance` entry of `FAMILY_GOALS` in
  `rhythm-conductor-tick.ts` drives an LLM to commit and push "vessel code drift" through
  these ungated routes.
- **Provenance.** Only the cutover writes provenance into the commit (gap, proposal and
  mitosis ids), and none carries the authoring execution id. After pushing, the cutover
  posts a *new* landing execution unlinked to the caller's execution, and stamps
  `pending_outcome_verification` on the gap.
- **Post-land verification.** `sweepPendingLandVerifications` (gap-to-feature tick)
  re-checks only the targeted gap's own predicate. The cutover writes
  `BEHAVIORAL VERIFICATION FAILED` only for gaps carrying a `verification_spec`.
  `regressed_by` is read in `gap-to-feature.ts` and written by no source.
- **Credit.** `propagateCreditAlongChain` (activity-api `posterior-update.ts`) adds
  `λ^d/k` to α or β along the chain, writes `variant_performance_metrics` and
  `context_thompson_scores`, applies decay on write and on read, and has no idempotency
  key and no negative-delta path. Selection reads those two stores (via
  `discover-by-shapes` → goal-host `readCandidateShapes`, and `/recommend`).
- **Crystallization.** goal-host `mintReachedTrace` extracts qualifying reaches
  immediately; ribosome-vessel extracts after re-reading `reached`. Neither can withhold a
  single execution.
- **Drafter channels read at prompt-build.** The gap's `failure_lessons` (read by
  `priorAttemptFeedbackBlock` in `feature-compose.ts`) and the file-keyed compose lessons
  (`compose-file-lessons.jsonl`, read in `feature-compose.ts`). goal-host's failure memory
  is keyed by goal text with no external write path.

The consequence-verdict change (`2026-08-26-consequence-verdict-into-credit`) chose to
correct credit after the fact, deferring a choice between reversing banked credit (A) and
grading a separate event (B). Neither is buildable against the context above: labels on
landings carry synthetic execution ids with no chain, and banked credit cannot be
reversed exactly.

## Goals / Non-Goals

**Goals:**
- Every commit made inside the substrate is attached to an attempt or recorded as
  unaccounted, whichever route made it.
- Each registered attempt has a before-state, an after-state, a deterministic outcome and
  a settlement, all durable across a cold boot.
- Consequences reach the drafter through channels it already reads, and a landing is not
  crystallized into a template before it has held.
- Settlement carries the real authoring execution id, so a later credit change can bind
  to the chain.

**Non-Goals:**
- Writing posteriors. Credit binding is a later change, gated on the prerequisites below.
- Automatic revert or forward repair of a regressed attempt.
- Backward causal attribution for failures that are not tied to a registered attempt
  (trial-revert bisection). Settlement attributes only within an attempt's own check set.
- A behavioral docs checker. The check-selection contract admits doc claims bound to
  touched files; producing them is the docs-alignment work.
- Refusing any commit.

## Decisions

### D1. Record, never block
Registration failure or absence marks the landing `unaccounted`; it does not stop it.
Unaccounted landings can never earn settlement credit, so cooperating is the only route
to reward — enforcement by the learning loop rather than by a gate.
*Alternative:* require `attemptIntent` as a hard precondition of the cutover. Rejected for
the first slice: a registration outage would halt all self-development, the failure the
`^DEFINE FIELD` guard deletion demonstrated when landings stopped for days. Revisit once
`attempt_register` has demonstrated liveness.

### D2. Git-layer sensing plus commit trailers
A container-wide hook set, installed by bootstrap through the system git configuration,
reports every commit (`post-commit`) and ref update (`reference-transaction`) to the
ledger; neither hook point is skipped by `--no-verify`. Setting the system `core.hooksPath`
disables each repository's own hooks directory, so the ledger hooks chain to any
repository-local hook and pass its exit status through; a ledger hook set that silently
disabled an existing gate would be a fail-open regression of its own. Registered routes add an
`Attempt-Id:` trailer; the ledger resolves by trailer so the cutover's rebase-before-push
keeps the link. `unaccounted_landing_scan` over watched branches is the backstop for
off-box routes and hook outages.
*Alternatives:* (a) register only in the cutover — misses every ungated route, including
the one that produced the crash-looping boredom-vessel commit; (b) a per-resolver hook on
local-tools — misses `bash` inside goal-host's executor; (c) remove git from shell tools —
correct long-term, but a capability removal belongs in its own change.
The hooks are bootstrap tier (they exist before any activity can host them) and carry no
behavior: they report; what counts as accounted is decided by the ledger.

### D3. Defer settlement instead of reversing credit
Settlement is observed after a settle window; later credit binds once, at settlement, to
the authoring execution. This replaces options A and B of the consequence-verdict change:
nothing needs reversing because nothing was banked early.
*Alternative:* bank at landing and correct later — requires an exact reverse of a decayed,
unkeyed cascade (not possible with `propagateCreditAlongChain` as it stands).

### D4. Ledger placement and storage
development-vessel serves the new shapes: the push clones, the cutover and the gap store
live there (data locality). Records are append-only JSONL files in the container volume,
one per record kind, each line keyed (`attempt_id`, `snapshot_id`,
`(attempt_id, settlement_seq)`); writers check the key before appending.
*Alternative:* a SurrealDB table in activity-api with append-only permissions. Deferred to
the credit-binding change, which needs the join in the same store as the posteriors;
putting the ledger there now would make the trace store a universal resolver.

### D5. Baseline membership (initial)
Admitted, invoked read-only: `systemd_unit_health_observer` with gap emission disabled
(reports per-unit verdicts and a distinct probe-error state); `gate_self_probe` with gap
emission disabled (runs a must-refuse and a must-accept artifact through each real
deterministic gate and reports per rule — the check that a landing weakened or broke a
gate); the vessel typecheck (`code_verify_typecheck`); the targeted gap's predicate.
Excluded until repaired, because each can report success when it did not measure:
`push_health_observer` (a missing log reads healthy), `detector_coverage_scan` (swallows
fetch errors into a zero), `interaction_expectation_verify` (returns success with an error
body), `authoring_chain_health_report` (fails on trace-store auth). Membership lives in a
`baselineCheckSet` impulse, so repairing one admits it without a code change.

### D6. Settle sweep reuses the existing post-land sweep
`sweepPendingLandVerifications` is generalized from "the gap's predicate" to "the
attempt's `invariantSet`", keeping its host tick. The settle window is read from a
`settlementPolicy` impulse. No new timer.

### D7. Readers
Unfavorable outcomes append to the gap's `failure_lessons` and to the compose lessons of
each touched file. `mintReachedTrace` and ribosome-vessel defer an execution whose output
includes a landing until `attemptSettlement.verdict === "held"`. If the ledger is
unreachable, extraction stays deferred: delaying a template is cheap, crystallizing a
regression is not. Unaccounted landings never settle and are therefore never extracted.

### D8. Authoring execution id
Registered routes pass the caller's execution id into `attemptIntent`; the cutover stops
minting an unlinked landing execution as the attempt's identity. For shell-driven commits
the executors that spawn shells (local-tools' shell resolvers and the embedded IAS
executor's `bash` host) export `SUBSTRATE_EXECUTION_ID`, and the hooks record it. Without
this link, extraction deferral (D7) could not recognize that a shell-driven execution
produced a landing, and the crash-loop class would still be crystallized.
*Alternative:* infer the execution from dispatch time windows. Rejected: a temporal
correlation is exactly the effect-as-cause trap law 12 warns against.

### D9. Check definitions are versioned in every snapshot
Each snapshot records the definition version of each check. An attempt whose
`touched_files` include a check definition is flagged `surprise` regardless of outcome,
so a change that edits its own checker is always visible. Protection by evidence
(a changed check must still catch every stored past regression) is a later change.

## Reuse audit

| Needed | Existing producer checked | Decision |
|---|---|---|
| Landing event | `cutoverApplied` | Reused as the post-snapshot trigger for R1; insufficient alone (one route of seven) |
| Post-land check | `sweepPendingLandVerifications` | Reused and generalized (D6) |
| Gate regression | `gate_self_probe` | Reused as a baseline check, read-only |
| Before/after evaluation in a throwaway checkout | `vessel_mitosis_evaluate` | Not used in this slice (pre-land only); candidate for later trial-revert attribution |
| Unit health | `systemd_unit_health_observer` | Reused, read-only mode |
| Late verdict intake | `goal_verification_label_write` | Not reused: append-only but unkeyed, with synthetic execution ids; settlement carries the real id instead |
| Feedback write | `activityFeedback_write` | Not reused: no execution id or idempotency key, and moves a store no selector reads |
| Drafter delivery | `failure_lessons`, compose file lessons | Reused (D7) |
| Crystallization control | `learning_mode:"observe"`, `extractionEligibilityPolicy` | Insufficient: decided before the outcome is known; per-execution deferral added |
| Commit history | `git_log`, `git_diff` | Reused by the scan and by `invariant_select` |

New resolvers: `attempt_register`, `invariant_select`, `invariant_evaluate`,
`outcome_compare`, `unaccounted_landing_scan`. The settle sweep is a generalization, not
a new resolver.

## Prerequisites for the later credit-binding change (filed separately, not in scope)

1. The `/reach` pre-read in activity-api `execution-traces.ts` filters on `$activity_id`
   without binding it, so late reach grading matches nothing.
2. `propagateCreditAlongChain` needs an idempotency key per (execution, verdict source).
3. `regressed_by` readers in `gap-to-feature.ts` arm on `!== undefined`, so a stored
   `null` arms them permanently.
4. `scripts/substrate/typecheck-scenario-gen.ts` rewrites the gap file without merging; it
   would clobber ledger fields written to gaps if its default path were aligned with the
   live store.

## Risks / Trade-offs

- [Snapshot cost delays landings] → baseline checks carry per-check timeouts that yield
  `timeout`; the pre-snapshot is taken once per attempt, not per retry.
- [Hooks slow every git operation] → hooks append to a local spool and deliver
  asynchronously; they never wait on the ledger.
- [Unaccounted noise from legitimate ungated routes (pull-sync self-heal, submodule
  bumps)] → the scan labels by route signature; a route that should be accounted gets
  registered, not allow-listed.
- [Settle window too short hides slow regressions; too long starves the ribosome] → the
  window is a shaped impulse; its value is a tunable read at use time, and the rate of
  `regressed` settlements discovered after `held` is itself observable.
- [The lane edits the ledger code or check definitions] → D9 makes it visible; prevention
  is a later change.

## Preconditions for the cold-boot tests

The acceptance test recreates the container. Before running it: back up the volume, and
confirm the dev seed templates survive a cold boot (the seeder must be ordered after
identity). Otherwise the template loss is recorded as a known confound, not attributed
to this change.

## Migration Plan

Additive and staged; each stage is observable before the next:
1. Ledger store and `unaccounted_landing_scan` (observe only).
2. Git hooks at bootstrap; the unaccounted rate becomes measurable.
3. Registration + trailer in the cutover; then in development-vessel `git_commit`.
4. Snapshots, `outcome_compare`, settle sweep.
5. Readers: lessons, then extraction deferral.
Rollback: unset the system `core.hooksPath`; readers treat a missing ledger as "no
record" (lessons are not written; extraction deferral applies only to executions with a
registered landing).

## Open Questions

- The initial settle window, and whether it varies by vessel.
- The set of watched branches beyond `dev` in each push clone and the super-repo.
- Whether pull-sync self-heal commits should be registered attempts or a distinct
  `maintenance` class.
