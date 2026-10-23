## Reading this design

Every claim about existing code carries a mark. **VERIFIED** means it was read on `origin/dev` of
the named vessel, at the given path and approximate line. **INFERRED** means it follows from
verified code but was not observed directly. **NOTHING EXISTS** marks a step for which no resolver,
template or shape was found. Line numbers drift, so search by the quoted function or constant name.
Autonomy-scope membership is VERIFIED against the fleet seed `scripts/substrate/autonomy-scope.json`.
The live `autonomyScope` record is authoritative over the seed.

## Context

### The drafter as it stands

- `feature_compose` is one resolver. It plans once, applies, verifies, judges and lands, and it is
  scope-excluded (VERIFIED: `repos/development-vessel/src/resolvers/feature-compose.ts` header
  :1-21; excluded in the seed).
- **What the drafter is shown is already open.** `resolveFeatureComposeInner` (:6838) runs its own
  assembly (the *floor*). It then calls the pure module `src/drafter/index.ts`
  (`planDrafterReads`, `assembleDrafterContext`) through one dynamic import (:7568). The core clamps
  the read plan (`clampDrafterReadPlan` :6596) and validates the returned context
  (`validateDrafterContext` :6688). On any refusal or throw it drafts with the floor and records
  `fell_back`. A compose that targets `src/drafter/` always drafts with the floor
  (`DRAFTER_SELF_PREFIX`, about :6540) (all VERIFIED). `src/drafter/` is not in the excluded list,
  so the lane can land on it. `test/drafter-split/` is excluded (VERIFIED, seed).
- **The closed pins** (VERIFIED: `test/drafter-split/README.md`):
  - F1: no cutover without verify, the own check, the judge, the refuter and the scope floor.
  - F2/F3: the module is pure, and only `feature-compose.ts` imports it.
  - F4: clamps on prompt bytes, op budget, the read allowlist and schema.
  - F5(b): the verdict-diff golden, with the module forced to fail.
  - F6: behaviour is preserved.
  - F7: a compose on the drafter drafts with the floor.
  - F8: a 2-second bound.
  The README's phase-2 follow-ups are still open: remove the duplicated floor assembly, run the
  module in a Worker, and put `drafter.version` and `fell_back` on the structured attempt record.
- **There is one assembly and no selection.** The import path is fixed (:7568) and the module
  declares `VERSION = "drafter-v1"` (`src/drafter/index.ts`). The drafter record is attached to the
  report body only (:6494-6498). `AttemptRecord` in `src/resolvers/retry-evidence.ts` has no drafter
  field (all VERIFIED).
- **Concept priors are shown but chosen by the core.** `conceptPriorsBlock` (:3744) asks
  `concept_select_for_prompt` with the spec and the edit site as a fixed query (:7429). Applied ids
  cited by the plan are credited success or failure by `creditAppliedConcepts` (:5597, :7765,
  :10855) (all VERIFIED). A closed build places `applied_ids` in the closed
  exact plan schema; it is built and reviewed, and lands ahead of this change.
- **Lessons teach only from rejections.** `appendComposeLesson` (:5318) is reached for a draft only
  under `verdict !== "FAVORABLE"` (:10559) (VERIFIED). Recall queries concept-db by the most recent
  coarse failure class (`composeLessonsBlock` :5675) (VERIFIED). The guidance text per class is an
  operator-written constant (`COMPOSE_LESSON_GUIDANCE`, `src/drafter/lessons.ts`) (VERIFIED). A
  hollow draft that lands writes no lesson.
- **The model call stays inside the core.** `llmCallWithFailover` (:708, called at :7682) makes
  the call (VERIFIED). Model choice already has its own bandit.

### The check writer

- `gap_check_supply_tick` (`src/resolvers/gap-check-supply.ts`, lane-editable) dispatches one
  edit-intent goal per unarmed gap. The goal text is `checkSupplyGoal`/`checkSupplyGoalText`
  (:344-371). It says "Write ONE failing test … that reproduces: <symptom>", where `symptomOf` cuts
  the summary to 600 characters (:247-252). The writer is given:
  - export names and kinds only (`exportListSentence` :381-401), only when a source edit site
    resolves;
  - evidence anchors (`falsifiableAnchors` :296);
  - the last judged attempt (`priorAttemptSentence` :410).
  The site comes from `edit_site` or a `src/` path in the prose (`checkSupplySite` :485-494). Other
  structured fields, such as `template_id`, are not consulted there (all VERIFIED).
- The compose that writes the check re-reads the stored row (`hydrateComposeGap`,
  `retry-evidence.ts` about :757), so the drafter module receives the full `gapMeta` (VERIFIED). The
  starvation is in what is *rendered*, and the renderer is open.
- **The writer is never shown the contract the gate enforces.** The arm gate refuses a check whose
  red asserts a shape, body field or value kind the called function never returns
  (`contractMismatchRefusal` :858, `CONTRACT_MISMATCH_STAGE` :789). It computes that contract with the
  private `returnedContract` (:793, used :975) in the closed
  `src/resolvers/check-supply-admission.ts` (VERIFIED).
- **A passing control in the check file cannot co-exist with arming.** The arm writes a check
  only when every newly named test is among the run's failures (VERIFIED: `gap-check-supply.ts`
  header, ARM step). A planned control that passes therefore blocks arming (INFERRED).

### Routing and selection

- goal-host's early edit-intent route (`repos/goal-host-vessel/src/index.ts` about :14849-15160)
  hands any goal that names a repos file with an edit verb to `feature_compose` before the walk. It
  is switched by `process.env.ROUTE_EDIT_INTENT_TO_COMPOSE` (:14853), which breaks law 1. It sets
  `directed: opts.operatorOrigin === true` (:14950) and forwards the gap with only
  `{edit_site}` (VERIFIED). The hand-off predicate is `decideHandoff` in the closed
  `src/routing-rules/edit-intent.ts` (VERIFIED). `src/index.ts` itself is lane-editable
  (VERIFIED, seed edit note).
- After the walk, a post-walk edit route (:15750+) composes again, and an UNFAVORABLE compose
  escalates to `patch_with_tools` (:16283). Both are graded by template id
  (`recordDeterministicLabel`, `penaliseHollowTemplate` :7034). That makes a **hard-wired two-arm
  edit family in fixed order**, not a selection (VERIFIED).
- The walk picks among candidates whose outputs cover the target by a Thompson sample over their
  posterior (`readCandidateShapes` about :8603-8640, `betaSample`) (VERIFIED). `gap_compose` is
  advertised by development-vessel (`src/config.ts` :147) and dispatches to `feature_compose`
  (`src/routes/impulses.ts` :511-533) (VERIFIED). **No seed template uses `gap_compose`** (VERIFIED,
  grep of `src/seed/`). `feature_compose` is graded as a pseudo-arm with no `activity` row (VERIFIED:
  goal-host comment about :7124). Variant lineage (`variant_of`, `getVariantFamily`,
  `repos/activity-api/src/db/paradigm.ts` :1936) therefore has no base to hang drafting variants
  from (INFERRED).
- Template format and binding (VERIFIED):
  - `src/seed/scaffold-mitosis-track.ts` chains `concept_select_for_prompt` → `fs_read` →
    `llm_completion_dispatch` → `vessel_mitosis_start`, binding results as `{{<task>_<field>}}`.
  - `src/seed/mitosis-tick.ts` documents the `{{<taskId>_content}}` form that both dispatchers honour.

## Mapping each step to existing parts (reuse before mint)

| Step | Existing part | Status |
|---|---|---|
| 1. Gather the gap row's structured fields | `substrateGap` read (advertised). `hydrateComposeGap` puts the merged row in `DrafterFacts.gapMeta` (`src/drafter/types.ts`). | EXISTS (VERIFIED). Gap: the open renderers and the check-writer goal show a prose slice. Lane-editable fix. |
| 2. Read the target's real contract | `code_find_function` (local-tools `src/index.ts` :598-631) returns `signature` as the *first declaration line* only. `code_read_lines` reads a span. `returnedContract` (closed, private). | **Exists:** a callable-contract field on the EXISTING `codeIntrospectResult` shape (`code_introspect`, opt-in `include_contract`), filled from the same export and returned-contract extraction the gate uses, plus cross-file symbols. No new shape. |
| 3. Recall concept priors | `concept_select_for_prompt` (advertised; `src/resolvers/concept-select-for-prompt.ts`). Called by the core with a fixed query (:7429). | EXISTS (VERIFIED). **NOTHING EXISTS** for a *variant* to choose the prior query or source types: `DrafterReadPlan` has `reads`, `lessonQueries` and `ancestorDepth` only. |
| 4. LLM draft | `llmCallWithFailover` inside the core. `llm_completion_dispatch` / `llm_completion` advertised. | EXISTS (VERIFIED). Kept closed (Decision 3). |
| 5. Typecheck | `code_verify_typecheck` (local-tools :751) and the core's verify. | EXISTS (VERIFIED). The gate stays closed. A variant gets no typecheck of its own. |
| 6. Write or run the check | `gap_check_supply_tick` → edit-intent goal → `feature_compose` in `test_writing` mode (`CHECK_SUPPLY_COMPOSE_MODE`, check-supply-admission :28). `test_suite` (advertised). `judgeTestWritingCheck` (:1043). | EXISTS (VERIFIED). **NOTHING EXISTS** for declared controls (a passing companion test the arm judge ignores). |
| 7. Select between strategies | The walk's Thompson pick; `gap_compose`; the `thompson_posterior` shape (advertised). | Mechanism EXISTS (VERIFIED). **NOTHING EXISTS**: no drafting activity template and no base activity row. |
| 8. Run the selected assembly | One fixed import (:7568). | **NOTHING EXISTS**: no pointer field, path pattern or shape names an assembly. |
| 9. Grade the variant | Deterministic signals exist: the landed-sha label (goal-host :14067), `check_asserts_contract_mismatch`, `check_references_missing_export` (:740), `existenceOnlyCheck` (gap-check-supply :446), the birth verdict, own-check closure, `regressed_by`. The posterior writer is `repos/activity-api/src/lib/posterior-update.ts` (closed). | Signals EXIST (VERIFIED). **NOTHING EXISTS** to attribute them to a drafter version: the version is not on the attempt record. |
| 10. Control arm | The floor, used only on module failure or self-targeting. | **NOTHING EXISTS** for deliberate assignment. An unassigned ablation arm has been reported, but it was not found in `src/` on `origin/dev` (INFERRED, unverified). |
| 11. Teach from success | Concept credit for applied priors (:10855). | Partial (VERIFIED). **NOTHING EXISTS** for lessons from graded *successes*. Lesson text is an operator constant. |
| 12. Steer the edit route by a shape | `ROUTE_EDIT_INTENT_TO_COMPOSE` environment read. | **NOTHING EXISTS** as a shape. |

## Decisions

1. **The variable unit is a drafting-strategy activity.** A versioned module on its own is code,
   not an activity, so on its own it fails law 2. Each strategy is a template under `src/seed/` that
   ends in `gap_compose` with `config.drafter_variant: "<id>"`. Earlier tasks may gather facts
   through existing resolvers (steps 1-3) and pass them only as **requests the core fulfils under
   its clamps**, never as free prompt text. Strategies for fixes and for checks (`test_writing`) are
   separate families, because their outcomes differ.
2. **The core loads the named assembly from an allowlist.** An id must match
   `^drafter-v[0-9]+[a-z0-9-]*$` and resolve to `src/drafter/variants/<id>/index.ts`. `"floor"` names
   the core's own floor with no module loaded; an absent id, or the explicit `"drafter-v1"`, drafts
   exactly as today (the shipped drafter module is loaded as it is now), so a recorded id always
   replays its own drafter. Anything else drafts with the floor and records
   `fell_back: "unknown_variant"`. Every F1–F8 pin applies to every
   variant. F2/F3 extend to the variants directory. F7 extends so that a compose whose targets fall
   under `src/drafter/` drafts with the floor and never loads a variant.
3. **Prompt construction varies. The call and the gates do not.** The draft call, the plan schema,
   apply, verify, the own check, the semantic gate, the refuters, the scope floor and landing stay
   in the core. A plan drafted outside the core and applied by a template (the
   `scaffold-mitosis-track` pattern of full-file rewrite through `vessel_mitosis_start`) is refused
   for landing work: it skips every gate. Model choice stays with the existing model bandit.
4. **The floor is a declared arm.** The family's base activity binds `drafter_variant: "floor"`. It
   is selected by Thompson like any variant. It is the control every variant is compared against,
   and the arm the system falls back to.
5. **Missing facts are closed builds, and their use is open.** The core gains three fact sources,
   each clamped like `reads`:
   - `contract` requests: the returned shapes, body keys and kinds of a named exported function,
     served by the `contract` field of the existing `codeIntrospectResult` shape, which is filled
     from the same extraction the gate uses (one source; never a second extraction);
   - `priorQueries`: `concept_select_for_prompt` with a variant's query and source types,
     budget-capped;
   - the full structured gap row, already in `gapMeta`.
   A variant decides which to ask for and how to render them. The writer and the gate read one
   contract, so a contract-mismatched check becomes a variant's choice to ignore a fact it was shown.
   Ignoring it is graded.
6. **Grading** (validator out-ranks producer). Every signal that moves a drafting posterior is
   computed by closed code after the draft, from state the variant cannot write.
   - α (success): a landed sha confirmed on `origin/dev` **and** a later closed confirmation. For
     `test_writing`, the check is armed with a birth verdict of present. For a fix, the gap is closed
     by its own check after the landing.
   - Delayed β (durability): a credited landing later recorded `regressed_by`, or reverted within
     the family's durability window. The window is a field on the family's rhythm or policy shape,
     about 24 h. The β is settled once (the `#2 regressed` settlement pattern).
   - β (pre-registered refusals): `check_asserts_contract_mismatch`,
     `check_references_missing_export`, existence-only, red-for-the-wrong-reason, verify failure,
     no-effect region, the scope floor withholding FAVORABLE, and `fell_back` for any reason other
     than self-targeting. A fallback debits the *variant* that was selected, never the floor.
   - No update (a non-attempt): capacity BUSY, admission refusal before drafting, the
     LLM-plane-null class, and an infrastructure refusal of the semantic judge.
   - **Never an update:** a FAVORABLE compose on its own, a reach verdict from the LLM judge, or a
     semantic-gate or refuter verdict. These can *withhold* a success (they gate landing) but never
     write α or β. The walk's `reached` counts only when its reason is a deterministic label (the
     landed latch).
7. **Attribution keys on the attempt record.** `drafter: {variant, version, fell_back}` is written
   on the structured attempt record and carried by the `Attempt-Id` trailer. That lets the sweep,
   the arm step and the durability settlement credit the variant that drafted, not the template that
   happened to run last.
8. **Lessons come from graded outcomes.** A lesson row is minted from an α or β event, with its
   class, the refusal record and the variant id. A success writes a positive lesson (what the
   variant was shown and that it held). Hand-written guidance constants are not extended. They are
   frozen as the floor's text.
9. **The early route retires through selection, not by deletion.** See Retirement below.

## Retirement of the early edit-intent route

- **R0 (shape, not env).** `ROUTE_EDIT_INTENT_TO_COMPOSE` becomes a record read through discovery
  under the EXISTING `poolImpulse` shape, as a new record kind beside the trust-root policy records
  it already carries (such as the daemon and federation-ingress auth policies): admin-only write,
  attested, re-verified on read. No new shape is minted (law 3); only the record kind is new. With no
  record, the behaviour is unchanged. Lane-editable (goal-host `src/index.ts`).
- **R1 (select inside the route).** The route keeps posting to `feature_compose`, but it fills
  `drafter_variant` by a Thompson sample over the drafting family's posteriors (`thompson_posterior`).
  This is the staged path: selection and grading start before the walk carries edits.
  Lane-editable.
- **R2 (undirected work goes to the walk).** `decideHandoff` returns `route: "walk"` with the target
  bound for undirected goals, once the policy shape says so **and** at least two drafting activities
  advertise the edit output shape. The walk then picks the activity. A closed build: the routing rules
  and the routing corpus are excluded.
- **R3 (directed edits).** `directed: true` keeps the deterministic route, which passes the
  family's best arm by posterior mean (not a sample), until the walk's drafting arm reaches on a
  pre-registered directed holdout at least as often as the route. The post-walk route and the
  `patch_with_tools` escalation are unchanged by this change. Folding them into the family is a
  follow-up.

## Refused patterns (and the law each would break)

| Refused pattern | Law it would break |
|---|---|
| Variant text injected through `spec` or other free pointer text | 8 (bypasses clamps; the load-bearing fact must come as a fact, not prose) |
| A drafting template that applies its own plan | F1 |
| Grading by FAVORABLE or by any LLM verdict | Validator-out-ranks-producer ruling |
| An environment flag to enable variants | 1 |
| An operator-written lesson or prior text for variants | 4, plus the ruling that lesson text is an ungraded constant |
| Variants editing `test/drafter-split/`, the core, the gates or the scope record | Scope containment |
| A second model bandit inside drafting | 3 |
| Deleting the early route before the walk out-performs it on directed work | 6 (and directed operators would lose their path) |

## Risks

- **Grade starvation.** Arming and closure are slow, so posteriors move slowly. Mitigation: β from
  refusals arrives within the compose. Report the per-variant attempt denominator alongside the
  posterior.
- **Semantic-only rejections never debit.** A variant the semantic gate always rejects keeps its
  prior. Mitigation: report its unresolved share. A share above the family's is a gap for an
  operator ruling, not a posterior write.
- **Variant sprawl** (law 3). New variants only as `variant_of` the base. Retire a variant whose
  posterior mean stays below the floor after a shaped minimum number of attempts.
- **Duplicated floor drift.** The floor copy in the core must stay the control. The phase-2 dedup
  keeps exactly one floor, in the core.
- **The `applied_ids` schema build.** Built and reviewed; if it were absent, concept credit for
  variant-shown priors would be lost but grading would be unaffected.
