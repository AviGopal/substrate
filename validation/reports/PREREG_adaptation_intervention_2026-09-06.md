# Pre-registration — can first-mile adaptation be made to fire at all?

Goal window opened 04:53:18 UTC. This is a **deliberate intervention** (law 12) rather than another
correlation over traces: change one thing, state the expectation first, record that it was changed.

## What the measurement so far establishes

Tier-2 lexical rebind has fired **0 times in 462 calls over 24h**. The refusal totals, across every
candidate examined:

| refusal | count |
|---|---|
| `shape-mismatch` | 54,906 |
| `scaffold-too-weak` | 1,762 (median ratio **0.060**, max 0.15) |
| `slot-gate-rejected` | **699** |
| **selected=true** | **0** |

**The obvious fix is refuted.** Lowering the scaffold threshold (already lowered 0.5 → 0.25 → 0.15,
each time from measurement) would only move more candidates into the literal gate — which already
sees 699 and rejects **100%** of them. The author's own comment predicted this: once
`slot-gate-rejected` appears, "the answer moves from retrieval to what gets banked."

**`shape-mismatch` is a misleading 97% of the tally.** It is counted per candidate scanned, so a
goal whose shape has no donor reports `shape-mismatch × cache-size`. That reads as "many refusals"
when it means "this mechanism does not apply here."

**And for most demand it genuinely does not apply.** Shapes demanded by rebind calls in 24h vs
donors in the library:

| demanded shape | calls | donors banked |
|---|---|---|
| `fs_edit` | 67 | **0** |
| `code_modification_proposal` | 55 | **0** |
| `shellResult` | 31 | 1,730 |
| `substrateGap_write` | 27 | 0 |
| `webSearchResult` | 25 | 16 |

Only command-shaped results are ever banked (`REBIND_EXEC_FIELDS = command, cmd, script, sql`), so
for the two largest demand classes lexical rebind is **structurally inapplicable**, not unlucky.

The library itself is only partly adaptable: of 993 live donors (4,633 lines, **2,540 tombstones**),
**32.3% contain no token of their own goal text in the command**, median share 0.11.

## What pathway reuse shows (a correction)

Distinct mechanism, and it does fire: `walk_tier = learned_pathway` on **702 walks (7.1%)**. Of the
21 rows carrying reuse lineage, **18 borrowed from a DIFFERENT goal_hash** — genuine cross-goal
adaptation — and 7 have `successful_executions > 0`.

⚠ **A control prevented a false finding here.** All 21 rows have `success: None`, which looked like
"adaptation is never graded". The control showed `success` is None on **all 9,864 rows** — an unused
field. The real grading signal is `successful_executions`. The lineage field only began recording
2026-08-29, so 21 rows is the whole population, and 696 of the 702 `learned_pathway` walks record
nothing about what they borrowed from.

## The intervention

Three goals, in order. A is the donor; B is a positive control; C is the real case.

- **A (donor)** — `Count the number of lines in the file /vessels/activity-api/src/routes/db-admin-repair.ts and report the count.`
- **B (positive control)** — same sentence, one slot changed to `.../goal-paths.ts`. Maximal
  lexical scaffold, path appears exactly once in any plausible command.
- **C (real case)** — the same task phrased differently: `How many lines does
  /vessels/activity-api/src/routes/goal-paths.ts contain?`

## Predictions, recorded before running

1. **A reaches** and banks a `shellResult` donor whose command contains the file path exactly once.
2. **B fires adaptation** — `[rebind] ... selected=true`, the first observed in this system. If B
   does *not* fire, then the mechanism cannot fire even under ideal conditions, and every
   explanation above about banking and thresholds is downstream of something more basic.
3. **C is refused**, most likely at `scaffold-too-weak`, because the shared token run is short. If C
   *does* fire, the retrieval key is less brittle than the 24h tally suggests.

B is the load-bearing prediction. It is deliberately the easy case: the point is to establish that
the mechanism has a working regime at all, because "0 of 462" is equally consistent with "never
applicable in practice" and with "broken outright", and those have different repairs.

**No threshold, gate, or policy is changed by this experiment.** It only dispatches goals.

---

## Result (05:01 UTC) — all three predictions confirmed

| goal | answer | ground truth | lexical rebind | pathway reuse |
|---|---|---|---|---|
| A (donor) | 381 | 381 ✓ | refused (no donor yet) | — |
| B (positive control) | 1346 | 1346 ✓ | **`selected=true` candidates=80** | `cover=1.00` |
| C (realistic) | 6212 | 6212 ✓ | refused, `scaffold-too-weak(0.13)×66`, `(0.14)×1` | `cover=1.00` |

**Prediction 2 held: adaptation fires.** At 04:58:48 —
`[rebind] result for "shellResult": selected=true candidates=80` — the first observed
`selected=true`. It adapted the donor's command by swapping the one varying slot:

```
donor:   wc -l /vessels/activity-api/src/routes/db-admin-repair.ts
adapted: wc -l /vessels/activity-api/src/routes/goal-paths.ts
```

and the answer was independently recomputed by a second derivation (`awk 'END{print NR}'`) before
being accepted. So the mechanism has a working regime, is correct when it fires, and "0 of 462" was
never "broken outright" — it was "almost never applicable."

**Prediction 3 held, and yields the sharpest number of the window.** The realistic rephrasing —
same task, same shape, new subject, different wording — scores **0.13–0.14 against a threshold of
0.15**. It misses by 0.01. The threshold was previously set to 0.15 from measurement, as "the first
value below the 0.18 these goals actually score"; natural rephrasing now measurably scores *below*
that. **This is evidence for a threshold change and I am not making one** — it is a policy
parameter, and the decision belongs in the gap store with the measurement attached, not in an
operator's unilateral edit during a measurement window.

**The two mechanisms are complementary, not redundant.** C reached *anyway*, via pathway reuse
(`cover=1.00`, borrowed from a different goal) — so the narrow lexical path failing did not cost
the reach. Any account of "adaptation" has to say which of the two it means.

## Second experiment (pre-registered 05:22, before running) — is the learned pathway actually CHEAPER?

Demonstrating that reuse *fires* does not show it is *worth* firing. The architecture's ceiling
claim is that a task the system has done before "runs over the pathway it learned — cheaper,
faster, and more reliable than re-deriving." That claim has never been measured here.

The substrate already ships the mechanism for measuring it, so nothing is minted: `/run-goal`
accepts `ablation: { disableReuse: true }`, which suppresses **both** the reached-command cache and
lexical rebind so a cold-derivation floor arm can be run, and `learningMode: "observe"` makes the
arm held-out (no cache write, no goal-path, no mint) so the measurement does not contaminate the
learner. The ablated arm is tagged `ablation:disableReuse` in its trace, so the counterfactual is
attributable after the fact.

**Same goal text, two arms, run back to back:**

`Count the number of lines in the file /vessels/activity-api/src/routes/activities.ts and report the count.`
(ground truth **11446**; a donor with identical phrasing exists from goals A and B)

- **arm R (reuse)** — normal dispatch.
- **arm F (floor)** — `ablation:{disableReuse:true}`, `learningMode:"observe"`.

### Predictions

1. **Both arms reach**, with the answer 11446. If the floor arm fails to reach, reuse is not merely
   cheaper — it is load-bearing for correctness, a stronger claim than the architecture makes.
2. **arm R is faster than arm F.** This is the ceiling claim. Direction is what matters; the
   magnitude on n=1 is an anecdote, not an effect size.
3. **arm R logs `selected=true`; arm F logs the ablation suppression line** and derives cold.

If arm R is *not* faster, the honest reading is that on one-step command goals the pathway saves
nothing measurable, and the ceiling claim would need to be demonstrated on multi-step work instead —
which is a result about where reuse pays, not a failure.

**n=1 per arm.** This is a direction check on a claim never tested at all, not an effect estimate,
and it is labelled as such wherever it is reported.

### Result of the second experiment (05:35) — INCONCLUSIVE, and the reason is the finding

**The A/B could not be run, because the ablation lever never engaged.**

| arm | template selected | outcome |
|---|---|---|
| R (reuse) | `learned-composition-filecontent-to-shellresult` | `reached:false`, `execution_error`, **137 ms** |
| F (floor) | `learned-satisfier-shell-result` | `reached:false`, `execution_error`, **12 ms** |

Both failed, so the naive reading is "reuse is harmful here." **That reading is not available**, because
neither arm produced an ablation-tagged trace: 0 of the 96 executions in the window carried one. The
experiment cannot distinguish *reuse hurt* from *the ablation never applied*, so it yields no
counterfactual claim. Recorded as inconclusive rather than dressed up.

### ⚠ RETRACTED AT 06:07 — I published a claim on a control that did not test the writer

**What I wrote first, and it was wrong:** "`ablation:disableReuse` has never appeared on any
execution in recorded history — zero, ever," with a positive control of 13,317 executions carrying
`dispatcher_used:goal-host`.

The zero is real; the **control was invalid**. `dispatcher_used:goal-host` is written by a *different
code path* than the tag under test. The ablation tag is pushed into `effectiveTags` at
`src/index.ts:15209`, and a control on **that same writer** shows those tags essentially never reach
the `execution` table: `execution_path:fresh_derivation`, `walk_tier:1` and `attempt_count:1` each
appear on **exactly one row out of ~36,000**. An absent tag in a store where its own siblings appear
once in total is a blind probe, not evidence.

**A control must exercise the same path as the value under test, or it certifies nothing.** Mine
certified nothing, and I had already committed it and reported it before catching that.

**What survives:**

1. The lever is implemented and reachable — parsed at 14675, forwarded at 15189, tagged at 15209,
   all inside `handleRunGoal`.
2. Three dispatches with a body verified to parse and to contain `ablation.disableReuse=true`
   produced no ablation-tagged execution row and no "reuse SUPPRESSED by ablation" journal line —
   though that line only prints when there *is* a cache hit to suppress, so its absence is also weak.
3. The A/B therefore cannot distinguish "reuse is harmful here" from "the ablation never applied,"
   and **no counterfactual claim is drawn from it**.

**What is now the actual open question:** where `effectiveTags` are persisted. They are not landing
on `execution` rows systematically, so until that sink is identified, *nobody can tell from outside
whether an ablation was applied* — which is a real defect in itself, and the one worth fixing. An
evaluability lever whose activation is unobservable is not an evaluability lever.

**The underlying concern is unproven but unrefuted:** if no ablated floor arm is recorded anywhere,
then "the learned pathway did better" comparisons are uncontrolled and the ceiling claim has never
been tested against its own control. That must be settled by finding the sink and counting ablated
arms there — not by re-running the query that produced this retraction. Filed (and now corrected in
place) as `the-ablation-counterfactual-lever-has-never-fired-in-recorded-history`.

**A second trap found while debugging it:** the same handler reads `body.learning_mode` in
snake_case while the internal option is `learningMode`. A caller sending `learningMode` has it
**silently ignored** — so a run intended to be held-out writes back to the learner anyway. The
mismatched read returns nothing rather than erroring, which is the dominant silent-failure class
in this system.

### What did survive from the attempt

Arm R's failure was worth the trip. The template it selected,
`learned-composition-filecontent-to-shellresult`, has **74 executions, all `status=success`, and not
one `reached=true`** — while its live posterior sums to **α=101.5, β=50.8 across 22 context buckets,
an implied 67% success rate.** The learner believes it succeeds two times in three; the reach record
never once says so. It is `deprecated:false` and remains selectable, and it was selected here in
preference to the plain `satisfier:shellResult` path that reached correctly for three other files
earlier in the session. Filed as
`a-composition-that-has-never-reached-carries-a-67-percent-posterior`.

⚠ **Bounds, stated because the numbers invite overreach:** `reached` is None on 67 of the 74 rows, so
"never reached" means zero recorded reaches, seven explicit non-reaches, and sixty-seven never
evaluated — not seventy-four measured failures. `n_observations` (105) exceeds executions (74)
because chain credit is by design.

⚠⚠ **Two wrong-store traps on the way, both caught by controls, neither published:**
`activity.thompson_alpha/beta` sit at exactly **1.0/1.0 on all 3,888 rows** — which reads as "nothing
has ever been graded" and is merely a vestigial column; the live posteriors are in
`context_thompson_scores` (6,807 rows). And ids in `activity` are `activity:⟨name⟩`, so an exact
match on the bare name returns zero rows and looks like absence.

## The instrument was lying, and this run caught it

Two lines from the same call, seconds apart:

```
[rebind] outcome selected=no candidates=0
[rebind] result for "shellResult": selected=true candidates=80
```

The first is emitted *before* the loop that assigns `best` and `candidates`, so it unconditionally
prints `selected=no candidates=0` on every call. That is the line a log-scraper reads as "adaptation
never fires" — a false negative baked into the instrument, in a system already misdiagnosed several
times by trusting a channel's own reporting. Dispatched for removal; the correct end-of-function
line already carries the information.

### Cause found (06:10) — the tags are pushed onto an array that was already handed off

`effectiveTags` is composed at `src/index.ts:15134`, **passed into the seek call at 15173**
(`tags: effectiveTags`), and then **mutated at 15207–15209** with `execution_path:*`, `walk_tier:*`,
`attempt_count:*`, `learning_mode:*` and `ablation:*`. The consumer serialises at call time, so
everything pushed afterwards is lost.

**Same-writer control** — same array, same consumer, differing only in push time relative to 15173:

| tag | pushed | rows (of ~36,000) |
|---|---|---|
| `dispatcher_used:goal-host` | before handoff | **13,318** |
| `operator:claude-code-operator` | before handoff | **1,651** |
| `execution_path:fresh_derivation` | after handoff | **1** |
| `attempt_count:1` | after handoff | **1** |

~13,000:1. This is the control the retracted version should have used.

**Consequences beyond the lever:** `ablation:*` unobservable, so no requested ablation can be
confirmed from the trace — the correct mechanistic statement of what I first mis-stated as "the lever
has never fired". `learning_mode:*` unobservable, so a held-out run is indistinguishable from a
learning one. And `execution_path`/`walk_tier`/`attempt_count` are unobservable *as tags*, while the
comment at 15205 says "existing trace consumers key on it" — so those consumers read nothing.

Not affected: the **column** `goal_execution_paths.walk_tier`, which is healthy and populated (it is
what measured 702 `learned_pathway` walks this session). The defect is confined to the tag path.

**Remedy is verifiable the way it was found:** move the pushes above 15173 (or pass a thunk, or read
tags at completion). After landing, `execution_path:*` should appear on new rows at a rate comparable
to `dispatcher_used:goal-host`; if it does not, the change is inert.

**Correction to my own remedy (06:11).** "Move the pushes above 15173" is only right for two of the
five. `execution_path`, `walk_tier` and `attempt_count` are computed from the `seek` **result**
(`classifyExecutionPath({...seek})`, `seek.attempts`) and cannot be hoisted above the call that
produces them — they need the consumer to read tags at completion instead. `ablation` and
`learning_mode` are parsed from the request body earlier in the same function and **can** be hoisted,
which makes the observability of the counterfactual lever a two-line fix. Recorded because a wrong
remedy in a gap routes a composer at an impossible edit.

## Repair landed and verified (06:25)

The two hoistable pushes were inserted **before** the handoff, as a pure insertion (the originals
remain below, now redundant and harmless — a single additive op composes far more reliably than a
move, which the first attempt proved by producing a comment-only diff that the semantic gate
correctly hard-failed with *"zero behaviour delta — added lines are comment/whitespace-only"*).

Landed by the substrate itself: `goal-host-vessel 6273bf6 substrate-authored: apply
route-edit-e051be20-compose-report via mitosis cutover`. Inserts at lines **15174–15175**, handoff at
**15214**, originals at 15249–15250.

**Verified at the consuming layer, after a real reload** — MainPID 3503909 → 3640152, then two
dispatches carrying `ablation.disableReuse`:

| tag | before | after |
|---|---|---|
| `ablation:disableReuse` | **0 in all recorded history** | **1** |
| `learning_mode:observe` | **0** | **1** |

The `learning_mode` half needed the body key `learning_mode` (snake_case); the first attempt sent
`learningMode` and was silently ignored, which is the same trap recorded above and is now
demonstrated rather than inferred.

**What this changes:** the ablated floor arm is now identifiable in the trace, so the counterfactual
this window set out to measure — is the learned pathway actually cheaper than re-deriving? — is
*runnable* for the first time. It is still **not measured**. That remains owed, along with the
aggregate reuse-rate adjudication, and both want a window at loadavg <~10.
