# What a working system would be expected to do

Measured 2026-09-02, host load 22.66 (above the ≤10 judging gate — every "now"
column is an observation, none is a verdict on a fix).

This document exists because the question has been asked seven times and answered
seven times in prose. Prose did not stick. Every row below is
**instrument → value now → expected value → window → n-floor**. A row with no
instrument says so; an invented number would be worse than the admission.

**Two different bars, never conflated:**
- **CONTRACT** — the end state CLAUDE.md commits to (e.g. ~90% reach).
- **TRAJECTORY** — what "working" means *at current maturity*: the pre-registered
  number moves in the pre-registered direction, in the pre-registered window, and
  interventions produce their predicted deltas.

A system can be working (trajectory) and far from contract. Judging today's
substrate against the contract alone is why the previous seven answers didn't land.

---

## ⚠ Live blocker — read first

**Autonomous landing is stopped right now.** Not queued, not theoretical.

```
gap-compose watchdog: stalled_min 74 → 94 → 100 → 105 → 125 → 132 → 139 (climbing)
                      every restart reports ok:true, http:200
gap_to_feature probe: n=8 → 7 pending_verification, 1 plan (87.5% refusal, 6 distinct)
sweep:                checked=19 closed=0, ×7 consecutive ticks
substrate-authored commits today: 0 observed vs ~4 expected-by-now (~10.5h at 7-16/day baseline)
```

⚠ **Refusal is a TAX (~87%), not a hard deadlock** — a 5/5 sample said 100% and was wrong at
n=8. A ~87% refusal against a ~2 compose/hour lane still predicts a few commits/day, **not
zero**. So refusal alone does NOT explain today's zero. **A second cause is live:**

```
concept-db: 151 starts in ~11h (~330/day pace, the documented drafter-starvation baseline)
            /health 6.16s   (development-vessel /health: 0.019s)
            "concept-db unreachable at 127.0.0.1:8260 — withholding 3 concept shapes"
host load:  26.10 and rising — ABOVE the ≤10 judging gate
```

`gap_to_feature` → `compose-lessons` → concept-db recall → 6s+ → timeout. A probe that
returned instantly at lower load hung >120s at load 26. **At load >10 neither cause can be
cleanly attributed**, and the two are confounded. Do not rank them from this window.

**The closed causal chain, every link measured:**
1. 97.6% of open gaps (492/504) carry no falsifier.
2. The sweep therefore **correctly abstains** — `checked=19 closed=0`.
3. Those 19 gaps stay `pending_verification`, and the picker ranks them top
   (landability saturated).
4. §12.6 **correctly refuses** to re-compose a landed-but-unverified gap.
5. **The refusal never feeds back into ranking.** So the same 19 gaps
   (3.8% of open) absorb 100% of picks; 485 open gaps are never selected.
6. No composes → no lands → no commits.

Every individual decision is correct. The loop is dead anyway. This is the
`requeueAfterNonAttempt` item — **ask-first** (selection policy), and it is the
single approval that changes today's numbers.

---

## The contract rows

### 1. Floor — ReAct parity (CLAUDE.md "Floor")

| | |
|---|---|
| **Instrument** | `journalctl -u goal-host-vessel \| grep -oE 'reach-patch ok \(walk-complete\): [A-Za-z0-9_-]+ reached=(true\|false)'` — **one line per walk**. Never a loose `reached=true` grep (5 emit sites, 24 lines for 7 walks). |
| **Now** | 7/99 = **7.1%**. Excluding the β-pump family: 4/8. |
| **Expected (trajectory)** | With the obsidian β-pump stopped: **≥30% of graded walks reach, n≥20, next 24h.** 50% is a small-n point estimate — deliberately not promised. |
| **Expected (contract)** | ~90%, "regardless of priors". End-state bar. |
| **Falsifier** | <20% at n≥20 ⇒ the β-pump was not the dominant cause and the diagnosis is wrong. |

### 2. Ceiling — the learned pathway

| | |
|---|---|
| **Instrument** | Minted-vs-seeded template execution counts; `reach_rate_scan` per-family. |
| **Now** | Minted templates run 460 / 385; seeded run **1**. Extraction input = **9 reached/24h**, 8 of them self-maintenance. |
| **Expected** | Every reached *novel* walk yields an extracted template within one window; minted templates re-selected without operator involvement. The ~400× minted-over-seeded ratio is law 4 confirmed and should **hold or widen**. |
| **Falsifier** | Ratio collapses toward 1, or reached walks rise while extractions stay flat. |

### 3. Middle — first/last-mile pathway reuse

| | |
|---|---|
| **Instrument** | **NONE EXISTS.** |
| **Now** | Unmeasured. |
| **Expected** | A near-miss goal reuses an existing composition and walks only the delta. |
| **Action** | **The missing instrument is itself a gap.** Candidate seed: the 16 `pathway` journal lines — but only after verifying that emit is one-per-walk (see row 1 for why that check is not optional). Do not report a number here until the instrument exists. |

### 4. Gap triple — law 7

| | |
|---|---|
| **Instrument** | Gap store status counts; `detected_at` / `closed_at` deltas; falsifier field on open rows. |
| **Now** | 504 open / 1037 closed / 160 rejected. **Opened 58 vs closed 5 per 24h — diverging.** Falsifier coverage 12/504 = **2.4%**. ⚠ **The 1037 is not closure.** By recorded reason: **67.8% `expired_not_redetected`** (703), 18.9% unrecorded, 4.1% `stale_low_value`. **Measured/verified closures: 47 = 4.5%.** Law 7 metric #1 must be counted on the verified subset only. |
| **Latency instrument is broken** | `gap-lifecycle-scan.ts:447` writes `detected_at: new Date()` **at expiry**, overwriting the original. All 703 expired gaps report age ≈ 0. True age survives only in `classification_metadata.first_detected` (median 168h, min exactly 120.0h). Law 7 metric #2 cannot be computed from `detected_at`. |
| **Stated TTL is false** | The record says "not re-detected within **336h** TTL". The predicate that actually fires is `isDetectorStale` at **120h**, unconditional and OR'd first (`:420-426`), so `expireHours=336` is **unreachable dead code**. Measured min age at expiry = 120.0h confirms it. |
| **Expected** | Close ≥ open over a 7d window. Falsifier coverage measured **on newly-written gaps only** — the write-path stamp is live, and the 492 legacy rows will drown the signal if pooled. |
| **Durability** | No closed gap reopens wearing a different hat; **and no new β-pump family replaces the obsidian one.** That second clause is the durability test for today's intervention. |

### 5. Selection health

| | |
|---|---|
| **Instrument** | `gap_to_feature` probe, `dry_run:true`, N=20, count distinct `gap_id`. ⚠ **NOT read-only** — `sweepPendingLandVerifications()` runs unconditionally (`gap-to-feature.ts:2975`), so N probes trigger N sweeps. Verified harmless here (`checked=19 closed=0`), but disclose it. |
| **Now** | n=8 probes: **7 `pending_verification`, 1 `plan` = 87.5% refusal**, 6 distinct gaps. 19 pending gaps dominate selection; 485 rarely reached. ⚠ **CORRECTION:** an earlier 5/5 sample read as "100% refused / loop is dead". At n=8 that is false — the picker *can* emit `plan`, so composable gaps are reachable. The pathology is a ~87% refusal tax, not a hard deadlock. |
| **Expected** | **≥15 distinct gaps per 20 picks**, and a refusal demotes its gap so the next pick differs. |
| **Falsifier** | Distinct-pick count stays <10/20 after `requeueAfterNonAttempt` lands ⇒ ranking is not the binding constraint. |

### 6. Autonomy criterion

| | |
|---|---|
| **Instrument** | `git log --format='%s' \| grep -c '^substrate-authored'` per day. (**Not** git author — every commit here is "DevBob Assistant", operator included; author cannot discriminate.) |
| **Now** | dev-vessel 50/7d — 8, 13, 7, 16, 9 on 08-28→09-01. **Today: 0 vs ~4 expected-by-now.** |
| **Expected** | Resume to the 7–16/day band within 24h of the deadlock clearing. |
| **Contract** | A substrate-authored commit reaching the remote working branch with **no operator hands**. "It fired" is not success. |

### 7. Learner input hygiene

| | |
|---|---|
| **Instrument** | `goal-reach` verdict mix (`HOLLOW` / `REACHED` / abstention). |
| **Now** | 53 HOLLOW / 4 REACHED; **49 of 53 from one structurally-unreachable goal**, each β-penalised. |
| **Expected** | A goal whose required vessel is inactive produces an **`INFRASTRUCTURE_UNAVAILABLE` abstention, never a β-penalised HOLLOW.** *Abstention preserves the learner; a HOLLOW poisons it.* |
| **First data point** | The 10:47Z timer-check. Zero new HOLLOW-via-obsidian lines ⇒ β-pump stopped. |

### 8. Watchdog honesty

| | |
|---|---|
| **Instrument** | `stalled_min` trend across consecutive watchdog firings. |
| **Now** | Climbs monotonically 74→139 while every firing reports `ok:true, http:200`. |
| **Expected** | **A watchdog's success metric is the stall clearing — `stalled_min` resetting — not its own exit status.** A watchdog that reports success while its subject stays stalled is measuring itself, not the system. |
| **Standing law** | A channel's own reporting is never evidence about the channel. |

---

---

## Positive control — two live dispatches (2026-09-02, load ~9)

Passive measurement of an idle system infers from absence. These are **interventions**:
arbitrary goals dispatched on demand, outputs read rather than statuses trusted.

### Dispatch A — `a104b133` — the ReAct floor, WORKING

```
goal    "Population of Iceland now and in 2000, with sources"
walk    target_shapes=[] confidence=0 → ran code-search + 2 gap-closing → HOLLOW (correctly)
floor   universal-tool-fallback → "385,663 (World Bank, 2023); 281,205 (World Bank, 2000)"
verdict reached=true — EARNED. Both figures accurate, sources named.
```

**Three contract obligations met at once:** the floor answered where no learned pathway
existed (CLAUDE.md Floor); the walk graded its own output HOLLOW instead of claiming
success; β was **withheld** with a stated reason rather than penalising a structurally
unreachable arm. `floorReached` (`goal-host/index.ts:4823`) requires a judge verdict AND a
fabricated-transcript guard — it passed both.

⚠ I first called this a false reach from `produced shapes:(none)` + `failure_mode:
execution_error` + the HOLLOW log, **before reading `final_text`. That was wrong.** Status
fields are not the evidence — this repo's own rule, violated by me while enforcing it.

### Dispatch B — `ad024ce9` / `exec_w7hlt887` — reach CORRECT, delivery questionable

```
step 2  inferred webSearchResult @ confidence 0.9        ← routing WORKED here
step 7  REACHED via 2-step chain
step 8  REACH-CONTENT  webSearchResult (3544 chars) "...tungsten, at 3,414 °C..."  ← correct
step 9  REACH-EVIDENCE shellResult (31 chars) {"error":"command is required"}
        final_text_len = 0
```

⚠ **I filed a gap claiming "reach declared on an error-valued terminal shape" and then
RETRACTED it in state** (`status:"rejected"`, not merely in prose). Reading
`goal-host/index.ts:10168-10182` refutes the mechanism: the `REACH-EVIDENCE` block is
**observability only** — *"it cannot change a verdict" / "never affect the reach verdict"* —
and it `continue`s past any shape already in `_reachedShapes`. Because `shellResult` was
*logged*, it was **not** the completion shape. The reach was granted on `webSearchResult`,
which genuinely carried the correct sourced answer. **The reach verdict was CORRECT.**

What remains is narrower and **not yet established**: `final_text_len = 0` on this
satisfier/chain reach versus `161` on the floor reach. That asymmetry would mean a caller
polling `goal_status` sees `produced shapes: shellResult` and no answer, recoverable only
via `goal_reasoning`. **n=1 for the empty case — deliberately NOT filed as a systematic
defect.** Filing it at n=1 would repeat the n=5→"100% refused" error. Further dispatches
were run to establish whether the asymmetry is real.

### What the control establishes

| Layer | Verdict | Evidence |
|---|---|---|
| ReAct floor | **WORKS** | Dispatch A, correct sourced answer in ~5 min |
| Self-grading honesty | **WORKS** | HOLLOW called on its own output; β withheld with reason |
| Goal-walk routing | **MIXED** | A: confidence 0, misrouted to code-search. B: confidence 0.9, correct |
| Reach-evidence integrity | **WORKS** | B's reach was granted on the shape that held the answer; the error blob was observability-only. My contrary claim was retracted. |
| Answer delivery | **UNRESOLVED, n=1** | A: `final_text`=161. B: `final_text`=0. Not enough to call systematic. |

**Capability is not the binding constraint.** Asked directly, the substrate answered an
arbitrary question correctly within five minutes. The 6.4% fleet reach is dominated by
routing and evidence-integrity defects plus near-zero dispatch volume — **not** by an
inability to do the work.

---

## Self-development probe (2026-09-02 ~20:37Z, load 2.84 — a judgeable window)

A repair was dispatched as a goal rather than hand-edited (law 6). Outcome is mixed and
both halves are evidence.

### MATCHES observed

| Expectation | Evidence |
|---|---|
| Filed gaps get selected autonomously | `[substrate-gap] gap-compose unit started for ribosome-treats-reached-false-as-terminal-losing-late-patched-reaches` — a gap filed hours earlier, picked with no operator hand |
| Picker is healthy | `489 eligible → 235 admitted`, `distinct_targets_top20=12`, `hopeless_excluded=57`, `skipped_pending=20` |
| Lineage backoff (shipped this session) works | `backoff excluded 24 of 516 gaps (eligible=489, deepest_lineage=3)` |
| Edit-intent routing works | `EDIT-INTENT DETECTED (0-step walk names …index.ts) — routing to feature_compose`, producer resolved via discovery |
| Drafter gets verbatim anchors | `[fc-anchors] supplied verified-unique anchors … (83 / 122 locator candidates)` |
| Honesty: dishonest satisfier refused | `resolved a DISHONEST body — the resolver returned an EMPTY STORE LISTING (rowCount 0) — that is a query miss, not a produced artifact — refusing to satisfy; grading reach honestly` |
| Honesty: staged ≠ landed | `HOLLOW — deterministic:edit-intent-no-landed-edit — an edit goal is reached only by an edit-result shape WITH landing evidence (push_status:pushed / new_git_sha)` |
| Honesty: coverage gate is self-aware | `TARGET HAS NO TEST FILE … A FAVORABLE verdict here means the change was reviewed, never executed. This is the exact condition under which d96e2ae (an unconditional self-call) landed and hung the vessel.` |
| Teaching channel writes | `[reach-gate-lesson] class=deterministic_edit_intent_no_landed_edit mirrored to concept-db (http 200)` |

### MISMATCHES observed

- **Edit-intent routing is load-fragile.** At load 25: `EARLY EDIT-INTENT routing failed
  (The operation timed out.) — falling through to walk`. At load 2.84 the same goal routed
  correctly. The route is not robust to the substrate's own resource pressure.
- **`feature_compose` apply is anchor-fragile.** First attempt:
  `verdict=UNFAVORABLE (op_count=1, apply_failed, rolled_back: {"error":"old_string not …`
  then `fs_edit failed: old_string not found in file. The closest real text is lines 1083-1088`.
- **`patch_with_tools` escalation staged but did not land**, and its verdict was
  unrecordable: `beta-penalty REJECTED (404) for 'patch_with_tools' — no posterior row
  exists for this pick` and `reach-patch NOT ATTEMPTED … synthetic id … this execution
  stays ungraded and its arm learns nothing from it`.

**Net:** the system correctly located the exact site it was asked to edit
(`code_search "walk-complete"` → 1 match → `code_read_lines 1050-1120` → `fs_edit` OK) and
still could not land the change. Authoring is not the blocker; **landing and grading are.**

### ★ Prior art that corrects this session's gap

`goal-host-vessel/src/index.ts:1012-1035` already analysed this class on 2026-08-29 and
built `SYNTHETIC_EXECUTION_ID_PREFIXES`. It establishes that 45 of 50 `MATCHED NO ROW`
warnings were synthetic ids whose loss is honest bookkeeping, that the apparent
32.6%-vs-13.0% negative-loss asymmetry (z=2.74) is an **artefact** of those ids, and that
`walk-satisfier-` (10 persisted / 5 lost) is deliberately NOT guarded because that would
"suppress ten real gradings to silence five warnings." The 5 residual warnings are left
**"LOUD on purpose — those are genuine grading failures."** This session's contribution is
narrower than first claimed: not the discovery of the class, but the measurement that
**all 5 residual losses carry `reached=true`** (p ≈ 1.5e-4 vs a 17.3% base rate).
Read that comment before touching this area.

## How to use this

1. Re-measure each row with the instrument **as written** (the instrument column is
   the load-bearing part; most errors this session were right data / wrong place).
2. Compare to the expected column, honouring the window and n-floor. **Never judge
   at load >10.**
3. A row that misses is a gap, not a note.
4. Rows 1, 5, 6 are coupled: rows 1 and 6 cannot be judged until row 5 clears,
   because a stalled picker produces no lands to grade.

## Pre-registered effect of the one pending approval

If `requeueAfterNonAttempt` lands:
- **Row 5:** distinct picks ≥15/20 (from 4/5).
- **Row 8:** `stalled_min` resets rather than climbing.
- **Row 6:** commits resume toward the 7–16/day band within 24h.

If the stall clears but commits do **not** resume, ranking was not the binding
constraint and the diagnosis above is wrong — in which case the next suspect is
compose slot exhaustion, not selection.
