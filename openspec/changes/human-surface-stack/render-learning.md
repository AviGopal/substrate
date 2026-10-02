# Learning what to render, and validating it independently

Two questions, one mechanism. How does the system learn what to render and when — and how do
activities serve as independent validators of that behavior?

The short answer to the second is that the pattern already exists in this substrate, is well
designed, and **has never executed once**. The short answer to the first is that the system does
not currently learn what to render at all, and the reason is downstream of that.

---

## 1. The current surface is unlearnable, and that is a law-1 violation

The surface built under this change dispatches rendering on the *form* content takes — prose,
text, rows, diff, empty — through a `switch` compiled into a bundle. That decision is an
in-process constant. It is frozen at build time, invisible to traces, and cannot be graded,
varied, or replaced by a better arm.

Law 1 says runtime behavior must be steered by shaped impulses read at use time, and that
anything the system cannot observe through a shaped impulse it can never learn. A compiled
render switch is exactly the thing law 1 forbids: it works, and it can never improve.

This is stated first because everything below is a description of what is missing from something
that already shipped, not a critique of a hypothetical.

---

## 2. The inputs already exist; nothing consumes them

The telemetry needed to learn rendering is already collected:

- `interactorObservation` — raw behavioral telemetry: click, dwell, focus.
- `interactorEvent`, `interactorAssertion`, `interactorAttachment` — structured interaction.
- `uiFeedback` — operator answers, dismissals, complaints.
- `impulse_relevance_metrics`, `relevance_feedback`, `context_thompson_scores`,
  `variant_performance_metrics`, `external_validation_history` — the posterior machinery, keyed
  on `(activity, pointer-shape)`.

The surface vessel serves the first four and stores them. **Nothing reads them back to change
what gets rendered.** They are captured and parked — the same shape of failure as a verdict
corpus that is written and never consumed: the signal is collected, and the delivery is missing.

So "the system does not learn what to render" is not an absence of instrumentation. It is an
absence of a *reader*, which is the same diagnosis this substrate keeps arriving at from
different directions.

---

## 3. What learning to render actually decomposes into

Three separate decisions, and they have different mechanisms. Conflating them is why "learn the
UI" sounds intractable.

**What to surface** is an impulse-relevance question, and the machinery exists. Relevance
posteriors are already keyed on `(activity, pointer-shape)`. A surface that renders every pool
impulse equally is ignoring a ranking the substrate already computes. The move here is *reuse*,
not mint: read the existing relevance posterior to decide what earns foreground, and let the
long tail stay collapsed.

**How to render it** is an activity-selection question. Competing renderers for the same shape
are variants — a `prose` renderer and a `rows` renderer for the same `shellResult` are two arms,
and which one serves a reader better is an empirical question with a posterior. This is the part
that maps cleanly onto Thompson selection, and the part the compiled switch forecloses.

**When to surface it** is a rhythm question, not a timer. Cadence belongs in the pool as
time-shaped rhythm impulses the selector reads. The published guidance agrees from the other
side: time services to the reader's current task, and never interrupt mid-composition. A
surface that pushes a solicitation while someone is typing has made a scheduling decision it
cannot justify and cannot learn from.

---

## 4. The reward function is where this goes wrong if it is not chosen deliberately

This is the part that decides whether render-learning helps or harms, and it is easy to get
wrong by defaulting.

The obvious signals are the bad ones. **Dwell and engagement optimize for stickiness**, which is
not the goal — a surface that holds attention longer may simply be harder to read. **Verdict
volume optimizes for nagging**, because the cheapest way to produce more verdicts is to ask more
often. And frequency of any interaction measures habit: rank by it and the system will
confidently recommend whatever people do most, including their mistakes.

The honest reward follows from what this surface is *for*. Its job is to let a human reach a
correct verdict about a run, cheaply. So a renderer should be graded on:

- **Time from terminal state to verdict.** A rendering that makes a run gradeable faster is
  better, and this is measurable from data the surface already holds.
- **Verdict stability.** How often the human revises their own verdict on the same run. A
  rendering that produces verdicts people later take back was misleading, however fast it was.
- **Agreement with later evidence.** Where downstream outcome eventually contradicts a human
  verdict, the rendering that produced it is implicated.

Note what this does to a known problem: the verdict corpus is a biased failure sample, because
verdicts arrive mostly on runs that went wrong. A renderer optimized for *time-to-verdict on
reached runs* attacks that bias directly, because the scarce input is a cheap verdict on a run
that worked.

And one anti-goal, stated so it cannot be optimized into: **a renderer must never be rewarded
for producing more verdicts.** Correct and cheap, not frequent.

---

## 5. How activities validate behavior independently

### The existing pattern

`ui_legibility_scan`, a resolver in development-vessel, is the right shape for this, and it was
built before any of the present work. Three properties make it a genuine independent validator:

**It reads effective runtime state, not source.** It pulls the panel's computed `--sub-*` token
values through the vessel's own read shapes and checks computable rules against them — a px
floor, colour tokens that must reference theme variables, a chip-density ceiling. No LLM.

**It files into the same keyspace as the human.** Violations become `substrateGap_write` with id
`ui-feedback-<region>-<kind>` — *the same gap keying the human complaint affordances use*, so
substrate-detected and human-reported legibility problems drain through one funnel.

**It is reachable as a shape**, so it can be dispatched, traced, and graded like any other
activity rather than run as a script beside the system.

### Why "independently" is the load-bearing word

**A validator is independent of a producer only if it cannot fail the same way.** Shared code,
shared parse, shared assumption, or shared author all destroy independence, and this substrate
has paid for each: a generator and grader that shared a `-maxdepth 1`; a builder and oracle that
shared a parse; a test that certified a dead branch by feeding it an input the real path never
returns.

The static conformance checker built under this change fails this test in a specific and
instructive way. It is an **opinion about source shape**, validating code that is *also* an
opinion about source shape. When the two opinions differ — a comparator extracted to a named
function instead of inlined, pause controls lifted into a provider instead of declared beside
the poll, a wire type that happens to look like a state union — the checker reports a violation
that does not exist. Three of its four static-hard rules did exactly that against the finished
surface.

`ui_legibility_scan` is structurally immune to that entire class, because a validator reading
rendered state has no opinion about factoring. It cannot be fooled by where the comparator
lives, because it is looking at whether rows moved.

That is the general principle, and it is worth stating as a rule:

> **Validate the effect, not the construction.** A validator that reads source shares a failure
> mode with the author. A validator that reads effect does not.

### What independence buys once the validator is an activity

An activity-shaped validator gets three things a linter cannot have:

1. **Its verdicts are traced**, so they are evidence rather than console output.
2. **Its verdicts are gradeable.** A rule is an arm; its refusal is a prediction; the human's
   verdict is the outcome. A rule whose refusals humans keep overriding accumulates β and stops
   being selected — which is precisely the automated version of the false-positive triage I had
   to perform by hand.
3. **Disagreement becomes measurable.** Because detector and human file into one keyspace,
   "the detector found it and no human ever complained" and "humans complained and the detector
   was silent" are both computable, and both are informative about the detector.

A rule that never refuses is dead. A rule that refuses and is always overridden is wrong. Only
an activity can tell those apart, because only an activity has a posterior.

---

## 6. The empirical finding: the mechanism exists and has never run

`ui_legibility_scan` is advertised in the live registry and is reachable. It has **no unit file,
no inventory entry, and no manifest entry** — nothing schedules it. Its companion,
`ui-legibility-audit-tick`, is a seed file with no scheduler.

Queried against the hub's trace store, with a control to validate the instrument:

```
ui_legibility_scan       0 execution(s)
universal-tool-fallback  5 execution(s)   latest=2026-08-07T05:42:43 status=success
```

The control matters. A first pass at this query returned zero for *both*, which would have been
reported as a finding — the list endpoint takes ~36s for `limit=1` and shorter timeouts return
empty rather than erroring. The zero above is real only because a known-live activity returns
non-zero through the same call. (`total: -1` in that response is a meaningless field; do not
read it.)

So: the substrate's one independent, effect-reading, human-keyspace-sharing validator of its own
rendering **has produced no observations at all.** It is declared, not running — the first
triage class, and the reason the answer to "how does the system learn what to render" is
currently "it does not."

### Dispatching it once reveals the more serious problem

The scan was dispatched directly, for what appears to be the first time. It executes, and it is
honest about what it saw:

```json
{"success": true, "shape": "uiLegibilityReport",
 "body": {"available": false, "reason": "obsidian-vessel unreachable or ui_view empty"}}
```

That refusal is correct — the obsidian plugin server it reads is down, and the scan declines to
fabricate a pass. But read the envelope against the body. **It reports `success: true` while
reporting that it observed nothing.** The resolver contains no `success: false` path at all.

The consequence is not hypothetical. Schedule this detector and grade its executions on the
`success`/`status` field — the default for every activity — and **every blind run earns credit.**
The posterior converges on "this validator is highly reliable" from a population of runs in
which it never looked at anything. A validator that cannot fail becomes a self-confirming
oracle: it always passes, and its passing carries no information.

This is the same defect the whole surface was rebuilt to eliminate — status standing in for
outcome — reappearing *inside the instrument meant to be trustworthy without a verdict*. Which
gives the independence principle a second clause:

> **A validator must be able to fail, and "I could not observe" must be distinguishable from
> "I observed and found nothing."** Otherwise the validator is not independent of the thing it
> validates; it is independent of reality.

Note the ordering hazard this creates: scheduling `ui_legibility_scan` as-is would be worse than
leaving it dark, because a dark detector is visibly absent while a blind one manufactures
confidence. Fix the reporting first, then schedule.

---

## 7. What follows

1. **Make `ui_legibility_scan` able to fail, before scheduling it.** An unobservable target must
   produce a failed execution, not `success: true` with `available: false` in the body.
   Scheduling it as-is is worse than leaving it dark: a dark detector is visibly absent, a blind
   one manufactures confidence. One file: the resolver's unreachable branch.
2. **Then schedule it** — inventory entry, manifest entry, rhythm impulse — and prove it
   *completes* against a reachable surface, not merely that it is scheduled. A detector proven
   only to exist is the failure this substrate has already paid for more than once.
3. **Re-express the conformance rules that read effect as activities**, and retire the source-
   reading versions of the rules that have an effect-reading equivalent. Row stability, focus
   survival, and freeze-on-interaction are all observable in rendered state; P5, P6 and P10 are
   currently source opinions precisely because the probe does not exist.
4. **Give the surface a render decision it can lose.** One shape, two renderers, selected by
   posterior and graded on time-to-verdict. Without a real alternative there is nothing to
   learn — a single hardcoded renderer has no counterfactual.
5. **Deliver the interaction telemetry to a reader.** `interactorObservation` and `uiFeedback`
   are collected and parked; a signal with no consumer is not instrumentation.
6. **Fix the reward before wiring it.** Grade on correct-and-cheap verdicts, never on dwell,
   engagement, or verdict count. This is the one item where getting it wrong is worse than not
   doing it at all.

---

## 8. The interactibility surface: seven channels, one closed loop

The question "how does it learn the interactibility surface" has a precise
answer, and the honest form of it is a distinction: **the surface can now be
steered by feedback. It does not learn from it.** Those are different, and
conflating them would be the same error as reading a status as an outcome.

### What exists, and what each actually changes

| Channel | Writes | Changes | Graded? |
|---|---|---|---|
| The box, as an **instruction** | `surfaceIntent` → `renderPolicy` | form and format, immediately, no reload | **no** |
| The box, as a **goal** | `goal_dispatch_async` | a run appears on the board | reach-graded, but not about the interface |
| **Complaint** control | `uiFeedback` → `substrateGap` | an open gap, `source: human_reported` | **no** |
| **Grade** gesture | `goal_verification_label` | the oracle corpus on the hub | it *is* the grade — of the run, not the surface |
| **Legibility detector** | `substrateGap` open/close | a gap opens, and closes on re-observation | deterministic rules, not learned |
| `renderPolicy_write` | the policy impulse | the running page repaints | **no** |
| `interactorObservation` / `Event` / `Assertion` / `Attachment` | the vessel's store | **nothing** | **no** |

The last row is the finding. Four telemetry shapes exist for exactly this
purpose — click, dwell, focus, structured events, operator assertions. The
vessel accepts and stores all four. **Nothing reads any of them back.** Until
this pass the surface did not even write to them, so they were an unused
capability behind an unwritten channel.

### The one loop that closes

Only the legibility detector completes a cycle: it reads the live surface,
files a finding, and closes that finding when re-observation no longer
reproduces it — verified in both directions, including a reopen when the defect
was reintroduced. That is a real feedback loop and it is worth having.

It is not learning. The rules are fixed, the thresholds are constants, and no
posterior moves. It is a thermostat, not a learner, and a thermostat is the
right thing for a px floor.

### Why nothing learns yet — two missing preconditions

**There is no counterfactual.** Learning needs competing arms and a choice
between them. Every render decision has exactly one implementation: one form
heuristic, one policy, one layout. `renderPolicy` made the decision *steerable*,
which is the precondition — a compiled constant cannot even be varied — but a
single arm with an override is still a single arm. Nothing is being chosen
between, so there is nothing to grade.

**There is no reward.** The channels that carry the most signal about whether
this interface works — dwell, focus, correction, hesitation — are precisely the
parked ones. And the obvious rewards are the wrong ones: dwell optimises
stickiness, complaint volume optimises for a surface that annoys, and frequency
measures habit. The defensible signal is the one this surface is *for*: whether
a human reached a correct verdict, cheaply. Time from terminal state to verdict,
verdict stability, and agreement with later evidence are all computable from
data the surface already holds — and none of them is computed.

### What the complaint channel bought

It is worth being precise about what was actually gained, because it is
structural rather than cosmetic. A human complaint now files into the **same
keyspace** as the substrate's own findings, `ui-feedback-<region>-<kind>`,
differing only in `source`. That single shared key is what makes two questions
computable that were not computable before:

- the detector found it and no human ever complained — is the rule real?
- humans complained and the detector was silent — what is it blind to?

Neither is answered yet. But the funnel that would answer them exists, and both
are now measurable rather than merely arguable. That is the actual precondition
for learning which rules are worth having.

One defect surfaced in the building: the complaint category was being coerced
into the store's interaction enum (`answer | reaction | dismiss`), so every
complaint about a region collided on `ui-feedback-<region>-answer` and the second
silently overwrote the first. Category and interaction are now separate fields.
Three distinct complaints about one region now produce three gaps; before the
fix they produced one.

### The ranked distance to actual learning

1. **Give a render decision a second arm.** One shape, two renderers, selected by
   posterior. Without an alternative there is no counterfactual and nothing to
   learn — this is the item everything else waits on.
2. **Compute the reward.** Time-to-verdict on terminal runs, from data already
   held. Not dwell, not volume.
3. **Read the parked telemetry.** `interactorObservation` has no consumer; a
   signal with no reader is not instrumentation.
4. **Make `surfaceIntent` an activity.** It is a resolver, so Thompson cannot
   select it, no trace grades it, and the ribosome can never extract from it. It
   is a good floor built as a ceiling.
