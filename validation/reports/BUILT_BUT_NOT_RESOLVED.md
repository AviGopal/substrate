# Built but not resolved: a fan-out that credited itself for bytes nobody received

A shared package can be correctly rebuilt, atomically swapped, and verified
present in the shared build while every consumer that matters keeps running the
previous version — and every gate in the path reports success. This document
records the mechanism, because the failure is invisible to health checks by
construction and the marker written on success disarms the retry designed to
catch it.

## The shape of the defect

`substrate-pull-sync.sh` rebuilds a shared package's `dist`, swaps it atomically,
restarts each consumer staggered, health-gates each restart, and on success
records `LAST_GOOD=$HEAD`. The correctness of the whole sequence rests on one
sentence in its own comment:

> consumer symlinks are absolute, so this propagates by reference

Measured for `@avigopal/ias-executor-ts`:

| consumer | real files in `dist` | symlinks |
|---|---|---|
| development-vessel | 0 | 164 |
| ribosome-vessel | 164 | 0 |
| goal-host-vessel | 164 | 0 |
| analysis-vessel | 164 | 0 |
| llm-resolver-vessel | 164 | 0 |
| local-tools-vessel | 164 | 0 |

The premise holds for one consumer in six. For the other five the swap is a no-op.
The bounce restarts them onto identical bytes. They return healthy — because a
process running stale code is perfectly healthy — so the run logs `fan-out
healthy`, writes `LAST_GOOD`, and moves on.

**Health cannot witness this failure.** It is not that the check was weak; it is
that the check answers a different question than the one that matters. The
question is "did the bytes arrive", and liveness has no opinion on it.

## Why it persisted rather than self-correcting

The path contains a mechanism built for exactly this: a dist-freshness retry that
re-enters the fan-out when the last successful fan-out `HEAD` differs from the
current one. It never fired, because the fan-out reported success and wrote
`LAST_GOOD=$HEAD`.

The run that left the dist stale is the run that disarmed the detector for stale
dist. That is the general form worth carrying: **a success marker written on the
wrong evidence does more damage than no marker, because it also silences the
retry.** Observed duration: eleven days (shared build Aug 16 23:33, consumer
copies Aug 5 23:36).

## What it cost

`ribosome-vessel` is the vessel that mints activity templates, and `goal-host-vessel`
executes the synthesis. Both were on the stale side. Every change to any
`ias-executor-ts` template or source over eleven days was inert in them: present in
the repository, present in the shared build, and absent from behavior.

The rule that exposed this was an addition to `ribosome-extract.json` requiring
synthesized templates to carry an accurate top-level `input_shapes`. It merged,
built, was verified present in the shared `dist`, and reached zero mints — the
first observation that something in the path was lying.

The instructive part is that every intermediate check passed honestly. The commit
landed. The build succeeded. The artifact contained the rule. The consumers were
healthy. Each answer was true, and the conjunction was false.

### Correction: the rule was accurate, not load-bearing

The diagnosis that motivated the rule was wrong, and the measurement that
disproved it is worth more than the rule.

The claim was that `input_shapes: []` on every learned composition denied them
alpha credit and drove their posteriors to zero. Computing the true external input
of each learned composition — union of every task's `inputShapes` minus every shape
produced by an earlier task in the same chain — gives:

    self-contained (`input_shapes: []` is CORRECT):   37
    genuinely consume an external shape:               1

The obvious objection is that this measures a missing key rather than real
topology. It does not: 67 of 115 learned-composition tasks (58%) declare a
non-empty `inputShapes`, and the four-task chain resolves as a clean
producer→consumer sequence —

    task 0  in=[]                          out=[vessel_health_report]
    task 1  in=[vessel_health_report]      out=[discovery_vessel_registry_observer]
    task 2  in=[discovery_vessel_registry_observer] out=[shellResult]
    task 3  in=[shellResult]               out=[memoryNote_write]

— where task 0's empty input is a generator, not an omission.

**37 of 38 are self-contained by construction.** They begin at a generator (a shell
command, a fetch) and end at a sink, so they consume nothing from outside
themselves and the empty field is the right answer. `input_shapes: []` was never
the anomaly it looked like — it is what a correct extractor produces for the kind
of chain this substrate mostly builds.

Alpha credit is in fact flowing (`alpha-credited last pick satisfier:…`).
Withholding is confined to single-step satisfiers with no in-chain
producer→consumer edge, which is the gate behaving as designed.

Rule 9a stands because it makes the field accurate for the one composition that
does take external input, and for future ones. It is not the ceiling lever it was
introduced as. The ceiling question — why learned compositions are rarely reused —
remains open and is not answered by this field.

The propagation defect above is independent of that error and is the durable
finding here.

## The fix

Two changes, both in the fan-out:

1. **Propagate by content.** After the swap, copy `dist` into any consumer that
   does not resolve to it, matching the layout that consumer already has rather
   than converting it.
2. **Credit only verified arrival.** Before writing `LAST_GOOD`, hash the shipped
   artifact at each consumer against the shared build. On mismatch, withhold the
   marker, emit a gap, and let the next tick re-enter the fan-out.

The gate now asks whether the bytes arrived.

**Verified live, not merely committed.** The unit runs
`/usr/local/bin/substrate-pull-sync`, which self-installs from the super-repo; that
executed file carries the new `FAN-OUT UNPROPAGATED` path. This check was not
optional — a propagation fix that reached the repository and not the running copy
would have been an instance of the defect it fixes. (A stale `substrate-pull-sync.sh`
sits beside it in `/usr/local/bin` and is *not* what executes; grepping the
plausible-looking name returns 0 and would have read as "the fix never landed.")

This was a direct edit rather than a dispatched goal, deliberately: the
propagation path cannot repair itself through the propagation path it is broken
in. A goal landing the fix would have mirrored it to `src` and left every consumer
on the same stale `dist`.

## Class, and the detector that does not exist

This is the third distinct member of a family already recorded on this substrate:

- **write ≠ read** — a producer writes a key no consumer reads.
- **half-wired channel** — a reader ships without its producer.
- **built but not resolved** — an artifact is built correctly and no consumer
  resolves to it.

All three share one structure: a stage verifies what it can observe and never
verifies that the next stage received it. The general detector — for every
declared producer/consumer link, assert the consumer actually resolves the
producer's current output — does not exist. Each instance has so far been found
by hand, after the fact, by someone asking why a correct fix changed nothing.

The operational tell is specific and worth reusing: **a fix that is present in the
repository, present in the build, and absent from behavior is a propagation
question, not a logic question.** Check what the running process resolves before
re-reading the diff.

## Compositional reach, as measured alongside this

Four dispatches, each graded by hand against ground truth captured *before*
dispatch:

| shapes | subjects | verdict | grading |
|---|---|---|---|
| 4 | goal-host, dev-vessel, healthy count, shape count | reached | all four facts correct |
| 2 | shape count, healthy count | reached | both correct, both with a producing step |
| 2 | four facts asserted | reached | facts true, but **2 of 4 had no producing step** |
| — | analysis-vessel, concept-db, + 2 counts | **failed, reached:false** | correct rejection — shell step errored, no reports produced |

The correct rejection matters as much as the reaches: the judge refused a chain
that produced nothing rather than narrating around it.

The third row is the concerning one and is filed as a gap: the oracle verified
`totalVessels=11` and the verdict credited four claims, two of which the chain
never measured. They were true by coincidence. Nothing in the substrate could have
distinguished that from fabrication — it was caught only because ground truth was
held externally.

### Depth is counted in distinct shapes, and I was testing the wrong axis

Depth beyond four shapes was not demonstrated by the dispatches above, and the
reason is a measurement error of mine rather than a substrate regression.

A five-fact goal — three vessel health reports plus two registry numbers —
inferred:

    inferred_target_shapes: ["vessel_health_report","shellResult","memoryNote_write"]
    confidence: 0.96

**Target shapes are a set, not a multiset.** Three health reports collapse to one
`vessel_health_report`. Adding more subjects of the same kind cannot increase
composition depth; it increases arity, which the walk correctly handles with a
single satisfier carrying multiple bindings. Three successive dispatches of mine
varied arity while depth is a function of distinct shapes, so they could not have
shown what they were built to show.

Two things follow. Escalating depth requires goals that genuinely need N distinct
shapes — a fetch, an extraction, a computation, a health probe, a registry read, a
sink — not N facts of one kind. And a "compositional pattern" claim should quote
the inferred target shapes, since that set, not the sentence count, is what the
walk will actually try to compose.

### The ceiling is a constant: `.slice(0, 3)`

Testing the corrected axis found the actual limit. A goal naming six distinct
capabilities — fetch a URL, extract a JSON field, count its digits by shell,
produce a vessel health report, read the registry shape total, persist a note —
inferred:

    inferred_target_shapes: ["shell","memoryNote_write"]   confidence 0.8, no alternatives

Two shapes for six capabilities. Set against the previous goal (five facts of one
kind → three shapes at 0.96), the relationship inverts: **the more distinct
capabilities a goal requests, the fewer target shapes are inferred.**

The cause is in `goal-target-inference.ts`, in both the cached path and the
LLM-parse path, and again for alternatives:

    ).slice(0, 3) as string[];   // :190
    ).slice(0, 3);               // :597, :613

**Inferred target shapes are hard-capped at three.** Chains of four steps were
observed only because the walk inserts intermediates behind the declared targets;
the declared target set itself cannot exceed three. Compositional depth is
therefore bounded by a constant, and no goal phrasing can raise it. Every
experiment above was measuring against a ceiling that no amount of goal authoring
could move.

This is also a **law 1 violation**. The cap is an in-process constant steering
runtime behavior: invisible to traces, unobservable through any shaped impulse, and
unlearnable — the loop cannot discover that a deeper target set would have reached
where a truncated one did not, because the truncation leaves no trace. The
`walkBudget` shaped policy already in `SHAPES` is the precedent for how a bound
like this should be expressed.

Filed as gap `target-inference-caps-depth-at-three`. The fix is to read the bound
from a shaped policy defaulting to the current value, so behavior is unchanged on
day one but becomes observable and tunable by the learning loop. It is deliberately
left to the substrate rather than hand-applied: this file is under
`repos/goal-host-vessel/src/`, code changes there are goals, and hand-completing it
would steal exactly the lesson law 6 reserves for the system.

Separately, the `REUSE-BEFORE-DERIVE` shortcut is **not** the depth suppressor it
first appeared to be. Reading it: it fires only when the recommended pathway is
*exactly* the floor, the goal is not an edit, and the goal does not request a
durable artifact — and it falls through to the full walk when the reused pathway
fails to reach. That is a correctly-guarded shortcut, and the one-step reuses
observed in the log belong to other dispatches, not to the multi-fact goals.

### Reviewed and found sound

The satisfier ordering was reviewed for architecture violations and is not one.
Vessel-resolve satisfies a missing shape by a real resolve call against a live
vessel *before* any candidate or bridge-authoring step, so the walk reaches a
vessel's actual capability rather than authoring a hollow wrapper that produces the
shape without doing the work. Derivation-deferral blocks a terminal emit while any
intermediate is unproduced, which is what stops a note being written from goal text
instead of from real findings. Compute-deferral orders `shellResult` behind the
intermediates whose output is its operand. `shellResult` being a near-universal
satisfier flattens chains, but it does so *after* shaped producers have been
offered, which is the floor behaving as designed rather than competing with the
ceiling.

## A refusal was pooled as content, and the goal went green

The depth-5 dispatch reached with a **three-step chain — exactly the inference
cap** — which confirms the ceiling above empirically. It also produced the sharpest
defect of the session.

`vessel_health_report` resolved to:

    {"resolved": false,
     "error": "vessel_id is required — refusing to report on an assumed vessel"}

That refusal is *correct*. It is a guard added earlier in this same session, after
the resolver was found defaulting to a hardcoded vessel and producing valid-looking
reports about a subject nobody asked for. It fired exactly as intended.

The walk recorded it as `REACH-CONTENT vessel_health_report`, graded the dispatch
`reached: true`, and persisted a note whose body contains the refusal text where
three health statuses should be. **Zero of the three requested health facts were
delivered and the verdict is green.**

The mechanism that exists to prevent this — `_degenerateReason` graded against the
shaped `bodyHonestyPolicy` — is healthy and would have caught it: the policy
resolves 200, its `errorFields` include `error`, and its `denialTextPattern`
matches both `required` and `refused`. The predicate is not the problem.

**Coverage is.** The walk log carries `VESSEL-RESOLVE SATISFIER produced …` for
`shellResult` and `memoryNote_write` — the path that calls the checker — and no
such line for `vessel_health_report`, which entered the pool by another route that
does not grade the body. The guard covers one path of two.

A second, narrower hole: `resolved` appears in neither `flagFields` nor
`truthyDenialFields`, so a bare `resolved:false` carrying no denial *text* would
pass even on the guarded path. This envelope was caught-able only because it also
carried prose.

Filed as `body-honesty-guards-one-route-only`. This is the same family as
everything else in this document — a mechanism that verifies what it can see on the
route it sits on, and never learns that another route bypasses it.

## The synthesis step discarded evidence it had already retrieved

The six-distinct-shape goal — fetch a star count, count its digits, probe vessel
health, read the registry shape total, persist one note — settled `reached: true`
with **zero** reach-content steps and a `goalReachReason` that merely restates the
goal ("The memory note containing the requested … was successfully written").

Graded against ground truth captured before dispatch:

| fact | truth | note | |
|---|---|---|---|
| star count | 95429 | 95429 | ✓ |
| digit length | 5 | 5 | ✓ |
| vessel health | healthy | "Unavailable (exit code 6)" | ✗ |
| shape total | 305 | "Unavailable (exit code 6)" | ✗ |

The digit length is quietly impressive: `wc -c` returns **6** because it counts the
trailing newline, and the note reports 5.

The two failures are the interesting part, because **the substrate had the
answer**. Its own reasoning records:

    shellResult: stdout "305\n"
      command: curl -s http://127.0.0.1:8100/registry/stats | jq .totalShapes
      exit_code: 0

It retrieved 305 with `exit_code 0` and then wrote "Unavailable (exit code 6)".
The `6` is the `wc -c` **output** of the *other* step, misread as an exit code —
and that misreading suppressed a value already in hand.

This is not a retrieval failure. Every fact was fetched successfully; two were
discarded while composing the answer. It is an information-at-point-of-use failure
(law 8) located in synthesis rather than in gathering, which is the harder place to
see it: the traces show clean successful fetches right up to the step that threw
them away.

Two further defects in the same dispatch. Reach was granted on the write with no
content grading — the write-shaped-goal class, again. And the goal said *persist
ONE memory note*; **two** were written, the second being the raw reasoning
scratchpad, so intermediate deliberation is leaking into the durable store as an
artifact.

Filed as `synthesis-discards-retrieved-evidence`.

## Correction: I never claimed the reserved compose slot

Operator-dispatched edit goals were being refused with
`[compose-cap] REFUSING autonomous compose: 1 in flight`, and the obvious reading
was lane starvation — the directed lane losing to autonomous work. That reading was
wrong, and three checks killed it in order:

- the compose slot directory was **empty** (zero slots held), so it was not slot
  exhaustion;
- `busy-refusals.jsonl` had **zero** entries for the day, so it was not the
  per-vessel guard;
- which left the in-flight cap, whose log line says `autonomous`.

The classifier is `pointer.directed === true`, fed from `operatorOrigin`, fed from
`trigger === "operator"`, fed from **`body.operator`** — a top-level request field:

    const operator = typeof body.operator === "string" && body.operator.length > 0 ? body.operator : undefined;

Every dispatch this session passed `tags: ["operator:avi", …]`. That tag is trace
attribution; it is not the origin declaration. The substrate classified the
dispatches as autonomous **correctly**, and correctly denied them the reserved
slot. There is no lane-starvation defect. The gap I was one step from filing would
have been fiction.

The near-miss is the lesson: the refusal message named the classification
(`autonomous`) rather than the reason, and I read a resource-contention story into
it. Reading the classifier before filing cost two commands and avoided asserting a
defect in a mechanism that was behaving exactly as designed.

Also worth recording as a *correct* verdict: the undirected edit goal that fell
through to the walk was graded

    HOLLOW — deterministic:edit-intent-no-landed-edit — an edit goal is reached only by
    an edit-result shape WITH landing evidence; β-penalised last pick

which is the honest behaviour this document is otherwise short of: a stub proposal
with no landed sha was refused rather than greened.

## The compositional ladder, run deliberately

With the axis corrected (distinct shapes, not facts) and ground truth captured
before each dispatch:

| rung | asked | chain | verdict | hand-grading |
|---|---|---|---|---|
| 2 | 1 fact | **3 steps** — `advertised_shape_coverage_scan` → `shellResult` → `memoryNote_write` | reached | `305` correct |
| 3 | 2 facts | **4 steps** — `vessel_health_report` → `discovery_vessel_registry_observer` → `shellResult` → `memoryNote_write` | reached | `305` and `healthy` both correct |

Rung 3's `vessel_health_report` is a real 1171-char report, not the 444-char refusal
envelope that contaminated the earlier depth-5 run. Composition increases across the
rungs (3 → 4 steps) with content verified correct at each — bounded above by the
`.slice(0, 3)` target cap documented earlier in this report.

**Rung 4 reached and should not have.** Four steps, `reached: true`, and:

    REACH-CONTENT shellResult (1223 chars) = The `node` command is not available…
    note facts: 11 ✓   healthy ✓   305 ✗ MISSING

A failed shell was pooled as content, and the shape total — one of the four
requested facts — was silently dropped. So the honest ladder is **2 valid rungs, not
3**, and the fourth is a false reach of exactly the kind this report documents.

### The cause is one missing token in a shaped policy

`shellResult` *is* on the graded path, so this is not the coverage gap from earlier.
The `bodyHonestyPolicy` denial pattern simply does not match the phrase. Tested
directly against the live regex:

    "The `node` command is not available in this environment"   → False   ← pooled
    "vessel_id is required — refusing to report…"               → True
    "command not found"                                         → True
    "resource unavailable"                                      → True

The pattern carries `unavailable` and `not\s+found` and misses `not available`. A
one-token widening (`not\s+(found|available|supported|permitted)`) closes it, and
**it needs no code change** — this is a shaped policy, which is the law-1-correct
surface for a behavioural bound.

Filed as `denial-pattern-misses-not-available`. Two notes for whoever applies it.
Enumerating phrases is a treadmill; the substrate should be able to *learn* this
class, since a denial phrase recurring in bodies that later fail their consumer is
itself the signal that the pattern is missing a term. And shaped policy files
currently live under a `POLICY_ROOT` inside a cleaned clone and are erased, so a
write may not survive until that standing blocker moves.

## The propagation fix, confirmed by the thing it fixes

After the fan-out change landed, the shared build and its consumers hash identically:

    ribosome-vessel   d70cfb9ab969
    goal-host-vessel  d70cfb9ab969
    shared build      d70cfb9ab969

Byte-identical across the copies that sat eleven days apart. This is the check the
fan-out now performs before crediting itself, and it is the check whose absence let
the staleness persist. Consumers are also visibly bouncing on convergence
(`goal-host draining for restart`), which is the fan-out restarting them after a
swap rather than silently leaving them on old bytes.

## Dispatching a fix through the sanctioned channel

With `body.operator` set, the edit goal reached feature_compose — no `BUSY`, and
`trigger: operator` confirmed on the record. It then failed, correctly:

    verdict: UNFAVORABLE, apply_failed, rolled_back
    no_unique_anchor: refused fs_edit — planned anchor is non-unique and
    re-derivation found no unique substring (would mislocate)

**The refusal is right and the goal was wrong.** I asked it to change three
*identical* `.slice(0, 3)` strings; those anchors are non-unique by construction,
and the guard against mislocating an edit is exactly what should fire. It rolled
back rather than writing to a guessed location — the failure mode that has
previously produced harmful edits on this substrate.

Re-posed against a verified-unique anchor: `).slice(0, 3) as string[];` occurs
**exactly once** in the file (counted against the live tree, not assumed), so the
single-site goal is anchorable. That is the standing lesson about giving a drafter
verbatim anchor text proven to occur once, and it applies to goals an operator
writes as much as to ones the substrate writes.

## Correction: `ActiveEnterTimestamp` is stale during a drain

goal-host began refusing every dispatch with `{"draining": true}` while `/health`
still returned `"status":"healthy"`. Sampled at that moment:

    ActiveEnterTimestamp = 00:39:35   (55 minutes earlier)
    NRestarts            = 0
    in_flight            = 5, flat across three samples
    drain_ms             = 240000, long since blown

That reads unmistakably as a soft outage — a process wedged in drain, refusing all
work, reporting healthy, invisible to every watchdog above `/health`. It is the
exact shape of a failure class already recorded on this substrate, which is
precisely why it was persuasive.

It was wrong. `MainPID` had already moved to a new process, and re-reading after the
transition settled gave `ActiveEnterTimestamp = 01:33:21`. The unit restarted
normally; the drain was an ordinary SIGTERM → refuse-new-work → drain → exit →
restart cycle.

**During a stop, `ActiveEnterTimestamp` and `NRestarts` still describe the OLD
activation.** They are not merely delayed — they actively describe a process that is
on its way out, so sampling them mid-drain reports the previous life as though it
were the current one. `MainPID` is the discriminator, and it costs one command.

This refines a standing rule rather than adding one: `is-active` is not evidence
that new code is running, and `ActiveEnterTimestamp` is not either unless the unit
is settled when you read it.

Recorded because this was the **second** fiction avoided in this session by checking
one more field before filing — the first being compose-lane starvation that turned
out to be an undeclared `body.operator`. Both would have been filed as substrate
defects. Both were artifacts of how I sampled.

## The compose lane reservation is correct, and I saturated it myself

The re-posed fix goal came back `reached: false`:

    refused for CAPACITY (BUSY) after one retry — no draft was produced, so there is
    nothing to judge and nothing to escalate; retry when a compose slot frees

Reading the allocator before blaming it, for the second time on this same mechanism:

    const effectiveCap = opts.directed === true ? cap : Math.max(1, cap - 1);
    // autonomous fills at most cap-1; directed may use the full cap.
    // At the default cap of 2 this is one slot each — neither lane can starve the other.

Autonomous work can never take the last slot; a directed compose can always claim it
**unless another directed compose holds it**. Several operator goals had been fired
in quick succession, so the directed lane was contended by *my own* dispatches. The
reservation did exactly what it was written to do.

Worth noting what the verdict did *not* do: it did not green a goal that produced no
draft. `no draft was produced, so there is nothing to judge` is the correct refusal,
and it is the third honest verdict recorded in this document against a background of
reach gates that were too generous elsewhere.

**Status of the depth-cap fix: not landed.** `MAX_TARGET_SHAPES` does not appear in
`goal-target-inference.ts`. It is dispatched, correctly routed
(`trigger: operator` → `directed` → reserved slot), correctly anchored against a
substring verified to occur exactly once, and waiting on capacity. It is not
hand-applied, and should not be: the file is substrate source, and the gap
`target-inference-caps-depth-at-three` carries the specification.

## Two recorded holes are closed, and the gate rejected my goal correctly

The fix goal finally got a slot, produced a draft, and was **rolled back by the
semantic gate**. Two evaluations of the same patch:

    02:19:51  addresses: true   "successfully introduces the constant and replaces the
                                 hardcoded literal, on an actively executing path"
    02:22:43  addresses: false  "changes a numeric literal to a constant but the
                                 constant's value equals the original value, resulting
                                 in no behavioral change"           → rolled_back

**The inert-diff detector fired and blocked.** This substrate's recorded history says
the opposite: an autonomous commit added an unused interface field, typechecked,
passed the reach gate, and closed a real gap. That hole is closed for this class — an
inert diff no longer buys a green.

Alongside it, in the same dispatch:

    reached-command cache: EVICTED 1e3e1f90 (reach graded false) —
      tombstone persisted so a prior boot's entry cannot resurrect

Cache eviction on a false reach also previously did **not** happen, which is how a
fabricated reach became a byte-identical replayed recipe. Both mechanisms now behave.

The rejection is also substantively right, and the fault is mine. I asked for a
behaviour-preserving rename — `MAX_TARGET_SHAPES = 3` used in place of `3`. That does
not fix the law-1 violation at all: a bound that is still hardcoded and merely *named*
is exactly as invisible to traces and as unlearnable as before. The gate declined a
patch that would have looked like a fix and changed nothing, which is the behaviour
this report has been asking for everywhere else.

Re-posed as the real change: `maxTargetShapes?: number` on
`InferGoalTargetShapesOpts`, with `opts.maxTargetShapes ?? 3` at each call site, so
the bound becomes caller-controllable and goal-host can supply it from the shaped
`walkBudget` policy — the same shape it already uses for other walk bounds, extended
rather than duplicated (law 3). That is a genuine capability change rather than a
rename, and it is the law-1-correct shape of the fix.

## The denial pattern, fixed at the shaped policy — and a second wrong copy

The rung-4 false reach was caused by one missing token in the `bodyHonestyPolicy`
denial pattern. Fixing it needed no code change, which is the point: the bound is a
shaped policy, and that is the law-1-correct surface.

Locating the file first exposed the same defect class as everything else in this
document. There are two copies:

    /workspace/policies/body-honesty-policy.json              truthyDenialFields: ["deferred","unreachable"]
    /workspace/git/super-repo/policies/body-honesty-policy.json   truthyDenialFields: []

The **richer** copy is the dead one. goal-host's workspace root is
`/workspace/git/super-repo`, so the leaner file is what the resolver serves —
confirmed by diffing the served body against both files rather than assuming which
was authoritative. Editing the maintained-looking copy would have changed nothing and
looked like a fix.

The served copy was widened, `not\s+found` → `not\s+(found|available|supported|permitted)`,
and the resolver now returns it. Verified against the real strings, checking both
that it catches the miss and that it does not start rejecting legitimate content:

    old=False new=True   "The `node` command is not available in this environment"   ← the miss
    old=True  new=True   "vessel_id is required — refusing to report…"
    old=True  new=True   "command not found"   /   "resource unavailable"
    old=False new=False  "the registry advertises 305 shapes"      ← real content, still passes
    old=False new=False  "healthy_vessels: 11"                     ← real content, still passes

A widened denial pattern that also swallows real answers would trade a false reach
for a false refusal, so the negative cases matter as much as the positive one.

**Caveat, and it is the real blocker:** the served copy lives inside
`/workspace/git/super-repo`, a managed clone. The edit is live now and may not
survive a convergence that cleans that tree. The durable fix is moving `POLICY_ROOT`
out of the work tree — the standing operator-gated item — and that the *dead* copy
sits in the safe location while the *live* one sits in the disposable one is
precisely the wrong way round.

## Rung 4, re-run: the honesty check fires, and the other route still wins

Re-running rung 4 against the widened pattern produced the cleanest evidence of the
session, because it is a controlled comparison inside a single dispatch. The shape
`vessel_health_report` was produced twice, by two routes:

    route 1 (vessel-resolve satisfier)
      → "satisfier vessel_health_report resolved a DISHONEST body —
         envelope carries error: vessel_id is required"        REJECTED ✓

    route 2 (activity)
      → REACH-CONTENT vessel_health_report (98 chars), entire body:
         {"producedBy":"activity:⟨learned-auto-bridge-vessel-health-report⟩",
          "executionId":"exec_57lengjz"}                        ACCEPTED ✗

The accepted body contains **no health data at all** — it is a pure provenance
envelope. Same shape, same dispatch, graded on one route and ungraded on the other.
That isolates the defect to route coverage and exonerates the honesty predicate,
which is exactly what the earlier evidence could only infer.

The honesty fix is working where it is wired. It is simply not wired everywhere, and
the ungraded route is the one that decided the outcome.

Consequences, hand-graded:

    note facts:  healthy ✓   305 ✗ absent   vessel count = 10, registry = 11

So **rung 4 is a false reach on the second attempt too**, for a different reason than
the first. The valid ladder remains two rungs.

### A second concern, recorded as a question rather than a finding

The reach reason claims `independently queried …/registry/stats.totalVessels=10`.
The live endpoint returned **11** on three samples spanning the dispatch, and the
producing body reported **10** — so the oracle's "independent" value matches the
produced output exactly and disagrees with the registry. That producing body is also
self-inconsistent: `total_registered_vessels: 10` alongside `vessels: []` and
`obsidian_vessel_count: 0`.

Either a transient dip coincided precisely with the produced value, or the oracle is
reading the produced output rather than querying — which would make it
self-confirming, and would explain why `deterministic:verified-registry-count` has
blessed so many of this session's dispatches. **This is not asserted.** Discriminating
it needs a deliberate test: dispatch against a registry held still and compare the
oracle's cited value with a snapshot captured independently. Recorded on the gap so
the test gets run rather than the suspicion inherited.

## The substrate landed the fix autonomously — and two of my claims were wrong

**A substrate-authored commit landed on the remote working branch with no operator
hands.** `78dbcd6`, author `Substrate Autonomous`, applied by
`apply_proposal_as_patch + vessel_mitosis_cutover`:

```diff
+  maxTargetShapes?: number;
-    ).slice(0, 3);
+    ).slice(0, opts.maxTargetShapes ?? 3);
```

Real, non-inert, typecheck clean (exit 0). That is the hard autonomy criterion from
`CLAUDE.md`, met — not "it fired", but a landed commit that does what was asked.

### Correction 1: I nearly reported a fabricated sha

`git cat-file` said the sha did not exist, in every clone I checked. It existed on
`origin/dev`; **my clone had not fetched**. The negative measured my own staleness,
not the substrate's honesty — on the single most consequential claim of the session.
Before believing a negative, run the query that would show a positive: here that was
one `git fetch`.

### Correction 2: the inert-diff detector fires, and does not block

This retracts what was committed earlier in this document. The gate fired, but the
sequence is:

    02:19:51  semantic-gate  addresses: true
    02:21:30  mitosis-cutover  pending-land stamp  gap=route-edit-1e3e1f90  sha=a73e9eb4ee12   ← LANDS
    02:22:43  semantic-gate  addresses: false  "no behavioral change"  → rolled_back
    02:25:37  reach graded false, reached-command cache evicted

**The commit landed a minute before the gate rejected it.** The rollback reverted the
worktree; `a73e9eb` is on `origin/dev`. So the inert change shipped *because the gate
runs after the applier* — land-then-gate rather than gate-then-land.

The consequence is visible in the landed file: `a73e9eb` inserted
`const MAX_TARGET_SHAPES = 3;` **inside a JSDoc block comment** at line 16, where it
is inert text corrupting the module's documentation, and a later commit added the
real declaration at line 48. Typecheck passes, so nothing downstream catches it.

This is the same family as everything else here — the check exists, is correct, and
sits on a path that is not the one deciding the outcome. Filed as
`semantic-gate-runs-after-the-commit-lands`.

### Where the cap now stands

    line  16  const MAX_TARGET_SHAPES = 3;        (inside a comment — inert)
    line  48  const MAX_TARGET_SHAPES = 3;        (real)
    line 193  .slice(0, MAX_TARGET_SHAPES)        ✓
    line 600  .slice(0, opts.maxTargetShapes ?? 3) ✓ caller-controllable
    line 616  .slice(0, 3)                         still hardcoded (alternatives)

The bound is now overridable on the LLM-parse path. No caller passes it yet, so the
effective cap is still 3 until goal-host supplies it from `walkBudget`.

## Retraction: the oracle is independent

Earlier this document raised, as a question rather than a finding, whether
`deterministic:verified-registry-count` might be reading the produced output rather
than querying — which would have made it self-confirming and would have undermined
every reach it blessed today. The question is now answered, by a failure:

    RUNG 5 → reached: false
    deterministic:wrong-registry-count — independently queried registry totalVessels=11,
    but the output reports 1 (the self-graded value does not match the authoritative registry)

The oracle queried, got **11** — matching ground truth captured independently — and
**rejected** the dispatch. A self-confirming oracle cannot produce that outcome: it
would have blessed whatever the walk produced. The suspicion is withdrawn, and the
earlier rung-4B discrepancy (oracle citing 10 against a registry reading 11) is best
explained as a transient rather than as a broken oracle.

Recording this because the suspicion was committed to this document, and leaving a
retracted doubt about a verification mechanism standing is worse than never raising
it. The reason it was raised as a question rather than a finding is exactly why it
cost nothing to withdraw.

## Where compositional depth actually stands

Two suppressors, and only one of them was the `.slice` cap.

The landed change makes the bound overridable, but **no caller passes it**, so the
effective ceiling is still 3. The single call site is
`inferGoalTargetDecision(goal, knownShapes, {…})` in `index.ts`, which already takes
`InferGoalTargetShapesOpts` and therefore already accepts `maxTargetShapes` — it just
does not supply one. That is dispatched.

Reading that function also surfaced a second mechanism worth tracing separately: its
fallback decision collapses any goal matching
`compute|calculate|how many|number of|count|…` to the single shape `["shellResult"]`
at confidence 0.4 when `shellResult` is available. Several of this session's goals
contain "how many". A fallback that reduces a multi-part goal to one target shape is
a composition suppressor that looks, in the logs, like a low-confidence inference
rather than a degraded path.

## The depth cap was three redundant constraints, and the fix hit the wrong one

The landed `maxTargetShapes` change is real, correct, and made **no observable
difference**. With `maxTargetShapes: 6` live in the running process (mirror updated
02:48:23, vessel restarted 02:51:57), a four-shape goal still inferred three:

    inferred_target_shapes: ["vessel_health_report","memoryNote_write","shellResult"]

Because the binding constraint is in the prompt, not the code:

    Return the 1-3 shapes from the KNOWN list whose production best satisfies the goal.
    … and up to 2 ALTERNATIVE framings, each 1-3 shapes from the KNOWN list.

The model is *instructed* to return at most three. `.slice(0, 3)` was a redundant
guard on an already-capped prompt, so raising it changed nothing the model would ever
produce.

Three suppressors, ordered by which actually binds:

1. **the prompt's "1-3 shapes"** — binding
2. the fallback decision collapsing `compute|calculate|how many|number of|count`
   goals to a single `["shellResult"]` at confidence 0.4
3. `.slice(0, 3)` — now overridable, and irrelevant while (1) holds

This is a distinct failure class from the propagation defect that opens this report,
and worth separating. There the fix was correct and never arrived. Here the fix
arrived, is running, and targets a constraint that was never the one binding.
**Redundant guards make a fix look inert when it is merely aimed at the wrong
one** — and the observable symptom is identical, which is why the first instinct was
to suspect propagation again.

The prompt change is dispatched with an anchor verified unique
(`each 1-3 shapes from the KNOWN list`, one occurrence — the shorter phrase
`Return the 1-3 shapes` occurs twice and would have been refused, as an earlier goal
in this session was).

## Verification that reads a clone which has not pulled

The caller change was graded `reached: false` — "landed 230e711… but the requested
symbol is NOT observably present in `repos/goal-host-vessel/`" — and the change was
**correct**: one file, one insertion, `+        maxTargetShapes: 6,` at
`index.ts:10569`, inside the options object beginning at 10567.

Copies at grading time:

    /vessels/goal-host-vessel/src/index.ts                          contains the symbol
    /workspace/git/super-repo/repos/goal-host-vessel/src/index.ts   does NOT

The verdict names the super-repo layout, so the check read the staged clone, which
was behind `origin/dev`. A correct change graded false by reading a stale copy.

The consequence is not just a wrong label. The gap stays open, the arm that actually
succeeded is β-penalised, and the work is re-attempted — which is directly observable
here: `MAX_TARGET_SHAPES` was landed **twice**, by `c632117` and `a73e9eb`, and one of
those insertions fell inside a JSDoc comment. **A false-negative verifier manufactures
duplicate commits.** Filed as `inert-check-reads-a-clone-that-has-not-pulled`.

## The compositional ladder, final state

Every fact hand-graded against ground truth captured **before** dispatch.

| goal | chain | verdict | grading |
|---|---|---|---|
| 1 fact | 3 steps | reached | `305` ✓ — **valid** |
| 2 facts | 4 steps | reached | `305` ✓ `healthy` ✓ — **valid** |
| 2 facts (repeat) | 3 steps | reached | `305` ✓ `healthy` ✓ — **valid, reproducible** |
| 4 facts | 4 steps | reached | **FALSE REACH** — failed shell pooled as content, `305` dropped |
| 4 facts (repeat) | 4 steps | reached | **FALSE REACH** — contentless stub via ungraded route |
| 3 facts + compute | — | **failed** | correct: oracle queried 11, output said 1 |
| 3 facts + fetch | — | **failed** | correct: two facts landed, `305` missing, refused |

**Two valid rungs, and the second is reproducible.** Composition demonstrably
increases from 3 to 4 steps with content verified correct.

The trajectory across the session is the part worth keeping. Early deep attempts
produced *false* reaches — incomplete work graded green. The last two produce *honest
failures* on the same shape of incompleteness. That is the direction the reach gate
should move, and the widened denial pattern is part of why.

What still blocks a genuine fifth rung is now known precisely, and it is not what the
first half of this report assumed: the prompt instructs the model to return 1-3
shapes, so no code-level bound can raise the ceiling until that text changes. The
`.slice` was never the binding constraint.

## A unique anchor is not the same as the right anchor

The prompt fix landed — `5e02d505`, on `origin/dev` — and did not move the ceiling.
The prompt line contains two bounds, and the landed change hit the wrong one:

    line 556:  "Return the 1-3 shapes"    ← primary instruction, UNCHANGED — this is what binds
               "each 1-6 shapes"          ← alternatives clause, raised

This is my error, and a transferable one. Both clauses read `1-3`, so
`Return the 1-3 shapes` occurred **twice** in the file (lines 156 and 556) and would
have been refused as non-unique — an earlier goal in this session was refused for
exactly that. `each 1-3 shapes from the KNOWN list` occurred once, so I anchored
there. **I chose the anchor that was easy to target rather than the one that
mattered.**

That is the same failure as a drafter picking an anchor far from the edit site, which
this substrate has done before and which is recorded as a known class. The standing
rule — give a drafter verbatim anchor text proven to occur once — turns out to be
necessary and not sufficient. Uniqueness makes an edit *land*; it does nothing to
make it land *where it changes behaviour*. The two properties have to be checked
separately, and the cheap way is to construct a longer anchor spanning the binding
site rather than accept a short one that happens to be unique.

Re-posed with an anchor that is both: the full sentence
`Return the 1-3 shapes … Also provide a confidence value`, which spans the primary
clause and occurs exactly once because line 156 continues differently.

## The ceiling moved

With the primary clause raised (`705f1eac`, mirrored 03:03:32, vessel restarted on
the new code) a five-part goal inferred:

    inferred_target_shapes: ["vessel_health_report","json_path_extract",
                             "memoryNote_write","concept_write","shellResult"]
    confidence: 0.9

**Five target shapes.** The hard maximum for this entire session, across every
phrasing tried, was three. This is the empirical confirmation that the prompt clause
was the binding constraint — not the `.slice(0, 3)` that the first half of this
report treated as the ceiling, and not the alternatives clause the first prompt fix
happened to raise.

The sequence is worth keeping intact, because each step looked like the answer:

1. `.slice(0, 3)` — found, filed as a law-1 violation, autonomously fixed, **no
   effect**: a redundant guard on an already-capped prompt.
2. caller not passing the bound — found, fixed, **no effect**: the model still
   obeyed the prompt.
3. alternatives clause `each 1-3` — raised, **no effect**: not the primary
   instruction.
4. primary clause `Return the 1-3` — raised, **ceiling moved 3 → 5**.

Three of the four changes were correct, landed, verified live, and behaviourally
inert. Only the fourth bound. A stack of redundant limits means every fix but the
last produces exactly the symptom of a broken deployment — and the deployment was
fine each time.

## Depth 5, executed: honest failure with a misattributed reason

The five-shape goal inferred five targets and did **not** reach. The persisted note,
verbatim:

    Vessel health status: Retrieval failed;
    Total advertised shapes: Retrieval failed;
    Stargazers count: 95432.

Against ground truth captured before dispatch (stars 95432, shapes 305, goal-host
healthy):

- the live HTTP fetch plus JSON field extraction — the hardest step — is **exact**;
- the two local retrievals **abstained honestly** rather than inventing values;
- `reached: false` is the **correct** verdict, since two of three facts were not
  obtained.

Three behaviours here are the ones this report has been asking for all along: no
fabrication, no partial credit, and a refusal that names itself.

The defect is in the explanation. `goalReachReason` says *"The stargazers_count
extraction failed, resulting in an incorrect value being recorded in the memory
note"* — blaming the one component that worked perfectly and exonerating the two that
failed. That is not cosmetic: the reason seeds repair goals and grades which activity
underperformed, so a misattributed reason points repair at a healthy component and
leaves the broken ones uncredited. Filed as `reach-reason-blames-the-wrong-fact`.

The check that would close it is mechanical rather than judgemental: derive the reason
from which requested facts are present in the artifact, which is checkable, instead of
from free text about what went wrong.

**So the honest final position on depth:** the ceiling is demonstrably raised — five
inferred target shapes where three was the hard maximum all session — and a *valid*
reach at that depth is not yet demonstrated. The two valid rungs stand at 3 and 4
steps. What changed is that deeper attempts now fail honestly and legibly instead of
reaching falsely, which is the precondition for fixing them.

## The fourth constraint: the walk could not afford five targets

Raising the prompt let the walk *aim* at five shapes; it could not *execute* five.
`walkBudget` resolved `false` — "no walk budget configured — consumer keeps its
literal fallback" — and the literal is:

    let MAX_ITERS = 4;

Four iterations cannot satisfy five targets, which is exactly the observed result:
one fact of three, and the failures were the two **local** retrievals while the
**external** HTTP fetch succeeded. That asymmetry is backwards from difficulty and is
the tell — it is a budget symptom, not a capability symptom.

The fix required no code. `walk-budget.ts` documents both the mechanism and the trap:

> Until a producer for `walkBudget` exists, ufResolveUrl returns null and the
> fallback line is the standing demand signal for minting one.

> ★ WORKSPACE_ROOT IS NOT /workspace. goal-host's unit carries
> `WORKSPACE_ROOT="/workspace/git/super-repo"`. Seeding at `/workspace/policies/`
> yields a perfectly honest 404 that looks exactly like a broken reader.

That second warning is the same wrong-copy trap that the `bodyHonestyPolicy` fix hit
earlier in this report — documented in advance, in the module, by whoever hit it
before. Confirmed against the unit's actual environment rather than assumed, then
seeded at `/workspace/git/super-repo/policies/walk-budget.json` with a single field:

    {"max_iters": 8}

Only `max_iters`, deliberately: the consumer keeps its literal for every absent field,
so this changes one variable and leaves timeouts and call limits untouched (law 12).
The walk now logs

    floor: walkBudget SHAPED iters=8 calls=8 iterMs=90000 wallMs=210000

instead of the fallback line — so "the budget was shaped" is an observable fact, which
is what the reader was built to make possible.

**Four constraints, in the order they bind:** the prompt's shape count, the walk's
iteration budget, the fallback that collapses `how many` goals to one shape, and the
`.slice` that was never binding at all. Each was invisible behind the one in front of
it.

## Depth 5 with the budget raised: two new defects, neither of them depth

Raising `max_iters` to 8 did **not** produce a valid five-shape reach. It produced a
clearer failure, and the walk log names both causes.

### An unrendered template placeholder ate two facts

    HOLLOW-CONTENT shellResult (649 chars) =
      {"shape":"shellResult","stdout":"Vessel health status: {{vessel_health_re…

The synthesized shell command shipped with `{{vessel_health_report}}` never
substituted, so it echoed template text instead of executing against data. Hence
"Unknown (unable to retrieve)" for both local facts in the note.

The data was **not** missing. The same walk logged
`HOLLOW-CONTENT discovery_vessel_registry_observer (2306 chars)` of real content.
Interpolation lost something the walk had already fetched — an
information-at-point-of-use failure (law 8) in assembly, not retrieval. Same shape as
the earlier "wrote Unavailable over a value it held with exit code 0", and a known
class here: a drafter self-edit once wrote an unrendered `{{…}}` into byte 0 of
`feature-compose.ts` and crash-looped development-vessel.

The detector that generalises both is mechanical: **no synthesized command or written
artifact may contain an unsubstituted `{{ }}` token.** It would have caught both at
synthesis, before the value was lost. Filed as
`unrendered-template-placeholder-in-synthesized-shell`.

### The judge failed an exactly-correct value

    HOLLOW-CONTENT shellResult (177 chars) = {"shape":"shellResult","stdout":"95432\n",…}
    HOLLOW — "The execution failed to provide the correct stargazers count,
              returning an incorrect value."; β-penalised

Ground truth captured before dispatch: **95432**. The stdout is byte-identical.

This is a **false rejection** — the mirror image of the false reaches this report
documents, and worse for learning, because it punishes the behaviour we want. Two
harms: the goal fails despite delivering the requested value, and the producing arm is
β-penalised, so Thompson selection learns *against* a resolver that answered exactly
right. It reproduces: dispatch `34e0c8f8` blamed the same component for the same
non-failure.

The correct verdict for this dispatch was still `reached:false` — two other facts were
genuinely lost — but for the wrong reason and aimed at the wrong component. A reason
derived mechanically from which requested facts appear in the artifact would have
failed it correctly *and* credited the fetch. Filed as
`judge-graded-an-exactly-correct-value-incorrect`.

**Neither defect is about depth.** Both would fire at two targets. Raising the ceiling
did not create them; it made them visible by giving the walk enough room to reach the
assembly and grading steps where they live.

## Raising the cap permits depth; it does not compel it

With the prompt at `1-6` and the budget at 8 iterations, inference is now *variable*
rather than *capped*. The same class of goal produced:

    5 shapes: ["vessel_health_report","json_path_extract","memoryNote_write",
               "concept_write","shellResult"]                        conf 0.9
    3 shapes: ["vessel_health_report","concept_write","shellResult"]  conf 0.8
              — dropping memoryNote_write despite the prompt's COMPOSITION RULE
                requiring the write shape whenever the goal asks to persist

That is a meaningful difference from the earlier state. Before, three was a ceiling no
phrasing could exceed. Now the model chooses, and sometimes chooses fewer shapes than
the goal requires — including dropping the persist clause the prompt explicitly tells
it never to drop.

A third defect surfaced in the same run, distinct from the two above:

    REACH-CONTENT concept_write (1170 chars) = {"success":true,"shape":"vessel_health_report",…}

`concept_write` was recorded as produced while its body is labelled
`vessel_health_report`. The pool credits a shape whose payload is a different shape —
a producer/label mismatch that would satisfy a target with content that does not match
it. Same family as the contentless stub accepted earlier: what satisfies a target is
not being checked against what the target means.

**The honest summary of the depth work.** Four ceilings were found and cleared — the
prompt's shape count, the walk's iteration budget, the caller not passing a bound, and
a `.slice` that never bound. Behind them are not more ceilings but *correctness*
defects: an unrendered template placeholder, a judge that fails exactly-correct values,
a shape whose payload does not match its label, and inference that drops a required
clause. None of these are depth problems; all of them would fire at two shapes. Raising
the ceiling did not cause them — it made them reachable, and therefore visible.

That is a real result, and it is not the result the standing goal asked for. The
demonstrated ladder remains **two valid rungs**.

## A valid composition, failed twice by regex precedence

This is the closest the session came to a five-shape reach, and the composition was
**correct**. Dispatch `bfccfee6`:

    GOAL   health report for goal-host-vessel; how many SHAPES the registry advertises;
           record a concept; persist ONE note stating both facts
    NOTE   "The vessel 'goal-host-vessel' is healthy. Its discovery registry advertises
            12 shapes. In total, the discovery registry advertises 305 shapes."
    TRUTH  healthy ✓   305 ✓   (and the incidental 12 is also true)

Every requested fact is right. The verdict was `reached: false`,
`deterministic:wrong-registry-count — totalVessels=11, but the output reports 127`,
and it fired **twice** — on the first attempt and again on the re-framed one — so it
is deterministic and this goal family can never pass.

The cause is one line:

    const field = /\bvessels?\b/.test(g) ? "totalVessels"
                : /\bshapes?\b/.test(g) ? "totalShapes"

The vessel test runs first and matches the word **anywhere**, including where it names
the subject of an unrelated clause — here, "a health report for **the vessel**
goal-host-vessel". The counted entity is *shapes*; the oracle graded against *vessels*.

### Sixth instance, and the guards kept encoding the symptom

The file already documents five prior instances of this oracle failing correct work,
and says so plainly:

> 97 wrong-registry-count verdicts were recorded in 24h.

> A false negative here is worse than a missed green: it teaches the learner that a
> working composition failed, which is precisely how a ceiling gets held down.

> The invariant is not "the path starts with `repos/`".

Each earlier fix guarded the *shape of the observed failure* — first a literal `repos/`
prefix, then any named filesystem tree. This instance names no tree, so every guard
passes through. The invariant that covers all six: **the compared field must come from
the noun attached to the counting clause** (`how many X` / `number of X` / `total X`),
not from the presence of a noun anywhere in the goal; when both nouns carry counting
clauses, abstain.

That last sentence of the file's own comment — that a false negative is how a ceiling
gets held down — is exactly what happened here, to the very ladder this session was
built to climb. The fix is dispatched with the field-selection line as anchor, verified
to occur once.

## The oracle fix landed, and a transient hypothesis was vindicated

`93b8feed` replaced the field selection with the invariant:

```diff
-  const field = /\bvessels?\b/.test(g) ? "totalVessels"
-    : /\bshapes?\b/.test(g) ? "totalShapes"
+  const counted = /\b(?:how many|number of|total)\s+(\w+)/i.exec(g)?.[1]?.toLowerCase() ?? "";
+  const field = /^vessels?$/.test(counted) ? "totalVessels"
+    : /^shapes?$/.test(counted) ? "totalShapes"
```

The compared field now comes from the noun attached to the counting clause, and an
absent counting clause yields `""`, no branch matches, `field` is `null`, and the
oracle abstains — the safe default the file's own comments argue for. Typecheck
exit 0.

The first attempt at this edit produced `TS1128: Declaration or statement expected`
and was **correctly rolled back** by the verify gate. Supplying the exact replacement
text rather than a description is what made the second attempt land — a delicate
multi-line ternary is not something to describe to a drafter.

### A defect I introduced, recorded rather than buried

My specified replacement contains an unreachable branch:

    : /\bhealthy\b/.test(g) && /^vessels?$/.test(counted) ? "healthyCount"

`counted === "vessels"` is already caught by the first branch, so `healthyCount` can
never be selected. "How many vessels does the registry report as **healthy**" now
grades against `totalVessels`. Both fields read 11 today, so it passes by coincidence —
which is exactly the kind of latent wrong-field bug this whole section is about, now
authored by me while fixing it.

### The registry counts genuinely move

Sampled during a goal-host restart:

    totalVessels: 10   totalShapes: 294   healthyCount: 10

goal-host deregisters while restarting, so the fleet counts drop. This **vindicates
the transient explanation** offered earlier for the rung-4B discrepancy, where the
oracle cited 10 against a registry reading 11 and self-confirmation was raised as a
possible cause. A vessel restart moves these numbers by exactly that amount. The
suspicion was withdrawn on other evidence; this is independent confirmation that
withdrawing it was right.

It also means **ground truth for any registry-count goal must be captured while the
fleet is settled**, and a dispatch that spans a restart can fail honestly through no
fault of the walk.

## A valid five-step reach, and the controlled comparison that produced it

`shapes5-9f4e` (`c2673ea7`) — **`reached: true`**, five REACH-CONTENT steps:

    vessel_health_report → shellResult → concept_write → memoryNote_write → activity_template

Verdict: `deterministic:verified-registry-count — independently queried
…/registry/stats.totalShapes=305`. **`totalShapes`**, not `totalVessels` — the field
the fix changed.

Hand-graded from the findings body, not the echoed reason preamble (the preamble
repeats the verdict text, so a substring match on it proves nothing):

    "overall_health":"healthy"                    ✓  ground truth: healthy
    {"shape":"shellResult","stdout":"305\n"}      ✓  ground truth: 305

This is the deepest valid reach of the session and it exceeds the previous best of
four steps.

### Why it counts as evidence rather than a lucky run

It is a controlled comparison. Dispatch `bfccfee6`, earlier, used the **same goal
shape and the same counted entity**, composed correctly, and was failed by the oracle
grading `totalVessels`. One variable changed — the field-selection predicate — and the
outcome inverted. The composition capability was present the whole time; the verifier
was the blocker, and fixing the verifier converted a rejected-but-correct composition
into a demonstrated reach.

### Caveat, recorded

The persisted note carries both facts as **raw produced artifacts** rather than a
prose sentence. The goal said "stating both facts", and rung 3's note stated them in
prose. The facts here are present and correct; the presentation is rawer. That is a
weaker satisfaction of the wording than the shallower rungs achieved, and it is worth
noting rather than smoothing over — a reader of the note gets the values, but has to
read JSON to find them.

## The substrate does not mine its own observations

186 of 200 gaps are `substrate_detected`, so detection exists. But **170 of 186 (91%)
are `missing_capability`** — all from one instantaneous event: the walk could not find
a producer *right now*.

Searching every gap for the defects sitting in the substrate's own logs today:

    wrong-registry-count / registry-count   → 0     (97 such verdicts/day, per its own source)
    walkBudget / max_iters / unshaped       → 0     (fallback logged on EVERY walk)
    propagation / stale dist                → 0
    unrendered placeholder / {{             → 0

Zero. The system detects *"I cannot do X now"* and never *"I have done X wrong 97
times."* The sharpest instance: `walk-budget.ts` states that the fallback log line
**is the standing demand signal** for minting a producer. That line is emitted on
every walk and read by nothing — the written-never-read class applied to the demand
signal itself.

Close rate, which is law 7's actual progress metric: **9 closed / 191 open**.

The missing detector is not another one-off. It is the general form: **mine
accumulated traces and logs for recurring defect signatures**, as distinct from the
in-band, single-event detector that produces 91% of current gaps. Exactly one
trace-derived detector exists (`pull-sync-test-regression`), which shows the shape is
achievable and simply has not been generalised.

## The regression gate cannot detect regressions

That one trace-derived detector flagged commit `09b670144d`:
`178 fail/1078 pass → 190 fail/1118 pass`.

Checked rather than dismissed: the added tests pass 8/8 in isolation, and every
failure in the touched directory is a single env-config class. Measuring the whole
suite:

    167 fail / 626 tests across 121 files    (27% baseline failure rate)
    242 occurrences of "SURREALDB_NAMESPACE environment variable is required"
    only 4 of 121 test files set that variable in-file

The convention exists and four files follow it; 117 depend on the variable being
exported ambiently — true on a developer shell, false in the gate.

Two consequences. The gate **misattributed** a regression to a commit whose own tests
pass, which teaches that a correct change regressed. And a genuine one-to-five test
regression is **invisible** beneath 167 pre-existing failures, so the gate provably
cannot do the job it exists for. Filed as
`regression-gate-baseline-is-167-failures`; the fix shape is to compare per-test
identity rather than aggregate counts.

## 127 is an extraction defect, and the fix already exists in this codebase

With field selection corrected, `rep5-2c8a` still failed:

    deterministic:wrong-registry-count — totalShapes=368, but the output reports 127

Correct field, wrong extraction — which **isolates** this as a scan defect rather than
a selection one, something the earlier evidence could not separate. It reproduces:
`bfccfee6` produced the identical 127 against a different expected value. Both chains
contain a `vessel_health_report`, whose body always carries
`"endpoint":"http://127.0.0.1:8210"`.

So the claimed-value scan reads **127 out of the loopback address**. Because a health
report *always* carries an endpoint, this deterministically blocks any composition
that includes one — the exact goal family used to demonstrate compositional reach.

**The sanitiser already exists here** (law 3): the ephemeris oracle strips UUID-shaped
runs and ISO timestamps before scanning, with a test pinning that a dispatch id and a
timestamp are not read as measurements. The registry oracle does none of it. Filed as
`claimed-value-extractor-reads-numbers-out-of-addresses` — reuse the existing
sanitiser, extended to dotted-quad addresses and `host:port`.

## A false reach caught by reading the artifact, and closed at the policy

The six-shape dispatch reached `true` on the judgement *"All required outputs were
produced with meaningful content that fulfills the goal's intent."* The note was
missing the star count entirely. The producer had been honest:

    {"success":true,"shape":"json_extracted_value",
     "body":{"value":"","path":"$.body.stargazers_count","missing":true,
             "reason":"null/undefined encountered at segment: $"}}

`missing: true`, empty value, an explicit reason — wrapped in `success:true` and
recorded as REACH-CONTENT. The honesty checker let it through because `missing` was
not in `truthyDenialFields` (the served copy held `[]`).

Fixed at the shaped policy, no code change: `truthyDenialFields` now
`["missing","deferred","unreachable"]`.

Two things deliberately **not** done, both of which would have traded a false reach
for a false refusal:

- `reason` was **not** added to `errorFields`. It carries benign explanatory text
  throughout this system — including the reach reason itself — so it would reject
  valid content.
- `truncated` was added speculatively and then **removed**, having no supporting
  evidence and a plausible benign meaning.

## The policy fix converted a false reach into a valid one

Same goal, re-run against `truthyDenialFields: ["missing", …]`:

| | before | after |
|---|---|---|
| verdict | reached (false reach) | reached |
| star count in note | **absent** | **95432** — exact |
| shapes total | 368 ✓ | 368 ✓ |
| vessel health | claimed | `overall_health: healthy`, real 6429-char report |

Ground truth captured before dispatch; live check confirms `development-vessel-local`
returns `status: ok`. A `DISHONEST` rejection also fired mid-walk on a
`vessel_health_report` carrying a `vessel_id` error, so the checker is now doing work
on this path rather than waving envelopes through.

That is a **valid reach carrying three facts**, one of them a live external API value
matched to the digit — the most demanding by fact count in this session.

### But depth did not increase, and the reason is worth stating

Real produced shapes: `vessel_health_report → shellResult → memoryNote_write` — **3**.
Two further REACH-CONTENT lines are `goal` and `dispatch_id`, which are pass-throughs
and should not be counted as composition. The walk collapsed both HTTP fetches into a
single shell:

    curl .../registry/stats | jq .totalShapes;
    curl -s https://api.github.com/repos/oven-sh/bun | jq .stargazers_count;
    echo "Vessel development-vessel-local is healthy"

**The walk optimises to the minimum sufficient chain.** That is correct behaviour —
one shell doing two fetches is cheaper than two shaped producers — but it means
*shape-count depth is a poor proxy for capability*. A goal with five clauses is
satisfied by a three-shape chain because the shell is a universal executor.

One caveat inside the win: the health line was `echo`-ed as a literal, so had the
vessel been unhealthy the echo would have said "healthy" regardless. It is only
non-fabricated because a real `vessel_health_report` for the correct vessel was
independently produced in the same chain and agrees. A goal whose sole evidence was
that echo would have been a fabrication that graded green.

## The 127 blocker is cleared, and the blocked goal class now reaches

`ae39e6cf` added two strip passes to the registry oracle's claimed-value scan:

```diff
+    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, " ")
+    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, " ")
```

Verified before deploying, not after:

    before: ['127','0','0','1','8210','368']    ← 127 first; this is what failed dispatches
    after : ['368']                              ← only the real value survives
    tsc --noEmit → exit 0
    landed at the registry oracle (\d{1,7}); the git-commit sibling (\d{1,9}) untouched

Result on the goal class that was deterministically impossible:

    POST-SANITIZE  reached: true
    deterministic:verified-registry-count — totalShapes=368; the produced output matches

Hand-graded from the findings body — both facts **derived**, not incidental:

    shellResult stdout        {"totalShapes": 368, …}        live query
    vessel_health_report      goal-host-vessel, healthy      real report, correct vessel
    note prose                "The vessel goal-host-vessel is healthy, and the discovery
                               registry advertises a total of 368 shapes."

Ground truth captured post-settle: 368 shapes, goal-host healthy. Both correct, and
stated in **prose** rather than raw JSON — a stronger satisfaction of "stating both
facts" than the deeper 5-step reach achieved.

### What the whole 127 arc actually shows

Three oracles carried three private copies of a partial sanitiser. Fixing the registry
copy removed a deterministic false rejection that had been failing correct
compositions whenever a `vessel_health_report` appeared in the chain — and a health
report *always* carries an endpoint address, so the blocker was structural for the
exact goal family used to demonstrate composition.

The class gap (`three-oracles-duplicate-a-partial-numeric-sanitiser`) is filed rather
than fixed, deliberately: the instance was blocking a measurement, the refactor is
not, and expanding scope mid-verification is how a fix stops being attributable.

## Why depth and validity keep trading off: oracle coverage degrades with depth

Two dispatches reached with **four real produced shapes** — the deepest of the session
— and both delivered **2 of 3** requested facts:

    92b45f37   asked  goal-host health · 368 shapes · 95432 stars
               got    healthy ✓  368 ✓  95432 ✗ ABSENT
               reason explicitly enumerates all three, including stargazers_count

    53ac7dc1   asked  dev-vessel health · goal-host health · 368 shapes
               got    368 ✓  dev-vessel healthy ✓  goal-host report ✗ MISSING
               verdict deterministic:verified-registry-count on totalShapes=368

`53ac7dc1` is the clean case. The oracle checked **one** quantity, correctly, and the
verdict credited a goal that asked for **three**.

That is the structural coupling this whole session kept running into without naming
it: **a deterministic oracle verifies one quantity while the verdict credits the whole
goal.** At one or two requested facts the oracle covers most of the goal and verdicts
are trustworthy — which is exactly why the shallow rungs verified cleanly. At three or
more it covers a third and rubber-stamps the rest.

So depth and validity are not two independent problems. The verified *fraction* is the
coupling term, and it falls as depth rises.

The consequence for the learning loop is worse than a wrong answer: false reaches
become **more likely as compositions get deeper**, so the posterior rewards depth
precisely where verification is weakest, and the traces teach that under-delivering
compositions succeeded.

Fix shape (unchanged, now with a measured depth dependence): bind each asserted fact
to a producing step, or make the verdict **name the requested facts it did not check**,
so the shortfall is visible in the trace instead of hidden behind one verified
quantity.

## Correction: the facts were never targeted, not merely unverified

The section above attributes the two deep false reaches to oracle coverage falling
with depth. **That mechanism is wrong**, and checking the target sets shows why:

    92b45f37   inferred targets: ["vessel_health_report","memoryNote_write"]  conf 0.98
               the GitHub fetch clause was NEVER TARGETED
               both targets produced → shape coverage COMPLETE

    53ac7dc1   inferred targets: ["vessel_health_report","concept","memoryNote_write","shellResult"]
               all four produced → shape coverage COMPLETE
               goal asked for TWO health reports; vessel_health_report is ONE shape

Neither missing fact was attempted and left unverified. Both were **dropped at
inference**, and everything downstream — the walk, the partial-coverage guard, the
oracle — behaved correctly with respect to a target set that had already lost them.

This matters because it relocates the fix. There is already a `partial-coverage`
guard that flips a strict-subset reach to not-reached; it could not have fired here,
because coverage of the *target set* was complete. Strengthening the oracle or
narrowing its deterministic exemption would not have caught either case.

The two real causes, both at inference and both upstream of every verifier:

1. **Clause dropping** — the fetch clause vanished at confidence 0.98
   (`router-drops-a-sink-when-a-goal-names-two`, fix dispatched).
2. **Arity collapse** — target shapes are a **set**, so "two health reports" is one
   `vessel_health_report`. The second vessel is unrepresentable in the target
   vocabulary, so no downstream stage can notice it is missing.

And it names the detector that would catch both, which no current check performs:
**compare the produced artifact against the facts requested in the GOAL TEXT**, not
against the target set. Every existing guard validates against the target set, which
is precisely the artefact that has already lost the information.

Recorded as a correction rather than an edit to the section above, because the wrong
mechanism was committed and a reader following the history should see it withdrawn
rather than silently replaced.

## Where the depth ceiling lives now, quantified

With the instruction cap raised to `1-6`, the walk budget at 8, and the caller
supplying `maxTargetShapes`, none of the three earlier ceilings is binding. Measuring
what the router actually returns — 16 consecutive inferences over 40 minutes:

    shape-count distribution   {1: ×2, 2: ×6, 3: ×6, 4: ×2}
    mean 2.50 · max 4 · never 5 or 6

**The model never uses the headroom it was given.** Four-clause goals are truncated to
two or three shapes, and *which* clauses survive is arbitrary: one sample kept both
sinks and dropped both producers (`["concept_write","memoryNote_write"]`, conf 0.95);
several kept both producers and dropped the concept sink. So the earlier framing —
that sinks specifically are dropped — is too narrow. The router under-decomposes
generally and the surviving subset is unstable.

Two consequences worth separating:

- **The ceiling is now behavioural, not structural.** No bound, budget or caller
  change can raise it further; the instruction has already been raised and ignored.
- **Confidence does not detect it.** The lowest shape-counts carried the highest
  confidence (0.98 for two shapes, 0.95 for a subset that dropped both producers),
  so the omission cannot be caught by thresholding.

This is why the intervention chosen was a **worked two-destination example** rather
than a stronger instruction. The record on this substrate is explicit about which
works: evidence supplied at the point of use has landed 3 of 3 on first contact,
decision rules 0 of 7 — and raising `1-3` to `1-6` was an instruction that moved
inference exactly once before the model settled back to a mean of 2.5.

The distribution above is the **before** measurement. The same measurement after the
example lands is the test of whether few-shot evidence moves decomposition where the
raised bound did not.

## Carried, not fixed

- The hub runs the same image and almost certainly carries the same stale
  consumer dists. It is not reachable by SSH from here, so this is
  operator-gated.
- Trace-retention throughput after bounding the valve DELETE at 20s is
  **unmeasured**: the traces API returns `"total": -1` rather than counting, the
  hub journal is unreadable from this spoke (`activity-api` is masked here), and a
  `limit=1` read took 44.7s. That latency is itself a load signal, but it is not a
  surplus measurement and is not reported as one.
- A reach verdict credited four asserted facts while its oracle verified one
  (`totalVessels=11`); the two vessel-health claims had no producing step and were
  true only by coincidence. Filed as gap `reach-oracle-coverage-fraction`.

## The plural-sink example moved decomposition; the depth ceiling did not move

Pre-registered before/after on one goal class (health report · registry shape count ·
record a concept · persist a note):

| | before (n=16) | after (n=6) |
|---|---|---|
| shape-count distribution | `{1:×2, 2:×6, 3:×6, 4:×2}` | `{3:×3, 4:×3}` |
| mean shapes | 2.50 | **3.50** |
| samples inferring <3 shapes | 8 of 16 | **0 of 6** |
| both sinks retained | 1 of 6 | **4 of 6** |

The **floor** rose: nothing infers one or two shapes any more, where half the
before-samples did. Concept retention went from 1-in-6 to 4-in-6.

**The ceiling did not.** Max is still 4, exactly as before. So the worked example fixed
the *dropping* and not the *depth limit* — those turn out to be separate properties,
and only the first responded.

This is the fourth data point for a rule this substrate keeps re-proving: **evidence
supplied at the point of use moves behaviour; instructions do not.** Raising the cap
`1-3`→`1-6` was an instruction — inference moved once and settled back to a mean of
2.5. One worked two-destination example moved the mean a full shape and eliminated the
sub-3 tail. Running record: evidence 4/4 on first contact, decision rules 0/7.

Limits worth stating: n=6 against n=16, and 2 of 6 still drop the concept. The change
is large relative to that noise on the floor metric and absent on the ceiling metric,
which is the asymmetry worth carrying rather than the point estimates.

## Retraction: the 127 sanitiser fixed diagnostics, not correctness

Commit 72371d35 claimed "the 127-from-loopback blocker is cleared and the blocked goal
class now reaches." **That causal claim is wrong.** The comparison is:

    const claimed = [...new Set((digIds.match(/\b\d{1,7}\b/g) ?? []))];
    if (claimed.includes(expected)) { return reached: true }
    return { reached: false, reason: `... but the output reports ${claimed[0]}` }

It is a **set-membership test**. A spurious `127` scraped from `http://127.0.0.1:8210`
can never displace a correct value: if the true count appears anywhere in the scanned
text, `includes` finds it and the dispatch passes. Extra candidates only affect
`claimed[0]`, which appears in the failure *message*.

So the sanitiser (ae39e6cf, 37f43aa) improves **diagnostics** — the verdict stops
naming a phantom value — and unblocked nothing. Confirmed live: with the sanitiser
running, a rejection now reports `200` rather than `127`, `200` being the `"HTTP 200"`
in the health probe field. The next contaminant, same message-quality class.

What actually unblocked the goal class was the **field-selection fix** (93b8feed).
Before it, a goal asking about *shapes* was compared against `totalVessels=11`, and 11
genuinely was not in the output — a correct-looking rejection of a correct answer, for
the right reason applied to the wrong quantity.

This is the exact failure mode already recorded on this substrate: *a plausible
mechanism attached to a working fix is how a wrong causal story survives.* Two fixes
landed close together, the goal class started reaching, and the reach was attributed to
the more recent and more interesting of the two. The check that caught it was reading
the comparison operator instead of trusting the narrative — `includes` is the whole
argument.

The sanitiser work is kept: message accuracy matters when a reason seeds repair goals,
and this document already records a case where a reason blamed the wrong component. But
it is diagnostic value, not a cleared blocker, and the gap ledger should read that way.

## The learned-pathway tier closed a loop, on a verified reach

    alpha-credited last pick
      activity:⟨learned-composition-discovery-vessel-registry-observer-to-shellresult-to-memorynote-⟩
      (substance-honest reach: deterministic:verified-registry-count — independently queried …)

A composition previously **extracted** from a reached execution was **selected** for a
new goal, **reached**, was **verified by an oracle that independently recomputes the
answer**, and was **alpha-credited**. Extract → reuse → verify → credit, closing on a
real dispatch rather than a synthetic probe.

This is the ceiling tier described in `CLAUDE.md` doing its job, and it is the single
strongest piece of evidence in this document that the learning loop functions. It also
retires the framing earlier in this report that learned compositions cannot earn credit
— they can, and here one did, on a substance-honest reach.

## Why deeper valid reaches still do not follow

Valid reaches are now routine at 3–4 shapes and reproducible. The deepest **valid**
reach remains 5 steps. What stops depth is not the target cap, the walk budget, the
caller, or oracle coverage — all measured and excluded — but **substitution**:

- **shape substitution** — a target satisfied by an artifact about the wrong subject
- **fact substitution** — a requested quantity satisfied by an adjacent number already
  in hand (the registry total answered with the vessel's own 12 advertised shapes)

Measured this round: only 1 of 6 walks dropped the `shellResult` target, yet 2 produced
the substituted answer — so substitution happens at **answer composition**, not only at
target selection. A walk that targeted the query still answered from the health report.

That gives the real depth mechanism: each additional requested fact is another
opportunity to substitute, and only facts with a deterministic oracle are caught. The
registry count has one, which is why these failures are visible at all. Most facts do
not. **Depth raises the number of unguarded substitution opportunities**, which is a
different and more tractable statement than the coverage story retracted above.

## Prohibition vs worked example, measured on the same defect

The substitution defect got two prompt interventions against the same goal class, which
makes it a clean comparison of *form* rather than content.

| | prohibition (665ffa6) | worked example (60e4df9) |
|---|---|---|
| substituted "12" | **2 of 3** | **0 of 4** |
| correct (368) | 1 of 3 | 1 of 2 |
| other | — | 2 rejections reporting `200`, `3` |

Both carried the same measurement. The prohibition stated it as a rule — *"DO NOT use a
prior finding as the ANSWER to a quantity the goal asks you to obtain FROM A NAMED
SOURCE"* — and changed nothing: 2 of 3 still answered "the discovery registry advertises
12 shapes". The worked example stated it as a wrong/right pair for the concrete case,
and the substitution stopped.

Delivery was identical in both cases — arg-synthesis ran 21 times in the prohibition
window and the text was in the running source — so this is a difference in **form**, not
in whether the drafter saw it.

That refines the rule this substrate keeps re-proving, which had been stated too loosely
as "evidence beats instruction". A prohibition *with a citation attached* is still a
rule; the citation makes it feel like evidence without making it one. What lands is a
worked example showing the **correct output for a concrete input**. Running record:
worked examples 5/6, decision rules 0/8.

**What did not change: correctness.** ~1 in 2 still fails to produce 368. The fix stopped
the walk answering *wrongly*; it did not make it produce the right value more often — the
failures moved from persisted-wrong-artifact to honest rejection. Same asymmetry as the
plural-sink example, which raised the shape-count floor and left the ceiling at 4.

Sample sizes are small (3 and 4). The substitution result is a categorical change (2/3 →
0/4) rather than a shift in a noisy rate, which is why it is reported; the correctness
figures are not separable from noise and are not claimed as movement.

## Retraction: the worked example did not reduce substitution

The section above reports "substitution 2/3 → 0/4" for the worked-example form. **That
is wrong, and the error is mine in the measurement, not in the data.**

The detector matched the literal string `12`. Re-graded on the actual question — *is the
stated shape total correct?* — both conditions are identical:

    prohibition     1 correct / 1 wrong   (stated 12)
    worked example  1 correct / 1 wrong   (stated 13)

The substitution did not stop. It **moved**: from `12`, the vessel's own advertised-shape
count lifted from a prior finding, to `13`, the registry's *vessel* count. The walk now
queries the right source and reads the wrong field of the response.

So the running record correction: worked examples **4/6**, not 5/6. The anti-substitution
intervention failed in *both* forms, and the prohibition-vs-example distinction is not
supported by this experiment — that comparison should be treated as untested rather than
confirmed.

Two things worth carrying:

**I measured a proxy for the property.** "Contains 12" is not "states the correct total",
and the difference is exactly where the result lived. This is the same failure this
document criticises elsewhere — a check that answers a nearby question and is read as
answering the real one — committed by me, in a section arguing about measurement
discipline.

**The substitution is robust to prompt intervention.** Two forms, same rate, different
wrong value each time. That is stronger evidence for the pre-registered conclusion than
either form succeeding would have been: this defect is not addressable at the prompt, and
the structural fix the gap specifies — bind a fact to a step traceable to the source *and
field* the goal named — is required. Note the fix must now name the field, not just the
source, because the walk demonstrably reaches the right source and reads the wrong column.

## The structural fix worked where both prompt forms failed

Same goal class, same grading question (*is the stated shape total correct?*), three
interventions:

| intervention | result |
|---|---|
| prohibition in the arg-synthesis prompt | 1 correct / 1 wrong — stated **12** |
| worked wrong/right example | 1 correct / 1 wrong — stated **13** |
| **source+field binding** | **3 correct / 0 wrong** |

The binding fired on all five dispatches, every time logging
`field=totalShapes, chosen by the same rule the verifier applies`, and two dispatches were
`alpha-credited` on `deterministic:verified-registry-count` — oracle-verified reaches, not
merely correct artifacts.

One note stated **370** rather than 368. That is also correct: the registry moved from 368
to 370 during the run, and the dispatch reported the live value — which is evidence the
command executed rather than replaying a cached number.

### What the three attempts establish

The two prompt interventions did not fail for lack of delivery — arg-synthesis ran 21 times
in the prohibition window with the text in the running source. They failed because the
defect is not a knowledge gap. The walk **knew** the registry was the source; it reached
`registry/stats` and read the wrong column, first `12` (a vessel's own advertised_shapes
length), then `13` (the registry's vessel count). Told not to, it substituted a different
wrong column.

What removed it was making the column non-inferable: the field is now derived by
`registryFieldFor`, the same function the verifier calls, so producer and oracle cannot
disagree about what the goal asked for.

That is the generalisable form. **Where a fact is machine-decidable from the goal, binding
it beats instructing about it** — and the binding must cover every degree of freedom the
error can move into. Binding the source alone would have left the field free, and the field
is exactly where the second failure went.

### Cost of learning that

Three attempts, two of them wrong, plus a retraction when the first "success" turned out to
be a proxy measurement (`contains 12` rather than `states the correct total`). The
prohibition-vs-example comparison remains untested — both failed, so nothing distinguishes
them here.

## Correcting the count, and what one extra clause costs

The source+field batch was graded before it finished. Complete:

    sf1 368 VALID   sf2 368 VALID   sf3 368 VALID   sf5 368 VALID   sf4 no count stated
    → 4 correct / 0 wrong of 5

Zero substitutions across five dispatches, against 1-wrong-of-1 in each prompt
condition. The one miss omitted the count rather than inventing one.

**Then one clause was added** — "obtain the discovery registry state" inserted between
the health report and the count — and fact delivery collapsed:

    dp1, dp2   no count stated
    dp3        "…is healthy … and advertises 12 shapes"   the VESSEL's own 12, true but
                                                          not the registry total asked for
    dp4        "The health report could not be retrieved. The total number of shapes
                could not be retrieved."                  honest, both facts
    → 0 correct / 0 wrong of 4

**Still zero substitutions** — the binding held; nothing claimed a wrong registry total.
What changed is that the requested fact stopped arriving at all.

That is the same pattern every intervention in this document has produced. The denial
pattern, `missing:true`, the plural-sink example and now the field binding each converted
a *wrong answer* into an *honest failure*, and none of them raised the rate at which a
deep goal delivers what was asked. Five interventions, one direction of effect.

The failure modes have moved in a consistent order: fabricated value → substituted
adjacent value → omitted value → explicit "could not be retrieved". Each step is more
honest than the last and none is more correct. dp4 is the endpoint of that progression —
a note that accurately reports it obtained nothing.

Which reframes the depth ceiling one more time. It is not verification (retracted), not
substitution opportunity (fixed for this fact, delivery still fell), but **the walk's
capacity to carry N requested facts through to the artifact**. The count of facts that
survive is what degrades with each added clause, and every fix so far has improved the
honesty of the survivors rather than their number.

### Ruled out: prior-finding truncation is not the capacity limit

Prior findings are truncated to 800 characters each
(`` `- ${s}: ${c.slice(0, 800)}` ``), which looked like a plausible mechanism for facts
failing to reach the artifact as goals lengthen. Measured against the real payloads:

    vessel_health_report   1170 chars → 800 retained (68%)
      overall_health  survives ✓    vessel_id survives ✓    healthy survives ✓
    /health payload         434 chars → fits entirely

So the health fact **was** visible to the note synthesis in the dispatch whose note said
"The health report for the vessel goal-host-vessel could not be retrieved." Truncation
does not explain it, and the hypothesis is withdrawn rather than left standing because it
sounds right.

The 800 is still a hardcoded behavioural constant of the same class catalogued in
`reach-decision-constants-governed-three-different-ways` — invisible to traces, unlearnable
— and would bind on larger findings. It is simply not what is happening here.

**Honest state of the capacity question: the mechanism is unidentified.** Depth degrades
fact delivery, that is measured (4/5 → 0/4 for one added clause), and the cause is not
verification coverage, not substitution opportunity, and not finding truncation — three
candidates now excluded by evidence rather than by argument.

### Scope correction: the binding constrains the producer, not the composer

A later batch on the same goal class graded **1 correct / 1 wrong / 1 no-count**, and the
wrong one stated **12** — the substitution the binding was built to remove.

It is not a regression. The binding fires on `shape === "shellResult"`, so it only
constrains the walk when the walk *selects that producer*. In the batch where it fired on
all five dispatches the result was 4 correct / 0 wrong. In the dispatch that substituted,
no shell step was taken at all, so nothing bound anything and the note was composed from
prior findings — where a 12-entry `advertised_shapes` array sits waiting.

So the earlier "zero substitutions across five dispatches" was a property of that batch,
not a guarantee. Stated precisely:

- **producer selected** → field bound by `registryFieldFor` → correct value
- **producer not selected** → note composed from findings → substitution recurs

The fix therefore needs a companion, and the companion is the target-selection defect
already filed: when a goal names a source for a fact, the producer for that fact must be
in the target set. Binding the field is useless if the step never runs, which is the same
shape as every other finding here — a correct mechanism on a path the failure does not
take.

That also explains why the earlier deep batch showed omissions rather than substitutions:
those walks *did* run the shell (the binding fired), so no wrong value could be composed —
the fact was simply absent from the note instead.

## Four interventions on one goal class, measured the same way

| intervention | result |
|---|---|
| prohibition in the arg-synthesis prompt | 1 correct / 1 wrong (stated 12) |
| worked wrong/right example | 1 correct / 1 wrong (stated 13) |
| source+field binding | 4 correct / 0 wrong of 5 (1 stated no count) |
| **binding + required producer** | **5 correct / 0 wrong of 5** |

The binding fired on all five of the last batch. The required-producer rule closed the one
remaining hole: a walk that never selected the fetching step, which had produced the
"no count stated" outcome and — when the note was composed as prose rather than dumped —
the substitution.

Two prompt forms moved nothing. Two structural constraints moved it to 5/5, monotonically.
That is the clearest evidence in this document for a rule it keeps re-proving in weaker
forms: **where a fact is machine-decidable from the goal, constrain the mechanism; telling
the model about it does not work.** The two prompt attempts here were not badly written —
the second was a worked wrong/right example, the form that had previously landed on first
contact — and they still did nothing, because the drafter was never missing the knowledge.

What the two constraints do, precisely:

- `registryFieldFor` decides which quantity the goal asked for, and the **producer, the
  binding and the verifier all call it**, so none of them can disagree.
- when it returns non-null, the producer is **added to the target set** rather than left to
  inference, which dropped it a measured fraction of the time.

Neither is a depth demonstration. Both operate on a two-fact goal, and the deepest **valid**
reach is unchanged at five steps. What they establish is that fact delivery at fixed depth
is now reliable where it was coin-flip, which is the precondition for testing whether depth
itself is tractable.

## The ceiling moved from inference to execution

The required-producer rule was tested on the 5-clause goal that previously scored 0/4.
Result: **0 correct / 0 wrong of 3** — unchanged. The omission theory is wrong, and joins
the three mechanisms already excluded.

But the inference did change, and it is the deepest of the session:

    ["vessel_health_report","discoverByShapesQuery","concept_write","memoryNote_write","shellResult"]  ×3
    ["vessel_health_report","shellResult","concept_write","memoryNote_write"]                          ×1

`shellResult` is present in **every** target set, so the rule did its job. Yet the binding
fired **zero** times across those dispatches, and exactly one shell output appeared in the
window. The producer was **targeted and never executed**, and the note omitted the fact
without remark.

So the constraint chain now holds up to the point of execution:

    field selection    fixed  — registryFieldFor, shared by producer/binding/verifier
    field binding      fixed  — 5/5 fired on the 2-fact goal, 5/5 correct
    target selection   fixed  — shellResult in 4 of 4 deep target sets
    EXECUTION          ✗      — 5 targets inferred, the producer never runs

That is a materially different statement from where this document started. The ceiling is
no longer "the walk cannot express a deep goal" — it expresses five shapes now — but "the
walk does not execute every shape it targeted, and the artifact is composed anyway."

Two consequences worth separating. A shape targeted and unproduced should block the terminal
write; the derivation-deferral guard exists for exactly that and did not fire here, which is
the next thing to check. And a note composed while a target is unsatisfied is the
composition defect already filed — the prose path does not verify against the pool, so an
absent fact costs nothing.

**Inference depth is solved and delivery is not.** Five target shapes is the demonstration
this document has been chasing at the routing layer; it is not a valid reach, because the
facts do not arrive.

## A manufactured gap produced a real regression, and I chased its symptoms for hours

The chain, end to end:

    four pre-existing repairSignatureOf failures
      → post-land gate blames the newest commit (no baseline)
        → files gap post-land-suite-red-goal-host-vessel
          → autonomous repair targets healthy code
            → lands 31f1d67, reverting a verified fix in one line
              → every "how many SHAPES" goal that also names a vessel regrades
                against totalVessels
                → deep batches fail
                  → I diagnose "omission", then relocate the ceiling to "execution"

Both diagnoses were wrong, and the tell was in a log line I quoted myself:
`independently queried registry totalVessels=13` for a goal about shapes. I read the
verdict's *outcome* and not the *field it cited*.

The reverted line:

    -  const field = registryFieldFor(g);
    +  const field = /\bvessel\b/.test(g) ? "totalVessels" : registryFieldFor(g);

Seventh recurrence of that class, first authored by the substrate, typecheck-clean and
semantic-gate-green.

### Three separate defects in one chain, each worth its own fix

1. **The gate manufactures demand.** It attributed four pre-existing failures — verified by
   stashing and re-running — to a commit that touched one unrelated line. Unlike the
   pull-sync sibling this does not merely mislabel: it **files a gap**, which autonomous
   work then acts on. Filed as
   `post-land-gate-attributes-pre-existing-failures-to-the-landing-commit`.
2. **The gates cannot see a semantic revert.** Re-adding a predicate in front of a shared
   rule compiles and reads as a plausible improvement. Nothing compared the new behaviour
   to the behaviour the fix established.
3. **My tests pinned the rule, not its callers.** `registryFieldFor` was covered; nothing
   asserted the oracle still *calls it unconditionally*. A shared rule is only shared while
   every caller defers to it, and the defect was a caller **wrapping** the rule — invisible
   to any test of the rule itself. Now pinned against the shipped source.

### The uncomfortable part

The gate had a genuine defect available to find — `31f1d67` really was a regression — and it
found a false one instead. A verification layer that mistakes noise for signal does not
merely fail to catch defects; it **spends the substrate's repair capacity manufacturing
them**, and the repair it directs is itself unreviewed by anything that could tell the
difference.

### After the revert: the 5-clause goal delivers again

    before the revert   0 correct / 0 wrong of 4,  then 0 of 3   (all no-count)
    after the revert    1 correct / 0 wrong of 3

The valid one carries both facts and an oracle verdict:

    verdict  deterministic:verified-registry-count — independently queried …/registry/stats
    facts    368 ✓   healthy ✓
    chain    vessel_health_report → shellResult → memoryNote   (3 shapes)

So the regression had been masking real capability: a goal I had written off as beyond the
walk was delivering correctly at least part of the time, and the failures I attributed first
to omission and then to execution were the oracle grading the wrong field.

Two things this does **not** establish, stated because the temptation runs the other way:

- **It is not a depth demonstration.** Three real shapes; the deepest valid reach is still
  the five-step one, unchanged for the whole session.
- **It is not reliable.** One of three. The other two stated no count — the honest failure
  mode, not a wrong one, but a failure.

What it does establish is that the measurement was corrupted for hours by a one-line
substrate-authored revert, and that every conclusion drawn from those batches — including
two of my own relocations of "the ceiling" — was reasoning about an artefact.

## Final measurement: removing the unservable clause did not unlock depth

A 5-shape goal built entirely from locally-servable shapes — health report, registry state,
shape count, HTTP fetch + extract, note — with no `concept_write`:

    HOLLOW — "the goal required multiple specific outputs (vessel health report, discovery
              registry state with…"
    HOLLOW — "the memory note was rejected due to missing required fields, and GitHub
              stargazers count was not…"
    HOLLOW — deterministic:hollow_walklog_capped — all 1 logged walk step(s) produced 0 new shapes
    1 note — 1 of 3 facts

So vessel availability was a real constraint and **not the binding one**. That is the fifth
mechanism demoted this session, after verification coverage, substitution opportunity,
finding truncation and execution.

### The measured envelope, stated plainly

    2 facts, 3–4 shapes   →  reliable: 5 of 5 correct, 0 wrong, oracle-verified
    3 facts, 5 shapes     →  1 of 4 partial, rest honest failures

The system is reliable at two facts and unreliable at three. Every fix landed this session
moved the failure mode toward honesty and none moved that boundary.

### What improved, and it is not nothing

The verdicts now name *which* outputs were missing — "vessel health report, discovery
registry state with…", "stargazers count was not…" — where this session began with reaches
that asserted facts the artifact did not contain. A system that fails specifically is one
whose failures can be repaired; a system that greens them is not. That is the difference
between the start and end of this session, and it is a smaller claim than a depth
demonstration but a real one.

### Honest closing position

**Deepest valid reach: 5 steps**, unchanged. Increasingly compositional *reaching* was not
demonstrated beyond it. The remaining gap is not any single mechanism I can name with
evidence — five candidates are excluded — and I decline to offer a sixth with the same
confidence the previous five carried.

## Composition execution, split by cause

Two hours of walk logs, every `step N ran activity:<learned-composition-…> status=…` line.

**By depth:**

    hops=2   4 completed / 16 failed     20%
    hops=3   1 completed / 22 failed      4%
    hops=4   1 completed /  5 failed     17%
    hops=5   0 completed / 12 failed      0%

**By whether the chain contains a concept shape:**

    concept-free      8 completed / 21 failed    28%
    concept-bearing   3 completed / 45 failed     6%

Two causes, both now identified, neither complete on its own:

1. **Activity ids written as output shapes** — root-caused by resolving the only five-hop
   composition, which declares `out=[activity:<learned-composition-…>]` on four tasks and
   then requires that string as the next task's input shape. Unexecutable at extraction.
   6 of 26 compositions (23%) carry it, including the sole five-hop, which accounts for
   `hops=5 → 0 of 12` completely. Now rejected at the template write boundary.

2. **`concept_write` cannot resolve on this spoke** — concept-db is masked, and the two
   most-failing three-hop compositions are
   `vessel-health-report-to-shellresult-to-concept-write` and
   `vessel-health-report-to-concept-write-to-shell`, 15 failures each. Concept-bearing
   chains succeed at 6% against 28% concept-free, a 4.6× penalty.

**Correction to the previous section.** It recorded that three-hop compositions were
"structurally clean and still fail", implying availability did not explain them. That was
wrong: clean of the *activity-id* defect is not the same as executable, and the dominant
three-hop failures are concept-bearing. Availability explains most of the three-hop
population.

**What remains unexplained** is narrower and now measurable: concept-free compositions still
fail 21 of 29. That residual is not attributable to either identified cause and is the next
thing to root-cause — by the same method that worked twice here, which is to resolve one
failing template and read its tasks rather than reason about the population.

## The malformed-template population, measured

Applying the two write-boundary predicates to the live store (100 templates scanned):

    activity-id-as-output-shape     6
    self-satisfied-precondition     8
    ─────────────────────────────────
    total offenders                14   (14% of the store)

Two things this shows that the learned-composition sample did not.

**The defect is not confined to learned compositions.** Three `composed-cap-*` templates
carry self-satisfied preconditions, including
`composed-cap-text-execute-template-ribosome-extract-v`, which declares
`obsidian:execute_command` as an external requirement while producing it itself. That is the
ribosome's own execution wrapper carrying the defect that corrupts what the ribosome
extracts.

**Activity-id shapes chain into each other.** Several offenders declare output shapes that
are themselves other malformed compositions —
`activity:⟨compose-auto-bridge-code_quality-to-compose-auto-bridge-code_quality-to-compose-⟩`
is a composition whose declared output is a composition of compositions. Each is
unexecutable, and each makes the next unexecutable too.

At 14% of the store, and with learned compositions completing 6 of 61 runs, this is a
plausible contributor to the execution failure rate at every depth rather than only at five
hops. It is not proof — the causal test is running the sweep and re-measuring completion —
and the sweep is written, dry-by-default, and awaiting deployment to the hub where
activity-api runs.

### Status of the fix chain

    write boundary   activity-id guard        landed, tested
    write boundary   precondition guard       landed, tested
    store sweep      retire-malformed         landed, dry-by-default, NOT YET on the hub (404)
    causal test      re-measure completion    blocked on the sweep running

The endpoint returns 404 on the hub because the hub has not yet pulled the commit, and there
is no SSH from this spoke. The offender list above was computed locally against the live
store, so the operator has the actionable content even before the route exists.

## What the malformed templates actually cost: a 2× penalty, not the cause

The causal question — does malformation explain the execution failures — is answerable
without waiting for the sweep, by correlating 196 composition runs against whether the
template they invoked carries either defect.

    malformed     10 completed / 44 failed    18.5%
    well-formed   54 completed / 88 failed    38.0%

**Malformation roughly halves the success rate.** That is a real association and it justifies
the two write-boundary guards and the sweep.

It is also clearly not the dominant cause, and the same table says so:

- malformed templates **do** complete, 10 times — the defects are not universally fatal, so a
  composition can carry an activity-id output shape or a self-satisfied precondition and still
  finish;
- well-formed templates fail **88 times, 62% of their runs** — the majority of failure is in
  templates with nothing structurally wrong that these predicates can see.

So the honest accounting of the extraction work: it removes a factor worth roughly 2× on
composition success, moving the overall rate from about 30% toward about 38% if the sweep runs
and nothing else changes. Useful, bounded, and not the depth answer.

The dominant failure cause remains unidentified. Six candidate mechanisms have now been
excluded by evidence over this session — verification coverage, substitution opportunity,
finding truncation, execution-in-general, vessel availability as a sufficient explanation, and
now template malformation as a sufficient explanation. Each was a real effect; none was the
binding constraint. I decline to name a seventh without the same standard of evidence.

---

## The arguments were amputated at four layers in series (2026-08-17)

**Symptom.** Learned compositions were extracted, stored, selected — and failed on
replay. 6 of 61 runs completed. The engine's errors named the cause precisely:
`paths[0] … got undefined` (fs_read, 18x), `invalid URL: undefined` (http_fetch, 8x),
`undefined is not an object (path.split)` (json_path_extract).

**Measurement that located it.** Every task of every stored composition carried
`config == {"type": "<resolver>"}` — 98 of 98, no arguments anywhere. Not empty:
*uniformly* `{type}`, which is a synthesized value, not a missing one. That
uniformity is what pointed at a mechanism rather than a data problem.

**The chain.** Four layers, in series, each individually plausible:

| # | layer | defect |
|---|---|---|
| 1 | `ias-executor` `ExecutionTaskRecord` | no config field existed at all |
| 2 | `normalizePersistedTask` | fixed-field whitelist dropped it at the WRITE |
| 3 | `extractTasks` | read `tt.config`; the write lands `resolved_config` |
| 4 | ribosome synthesize prompt | skeleton literally specified `"config":{}` |

Fixing any one changes nothing observable. This is the failure signature already
recorded in this document: **when every fix targets the path and nothing moves, the
layers bind in series.** Layer 3's own comment anticipated the fix — *"Prefer a real
persisted config if a future write carries one"* — and still read the wrong key.

**Layer 2 is a repeat.** The per-task SHAPES fix of 2026-08-13 was the same whitelist
dropping the same class of field, with the same consequence (ribosome starved).
Second instance. The test therefore pins the whitelist, not the field.

⚠ **The mismatch recurred inside its own fix.** My first prompt edit told the
synthesizer to copy `resolvedConfig` — a key the payload never contains, because
layer 3 surfaces it as `config`. Caught in review, fixed in `f71bb56`. A write-key/
read-key mismatch is not a bug you fix once; it is a shape of mistake.

⚠ **RETRACTION — THE CHAIN WAS FIVE LAYERS AND MY "CLOSED" CLAIM WAS INERT.** A fifth
layer sits between 1 and 2: `activity-api-trace-sink.ts` builds its per-task payload
**key by key**. `resolvedConfig` was recorded at five engine sites and dropped one
function later, before the request was built. When I reported the chain closed, it
moved no data at all. Fixed `9518d4e`.

★ **An EXPLICIT PROJECTION is a silent dropper by construction.** Adding a field to a
record type yields no error, no warning, no failing test — omitting an optional field
is legal, so the type system cannot see it. That is why four rounds of checking, each
honest, all missed it. Detector added: every ExecutionTaskRecord field must be
forwarded or exempted with a reason, and every exemption is re-checked so it cannot
go stale.

**Status: committed and test-pinned, live effect operator-gated.** `ACTIVITY_API_ENDPOINT`
on every vessel here is `http://syzygy.host:18080`. The local store logged **zero**
trace writes in 6h (reads only). All traces land on the **hub**, which this session
cannot deploy to. So the chain is correct in source and unexercised in production.

### A masked-but-running trace store (same session)

Local `activity-api` was `UnitFileState=masked` while `is-active=active`, MainPID
1094541, up since 06:23 — the latent-unrecoverable-outage pattern recorded 2026-08-15,
now a fourth instance. Masking is correct by spoke design (the hub owns the store);
a masked unit that is *running* is not, because it cannot be restarted or recovered.
**Unmasked** (`UnitFileState=disabled`); MainPID and ActiveEnterTimestamp unchanged,
confirming the running process was untouched. Not restarted.

### A green suite that skipped a third of its files

`mock.module` replaces a module globally and outlives the file installing it. Six
factories mocked `../db/redis` exporting only `RedisClient`; **53 files** then died at
import — `Export named 'redis' not found` — before any assertion ran. Fixed: the suite
went 509 pass/114 fail → **769 pass/136 fail**. The 22 new failures are pre-existing
defects the import deaths were hiding (CircuitBreakerService, composition-chain
backfill race, polymorphic `variant_id` comparison), not regressions.

**A check that never runs cannot be trusted when it passes.**

### Detectors still missing (filed, not built)

- assert write-key/read-key agreement across the trace boundary — this chain is the
  Nth producer/consumer key-mismatch instance; the 08-13 audit called it systemic in
  5 of 6 subsystems, and it is still found by hand every time
- assert no RUNNING vessel's unit is masked (still missing after four instances)
- assert every `mock.module` factory exports every real export of its target

### Cross-subsystem sweep for the same class (2026-08-17)

The projection/key-mismatch class was audited beyond activity-api and ias-executor:

- **ribosome-vessel** — no task projection of its own; extraction runs through the
  ias-executor template, already fixed. No sixth layer on the argument chain.
- **analysis-vessel** — no POST sites at all. Nothing to audit.
- **goal-host-vessel → `/reach`** — sender emits `execution_id`, `reached`,
  `completion_shapes`; receiver additionally reads `body.missing`, which **no producer
  sends**. The mirror image of the amputation class: a consumer expecting a field
  nobody writes.

⚠ **HYPOTHESIS RAISED AND REFUTED.** The receiver's UPDATE sets `missing = $missing`
unconditionally, so an unsent field looked like it would overwrite the insert-path
diagnostic with `[]` on every reach patch — data loss, not just dead weight. It does
not. That UPDATE targets `activity_execution_traces` behind `isDualWriteEnabled()`,
which **defaults false** against a decommissioned table, and the live paradigm path
deliberately omits `missing` because the SCHEMAFULL `execution` table defines no such
column. Cost of the unsent field: **zero**.

Recorded because the refutation is the useful part. The reasoning that produced the
hypothesis was sound and the conclusion was wrong; what separated them was reading
the guard and the schema rather than the statement. **Name the string that would
refute a finding and run THAT before reporting it** — an unverified mismatch reads
exactly like a verified one in a report.

## The compositional ladder, hand-graded against ground truth (2026-08-17)

Ground truth captured BEFORE each dispatch, verdicts graded by hand against it — not
read off the `reached` field, which is the thing under test.

| rung | goal | verdict | truth | grade |
|---|---|---|---|---|
| 1 — single fact | "how many shapes does the registry advertise" | reached | 368 ✓ | correct |
| 2 — arithmetic over two counts | shapes ÷ vessels (≈28.5) | reached=true | answered `totalShapes`=368 only | **FALSE REACH** |
| 3 — two independent sources | count .ts in dir A, count in dir B, report sum (59) | reached=**false** | never produced 59 | honest miss |

**The finding is the contrast between rungs 2 and 3, not either alone.**

Both goals hit the same failure: the walk produced ONE operand and stopped. On rung 3
the general path caught it — `hollow satisfier verdict for "shellResult" — retrying
walk once with that satisfier suppressed`, then a widened retry, then an honest
decline. On rung 2 the identical error was graded REACHED with alpha +2, because the
DETERMINISTIC registry fast path answers and verifies from the same function and
never reaches the hollowness check that rung 3 passed through.

★ **A deterministic fast path is not merely a shortcut past the walk — it is a
shortcut past the walk's honesty gates.** The oracle was correct about its own
question; nothing in that path asks whether its question was the goal's.

Fixed at the routing layer (`58376c1`), not the oracle: goals naming two counted
entities or carrying an arithmetic combinator now abstain, which returns them to the
path that already rejects partial answers correctly. Not yet running — the live
goal-host carries the old code.

**Answer to "how compositional can it reach?", measured rather than asserted:
single-source facts yes; two independent sources NO, and honestly so.** Rung 3's
decline is the system working as designed at the floor and falling short of the
contract; rung 2's reach is the system being taught that a dropped operand is success.

⚠ Also observed on rung 3: `selectedTemplateId` =
`activity:proposed_pattern_authored_http_response_backfill_chain` for a file-counting
goal. Unexplained; filed rather than diagnosed.

### The substrate deployed the fix itself, and the false reach is gone (2026-08-17)

No operator, no SSH, no container edit. `substrate-pull-sync` (≈11-min timer) picked the
pushed commits up on its own tick:

    13:02:59  goal-host-vessel: content … (git 58376c1a84) — mirroring into /vessels
    13:03:09  ias-executor-ts ff3df57 — rebuilding dist for 6 consumers
    13:03:11  consumer goal-host-vessel holds a REAL-FILE dist — copying new build in
    13:04:00  fan-out healthy AND propagated across all 6
    13:03:27  goal-host restarted, new MainPID

★ That `REAL-FILE dist — copying new build in` line is the fan-out repair landed the day
before (`c6d2212a`) working in production — the defect that had left 5 of 6 consumers
frozen for 11 days. It is the first confirmation that fix does what it claims.

**BEFORE / AFTER on the identical goal** (shapes ÷ vessels; truth 368/13 = 28.31):

| | before (`12:53`) | after (`13:09`) |
|---|---|---|
| fast path fired | YES — `DETERMINISTIC registry-count … field=totalShapes` | **NO — zero occurrences in the window** |
| answer | `368` (one operand; division dropped) | none produced |
| verdict | **reached=true, alpha +2** | **HOLLOW, beta-penalised** |
| time to verdict | ~20s (short-circuit) | still walking at 100s+ |

**A false reach became an honest hollow verdict.** The goal still does not reach — it now
fails on `insufficient credits for webSearchResult`, a separate operator-gated blocker — but
the learner is no longer taught that dropping an operand is success. That is an improvement
in reach VALIDITY, which is the only kind that compounds.

⚠ **THE CONVERGENCE THAT DEPLOYED MY CODE RAN ITS TESTS ON NOTHING:**

    !!! TEST GATE SKIPPED — per-tick budget 420s exhausted (563s elapsed); converging UNGATED
    !!! TEST GATE BLIND — no test runner available (bun missing …); this is not 'no tests',
        it is no instrument. Converging ungated.

My changes reached production without their tests running. The gate reports its own blindness
honestly — which is more than most of the gates in this document do — but a gate that
disables itself under time pressure is a gate that is absent exactly when a tick is slow,
which is when convergence is riskiest. Filed.

### VALID COMPOSITIONAL REACH, hand-verified (2026-08-17, 13:26)

The substrate self-deployed `1fd7bfd` (mirrored 13:26:01, new MainPID, restarted), and the
goal that had produced a FALSE reach three hours earlier now reaches CORRECTLY:

    DETERMINISTIC registry-RATIO command (totalShapes / totalVessels, shared with the verifier)
    stdout: 28.307692307692307
    oracle: independently queried registry/stats and computed 368/13 = 28.307692307692307
    alpha-credited satisfier:shellResult   reached=true, dAlpha=2

Ground truth captured BEFORE dispatch: `28.307692307692307`. **Exact, and it is the QUOTIENT
— not an operand.** The oracle recomputed it from its own fetch, so the command did not grade
itself.

**The full arc on one goal, all hand-graded against pre-captured truth:**

| run | behaviour | verdict | grade |
|---|---|---|---|
| 12:53 | fast path answered `totalShapes`=368 | reached=true, **alpha +2** | **FALSE REACH** |
| 13:09 (abstention live) | no producer; walked, chose webSearchResult, hit credits | HOLLOW, beta-penalised | honest miss |
| 13:26 (producer live) | `jq '.totalShapes / .totalVessels'` | reached=true, alpha +2 | **VALID REACH** |

Two fixes were needed and neither sufficed alone: abstention removed the wrong answer,
the producer supplied the right one. Removing a false reach without supplying a producer
converts it into a guaranteed miss — better, but not reaching.

**LADDER STATUS:** single-source facts ✓ · arithmetic over two counts from one body ✓ (NEW)
· **two INDEPENDENT sources ✗** (honest miss — the walk produces one operand and declines).
The remaining rung is a genuine capability gap, not a grading defect.

⚠ **NEW DEFECT FOUND BY THE SUCCESS: the verdict did not persist.**

    reach-patch MATCHED NO ROW (walk-complete) for walk-satisfier-1-1786973190772
    (reached=true) — verdict NOT persisted; this execution stays ungraded

**2 of 6** reach-patches in the preceding 30 minutes matched no row, and this dispatch
reported `oracleLabelWritten:false`. The in-process posterior moved (`dAlpha:2`), but the
durable verdict on the trace row did not — so a valid reach on a `walk-satisfier-*` execution
id can be lost to the learning store. A ~33% loss rate on the honest-verdict channel is the
same write-never-read family this document tracks, one layer further out. Filed.

The goal-host code logs this loudly rather than swallowing it, which is why it was findable
at all — the fix that made `updated:0` a visible failure instead of a silent success.

### TWO-SOURCE COMPOSITION REACHES (2026-08-17, 13:42) — the ladder's top rung

Deployed `e5727fb` (mirrored 13:41:01, after draining to 0 so no run was lost). The goal that
produced one operand and declined at 12:57 now reaches:

    echo $(( $(find /vessels/goal-host-vessel/src -maxdepth 1 -type f -name '*.ts' | wc -l)
           + $(find /vessels/ribosome-vessel/src -maxdepth 1 -type f -name '*.ts' | wc -l) ))
    stdout: 60          reached=true

Ground truth captured BEFORE dispatch: 58 + 2 = **60. Exact.**

★ **NO DETERMINISTIC PATH PRODUCED THIS.** No command was written for this goal class. The
executor composed both operands itself after being given ONE computed fact about its own
goal — that it names two distinct paths, and that a result from one of them answers a
different question. Contrast the registry quotient, which needed a deterministic producer.
This is the floor doing its job once the missing information was present at the point of use,
which is what law 8 predicts and what the 3/3-vs-0/7 record (facts vs instructions) recommends.

**THE LADDER, every rung hand-graded against pre-captured truth:**

| rung | goal | result | truth | grade |
|---|---|---|---|---|
| 1 single fact | shapes in the registry | 368 | 368 | ✓ |
| 2 arithmetic, one body | shapes ÷ vessels | 28.307692307692307 | 28.307692307692307 | ✓ |
| 3 two INDEPENDENT sources | count dir A + count dir B | 60 | 60 | ✓ |

Rung 2 was a FALSE REACH at 12:53 and rung 3 an honest miss at 12:57. Both are now correct,
and each needed a different fix: rung 2 an abstention plus a producer, rung 3 a supplied fact.

⚠ **THE SUCCESS EARNED NO CREDIT.** Rung 3 returned `alphaBetaDelta: []` and
`oracleLabelWritten: false` — a correct, verified, compositional reach that moved NO posterior.
Rung 2 credited `dAlpha:2` but its reach-patch matched no row. So the system's best results are
not reliably reaching the learner: **it can now compose, and it is not yet learning that it
can.** That is the next binding constraint, and it is the same write-never-read family this
document has tracked all day, now sitting on the honest-verdict channel itself.

### ⚠ RETRACTION: the withheld credit was correct behaviour, not a defect (2026-08-17)

I wrote that the top rung "moved no posterior" and that "the system can compose and is not
learning that it can". **That was wrong**, and the correction matters more than the claim did.

`alphaBetaDelta: []` on the two-source reach is a DELIBERATE guard, gated on:

    if (verdict.deterministic === true || (!editEffectReach && consumedInChain.size > 0))

whose own comment carries the measurement that justifies it: over 80 goals in four classes
with no deterministic verifier, **72/80 graded REACHED and 23/80 were correct — 68% hollow**;
`ext_variety` was 20/20 reached and 0/20 correct. Every one of those ran a command and was
alpha-credited under the older, looser gate.

So the two rungs differ exactly as designed:

| rung | verdict source | credit | correct? |
|---|---|---|---|
| registry ratio | `deterministic:true` (independent recompute) | alpha +2 | yes, by design |
| two-source sum | LLM judge, no in-chain producer→consumer edge | WITHHELD | yes, by design |

My reach was verified correct by hand — but the SYSTEM cannot verify that class, and it
correctly declines to credit what it cannot check. Crediting it would make the posterior a
record of activity rather than of correctness, which is the exact defect this session spent
the day removing at the reach layer.

**The real implication is a different piece of work:** that class earns credit by gaining a
deterministic verifier, not by loosening the gate. Loosening it would manufacture the 68%.

⚠ The graded-at-insert fix (`eca7c8a`) remains correct and deployed, but its EFFECT is still
unobserved: on the verifying run the patch succeeded (`reach-patch ok … rows=1`), so the tag
was belt-and-braces and never load-bearing. It is verified as deployed, not as exercised.
