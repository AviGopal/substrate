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
