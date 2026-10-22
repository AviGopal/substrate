## Why

Code drafting is the substrate's main act of self-development, and it is not an activity. One
closed resolver, `feature_compose`, decides what the drafter is shown, asks the model, applies the
plan, runs every gate and lands the commit. The system cannot select between drafting strategies,
cannot grade one against another, and cannot mint a better one by variant. That breaks law 2
(behaviours are activities), and the information the drafter needs reaches it only when an operator
codes it into a builder (law 8).

The drafter's *view* has already been opened. A pure, clamped module (`src/drafter/`) assembles what
the drafter is shown. It is not among the autonomy scope's excluded paths, so the lane can land on it, and the
closed core keeps a floor copy of the assembly. What remains closed and fixed is **which assembly runs**: one dynamic import, one version,
no selection point and no grade. A lane landing on `src/drafter/` replaces the drafter's behaviour
for every compose at once. It does not add an arm that the outcomes can judge.

### Evidence (from a read of the system's own failed drafts)

- Checks written by the system were hollow: they asserted shapes, fields or values that the target
  function never returns. One fix bent production code to satisfy a hollow check, and one check was
  inverted.
- The check writer is told the gap as a 600-character slice of its prose, with export *names and
  kinds* only (no signatures, no returned contract), and only when an edit site resolves. It is asked
  for ONE failing test, so any planned control is dropped. The closed gate that refuses a
  contract-mismatched check computes the function's returned contract itself. The writer is never
  shown that contract.
- Compose lessons are written only when a compose is rejected, keyed by a coarse failure class. A
  hollow draft that lands teaches nothing.
- Edit goals that name a file skip the walk. goal-host's early edit-intent route posts to
  `feature_compose` directly, behind an environment switch, so activity selection never sees them.

## What Changes

Built from parts that already exist: the open drafter module and its closed pins, activity templates
and variant lineage, the walk's Thompson selection, the concept prompt selector, local-tools code
reads, and the closed gates. Nothing in the gates moves.

- **Drafting strategies become activities.** Each strategy is an activity template. It gathers
  context through existing resolvers (gap row, target code, concept priors) and ends in the existing
  walk-reachable `gap_compose` producer, naming the drafter assembly it uses. Strategies that produce
  the same output shape compete under the walk's Thompson selection, and new ones are minted as
  variants (`variant_of`) of a base drafting activity.
- **The closed core selects the assembly from an allowlist.** It loads one of the versioned
  assemblies under `src/drafter/` named on the pointer, and falls back to the floor exactly as it does
  today. The assembly is still pure and clamped by the same F1–F8 pins. The floor becomes a declared
  **control arm**, not only a failure fallback.
- **Grading uses closed, deterministic outcomes only.** A variant is credited by its landed sha,
  arming at birth, closure on its own check, and durability. It is debited by pre-registered
  contract-class refusals (`check_asserts_contract_mismatch`, `check_references_missing_export`,
  existence-only), by verify failure, and by falling back to the floor. LLM-judge verdicts never move a
  drafting posterior. Variants cannot touch the gates, the pins, the scope record or the posterior
  writer.
- **The information drafters lack becomes facts that are read when they are used.** The function's
  returned contract, the gap row's structured fields and the drafter version on the structured attempt
  record are exposed through closed builds. Variants then choose how to use them.
- **The early edit-intent route retires in stages.** Its environment switch becomes a pool shape.
  Undirected edit goals go to the walk once at least two drafting activities are advertised. Directed
  operator edits keep a deterministic path until the walk's drafting arm out-performs it on directed
  work.

## What stays closed (operator-owned, scope-excluded)

Landing (`apply_proposal_as_patch`, `vessel_mitosis_cutover`). Judging (the reach judge, the
semantic gate, the refuters). The gates (typecheck, own-check, contract-mismatch, missing-export,
existence-only, no-effect, scope floor). The drafter-split pins, the posterior writer, the variant
creator and the autonomy scope record. A drafting variant can change what the drafter is shown and
how it is prompted. It can never change what accepts the draft.

## Impact

- development-vessel (closed builds): variant allowlist load in `feature-compose.ts`; drafter record
  on the attempt record; returned-contract fact; base drafting activity seed; extended F7 pin.
- development-vessel (lane-editable): versioned assemblies under `src/drafter/`; drafting-strategy
  templates under `src/seed/`; the check writer's goal text in `gap-check-supply.ts`.
- goal-host-vessel: the route switch becomes a shape read in `src/index.ts` (lane-editable). The
  hand-off rule change in `src/routing-rules/edit-intent.ts` is a closed build.
- No new gate, no env flag, no copied learning state, and no operator-written lesson text.
