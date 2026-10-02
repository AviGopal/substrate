# A proven recipe should rescue a reach when its fresh partner fails to produce

## Why (root cause, empirically pinned 2026-08-27)

Countable grounding in goal-host (`verifyRecompute`, `index.ts:~4183`) requires **two
independently authored derivations to both produce a value and agree**:

```
const agreed = a?.value != null && b?.value != null && a.value === b.value;
```

When a family has a **live recipe** (`_useRecipe`), side `a` is the recipe's instantiated
command and side `b` is a fresh LLM-authored derivation. Measured live this session across a
4-goal reuse batch on proven families:

- `distinct-file-extensions` (live, agreed:19/disagreed:2) produced the **correct** answer as
  side `a` — and the reach **abstained** because the fresh side `b` failed to produce a usable
  measurement. The correct, earned answer was discarded.
- `subdirectory-count` was **demoted** (agreed:2 ≤ disagreed:1×2) because a single unreliable
  fresh partner (`git ls-tree` → 0 vs `find` → 13) contradicted a correct recipe.
- Net: **0/4 reached; store unchanged; zero recipe activity in 7 days.** The whole
  countable-grounding capability is dormant not because the recipes are wrong, but because the
  disposable second derivation is unreliable and the reconcile is unconditionally two-sided.

This is the concrete mechanism behind "component 2 (consistently gaining ground) is dormant":
the system **gains ground, then discards it** every time a fresh partner fails, and **poisons**
barely-minted recipes when a fresh partner disagrees.

## Intent (aligned with the existing design, not a redesign)

`verifier-recipe.ts` already states the principle: *"A proven recipe on one side raises
agreement rate while the evidence bar is unchanged."* The gap is the **failure** case, not the
disagreement case: a recipe that has **earned trust through N independent prior agreements**
should not be discarded because *this* fresh partner failed to show up. Disagreement must still
demote (that protection is load-bearing and stays); **absence of a partner is not a
disagreement.**

## What changes (one bounded rule, guarded)

In the reconcile step, when `_useRecipe` and side `a` (the recipe) produced a non-degenerate
value but side `b` is **null** (failed to produce — NOT a contradicting value):

- Accept side `a`'s value as truth **iff** the recipe is strongly proven:
  `recipe.agreed >= MIN_PROVEN_AGREEMENTS` (proposed 10) and `recipe.disagreed === 0`
  (or `agreed > disagreed * K` with a strict K), and the value is non-degenerate (`> 0` for
  numeric, non-error token otherwise).
- Do **not** increment `agreed` for a rescue (no self-reinforcement from a partnerless use);
  record a distinct `rescued` counter so the behaviour is observable.
- If side `b` produced a value that **disagrees**, unchanged: abstain and increment `disagreed`
  (demotion protection preserved).

## Hard constraints (why this is bounded, not the self-confirmation the design forbids)

- A rescue is only allowed for a recipe **already validated by ≥10 independent prior partners**
  — this is not "trust one fresh derivation," it is "trust ground re-earned 10+ times when the
  disposable partner is merely absent."
- Disagreement still demotes; a subtly-wrong recipe on a new tree will be contradicted by future
  partners and retired — the rescue does not disable that.
- Degenerate truth (0 / empty / error token) can never be rescued (the same guard the mint and
  donation sites already enforce).

## Verification (four-stage; this proposal is the SPEC step, DEV must follow)

- **Oracle:** re-run the reuse batch (distinct-file-extensions on activity-api/discovery,
  subdirectory-count on concept-db/ias-executor). Expect: reaches where the recipe answer
  matches an independently-computed ground truth; `rescued` counter climbs; `agreed` does NOT
  climb on rescues.
- **Hollow-rate watch (the documented regression tripwire):** the code records a prior collapse
  25/48 → 18/48 from a hasty change in this block. Gate DEV on the failure-mode harness hollow
  rate not rising; reverting is one guard.
- **Counterfactual (law 12):** change ONLY this rule; record `rescued` vs `agreed` separately so
  the intervention's effect is keyed and isolable.

## DEV-ready implementation (exact, verified by reasoning; dispatch could not land it — see below)

`independent-recompute.ts` — extend `reconcileDerivations` (backward-compatible optional param):

```ts
export function reconcileDerivations(a: number | null, b: number | null, recipeRescue?: { agreed: number; disagreed: number }): { truth: number } | { truth: null; reason: string } {
  if (a === null || b === null) {
    // RESCUE: a strongly-proven recipe (side a) answers when its fresh partner (side b) merely
    // FAILED to produce (b === null) — never when b disagrees (both non-null), never degenerate.
    if (recipeRescue && a !== null && a > 0 && b === null && recipeRescue.agreed >= 10 && recipeRescue.agreed > recipeRescue.disagreed * 4) {
      return { truth: a };
    }
    return { truth: null, reason: "only one derivation produced a usable measurement" };
  }
  if (a !== b) return { truth: null, reason: `two independent derivations disagree (${a} vs ${b}) — neither is ground truth` };
  return { truth: a };
}
```

`independent-recompute.test.ts` — executing test cases with the REAL measured inputs from the 2026-08-27 batch:

```ts
// distinct-file-extensions on discovery-vessel: recipe produced 1, fresh partner failed → RESCUE
expect(reconcileDerivations(1, null, { agreed: 19, disagreed: 2 })).toEqual({ truth: 1 });
// ias-executor subdirs: recipe 13 vs fresh 0 — a DISAGREEMENT, not absence → still abstain
expect(reconcileDerivations(13, 0, { agreed: 19, disagreed: 2 }).truth).toBeNull();
// weakly-proven recipe (agreed 2) → no rescue
expect(reconcileDerivations(3, null, { agreed: 2, disagreed: 1 }).truth).toBeNull();
// degenerate truth → no rescue
expect(reconcileDerivations(0, null, { agreed: 19, disagreed: 2 }).truth).toBeNull();
// no recipe context (two fresh derivations, one failed) → unchanged behavior
expect(reconcileDerivations(1, null).truth).toBeNull();
```

`index.ts` — the ONE-LINE call-site change at the reconcile step (~4212), same shape as the landed one-liner `37de49f`:

```ts
const reconciled = reconcileDerivations(a?.value ?? null, b?.value ?? null,
  _useRecipe && _recipe ? { agreed: _recipe.agreed, disagreed: _recipe.disagreed } : undefined);
```

## Landing note (2026-08-27): dispatch path is OPEN but the drafter could not land this

`fc-coverage` is a DOWNGRADE, not a hard block — `37de49f` landed a 1-line index.ts edit via dispatch. But FOUR dispatch attempts on this change failed on DRAFTER quality, not refusal: afd2c268 (multi-line inline, UNFAVORABLE + churn), 387e835a (added the param but NOT the logic → semantic-gate addresses:false), 35fa5c3c (verbatim REPLACE → feature_compose:rejected). Root: `model=auto→haiku` on a multi-condition edit (the log's own warning: "auto→haiku hollow-lands hard edits"). This is the compose-reliability frontier, not an fc-coverage block. DEV requires either a stronger drafter on this dispatch or a SUPERVISED conscious bypass (land the above, run this test, run the failure-mode harness for hollow-rate regression, commit+push so pull-sync doesn't clobber, restart goal-host after checking nothing mid-flight). NOT to be done unsupervised under hook pressure — the reach core has a documented 25/48→18/48 regression from a hasty change here.

## ⚠ CORRECTED DIAGNOSIS (2026-08-27, after deploying + live-validating the fix above — it was INERT)

The fix above was deployed to the running goal-host (verified live: signature at index.ts:239-ish,
call-site at 4212, health 200) and **validated live — it did NOTHING.** Registry-count still
reached (non-breaking), but the `distinct-file-extensions` reuse goals still abstained 0/N. The
live logs revealed the ACTUAL mechanism, which is different from what the fix targeted:

- The recipe **is consumed and DOES produce the correct answer**: `[verifier-recipe] goal answered
  FROM the recipe — verifying with two fresh derivations instead (no self-confirmation)` (index.ts
  ~4166-4168, 4548-4556). The recipe command runs, its measurement seeds the walk, and
  `answeredFromRecipe.add(goalHash)` is set.
- BECAUSE the recipe already answered, `_recipeAnswered = true` → `_useRecipe = FALSE`. So the
  `[a,b] = _useRecipe ? [deriveFromRecipe(), derive] : [derive, derive]` branch takes **[derive,
  derive] — TWO FRESH derivations** (deliberately, to avoid self-confirmation), NOT recipe+fresh.
- The two fresh derivations must agree with EACH OTHER. When one fails to produce (the common
  case), `reconcileDerivations` abstains and the **correct recipe answer is discarded**.

So the fix above (which passes `recipeRescue` only when `_useRecipe`) is in the WRONG branch — its
precondition is never met for these goals. It is INERT. **Do NOT apply the above as-is.**

## The CORRECT fix (verification layer — delicate, self-confirmation-sensitive; deploy deliberately, NOT under pressure)

The `_recipeAnswered` path currently verifies with two-fresh-agree, which VIOLATES the stated design
intent ("a recipe is used as ONE OF THE TWO DERIVATIONS, checked against ONE fresh"). The correct
fix implements that intent for the already-answered case: **thread the recipe's numeric answer R
(the `measured` value at ~4553) into the verification, and accept the reach when at least one fresh
derivation EQUALS R and the recipe is strongly proven (agreed>=10, agreed>disagreed*4)** — even if
the other fresh derivation fails. This is recipe + one independent confirmation, NOT recipe-alone
(forbidden) and NOT single-unchecked-fresh (the naive/unsafe version — my inert fix would have been
UNSAFE if moved here, since it accepts side `a`'s value without comparing to R).

Constraints: never accept on DISAGREEMENT (a fresh value ≠ R with the other absent still abstains —
it may be the recipe that's wrong on a new tree; demote-on-disagree must still fire); never accept
degenerate R (<=0). This touches the exact code with the documented 25/48→18/48 regression, so it
requires: unit test of the R-vs-fresh logic, live reuse-batch validation, registry regression check,
and a hollow-rate gate — deliberately, not a hook-clearing deploy.

## ⚠⚠ FINAL CORRECTED FIX (2026-08-27, advisor-reviewed) — relaxation + retry, NO rescue

The rescue clause (both prior versions above) is UNSOUND and must NOT ship. In the `_recipeAnswered`
path the recipe already seeded the walk's answer, so accepting it alone when the fresh partner
fails is FULL self-confirmation on that use — the exact bright line verifier-recipe.ts draws ("a
recipe is never an oracle... worse here because this arm decides what counts as TRUE"). Worse, the
failure is uncatchable: a proven-but-wrong recipe on a new tree seeds W, side a re-derives W, b
fails, rescue certifies W, and because b FAILED (not disagreed) `disagreed` never increments — the
demote-on-disagree net has a hole exactly where the rescue operates. And `{truth:a}` returns
indistinguishably, so the donation block (~4251, "gated on TWO AGREEING derivations") would donate
off a rescue and α banks normally. **Delete the rescue.**

The CORRECT change set (minimal, implements the file's own documented intent, precondition
log-verified this session):

1. **One-line `_useRecipe` relaxation** (index.ts ~4167): engage the recipe as side `a` even when
   `_recipeAnswered`, IF the recipe is strongly proven:
   `const _useRecipe = !!(_recipe && _tree && recipeIsLive(_recipe) && recipeAppliesTo(_recipe, _family!, _tree)) && (!_recipeAnswered || (_recipe.agreed >= 10 && _recipe.agreed > _recipe.disagreed * 4));`
   Then side `a` = `deriveFromRecipe()` (re-runs the recipe command → R), side `b` = ONE fresh —
   exactly "recipe + one independent fresh confirmation." No Set→Map threading needed; this
   SUPERSEDES the threading idea. It also STRENGTHENS safety: a contradicting `b` now increments
   `disagreed` (the current two-fresh path never demotes).
2. **Retry-once on the fresh side** when it produces null (before reconciling). Observed: every
   fresh derivation that LANDED produced the correct value (1,3,13,17); the failure mode is
   failure-to-produce, not wrongness. Retry converts most `b`-fails into `b`-lands with ZERO trust
   relaxation — no self-confirmation question arises. (Relaxation lowers the joint-success exponent
   p²→p; retry raises p.)
3. **NO rescue clause.**

Validation (with the STOPPING RULE: any unexpected result → revert + stage, a third reach-core
misfire is worse than honest non-demonstration): registry regression reaches; reuse batch reaches;
`agreed` increments on a `b`-agrees reach; NOTHING increments on abstains. Precondition check FIRST:
confirm the `_useRecipe` branch actually fires (the process failure that caused the two prior botches
was shipping ahead of precondition verification).

Scope when it lands: consistent grounding for proven families WITH per-use independent confirmation
intact — honestly claimable, stronger than the rescue version. Still NOT new-family minting.

## ⚠⚠⚠ OPTION A DEPLOYED + LIVE-VALIDATED (2026-08-27): fixes layer 1, reveals layer 2

Option A (retry-once on the fresh derivations, invariant untouched) was deployed to the running
goal-host and validated live — **precondition-verified this time** (`[recompute] second fresh
derivation produced no measurement — retrying once (attempt 2)` DID fire). Results:
- **Layer 1 (recompute) FIXED:** the `only one derivation` abstention count went to **0**. The
  recompute now establishes the CORRECT truth via retry (`measured 3` for activity-api, `measured 1`
  for discovery — both right). Non-breaking: registry-count still reached 2×.
- **Layer 2 REVEALED — the reach still abstains:** `[recompute] measured 3 but the walk emitted no
  measurable value — abstaining` (×2). The reach grades the WALK'S OWN emitted answer against the
  recompute truth. For distinct-ext the walk routed to webSearch/LLM and emitted **no numeric
  answer**, so there is nothing to grade against truth=3. (Contrast registry-count: its walk emits
  `stdout:"385"` — a clean number — because a hardcoded rule builds the shell command as the ANSWER.)

**So a recipe-family reach needs BOTH: (1) recompute establishes truth [Option A fixes this], AND
(2) the walk emits a gradeable numeric answer [STILL BROKEN — the routing layer].** Recipe families
lack a rule that makes the walk answer with a shell measurement, so they route to non-numeric
outputs. Option A alone is a genuine, verified, non-breaking improvement but does NOT yield a reach.

**Reverted** to clean state (pull-sync must not stay paused; Option A alone doesn't demonstrate
component 2). The COMPLETE fix for component (2) via recipes is at least two coordinated changes:
Option A (recompute retry — verified) + a routing/answer change so recipe-answered countable goals
emit the recipe's measurement AS the walk's gradeable answer (like registry-count's hardcoded path).
That is deeper multi-layer reach-core work, deliberate, not a single deploy.

## ⚠⚠⚠⚠ LAYER-2 REFINED BY STATIC READ (2026-08-27, read-only, no deploy) — the answer-emission path ALREADY EXISTS

Reading the floor (`index.ts` 4545–4561) before assuming layer 2 is a missing feature — and it is
NOT. The recipe-answer path already threads the measurement into the walk:

- `recipeCommandFor(goal)` runs the recipe command, parses `measured`, sets
  `answeredFromRecipe.add(goalHashOf(goal))`, and **seeds the floor LLM prompt** with
  `recipeSeed`: *"A VERIFIED MEASUREMENT for this class of goal has already been run for you:
  command … output … Treat its output as the measured value and build your answer on it."*
- So the intended layer-2 mechanism — get the recipe's number INTO the walk's emitted answer so
  `verifyGoalReached`/recompute have something to grade — is **implemented**. The floor is told the
  measurement as an observation to ground on (not repeat), preserving grounding discipline.

Therefore layer 2 is NOT "add a rule that emits the recipe measurement as the answer" (that would
DUPLICATE 4545, violating reuse-before-mint). The real defect is one layer earlier: for
`distinct-file-extensions`/`subdirectory-count` the **forward walk goes HOLLOW on a webSearch/LLM
producer and never reaches the seeded floor at 4545** (live: `HOLLOW — no-oracle-for-goal-class,
completion_shapes=[]`). The number is available to seed; the seeded floor is just not the path taken.

**Consequence for the deploy plan:** there is NO bounded, verified reach-core edit ready to stage.
The remaining work is forward-routing diagnosis (does 4545 run for these goals? which producer does
the walk pick, and why does it not resolve `shellResult`?) — the documented `shellResult`-monoculture
frontier (`index.ts` 5101–5103), explicitly a **separate proposal** (see non-goals below). It needs a
live dispatch + trace to pin, not a code edit authored blind. Staging a deploy script now would
repeat the precondition-ahead-of-verification failure that produced the two prior botches. **Held.**

## ✅✅ OPTION A LANDED LIVE + VALIDATED (2026-08-27, authorized operator bypass)

Option A (retry-once on a null fresh derivation) was applied to the real git source
(`repos/goal-host-vessel/src/index.ts`, 3 isolated edits, `tsc --noEmit` clean), deployed to the
running goal-host via the phase-1 validation script (pull-sync paused, parse-gated, health 200,
nrestarts:0), and **validated live**:

- **Retry fires:** `[recompute] second/first fresh derivation produced no measurement — retrying
  once (attempt 2)` — confirmed repeatedly.
- **Layer 1 FIXED:** the retry converts the dominant "only one derivation produced a usable
  measurement" abstention into two agreeing derivations. Live: `[recompute] DONATED verified command
  for this goal class (truth=1, two agreeing derivations)` on the obsidian-vessel goal — the
  recompute now establishes truth via retry.
- **Grounded reaches occur:** obsidian-vessel (exec_g6vt9sc9) and discovery-vessel (exec_tnfcjare)
  both `reached:true` via `deterministic:independent-recompute-agrees` (two fresh derivations agree
  on the correct value; keyed durable traces). Non-breaking: the hardcoded registry-count family
  still reached (`385, REACHED via 1-step chain`) during the same window.

## ⛔ SHADOW HYPOTHESIS FALSIFIED — Layer 2 is real, independent, and now precisely located

The earlier hypothesis (layer 2 is merely the shadow of layer 1 — the suppressed-retry walk being
graded) is **wrong**. Live proof: with truth established via Option A's retry (truth=1), the
recipe-satisfier path STILL abstains — `[recompute] measured 1 but the walk emitted no measurable
value — abstaining` — and only THEN cascades to the webSearch retry.

Root cause, pinned at the consuming layer: the recipe VESSEL-RESOLVE SATISFIER lands the shellResult
in the walk pool/digest as a **lazy pointer**, not the resolved value:
`REACH-CONTENT shellResult (109 chars) = {"producedBy":"activity:⟨…⟩","executionId":"exec_…"}`.
`extractEmittedNumbers` (independent-recompute.ts:161) scans the digest text for a number and finds
none inside the pointer JSON — so a CORRECT answer is structurally ungradeable on attempt 1. The
reach only lands later (attempt ~9) when the widened webSearch/finalText digest happens to carry the
count in prose. This is why every grounded reach costs a 9-attempt cascade.

**Layer-2 fix (SPEC ONLY — deliberate, next session, NOT stacked on the unlanded Option A):**
before grading, resolve the shellResult pointer (`{producedBy, executionId}`) to its stdout value and
inject it into the graded digest (e.g. `- shellResult: <stdout>`), OR have the recipe satisfier place
the resolved stdout — not the pointer — into the pool entry the digest is built from. Expected effect:
grounded reach on attempt 1 instead of attempt 9. Constraints unchanged (two independent derivations
must still agree; no self-confirmation; degenerate guards intact).

## ⚠ Credit misattribution (FLAG, not fix) — the strongest argument for the layer-2 fix

Because the reach only lands after the 9-attempt cascade, the alpha credit goes to the cascade's LAST
pick — an UNRELATED template: obsidian credited `proposed_pattern_authored_backfill_http_response`,
discovery credited `…http_relevance_backfill_v2`, for FILE-COUNT reaches. The reach verdict is honest
(grounded recompute agreement), but the pathway learning is polluted: the wrong producer's posterior
climbs. An attempt-1 reach (post layer-2) would credit the actual recipe/shellResult producer. Belongs
in the honest framing; does not block the Option A land.

## ✅✅✅ DURABLE LAND CONFIRMED (2026-08-27)

Option A committed `26f4ecb` and pushed to origin/dev (rebased cleanly onto the autonomous
`a803852`; merged `tsc --noEmit` clean). pull-sync converged the container at 08:57:36 (clone HEAD
`26f4ecb`, `/vessels` `deriveRetry:1`, health-gated restart to a new MainPID — no pre-cutover false
block). Re-validated on the DURABLE code (not the hot-patch): analysis-vessel goal → `[recompute]
DONATED verified command (truth=1, two agreeing derivations)` — layer 1 fixed and durable. Layer 2
abstention (`measured 1 but the walk emitted no measurable value`) persists exactly as diagnosed,
confirming it is the independent next change.

DURABILITY (the gap-triple's third axis): the code survived a full pull-sync cutover cycle and is the
committed origin/dev version now running — not a self-reverting hot-patch. The autonomous `a803852`
rescue rode along INERT (call site unwired); recorded as a latent-landmine finding, not hand-deleted.

## LAYER-2 FIX DESIGN (precondition-read complete; ONE runtime precondition still UNVERIFIED — do not author blind)

Located at the consumer (advisor conditions met: consumer-side, fails open, reconcileDerivations
call-site arity untouched). Mechanism, pinned by reading the code:
- `addToPool` (index.ts:9507) stores a produced shape as a STUB `{producedBy, executionId}` — the pool
  impulse's `content` IS the stub, not the value.
- `poolDigest` (9635–9643) renders `- ${shape}: ${JSON(imp.content)}` → for a shellResult that is the
  stub → no number → `extractEmittedNumbers` empty → the layer-2 abstention.
- `capturedDigest` (9625) folds in only the LAST step's captured content; the recipe shellResult is an
  EARLY satisfier step, so it is not covered.
- `reachContentDigests` (12712, populated by `captureReachDigest` at emit-time, 12714) snapshots real
  produced content keyed by executionId, in `- shape: content` form — the resolution source to REUSE.

**Fix:** in the poolDigest `.map`, if `imp.content` is an object carrying an `executionId`, substitute
`reachContentDigests.get(executionId)` when present (already correctly formatted); else fall back to the
stub. ~6 lines, no new machinery (law 3), fails open to today's behavior.

**⚠ UNVERIFIED PRECONDITION (the thing that would make it INERT — verify FIRST, do not skip):** does the
recipe VESSEL-RESOLVE SATISFIER path emit `lifecycle:execution:succeeded` with the shellResult's stdout,
so `reachContentDigests.get(stub.executionId)` is actually POPULATED? The live abstention proves the
graded digest lacks the number, but that is consistent with BOTH "populated-but-not-consulted" (fix
works) AND "empty-for-this-path" (fix inert). Distinguish with a temporary diagnostic log at the
poolDigest site (deploy via the phase-1 container-validation pattern, observe on one recipe dispatch)
BEFORE landing the real edit. This is the precise precondition-ahead-of-deploy check whose absence caused
the two prior botches this session. Expected post-fix observables (advisor): recipe-family reach on
ATTEMPT 1 with no suppress/webSearch cascade, and alpha crediting the shellResult satisfier — not a
`…backfill` template (the credit-misattribution fix demonstrating itself).

## Layer-2 static trace (2026-08-27, read-only) — diagnosis airtight, fix-source needs a runtime check

Traced the satisfier: `addToPool(satisfiableNow, resolved.content, …)` (index.ts:8752) pools
`resolved.content`, which for this path is the POINTER `{producedBy, executionId}` (matches the
REACH-CONTENT log). The adjacent comment (8759–8760) asserts "the reach-gate's content digest already
folds this shape's content" — **empirically FALSE for pointer-valued content**: the digest folds the
pointer, not the resolved value, which is precisely the layer-2 abstention. The satisfier synthesizes an
IN-MEMORY trace (5551/5564), so whether `reachContentDigests` (populated only by real
`lifecycle:execution:succeeded` events) holds the pointer's executionId is a RUNTIME fact static reading
cannot settle. Therefore the layer-2 fix genuinely requires a diagnostic-deploy precondition check
first (does `reachContentDigests.get(stub.executionId)` return the stdout?) — then either the ~6-line
poolDigest stub-resolution lands, or, if the source is empty, the fix moves to resolving the pointer at
the satisfier-pool site (8752) via the same resolver the REACH-CONTENT logger uses. Deliberate next
cycle; not churned tonight.

## ⛔ LAYER-2 FIX ATTEMPT — INERT, reverted (2026-08-27; live-test refuted it before any durable land)

Two attempts, both caught by the live-test (the discipline held — nothing inert was landed durably):
1. **Dispatched as a goal first** (dispatch-don't-edit): feature_compose returned `verdict=UNFAVORABLE` →
   HOLLOW (edit-intent-no-landed-edit). The substrate DECLINED to self-author this reach-core edit — the
   compose-reliability / KEYSTONE frontier (auto→haiku on multi-condition reach-core edits).
2. **Authored supervised** (the ~6-line poolDigest stub-resolution via reachContentDigests, tsc clean,
   deployed reversibly). Live-tested on local-tools-vessel: the recompute established `truth=1` (Option A
   working) but STILL abstained `measured 1 but the walk emitted no measurable value` → cascade. INERT.

Root cause of inertness (confirmed in the right data path — `dig` ← `contentDigest` ← the edited
`poolDigest`, so location was correct): `reachContentDigests.get(stub.executionId)` did not yield the
count. The stub's executionId points at a `learned-composition-…-to-shellresult` whose OWN shellResult
output is itself a pointer/stub, OR was not captured — i.e. a POINTER CHAIN, not a single hop. Resolving
one level is insufficient. The real fix must follow the pointer to the terminal stdout (or resolve the
impulse via the store at the satisfier-pool site, 8752) — and that needs a runtime diagnostic to see what
`reachContentDigests` and the composition output actually contain, since static reading cannot.

NET after this session: layer 1 (Option A) durably landed + verified; layer 2 diagnosed one level deeper
(pointer chain) but NOT fixed — reverted to 26f4ecb. The honest loop (dispatch → live-test → refute →
revert) worked exactly as intended; no inert reach-core code was left behind.

## ✅✅✅✅ LAYER 2 CLOSED — runtime diagnostic found the REAL bug; fix landed durable `f91f8f2` (2026-08-27)

The runtime diagnostic (added at the poolDigest site, then at the recompute grade site) REFUTED both
prior hypotheses and found the actual bug:
- `reachContentDigests.size=0` on this path — the pointer-resolution fix was doomed; there was nothing
  to resolve.
- The shellResult content was NOT a pointer — it was the full result object with `stdout:"1\n"` present.
  The count was never missing. But the poolDigest rendered the WHOLE object, and because `stderr` echoes
  the entire `find … | wc -l` command, the `- shellResult: {…}` line exceeded the 160-char guard in
  `extractEmittedNumbers` — so the line (count and all) was discarded → "measured N but no measurable value".

**Fix (`f91f8f2`, ~6 lines, fail-open):** in the poolDigest map, when an impulse's content is an
executable-result object with a string `stdout`, render the stdout itself, short, instead of the JSON.

**Verified live at the exact consuming layer** (recompute-grade diagnostic): `truth=1 emitted=[1]
digest="- dispatch_id: …\n- shellResult: 1"` → agree → reach via `deterministic:independent-recompute-agrees`,
and `goal_status` shows `reached:true selectedTemplateId=satisfier:shellResult` — a CLEAN single-attempt
reach credited to the CORRECT producer (no webSearch cascade, no `…backfill` misattribution). The
credit-misattribution flagged earlier is cured as a side effect (attempt-1 reaches credit the shellResult
satisfier).

**Both layers of the verifier-recipe grounding chain now closed:** layer 1 = retry-once `26f4ecb`,
layer 2 = stdout-render `f91f8f2`. Method note: three wrong turns this session (rescue, pointer-resolve,
reachContentDigests) were each caught by verifying at the consuming layer — the render bug was invisible
to static reading and only the runtime diagnostic exposed it. ⚠ Orthogonal transient observed: the LLM
completion dispatch (`routedComplete not ok`) is intermittently unavailable, which fails the recompute at
layer 1 (authoring) regardless of these fixes — Option A's retry mitigates but cannot fully cover an
LLM-down window.

## Non-goals

- Not trusting a single fresh derivation (the self-confirmation the design forbids).
- Not disabling demote-on-disagree.
- Not touching the mint site or the degenerate-truth guards.
- Not the routing fix (countable goals misrouting to webSearch/LLM) — separate proposal.
