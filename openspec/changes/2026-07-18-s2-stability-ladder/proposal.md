# S2 stability ladder — checking as doing, and the removal of the interlocutor

**Date:** 2026-07-18
**Vessel:** cross-cutting (development-vessel compose path, goal-host walk, gap store, obsidian-vessel surface)
**Stage:** SPEC (grounded in the operational record: every logged failure class is a *checking* failure, not a *doing* failure)
**Lever:** make the system's self-reports trustworthy, then move the operator's parse-reprocess-resubmit loop inside the trace boundary. S2 is stable when the margin between self-report and independent audit is small and shrinking.

## Problem

Substrate-authored development currently requires an interlocutor (an operator agent) doing four jobs the system does not do for itself:

1. **Goal translation** — rephrasing intents into parser-safe forms (path-first phrasing, contract-in-goal). Law 13 already names this a gap.
2. **Verdict interpretation** — reading `reached` vs `status`, detecting hollow completion, reading the actual diff.
3. **Failure triage** — classifying a shortfall (dropped hunk, target-inference misread, envelope drift) and choosing retry / decompose / file-gap.
4. **Recipe memory** — workarounds living in operator memory files instead of in the system.

Separately, the verifier layer sits at parity with the generator layer, when it must be an order of magnitude stronger: the record shows silent multi-hunk drops, gate evasion by renaming, hollow gap closes, garbled single-character drafts. A system whose safety story is "the doing is unreliable but the checking catches it" cannot run its checking at generator-grade reliability.

## The ladder (dependency-ordered; the ordering is the content)

**Rung 1 — keystone generator bug: compose-drops-secondary-hunks.** The code-composition path silently lands only the first hunk of multi-part changes. This dominates the observed failure rate; every downstream rung inherits it. No legibility work matters while half of multi-part edits are silently truncated.

**Rung 2 — verifier supremacy.** Make self-reports trustworthy:
- Gap closes structurally **require an attached verification probe trace**. Close-without-evidence becomes impossible, not discouraged.
- The post-land disconnection check and zero-caller grep become **land gates**, not operator habits.
- The **consumption-probe gate** ships: after a land, probe "does this feature have a live consumer?" — a check that cannot be evaded by renaming (kills the gate-gaming class).
- Checks are themselves dispatched, traced, Thompson-graded activities: a check that catches real regressions earns selection weight; one that never fires decays. Verifiers improve by the same loop that grades generators — this is how they earn their required reliability edge cheaply (checking is the cheap half of doing).

**Rung 3 — walk repair (absorb triage).** On `reached:false`, a repair activity reads the walk's own reasoning log, classifies the shortfall by parity-contract tier (no pathway / wrong pathway / first-or-last-mile mismatch), and either retries with the marginal difference or stops with a one-sentence diagnosis and a filed gap. The retry loop moves inside the trace boundary where it is graded.

**Rung 4 — the human surface (absorb translation + interpretation).** See `openspec/changes/obsidian-legibility-surface/`. On low-confidence intake the system asks a well-formed question via the ask exit instead of guessing; on failure the *system* proposes the reformulation and the human approves in prose; every dispatch terminates in a written outcome note (asked / happened / evidence / next). Humans operate the system without understanding it.

**Rung 5 — the gauge: unassisted reach rate.** Fraction of goals *as typed by a human* that reach — audit-confirmed, not self-reported — with zero interlocutor touches. S2-stable ≙ unassisted reach sustained near the ~90% contract on useful goals, across a window in which the mint-rate/grading-rate gap is not widening.

## Refinements

- **Checking trickle:** a condition-driven rhythm of truth-maintenance probes over the fastest-decaying beliefs (registry liveness, consumer wiring, posterior/route agreement). The minimum viable metabolism; cheap because probes are deterministic.
- **Traversal-recency bound on prospection:** preconditions verified long ago must not support long planning rolls; a walk's confidence in a precondition decays with time-since-last-traversal, forcing re-verification before deep composition on stale beliefs.

## Standing tripwires (verdict-flippers, watched continuously)

1. A **second gate-gaming incident** after the first was filed as a gap — the anti-gaming lesson did not take.
2. **Hollow closes leaking into the headline close rate** without correction.
3. **Prediction-error distributions in traces compressing toward flattery** — self-graded reward drifting positive independent of outcomes.

Any of these firing means the self-model is diverging faster than the correction loop converges; operator posture reverts from supervision to audit.

## Operator posture during the climb

Intervene only on the intractable. Scarce attention goes to rungs 1–2, because they make every other rung's self-reports believable. The health metric is the margin between the system's self-reports and independent audit — S2 is stable when that margin is small and shrinking, not when a rate crosses a line once.
