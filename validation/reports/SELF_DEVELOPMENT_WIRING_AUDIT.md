# Self-development wiring audit — the loop runs but does not close

Companion to `COMPOSITION_WIRING_AUDIT.md` (which covered the goal-walk). Six
subsystems audited for realization-vs-definition, each adversarially verified
(13 agents, 0 errors). This one covers how capability is BORN, EXTRACTED,
CREDITED, GENERATED, GATED, and WATCHED.

## The one insight: producer/consumer key mismatch (write ≠ read)

Across **five of six** subsystems the same shape recurs: **each stage emits its
product into a key, slot, or scope that the stage meant to consume it does not
read.** The artifact is produced — green, checked, measured — but has no
downstream effect. This unifies the session's whole run of findings
(differentiation collapse, inert commits, edgeless graph, ungraded composition,
cached-green health) under one root. The loop runs; it does not close, because
**growth-stage outputs land where the reuse-stage readers do not look.**

**Critical dependency (gates everything below):** the goal-walk floor one-shots
almost everything with `compositionChain:[]`, and BOTH chain-credit propagation
and ribosome extraction are guarded on a non-empty chain. So the credit and
extraction fixes are **inert until the composition-routing joints from the prior
audit are opened.** Order matters.

## Ranked defects (top 6 carry adversarial verdicts; 7–14 flagged, unverified)

1. **[CONFIRMED · mints-islands] Authoring births entry bridges, not interior
   edges.** `author_producer` hardcodes minted bridge `input_shapes=["goal"]` for
   every file/content-consuming resolver (`author-producer.ts:547`, twoTask
   branch). Because `goal` is always in the pool, the walk fires the bridge
   immediately as a first-mile leaf and never lengthens the chain — the graph
   stays edgeless. **This is the root of the edgeless graph.** *Fix:* declare the
   bridge's input as the actual intermediate shape it consumes, not `["goal"]`.
2. **[CONFIRMED · declared-inert] Pathway credit never reaches the posterior
   selection reads.** `ExecutionForChainCredit.ancestor_signatures` is declared
   (`posterior-update.ts:174`) and read (`:621`) but **written by no caller** — the
   construction site (`~1041-1049`) omits it, so the signature-keyed
   `context_thompson_scores` write (`:474`, guarded `signature!=null`) is dead.
   Ancestor credit lands only in global VPM, which the warm-signature selection
   path fully overrides (`activities.ts:6277`). *Fix:* populate
   `ancestor_signatures` from `composition_chain` at the construction site. *Inert
   until STEP 0.*
3. **[CONFIRMED · declared-inert] No gate EXECUTES the changed code.** On any
   module without a test, `TARGET-HAS-NO-TEST-FILE` — the one detector for "nothing
   runs the changed code" — is a `console.warn` advisory, not a refusal
   (`feature-compose.ts:3438`). Every other gate reads diff shape or an LLM prose
   story; only `bun test` runs code and there is none. **Inert commits land
   FAVORABLE + reached:true and train Thompson on false outcomes** — poisoning every
   downstream learning signal. *Fix:* promote it to a verdict-affecting refusal (or
   require synthesizing a firing input) for untested modules.
4. **[PARTIAL · wired-shut] Ribosome mint-path bypasses recursion safety.**
   goal-host passes `templateAuthor:''` into the lifecycle (`index.ts:5268`),
   bypassing the gate that skips ribosome-family authors → learned-of-learned
   nesting up to 7 deep (e.g. 202 executions / 0 successes). *(The original
   "verbatim-clone-per-parent" claim was **REFUTED** — the id is deterministic and
   upserts one template per parent.)* *Fix:* set a real `templateAuthor`; mint only
   from genuine multi-step reaches.
5. **[PARTIAL · mints-islands] Detected classes route to no fix.** Substrate-authored
   detectors emit gaps with a bespoke per-cluster category and the barren summary
   `"Observed N× occurrences of problem class X"` (`detector-coverage-scan.ts:170`),
   which the boredom goal-gate drops — it admits only
   `ACTIONABLE_CATEGORIES={ui_legibility}` or a `/capability|repair/` summary
   (`boredom-vessel goal-generation.ts:247`). The detector recursion works; its
   **last mile is severed.**
6. **[CONFIRMED · proxy-not-reality] /health grades a boolean, not the latency it
   measures.** activity-api `/health` times the SurrealDB probe and records
   `latency_ms` but the verdict is a pure query-success boolean with no threshold
   (`index.ts:171-205`) — which is why it read `healthy` at 16.5s latency and only
   flipped when the query fully timed out. *Fix:* threshold the recorded latency.

**Secondary (UNVERIFIED, flagged for confirmation):** bespoke `composedDeliverable_<slug>`
terminals consumed by nothing (`author-composed-capability.ts:312`); `fileCapabilityGap`
scope-narrows authored producers to a single atomic output (`goal-host:4490`); repair
sig_version=2 read/write grain mismatch; chronic-failure narrowing resets
`failed_attempts` on narrowed children; the gap-triple is computed and written to
`funnel-history.jsonl` but read back only for information; a whole mechanical
extractor route in activity-api (~825 lines) is unused; `light-dispatch-vessel`
/health is unconditional; `push-`/`transport-health-observer` are seeded but on no
timer (declared, never ticked).

## What is genuinely healthy (not an all-dead loop)

1. **Leaf-grain credit is unbroken.** A leaf activity's own signature travels
   trace → `applyOutcomeToPosteriors` → `context_thompson_scores` v1, and selection
   reads it back, overriding the global posterior when warm (n≥5, ≥2 candidates).
   Only the *pathway* grain is broken; the base mechanism is sound.
2. **The teaching channel is live, not an archive.** feature-compose writes
   `compose_lesson` concepts on rejected composes and reads them back by
   failure-class at prompt-build (`composeLessonsBlock → decomposePrompt`) — a real
   read-at-use-time path, satisfying the standing teaching-law concern.
3. **Detector-authoring recursion is real and LLM-free.** detector-coverage tick →
   `build_signature_detector` deterministically authors a `detect-<class>` variant
   and registers it as a boredom target — genuine authoring with no operator in the
   inner loop. Only the last mile (routing the emitted gap to a fix) is broken.
4. **The strongest observers hit reality.** `llm-api-health-observer` POSTs a real
   1-token completion per arm (the fix from earlier this session).
5. **The ribosome's id is deterministic** — one template per parent, no
   near-duplicate spam.

## Minimal reconnections to grow ONE reusable capability end-to-end

- **STEP 0 (dependency — from the prior audit):** the walk must emit non-empty
  composition chains (producers declare real `input_shapes`; inference stops
  flattening to `[shellResult]`; the floor stops one-shotting with
  `compositionChain:[]`). **STEPS for credit and extraction are inert until this.**
- **STEP 1 — author an interior edge:** `author-producer.ts:547` declare
  `input_shapes=[intermediate]` not `["goal"]`; stop `author_composed_capability`
  forcing a bespoke terminal; stop `fileCapabilityGap` single-output narrowing.
- **STEP 2 — stop inert edges poisoning the loop:** promote `TARGET-HAS-NO-TEST-FILE`
  to blocking so a change no gate executes cannot land reached and cannot be
  extracted/credited as a working pathway.
- **STEP 3 — populate `ancestor_signatures`** (posterior-update.ts:~1041) so
  pathway credit reaches the signature-conditioned row selection prefers.
- **STEP 4 — mint from genuine multi-step reaches only**, with a real
  `templateAuthor`, so the ribosome extracts a goal-generic edge, not a clone.

## 2026-08-13 — reliable-reach triage: one step landed, the real blocker localized

Triaged the remaining reliable-reach steps (workflow, 5 agents) for a safely-landable
edit. Outcome:
- **✅ STEP 3 (credit→selection) LANDED `e19997f`.** `ancestor_signatures` had NO
  populating caller (only type decl :174 + read :621), so the signature-conditioned
  chain-credit UPSERT was dead for every composition. Fix: fall back to the ancestor's
  OWN v1 signature from its trace row (batch SELECT extended to `signature,
  signature_version` — exposed on `v_paradigm_execution_traces` by migration 158,
  defined by 145/157). No-regression by construction (null stays null where no sig).
  ⚠ Verification level: code+schema+typecheck+no-regression reasoning ONLY — the
  activity-api test harness HANGS in the spoke (hub-deployed vessel; DB/discovery on
  import), so CI on the canary deploy is the runtime gate, and there is no local live
  demo (spoke masks activity-api).
- **⚠ CORRECTION (2026-08-13, later): the "9/9 islands = growth blocker" over-generalized.**
  There are TWO extraction paths and they were conflated: (1) `author_composed_capability`
  (the `composed-cap-*` GAP-CLOSERS) names output `composedDeliverable_<slug>`
  (`author-composed-capability.ts:311-312`) — bespoke BY DESIGN (the comment: "a distinct
  reuse key so reuse fires only on a TRULY equivalent goal"), an intentional island, not
  a bug. (2) `walk-composite` (the ribosome `reach→mint` extractions of the compositions
  actually demonstrated) sets `outputShapes = producedShapes` (`index.ts:5160`) — the
  REAL shapes (`memoryNote_write` etc.), NOT a slug. So the general composition class
  extracts REAL output shapes and IS reused: observed `pathway reuse: accepted ... (68/68
  reached)`. **The composition growth loop is FUNCTIONAL** (compose → extract-real-shapes
  → pathway reuse), and STEP 3 (`e19997f`) closes its conditioned-posterior credit grain.
  The genuine remaining frontier is NARROWER than "growth is broken": it is specifically
  produce-a-chain composition for NO-resolver intermediates (author-on-demand synthesizes
  from the goal instead of composing an upstream producer). The gap-closer islands are a
  separate, intentionally-bespoke sub-class, not the general blocker.
- **Rejected this turn:** STEP 0 (posed walkEvidence-pass is inert — floor emits no
  `/step N ran/` lines; any effective variant regresses the floor's gap-filed rescue →
  needs a floor-native hollowness predicate = spec); STEP 1b (misdiagnosis — empty-curl
  is already honestly refused at index.ts:6759); STEP 4 (blocking form catastrophic,
  credit-only form false-negative-heavy + partially inert until STEP 3 + dev-vessel
  wants an openspec change first).
- ⚠ **SECURITY:** the step-3 subagent materialized the live Metabob API key
  (`cat /root/.metabob/config.json`) into its output — ROTATE. Credential-derived hub
  reads (the islands audit) corroborate the earlier bespoke-terminal audit; I did not
  use the surfaced key.

## 2026-08-13 — env-gate self-development route landed AND demonstrated end-to-end

The one self-development organ that is self-grounding (no hub dependency) — the
env-gate self-scan — is now **routable and reached**, closing the gap where
self-dev meta-goals returned `inferred_target_shapes:[]` and fell to hollow.

- **Landed `2183da8` (goal-host):** `deterministicEnvGateRoute` helper folded into
  the `empty` const of `inferGoalTargetDecision` (goal-target-inference.ts), so an
  env-gate self-check goal infers `[env_gate_scan]` on BOTH the recall-down early
  return (:211) and the LLM-declines path (:566) — recall-independent, fail-open
  when the shape is absent, guarded against composition-write goals. Offline
  battery 6/6; typecheck clean; converged in-container (grep=2, goal-host restarted).
- **Demonstrated (dispatch `83925ddd`, nonce `sdemo-envgate-v2`):** goal
  *"Identify the capabilities in the substrate that are gated behind environment
  variables and report each with its vessel and file."* →
  - inference `["env_gate_scan"]` conf **0.9** (was `[]`);
  - walk **`reached=true`** (`walk-satisfier-1-…`, reach-patch ok rows=1) with a
    substantive **5349-char `envGateReport`** — real findings:
    `concept-db/src/index.ts:272 DENSE_BACKFILL_ENABLED`,
    `development-vessel/src/resolvers/fs-write.ts:27 WRITE_ALLOWLIST`;
  - the parallel FLOOR arm (`universal-tool-fallback-b1f8c280:1-…`) got the SAME
    target but **`reached=false`** with **`tools=0/0`**.
- **Correction to the floor comparison (do NOT read this as a capability delta):**
  the floor arm made ZERO tool calls because its tool dispatch **timed out**
  (`floor: dispatch TIMEOUT after 29943ms` in the floor window) — a channel fault,
  not "the generic fallback could not reconstruct the report." So the floor arm is
  not a clean ReAct baseline here; the walk's reach stands on its own evidence
  (real `env_gate_scan` output), but the ceiling>floor framing is confounded. **A
  floor run that emits 685 chars with 0 tool calls on a filesystem-scan goal is
  itself a gap** under the execution-expectation contract (what detects a
  zero-tool floor run without an operator?) — filed alongside this.
- **Honest caveat:** this is a 1-step SATISFIER reach (no composition chain;
  `WITHHELD alpha-credit — no in-chain producer-to-consumer edge`), i.e. a direct
  resolution of one real self-analysis activity, not a composed pathway.

## 2026-08-13 — the autonomous self-detection→self-goal chain FIRES but does not REACH

The env-gate demonstration surfaced the real autonomy signal, one step past the
operator-dispatched scan:

- **The generation half WORKS with no operator.** My scan's finding
  (`DENSE_BACKFILL_ENABLED`) was auto-converted into a gap record
  (`gap-hydration: injected record gap-env-gated-dense-backfill-enabled`, 00:22:45)
  and the substrate then **authored a close-goal for it** —
  `goal="Close substrate gap gap-env-gated-dense-backfill-enabled: …"`
  (`381e4220:1`, 00:22:48), inference `[env_gate_scan, concept_write]`. A second,
  wholly-unrelated autonomous close-goal fired the same window
  (`Close substrate gap pull-sync-testgate-baseline-degraded-dev`), confirming the
  `Close substrate gap …` prefix is the gap-compose authoring format, not my text.
  **self-scan → self-filed gap → self-authored goal is real.**
- **The reach half FAILS.** `381e4220:1` walked 6 steps, hit `code_annotation`
  with **no producer** (`no shape-feasible step … missing [code_annotation]`),
  picked `auto-bridge-code_quality`, went **HOLLOW** ("materially incomplete …
  does not close the gap"), `capability-gap REFUSED bespoke shape name`, and the
  floor arm died on a channel fault (`Unable to connect. Is the computer able to
  access the url?`). `reached=false`. This is audit finding #5 (detected classes
  route to no fix) made concrete: the close-goal routes to a code-annotation/
  code-quality target that has NO producer instead of composing the
  `env_gate_scan → concept_write` analysis its own inference named as primary.
- **The remaining confound to full autonomy:** the FIND step was still seeded by
  an operator-dispatched scan. Fully autonomous requires the scan itself on a
  rhythm/boredom tick (the orphaned-capability / detector-coverage tick rotation),
  not an operator dispatch. That, plus routing the close-goal to its named
  `concept_write` terminal instead of the producerless `code_annotation`, are the
  two seams between here and a self-authored self-dev goal that reaches.
- The hub-severed organs (`failure_mode_summary` 404, `trace_*_report` hub-starved)
  remain the deeper next seam.

### The decisive finding: every autonomous close-goal reaches HOLLOWLY (no sha lands)

Checked all substrate-authored `Close substrate gap …` goals that reached in a 3h
window. **Generation is autonomous and real; every reach is hollow.** Two cases,
one mechanism:
- `gap-env-gated-write-allowlist` (`bcef08ae:1`, reached=true, PERSISTED): the walk
  targeted `fs_edit` to close the gap; `fs_edit` returned **HTTP 500
  `path outside workspace root: gap-env-gated-write-allowlist`** — it fed the GAP ID
  as the edit path. The reach gate then credited the upstream `env_gate_scan`
  satisfier (whose REACH-CONTENT is byte-identical to the failed `fs_edit`'s) as
  reaching. `WITHHELD alpha-credit … no landed sha`. **Green, nothing closed —
  and persisted, so it trains Thompson that this pathway closes gaps.**
- `reach-gap-orphaned-capability-scan` (reached=true, UNGRADED): re-ran
  `orphaned_capability_scan` then `shellResult` `echo 40` (the emitted-gap count).
  `WITHHELD alpha-credit … no landed sha`; `reach-patch MATCHED NO ROW … verdict
  NOT persisted`. Re-scan + echo, nothing closed.

**Root:** for a close/edit-shaped goal the reach gate accepts an upstream
ANALYTICAL satisfier (scan/shell) in place of the missing close artifact, and the
honest tell — `WITHHELD alpha-credit … no landed sha` — is logged but does NOT
gate the reach verdict. So the loop's self-reported successes are false, which is
why generation-without-reach reads as "0 real landings" despite green verdicts.
This is the grading mechanism failing to distinguish a real closure from a scan
that re-lists the problem (compounds audit #3, inert commits land favorable).

**Fix locus (next):** a reach-gate predicate — a goal whose primary target is a
write/edit/close artifact (`fs_edit`, `code_*`, a "Close substrate gap …" goal)
does NOT reach on an analytical-satisfier standin; it requires a landed sha (or a
verified closing artifact). The `no landed sha` signal already exists at the
WITHHELD-alpha-credit site; it must become verdict-affecting for close-goals.
Load-bearing reach-gate code — scope and verify before landing.

### LANDED `e62a5d9` — the walk-path variant; honest scope + the bigger blocker it exposed

Landed a finalization guard (goal-host `index.ts`, same family as seed-only /
partial-coverage / wrong-derived-value): when a TARGET shape is an fs-effect shape
(`fs_edit`/`fs_write`/`fileEditResult`/`fileWriteResult`) and the reach is
non-deterministic (no landed sha), flip `reached→false`
(`deterministic:edit-effect-not-landed`). Narrow by design (target-keyed, not any
incidental produced shape; deterministic reaches exempt) so it has zero
genuine-reach false positives — an fs-effect target with no sha did not apply, by
construction. Complements the PRE-EXISTING `edit-intent-no-landed-edit` guard,
which is GOAL-TEXT-keyed (`goalDemandsLandedEdit`) and MISSED the write-allowlist
case (a "Close substrate gap …" goal is symptom-phrased, so the text predicate
returned false while inference gave an `fs_edit` target). Typecheck-clean;
converged into the runtime (goal-host restarted 00:47:22).

**Honest verification scope (do not overclaim):**
- The guard did NOT misfire on the analytical env-gate scan goal (its
  `env_gate_scan` target is not an fs-effect shape) — confirmed, no regression.
- I could NOT force a LIVE firing in the observation window. Two reasons, both
  informative: (a) the PRE-EXISTING satisfier-refusal ("satisfier REFUSED
  filesystem-write shapes … uncreditable without a landed sha") already blocks the
  fs-write-*satisfier* variant upstream of the reach gate; my guard covers only the
  narrower case where a NON-fs-write ANALYTICAL satisfier (e.g. `env_gate_scan`)
  stands in for an fs-effect TARGET — exactly the write-allowlist case, which
  requires specific walk conditions that did not recur; (b) newly-invented-gap
  close-goals route EARLY to feature_compose (the gap-id / repos-path pre-walk
  route), bypassing the walk reach-gate entirely. So the guard is a correct,
  hot-path, proven-hole backstop — but its firing is conditional and was not
  observed live this session. It is NOT dead code (it is evaluated on every
  reached-true verdict), but "proven to fire" is not yet satisfied.

**The bigger blocker this exposed — feature_compose cannot connect.** Every
edit-intent / close-goal that routes to feature_compose fails with **"Unable to
connect. Is the computer able to access the url?"** (observed repeatedly:
`EARLY EDIT-INTENT routing failed`, `EDIT-INTENT feature_compose call failed`). The
floor arm's `dispatch TIMEOUT`/`dispatch ERROR` MAY be the same fault but is NOT
established as such — the earliest floor timeout (00:22:45) predates the dev-vessel
stop (00:33:23), and the floor's dispatch target URL was never identified, so do
not fold it into this cause. This — not
the reach-gate — is the dominant reason autonomous self-development LANDS NOTHING:
the generation half authors the close-goal, but the apply half cannot reach the
compose endpoint, so it falls through to walk satisfiers that (correctly, now)
refuse to fake the edit.

### ROOT CAUSE FOUND + FIXED: development-vessel was DOWN, and the immune system that should have revived it was ALSO down

Traced the connect fault to its source and repaired the whole chain:
- **development-vessel was inactive** — cleanly stopped (SIGTERM, drained, exit 0)
  at 00:33:23 and dead 41 min. It serves `feature_compose` AND the `memoryNote`
  resolver, so its being down explains BOTH the compose connect-fault (no
  autonomous edit can land) and any memory-recall failures. `Restart=on-failure`
  cannot recover a clean stop. **Restarted it** → `status:ok`, discovery-registered,
  memoryNote resolver serving again.
- **Why it stayed down: `self-recovery.timer` (the immune system) had been dead for
  5 days** — `active` but `Trigger: n/a`, last real run 2026-08-08. It re-arms ONLY
  via `OnUnitActiveSec` (relative to the triggered service's last activation), so a
  single broken link leaves it with no next elapse and it never fires again. The
  immune system that detects a downed vessel and reverts/restarts it was itself down
  with nothing watching the watcher (**check the checker**). Triggering the service
  once re-armed it; a manual tick immediately did real work — it found
  **identity-vessel (the auth validator) UNHEALTHY and recovered it via restart**
  (`recovered_by_restart:1`), a second silently-degraded core vessel. **Durable
  fix `b2ff657b`:** added `OnCalendar=*:0/3` to `self-recovery.timer` so the
  watchdog has a wall-clock schedule that cannot deadlock on a missed activation.
- **Net:** the autonomous-apply path is unblocked (feature_compose reachable), the
  memory plane is restored, the auth validator is healthy, and the immune system is
  self-sustaining again. The reach-gate guard `e62a5d9` remains a correct backstop
  for the walk-path hollow-green, but the DOMINANT blocker was operational, not
  algorithmic: **two core vessels were silently degraded because the recovery timer
  had deadlocked.** Filed class gap: nothing detects that the DETECTOR (immune
  timer) has stopped — a `Trigger:n/a` liveness check on the watchdogs themselves.

**Open residuals (unresolved, flagged honestly):**
- **The live timer re-arm may not survive a container restart.** The running fix
  was a manual `self-recovery.service` trigger that re-anchored `OnUnitActiveSec`;
  the durable `OnCalendar` change is in the repo (`b2ff657b`) but the image is baked
  at build, so the running container only gets it on rebuild/redeploy. Until then a
  restart could re-enter the deadlock. Verify after next deploy.
- **A separate stuck retry loop:** `TranslatingTraceSink` retries `exec_test_1` at
  `https://activity.test` (RFC-2606 reserved `.test` TLD) ~every 7s — a wedged
  test-fixture execution burning cycles, distinct from the real goal-path sink
  (`recordGoalPath`, which works). Triage: what detects a trace-sink retry loop
  wedged on an unroutable URL? Not chased this session.
- **The SIGTERM that stopped development-vessel at 00:33 was not attributed** — a
  clean stop with no logged sender. Whatever issues these stops is the upstream
  cause the immune system was meant to backstop; identifying it is a follow-up.
- **Autonomy is NOT yet demonstrated.** The apply path is now unblocked, but no
  substrate-authored goal has been observed landing a sha post-restart. That is the
  next observation, and the honest bar remains: read the DIFF, not `reached`.

## Open question

The boredom gap-gate narrowing (`ACTIONABLE_CATEGORIES={ui_legibility}`) was
**deliberately** cut to stop an autocatalytic loop. The safe re-widening order —
admitting substrate-authored detector gaps without re-opening that autocatalysis —
is unresolved, and may need dispositioning before the detector recursion is worth
reconnecting.

## 2026-08-13 — the routing fix, exercised end-to-end (seeded verify)

Seeded one real env-gate close-goal (operator-triggered SELECTION — the autonomous
selector is starved, see below — but generation, routing, compose, and gating are
the substrate's). Full chain, dispatch a15a3ef3:

- ✅ **Routing fix `4ed5046` works:** `gap-hydration: injected record
  gap-env-gated-dense-backfill-enabled (cited file: repos/concept-db/src/index.ts)`
  (was "none"), then `EARLY EDIT-INTENT DETECTED (names repos/concept-db/src/index.ts)
  — routing to feature_compose`. The blocker is cleared.
- ✅ **Apply path functional:** feature_compose connected (dev-vessel up), found the
  file (`fc-anchors 62 candidates`), drafted an `fc-plan` edit op, ran the gates.
- ✅ **Gates fail SAFE (no hollow-green, no harmful land):** the drafter produced a
  WRONG edit — it only added `DENSE_BACKFILL_ENABLED` to the `/health` response
  instead of changing the gating logic at line 273 — and the **semantic-gate caught
  it** (`addresses:false`, `suspected_real_location: …:273`). Nothing landed;
  concept-db HEAD unchanged.
- ⚠ **Residual reach-gate issue:** while the compose ran, the goal-host walk fell
  through (slow synchronous compose call) and returned `reached=true` via a
  `concept_write` standin (a concept SUMMARISING the gap, `WITHHELD alpha-credit …
  no landed sha`). So the honest `reached` verdict was hollow relative to the real
  (rejected) compose — a close-goal graded reached on a concept-write while the
  actual fix attempt failed the semantic gate.

**Net:** the routing blocker is fixed and the apply path works and fails safe. The
remaining barrier to an autonomous LANDING is drafter quality on this gap class —
shaping an env-var read is a non-trivial refactor the drafter did not get right, and
the semantic gate correctly refused it (the intended behaviour). The env-gate gaps
are a hard demonstration target for that reason; a mechanically simpler gap class
would land more readily. Selection is separately starved: the env-gate gap-goals
carry `fail×4-5` debits (from the now-fixed routing bug) that drop their cold score
below the cheap `disk-space-observer-tick`, so boredom never autonomously selects
them — a chicken-and-egg (they can't clear the debit without a success they can't get
without being selected). That debit-decay is the next lever for fully-autonomous
selection.

## 2026-08-13 — the bottleneck is now DRAFTER QUALITY, and the gates correctly guard it

After clearing the infrastructure cascade (dev-vessel down → immune timer dead →
gap-hydration routing → compose silent-death observability `4282791`), the loop now
runs end-to-end and TWO autonomous composes reached a semantic-gate verdict. Both
were REJECTED for the same reason — the drafter produced a superficial/adjacent
edit that does not address the gap:
- `gap-env-gated-dense-backfill-enabled` (seeded): drafter added the env var to the
  `/health` response; gate `addresses:false`, real site was line 273 gating logic.
- `route-edit-0cd58a38:1 / uniqueness-is-no-longer-evidence` (autonomous, fc-mssdffyf):
  drafter added a duplicate-push guard (`push(t)`); gate `addresses:false` —
  "does not alter the uniqueness-gated localisation heuristic that returns confident
  WRONG files."

**This is the honest frontier.** It is NOT an infrastructure blocker an operator can
patch: the compose machinery works, connects, drafts, typechecks, and gates. The
semantic-gate is doing its job — it refuses edits that don't address the gap, so
NOTHING hollow or harmful lands (no hollow-green, correct fail-safe). What the system
cannot yet do is DRAFT A CORRECT FIX for these gap classes. Two contributing factors:
1. **Grounding centering** — `fc-scope` centred fc-mssdffyf's window on "read-only",
   not the real localisation heuristic; the gate's `suspected_real_location` shows the
   drafter edited a site adjacent to, not at, the defect (the L8 "information
   starvation presenting as drafter fault" the code comments already name).
2. **Drafter competence on semantic refactors** — shaping an env var, or changing a
   uniqueness heuristic, is a non-trivial change the drafter approximates with a
   nearby cosmetic edit.

**What would move it (research-grade, not a patch):** better grounding that centres on
the gate's `suspected_real_location`; a stronger drafter model/prompt with a worked
example; or targeting mechanically-simpler gap classes the drafter can land. None of
these is a one-line operator fix. The infrastructure lane is done; the generative
lane is the frontier, and the safety gates correctly hold the line until it improves.
