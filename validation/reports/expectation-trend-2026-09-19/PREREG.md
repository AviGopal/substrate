# Pre-registration: expectation TREND battery (2026-09-19)

Operator bar: arbitrary goal, arbitrary domain, independently verifiable,
system-self-verified within 2 minutes, visible self-correction progress on the
supported surface. One attempt != trend != expectation, so: N=6 varied goals,
sequential, criteria frozen per run BEFORE any dispatch:

- **R (reach)**: substrate's own verdict reached:yes AND artifact byte-matches
  the answer precomputed below. Operator checking happens AFTER the system's
  verdict, for scoring only — never as the verification step.
- **T (timeliness)**: system's own reached verdict lands <= 120s after dispatch
  (measured by poll bracketing; a verdict first seen at a poll <= 120s counts,
  first seen after a poll where it was absent at >=120s fails).
- **V (visibility)**: a goal_status call ~20s into the run shows a live
  executionId or any walk state (not "(pending)").

Battery (answers precomputed NOW):
| # | goal | expected artifact (memoryNote title -> body) |
|---|---|---|
| 1 | sha256 of 'trend-demo-2026-09-19' | trend-demo-1 -> d693e2691251f4c3b8b6fdef26e0a04a0b9a9945bc8645bcdaad56ef08db535c |
| 2 | reverse the string 'substrate' | trend-demo-2 -> etartsbus |
| 3 | compute 379*941 | trend-demo-3 -> 356639 |
| 4 | base64-encode 'expectation' | trend-demo-4 -> ZXhwZWN0YXRpb24= |
| 5 | letter count of 'antidisestablishmentarianism' | trend-demo-5 -> 28 |
| 6 | uppercase 'quiet' | trend-demo-6 -> QUIET |

Expectation bar (frozen): R >= 5/6 AND T >= 5/6 AND V >= 5/6 = expectation
demonstrated. Lower = trend data, reported as partial with per-axis rates.

Priors, stated now: R 5-6/6 (this pathway class is learned, 41/41 posterior);
T 2-4/6 (LLM-judge tail, gap filed 40 min ago); V 0-1/6 (cockpit-blind gap
filed 40 min ago, compose nudge fired — if V>0 that is self-correction landing
mid-battery and will be checked against an actual commit, not assumed).

Caveat, stated now: all six artifacts are shell-computable one-liners sinking
to memoryNote — a fair test of the LEARNED-PATHWAY ceiling and of T/V, NOT of
arbitrary-domain generality (the composite-authoring case remains open per
jev-one-goal-probe/RESULTS.md).

---

# RESULT (scored against the frozen bar)

| run | task | R (byte-match + verdict) | T (self-verdict <=120s) | V (visible @20s) |
|---|---|---|---|---|
| 1 | sha256 | **FAIL — reached:true over task-description body (hollow reach graded true)** | pass (91s) | fail |
| 2 | reverse | FAIL — status=failed (honest); body = write-envelope w/ "etartbus" (char dropped) | fail (>240s) | fail |
| 3 | product | pass (356639) | pass (20s) | pass |
| 4 | base64 | pass | pass (20s) | pass |
| 5 | count | pass (28) | pass (35s) | fail |
| 6 | uppercase | pass (QUIET) | pass (20s) | pass |

**R 4/6, T 5/6, V 3/6 vs bar R>=5 AND T>=5 AND V>=5 → EXPECTATION NOT
DEMONSTRATED. The trend is real but partial.**

Observations the single attempt could not show:
- Same-class inconsistency: the sha256 class went 1-for-2 today (0254e51b
  correct at 08:27; df1f19b1 hollow at 08:39). A pathway with a strong
  posterior still emits wrong content — reach is not yet a property, it is
  a draw.
- The T tail is the walk path, not the satisfier path: satisfier-routed runs
  self-verified in 20s and were cockpit-visible at 20s; walk-routed runs were
  blind at 20s and slower. Cockpit blindness (gap-cockpit-blind-while-goal-runs)
  is path-correlated, not universal.
- Honesty split: run2's failure was graded failed (honest); run1's failure was
  graded reached (dishonest). New gap filed:
  gap-reach-gate-accepts-artifact-existence-without-content-check.
- All 6 operator ground-truth labels written to goal_verification_labels.
- Battery-instrument error (mine): artifact polling used a mis-addressed
  resolve body; caught by positive control; scoring redone at the correct
  address. artifact_s timings lost; criteria unaffected.

---

# Pre-registration: BATTERY 2 (post-fix, frozen before any dispatch)

Interventions since battery 1 (each a single named change, law 12):
- c9f1f86 (substrate-authored, via gap + direct compose lane, 3rd attempt):
  deterministic transform oracle in verifyGoalReached.
- c89a250 (operator, metabob-mcp — outside the substrate's landing reach):
  goal_status renders live walkLog. Requires MCP restart to affect this
  session's tool output, so V below is measured at the DATA layer.
- llm-resolver-vessel restarted to re-register llm_completion (dead-row class).

Fresh battery (same families, new operands — answers precomputed NOW):
| # | goal operand | title -> expected |
|---|---|---|
| 1 | sha256 trendtwo-demo-2026-09-19 | trend2-demo-1 -> d2082007549d47c2f4e0f0a408f1966111f3550842cf2e42f2ab86d684b53b5e |
| 2 | reverse monolith | trend2-demo-2 -> htilonom |
| 3 | product 613*487 | trend2-demo-3 -> 298531 |
| 4 | base64 verified | trend2-demo-4 -> dmVyaWZpZWQ= |
| 5 | letters floccinaucinihilipilification | trend2-demo-5 -> 29 |
| 6 | lowercase THUNDER | trend2-demo-6 -> thunder |

Criteria (same bar): R = byte-match AND system verdict agrees (a reached:true
over a mismatch is an R fail regardless of artifact-eventually-right; a
reached:false over a genuine mismatch with a transform-mismatch reason counts
as HONEST but still not R — the goal was not achieved). T = system verdict
<=120s. V = GET /executions/<id> at ~20s shows non-empty walkLog OR
executionId. Bar: R>=5/6 AND T>=5/6 AND V>=5/6.
Effect check per run: a [transform-oracle] VERDICT line must appear in the
goal-host journal (proves c9f1f86 executes; silence = the oracle never ran).

---

# BATTERY 2 RESULT (scored against the frozen bar)

| run | R (byte+verdict) | T | V | verdict reason |
|---|---|---|---|---|
| 1 sha256 | **PASS** | 30s | walkLog=5 | transform-verified (landed oracle) |
| 2 reverse | fail (envelope-wrapped correct value) | 20s | walkLog=10 | verified-compute-artifact (pre-existing oracle) |
| 3 product | **PASS** | 25s | walkLog=6 | transform-verified |
| 4 base64 | fail — note never written; verdict FALSE (honest) | 40s | walkLog=7 | transform-mismatch |
| 5 lettercount | fail — note absent but verdict TRUE (oracle blind spot) | 20s | walkLog=7 | transform-verified (FALSE POSITIVE) |
| 6 lowercase | fail — note never written; verdict FALSE (honest) | 30s | walkLog=7 | transform-mismatch |

**R 2/6, T 6/6, V 6/6.** Battery-over-battery: T 5/6→6/6 (all verdicts 20-40s,
LLM judge tail eliminated for this class), V 3/6→6/6 (walkLog live on every
poll), honesty 4/6→5/6. R fell 4/6→2/6 — decomposed causes:
- run 5: MY landed oracle's dig.includes("29") matched unrelated satisfier-read
  content (29k chars of other notes). Oracle v2 (named-note byte-compare)
  drafted; spec preserved at scratchpad compose5.json / container /tmp/compose5.json.
- runs 4,6: the walk graded a satisfier READ of the target shape as if it were
  the store step, then wandered (webSearchResult bridges) without composing
  shellResult -> memoryNote_write; notes never written; verdicts honestly false.
- run 2: writer wrapped the correct value in a {"title","content"} envelope.

# TERMINAL BLOCKER (operator-intractable: credentials)

At 09:05-09:17 the LLM plane died for real: ANTHROPIC_API_KEY returns 401
"API key is invalid" from api.anthropic.com (positive control, 1-token call);
the OpenRouter ACCOUNT balance is exhausted (key limit shows $363 headroom but
402 "can only afford 7966 tokens" — key-limit != account credits);
GOOGLE_API_KEY deliberately absent; free models daily-capped. Compose lane
(oracle v2 + store-step fix) blocked until a valid key or credits arrive.

---

# Pre-registration: BATTERY 3 (frozen before dispatch)

Interventions since battery 2 (one per axis-defect, law 12):
- 694fa777 (substrate-authored, semantic-gate verified): oracle v2 — titled
  transform goals graded by NAMED-NOTE byte-compare; digest containment only
  for untitled goals. Closes the run-5 false-positive class.
- OpenRouter account credits restored by the operator; llm-resolver restarted.
  The universal tool fallback (store-step repair path) is reachable again.
- No walk-side change landed for gap-walk-grades-satisfier-read-…-store-step:
  battery 3 measures whether honest mismatch verdicts + a reachable floor are
  ENOUGH for the walk to complete store goals, or whether that gap blocks R.

Battery (answers precomputed NOW):
| # | operand | title -> expected |
|---|---|---|
| 1 | sha256 trendthree-demo-2026-09-19 | trend3-demo-1 -> e6090d52d683e57c4247a3d8a9e30a6d09f76d1a2ed26553a6a0394664b38f59 |
| 2 | reverse hippopotamus | trend3-demo-2 -> sumatopoppih |
| 3 | product 739*821 | trend3-demo-3 -> 606719 |
| 4 | base64 expectation-met | trend3-demo-4 -> ZXhwZWN0YXRpb24tbWV0 |
| 5 | letters sesquipedalian | trend3-demo-5 -> 14 |
| 6 | uppercase whisper | trend3-demo-6 -> WHISPER |

Same criteria and bar: R (byte-match AND verdict agrees) >=5/6, T (<=120s)
>=5/6, V (walkLog/execId @20s) >=5/6. Per-run effect check: transform-oracle
VERDICT lines must cite "note:trend3-demo-N" as the checked address.

---

# Pre-registration: BATTERY 4 (frozen before dispatch)

Intervention since battery 3 (one change): e8e1af35 (substrate-authored) —
oracle v3 wraps the named-note byte-compare in a bounded 4x4s settle-retry,
closing the measured verdict-vs-write race (dispatch b4f6a321: correct digest
landed at +11s after the last oracle check and was graded mismatch).

| # | operand | title -> expected |
|---|---|---|
| 1 | sha256 trendfour-demo-2026-09-19 | trend4-demo-1 -> c0ed76c5e5a165d15d9f636cd12b03dbe6d5eee3c777658fff74bdf9ad18e644 |
| 2 | reverse palindrome | trend4-demo-2 -> emordnilap |
| 3 | product 457*683 | trend4-demo-3 -> 312131 |
| 4 | base64 trend-holds | trend4-demo-4 -> dHJlbmQtaG9sZHM= |
| 5 | letters perspicacious | trend4-demo-5 -> 13 |
| 6 | lowercase ECHO | trend4-demo-6 -> echo |

Same criteria and bar: R>=5/6 AND T>=5/6 AND V>=5/6. T allows the settle
retry (verdict may add up to ~12s on the honest-fail path; bar unchanged at
120s). Battery 3 note: 5/6 artifacts were byte-correct — the floor with a
funded LLM plane DOES complete store goals; run 5's floor computed 15 for a
14-letter word and the oracle rightly refused it (graders cannot fix
arithmetic; they can only refuse it).

---

# Pre-registration: BATTERY 5 (frozen before dispatch)

Intervention since battery 4 (one change): 78ff348c (substrate-authored) —
oracle v4 strips sentence-ending periods from the captured note title. Root
cause of batteries 3-4 R failures: the title regex char class included '.',
so "titled trend4-demo-1." captured the period, title_prefix matched zero
notes, and byte-correct artifacts graded mismatch (96c768f5). URL, body, and
auth were each eliminated by replaying the oracle's exact call.

| # | operand | title -> expected |
|---|---|---|
| 1 | sha256 trendfive-demo-2026-09-19 | trend5-demo-1 -> ddd1847c4c9b8143183acde50322f6a99e3710d3faf581df7d9f1e6b18ba0559 |
| 2 | reverse substrate | trend5-demo-2 -> etartsbus |
| 3 | product 359*941 | trend5-demo-3 -> 337819 |
| 4 | base64 battery-five | trend5-demo-4 -> YmF0dGVyeS1maXZl |
| 5 | letters incontrovertible | trend5-demo-5 -> 16 |
| 6 | uppercase murmur | trend5-demo-6 -> MURMUR |

Same criteria, same bar: R>=5/6 AND T>=5/6 AND V>=5/6.

---

# BATTERY 3 + 4 RESULTS (scored against the frozen bar)

Battery 3: R 1/6 (run 2 only — via the pre-existing verified-compute-artifact
oracle), T 6/6 (20-35s), V 6/6. Battery 4: R 0/6, T 6/6 (20-96s), V 6/6.

The R collapse was ONE bug with a clean epistemic trail: artifacts were
byte-correct in 5/6 (b3) and 4/6 (b4) runs — the FLOOR with a funded LLM
plane completes store goals — but oracle v2/v3's title capture included the
sentence-ending period ([A-Za-z0-9._-] matched the '.'), so title_prefix
resolved zero notes and every titled verdict was false. Eliminated in order:
race (v3 settle-retry — landed, insufficient), URL (discovery row verified),
body shape (replayed exact call), auth (replayed with goal-host's own key),
then the capture itself (node repro: captures "trend4-demo-1."). Fixed in
78ff348c (v4). Honesty note: all v2/v3 false verdicts were false-NEGATIVE —
the fail-toward-honest direction held; no hollow greens in either battery.

---

# BATTERY 5 RESULT: **BAR MET** — R 5/6, T 6/6, V 6/6

Verdicts 20-90s, all deterministic. Sole miss (run 5): the floor computed 17
letters for incontrovertible (16); the oracle refused honestly. No hollow
greens; no false negatives.

# Pre-registration: BATTERY 6 — REPLICATION, ZERO INTERVENTION (frozen now)

Nothing has been changed since battery 5. This battery tests whether the bar
HOLDS without touching anything — the trend-vs-expectation control.

| # | operand | title -> expected |
|---|---|---|
| 1 | sha256 trendsix-demo-2026-09-19 | trend6-demo-1 -> c94e6e20072def1229f2a960ccab0542351eaa4e463e07815dcb070d9f4caefc |
| 2 | reverse threshold | trend6-demo-2 -> dlohserht |
| 3 | product 523*769 | trend6-demo-3 -> 402187 |
| 4 | base64 replication | trend6-demo-4 -> cmVwbGljYXRpb24= |
| 5 | letters serendipity | trend6-demo-5 -> 11 |
| 6 | lowercase BEACON | trend6-demo-6 -> beacon |

Same criteria, same bar. Expectation = bar met in BOTH battery 5 and 6.

---

# BATTERY 6 RESULT: **BAR MET AGAIN, ZERO INTERVENTION** — R 5/6, T 6/6, V 6/6

Sole miss (run 1): the floor computed a WRONG sha256 (LLM-hallucinated hash
instead of shelling out); the oracle refused it deterministically at 80s.
Same honest-refusal class as battery 5's letter-count miss.

# FINAL TREND (six batteries, same frozen criteria throughout)

| battery | R | T | V | intervention before it |
|---|---|---|---|---|
| 1 | 4/6 | 5/6 | 3/6 | — (baseline) |
| 2 | 2/6 | 6/6 | 6/6 | c9f1f86 oracle v1, c89a250 cockpit walkLog |
| 3 | 1/6 | 6/6 | 6/6 | 694fa777 oracle v2 (named-note), credits restored |
| 4 | 0/6 | 6/6 | 6/6 | e8e1af35 oracle v3 (settle retry) |
| 5 | **5/6** | **6/6** | **6/6** | 78ff348c oracle v4 (trailing-dot capture fix) |
| 6 | **5/6** | **6/6** | **6/6** | **none — replication** |

The bar (R>=5 AND T>=5 AND V>=5, frozen before battery 1's first dispatch)
held on two consecutive batteries, the second with no intervention. Both
residual misses were honest deterministic refusals of genuinely wrong
LLM-computed values (letter-count 17-for-16; hallucinated sha256) — the
grader cannot fix arithmetic, and no wrong value was ever graded reached
after v4. Every reach-affecting fix in the table was substrate-authored and
semantic-gate-verified (the operator authored specs and one cockpit render
fix outside the substrate's landing reach).

---

# Pre-registration: BATTERY 7 (frozen before dispatch; post queue items 1-3)

Interventions since battery 6: 53c4b4ec (adjudication pathway, dev-vessel),
41b9080e (oracle-label disagreement wire), 182dbf3d (store-intent override:
store-in-note goals now require memoryNote_write, un-satisfiable by a read),
4e1ce8ffed + 6630d4b2de (system-authored during the probe; lettercount
convention + integer-rounding no-op). Battery 7 tests that the bar still
holds AND that the store-intent override improves the R mechanism (expect
store goals to compose a write step; walk log should show the override log
line for runs where inference seeds the read shape).

| # | operand | title -> expected |
|---|---|---|
| 1 | sha256 trendseven-demo-2026-09-19 | trend7-demo-1 -> 781900e71440bf07d2307d0f7fc59f1215fe8bc92bdc94ced576b0e69300ece6 |
| 2 | reverse lantern | trend7-demo-2 -> nretnal |
| 3 | product 271*893 | trend7-demo-3 -> 242003 |
| 4 | base64 queue-cleared | trend7-demo-4 -> cXVldWUtY2xlYXJlZA== |
| 5 | letters ephemeral | trend7-demo-5 -> 9 |
| 6 | uppercase quorum | trend7-demo-6 -> QUORUM |

Same criteria, same bar: R>=5/6 AND T>=5/6 AND V>=5/6.

---

# BATTERY 7 RESULT: R 4/6, T 6/6, V 6/6 — bar NOT met; one NEW class isolated

Runs 4 and 5 are a class no earlier battery could show: the oracle graded
reached=true against a BYTE-CORRECT artifact at verdict time (journal:
VERDICT true at note-creation second), then a SUPERSEDED attempt's stale
in-flight write landed 0.7-2s later and degraded the artifact (9 -> 8;
correct base64 -> newline-contaminated), and a later oracle invocation
logged false while the dispatch kept the first verdict. Not a producer
error, not a verifier error: attempt-fencing. Filed pre-localized:
gap-superseded-attempt-writes-land-after-the-verdict (evidence dispatches
c8074e27, a100df95, both with dual VERDICT lines in the journal).

Two positive observations inside the miss:
- Run 5's walk did EXACTLY what items 3+4 ask: inference seeded
  [shellResult, memoryNote_write], the shell EXECUTED the procedure
  (echo -n ephemeral | wc -c -> 9), and the write stored its verbatim
  output. Executable-computation-then-store is now a live pathway.
- The store-intent override (182dbf3d) fired 0 times this battery —
  inference already seeded the write shape on every store goal. Landed but
  DORMANT until a run shows its log line; do not count it as exercised.

---

# Pre-registration: BATTERY 8 (frozen before dispatch)

Intervention since battery 7 (one change): 4dfe316a (substrate-authored,
gate-verified) — settle-confirm in the transform oracle's titled branch:
after a true byte-compare, re-read the note 3s later and flip to false if a
stale writer degraded it. Verdict-truthfulness half only; the attempt-fencing
root gap remains open with the system. Prediction: if the stale-writer race
recurs, the attempt grades honestly false IN the attempt loop and the walk's
retry can re-write correctly — so R may RECOVER via retry rather than
false-accept. T budget +3s per titled verdict.

| # | operand | title -> expected |
|---|---|---|
| 1 | sha256 trendeight-demo-2026-09-19 | trend8-demo-1 -> ae20bb1f69491f1789ac176f9426386ab8484163e3b9594caa0f5c66d00aeb2c |
| 2 | reverse harbinger | trend8-demo-2 -> regnibrah |
| 3 | product 631*487 | trend8-demo-3 -> 307297 |
| 4 | base64 settled | trend8-demo-4 -> c2V0dGxlZA== |
| 5 | letters mellifluous | trend8-demo-5 -> 11 |
| 6 | lowercase VESSEL | trend8-demo-6 -> vessel |

Same criteria, same bar: R>=5/6 AND T>=5/6 AND V>=5/6.

---

# BATTERY 8 RESULT: **6/6 on ALL THREE AXES — first perfect battery**

Every artifact byte-matched its precomputed answer, every system verdict
agreed, verdicts 20-80s, all runs visible at 20s. SETTLE-CONFIRM fired 0
times (no stale-writer race recurred; verdicts stood on stable artifacts).

# SERIES CLOSE-OUT (8 batteries, criteria frozen throughout)

R by battery: 4 -> 2 -> 1 -> 0 -> 5 -> 5 -> 4 -> 6. Bar (R>=5 ^ T>=5 ^ V>=5):
met on 5, 6 (zero-intervention replication), missed on 7 (new class:
post-verdict stale-writer overwrite - diagnosed same battery, fix landed
4dfe316a), met on 8 at 6/6. Every reach-affecting fix in the series was
substrate-authored and semantic-gate-verified.

Queue disposition (operator-stated leverage order):
1. Adjudication pathway: LANDED 53c4b4ec + probe-verified (E1'/E2'/E3'/
   transfer all MET vs all-NOT-MET baseline). The investigative role has
   transferred for the transform-disagreement class.
2. Oracle-label consumer: LANDED 41b9080e + live-verified (contradicting
   human label auto-minted gap-oracle-label-disagreement-walk-satisfier-2-*).
3. Store-intent override: LANDED 182dbf3d; DORMANT so far (inference now
   seeds memoryNote_write on its own in every observed store goal) - it is
   the backstop, unexercised.
4. Executable-procedure producer gap: FILED pre-localized
   (gap-floor-generates-exact-values-instead-of-executing-the-procedure);
   partially self-resolved in behavior - battery 7/8 walks EXECUTED
   procedures (echo -n X | wc -c) rather than generating values.

Open with the system: attempt-fencing root fix (verdict-truthfulness half
landed as settle-confirm); moot-compose churn on closed gaps (observed:
recommit/narrowed children keep composing after closure - unfiled, next
session's first filing candidate).
