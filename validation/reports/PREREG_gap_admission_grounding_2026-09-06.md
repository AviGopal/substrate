# Pre-registered intervention: the admission gate reads only metadata, never the gap's own prose

**Window opened** 2026-09-06 11:25 UTC. **Load average during measurement** 16–21 — high enough
that no *landed-code verdict* from this window may be treated as anything but INCONCLUSIVE. The
claims below are about *data state and selection*, which load does not perturb.

## The retraction that started it

I published, earlier in this session, that the two bootstrap gaps filed at 11:11 were unattempted
because of **capacity starvation**, citing:

```
[substrate-gap] gap-compose unit NOT started for no-reconciler-checks-... — a compose is already in flight
```

**That was wrong.** The picker's own admission line settles it:

```
[gap-to-feature] auto-pick admission: 747 candidates → 370 admitted, 377 excluded
                 {"orphan_no_producer":2,"no_groundable_target":375}
```

Both gaps sat in `no_groundable_target`. They were **excluded by construction**, not starved.
`citedExistingFile` (`repos/development-vessel/src/resolvers/gap-to-feature.ts:1290`) reads exactly
four metadata fields — `edit_site`, `file_path`, `change_site`, `suspected_real_location` — and
never reads the summary. Both gaps carried `target_file: null`. A gap can name its target in the
first sentence of its summary and remain invisible to the lane forever.

## The measurement

Against the live store, 2026-09-06 11:45 UTC, 802 open gaps:

| class | count |
|---|---|
| groundable by metadata today | 371 |
| **not groundable by metadata, but summary prose names an EXISTING file** | **74** |
| names no existing file anywhere (creation gaps + vague) | 357 |

74 actionable gaps — a **20% increase on the workable inventory** — are excluded every tick behind
a parse the system already performs elsewhere. `goal-host-vessel/src/index.ts` (gap-hydration)
runs `/repos\/[\w.-]+\/[\w.\/-]+\.\w+/` over `metadata + summary` and logs `cited file: <path>`;
it succeeded twice within twenty minutes. It injects the parsed path into **goal text only** and
never writes it back to the record, so the picker stays blind to a path the system already
extracted.

## The intervention, and its pre-registered prediction

**Changed:** exactly one property of two gap records — `classification_metadata.edit_site` stamped
with an existing file. No code landed. Full-record resend, because `substrateGap_write` REPLACES
rather than merges.

**Predicted, before observing:** `citedExistingFile` returns non-null → the gap is admitted on the
next tick → it becomes *eligible* to be picked. Admission was predicted; **being picked was not**,
since rank still competes against `route-edit-*` at 0.84.

**Observed:**

| time | event |
|---|---|
| 11:11–11:49 | `compose-grades-...` filed, ungrounded. **Never picked. 38 minutes.** |
| ~11:49 | `edit_site` stamped on both gaps |
| 11:53:38 | `[gap-to-feature] pick {"gap_id":"compose-grades-are-keyed-to-clean-exit-not-to-consequence", "target":"repos/development-vessel/src/resolvers/feature-compose.ts","score":0.84}` |

Four minutes from grounding to the top slot, after 38 minutes of invisibility. One property
changed; one observable change; the prediction was made in advance and was, if anything,
conservative.

## What step 3 actually is — one line

The gap was re-authored as a single verbatim op after reading the emission site.
`feature-compose.ts:6191`:

```ts
        success: verdict === "FAVORABLE",
```

That is the compose grade. Not landed, not pushed, not executed — the gate verdict alone.
`landedVessels` is computed **three lines above** it (from `cutovers` filtered on
`result.applied === true`) and is already persisted into the *same trace* as
`metadata.landed_vessels`. **The trace carries the refutation of its own grade and does not
consult it.** The op is one line:

```ts
        success: verdict === "FAVORABLE" && landedVessels.length > 0,
```

Stated consequence, so the effect is not later mistaken for a regression: emission is
unconditional and stays so, preserving step 1's result; only the *label* changes; and the measured
success rate on `feature_compose` will **fall**, because most composes do not land. That fall is
the correction — the rate that drops was never measuring repair.

## Two claims tested and NOT published

- **"The substrate has never autonomously created a new resolver."** Over-determined and narrowed.
  `50fc392` is substrate-authored and *did* add a new file — but it was admitted on an
  **existing** `edit_site` (`gap-to-feature.ts`) and created `gap-to-feature.test.ts` as a sibling
  op. The accurate claim: creation is reachable only once a gap is grounded on a file that already
  exists. All 357 gaps naming only a not-yet-existing file remain structurally inadmissible.
- **"`impact` is a constant, so the picker ranks only by landability."** Refuted by a control over
  653 pick lines / 3 days: `impact` takes 1 (589), 1.25 (35), 1.5 (13), 1.75 (10), 2 (6). It is
  the *mode*, not a constant. `score == landability` in 423 of 653 (65%).
- **"The picker does not choose its top-scoring candidate" (322 of 653, 49%).** Refuted by reading
  the code. `chosen` comes from `chooseFirstActionable(ranked, …)` — the first candidate not
  skipped as pending-verification — while `runner_up` is hardcoded `ranked[1]` of the *unfiltered*
  list. With `skipped_pending: 40` on the same line, a runner-up outscoring the pick is expected.

  What survives is smaller and real: a log line whose stated purpose is *law 12 — record the
  counterfactual AT decision time* names, in roughly half of all decisions, an alternative that
  was never selectable. The system's own record of "what I would have done instead" is wrong 49%
  of the time. **Not filed as a gap**, deliberately: the pool is at 315 with `tied_at_top: 7`, and
  the surrounding code already warns that new low-priority filings are "a new amplification input
  into the very gap store this work is trying to drain."

## Standing observations, not yet acted on

- `gap-compose.service` is, since the 2026-07-09 watchdog demotion, a **stall detector**, not the
  compose path (`ExecStart=…/watchdog-tick.ts`, resolved via `systemctl show`). Every
  `[substrate-gap] event-driven gap-compose pickup triggered by <gap>` line therefore starts a unit
  that exits in under a second when the flow is alive. The mechanism is coherent and documented;
  the **log line names a pickup that structurally is not one**.
- `[oracle-label] NOT consumed exec=exec_zkzgshr9 reason=no_labels` repeats every ~2 seconds for a
  single execution id — a hot retry loop against a condition that cannot change without a labeler.

---

# Addendum: the grounded gap composed, and was refused by 5.79 milliseconds

## Retraction of this session's step-1 headline

I published, earlier today, that step 1 of the bootstrap closed — *"graded `exec_*` rows: 0 in the
system's recorded history → 2 in 19 minutes."* **That is false.** `feature_compose` has emitted
graded `exec_*` rows **continuously since 2026-08-29**: 988 rows, per day 62 / 103 / 137 / 92 / 30
/ 106 / 91 / 233 / 129. Hourly on 09-06: 13, 8, 3, 7, 9, 10, 12, 11, 11, 21, **16**, 8 — mean
10.8/h. My "2 in 19 minutes" is *below* the expected ~3.4, and the 10:00 hour I credited to my fix
was quieter than 09:00.

The false zero came from `id CONTAINS 'exec_'`, which does not match a SurrealDB record id — a trap
I had documented **in the same note**, as the reason my success-watcher was blind. I corrected the
instrument, re-ran the *after*, and never re-ran the *before*.

**The lesson, stated generally: fixing an instrument obliges re-measuring the baseline, not just
the new reading. A step change needs a rate on both sides; I had a rate on one.**

The four commits are real. Their true effect is a **linkage repair** — the consumer now keys its
satisfier trace to the real `exec_*` id instead of a synthesized `feature_compose:<sha>` string.
Real, modest, and not the opening of a channel.

## The compose outcome

| stage | result |
|---|---|
| grounding | `[fc-scope] region-named gap` — the `region` metadata was used |
| symbol resolution | `[fc-symbols] resolved 1/3 cross-file declaration(s): landedVessels` |
| apply | 1 op, `ok: true`, **line 6191** — exactly the anchored line |
| typecheck | `TC_EXIT=0` |
| shape-dispatch | `OK — 250 advertised shapes, 253 dispatch cases, all agree` |
| tests | 2188 pass, 25 fail, 5 flagged NEW |
| **verdict** | **UNFAVORABLE, rolled back** |

Four of the five "new" failures are in `resolveGapToFeature cooldown logic` — a file a one-line
edit to feature-compose's *trace emission* cannot reach. No concurrent compose touched
`gap-to-feature.ts` (the three in-window composes targeted `goal-host/index.ts`,
`activity-api/db-admin-repair.ts`, and `feature-compose.ts`), so this is not cross-contamination.

The timing-out test is:

```
(fail) vessel_mitosis_cutover > git-aware cutover: applies staged files, commits,
       mirrors to /vessels, emits cutoverApplied [20005.79ms]
  ^ this test timed out after 20000ms.
```

A git-heavy integration test, unrelated to the change, **over budget by 5.79 ms — 0.03%** — at
load average ~20.

## The class defect: a control that repeats under a constant confounder

The verify harness does difference against a baseline and re-runs to confirm:
`NEW test failures introduced by this draft, REPRODUCED on a second run`. That is a real control
against flakiness — but **both runs happen under the same sustained load**, so a load-induced
timeout reproduces perfectly and is promoted to "introduced by this draft."

Measured across **all 3,005 compose reports on disk**:

| verify run | UNFAVORABLE | FAVORABLE | FAVORABLE rate |
|---|---|---|---|
| no timeout | 1546 | 1005 | **39.4%** |
| contains a test timeout | 380 | 74 | **16.3%** |

Odds ratio **3.34**. 454 of 3,005 composes (15.1%) had a timeout in verify. If those would
otherwise have passed at 39.4%, the expected count is ~179 against 74 observed — **on the order of
100 approvals lost**, roughly 10% of the 1,079 FAVORABLE verdicts ever recorded.

This is correlational at corpus grain (a hanging draft could itself cause a timeout), but for the
instance measured here it is decisive: an unrelated git integration test, over by 5.79 ms.

**Why this is anti-compounding, not merely wasteful.** Every such refusal is also a β penalty. The
learner is taught that a correct fix was wrong, by the machine's load rather than by the code. And
because load is highest exactly when the lane is busiest, the noise is not random with respect to
the work — refusals concentrate when throughput is highest.

**Not hand-landed.** My standing rule is that no fix is judged at load average above ~10; this
verdict is INCONCLUSIVE, not wrong, and the gap remains open for the lane to retry when the box is
quiet. The system was not incapable here — it located the line, understood the symbol, and applied
the change cleanly. Its verifier was noisy.

---

# Addendum 2: fix 0 is a label, not a mechanism — and the harm chain is four-wide

Following the refusal into the charging site changes the fix from "build load-awareness" to
"reuse what is already there."

**The exemption already exists and is already honored.** `gap-to-feature.ts`:

```ts
export function isNonAttemptComposeResult(cb) {
  if (String(cb.failure_kind ?? "") === "environment") return true;
  ...
}
// line 3686:
if (!allOk && !pointer.dry_run && !isNonAttemptComposeResult(lastBody)) await bumpFailedAttempts(gap);
```

**And `failure_kind` is already computed** — `feature-compose.ts:6282`:

```ts
failure_kind: effectiveVerdict === "FAVORABLE" ? null
  : (classifyEnvironmentFailure(cutovers) ? "environment" : "fix"),
```

`classifyEnvironmentFailure` inspects **`cutovers` only**. A verify-stage environment failure is
therefore labeled `"fix"` and charged. The function's own comment records the identical defect one
stage earlier — a change-window lease deferral "was classified as a `fix` failure and charged to
the drafter, for an environment condition the drafter did not cause and cannot fix." Repaired for
cutovers; never extended to verify.

So fix 0 is one line, inserted after a unique anchor, using `verify` (declared at 5147, already
captured by the closure):

```ts
if (/timed out after \d+\s*ms/i.test(JSON.stringify(verify ?? []))) return "env_test_timeout";
```

## The harm chain is wider than a rank penalty

`bumpFailedAttempts` does four things in one call. A single 5.79 ms overrun therefore causes:

1. `failed_attempts++` → `landabilityScore` subtracts `min(fa * 0.1, 0.4)`. Two refusals = **−0.2**
   of rank, against a field topping out at 0.84–1.125. Measured live on
   `compose-grades-…`: grounding bought it +0.4; the refusals took back half.
2. `updateCalibration(category, false)` → a false negative into the category calibration.
3. A **bounded human-authorized exemption is spent** — one attempt closer to re-escalation, on a
   failure no human decision caused.
4. `joinDecisionOutcome(meta, { landed: false })` → a **causal decision-outcome record** asserting
   the decision led to no landing, when the cause was machine load.

Item 4 is the sharpest. The standing directive for this window is that the system must *causally
associate its actions on the environment with observable changes*. At this site it does exactly
that — and records the wrong cause.

## Accepted cost, stated in the gap rather than discovered later

A draft that introduces a genuine hang also times out, and after this change is labeled
environment and not charged. That signal loss is deliberate and bounded: `ok` stays false and
`rolled_back` stays true, so a hanging draft still **cannot land**. Only credit assignment moves,
never safety. One rare missed penalty against ~100 wrongly-charged correct fixes.

Filed as `a-load-induced-verify-timeout-is-charged-to-the-drafter-as-a-fix-failure`, grounded on
`feature-compose.ts`, region `classifyEnvironmentFailure`, single verbatim op.

---

# Addendum 3: the pass-regression un-latch is dead in practice

A second, independent instance of the fix-0 class, found while checking how hard the flake control
actually works. It works harder than I credited — observed shedding **22 of 22** spurious "new"
failures on a re-run, so the suite emits roughly that many per run under load and the control
correctly discards them.

But every observed `FLAKE CONFIRMATION` line ends the same
way: `(pass 2188 -> null)`, `(pass 1341 -> null)`, `(pass 2041 -> null)` — **the second run's pass
count never parses.** Not once.

Widened to seven days: **325 occurrences, 0 with a parseable second-run pass count.** Unanimous,
no exceptions.

Both runs issue the identical command (`timeout 240 bun test --timeout 20000 2>&1`) and the *first*
run parses fine, so this is not a parser bug. **I initially wrote that the re-run is killed at its
240 s cap; the 325/0 unanimity argues against that** — a load-dependent kill would let some
quiet-period run through. The cause is not established. Candidates: a shorter tool-level timeout on
the second `callTool` than on the first, or the summary never reaching the captured stream on that
path. What is established is the effect, and the effect is structural:

```ts
if (passRegressed && basePass !== undefined && curPass2 !== null && curPass2 >= basePass)
  passRegressed = false;
```

`curPass2` is null in every observed case, so **this un-latch can never fire**. And
`testOk = confirmedNewTest.length === 0 && !passRegressed` — so a draft that trips the pass
regression is rejected even when the re-run sheds *all* of its failures.

**134 of 3,008 compose reports (4.5%) were rejected carrying `PASSING TESTS DISAPPEARED`.** Some
fraction are genuine — a draft that breaks module load really does delete coverage — and the
un-latch exists precisely to rescue the rest. Since it never fires, **none are rescued**. I cannot
say how many of the 134 are false; I can say the mechanism that would tell them apart is dead.

**The generalization, now with two independent instances:** a control built to correct for noise is
disabled by the very conditions that produce the noise. Fix 0 is the flake re-run that reproduces
load-induced timeouts because both runs share the load. This is the pass-count un-latch that cannot
parse a re-run the load already killed.

**Not filed as a fourth gap**, deliberately and for the same reason as the `runner_up` finding: the
lane holds one slot, load is 23, and three grounded gaps are already queued and unserved. Adding a
competitor now costs more than it buys. It is next in line if fix 0 lands.

---

# Addendum 4: I was reading the wrong loadavg all session — and it makes fix 0 sharper

Every load figure in this report and in the session that produced it (`~16`, `~20`, `~29`) came
from the **host's** `uptime`. The substrate does not run on the host. It runs in a qemu VM
(Docker Desktop), and reads its own `/proc/loadavg`:

| layer | load | cores | ratio |
|---|---|---|---|
| host `uptime` | 28.42 | 16 | 1.78 |
| **substrate `/proc/loadavg`** | **16.88** | **14** | **1.21** |

The host figure is inflated by things the substrate has nothing to do with — Firefox, the Claude
processes, and a `wf-recorder` screen capture that has been running for **4 days at ~142% CPU**.

This is my own most-repeated error class, again: **verify at the layer that consumes the artifact.**
The consuming layer for a 20-second test budget is the VM's scheduler, not the host's. My standing
rule ("never judge a fix at loadavg > ~10") was written about the host and I applied it to the
substrate without re-deriving it.

**Nothing measured is invalidated.** The corpus result (74/454 vs 1005/2551, OR 3.34) is keyed on
the *presence of a timeout*, not on any load reading. The instance (20005.79 ms against a 20000 ms
budget) is a fact about the test run. What changes is the attribution, and it changes for the
better.

## The calibration band

`system-load.ts` already has a saturation guard:

```ts
export const SATURATION_MULTIPLE = 3;
return load > cpuCount * SATURATION_MULTIPLE;   // fires above 42 on this box
```

The observed timeout happened at **16.88**. So there is a band — roughly **1.2× to 3.0× cores** —
where the box is loaded enough to blow a 20-second test budget but *not* loaded enough for the
system to consider itself busy at all. Every false refusal measured here lives inside it.

That explains why an existing guard doesn't prevent this, and it argues specifically **against**
"raise the threshold" as the repair: the guard is answering a different question (should I start
heavy work?) from the one that matters here (can I trust a 20-second budget right now?). Labeling
the failure as `environment`, so the already-built exemption applies, remains the correct fix.

The gap record has been corrected in place — the wrong figure replaced in the evidence section, the
retraction and this band analysis appended, anchor and op verified intact afterward.

---

# Addendum 5: the fix for false charging was falsely charged, and its own failure improved it

Fix 0 was picked at ~12:32 and produced a compose report at 12:33. The drafter reproduced the op
**exactly** and applied it cleanly:

```
applied = [{'path': '…/feature-compose.ts', 'kind': 'edit', 'ok': True,
            'span': {'start_line': 6047, 'end_line': 6048}}]
verify  = [{'vessel': 'repos/development-vessel', 'errors': 'verify',
            'exit_code': None, 'ok': False, 'output': ''}]
```

**Empty output, null exit code — the verify did not run.** An environment failure of the purest
kind, classified `"fix"` because `classifyEnvironmentFailure` saw only `cutovers`, which were `[]`.
The gap now carries `failed_attempts: 2` against a single proposal on disk, so one non-merit
refusal was charged twice.

So: **the fix for environment-failures-charged-as-fix-failures was refused by an environment
failure charged as a fix failure**, and penalised 0.2 of rank for it. Third instance of the
self-protecting class this session, and the first observed acting on its own repair.

## The failure improved the fix

My original op matched a timeout string. It would **not** have caught this case — there is no
timeout text in an empty string. The correct predicate is *unverified*, not *timed out*, and this
file already draws that distinction one screen above, in the detail it builds for exactly this case:

> `TYPECHECK NOT ANSWERED (TC_EXIT=…) — the check did not complete, so this is UNVERIFIED, not
> proven broken. Failing closed is correct (an unverifiable edit must not land), **but do not read
> this as a defect in the draft**`

The code writes that sentence and then discards the distinction when computing `failure_kind`. The
op is now:

```ts
if (verify.some((vr) => !vr.ok && (vr.exit_code === null || !vr.output ||
    /timed out after \d+\s*ms/i.test(vr.output)))) return "env_verify_unanswered";
```

Three cases, one expression: the check never answered, the verify never ran, or a test timed out.
A genuinely refuted draft has neither a null exit code nor empty output — a real typecheck failure
carries TS error text, a real test failure carries failing test names — so this does not uncharge
drafts that were actually refuted. Failing closed is unchanged: `ok` stays false, `rolled_back`
stays true. **Only the charge moves.**

This is the loop working in the small: the system's own attempt exposed a case my predicate missed,
and the gap is better for it.

## Capacity is the dominant constraint, by the lane's own measurement

From a comment in `gap-to-feature.ts`, measured over 48 h: **4,482 picks, 3,699 of them (82.5%)
ending `verdict=BUSY stage=capacity`.** Fewer than one pick in five ever reaches a composer. That
reframes the whole session's "why hasn't it composed" question — and it is a resource decision, not
a defect, which is why I have filed nothing about it.

## Fair-window test, in flight

Container load has fallen to **5.66** — the first window this session inside my own rule for judging
a fix. I re-dispatched fix 0 as a targeted `pointer.gap_id` compose. This is deliberately **not** a
bypass of any gate: the system drafts, applies, typechecks, tests and gates its own change; the only
thing being bypassed is the admission ranking that its own false charge had demoted. If it lands
here, the earlier refusals were environmental, as claimed. If it fails on the merits at load 5.66,
my diagnosis was wrong and the record should say so.

---

# Addendum 6: the control fired, and the penalty reached its cap

## The diagnosis is confirmed

Re-dispatched at container load **4.40** — the first fair window of the session. Same gap, same op:

```
verify = [{'vessel': 'repos/development-vessel', 'errors': 0,
           'exit_code': 0, 'ok': True, 'output': '… TC_EXIT=0 …'}]
```

**The identical change that produced an empty verify under load verifies clean at low load.** That
is the control this whole line of reasoning needed, and it exercises the same path as the value
under test. The earlier refusals were environmental, not defects in the draft.

## It was then refused by a different gate, on a false premise

```
semantic_gate = {addresses: false, on_live_path: false,
  reason: "The patch does not modify the behavior of 'classifyEnvironmentFailure' directly
           and is not executed in the context of the environment failure classifications…",
  suspected_real_location: "classifyEnvironmentFailure in …/feature-compose.ts"}
```

Checked against the **runtime** file (not my local checkout, which is ~30 lines behind):

| | runtime line |
|---|---|
| `function classifyEnvironmentFailure` | 6039 |
| anchor `env_cutover_race` | 6047 |
| **applied span** | **6047–6048** |

The edit landed inside the named function. `addresses: false` is false on a checkable fact, and the
same object names `classifyEnvironmentFailure` as the `suspected_real_location` — it contradicts
itself in one breath.

**But the objection underneath it is fair**, and I have taken it rather than overridden it: that
version read `verify` as a closure variable inside a function whose contract is its `cuts`
parameter. The op now edits the **call site** (runtime line 6312, verified unique), where `verify`
is a local in the same scope and `classifyEnvironmentFailure` is untouched — which dissolves the
objection instead of arguing with it. Second time this session that a gate's pushback improved the
patch.

## The penalty is now capped

`failed_attempts: 4`. Since `penalty = min(fa * 0.1, 0.4)`, fix 0 now carries the **maximum**
demotion — roughly 0.44 against a field of 0.84–1.125 — so the autonomous picker can no longer
reach it at all.

**None of the four charges was on the merits:**

| attempt | outcome | on the merits? |
|---|---|---|
| ~12:15 | (charged at file time / surprise weight) | no |
| 12:33 | verify never ran — `output: ''`, `exit_code: null` | no |
| 12:44 | verify **passed**; semantic gate refused on a false premise | no |
| — | (fourth charge, same window) | no |

So the gap that repairs false charging has been falsely charged to the cap, and thereby removed
from autonomous reach. The self-protecting loop is closed, observed end to end, on the repair
itself.

**This is the "proven incapable" test from the standing directive, and the answer is precise
rather than binary.** The system *can* draft this change — it did, exactly, twice. It *can* verify
it — it did, clean, at load 4.40. What it cannot now do is *select* it, because the scoring it
uses to select was corrupted by the very defect the change repairs. A targeted `pointer.gap_id`
dispatch bypasses ranking and **nothing else**: the drafter, the typecheck, the tests, the semantic
gate and the cutover all still run and can still refuse. That is the intervention — restoring
reach, not substituting judgement.

---

# Addendum 7: correction — the lane was landing the whole time

At 12:09 I reported "nothing has landed in development-vessel in 40 minutes." **That was wrong.**
I ran `git log --since` against my **local checkout without fetching**, and the substrate pushes to
`origin/dev`. My own consuming-layer law, missed for the third time this session.

Against `origin/dev`, autonomous landings in three hours:

| time | commit | |
|---|---|---|
| 10:56 | `b8bad83` | substrate-authored, mitosis cutover |
| 11:40 | `93d551f` | substrate-authored, `recommit-interactor-signals-…` |
| 12:18 | `19e0077` | substrate-authored, `route-edit-3e9f4728` |
| 12:48 | `30849ec` | substrate-authored, `route-edit-08187b1b` |

Four autonomous commits, **no operator hands**, at intervals of 44 / 38 / 30 minutes. `93d551f` at
11:40 falls *inside* the window I declared empty.

This materially changes the picture I gave: the lane is not stalled. It converts roughly every half
hour, and the interval is shortening rather than growing. What is starved is not the lane — it is
the specific gaps I filed, which lose on rank.

## And the 12:48 landing is what killed my dispatch

The empty response from my second targeted dispatch was not a refusal and not a timeout. `30849ec`
cut over development-vessel at 12:48, and a cutover kills requests in flight *to* the vessel being
cut over — the same self-edit interference recorded this morning against goal-host. Re-dispatch is
the workaround; drain-before-restart is the fix.

The cutover also shifted the file: my anchor moved from line 6312 to 6313. It still matches, because
it is a **verbatim string and not a line number** — which is exactly why the anchor discipline is
worth the effort. A line-numbered op filed ten minutes earlier would now be silently wrong.

---

# Addendum 8: my own evidence was degrading the drafter

The next attempt failed on the merits — and the merits were mine.

```
op_count = 3
applied  = [ span 6344…, span 82…, … ]      all "repaired": true
verify   = ok:false, exit_code: 2            (typecheck error)
```

The gap asks for **one** op at one unique anchor. The composer emitted **three**, including an edit
at **line 82** — the imports region — and all three had to be anchor-`repaired`, meaning none
matched cleanly.

The cause is the gap record itself. As I accumulated evidence, the summary grew to **5,623
characters** and came to quote six separate code fragments — the anchor, the replacement, the
`bumpFailedAttempts` call site, the `TYPECHECK NOT ANSWERED` string, `min(fa*0.1, 0.4)`, and
`joinDecisionOutcome(…)`. A drafter reading that cannot tell which quoted code is an *instruction*
and which is *evidence*. Earlier versions of the same gap, at 3,066 characters with one quoted
fragment, produced `op_count = 1` and applied exactly at the intended span.

**The evidence that makes a gap convincing to a human reviewer is the same text that makes it
ambiguous to the drafter.** Those are opposing pressures on one field, and I had been optimising
only the first — every addendum in this report made the record better and the instruction worse.

## Pre-registered test

Summary cut from **5,623 → 1,320 characters**: instruction first, one quoted anchor, one quoted
replacement, an explicit "one op, one line, one file. Add no imports. Touch no other function," and
the reasoning compressed to a single paragraph. All the evidence now lives in this report, pointed
to by `classification_metadata.evidence_ref`, plus `max_ops: 1` and `single_file: true`.

**Prediction, recorded before the result: `op_count` returns to 1.** If it does, gap verbosity is a
causal input to apply drift and the gap store needs the instruction/evidence split as a structural
property, not as operator discipline. If `op_count` stays at 3, verbosity is not the cause and this
paragraph is wrong.

This also gives the standing division of labour a sharper edge than "operator supplies verbatim
anchors": **the operator supplies exactly one anchor and nothing else that looks like code.**

---

# Addendum 9: fix 0 landed, and the prediction held

## The prediction

Recorded before the result: *cutting the summary from 5,623 to 1,320 characters returns `op_count`
to 1.* 

**Confirmed.** `git show --stat 9822a8e`:

```
 src/resolvers/feature-compose.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

One file, one line. The same gap, same anchor, same target, same composer — only the record's
verbosity changed, and `op_count` went 3 → 1. **Gap verbosity is a causal input to apply drift.**
The instruction/evidence split belongs in the gap store as structure, not in operator discipline.

## The landing, verified at every layer

| check | result |
|---|---|
| landed diff | `1 file changed, 1 insertion(+), 1 deletion(-)` |
| byte-comparison of the landed line to the spec | **exact match** |
| pushed to remote | `9822a8e` on `origin/dev` |
| attribution method | `git log -S '<symbol>'`, **not** `git log -- <path>` |
| mirrored to runtime | present at `/vessels/development-vessel/…:6344` |
| **deployed** | `ExecStart=bun /vessels/development-vessel/src/index.ts`, MainPID started **13:07:40**, after the 13:07 cutover |

```
9822a8e Substrate Autonomous 13:07
  substrate-authored: apply a-load-induced-verify-timeout-is-charged-to-the-drafter-as-a-fix-failure-compose-report via mitosis cutover
```

Drafted, applied, typechecked, tested, semantically gated, committed, pushed, mirrored and restarted
into — by the substrate. The operator supplied a gap record containing exactly one anchor and one
replacement. **No operator hands on the code.**

Note this vessel runs `src/` directly, so the mirror *is* the runtime artifact — unlike goal-host,
which imports a package and loads `dist/`. The consuming layer differs per vessel; it was checked
here rather than assumed.

## What it took, honestly

Seven attempts. The failure modes, in order, and none of the first five were about the change:

1. excluded from admission entirely (`no_groundable_target` — no `edit_site`)
2. verify never ran (`output: ''`, `exit_code: null`) — charged as a `fix` failure
3. semantic gate refused on a false premise, though its underlying objection was fair
4. `BUSY stage=capacity`, repeatedly — 82.5% of all picks
5. dispatch killed mid-flight by an unrelated cutover of the vessel being dispatched to
6. **my own evidence** inflating the op count to 3 and breaking the typecheck
7. landed

Two of those seven were the system's judgement improving the patch: the empty verify proved my
timeout-string predicate too narrow, and the semantic gate's objection moved the edit to the call
site where `verify` is a local rather than a closure read. **The final patch is better than the one
I filed, and both improvements came from refusals.**

## Still to verify: does it do anything?

Landing is not working. The claim under test is that a compose whose verify does not answer now
receives `failure_kind: "environment"` and is therefore **not** charged by `bumpFailedAttempts`.
That requires observing the next environmental refusal in the wild — a `verify` with empty output
or a null exit code, followed by a gap whose `failed_attempts` does **not** increment. Until that is
observed, this is a landed change with an untested consequence, which is precisely the hollow-green
class this whole line of work exists to close.

---

# Addendum 10: consequence, tested as far as execution allows

No unanswered-verify compose occurred in the 50 minutes after landing — consistent with the
mechanism itself, since environmental failures cluster at high load and load stayed low. Rather than
wait idle, both ends of the chain were tested by **running the system's own code**, not by reading
it.

## End one — the deployed predicate, against real recorded failures

The predicate was extracted **verbatim from the deployed file** (`sed -n 6344p` on
`/vessels/…/feature-compose.ts`) rather than retyped, then run in the container's own `bun`:

```js
const PRED = (verify) => verify.some((vr) => !vr.ok && (vr.exit_code === null || !vr.output
  || /timed out after \d+\s*ms/i.test(vr.output)));
```

| case | expected | got |
|---|---|---|
| 12:33 real recorded failure — verify never ran (`output:""`, `exit_code:null`) | fire | **fire** |
| 11:58 real recorded failure — git test at 20005.79 ms | fire | **fire** |
| negative control — genuine typecheck failure (`TS2322`, `exit_code:2`) | silent | **silent** |
| negative control — genuine test failure (`1 fail`, real assertion) | silent | **silent** |
| negative control — verify passed | silent | **silent** |

The two positives are the *actual recorded verify objects* from this session's own refusals, not
constructed examples. The three negatives are the cases where charging the drafter is correct.

## End two — the real downstream consumer, executed

`isNonAttemptComposeResult` is exported, so it was called directly rather than reimplemented:

| input | expected | got |
|---|---|---|
| `{failure_kind:"environment"}` — what the fix now emits | exempt | **exempt** |
| `{failure_kind:"fix"}` — a genuine refutation | charge | **charge** |
| `{verdict:"BUSY",stage:"capacity"}` — pre-existing exemption | exempt | **exempt** |
| `null` | charge | **charge** |

## What remains unverified, stated narrowly

The **middle link** has been read but not run: that a live compose actually writes
`failure_kind:"environment"` into the body the caller receives as `lastBody`, and that line 3686 is
the path taken for this failure mode. Both ends execute correctly; the join between them is a code
read.

So the honest status is: **predicate proven, consumer proven, wiring inferred.** That is stronger
than "landed" and weaker than "works," and the difference is exactly the distinction this whole
line of work exists to enforce — a change that typechecks and passes its gates is not yet a change
that does something. It will be settled by the first environmental refusal in the wild leaving
`failed_attempts` unchanged; a snapshot of that counter across 2,908 gaps is stored and the watcher
is re-armed.

---

# Addendum 11: the verbosity result replicated — and anchor repair defeated a unique anchor

## Replication

Fix 1 (`compose-grades-…`, a different gap on a different target) was rewritten to the same
1,283-character single-anchor template. **`op_count = 1`.** The verbosity finding is now a
replication rather than a single before/after: 5,623 chars → 3 ops; 1,320 chars → 1 op (landed);
1,283 chars on a different target → 1 op.

## But it was refused, and the reason is worse than a refusal

```
applied = [{path: '…feature-compose.ts', ok: true, "repaired": true,
            span: {start_line: 6341, end_line: 6341}}]
verify  = exit 2
  src/resolvers/feature-compose.ts(6341,47): error TS2304: Cannot find name 'landedVessels'.
```

The anchor was at **6253**, exact and unique:

```ts
        success: verdict === "FAVORABLE",          // 6253 — the compose GRADE
```

The edit landed at **6341**:

```ts
      ok: effectiveVerdict === "FAVORABLE",        // 6341 — the report's OK FIELD
```

`"repaired": true` means the apply did not find its anchor and **relocated the edit**. It
fuzzy-matched on the shared tail `=== "FAVORABLE",` and rewrote a semantically different statement,
in a different scope, in a different object.

**The anchor discipline this session has leaned on does not protect against this.** Uniqueness was
verified — `grep -n` returns exactly one match in the runtime file. Uniqueness is not the property
that matters when the matcher is allowed to relocate on failure.

## Why this is a near-miss, not just a failed attempt

The typecheck caught it **by luck of scope**: `landedVessels` is declared at 6245 inside the
emission block and is not visible at 6341, so `TS2304` fired. Had the relocated target happened to
sit where the identifier *was* in scope, the edit would have typechecked, passed shape-dispatch,
passed tests (nothing asserts on that field), and silently changed the report's `ok` field — the
field that determines what the compose reports about itself.

That is the partial/misapplied-edit class, which a diff-reading judge catches least, landing on the
one field whose corruption would make every subsequent compose report unreliable. The gate that
saved it was a scope accident.

## Status

Fix 1 remains open and unlanded. The op is correct; the apply path moved it. I am not re-dispatching
it unchanged — the same relocation would recur — and I am not hand-landing it. The next step is to
determine whether the repair path can be made to refuse rather than relocate when an exact anchor is
present in the file, which is a defect in the apply mechanism rather than in this gap.

---

# Addendum 12: the apply-path defect blocked its own repair three times

The repair for the anchor-relocation defect was filed as a grounded single-op gap and dispatched
three times. **Every failure was at the apply stage; none was on the merits of the change**, which is
one line of prompt text.

| # | how it was specified | outcome |
|---|---|---|
| 1 | anchored on the whole template literal | drafter could not reproduce backticks and `${}` verbatim; matched near line 1; `TS1109` |
| 2 | replacement contained its own anchor | `old_string and new_string are identical — this op is a no-op` |
| 3 | correctly specified, plain-prose anchor, old not a substring of new | `repaired: true`, relocated onto `if (dryRun) {` at line **4456**; `TS1109` at 4458, `TS1005` at 6377 |

Attempts 1 and 3 failed **by the very defect the change repairs**. The blind-edit repair
mislocalizes the fix for the blind-edit repair.

## Two findings about the gap-authoring channel

Both are operator-side, and both were invisible until they broke something:

- **A verbatim anchor containing template-literal syntax is not safely quotable.** Backticks,
  interpolations and escape sequences cannot be reproduced by the drafter, and the failure mode is
  not "no match" — it is a match somewhere else. The anchor discipline that has worked all session
  holds only for plain code lines.
- **An insertion must not be expressed as "replace A with B" where B contains A.** The drafter
  collapses it to a no-op. Make the old text strictly not a substring of the new text.

## The intervention, and why it is not hand-completion

Three attempts, two failing by the defect under repair, is the directive's *proven incapable*
condition — narrowly: the lane cannot land this because its edit-application is the broken thing.
Fixing it restores the lane's ability to land its own work. Leaving it would mean every future
correctly-specified op is one scope-accident away from landing on the wrong statement.

The change is one line of **prompt text** — no gate, no threshold, no control flow. It supplies
`effOld`, already in scope, to a model that was being asked to re-find a target it was never shown.

**Verified in an isolated worktree at container load ~4, against an origin/dev baseline run in the
same worktree at the same load:**

| check | result |
|---|---|
| `tsc --noEmit` | clean |
| `shape-dispatch-check` | OK — 250 advertised, 253 dispatch, all agree |
| diff vs origin/dev | 1 file, 1 insertion, 1 deletion |
| tests with the change | 19 failures |
| tests at baseline, same worktree and load | 22 failures |
| **failures present with the change and absent at baseline** | **0** |

The 3-failure difference is flake in my favour and is **not** claimed as an improvement.

## Status: committed locally, NOT pushed

`65c3a43` is committed on `dev` in the local checkout. **The push was blocked by the permission
classifier and I did not work around it.** The change is verified and recorded but not live:
origin/dev does not have it, the runtime does not have it, and the defect remains active. Landing it
needs operator approval for the push.

---

# Addendum 13: fix 1 landed too — and my first reading of its effect was wrong

## Fix 1 is live

While I was working the apply-path repair, the lane landed the grading change:

```
459bb09 Substrate Autonomous 14:16
  substrate-authored: apply route-edit-caf3d5c0-compose-report via mitosis cutover
```

Runtime line 6253 now reads:

```ts
        success: verdict === "FAVORABLE" && landedVessels.length > 0,
```

Attributed by `git log -S` on the symbol. Deployed: `development-vessel` MainPID started
**15:59:46 UTC**. So **bootstrap step "grade on landing" is in the runtime** — the compose grade now
requires landing evidence, not a clean gate verdict.

Note it landed under gap `route-edit-caf3d5c0`, not under the gap id I filed it as. The change is
identical and the symbol attribution is unambiguous, but the gap→commit link is not the one I
authored, which is worth remembering before treating gap ids as provenance.

## RETRACTION: the effect I measured was not the effect

I first split the day's grades at the **commit** time (14:16) and reported the success rate falling
9.6% → 3.3%, in the predicted direction.

**That was wrong.** Splitting at the **deployment** time instead:

| split at process start 15:59:46 | rows | success | rate |
|---|---|---|---|
| before | 186 | 16 | 8.6% |
| after | **0** | 0 | — |

The latest graded row in the store is `15:59:42.888`; the process carrying the change started at
`15:59:46`. **Not one compose has been graded by the new code.** Every row I had placed in the
"after" bucket was still graded by the old binary, so the 9.6% → 3.3% movement was pre-change noise
and is retracted.

This is the same error class as this morning's step-1 retraction, in a new costume: attributing an
effect to a change before the consuming layer actually had it. **A commit is not a deployment**, and
the split point for any before/after must be the process start time, not the commit timestamp.

Caught within minutes only because the deployment check (`ExecMainStartTimestamp`) was run at all.
Had I published the 3.3% figure, it would have been a fabricated confirmation of my own prediction —
the most dangerous kind, because it pointed the way I expected.

## Honest status of both fixes

| | landed | deployed | consequence observed |
|---|---|---|---|
| fix 0 — environment label | `9822a8e` 13:07 | yes | **no** — no unanswered verify has occurred since |
| fix 1 — grade on landing | `459bb09` 14:16 | 15:59:46 | **no** — zero graded rows since deployment |

Both are live. Neither has yet been shown to do anything. The predictions are on record and
falsifiable: fix 0 predicts an environmental refusal that leaves `failed_attempts` unchanged; fix 1
predicts the measured `feature_compose` success rate falls, since most composes do not land.

---

# Addendum 14: the admission fix is live, tracked nowhere — and the system had already diagnosed why

## State of the change

The admission fix (prose-scan in `citedExistingFile`) is **running in production and exists in no git
repository.**

| location | has the change |
|---|---|
| `/vessels/development-vessel` (runtime mirror, **not a git repo**) | **yes** — mtime 16:16:33 |
| running process | **yes** — MainPID started 16:17:30, after the mirror write |
| `/workspace/git/super-repo/repos/development-vessel` (the clone the lane pushes from) | **no** |
| `origin/dev` | **no** |
| `/workspace/git/compose/fc-mtq0fuuy-u5ywxz/development-vessel` (compose worktree) | yes |

The cutover logged `verdict=FAVORABLE`, `push_ready=direct`, mirrored to live and restarted the
vessel. The gap remains `status: open`, `failed_attempts: 2`, with **no** `pending_outcome_verification`
and **no** `landed_commit`. Pull-sync mirrors clone → `/vessels`, so the next sync silently reverts
live code that no diff, no revert and no author can account for. None has run yet.

This is the memory-flagged hazard, observed directly: **the mirror is the runtime artifact, so an
uncommitted compose edit is not "one restart from live" — it is already live.**

## The system had already found it, and escalated

Immediately after that cutover:

```
[gap-escalation] uiQuestion_write accepted for hopeless gap
  the-freshness-gate-checks-the-runtime-tree-but-the-commit-lands-in-the-push-clone
```

Its own summary is a better analysis than mine:

> Stagings **accumulate into the shared working tree** over minutes, then cutovers are processed as a
> **batch**. Each cutover compares its own `staged_base` against a tree that now holds whichever
> stager wrote last, so all but at most one are stale **by construction**. Five stagings, four
> refusals, zero commits.
>
> **Self-collision is possible and was observed.** The "drifted" content was MY OWN one-line fix from
> a previous attempt. … **successive attempts at the SAME patch collide identically. So a retry loop
> on one gap is sufficient to produce this, with no other session involved.**
>
> Serialising cutovers would not help: the staleness is created at STAGING time. Each compose must
> stage into its OWN worktree.

It correctly rejects the obvious fix (repair the freshness gate) as insufficient — that only makes
the collision visible — and names the real one (a worktree per compose id), judged it beyond its
reach, and asked a human.

## The correction this forces on my own method

**My retry loops were manufacturing the failures I was diagnosing.** I re-dispatched fix 1 three
times, the apply-path repair three times, and the admission fix repeatedly, each attempt staging into
the same shared tree. By the system's analysis, that is sufficient on its own to produce
COMMIT-TREE DRIFT, stale bases, and cutovers that mirror without committing — no concurrency with any
other actor required.

So an unknown share of this session's "the lane cannot land it" evidence is **self-inflicted**. The
anchor-relocation finding stands on its own (it is visible in the applied span and the typecheck
error), but the surrounding failure counts are contaminated by my own retry pressure and should not
be read as a clean measurement of lane capability.

**Method change, adopted now: do not retry a dispatch on the same gap in a tight loop.** One
attempt, read the result, and if it fails for a staging/tree reason, wait for the tree to settle
rather than immediately re-staging on top of my own previous attempt.

The system taught me this, from a gap it had already filed. That is the loop working in the direction
that matters — and it is worth more than the fix I was chasing.

---

# Addendum 15: the causal link, confirmed — and it runs the wrong way

The consequence test for fix 1 finally produced a measured causal linkage between a deployed change
and an observable effect. **The effect is harmful, and the change was mine.**

## What the control found

Testing whether pre-fix grades were decoupled from landing, I first measured: of 186 pre-deploy
rows, 16 were graded `success: true` and **every one** had `landed_vessels` empty. Before publishing
that, the control:

| control — is `landed_vessels` ever populated? | |
|---|---|
| feature_compose rows carrying the field | **1,034** |
| rows where it is **non-empty** | **0** |

So an empty value carries no information, and the 16/16 finding is an artifact. **Withdrawn.**

## The real finding, which is worse

`landedVessels` is computed by:

```ts
.filter((c) => (c?.result as Record<string, unknown> | undefined)?.applied === true)
```

**The string `applied: true` does not occur anywhere in `vessel-mitosis-cutover.ts`** — zero
occurrences. That field is only ever set to `false` on refusal paths; the success path returns
`shape: "cutoverApplied"` carrying `new_git_sha` and `push_status` instead.

So `landedVessels` is **empty by construction**, always. Which means the change I specified and that
landed as `459bb09`:

```ts
success: verdict === "FAVORABLE" && landedVessels.length > 0,
```

makes `success` **permanently false**. The compose grade went from a weak signal (the gate verdict,
~8.6% true) to **no signal at all** — a constant. The learning loop now receives only β updates for
`feature_compose`. That is strictly worse than what it replaced, and it is live.

## My error, precisely

I wrote in the gap that `landedVessels` "is already persisted into this same trace as
`metadata.landed_vessels`", offering that as evidence the data was available. I verified the field
**existed**. I never verified it was ever **non-empty**. My own standing law — *a zero reads as "no
data", not "broken key"* — applied to the exact field I was building on, and I did not run it.

The `landed_vessels` metadata has been inert for its entire life, 0 of 1,034. Nothing noticed,
because nothing consumed it — until I made the grade consume it.

## The repair, filed

One line, at the same site, keyed on the field the cutover actually emits:

```ts
.filter((c) => String(((c?.result as Record<string, unknown> | undefined)?.new_git_sha) ?? "").length > 0)
```

This repairs both the inert metadata and the now-constant grade. Filed as
`landed-vessels-filters-on-a-field-the-cutover-never-sets`, grounded, single op, marked with the
severity. First dispatch was killed mid-flight by a cutover; **not retried in a tight loop**, per the
method correction adopted in Addendum 14.

## What this actually demonstrates

The session's causal chain is now closed, in the direction nobody wants but which is the only kind
that proves the instrument works: **a change was specified, landed autonomously, deployed, and its
effect on the environment was measured and found to be the opposite of the prediction.** The
prediction ("the success rate will fall, and that fall is the correction") was wrong in a specific,
checkable way — it falls to zero and stops carrying information.

That is worth more than a confirmation would have been. A confirmation at n=1 would have been
indistinguishable from noise; this refutation is structural, reproducible from the source, and was
caught by a control I nearly skipped.

---

# Addendum 16: a deterministic path that has never fired, and a self-sealing false closure

Two findings, both structural, both checkable.

## 1. The substrate has a deterministic edit path. It has never once run.

`feature-compose.ts` contains `synthesizeVerbatimEditOps(specText)`, which **bypasses the LLM
planner entirely** when a spec carries a verbatim old→new replacement:

```ts
const fences = [...specText.matchAll(/```[a-zA-Z]*\r?\n([\s\S]*?)```/g)]
if (fences.length !== 2) return null;
const hasAnchorCue = /(find|locate)\s+(this\s+)?exact\s+(anchor\s+)?text|exact\s+anchor|old[_\s]?string|anchor\s*:/i
```

On success it sets `plan = { summary: "deterministic edit synthesized …" }` and logs
`[decompose] deterministic verbatim-replacement synthesis applied`.

**That log line has zero occurrences in three days.** The path requires *exactly two fenced code
blocks* plus an anchor cue. Every gap I authored today used unfenced code and the phrase "This exact
line occurs once", which misses the anchor-cue regex — so every one fell through to the LLM planner.

That planner is what relocated an edit onto `if (dryRun) {` at 4456, onto
`ok: effectiveVerdict === …` at 6341, and what invented a vessel-name sanitizer. **The mechanism
that would have prevented all three exists, is wired in, and was never triggered — by me or by the
substrate's own gap authors.** No new machinery is needed; the format is.

## 2. The false closure is self-sealing, by a marker the gap never mentioned

The `landed-vessels-…` gap was closed citing commit `3ca47589` as a "verified ancestor of clone
HEAD". Re-opening it with full evidence, it **re-closed within 90 seconds**, twice. The chain:

1. A `gap-falsifier` auto-classified the gap `class1` and set its defect marker to
   `hardcoded_url = .map((c) => String(c.vessel ?? ""));` — the **adjacent line**, which this gap
   never mentions. The line I actually targeted is the `.filter(…)` above it.
2. `verifyGapCondition` reports the defect *absent* when that literal is missing from the file.
3. Commit `3ca47589` confabulated an edit to **that same adjacent line**, appending a sanitizer and
   removing the trailing `;` — destroying the marker literal.
4. Measured now: the marker literal is **absent** (0 occurrences); the real defect
   `?.applied === true)` is **present** (1 occurrence).
5. So the gap self-verifies as resolved, and every re-open is re-closed by
   `sweepPendingLandVerifications`, which runs at the head of every dispatch and keys on the pending
   sha's **ancestry**, never its content.

Re-opening required clearing `pending_outcome_verification`, `resolution` and `closed_at`
explicitly — metadata **merges** on write rather than being replaced, so a stale pending sha
survives an ordinary re-file and immediately re-closes the gap.

**A gap can therefore be permanently unfixable through the lane**: the defect is live, the marker
that would prove it is gone, and the store reports it fixed with a real commit sha attached.

Marker corrected to the defect itself (`?.applied === true)`); the gap now stays open. Next dispatch
returned BUSY and was **not** retried in a loop.

## What this changes about the minimum sequence

Item 1 of the sequence — a deterministic correspondence assertion — is **cheaper than stated**. It
is not "build a check"; it is "route exactly-specified gaps down a synthesis path that already
exists, and make the gap-authoring format produce it." The check that fails today is an LLM judge
returning `verified: true` for a change that did not occur; the deterministic alternative is already
in the file.

---

# Addendum 17: root cause found, one character landed autonomously, effect measured

## The root cause of every drafting failure today

`feature-compose.ts:3974`:

```ts
if (!(/REPLACE|WITH:|INSERT AFTER|ANCHOR/i.test(spec)) || spec.length > 3500) {
  const refined = await llmCallWithFailover(llmEndpoints, refineSpecPrompt(spec, …), model);
  spec = trimmed;                       // the caller's verbatim spec is OVERWRITTEN
}
```

The guard is meant to protect a spec that already carries an explicit anchor cue. The `||` clause
overrides that protection for **any** spec over 3500 characters — and `specFromGap` inflates every
gap spec with a ~40-line live-file grounding window, so the length clause fires routinely.
Measured: **`[spec-refine] applied` 15 times against 3 skips** in the 95 minutes before the fix.

Two consequences, both observed today:

- The composer received **LLM-invented JSON edit plans** whose `old_string`/`new_string` did not
  match the gap. One landed an unrequested vessel-name sanitizer on an adjacent line — the
  confabulated commit `3ca47589` that produced the self-sealing false closure.
- `synthesizeVerbatimEditOps`, which runs **later in the same function** (line 4019) and bypasses
  the LLM planner entirely for a verbatim replacement, has fired **zero times in three days** —
  because refinement destroys the fenced format it requires before it ever runs.

## The fix, and the causal chain

Filed as a one-character gap: `||` → `&&`, so refinement runs only when a spec is long **and**
carries no anchor cue. The substrate drafted, verified, gated, committed, pushed and cut over:

```
64968c1 Substrate Autonomous 20:05
  substrate-authored: apply spec-refinement-overwrites-a-verbatim-anchor-whenever-the-spec-is-long-…
```

Verified on `origin/dev` by `git log -S`, present in the runtime at line 3974, deployed —
`ExecMainStartTimestamp 20:05:08`.

**Effect, split at the process start and not the commit:**

| window | `[spec-refine] applied` | `skipped` |
|---|---|---|
| 18:30 → 20:05:08 | **15** | 3 |
| 20:05:08 → now | **0** | 2 |

83% of specs were being overwritten; none have been since. **n=2 after is small — Fisher's exact on
15/18 vs 0/2 is ≈0.1, not significant on its own** — but the mechanism is deterministic and read
from source: changing `||` to `&&` in that predicate cannot do anything else. Mechanism plus
direction, not counting alone.

That is the causal association this window was for: an action was taken, the substrate landed it
autonomously, and the environment changed in the predicted direction, measured at the consuming
layer.

## The prediction that FAILED

I predicted the synthesizer would now fire. **It did not** — still zero. The stored spec shows **5
fence markers** (an odd number) and is truncated at exactly 8000 characters, so the full spec
carries more than the two fenced blocks `fences.length !== 2` demands. `specFromGap` injects its own
fenced grounding block.

So the deterministic path remains unreachable **from the gap lane by construction**, for a second
and independent reason. Fixing the refiner was necessary and not sufficient. The next step is to run
the synthesis against the pre-grounding summary rather than the assembled spec — not attempted here,
and stated as the open item rather than implied as done.

## Also confirmed: the falsifier marker mechanism works when the marker is right

The gap carried `hardcoded_url = "|| spec.length > 3500"`. When the fix landed, that literal went
absent and the gap correctly self-verified as resolved — the `already_resolved` verdict I first read
as another false closure was, this time, accurate. The mechanism is sound; what failed earlier was
an auto-classifier choosing a marker from an adjacent line the gap never mentioned.

---

# Addendum 18: the loop closed — prediction, autonomous landing, measured effect

The grade repair landed autonomously as `28de0e8` (09-06 20:11), attributed by `git log -S` on the
predicate, deployed (`ExecMainStartTimestamp 00:26:50`). Runtime line 6248 now reads:

```ts
.filter((c) => String(((c?.result as Record<string, unknown> | undefined)?.new_git_sha) ?? "").length > 0)
```

## The measured consequence

| split at 28de0e8 | rows | graded success | non-empty `landed_vessels` | `success == landed` |
|---|---|---|---|---|
| before | 1083 | **80** | **0** | 1003 / 1083 |
| after | 26 | 4 | **4** | **26 / 26** |

Every post-fix success carries a real vessel:

```
2026-09-06T20:38:54  success=True  landed=['activity-api']
2026-09-06T20:46:13  success=True  landed=['activity-api']
2026-09-06T21:38:59  success=True  landed=['development-vessel']
2026-09-07T00:08:01  success=True  landed=['activity-api']
```

**Before the fix: 80 graded successes, not one of which coincided with a landing.** The 80
disagreements in that column *are* the false successes — the learning loop's entire positive signal
for `feature_compose` was decoupled from whether the repository changed. After: perfect agreement on
all 26 rows.

The decisive statistic is not the agreement rate (0 disagreements in 26 is *p*≈0.14 on its own) but
the field transition: `landed_vessels` went from **non-empty on 0 of 1,034 rows** to non-empty on 4
of 26, which is mechanistically explained — the old predicate tested `applied === true`, a string
that occurs zero times in the cutover resolver.

## What this closes

The chain the window was opened for, end to end and measured at the consuming layer:

1. Measured a defect: the compose grade was decoupled from landing (0 non-empty in 1,034).
2. Diagnosed the mechanism from source: the filter keyed on a field nothing sets.
3. Filed a one-line gap with the correct falsifier marker.
4. **The substrate drafted, verified, gated, committed, pushed and cut it over autonomously.**
5. The environment changed in the predicted direction, verified against a baseline established
   before the change and split at the process start.

Three of today's fixes now have this shape — the environment label (`9822a8e`), the spec-refine
guard (`64968c1`, 15 refinements → 0), and this one. Ten substrate-authored commits landed between
19:07 and 00:26 with no operator hands on the code.

## Still open, stated plainly

- The **deterministic synthesizer** has still never fired: `specFromGap` injects its own fence, so
  `fences.length !== 2` refuses. Fixing the refiner was necessary and not sufficient.
- The **blind-edit repair** still relocates; the fix is committed locally as `65c3a43` and unpushed
  (vessel-repo push denied).
- **Worktree-per-compose** remains the system's own escalated-as-hopeless item, and is what makes
  landings non-deterministic.
- The **admission prose-scan** fix is gone — it was live in the mirror, tracked in no repository, and
  erased by pull-sync exactly as predicted.

---

# Addendum 19: the 401 storm — measured, bounded, and root-cause NOT established

## Two different 401s, only one of which matters

- **Anthropic `authentication_error`** — 1–4 per hour, flat all day, against **330 successful LLM
  completions in the last hour**. Failover covers it. Chronic, minor, not the incident.
- **Identity vessel rejections** — accelerating: **2 → 276 → 872 → 1,226 per hour** from 21:00.
  Identity's own access log shows **22 rejections against 167 successes in 20 minutes (12%)**.

## It is load-bearing

`auth.ts` classifies a 401 as `transient: false`, so the request is **denied, never retried**. The
denied routes are core loop traffic:

| route | count (25 min) |
|---|---|
| `GET /v2/activities/templates?limit=100` | 29 |
| `POST /v2/activities/execution-traces` | 26 |
| `POST /v2/events/publish` | 25 |

**57 execution-trace writes were denied in one hour.** The trace store is therefore lossy right now,
which means every count taken from it today — including the grading measurements in Addendum 18 — is
an undercount of unknown size. One downstream failure is already in the log:
`[retire-sweep] template listing HTTP 401 at offset 0 — sweeping only what was fetched`.

## What it is not — ruled out by measurement, not assumption

- **Not a bad service key.** All five configured keys (`METABOB`, `GOAL_HOST_VESSEL`,
  `LOCAL_TOOLS_VESSEL`, `RIBOSOME_VESSEL`, `CONCEPT_DB`) are byte-identical, 160 chars.
- **Not intermittent rejection of a valid key.** That key resolved **200 on 30 consecutive
  attempts**.
- **Not a missing credential.** Controlled experiment: a request with no auth header returns 401 to
  the caller and produces **zero** identity warnings — activity-api rejects it before calling
  identity. My "empty credential" hypothesis was refuted by its own control.

## What it is — established by controlled experiment

A request carrying a **present but unknown** credential produces 401 plus **exactly one** warning:

| request | caller sees | identity warnings |
|---|---|---|
| no credential | 401 | 0 |
| bogus `ApiKey mb-notarealkey…` | 401 | 1 |

So all ~1,200/hour are callers presenting a credential identity does not recognise. Identity logs no
`user_id` for them, and rejects in 3ms.

## Why the caller cannot be named — the filed defect

The rejection log records `url` and `status` only, never *what* was rejected. A failure occurring
twenty times a minute is unattributable by construction. Filed as
`the-identity-rejection-log-never-records-which-credential-was-rejected`, grounded, single op: add a
3-character prefix and the length to that existing warning. Prefix leaks nothing — every valid key
shares it — while length and prefix together discriminate the remaining possibilities.

**Pre-registered prediction:** once it lands, the field will show either `eyJ` (a JWT presented where
an API key is expected — six unauthenticated WebSocket clients are connected) or a `mb-` key of
length 160 that identity nonetheless refuses, which would mean a second key exists outside
`/etc/substrate/env`.

## Unexplained and deliberately not claimed

`identity-vessel` has been running since **2026-08-27 — 11 days without restart**, while activity-api
restarted 8 times in the onset hour. That is the most conspicuous asymmetry around the 21:00 onset
and it is **not** established as causal.

---

# Addendum 20: the grade fix is landed, deployed, correct — and inert at the learner

Dispatch-and-observe, run on a fix already live. The prediction was that `feature_compose`'s
posterior would drift toward its true landing rate once `28de0e8` keyed the grade to landing.

**It has not moved at all.**

| `feature_compose` posterior | value |
|---|---|
| alpha / beta | 6.918 / 2.973 |
| n_observations | 64 |
| **last_updated_at** | **2026-09-06T10:42:06** |
| implied success rate | **0.699** |
| measured landing rate since the fix | **4 / 26 = 0.154** |

That timestamp is the same reading I recorded on the morning of 09-06. The arm has not updated in
over 36 hours, across a window in which 26 graded rows were emitted for it, 4 of them successes.

## The control rules out a global outage

| posteriors updated | rows |
|---|---|
| 2026-09-05 | 317 |
| 2026-09-06 | 429 |
| **2026-09-07** | **873** |
| 2026-09-08 | 27 |

The learner is alive and updating hundreds of rows a day. The freeze is **specific to the arm whose
grade was corrected**.

## What this means

`28de0e8` is landed, deployed, byte-correct, and verified at the emission site — the trace now
carries an honest `success` keyed to `new_git_sha`, and Addendum 18 measured that change (80
successes with zero landings before, 4 with 4 real landings after). **All of that is true and none
of it reaches the learner.** Nothing propagates the corrected grade from the trace into
`context_thompson_scores` for this arm.

So the arm still believes it succeeds ~70% of the time while its measured landing rate is ~15%, and
it will keep believing that regardless of what the traces now say.

This is the pasted capstone's item 1, sharpened by measurement: my earlier claim that
"grade means landing — done" was wrong at the layer that matters. Correcting *what is written* did
not correct *what is learned*. The reward key still points wherever it pointed on 09-06, because the
posterior is not reading the corrected signal at all.

**The honest ceiling on today's three landed fixes:** two of them (the spec-refine guard, the
environment label) act on execution and were verified by behaviour change. The third acts on the
learning signal and is inert. Landing is not working, and *measured effect at the emission site* is
not effect at the learner — a third distinct layer that this session's verification discipline had
not separated until now.

**This is precisely the loop the system should be able to run unaided:** dispatch a fix, observe the
consequence, discover the fix is inert, and file that. Every step of it was operator-driven.

---

## Addendum 21 — the pre-registered test resolved: the emitter landed, the chain closed, and the credit is discarded one layer below

**The emitter landed without operator hands.** `6fdcd71`, "substrate-authored: apply
route-edit-52c39f7c-narrowed via mitosis cutover", 2026-09-08 15:20:41, author `Substrate
Autonomous`. It carries exactly the single-line anchor form the gap specified. I did not notice at
push time and built `ae48c95` directly on top of it. The blind-edit repair fix therefore was *not*
the thing that unblocked the emitter — the substrate landed it on its own, before that fix deployed.
The three prior relocation failures were followed by an unaided success on the fourth attempt.

`origin/dev` has since advanced eight further substrate-authored commits past `ae48c95`, which
remains an ancestor.

**The chain from emitter to grader is closed and works.** dev-vessel restarted 22:31:42 carrying the
emitter. In the following 17 minutes, 4 (later 6) `feature_compose` executions ran, and every one
of them shows:

- `metadata.reached: false` — the emitter fires
- `tags: ["reach_graded:true","reached:false"]` — `2f01007` reads the field and writes a real verdict
- `[reach-patch] late reach verdict graded into posteriors {"activity_id":"feature_compose"}` in the log

Three landed fixes composing correctly, end to end. Both prior links are confirmed good.

**And the posterior did not move.** `feature_compose` still reads α=6.91796875 / β=2.97265625,
n_observations=64, `last_updated_at` 2026-09-06T10:42:06 — unchanged. Meanwhile 19 other posterior
rows updated in the same window, so the learner is live.

**Pre-registered prediction: FALSIFIED.** Item 1 of the minimum sequence was wrong. Emitting the
verdict is necessary and not sufficient; the defect lies below the propagation layer, exactly as the
pre-registration said it would if the posterior stayed frozen.

### Where the credit is discarded

`/vessels/activity-api/src/lib/posterior-update.ts:1178-1188`. The only write to
`context_thompson_scores` on the outcome path is guarded:

```
    !skipVariantUpdate &&
    !HOOK_SUBSCRIBER_PATTERN.test(activityId) &&
    trace.signature &&
    typeof trace.signature_version === 'number' &&
    (alphaDelta !== 0 || betaDelta !== 0)
```

`feature_compose` execution rows carry `signature: null`. The guard is false, the write is skipped,
**nothing throws**, and control returns to a caller that logs success.

Three separate reasons this is invisible from inside:

1. `execution-traces.ts:5267` calls `applyOutcomeToPosteriors(...)` **without awaiting it** —
   fire-and-forget with a `.catch()`. The success line at 5291 runs synchronously right after
   dispatching the promise, so it logs "graded into posteriors" regardless of outcome. Measured:
   5,546 claimed successes in 24h against **0** `applyOutcomeToPosteriors failed` warnings — the
   function genuinely is not throwing, it is silently declining.
2. `reach_graded:true` is stamped on the authoritative row **before** the credit is applied
   (5258-5262, deliberately, as a double-grade guard). A row whose write is then skipped is
   permanently marked graded and can never be re-credited.
3. `computeDeltas(success=false, failureMode=null)` returns `{α:0, β:1}` — a full penalty. The delta
   is non-zero and correct. Nothing anywhere reports that a correct non-zero delta was computed and
   then dropped.

### The discriminating controls

- **org_id — refuted.** Compose rows are `organizations:substrate`; so are all 19 rows that moved,
  and so is the frozen row. Not the discriminator.
- **signature — confirmed.** `ribosome-extract`, whose posterior *did* move in the same window,
  carries `signature: "ad1543c893d377fc"`, `signature_version: 1`. `feature_compose` carries null.
- **datetime comparison — instrument error caught by control.** `executed_at > '<string>'` does not
  compare in SurrealDB 2.3.3; it matches every row. A year-2099 bound returned the full 41,974-row
  table. First reading of "41,972 executions since deploy" was the whole table and was retracted
  before use. `type::datetime(...)` fixes it; controls then return 0 for 2099 and the full table for
  2020. Add to the false-zero list — this one is a **false-everything**.

### This is a regression, not a design gap

| window | compose rows | with signature |
|---|---|---|
| before 2026-09-06T10:42:07 | 994 | 28 |
| after 2026-09-06T10:42:07 | 572 | **0** |

Signature emission for `feature_compose` went to exactly zero at the freeze boundary. The frozen row
carries `context_bucket: 57cffe5dcd63b199`, so this arm was keyed and credited normally until
something stopped populating the field. The posterior did not freeze because grading broke — grading
broke because the **key** stopped arriving. The freeze timestamp is not when the learner stalled; it
is the timestamp of the last execution that still carried a signature.

### Corrected minimum sequence

The first three items are now landed, deployed and confirmed composing. The new item 1 is upstream of
all of them:

1. **Restore signature emission on the `feature_compose` path** (regressed 2026-09-06T10:42). Without
   the key, every downstream grading fix is inert by construction.
2. Make the discard observable: `applyOutcomeToPosteriors` computing a non-zero delta and then
   writing nothing must log, and the caller must await it before claiming success. Today a correct
   delta is dropped in silence and reported as a grade.
3. Move `reach_graded:true` to *after* a confirmed write, so a skipped write does not permanently
   strand the row.

Item 2 is the general defect and item 1 is one instance of it. Any arm whose signature stops arriving
goes silently un-credited and reports full success while doing so — and the only way I found this was
by checking the row rather than believing the log line. **A channel's own reporting is not evidence
about the channel**, for the fourth time this session.

---

## Addendum 22 — what deployed at 10:42: the killer commit found, and the restore filed

**The regressing change is `3d648ad` in goal-host-vessel** — substrate-authored, landed
2026-09-06 10:42:00 UTC, deployed by the goal-host restart at 10:42:33. One line: the edit-intent
satisfier trace switched from its own id namespace (`feature_compose:<sha>`) to reusing the engine's
`exec_…` execution_id. The bracket closes exactly: last signed execution 10:42:05, restart 10:42:33,
first null row 10:43:16.

**Mechanism, read at the consuming layer.** The signed rows were never written by the thin
`POST /executions` path at all — they are a different record entirely (26 fields vs 15, two
writers). The rich trace flows goal-host → `TranslatingTraceSink` → `POST
/v2/activities/execution-traces`, where the receiver derives the v1 state-space signature from the
trace's input shapes at INSERT time and grades with it. After `3d648ad`, the rich trace arrives
carrying an id that the thin row already occupies; the authoritative store is an INSERT whose
duplicate error is deliberately mapped to an idempotent 200. The sender sees success. The only
record carrying the shapes the signature is derived from is discarded.

**The last graded execution was the one that landed the regression.** The final signed row is
`execution:⟨feature_compose:3d648ad…⟩` — the compose run that landed the killer commit was the last
ever credited, 1.6 seconds before the posterior froze. The change was aimed at joining the reach
verdict to the engine's execution record; that intent is now served by the emitter +`2f01007`
(both landed 2026-09-08), so the id unification is no longer load-bearing — today its only effect
is deleting the learning signal it meant to improve.

**Restore filed:** `restore-the-satisfier-trace-id-namespace-so-the-signature-lands-again` — a
verbatim one-line revert, anchor verified unique in goal-host `origin/dev` (line 12449), class1
falsifier. First filing under a different id was created by the store and then vanished within
seconds (probe gaps `heal-probe`/`placeholder-scrub-probe` were being written in the same second;
the `{{…}}` scrub is timestamp-only, so the deletion path is unidentified — noted, not diagnosed).
Re-filed under a new id per standing law; second write persisted and re-read cleanly after 5s.

**Pre-registered expectations once the revert lands and goal-host restarts:**
1. New rich rows appear under `execution:⟨feature_compose:<sha>⟩` with `signature` populated
   (`57cffe5dcd63b199` for the standard edit-intent context).
2. `feature_compose`'s `last_updated_at` advances for the first time since 2026-09-06T10:42:06.
3. Direction: β rises faster than α (measured landing rate 0.154 vs implied 0.699), so the
   posterior mean falls toward the real rate. History will NOT backfill — every skipped row is
   already stamped `reach_graded:true`.
4. If rows appear signed and the posterior still does not move, the defect is in
   `applyOutcomeToPosteriors` below the guard, and the silent-discard gap
   (`a-non-zero-posterior-delta…`, which the system has already narrowed on its own) becomes the
   binding item.
