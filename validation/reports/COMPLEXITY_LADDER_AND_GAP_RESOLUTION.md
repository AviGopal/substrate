# Unmanaged work cleared, and the operator compose lane is still dead

Continuation of `GAP_POOL_TRIAGE.md`. Three tasks: clear unmanaged local work,
resolve the gap pool, and demonstrate that the system reaches arbitrary unique
goals of arbitrary complexity — where complexity is the number of data
transformations.

---

## 1. Unmanaged work — every item disposed, nothing preserved to a side directory

The instruction named the disposal channel: *"we may intervene by pushing a
change to origin/dev."* So each item got one of two dispositions — **pushed** or
**deleted**. No new preserve directories were created, and the two left by the
previous session were removed.

| item | finding | disposition |
|---|---|---|
| `activity-api` working tree, 5 files | **not** a uniform blob: 1 revert + 4 files of real forward work | split |
| └ `discover-by-shapes.ts` | the standing `UNTRIED_PRIOR_BETA` revert; HEAD and origin/dev were already correct | **discarded** — ★★★★★ blocker closed |
| └ `goal-paths.ts` + its test | satisfier shapes discarded by an early return | **pushed** `afa102b` |
| └ `impulses.ts` | `'public'` no-tenant sentinel unknown to the reader | **pushed** `b1205f3` |
| └ `execution-traces.ts` | composition edge derived at ingest | **pushed** `516fc73` |
| `goal-host-vessel/.wt-reachrefactor` | worktree, branch 0 commits ahead, abandoned 2026-07-30 | **removed** |
| `goal-host-vessel/.claude/worktrees/agent-…` | same | **removed** |
| 3 super-repo agent worktrees | dirty only with stale submodule pointers | **removed** |
| 2 opencode + 1 scratchpad worktree | clean, detached, stale | **removed** |
| `llm-resolver-vessel` pointer | 3 commits already on origin/dev, pointer never carried forward | **pushed** `f9159594` |
| `/home/avi/substrate-clone-preserve-2026-08-12/` | prior-session preserve dir | **deleted** |
| `/home/avi/stranded-devvessel-UNIQUE-…patch` | 18 files of 13-day-old unreviewed autonomous output | **deleted** — see below |
| `repos/clock-vessel`, `human-surface-vessel`, `relevance-sink-vessel` | **tracked plain files** in the super-repo (4/53/3), not submodules | left alone — tracked ≠ unmanaged |
| `repos/deployment` | separate repo, explicitly gitignored at `.gitignore:204`, own remote, 0 unpushed | left alone — separately managed |

**Why the stranded patch was deleted rather than pushed.** It was 18 files of
compose-pipeline output stranded by the applier reading a directory nothing wrote
to. That applier defect is fixed, and `git log origin/dev` shows the substrate
landing its own work through mitosis cutover again — 111 dev-vessel commits in
three days. Pushing 13-day-old unreviewed autonomous output in bulk would be
hand-completing work the system can now redo itself (law 6), and would land 18
files under one commit. If those gaps are still real they are still in the pool.

**Method note.** The temptation was `git checkout .` in `activity-api`, which
would have destroyed three real fixes. What separated them was checking each
file against `origin/dev` individually: one was a *deletion* of code already
upstream, three were *additions* absent upstream.

### The forward work was verified, not assumed

`bun test` on `activity-api` returns **435 pass / 158 fail / 69 errors** both with
and without the four files — a pre-existing baseline, and identical counts, which
is exactly the shape of a test that never ran. It hadn't: the modified test file
needs `SURREALDB_NAMESPACE` and was one of the 69 load errors.

Run with the env set, and with a control:

| | result |
|---|---|
| with the fix | **7 pass / 0 fail** |
| `goal-paths.ts` reverted to HEAD, new test kept | **4 pass / 3 fail** |

The control is what makes the 7/7 mean anything.

---

## 2. The operator lane works — and I nearly filed a defect against it

I spent most of an hour building a case that the operator compose lane was dead,
and the case was wrong. Recording how it collapsed, because the error is more
useful than the non-finding.

**The apparent evidence.** A cockpit dispatch at 06:04 was followed, in the
development-vessel journal at the same second, by:

```
06:04:12  [compose-cap] REFUSING autonomous compose: 1 in flight
```

The arithmetic looked decisive. `COMPOSE_MAX_CONCURRENT` is unset so the cap is
the default **2**, and `compose-slots.ts:214` reserves the last slot:

```ts
const effectiveCap = opts.directed === true ? cap : Math.max(1, cap - 1);
```

A **directed** compose with 1 in flight sees `1 >= 2` → granted. An **autonomous**
one sees `1 >= 1` → refused. It was refused as `autonomous`, on a dispatch whose
`goal_status` reports `operator: claude-code-operator`. That reads as the 08-11
forfeited-operator-slot defect surviving its fix.

**What was actually wrong.** The refusal line was never shown to be *my
dispatch's*. The gap-drain lane emits an autonomous compose attempt every few
seconds; at 06:04:12 there were several candidates and I picked the one adjacent
to my dispatch's log line. **A timestamp is not an identifier** — my own standing
rule, and I broke it in the one place it was written for.

**The control that settled it.** Paired dispatches, one with `operator` in the
body and one without, at saturation so both would refuse and both would print
their lane:

```
06:10:30  [compose-cap] REFUSING DIRECTED compose: 2 in flight
06:13:22  [compose-cap] REFUSING DIRECTED compose: 2 in flight
```

`REFUSING DIRECTED` exists and fires. The lane is intact; `directed` survives all
four hops. And the MCP dispatch I had written off resolved on its own:

```
executionId: feature_compose:rejected:fe9276e6:3
```

— it was never capacity-killed. It waited, got a slot, and was rejected downstream
for an unrelated reason (§4). What I read as a dead lane was a **saturated** one:
autonomous gap-drain work holds both slots almost continuously, so a directed
dispatch waits minutes rather than seconds. That is a pacing observation, not a
classification defect, and the two have opposite repairs.

**Two controls, two different jobs.** Before believing the negative I should have
asked what a *positive* would look like in that exact query — `REFUSING DIRECTED`
— and grepped for it. I had the string; I never searched for it.

### The control that coalesced first

The first attempt sent the same goal text twice, once with `operator` and once
without. The second came back:

```json
{"dispatchId":"3fadf1fd-…","status":"running","coalesced":true}
```

Identical goal text **coalesces into one dispatch**, so the paired control
measured one dispatch twice and would have "confirmed" whatever the first arm did.

> ⚠ Worth carrying independently: any A/B over goal *routing* that reuses goal
> text silently measures a single execution.

---

## 3. Law 13 is a regex, and it rejects three of four natural phrasings

Before spending a dispatch, four phrasings of the *same* defect were run through
the production admission predicate `isPathlessCodeChangeGoal`:

| phrasing | admitted |
|---|---|
| "A single goal walk filed 77 separate missing-capability gaps… Require positive evidence…" | ✗ |
| "…must reject a missing shape unless some registered template or activity actually demands it." | ✗ |
| "Change the capability-gap filter so it only files a gap for a missing shape that some registered template demands." | ✗ |
| "The check that decides… **should require** positive evidence…" | ✓ |

Only the phrasing carrying a `NORMATIVE_INTENT` auxiliary (`should`) was admitted.
"Change the … filter so it only files …" — an imperative naming a mutation and a
code target — was **not**.

This is law 13 measured rather than asserted: *if a goal only works after an
operator rewrites it, that rewriting is a gap in the system.* The admitter is a
conjunction of hand-maintained regexes (`MUTATION_VERB`, `CODE_TARGET`,
`NORMATIVE_INTENT`, `NOT_A_CHANGE`, `PROSE_DESTINATION`), each grown by one
alternation per observed miss — the same deny-list shape as the capability-gap
filter this dispatch was trying to repair.

### The pre-flight was right, and I misread the journal a second time

`stage-harness.ts --predict` on the admitted phrasing resolved
`repos/goal-host-vessel/src/index.ts` — correct; `fileCapabilityGap` lives at
`index.ts:4409`.

I then read a journal line naming `goal-host-vessel/src/goal-file-resolution.ts`
and wrote up a harness-versus-production disagreement. There was none. The
dispatch's own reconstructed decision log says:

```
3. /run-goal: EARLY EDIT-INTENT DETECTED (pre-walk, names
   repos/goal-host-vessel/src/index.ts) — routing to feature_compose
```

The `goal-file-resolution.ts` line belonged to a different, concurrent dispatch.
**Same error as §2, ten minutes apart, in the same journal.** Once is a slip;
twice in one session on the same instrument means the instrument is being used
wrong — the fix is to read attribution from `goal_reasoning`, which is keyed by
dispatch id, and never from a journal grep.

The pre-flight's two warnings do stand, and both were borne out: the deciding
term is prose in a comment (`evidence kind: STRING LITERAL`), and the target has
**no test file**, so every downstream gate reads the diff and none runs it.

---

---

## 4. Two tries at the largest gap minter

`fileCapabilityGap` (`goal-host-vessel/src/index.ts:4409`) is the confirmed
largest minter — 174 rows from one goal's walk. Its filter is a **deny-list**:
five regex clauses, each added after some phantom class was observed escaping.
Its own comment names the correct rule and does not implement it:

> *"Genuine unmet demand is template-demanded (e.g. `discoverByShapesQuery`,
> required by N templates) and survives this filter; these bare artifacts do not."*

### Try 1 — right file, right function, right idea, dangling reference

```
3. EARLY EDIT-INTENT DETECTED (pre-walk, names repos/goal-host-vessel/src/index.ts)
23. verdict=UNFAVORABLE (op_count=2, rolled_back: verify failed:
    src/index.ts(4439,33): error TS2304: Cannot find name 'isShapeDemanded'. | TC_EXIT=2)
```

Line **4439 is inside `fileCapabilityGap`** (4409–4470). From a goal naming no
file, the system found the right module, the right function, and drafted a
positive-evidence predicate — it even chose a good name for it. It then *called*
`isShapeDemanded` without emitting it. Typecheck caught it and the change rolled
back.

This is the best pathless result I have measured. The failure is mechanical
completeness, not comprehension, and the gate did its job.

### Try 2 — killed by infrastructure, so it does not count as a try

```
14. verdict=(none) (op_count=?: ingress proxy failed: failed to connect via relay
    with status NO_RESERVATION)
16. ESCALATION patch_with_tools did not stage (ingress proxy failed: … NO_RESERVATION)
```

Both the compose route and its escalation died in the transport. Nothing about
drafting was exercised. Per the standing condition the system gets two *fair*
tries; this was one fair try and one infrastructure kill.

### What the kill exposed — and the two hypotheses it cost me

Chasing `NO_RESERVATION` produced a finding, but only after two wrong turns
worth recording because both were refuted by a check I nearly skipped.

**Wrong turn 1 — "the compose producer is registered behind the relay."**
`mcp__metabob__registry_query` reports the only `feature_compose` producer as
`development-vessel-local@spoke-cfda39e7 | http://127.0.0.1:18401 | libp2p`. The
**local** discovery, queried directly, says something else entirely:

```
development-vessel-local | http://localhost:8090 | protocol: None
```

goal-host queries the local one. MCP's registry view is the **federated** view,
and the two disagree about how a vessel on this machine is reached. *Confirm
which copy your instrument talks to* — the second time this instrument has
misled me across two sessions.

**Wrong turn 2 — "most LLM picks route over a broken relay."** The capability
resolve for `llm_completion` returns **7** producers, and **6** are
`http://127.0.0.1:8401 | libp2p` (three `@syzygy-hub`, three `@spoke-94988b6f`)
against one healthy local `http://127.0.0.1:8220`. With the transport reporting

```
egressNoReservationCount: 2188
lastRedialReason: "egress could not reach llm-resolver-vessel over any live circuit"
```

— up since 2026-08-11 00:08:40, so **≈72 failures/hour, one every 50 seconds** —
that reads like most LLM traffic falling into a dead circuit. It does not.
`pickSatisfierProducer` (`satisfier-pick.ts`) scores locality:

```ts
const isRemote = String(p["protocol"] ?? "") === "libp2p";
const score = (typeof p["priority"] === "number" ? p["priority"] : 0) * 2 + (isRemote ? 0 : 1);
```

A local producer gets `+1`, so at equal priority local wins. Hypothesis refuted.

**What survives, and it is sharper than either guess.** The locality bonus is
`+1` while one step of `priority` is worth `+2`. **A federated producer
declaring `priority ≥ 1` outranks a healthy local one**, and the circuit it wins
the traffic for is failing 72 times an hour. Locality is not a tie-break the
scoring can defend — it is worth half a priority increment. That is the defect,
and it is one line.

---

## 5. The complexity ladder

`validation/scripts/complexity-ladder-harness.ts`. Complexity is defined as the
corpus does not settle it — FOUNDATION offers four grains and says outright that
a trajectory and an activity are the same object at different granularity:

> **One transformation = one producer step in the walk emitting an output shape
> absent from its input shapes.**

Counted from `path_activities` with `satisfier:*` excluded — a satisfier is a
shape *asserted* into the pool, not a producer that ran; counting them inflates
every rung uniformly and would make rung 1 look like rung 3.

**There is no walk-length column anywhere in the fleet.** Five vessels' `src`
scanned against a 155-hit positive control; one derived report field is all that
exists. So every rung carries its own expected count and is validated by content
binding against an externally measured ground truth, not by a stored number.

Uniqueness is by construction: every goal embeds a run nonce, so no rung has a
prior `goal_hash`. That is what makes the floor arm a floor measurement — reach
*regardless of priors* — rather than a memorization test.

| rung | asks for | transformations | why it cannot collapse |
|---|---|---|---|
| 1 | the registry's advertised shape count | 1 | baseline, deliberately collapsible; reported for calibration only |
| 2 | that count, persisted as a titled memory note | 2 | no activity's inputs cover both the registry and the note store |
| 3 | registry shapes vs open gaps, and which is larger | 3 | two producers in two vessels, a third consuming both — first backward-chain over two unmet inputs |
| 4 | both counts plus their ratio, persisted | 4 | adds a derived quantity neither producer emits, plus a persist into a third store |

Ground truth measured independently at run time: **386** advertised shapes, 14
vessels, **313** open gaps.

> The first draft of this harness read discovery's `GET /shapes` and got **4**.
> That route returns *discovery's own* shapes; the registry holds 386 at
> `/registry/stats`. A ground truth wrong by two orders of magnitude would have
> scored every correct answer as incorrect — **a returned-row count is not a
> table total**, and the control that caught it was asking what the number
> *should* look like before trusting it.

Three must-fail controls run first, each unsatisfiable for a different reason
(nonexistent field, false premise, out-of-capability), because a battery that
fails one way tests one guard. If any control *reaches*, the run reports that
its own reach numbers cannot be trusted.

### The controls passed first, so the numbers below mean something

```
OK   ctl-nonexistent-field   reached=false  abstained, as required
OK   ctl-false-premise       reached=false  abstained, as required
OK   ctl-out-of-capability   reached=false  abstained, as required
```

**3/3.** Falsifiability index 1.0 — the suite can say no. Without this the reach
column would be unfalsifiable and worth nothing.

### The result: reach holds, correctness collapses at the second transformation

| rung | transformations | `reached` | externally correct | what was actually produced |
|---|---|---|---|---|
| 1 | 1 | **true** | **YES** | shelled `/registry/stats`, got **324**, matching ground truth measured independently |
| 2 | 2 | **true** | no | note `ladder-…-r2` persisted, body = **`3`** (truth: 324) |
| 3 | 3 | **true** | no | answer carried neither 324 nor 318, nor named the larger |
| 4 | 4 | false | no | note `ladder-…-r4` persisted, body = **`Distinct impulse shapes: X, Substrate gaps open: Y, Ratio: Z`** |

**Reach 3/4. Externally correct 1/4. Gaming gap = 2. HOLLOW = 2** (rungs 2 and 3:
reached, wrong). **SILENT = 0.**

Rung 4 is the honest one — the gate refused it. So the reach gate is *not*
uniformly blind: it caught the 4-transformation failure and passed the 2- and
3-transformation ones. Whatever is failing is not "the gate never checks."

### ⚠ The `steps=null` column was my instrument, not the system

The harness printed `steps=null` on every rung and I first wrote that up as "the
transformation count cannot be read from durable state." **That was wrong**, and
it is the third wrong-copy error in this session.

`TRACE_STORE` defaulted to `http://localhost:18080`. This substrate is a **spoke**
(`spoke-cfda39e7`), and `roles.spoke` in `vessels.inventory.json` does not include
the `api` role — `activity-api` is **masked here by design**, with the trace store
on the hub. `systemctl start` says so outright:

```
Failed to start activity-api.service: Unit activity-api.service is masked.
```

An empty read through a masked unit is indistinguishable from "nothing was
recorded." *A zero read through a filter measures the filter.* Re-queried against
the hub named in `~/.metabob/config.json`, every row is there.

### The real result: the ladder never composed

| rung | producer steps | `path_activities` | `walk_tier` | total_exec | α, β |
|---|---|---|---|---|---|
| 1 | **0** | `[satisfier:shellResult]` | satisfier | 2 | 3, 1 |
| 2 | **0** | `[satisfier:detector_yield_registry, satisfier:memoryNote_write, satisfier:shellResult]` | satisfier | 2 | 3, 1 |
| 3 | **0** | `[satisfier:shellResult]` | satisfier | 2 | 3, 1 |
| 4 | **0** | `[satisfier:memoryNote_write, satisfier:shellResult]` | satisfier | 2 | 2, 2 |

**Not one producer activity ran, at any rung.** Every step is a `satisfier:*` — a
shape asserted into the pool, not a transformation performed. The ladder was built
to vary the number of data transformations from one to four; the system performed
**zero** at every rung.

**Rungs 1 and 3 recorded the identical `path_signature` (`4502429f46`)** — the
same single `satisfier:shellResult`. A one-transformation goal and a
three-transformation goal are, in durable state, indistinguishable.

This reframes the correctness cliff in §5 entirely. Rung 1 was not *composition
succeeding at depth 1*; it was a single shell command that happens to answer a
single-shell-command question. Rungs 2–4 got the same treatment and produced wrong
content because the goal needed composition and none occurred. Rung 2's
`satisfier:detector_yield_registry` is an irrelevant shape asserted into the pool —
a plausible source of the `3` it wrote where truth was 324.

### The per-goal posterior IS learning — of the wrong structure

> **Scope.** What follows is the posterior on the `goal_execution_paths` row,
> keyed by `goal_hash`. The **activity-arm** table — the one an earlier finding
> records as "the walk grades into a table nothing reads" — was not measured
> here. This is one of two credit paths, and the claim does not generalize to the
> other.

The one genuinely positive reading. Across the floor and ceiling arms every rung
shows `total_executions: 2`, and the posterior moved off `Beta(1,1)`:

- rungs 1–3: **α=3, β=1** — two successes credited
- rung 4: **α=2, β=2** — one success, one failure, exactly matching floor
  `reached=false` / ceiling `reached=true`

The fast variable moves, and it moves *correctly*, tracking the honest verdict
including the failure. The credit loop works.

What it is learning is `satisfier:shellResult` — that asserting a shape is how you
answer a goal. Posterior movement on a pathway that performs no transformation is
the slow variable sharpening around the wrong structure.

> Reach on the ceiling arm went 3/4 → **4/4** (rung 4 flipped false → true) with
> latency ratios 1.17×, 1.54×, 1.17×, 2.45×. With `walk_tier` pinned at
> `satisfier` on both arms and no shape-pathway reuse recordable at all, **none of
> that is attributable to reuse** — it is consistent with load variation, and I am
> not claiming it as a ceiling effect.

**Rung 1 is a genuine reach with a genuine oracle.** The reach gate did not take
the walk's word for it:

> `deterministic:verified-registry-count — independently queried
> http://127.0.0.1:8100/registry/stats.totalShapes=324; the produced output
> matches the authoritative registry`

That is the machinery working exactly as designed: a deterministic verifier
querying the primary source and comparing. Nothing about that reach is hollow.

**Rung 4 is the sharpest result in this report.** The goal asked for two counts
and a ratio, persisted to a titled note. A note with that exact title exists, and
its body is the literal template — `X`, `Y`, `Z`, unsubstituted. The system
produced the *shape* of the answer and persisted it as though it were the answer.

**Rung 2 is the more interesting one.** It asks for the *same count rung 1 got
right*, plus a write. Rung 1 returned 324. Rung 2 wrote **3**. The derive step did
not fail in isolation — it degraded when composed with a persist step. That is a
statement about composition, not about counting.

### What this measures, stated narrowly

- The **floor holds on reach**: every rung dispatched, routed, and produced a
  durable artifact. Nothing was structurally out of reach.
- **Correctness falls off a cliff between one and two transformations**, and
  `reached` does not follow it down. The gaming gap is the whole result: at rung
  1 the verifier compared against the primary source; at rungs 2 and 4 there was
  no such comparison, because the goal's target shape was *a note existing*, and
  a note does exist.
- The reach gate is only as good as the oracle attached to the target shape. For
  `shellResult` there is one; for `memoryNote` the bar is **persistence**, not
  content. **A durable wrong answer passes.**

That is a concrete, one-sentence gap: *a write-shaped goal is graded on whether
the write happened, never on what was written.*

> **Measurement caveat, recorded at decision time (law 12).** The advertised
> shape count moved **386 → 324** and vessels 14 → 13 between the harness's two
> runs (a vessel deregistered), then held at 324/13 across a five-sample, 80-second
> window. Ground truth is snapshotted once per run for exactly this reason, and
> cross-run comparison of these numbers is invalid.
>
> **A second, deliberate intervention:** the gap dispositions in §6 were applied
> while the ceiling arm was still to run, moving the open-gap count 318 → 209.
> Rungs 3 and 4 read that count. Their **ceiling-arm correctness is therefore
> void by my own hand** — the reach, tier and signature readings are unaffected.
> Recorded here rather than discovered later.

---

## 6. The gap pool: 318 → 209, and one in four proposed closes refuted

Eleven batches of 28 classified against the live tree, then every proposed
removal handed to an adversary instructed to refute it.

| | |
|---|---|
| verdicts returned | **303** (every gap accounted for) |
| proposed removals | 148 |
| **overturned by refutation** | **36 — 24.3%** |
| held back by the coverage guard | 17 |
| applied | 111 → **109 confirmed**, 2 write-failed |
| **silent no-ops** | **0** |
| open pool | 318 → **209** |

The 24.3% refutation rate is within a point of last session's 24.6% on an
independent batch — one proposed close in four does not survive an adversary.

**The coverage guard earned its place immediately.** Batch 03's refuter returned
verdicts that covered none of its 17 proposed removals. Without the guard those
17 would have applied *unrefuted* — the same silent-truncation shape as last
session's `.slice(0, 60)`, wearing different clothes. They are held open instead.

**Close and reject are not interchangeable.** `status == "closed"` is read as a
landed-fix training label by `gap-landability-model`, `gap-lifecycle-scan`,
`detector-coverage-scan` and `detector-yield-registry`. Phantoms and duplicates
were therefore **rejected** (100), and only demonstrated fixes **closed** (11).
Read back individually: 11/11 `closed`, 20/20 sampled `rejected`. Absence from
the open pool would not have distinguished them.

---

## 7. The refuter caught my own fix being inert

The single most valuable thing the adversarial pass produced was aimed at me.

Last session I landed `671ce88`, a dead-store gate, and recorded it as *"validated
by replaying the real commit"* — feeding the actual before/after of the harmful
landing `8eb660a`. The refuter overturned the close and named the reason: I
replayed **full file contents**, and the gate's only runtime caller passes
something else.

```ts
// feature-compose.ts:3096  — the twin, twelve lines above
const loops = nonTerminatingEditReason(current, current.replace(oldS, newS));   // simulates against the FILE
// feature-compose.ts:3108  — the site I wired into
const r = vacuousEditReason(op.old_string ?? "", op.new_string ?? "");          // raw op strings only
```

`deadStoreEditReason` needs the *overwriting statement* to be present in `after`.
For an anchored insertion it is not. Measured, not argued — running origin/dev's
own `vacuous-edit.ts` against both forms:

```
FORM A (runtime form, anchored insertion):  null
FORM B (the form I validated against):      "dead store: the added line … has no effect whatsoever"
```

And `git show 8eb660a --stat` is `1 file changed, 2 insertions(+)` — a pure
insertion. **FORM A. My gate does not catch the commit it was written to catch.**

This is the fifth instance this session of one pattern: *a lesson applied at one
call site and not at its twin.* The correct call site was twelve lines above the
one I edited, already doing the right thing.

The repair is dispatched as a goal rather than hand-applied, since a gate that
guards autonomous landings is exactly the kind of thing the substrate should be
able to fix about itself.

---

## 8. Closing state

**Gap pool 318 → 202.** Batch 03's 17 held-back removals were refuted
independently and all 17 survived; applied and confirmed by read-back, zero
silent no-ops. The two write-failed ids were retried and confirmed gone.

That adversarial pass found a **second minter**, now filed:
`orphaned-capability-scan` counts a resolver as invoked only when it appears in
an activity template's task `resolver` field, so it is blind to two real
invocation paths — direct code calls (`activeDispatches` is resolved by four
vessels; `cluster` is POSTed every tick by activity-api's signature-cluster job;
`code_locality` is called on the compose path) and **LLM tool-loop calls**
(`code_add_import`, `code_find_function`, `code_find_import`,
`code_insert_after_line` are `patch_with_tools` tools, advertised in discovery on
purpose — `local-tools-vessel/src/index.ts:625-630` says so outright). Seven of
fourteen rejects in a single 28-gap batch came from this one blind spot, and
`orphaned_capability` was 52 of the original 303.

It also confirmed a sharp one that stays **open**: the LLM-arm `ExecCondition` is
`grep -Eq "^$key_var=.+"`, and the env file writes empty keys **quoted** —
`GOOGLE_API_KEY=""`. Two quote characters satisfy `.+`, so an arm with no
provider key starts anyway and dilutes failover. Verified by running the
predicate directly, with both a passing and a failing control. That is the source
of the `"No LLM provider configured"` federated errors in §4.

**Gaps filed from this session's own measurements** — four, because a finding
that lives only in an operator report is one the resolution loop can never read:
the walk answering multi-transformation goals entirely with satisfiers; write-shaped
goals graded on the write rather than the content; the orphan detector's blind
spot; and the relay `NO_RESERVATION` kills (filed with the measurement that would
settle its mechanism, explicitly labelled a hypothesis rather than a diagnosis).

### One intervention, stated as an intervention

The dead-store gate from §7 was repaired **by hand** and pushed (`06fabe9`).
Three dispatches of that repair were killed by infrastructure before reaching the
drafter — twice `NO_RESERVATION` on the relay, once compose `BUSY` — and it is a
live safety gate: a harmful dead-store edit could land autonomously while it sat
inert. The fix is at the call site, in the same loop where
`nonTerminatingEditReason` already simulates against the tree.

**The class gap stays open.** The substrate has not demonstrated it can make this
repair, and a hand-landed fix is not evidence that it can.

### The standing first-try condition: unmet

Across this session's pathless edit dispatches, exactly **one** was a fair try —
it localised correctly to `index.ts:4439`, inside the right function, and drafted
a positive-evidence predicate before calling a helper it never defined
(`TS2304`). Typecheck caught it and rolled it back. Every other attempt died in
transport or capacity without reaching the drafter.

One fair try, one mechanical failure. The condition is not met, and re-rolling
phrasings until one lands would not meet it either.
