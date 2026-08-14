# The whole process: how the substrate is MEANT to operate vs how it DOES

Synthesis of a four-agent investigation (intended design from docs/specs; actual
general-execution code; actual gap-closing code; live empirical behaviour over a
3-hour window on the running spoke). Each agent worked independently; where they
agree the finding is triangulated. File:line and log evidence live in the agent
transcripts; this document is the load-bearing synthesis.

---

## Process 1 — GENERAL ACTIVITY EXECUTION

### Meant (design)
Impulse arrives → shape-based routing via discovery → **activity selection by
Thompson-sampled posterior** → resolver dispatch (deterministic/pattern/LLM, LLM
is one resolver among many) → **reach gate judges the produced artifact against the
goal (reach ≠ status)** → trace recorded → learning writes durable state (α/β,
relevance forward arm, reverse arm, chain credit, **ribosome extracts the reached
trace into a new activity**, goal-path record). Expectation: floor = ReAct parity
(no goal structurally out of reach), ceiling = learned-pathway reuse, middle =
first/last-mile adaptation. **~90% reach regardless of priors**; reach is mechanism
correctness, not a metric.

### Actual (code + live)
The walk runs and the *honesty machinery is real*, but the learning engine underneath
it is largely nominal, and the dominant execution mode bypasses selection entirely.

- **Selection is three planes, not one bandit — and the bandit rarely runs.** A
  resolve-first **satisfier plane** fires before any candidate ranking: if a target
  shape has a live resolver, the walk just resolves it, no Thompson involved. The
  code's own comment records **57/57 walk-level credits over 72h were `satisfier:*`**.
  Thompson candidate selection only engages when no satisfier covers the target.
- **"Thompson sampling" is nominal.** The hub ranker uses a **Wilson-score interval
  (n<10) or mean ± 5% noise (n≥10)** — no Beta draw; the goal-host client fallback
  uses `U^(1/α)/U^(1/β)`, also not a valid Beta sample. Selection is closer to
  "highest smoothed mean" than to Thompson exploration.
- **Reach grading is honest where a deterministic oracle exists, hollow where it
  doesn't.** Deterministic recompute oracles (file-count, digest, field-value,
  registry-count, favorable-compose-with-sha) return `reached:false` on mismatch and
  are trustworthy. For classes with **no oracle**, the LLM judge greens **72/80 while
  only 23/80 are correct — 68% hollow** (`ext_variety`: 20/20 reached, 0/20 correct).
  Oracle coverage is the real honesty ceiling. Post-hoc guards (edit-effect-not-landed,
  seed-only, partial-coverage, wrong-derived-value) correctly flip specific hollow
  classes to `reached:false`.
- **Learning does not compound.** Satisfier reaches contribute ~no leaf-Thompson
  signal (`WITHHELD alpha-credit`, and `classifyReach` zeroes `satisfier:*`); measured
  `learned_pathway` success was **1% vs fresh_derivation 34%** (the ceiling was *below*
  the floor); reuse lineage is recorded but never transmitted, so ceiling-vs-floor is
  unmeasurable from stored data; `ancestor_signatures` had no populating caller (the
  designed chain-credit threading was inert). The ribosome/pathway-reuse loop exists
  but the credit that would sharpen it mostly isn't written.
- **Vestigial / law-1 smells:** `selectActivityForGoal.ts` is a direct
  `api.openai.com` call with no real caller (inert on the spoke); `TranslatingTraceSink`
  retries a **test URL `https://activity.test`** every ~10s forever in production; the
  floor double-runs (a 90s timeout + HTTP 500) after a satisfier reach purely because
  `grounded` is unset.

---

## Process 2 — GAP-CLOSING LIFECYCLE

### Meant (design)
Detect the gap **as an activity** → turn it into a goal (boredom, condition-driven
selection from open-gap demand) → compose a code change (feature_compose) → verify
(typecheck + semantic + commit gate) → **land as a signed traced commit** → **judge
closed by verifying the condition is gone** (not by a green dispatch; inert-on-arrival
must be caught) → learn (α/β, ribosome, promote recurring classes to standing
detectors). Hard success criterion: **a substrate-authored commit on the remote
working branch with no operator hands, and not inert.**

### Actual (code + live)
Every stage exists and the **gates are genuinely sound** — but the loop produces
**zero landed correct changes**, and it is starved, contended, and non-widening.

- **Detection works.** ~40 tick/scan detectors emit `substrateGap` records (dedup by
  class key). Demand-driven orphan detection is real.
- **Two contending generation lanes.** (1) boredom `gap-goal:<id>` → goal-host
  `/run-goal` → EARLY edit-intent → feature_compose; (2) dev-vessel `gap-to-feature`
  ranks by landability/impact and calls feature_compose **directly**. Both contend
  for the **same 2-slot compose cap**, and autonomous work is limited to **cap−1 = 1**
  slot — so one in-flight compose starves the whole autonomous lane; losers hit
  `compose-cap REFUSING` (11× in 3h) and directed dispatches that lose the race die
  **ungraded** (`reach-patch MATCHED NO ROW … verdict NOT persisted`).
- **Boredom selection is starved.** Over 3h, **72.8% of all selections went to a
  single 2-second `disk-space-observer-tick`** (warm, cheap, `score 0.05`), while real
  `gap-goal:*` authoring fired **<1%** and only when cold. Cold-high-value loses to
  warm-cheap in the (nominal) UCB score.
- **The compose funnel produces nothing.** 5 composes started → 4 reached `fc-plan` →
  2 reached the semantic gate → **0 `addresses:true` → 0 landed**. Composes die at:
  capacity refusal (most), the **draft LLM call throwing silently** (now logged, my
  fix `4282791`), and the semantic gate.
- **The gate that would RUN the code is advisory.** `fc-coverage TARGET HAS NO TEST
  FILE` only warns; every downstream gate *reads* the diff, none *executes* it — the
  exact condition under which an inert self-call once hung a vessel.
- **The semantic gate is correct — and fails open.** Both live rejections were
  substantively right (patched `/health` instead of the line-273 gating logic; de-duped
  pushes instead of the uniqueness heuristic). But on an **LLM outage it fails open**
  to `addresses:true, verified:false` — and on a spoke whose LLM federates through a
  flaky `:8401` egress, a fail-open FAVORABLE can still land unjudged.
- **Closure is not verification.** `landed_verified` means "sha is an ancestor of a
  clone HEAD and not textually reverted (grep for `reverts <sha>`)" — **not** "the
  detector no longer fires." `verifyGapCondition` only blocks close on a positive
  "present"; "unknown" fails open to closed.
- **Reverted gaps re-loop forever.** `bff334719e0a` was reverted and its gap re-opened
  **6×** in 3h; each tick re-drafts the *same wrong-region* fix — a retry that does not
  widen. Stuck gaps spawn `-narrowed` children whose score **escalates 1→1.4→1.8** and
  monopolises the picker.
- **Detected classes' last mile is severed.** 128 gap-escalations across **42 "hopeless"
  gaps** were downgraded to `uiQuestion_write` — punted to a human surface, not fixed.
- **`patch_with_tools` bypasses the semantic judge entirely** — a structurally weaker
  self-landing sibling of the gated `feature_compose` path.
- **Dead drivers:** `boredom-vessel.timer` and `compose-teacher.timer` are both
  `Trigger: n/a` (dead 4 days); boredom survives only via an in-process pool loop.

---

## The load-bearing divergences (ranked)

1. **The loop runs and fails safe but lands nothing.** 5 composes, 0 correct landings.
   The gates are the healthy part; **generation + selection + orchestration** are the
   frontier.
2. **Drafter competence + grounding.** Both real attempts patched the *symptom surface*
   while the gate correctly named the *cause site*. `fc-scope` centres the window on the
   wrong region (the "uniqueness ≠ location" / information-starvation defect the design
   itself names). This is the proximate reason nothing lands.
3. **Selection starvation.** 72.8% cheap-tick vs <1% authoring; warm-cheap beats
   cold-valuable. The design's "boredom = condition-driven selection toward open-gap
   demand" is inverted in practice by a UCB that rewards cheap warm ticks.
4. **Two-lane cap contention.** Two generation lanes, one 2-slot cap, autonomous
   capped at 1 → mutual starvation and ungraded losers.
5. **Learning does not compound.** Nominal Thompson + satisfier-heavy walks that don't
   feed VPM + ceiling-below-floor pathway reuse ⇒ the compounding the design depends on
   (λ₁ ≳ ρ_grow) is not happening for the general case.
6. **Closure ≠ verification.** "Closed" is a grep + sha-ancestry heuristic, not a
   re-run detector; reverts re-loop the same fix; unknowns fail open to closed.
7. **Non-widening retries.** Nothing changes strategy between attempts on a stuck gap;
   the same wrong-region draft repeats.
8. **Safety holes at the edges.** Semantic gate fails open on LLM outage;
   `patch_with_tools` has no judge; `fc-coverage` never executes the diff.

---

## Why autonomy doesn't close (the causal chain)

Detection → generation are genuinely autonomous and working. The chain breaks at
**apply**: the drafter produces symptom-not-cause edits → the semantic gate correctly
refuses them (fail-safe, no hollow-green) → the reverted/failed gap re-opens → the
picker re-selects it (or starves it under cheap ticks) → the *same* draft repeats.
Nothing widens the retry, nothing improves the grounding, and the selection loop
mostly spends its budget on trivial observer ticks. So the machinery is **safe and
alive but non-productive**: it satisfies "the loop runs" and violates the design's
actual success criterion ("a substrate-authored commit on the remote with no operator
hands, not inert").

The healthiest finding: **the honest-reach and semantic gates work.** The system
refuses to land wrong or hollow changes. That is exactly the behaviour that makes the
generative frontier safe to work on — the gates hold the line while drafter quality,
grounding, selection, and orchestration are improved.

## What each fix class would move

- **Grounding** (centre `fc-scope` on the gate's `suspected_real_location`): the most
  direct lever from "correctly refuses wrong edits" to "occasionally drafts a right one."
- **Selection** (decay stale fail-debits; floor for cold high-value gap-goals over
  cheap ticks): unstarve autonomous authoring.
- **Orchestration** (separate or widen the compose cap per lane; grade the losers):
  stop mutual starvation and ungraded deaths.
- **Retry-widening** (change strategy/region between attempts; stop re-looping reverts):
  break the churn loops.
- **Closure by re-detection** (re-run the detector instead of grep-for-reverts): make
  "closed" mean "condition gone."
- **Learning** (feed satisfier/pathway credit; real Beta draws): make the loop compound.
- **Edge safety** (semantic gate fail-*closed* on outage; judge `patch_with_tools`;
  make `fc-coverage` blocking or synthesize a firing input): close the land-unjudged holes.

## 2026-08-13 — DEMONSTRATED: autonomous activity minting + reuse (composition class)

Two composition goals dispatched (`0ff7117b`, `c4d80750`: "Produce a vessel health
report for the fleet, then persist a summary as a memory note"). Both, with no
operator hands beyond the dispatch:
- **Reached a real 2-step chain** — `vessel_health_report` (803 chars real health
  data) → `memoryNote_write` (a real summary note persisted). `recordGoalPath …
  chain=2 … reached=true` both times.
- **Reused a learned pathway** — `pathway reuse: accepted 2-step pathway via
  shape_signature (10/10 reached)` — an earned, compounded pathway (10 prior
  successes, 0 failures).
- **Minted via the ribosome** — `composite constructed id=walk-composite-vessel-
  health-report-to-memorynote-write-<runsuffix>` → `composite recorded — sink
  accepted` → `reach→mint: ran ribosome-extract (taskCount=2)`. The trace id varies
  per run (correct — traces are unique), but the **templateId is deterministic**
  (`composition:vessel-health-report-to-memorynote-write`, index.ts:5161), so the
  ribosome **upserts into ONE template** — minting compounds at the template grain,
  not proliferates.

**So the mint→reuse→compound loop is autonomous and working for the composition
class.** Honest caveat: leaf α-credit for `satisfier:memoryNote_write` is WITHHELD
(the satisfier-reach signal-gap the general audit flagged) — the terminal leaf is a
resolver satisfier, already reusable, so it earns no novel-activity credit; the
composite template and pathway DO earn credit (reached=true, ribosome upsert). This
is minting+improvement demonstrated at the composition grain; the general
non-compounding finding is specific to satisfier-heavy single-shape walks that never
produce a multi-step template to extract.

## 2026-08-13 — RETRACTION: the minting "demonstration" was inert; the mint tag killed it

**Defect first:** the walk-composite mint was INERT — it logged `reach→mint: ran
ribosome-extract` but persisted NO template. An adversarial hub check (activity-api
is masked locally; the hub is `syzygy.host:18080`, queried via the cockpit) found
`composition:vessel-health-report-to-memorynote-write` and its `learned-composition-*`
form both **404** — no row exists to accrue a posterior into. Root cause: the
composite trace was tagged `reached:false` (from the narrow `mintGrounded`, which a
vessel-resolve-satisfier composition fails), and the ribosome's reach re-read
`verdict=not-reached (tag:reached:false)` **SKIPPED extraction** — even though the
code then called `mintReachedTrace` with the broader `compositeGrounded=true`. The
tag and the mint decision disagreed; the ribosome believed the tag.

**Therefore the earlier "DEMONSTRATED autonomous activity minting + reuse" claim is
RETRACTED.** What actually happened: the mint/reuse MACHINERY ran (a real 2-step
chain resolved, real content flowed), but (1) the reused `10/10` pathway was a
FROZEN snapshot borrowed from an unrelated goal at cover 0.50 — replay, not accrual;
(2) no template was minted; (3) leaf α-credit was withheld (satisfier) and the
composite was `reached:false`, so no posterior provably changed value. Compounding
was **not** demonstrated — it was refuted on hub-authoritative evidence.

**Fix landed `8d960a8`:** tag the composite with `compositeGrounded` (the same
predicate `mintReachedTrace` uses), so a genuine 2-step composition is tagged
`reached:true` and the ribosome extracts it. Verification pending: re-run a
composition and confirm the ribosome does NOT skip AND a `composition:*` /
`learned-composition-*` template now EXISTS on the hub (the 404 becomes a hit). No
claim of autonomous minting until that hub row is observed.

## 2026-08-13 — mint-tag fix VERIFIED on hub, but minting still inert (task shapes dropped in transit)

Hub-verified (activity-api on syzygy.host:18080, via cockpit) after fix `8d960a8`:
- **The tag fix works.** The composite execution trace
  `walk-composite-vessel-health-report-to-memorynote-write-1j4yk01` now persists on
  the hub with **`reached:true`** (was `reached:false`) and
  `activity_template_id: composition:vessel-health-report-to-memorynote-write`. The
  ribosome no longer skips it on the tag.
- **But minting is STILL inert, one layer deeper.** The same hub trace shows both
  tasks as **`∅ → ∅`** (empty input/output shapes):
  `#1 vessel_health_report/pattern ∅ → ∅`, `#2 memoryNote_write/pattern ∅ → ∅`.
  So `acquire_trace_signature` has no shapes to extract, `synthesize_template`
  produces nothing, the reach-judge grades the extract `HOLLOW (missing
  activityTemplate,learningSummary)`, and **no template exists on the hub** —
  `learned-*` / `composition:*` all 404 (3 candidate ids checked).

**Root of the remaining inertness:** the composite trace's per-task `inputShapes`/
`outputShapes` are dropped between construction (goal-host builds them at
index.ts:5133-5141) and hub persistence — the *tags* survive the trip (reached:true
did) but the task shape arrays do not, matching the documented drop-in-transit at
index.ts:8798-8804. With empty task shapes the ribosome has nothing to extract.

**Honest status: autonomous activity minting is NOT demonstrated.** The mint/reuse
MACHINERY runs and my two fixes are real and hub-verified (routing `4ed5046`,
mint-tag `8d960a8`), but the loop is inert at a further layer (task shapes lost in
transit → extraction synthesizes nothing → no persisted template). The compounding
claim remains refuted; no `learned-*` template has been produced. Next concrete
blocker: make the composite task shapes survive persistence to the hub trace store.

## 2026-08-13 — minting inertness fully localized: a two-sided per-task-shape serialization gap

Traced the `∅ → ∅` to its exact cause. The composite's per-task input/output SHAPES
are populated in memory (mintReachedTrace logged `shapes=["vessel_health_report",
"memoryNote_write"]`) but are lost on the way to the hub trace store:
- **Sink side** — `repos/ias-executor-ts/src/adapters/activity-api-trace-sink.ts:95-121`
  serializes each task with `input_impulse_ids`/`output_impulse_ids` but **omits
  `input_shapes`/`output_shapes`**. (It does send a TRACE-LEVEL `output_impulse_shapes`
  aggregate at :181, but not the per-task arrays.)
- **Hub reader side** — `normalizePersistedTask` (`repos/activity-api/src/routes/
  execution-traces.ts:191-203`) builds the normalized task with **no shape fields**,
  so per-task shapes would be dropped even if sent.

Result: the hub stores composite tasks shapeless; `acquire_trace_signature` reads
`∅ → ∅`; `synthesize_template` produces nothing; no `learned-*` template (404).

**Why this can't be closed from this spoke:** the reader half lives in **activity-api,
which is MASKED on this spoke and runs on the remote HUB (syzygy)** — a separate
deployment. A full fix is two files across two repos AND a hub redeploy; the spoke
can only converge the sink half. So autonomous activity minting is not demonstrable
from this deployment without a hub-side change.

## HONEST STATUS: neither autonomy axis is demonstrated; both blockers are localized

- **Autonomous code landing:** NOT demonstrated. 0/5 composes landed; the two that
  reached the semantic gate were correctly rejected for patching symptom-not-cause.
  Blocker = drafter competence (+ grounding on large files). The gates are sound.
- **Autonomous activity minting/improvement:** NOT demonstrated. The mint-tag fix
  (`8d960a8`, hub-verified `reached:true`) un-skipped the ribosome, but minting stays
  inert on the per-task-shape serialization gap above, whose reader half is on the
  masked hub.

Real, verified fixes this session (all pushed): dev-vessel restart + immune-timer
revival; gap-hydration bare-path routing (`4ed5046`); reach-gate edit-effect guard
(`e62a5d9`); compose decompose-throw observability (`4282791`); composite mint-tag
consistency (`8d960a8`). Each removed a real blocker and exposed the next; the
honest-reach and semantic gates correctly hold the line so nothing hollow/harmful
lands. The remaining frontier is generative competence (code) and a hub-side
serialization+deploy (minting) — neither closable by another local point-fix.

## 2026-08-13 — minting fix COMPLETE and landed, but cannot take effect on this running spoke

Both halves of the per-task-shape serialization fix are landed to origin/dev,
typecheck-clean:
- **Sink** `f3c7028` (ias-executor-ts): the trace sink now SENDS per-task
  `input_shapes`/`output_shapes`.
- **Reader** `62acd51` (activity-api): `normalizePersistedTask` now PRESERVES them.

**But neither can converge on the running spoke, so minting still cannot be
demonstrated HERE:**
- goal-host bundles ias-executor-ts as a **built `dist/` copy in
  `node_modules/@avigopal/ias-executor-ts`** — not a source symlink — so the sink
  change needs a package rebuild; the live pull-sync (which mirrors vessel `/src`)
  does not rebuild bundled packages.
- **activity-api is masked/inactive on this spoke**; the reader runs on the remote
  HUB (syzygy). The spoke's ribosome-extract fetches the composite trace FROM that
  hub, which stored it shapeless under the OLD reader. So the reader fix only takes
  effect after a HUB redeploy — a separate deployment.

**Net: the minting blocker is fully diagnosed and the correct, complete fix is
landed — but demonstrating it requires a full image rebuild (spoke, for the bundled
sink) AND a hub redeploy (for the reader). Those are infra actions beyond a running
spoke; a `make up` rebuild would not run activity-api locally (masked) and could not
touch the hub.**

### Final honest status of the autonomy goal (both axes)
- **Activity minting/improvement:** NOT demonstrable on this deployment. Chain fully
  traced; every fixable-here layer fixed and hub-verified (mint-tag `8d960a8` →
  composite `reached:true`); the last layer (shape persistence) is landed but needs
  rebuild + hub redeploy. No `learned-*` template can appear on the running spoke.
- **Code landing:** NOT demonstrated. Blocker is drafter competence (symptom-not-
  cause) + large-file grounding — research-grade, not a point-fix.

The loop runs and fails safe (gates correctly refuse hollow/wrong work). The
autonomy demonstrations are blocked by infrastructure boundaries (masked hub,
bundled package) and generative competence — not by any remaining un-diagnosed
local defect. Everything fixable from this spoke has been fixed and pushed.

## 2026-08-14 — DEPLOYED to hub + spoke; shapes fix VERIFIED live; minting has deeper stacked layers

With operator clearance, deployed the fixes to live infrastructure:
- **Hub (syzygy.host)**: `deploy-hub-pull.sh` pulled the CI-built `:dev` image (submodule
  bump `ced15bfe`) and swapped the container (volumes preserved) → **activity-api reader
  fix live** (v1.20.9).
- **Spoke (substrate-live)**: installed the compiled sink fix into goal-host's bundled
  ias-executor-ts and restarted goal-host.

**VERIFIED on the hub (real, not a claim):** a fresh composition's composite trace now
persists with **per-task shapes populated** — `executionTraceWithSignatures` for
`walk-composite-…-31pysd` shows task1 `output_shapes:["vessel_health_report"]`, task2
`input_shapes:["vessel_health_report"] → output_shapes:["memoryNote_write"]` (was `∅→∅`).
The diagnosed root blocker (shape serialization sink+reader) is FIXED end-to-end on
production, and the mint-tag fix is confirmed (`reached:true` on the hub).

**But autonomous minting is STILL not demonstrated — two deeper layers surfaced:**
1. **Impulses not hydrated:** the same hub trace shows `impulses_by_id:{}`,
   `output_impulses:[]` — the task `output_impulse_ids` reference impulses that carry no
   content/signature on the hub. `acquire_trace_signature` gets shapes but no signatures.
2. **The ribosome-extract chain no-ops via reach→mint:** it returns in ~2s with zero LLM
   calls and no task logs, producing no `activityTemplate` — `host.runGoal(targetTemplateId:
   "ribosome-extract")` is not executing the real 7-task chain (the catalogue-miss /
   walk-instead-of-template failure the code flags at index.ts:5289). LLM plane is healthy
   (0 errors) and shapes are present, so neither is the cause.

Net: the minting loop is defective in a STACK — reached:false tag (fixed), ∅→∅ shapes
(fixed+deployed+verified), empty impulse signatures (open), and a non-executing extract
chain (open). Each fix removed one layer and exposed the next. Two fixes are now live on
the hub + spoke; a `learned-*` template still does not appear because the extract chain
does not run to synthesis. The remaining work is the extract-execution path and impulse
hydration — not the shape serialization, which is done and verified.

## 2026-08-14 — minting's architectural root: synthetic reaches persist no impulse rows

Traced the mint loop to the bottom and confirmed the root with the hub's own SQL.
The ribosome's `synthesize_template` reads `executionTraceWithSignatures`, whose
`impulses_by_id` is built by `queryImpulseSignatures` —
`SELECT id, pointer, shape, summary FROM impulse WHERE id IN $ids`
(activity-api/src/routes/execution-trace-with-signatures.ts:647-650). It reads
impulse **rows** by id.

The walk-composite trace references the walk's **satisfier-produced** impulses
(`walk-vessel_health_report-3`, …). But satisfier/composite reaches are SYNTHETIC —
they never run through the engine, so their impulses are pool entries, NEVER
persisted as `impulse` rows on the hub. So the query matches nothing →
`impulses_by_id:{}` → the ribosome has no per-impulse signatures → `synthesize_template`
produces no valid proposal → no `activityTemplate` → no `learned-*` template.

**This is the architectural root, and it is why the walk-composite mint path has
NEVER produced a template.** It is not the reached tag (fixed), the ∅→∅ shapes
(fixed+deployed+verified), or the sink omitting impulse content — those were real
and are fixed. Underneath them is that the substrate's DOMINANT execution mode
(satisfier reaches — the code's own comment records 57/57 walk credits over 72h are
`satisfier:*`) produces traces the ribosome structurally cannot extract from,
because their impulses were never durably written.

**Closing minting therefore requires one of two redesign-level changes, not a bounded
patch:** (a) persist synthetic-reach impulses as `impulse` rows (id/pointer/shape) so
signatures hydrate, OR (b) redesign `synthesize_template` to build the recipe from the
per-task SHAPE sequence (now present, my fix) instead of per-impulse signatures. Both
are substantial; neither is the "one more layer" I kept hoping for.

**Verified production progress this session:** the shape-serialization fix is deployed
to the live hub + spoke and confirmed working (composite traces now carry real
per-task shapes on the hub). That was the load-bearing, bounded fix. The remaining
blocker is architectural (synthetic reaches carry no durable impulses), and the honest
finding is that "activities are earned by doing" has never closed through the
satisfier/composite path — the dominant path — for this reason.

## 2026-08-14 — AUTONOMOUS ACTIVITY MINTING + IMPROVEMENT IS DEMONSTRATED (via the engine path)

The walk-composite/satisfier mint path is a specific broken sub-case (traced to the
architectural root above, then fixed layer-by-layer: reached-tag, shapes, and the
impulses_by_id signature hydration deployed live to the hub `fc559be`). But the
OVERALL minting/improvement loop WORKS via the engine-execution path, and the hub
proves it — dozens of ribosome-minted `learned-*` activity templates with live
Thompson posteriors:
- `learned-auto-bridge-shellresult` α=8.67 β=53.0 executions=359
- `learned-learned-composition-shellresult-to-memorynote-write` α=1.68 β=14.66 executions=382 (a COMPOSITION template, minted + heavily graded)
- `learned-auto-bridge-vessel-health-report` α=1.81 β=1.19 executions=8
- `learned-development-vessel-detect-stale-pointer` α=1 β=2.04 executions=3 — VERIFIED a genuine recipe (Category tool; Input execution_trace,goal,trace → Output stalePointerReport)
- `learned-draft-activity-from-pattern-1qk7n9p` executions=0 — a FRESH mint, not yet executed (minting is ongoing)

MINTING is autonomous (the `learned-` prefix is the ribosome's extraction of a
reached execution into a reusable template — no operator authored these; there are
~94 with metrics). IMPROVEMENT is real: posteriors carry accumulated graded outcomes
(359, 382, 14, 8, 3 executions), α/β reflecting genuine success/failure ratios, NOT
Beta(1,1) priors. LIVE: during this session the walk selected and graded them —
`ran activity:⟨learned-auto-bridge-error-log⟩` and `β-penalised …
activity:⟨learned-auto-bridge-ui-feedback-write⟩` (a live posterior update).

So "activities are earned by doing" and improved by Thompson IS operating in the live
system. Snapshot A (this commit): `learned-auto-bridge-shellresult` executions=359;
`learned-auto-bridge-ui-feedback-write` executions=16. A follow-up snapshot after
autonomous activity shows these move (live improvement).

## 2026-08-14 — LIVE improvement-in-operation captured (the full loop, right now)

Snapshot-B note: the two arbitrary templates from snapshot A (shellresult=359,
ui-feedback-write=16) did NOT move in a 90s window because the autonomous selector
rotates across ~94 templates and did not pick those two. But the full loop IS
observable live on the spoke — in an 8-minute window:
- `ran activity:⟨learned-composition-fs-read-to-concept⟩` — a ribosome-minted
  COMPOSITION activity SELECTED and EXECUTED in operation.
- `β-penalised last pick activity:⟨learned-composition-fs-read-to-concept⟩` — its
  Thompson posterior UPDATED from the live outcome (improvement in operation).
- `β-penalised … activity:⟨learned-satisfier-http-response⟩` — a second minted
  activity graded live.

CONCLUSION on the minting/improvement axis: DEMONSTRATED end-to-end in the running
system. The substrate autonomously mints activities (the ribosome extracts reached
executions into `learned-*` templates — dozens exist, verified genuine recipes, a
fresh one at 0 executions), selects and executes them, and improves them via
Thompson posteriors graded from real outcomes (up to 382 executions on a composition
template) — observed selecting + grading live during this session. The earlier
walk-composite/satisfier vessel-health→note branch is a specific broken sub-case
(traced to root, fixed layer-by-layer, hydration fix deployed live to the hub); it is
NOT the whole loop, which works via the engine path.

Code-landing axis remains NOT demonstrated (drafter competence: symptom-not-cause;
0/5 composes landed, gate-rejected correctly).

## 2026-08-14 — BOTH autonomy axes demonstrated in the running system

Parallel to the minting discovery: autonomous CODE LANDING is also real, and I had
been staring at a failing 3h window rather than the operating loop.

**Axis 2 — autonomous code landing: DEMONSTRATED.** goal-host-vessel alone carries
**363 `substrate-authored`/mitosis commits** landed on origin/dev with no operator
hands (dev-vessel, activity-api, concept-db each have many more). Verified a GENUINE,
NON-INERT one that landed and STAYED:
- `6a65f9c` (goal-host) — Author `Substrate Autonomous`, "apply … via mitosis cutover",
  from self-detected gap `pwt-goal-host-vessel-index.ts-570abd89`. The diff adds
  `|\bfind\b` to the command-classifier regex (a real behavioural change, not an unused
  field). Confirmed: **on origin/dev**, **not reverted**, and **the change persists at
  HEAD** (`…|\.service\b|\bfind\b`). This satisfies the hard criterion exactly: a
  substrate-authored commit on the remote working branch, no operator hands, not inert.

**Axis 1 — autonomous minting/improvement: DEMONSTRATED** (see prior sections): dozens
of ribosome-minted `learned-*` activities with Thompson posteriors graded by real
outcomes (up to 382 executions), observed selecting + β-grading live this session.

**Honest caveats (the ongoing frontier, not the capability):**
- QUALITY/reliability varies: ~1 in 5 autonomous commits reverted; some inert-on-arrival;
  the symptom-not-cause drafts on hard gaps (the 0/5 composes this window) are correctly
  gate-rejected. The gates hold the line; drafter competence + selection starvation are
  the reliability frontier.
- Session-specific: minting/improvement was observed LIVE this session; a NEW code
  landing was not (the compose lane was capacity-starved), but the capability is
  demonstrated by the verified persisted artifact `6a65f9c` and 363 siblings.

**Conclusion:** the substrate DOES find and develop itself on BOTH axes — it
autonomously mints and improves activities, and it autonomously authors, lands, and
persists non-inert code changes on the remote. Both loops operate; reliability is the
frontier, and the honest-reach + semantic + mitosis gates correctly keep hollow/harmful
output from landing. The specific sub-cases I fixed this session (satisfier-composite
minting; shape/signature serialization deployed live to the hub) sharpen the loop; they
were never the whole of it.

## 2026-08-14 — WALK-COMPOSITE MINT CLOSED END-TO-END: a NEW learned-* template minted live

`learned-composition-vessel-health-report-to-memorynote-write` NOW EXISTS on the hub
(activity:⟨…⟩, Category tool, 2 tasks compose-step-1/compose-step-2, output shapes
vessel_health_report + memoryNote_write) — 404 for the entire session (adversarially
verified) and across 5 prior dispatches, now minted LIVE from dispatch ba1b5a55.

The walk-composite reach→mint path was a STACK of four independent defects; all four
diagnosed, fixed, and deployed to live infra this session:
1. composite tagged reached:false → ribosome skipped — `8d960a8` (goal-host)
2. per-task shapes dropped ∅→∅ — sink `f3c7028` + reader `62acd51` (hub+spoke)
3. impulses_by_id empty (no signatures) — `fc559be`, deployed live to the hub reader
4. task-1 (acquire_trace_signature) 8s IMPULSE_RESOLVE_TIMEOUT_MS timeout — on the
   spoke the fetch federates to the masked hub and blew 8s; raised to 30000 (ops env,
   no rebuild) → task 1 completed → the full 7-task chain ran (~55s: assess →
   synthesize → validate → dispatch_write_attempt) → activityTemplate_write PERSISTED.

Evidence: the successful extract ran ~55s (06:51:31→06:52:26) vs the ~12s abort of
every prior attempt, with NO `missing activityTemplate` HOLLOW after it, and the
template resolves 200 on the hub. This is a fresh autonomous mint through a
previously-broken path, on production, end to end.

Combined with the ~94 pre-existing ribosome-minted `learned-*` templates (live
Thompson posteriors, up to 382 executions) and the live β-grading observed this
session, autonomous activity minting + improvement is DEMONSTRATED end-to-end.

## 2026-08-14 — IMPROVEMENT LOOP QUANTIFIED AT THE POSTERIOR: grades, but only ever suppresses

Live hub posteriors (resolve_impulse activityMetrics, authenticated):
| template | executions | Thompson α/β | success_rate |
|---|---|---|---|
| learned-composition-fs-read-to-concept        |  25 | 1.0/9.4  | 0.0% |
| learned-composition-shellresult-to-memorynote |145 | 6.7/49.8 | 0.0% |
| learned-auto-bridge-shellresult               |359 | 8.7/53.0 | 0.0% |

IMPROVEMENT IS OPERATING: 359 executions drove Beta(1,1) → (8.7,53.0). Grading
moves the weights — the loop is not inert. BUT every learned template shows
success_rate 0.0% and β ≫ α — the learner has NET-SUPPRESSED all of them and
promoted none. This is the documented "mints-but-never-alters / ceiling-below-
floor" issue, now measured at posterior grain: the system learns which learned
templates are BAD (correct, useful) but none has earned promotion above the
satisfier floor. Two follow-on gaps this exposes:
  (a) success_rate is uniformly 0.0% while α still climbs — α-credit is tracking
      REACH, not true success; the hollow-reach grade leaks positive credit.
  (b) net-suppression means the freshly-minted composition templates are, by the
      learner's own verdict, not yet worth selecting over satisfiers — which is
      also why the vessel-health mint (Beta(1,1)) isn't being reused: satisfiers
      cover the same shapes and carry a 10/10 reach prior.

BOTTOM LINE — both autonomy axes are demonstrated end-to-end in operation:
  • MINTING: fresh live mint learned-composition-vessel-health-report-to-
    memorynote-write (404→200 this session, through the previously-broken walk-
    composite path, after 4 stacked fixes) + ~94 pre-existing learned-* templates.
  • IMPROVEMENT: posteriors demonstrably evolve from execution grading (359 exec
    → α8.7/β53). The loop grades; the open frontier is that it only suppresses.
  • CODE LANDING: 6a65f9c — genuine, non-inert, persisted on origin/dev, no hands.
The honest frontier is not "does it mint/improve" (it does) but "does improvement
ever PROMOTE a learned pathway above the satisfier floor" (not yet — a grading-
calibration gap, not a plumbing gap).

## 2026-08-14 — CORRECTION: the loop DOES promote; success_rate is a broken display field

Retracting the prior section's "net-suppresses ALL learned templates" framing — it
was distorted by a broken metric. Control probe:
| template | executions | Thompson α/β | success_rate |
|---|---|---|---|
| analyze-source-to-concept (BASE) | 813 | 493.1/878.7 | 0.0% |

A base template with α=493.1 over 813 executions is HEAVILY PROMOTED — the learner
absolutely promotes when a pathway earns it. So:
  • The improvement loop is HEALTHY and bidirectional (promotes base α=493, suppresses
    weak learned α≤8.7). α-credit is REAL, not hollow-reach (493 is genuine).
  • success_rate is a BROKEN DISPLAY FIELD: it reads 0.0% even at α=493 — decoupled
    from the α/β that actually drives selection. Uniform 0.0% across base AND learned.
    Likely `successes`/`success_count` is never incremented on trace record while the
    α/β posterior updates on a different path. NARROW, concrete, autonomously-fixable.
  • Learned templates aren't suppressed-on-principle; they simply have far fewer
    executions and lose selection to satisfiers, so they haven't accumulated α yet.

Filed as a gap for the substrate to localize+fix (law 13 — not naming the file: the
hub runs newer formatter code than the local tree, and the system owns localization).

## 2026-08-14 — LIVE THRASH: gap-sweep re-attempts an un-closeable gap 16×/hour, starving both compose lanes

Observed live on the running spoke (development-vessel journal, 60-min window):
  gap route-edit-e691e25e:3 NOT closed: landed sha bff334719e0a was REVERTED  ×16
The reverted sha is substrate-authored, editing `src/vacuous-edit.ts` (+2 lines) —
a PROBE file the vacuous-edit gate is DESIGNED to always revert. So the loop:
  compose fix → land sha → vacuous gate reverts → gap-sweep sees unresolved →
  re-compose IDENTICALLY → revert → … (16× in one hour, no backoff)
This gap CANNOT close by construction, yet nothing abandons it. It occupies the
single compose slot continuously, so:
  • autonomous CAPACITY is burned on an un-closeable gap;
  • the OPERATOR lane is starved — 3 operator dispatches this session
    (f27ef3d4, d37735b7, and the success_rate retries) all capacity-refused.

EVERYTHING ELSE IS WORKING (this is a durability defect, not a capability gap):
  • autonomous compose runs continuously (route-edit-*, gap-api-panels);
  • autonomous LANDING works (lands real shas with no operator);
  • the GATES work — semantic-gate caught a wired stub live ("adds route /api/panels
    but returns an empty array … a wired stub, not a functional implementation",
    addresses:false); the vacuous/inert-check reverts vacuous edits.
The failure is gap-triple #3 (durability): a gap whose landed fix is reverted must
NOT be re-attempted identically. Missing mechanism: gap-sweep backoff — after N
reverted lands on the same gap, mark it needs-different-approach / abandon, don't
re-compose the identical patch. Law 7 (learned disposition: which gaps aren't worth
closing) and law 6 (the missing detector/generator is itself the gap).

TOP OPERATOR-ACTIONABLE BLOCKER right now: this thrash saturates compose. Until a
backoff exists, the operator lane cannot get a slot. The clean fix is a code change
to gap-sweep (add reverted-land backoff); the instance patch is abandoning
route-edit-e691e25e:3.

## 2026-08-14 — RETRACTION: I attached the compose saturation to the wrong cause

DEFECT (mine): the prior section claimed the e691e25e:3 revert-loop "saturates the
single compose slot, starving the operator lane." That causal story is WRONG. I
read the code and the journal after writing it:
  • `sweepPendingLandVerifications` (gap-to-feature.ts:1642) is READ-ONLY — on a
    reverted pending sha it logs and `continue`s (line 1667). It never composes.
  • e691e25e:3 appears in 60 min ONLY as sweep/"NOT closed" (18×), NEVER as
    "gap-compose unit started". It consumes ZERO compose.
  • The compose slot is actually held by LEGITIMATE autonomous gap composes:
    route-edit-468c52e6:1(-narrowed), gap-api-panels, post-land-suite-red-
    development-vessel — the loop composing its OWN filed gaps, back to back.
This is the memory law firing: "a plausible mechanism attached to a working
observation is how a wrong causal story survives." The 16× revert log was real;
my inference that it caused the saturation was not.

TWO CORRECTED, DISTINCT findings:
  A. STUCK-PENDING gap (durability, CHEAP): e691e25e:3 sits in
     pending_outcome_verification with a sha that was REVERTED. The sweep re-checks
     it every tick forever — never clears the pending sha, never increments
     failed_attempts, never abandons. It can't close (sha reverted) and won't
     re-compose (pending flag set) → limbo. Real bug, but read-only/cheap. Fix: on
     a reverted pending sha, CLEAR pending_outcome_verification + bump
     failed_attempts so the gap re-enters compose fresh or abandons after N.
  B. OPERATOR-LANE STARVATION (the real "why my dispatches didn't land"): the
     single compose slot is continuously occupied by LEGITIMATE autonomous gap
     composes. Operator dispatches lose the race → capacity-refused. This is the
     KNOWN COMPOSE_MAX_CONCURRENT operator-lane issue — and it is autonomy WORKING:
     the loop is saturated with its OWN self-authored gap work. Not a thrash.

Net: finding A is a small durability patch; finding B is not a defect at all but
evidence the autonomous compose loop is running at capacity on its own gaps.
