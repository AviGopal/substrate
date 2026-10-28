Each step names its owner:

- **[operator build]**: it touches a path the autonomy scope excludes. It lands as a directed build,
  with qa review and the scope entry for any new judge code in the same act.
- **[system]**: every path it touches is lane-editable, so it can be dispatched as an edit goal
  through the lane.

Each step carries a **must-fail check**: a test or probe that fails on the tree before the step and
passes after it. It is written first and seen red. A step whose check cannot be made to fail is not
done.

## 1. Prerequisites in the closed core (the drafter-split phase-2 follow-ups)

Stage 1 is the minimal pair that makes selection and attribution possible: 1.1 and 1.2. Stage 1b
(1.3 and 1.4) follows without blocking variants.

- [x] 1.1 **[operator build]** Write the drafter record on the structured attempt record. Fields:
  `drafter: {variant, version, fell_back}`, in `retry-evidence.ts` `AttemptRecord` and on the
  `feature-compose.ts` attempt write.
  Must-fail: a compose with the module forced to throw writes an attempt record with no
  `drafter.fell_back`. **Verified present** at development-vessel `e359a02d`; `test/drafter-split/f9-attempt-drafter-record.test.ts` passed in the focused suite (68 passed, 0 failed).
- [x] 1.2 **[operator build]** Load the named assembly from an allowlist: `drafter_variant` on the
  pointer, `^drafter-v[0-9]+[a-z0-9-]*$` → `src/drafter/variants/<id>/index.ts`, `"floor"` for the
  floor; absent, or the explicit `"drafter-v1"` (the shipped module, `src/drafter/index.ts`), drafts
  exactly as today, so a recorded id always replays its own drafter. Anything else drafts with the floor and records `fell_back: "unknown_variant"`. Extend the
  pins:
  - F2/F3: purity, and the only importer, over `src/drafter/variants/`;
  - F7: any target under `src/drafter/` drafts with the floor and loads no variant.
  Must-fail: `drafter_variant: "../resolvers/x"` loads a module. A compose targeting a variant's own
  file loads that variant. **Verified present** at development-vessel `e359a02d`; `test/drafter-split/f10-variant-allowlist.test.ts`, `f2-f3-module-boundary.test.ts`, and `f7-floor-self-repair.test.ts` passed in the focused suite (68 passed, 0 failed).
- [x] 1.3 **[operator build, stage 1b]** Run the module in a Worker with a wall-clock cap. A timeout is
  recorded as `fell_back: "timeout"`.
  Must-fail: a variant that never returns holds the compose past the cap. **Verified locally** in `test/drafter-split/f8-runtime-time-bound.test.ts`: a non-responsive Worker is terminated at the 2 s cap and the drafter falls back with `fell_back: "timeout"`; the same test also confirms the shipped drafter executes successfully in the production Worker. F2/F3's single-importer pin was moved to the Worker and passed.
- [ ] 1.4 **[operator build, stage 1b]** Remove the duplicated floor assembly from the core, leaving one floor.
  Must-fail: the F5(b) verdict-diff golden, with the module forced to fail, differs from the
  recording.

## 2. Facts the drafter and the check writer lack (closed builds, open use)

- [x] 2.1 **[operator build]** The contract field itself already exists: `codeIntrospectResult`
  carries the callable contract (`code_introspect` with `include_contract`), filled from the same
  extraction `contractMismatchRefusal` uses, and the check writer's goal already shows signatures.
  What remains is only the drafter-side `contract` read-request kind over that field: it takes
  `{path, fn}` and returns `{shapes, bodyKeys, kinds}` (null when open), clamped by count and bytes like
  `reads`. No second extraction.
  Must-fail (one-source test): on the hollow-check fixtures, the fact differs from the gate's own
  reading. Mutating the gate's extractor changes the fact. **Verified at development-vessel
  `faf6502a`**: the contract fact is projected from `codeIntrospectResult`'s `exportContract` output,
  which uses the same `returnedContract` extractor read by `contractMismatchRefusal`; open or
  partially open contracts return null. `test/drafter-split/f12-contract-read.test.ts` passed (6/6),
  including the 333be5f hollow-check fixture and a return-contract mutation that changes both the fact
  and the gate's refusal reading;
  `f4-clamps.test.ts` passed (42/42), the F5(b) verdict-diff golden passed (1/1), and
  `bun run typecheck` passed. The new contract-read test was observed red before implementation.
- [ ] 2.2 **[operator build]** Add a `priorQueries` read-request kind: `concept_select_for_prompt`
  with the variant's query and source types, under a capped token budget. Ids that are shown join the
  `applied_ids` allowlist.
  Must-fail: an over-budget request is truncated rather than refused, or an id that was not shown is
  credited.
- [ ] 2.3 **[operator build]** Declared controls in `test_writing`: a test titled as a control must
  pass at HEAD and is excluded from "every new title fails". It is recorded on the check. Touches the
  arm judge in excluded files.
  Must-fail: a check file with one failing assertion and one passing declared control is refused.

## 3. The drafting family

- [ ] 3.1 **[system, with an extraction gap as fallback]** The base activity row, by extraction. Once
  5.2 stamps `drafter_variant` on edit executions, the ribosome extracts the base `draft-edit` and
  `draft-check` templates (`gap_compose`, `drafter_variant: "floor"`) from reached executions. If the
  ribosome does not extract single-producer executions, file that as the gap. Decision point, dated
  when this change is approved: if no base row exists by extraction by that date — most reached runs
  carry no task records, so there may be nothing to extract — an operator seeds the base row as a
  recorded exception to law 4 and logs it, so this stage cannot stall silently.
  Must-fail: `getVariantFamily` on the base id returns no row.
- [ ] 3.2 **[system]** The first variant, `drafter-v2-contract`, under `src/drafter/variants/`. It
  requests the `contract` fact for every function the spec or the check names, and renders the gap
  row's structured fields (`edit_site`, `template_id`, check fields, `suspected_real_location`) in
  place of prose slices. It is minted as `variant_of` the base.
  Must-fail: on the hollow-check fixture corpus, the rendered context lacks the returned keys.
- [ ] 3.3 **[system]** The check writer's goal (`gap-check-supply.ts`) names the gap's structured
  fields and its id, instead of only a 600-character prose slice, so that the compose's variant
  renders them. It resolves the site from `template_id` and the other structured fields when the
  prose names no `src/` path.
  Must-fail: a gap with a `template_id` and no source path in its summary gets no site.

## 4. Grading (closed)

- [ ] 4.1 **[operator build]** A settlement maps attempt-record outcomes to the drafting variant's
  posterior through the existing posterior writer, exactly as design Decision 6 states. Fixtures:
  - (a) FAVORABLE alone gives no α;
  - (b) a semantic-gate rejection gives no β;
  - (c) `check_asserts_contract_mismatch` gives β to the drafting variant;
  - (d) `fell_back` gives β to the variant, and the floor is unchanged;
  - (e) landed and then closed on its own check gives α once;
  - (f) a later `regressed_by` gives one β;
  - (g) BUSY and admission refusals give no update.
  Must-fail: each fixture, before the settlement exists.
- [ ] 4.2 **[operator build]** Lessons from graded events: an α or β writes a lesson row with its
  class, the refusal record and the variant id, and a success writes a positive lesson. The guidance
  constants are frozen as the floor's text.
  Must-fail: a landed, closed compose writes no lesson.

## 5. Retiring the early edit-intent route

- [ ] 5.1 **[system-first: filed as a gap once this change is approved, with a seven-day window before
  an operator build]** R0: the route switch is read from a new record kind under the existing
  `poolImpulse` shape through discovery. With no record, behaviour is unchanged. The environment read is removed.
  Must-fail: with a record that disables the route, a named-file edit goal still composes early; or
  the source still reads `ROUTE_EDIT_INTENT_TO_COMPOSE`.
- [ ] 5.2 **[system]** R1: the route fills `drafter_variant` by a Thompson sample over the family's
  posteriors (`thompson_posterior`). Directed goals take the arm with the best posterior mean.
  Must-fail: with two arms of known posteriors, the route always sends `floor`.
- [ ] 5.3 **[operator build]** R2: `decideHandoff` returns `walk`, with the target bound, for
  undirected named-file edit goals when the policy says so and at least two drafting activities
  advertise the edit output shape. Add routing-corpus cases.
  Must-fail: the new corpus case routes to `feature_compose`.
- [ ] 5.4 **[operator build]** R3: the directed flip. A pre-registered directed holdout and the
  criterion "walk reach ≥ route reach, with the deterministic label only" go before any data. Flip
  only on that criterion.
  Must-fail: the holdout run shows the walk below the route, and the flip is refused.

## 6. Measurement and the autonomy criterion

- [ ] 6.1 **[system, measurement]** Pre-register, before the first variant runs:
  - per-variant α/β and the attempt denominator;
  - the contract-mismatch refusal share among `test_writing` composes, for the floor and for v2;
  - the semantic-only unresolved share.
  Falsifier: after the shaped minimum number of attempts per arm, v2's contract-mismatch share is
  not lower than the floor's. v2 is then retired by its grade, not by an operator.
  A natural first target for a variant: the drafter today is shown concept priors but returns no
  `applied_ids`, so no prior is ever credited; a variant that renders priors and asks for the ids it
  used is graded by whether credit starts to flow.
  Precondition for fair grading: the clamp that keeps a compose stage's prompt under the model's
  input ceiling lives in the floor (the control arm), not in variants, so no arm is graded on
  refusals the floor would also have hit.
- [ ] 6.2 **[system, measurement]** Autonomy criterion: a variant minted by the system (`variant_of` the base, under
  `src/drafter/variants/`, landed by the lane with no operator hands) is selected by Thompson and out-
  grades the floor on the deterministic settlement.
  Must-fail: after the shaped minimum number of attempts, the system-minted variant has never been
  selected, or it has been selected and does not out-grade the floor.
