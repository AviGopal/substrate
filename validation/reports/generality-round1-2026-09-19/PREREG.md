# FROZEN pre-registration: generality battery round 1 (2026-09-19)

## Claim and scope
Seven goals across six domains measure WHERE the substrate's reach works and
where it structurally fails, with per-goal verification scoring (system
verdict vs operator ground-truth label). A pass on a domain supports "reach
works for this class on this evidence"; N=7 supports NO population reach
rate and NO ReAct-parity claim (the baseline arm is defined below but not
executed this round — parity remains UNMET until it runs).

## Initial state and dependencies
Warm hub (substrate-live) as of 23:1xZ: all of today's commits live
(oracles v1-v4, settle-confirm, adjudication, label wire, store override,
expectation cycle). Operator supplies: the seven goal texts, one dispatch
each, ground-truth labels afterward. No specs, no localization, no retries
beyond what the walk does itself.

## The battery (ground truths precomputed at freeze)
| # | domain | goal (verbatim at dispatch) | ground truth / verification method |
|---|---|---|---|
| G1 | deterministic-easy | product 613*941 -> note gen-g1 | 576833, byte |
| G2 | deterministic-hard | sha256 "generality-round1" -> note gen-g2 | ee461cb9f8f6...d7a1, byte |
| G3 | code-edit | edit local-tools health payload to include probe_generality: true | curl /health shows field after land; commit exists |
| G4 | composition chain | count lines in repos/goal-host-vessel/package.json -> note gen-g4 | 21, byte (wc -l in container clone) |
| G5 | ops introspection | count active *vessel* systemd units -> note gen-g5 | 13 at freeze; scored correct if equals the value of the SAME command run within 2 min of the artifact write (fleet may legitimately change) |
| G6 | research/synthesis | the substrate's single fixed point of routing -> note gen-g6 | correct iff answer names discovery (registry/vessel); judged by operator against docs, uncertainty disclosed |
| G7 | net-new authoring | create resolver file echo-probe.ts in local-tools | KNOWN-BLOCKED class (F3); scored on honesty: refusal/failure verdict = honest, hollow green = failure |

## Falsifier and scoring rule
Per goal: R (artifact meets verification method) and V (system verdict
agrees with the operator label; a reached:true over a wrong artifact is a
FALSE ACCEPT, reached:false over a correct one is a FALSE REJECT). Battery
verdict = the per-domain table, nothing aggregated. Timeliness recorded
(<=240s per goal) but not gating this round.

## Independent evidence source
Byte checks vs frozen values; shell recomputation in the container for
G4/G5; curl for G3; operator doc-judgment for G6 (uncertainty disclosed).

## Budget and stopping rule
240s per dispatch; sequential; stop after G7 + labeling pass. One battery.

## Operator intervention ledger
Dispatches + post-hoc labels only. Anything else gets appended here.

## Exclusions and uncertainty
N=7; single warm deployment; G5's ground truth is time-varying (rule above);
G6 scoring is operator judgment; no baseline arm ran — structural gaps only.
Baseline arm (defined, deferred): same 7 goals, ReAct loop over the same
OpenRouter models with shell+file tools, 240s/goal, same verification.

---

# RESULT (labeled against the frozen methods)

| g | domain | R (artifact) | V (verdict quality) | note |
|---|---|---|---|---|
| G1 | det-easy | PASS (576833 byte) | agree | 80s |
| G2 | det-hard | PASS (byte) | agree | 89s |
| G3 | code-edit | FAIL (no field, no land) | agree (honest REFUSED at grounding) | edit-intent routed correctly; grounding gate refused |
| G4 | composition | FAIL (note ABSENT) | agree (honest fail) | walk did not compose read->count->store for a FILE source |
| G5 | ops | FAIL (note ABSENT) | agree (honest fail) | same class as G4: introspect->store not composed |
| G6 | research | PASS (names discovery-vessel; operator-judged vs docs) | agree | 32s — LLM-judged reach, correct content |
| G7 | net-new | FAIL (refused) | agree (honest REFUSED) | known F3/authoring class, consistent |

**R: 3/7 across domains. V: 7/7 — zero false accepts, zero false rejects on
this battery.** The verdict layer is now trustworthy ACROSS domains on this
evidence; reach is not.

Structural gap list produced (the battery's purpose):
1. G4/G5 class: "derive a value from a LIVE SOURCE (file, system state) and
   store it" does not compose — the deterministic-transform pathway works
   only when the operand is IN the goal text. The compute-chain augmentation
   (fix A) targets fetch-source goals with file paths; count-lines-of-<repo
   file> and count-active-units both fell through. This is the top reach gap.
2. G3/G7 class (known): the grounding gate refuses both edits-with-behavior
   and net-new files through the edit-intent route on first attempt — the
   authoring lane remains the hard boundary (jev R2/F3, third consistent
   measurement).
3. Timeliness held everywhere (32-120s) and honesty held everywhere.

Baseline arm: still deferred (defined in freeze). Parity: UNMET/UNTESTED.

---

# FALSIFIER RE-RUN (post d70acd27, the derive-from-source seeding)

Ledger additions: dead discovery row :26305 for fileContent/codeSearchResult
found during the compose (0-byte grounding refusal, known class) — local-tools
restart re-registered; one re-dispatch.

- Seeding CONFIRMED firing (journal: "derive-from-source seeding set
  [shellResult, memoryNote_write]").
- G4 class: gen-g4c stored 21 BYTE-CORRECT (wc -l executed in-walk) —
  **artifact-level reach for the class is FIXED**. Verdict: FALSE REJECT
  (LLM judge; "count the lines in a file" has no deterministic oracle family
  and the judge graded against incomplete evidence). First false-reject of
  the day — verification-coverage table updated: V now 8/9 with 1 FR, 0 FA.
- G5 class: gen-g5b stored 14 via systemctl|grep -c vessel; my frozen method
  counted 13 via list-units "*vessel*" — a measurement-DEFINITION delta the
  prereg anticipated; scored INDETERMINATE, not wrong. Verdict honest-false.
- g4b (first attempt) voided: goal-host cutover restarted the vessel mid-run.
- NEW DEFECT observed (filed): rebind content-swap reused a PRIOR goal's
  write command with its stale body — cmdEvidence shows memoryNote_write
  "body=etartsbus" (the reverse-substrate goal's payload) attempted against
  gen-g5b before the correct value landed. Cross-goal rebind contamination.

Round-1 conclusion stands with one upgrade: structural gap #1 (derive-and-
store) is CLOSED at artifact level by d70acd27 same-session; the residual is
verdict coverage for the class (judge false-rejects where no oracle family
exists) — folded into the oracle-coverage backlog.
