# Substrate as operations — the planes, the operating states, and the recovery ladder

This document is the **operational** view: what is running, what each plane is
responsible for, how a change physically reaches vessel code, and what recovery
means when something is wrong.

It is deliberately **not** the ontological view. `SUBSTRATE_AS_SOFTWARE.md` §1
describes the three-state triad — Informational / Transient / Observational — which
answers *what kind of thing* each artifact is. This document answers *what the fleet
is doing right now and what to do when it misbehaves*. The two use the same
vocabulary and should be read together; where they disagree, the ontology doc wins on
naming and this one wins on procedure.

Per law 9 this document carries **no status, versions, dates, or instance names**.
Current metrics come from the running substrate, never from here. Incidents and their
evidence belong in commit messages, traces, and the gap store.

---

## 1. Three planes

The system is usually described as two loops. That is incomplete in a way that
matters, because it leaves the place where failures actually concentrate unnamed.

| Plane | Responsibility | Failure signature |
|---|---|---|
| **Execution** | goal → walk → selection → resolvers → trace → verdict → ribosome | rare; the machinery does what it is told |
| **Self-development** | detectors → gaps → picker → compose → mitosis → commit → push | rare; it authors and lands reliably |
| **Verification** | everything between a drafted change and the substrate accepting it | **almost everything** |

Execution and self-development are *coupled through* verification: the
self-development plane's output becomes the execution plane's substrate. That is why
a bad change is not merely a failed task — it corrupts the thing that grades tasks.

### 1.1 Execution plane

A goal is decomposed by backward-chaining over the shape graph from the goal's target
shapes. Producers are chosen by learned posterior (Thompson sampling over activity
variants). Resolvers execute — deterministic, pattern, or LLM, the LLM being one
resolver among many and never the controller. Every execution writes a trace, and the
traces are the learning substrate: posteriors, relevance scores, and ribosome
extraction all read from them.

### 1.2 Self-development plane

Detectors observe the running system and emit gaps. A picker ranks the gap pool by
score × landability. `feature_compose` drafts a change. Mitosis stages it in a clone,
evaluates, cuts over, commits, and pushes. Deployment is pull-sync plus a **deferred**
restart.

### 1.3 Verification plane

See §3. This is the plane that requires the most operator attention and the one whose
defects are hardest to see, because its failures are silent by construction.

---

## 2. Operating states

| State | What runs | How to observe it |
|---|---|---|
| **Idle** | boredom-vessel selects from current conditions — open-gap demand, rhythm due-state, learning-mode signals — folded into selection weights. Cadence is a rhythm impulse in the pool, never a static timer (law 5). | gap pool size; rhythm due-state |
| **Goal dispatch** | the walk, or `REUSE-BEFORE-DERIVE` when the store recommends a known pathway and the walk is skipped, or the tool-enabled floor when no pathway exists | `goal_status` → read `reached`, never `status` |
| **Self-development** | the pipeline in §1.2, on pool cadence | compose and mitosis events in the vessel journal |
| **Deploying** | pull-sync mirrors files, then takes a restart that may be **deferred** while dispatches are in flight | **`MainPID`**, not file mtime — see §4 |
| **Recovering** | liveness watchdogs, restart-on-failure, pull-sync resync of the live tree | unit state and `NRestarts` |

A restart loop reports `activating`, never `failed`. Ask `NRestarts`.

---

## 3. How a change physically reaches vessel code

Direct edits to `repos/<vessel>/src/**` are gated. The sanctioned path is a goal, so
that every change produces a trace the learning loop can grade.

```
goal naming a file
  → edit-intent detection            (routes to compose; fires on non-TS paths too)
  → fc-grounding                     (refuses blind decompose when the target is not in the window)
  → drafter                          (writes the change)
  → staticEvaluate                   (the vessel's real check scripts + effect gates)
  → deterministic refusal chain      (shapeVocab ?? cjs ?? endpoint ?? inertLiteral ?? surqlBreaking)
  → semantic judge                   (does the diff address the stated goal?)
  → mitosis cutover                  (stage → verdict → commit → push)
  → pull-sync                        (mirror to the live tree, then a deferred restart)
```

### 3.1 The three questions a change must answer

1. **Is it valid?** — typecheck, shape-dispatch agreement, tests.
2. **Does it address the goal?** — the semantic judge.
3. **Does it DO anything?** — effect gates.

The third is the one that is easy to omit and expensive to omit. A change can be
valid, address its goal, and still be inert or actively harmful. Reading a diff cannot
establish effect; only running the changed behaviour can.

### 3.2 What a gate must not do

A gate that refuses everything is as damaging as one that refuses nothing, and harder
to notice: an over-refusing gate produces no outage, it silently stops anything from
landing. Any fail-closed rule must therefore be validated **in both directions** —
against artifacts it must refuse *and* artifacts it must not — and against the real
corpus before it ships.

For the same reason, a gate should state the rule it fired on. A refusal for the wrong
reason is a latent wedge: the artifact was rejected, so it looks correct, while the
rule that was supposed to catch it never ran.

---

## 4. The failure class that dominates

> **A component reports success about something it did not examine.**

This single shape accounts for the overwhelming majority of observed defects. It
recurs because success is the default return value of a component that did no work.

Recognisable instances:

- a checker that runs tools for one language over an artifact in another
- a ledger that records work as done without doing it
- a startup hook whose exit status is discarded
- a schema layer that accepts and discards an undeclared field
- a test that exercises the writer while the storage layer drops the write
- a detector that logs only on failure, so silence is indistinguishable from not running

**The countermeasure is a rule, not a checklist item:**

> **Verify at the layer that CONSUMES the artifact.**

| artifact | consuming layer | *not* |
|---|---|---|
| a schema declaration | `INFO FOR TABLE` | the migration file |
| a deployed change | `MainPID` / `ActiveEnterTimestamp` | the file on disk |
| a landed diff | executing the changed line | reading the diff |
| a database write | reading the value back | the write's own success flag |

Two corollaries worth stating explicitly, because both have produced false findings:

- **Name the denominator.** A count is meaningless until you say what population it
  is over. Restricting a scan to the population where the defect is actually possible
  is usually the difference between a signal and an unreadable pile of noise.
- **An unmeasurable condition is not evidence of that condition.** A check that could
  not run must report that it could not run, never zero findings.

---

## 5. The recovery ladder

Ordered by dependency: each rung is worth little until the ones above it hold.

1. **The fleet is up and writing traces.** Nothing below matters if the trace store is
   rejecting writes. Check unit state, then whether an ordinary write to the core
   tables succeeds.
2. **Nothing lands unexamined.** Every staged artifact is checked by something that
   actually reads it; a checker with no parser for a file type fails closed rather
   than reporting success.
3. **Landed changes are known to do something.** Effect verification, not diff
   reading.
4. **The gates are known to still work.** Each deterministic rule is exercised
   periodically with an artifact it must refuse and one it must not. Without this,
   gate quality decays silently and is bounded by operator attention.
5. **Drift is detected rather than rediscovered.** What the system declares about
   itself is continuously compared against what is true, and divergence files a gap.
6. **Outcomes are graded.** Until the goal-level verdict is recorded on most
   executions, selection is learning from a proxy and any claim about compounding is
   unfalsifiable.
7. **Evidence accumulates per arm faster than arms are minted.** Posterior movement is
   a *rate* requirement, not a bank: evidence decays. If arms grow faster than
   graded executions per arm, selection cannot improve regardless of how good the
   gates are. Reuse before mint (law 3) is the lever; retirement is the brake.

Rungs 1–5 are verification and are tractable with ordinary engineering. Rungs 6–7 are
why the system can be fully gated and still not improve, and no amount of gate work
substitutes for them.

### 5.1 What "functioning as expected" means

Not a threshold — a **window**. The criterion is a sustained period in which the
self-development plane lands only correct changes with no operator intervention.
A gate metric can improve while the system does less; a zero-intervention window
cannot be gamed that way.

Until then the honest statement is: *the loop runs and defends itself, and it cannot
yet tell without help whether what it shipped was worth shipping.*

---

## References

- `IMPULSE_ACTIVITY_FOUNDATION.md` — the canonical ontology
- `SUBSTRATE_AS_SOFTWARE.md` — the execution model and the three-state triad
- `SUBSTRATE_AS_DYNAMICS.md` — learning dynamics, the fast/slow split
- `../SUBSTRATE.md` — the operator manual: launching, `vessel-ctl`, deploy paths
