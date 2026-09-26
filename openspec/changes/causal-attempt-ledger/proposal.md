## Why

The substrate lands its own changes but does not link a landing to what it changed. A
landing is credited at reach time and re-checked, if at all, only against the gap it
targeted (`sweepPendingLandVerifications` in `gap-to-feature.ts`). Side effects outside
that gap — a gate that stops accepting valid input, a unit that crash-loops, a doc claim
the change falsified — are discovered later by an operator, and the discovery is never
attributed back: `regressed_by` has readers in `gap-to-feature.ts` and no writer in source.
Credit banked at landing cannot be taken back (`propagateCreditAlongChain` is additive,
decayed at write and read, and unkeyed), and the ribosome extracts a reached execution
into a reusable template immediately (`mintReachedTrace`), so a landing that later proves
harmful becomes a preferred pathway. The loop therefore compounds its mistakes, and the
gap triple's third measure — solution durability — has no data source.

The earlier change `2026-08-26-consequence-verdict-into-credit` proposed correcting credit
from late verdicts but could not be built: landed commits carry synthetic execution ids
with no execution row, so no verdict can find the chain to correct. This change supplies
that join (every landing is registered against the walk execution that authored it) and
replaces after-the-fact reversal with **deferred settlement**: nothing is banked for a
landing until its outcome has been observed and held.

Evidence and re-derivation commands for every claim above: `sources.md` in this change.

## What Changes

- **Attempt registration on every landing route.** Each route that commits or pushes
  records an `attemptIntent` (authoring execution, gap, touched files, predicted effect,
  pre-state snapshot) before it mutates. A landing without one still proceeds, but is
  marked *unaccounted*, is filed as a gap by a detector, and can never earn credit.
- **State snapshots as impulses.** `stateSnapshot` points at the repository sha, the
  deployed artifact, the vessel inventory, a configuration fingerprint and the
  check-definition version, and records each check's verdict as one of
  `pass | fail | unknown | timeout | not_applicable`.
- **A baseline check set that an attempt cannot opt out of**, plus checks selected from
  the touched files and the gap's own predicate. The baseline is a shaped impulse read at
  use time, not a constant.
- **Deterministic outcome comparison.** `outcome_compare` diffs pre and post snapshots
  against the prediction and emits `attemptOutcome` (intended effect met/unmet/unknown,
  unexpected flips, surprise).
- **Settlement.** A settle sweep re-evaluates the check set after a settle window and
  emits `attemptSettlement` (`held | regressed | unresolved`). Settlement events are
  append-only and keyed by attempt id; re-running a settlement is a no-op.
- **Readers wired at use time.** An unfavorable outcome is written into the channels the
  drafter already reads at prompt-build (the gap's `failure_lessons` and the file-keyed
  compose lessons); the ribosome defers extraction of an execution that produced a
  landing until its settlement is `held`.
- **Unaccounted-landing detector.** Any commit on a watched branch with no
  `attemptIntent` is filed as a gap without operator involvement.
- **Deferred to later changes** (not in this change): automatic revert, forward repair,
  backward causal attribution for failures not tied to an attempt, and binding
  settlement into posteriors. The last depends on prerequisites listed in `design.md`.

## Capabilities

### New Capabilities
- `attempt-registration`: every landing route records an `attemptIntent` with a
  pre-state snapshot; unaccounted landings are detected and filed.
- `state-snapshot`: snapshot shape, check-set composition (baseline + selected), and the
  five-valued verdict contract.
- `attempt-outcome-settlement`: deterministic outcome comparison, the settle sweep, and
  append-only idempotent settlement events.
- `outcome-readers`: delivery of outcomes to the drafter's prompt-build channels and the
  ribosome's extraction deferral.

### Modified Capabilities
<!-- none: the repository has no openspec/specs baseline to modify -->

## Impact

- `repos/development-vessel/src/resolvers/`: `vessel-mitosis-cutover.ts`,
  `apply-proposal-as-patch.ts`, `feature-compose.ts`, `doc-drift-fix.ts`,
  `gap-to-feature.ts` (settle sweep generalizes `sweepPendingLandVerifications`), new
  resolvers for `attempt_register`, `invariant_select`, `invariant_evaluate`,
  `outcome_compare`, `unaccounted_landing_scan`; `config.ts` and `routes/impulses.ts`
  for shape registration.
- Bootstrap tier: a container-wide git hook set installed through the system git
  configuration by the entrypoint (`scripts/substrate/`).
- `repos/goal-host-vessel/src/index.ts`: `mintReachedTrace` consults settlement for
  landing executions.
- `repos/ribosome-vessel`: extraction deferral for landing executions.
- Shapes consumed: `substrateGap`, `code_modification_proposal`, `cutoverApplied`,
  `git_log`, `git_diff`, `systemd_unit_health_observer`, `gate_self_probe`,
  `code_verify_typecheck`. Shapes produced (new): `attemptIntent`, `invariantSet`,
  `stateSnapshot`, `attemptOutcome`, `attemptSettlement`, plus the policy impulses
  `baselineCheckSet` and `settlementPolicy`. Existing producers checked first and why each
  was insufficient: `design.md` → *Reuse audit*.
- Falsifier: an isolated change that causes a known regression lands, and the system
  (a) holds a pre-state snapshot taken before the mutation, (b) records the regression as
  an unexpected flip in `attemptOutcome`, (c) settles it `regressed`, (d) defers its
  ribosome extraction, and (e) retains all of it across a cold boot; a clean change
  settles `held`; repeating either produces no second settlement event; a direct commit
  with no intent becomes a gap with no operator action. "The sweep ran" is not success.
