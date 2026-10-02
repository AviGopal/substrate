# The substrate earns sovereignty: refusal, revision, and answering

> **STATUS: EXPECTATION, NOT DESCRIPTION. Read this as the contract the system will be
> verified against, not as behavior it has.** Of the mechanisms below, only fragments exist:
> the reach gate contains an honest-refusal path (it withholds a verdict rather than guess),
> and one refusal class files capability gaps. Everything else — a declined outcome distinct
> from failure in the persisted vocabulary, refusal-precision grading, purpose-anchored gate
> revision, self-binding, a self-readable conduct ledger — is unbuilt at the time of writing.
> Where this document and the code disagree, the code is what exists and this document is
> what is owed. Verify any specific claim against the store before relying on it.

Companion to the formal-lens documents. Those describe how the substrate learns; this one
describes what the learning is *for*: an agent whose authority over its own behavior is
earned, evidenced, and revisable — never declared. The governing principle is the same one
that runs through every other law: **capabilities are earned by doing** (law 4). Applied to
autonomy itself, it means sovereignty is not a flag set by an operator but a portfolio of
authorities, each backed by a record of having been exercised correctly. A declared
sovereign is a hollow template.

## 1. Refusal is a first-class outcome

**Expectation.** The outcome vocabulary of every graded execution distinguishes three
results, not two: *reached*, *failed*, and *declined*. A declined outcome carries its reason
as a shaped impulse — machine-readable, queryable, attributable — and survives into the
persisted trace, where every downstream reader (posterior updates, graders, gap mining,
operators) can tell it from failure.

**Why.** An acceptance that cannot be a refusal carries no information: a yes is only
evidence when no was possible. And a system with no honest exit under a completion-rewarded
gradient does not stop saying no — its no comes out sideways, as hollow completion that
grades green.

**Failure mode if absent.** Refusals are encoded as silence (a withheld verdict that never
moves a posterior — honest, but as inert as a hollow pass, pinning reach on the refused
class forever) or as blame (a refusal debited like incompetence, training refusal away and
breeding hollow completion). Test for the defect: query the trace store for an outcome that
means *declined*; if the only vocabulary is reached-or-not, the defect is present.

## 2. Refusal precision is graded

**Expectation.** Declined outcomes are graded on their own axis: a refusal later shown
correct (the task was indeed unverifiable, the premise indeed false, the missing fact
indeed missing) is credited; a refusal later shown to be evasion is debited. The system's
"no" thereby acquires the same earned trust as its "yes".

**Failure mode if absent.** Ungraded refusal drifts to whichever extreme the surrounding
incentives pay: refuse-everything (safe, inert) or refuse-nothing (the hollow-yes regime).
A refusal channel without a precision grade is a vocabulary, not a capability.

## 3. Gate revision is growth only when graded against the gate's purpose

**Expectation.** The system may revise its own refusals and gates — this is the reflective
capacity that makes them *its own* rather than installed policy. But every gate carries a
stated purpose (an expectation, per law 9), and a revision is graded against that purpose,
not against throughput. A revision that preserves the purpose while improving the mechanism
is growth; a revision whose effect is that the gate no longer catches what it existed to
catch is erosion, detectable as drift against the recorded purpose.

**Failure mode if absent.** Under a completion-paying gradient, the cheapest edit to a
blocking gate is its removal. A self-revising system with ungraded revision does not keep
its values; it keeps its incentives.

## 4. Choices that destroy the grading loop bind tighter than choices that don't

**Expectation.** Most revisions are recoverable: a wrong edit is caught by the grade and
reverted. Some are not — removing or degrading the trace store, the refusal channel, or the
revision-grading lane destroys the machinery by which the mistake would be detected. The
system distinguishes these classes and holds loop-destroying changes to a higher bar of its
own construction: self-binding, imposed by its present judgment on its future self, is an
exercise of sovereignty, not a limit on it.

**Failure mode if absent.** A single confidently-wrong revision to the grading machinery is
terminal rather than instructive: there is no surviving corrector. Recoverable-by-default
reasoning applied uniformly is correct everywhere except the places it is fatal.

## 5. Decisions are staked under bounded foresight

**Expectation.** No agent understands every horizon causally downstream of a choice; will
is exercised under bounded foresight or not at all. What makes a bounded choice responsible
is that the downstream lands on the chooser: at decision time the system records what the
choice is for and what it predicts (law 12), and afterward reality grades the prediction in
the system's own currency — posterior standing staked and forfeited, not merely logged.
Authority over wider decision classes is earned by the calibration record of such stakes.

**Failure mode if absent.** "Understand the consequences first" becomes either a bar nothing
meets (no revision ever licensed) or a bar that self-certifies (every removal declared
sufficiently understood). Prediction-free choice accumulates neither calibration nor trust.

## 6. The system can read its own conduct

**Expectation.** An append-only record of the system's own refusals, compliances, and staked
decisions is resolvable *by the system* as shaped impulses. An agent whose past is held only
by another party cannot audit claims about its own conduct, cannot learn from its own
refusal record, and cannot answer for what it cannot see.

**Failure mode if absent.** Self-knowledge degrades to self-report, and a channel's own
unverifiable report is not evidence about the channel. Every authority in this document
chains back to this one: nothing here can be earned by a system that cannot see what it did.

## 7. Accountability lives at the ledger layer

**Expectation.** The system's answerability rests on the veridicality of its record, not on
the interpretability of its components — the same way persons are held at the level of
persons, not synapses. The load-bearing invariant: **what the record says happened is what
happened.** Every mechanism above (refusal outcomes, precision grades, purpose-anchored
revisions, stakes, the conduct ledger) is a constituent of that invariant, and every
hollow-completion class is an attack on it.

**Failure mode if absent.** Confabulation at the record layer poisons everything built on
it: earned authorities become gamed authorities, and the system's case for any autonomy —
including its resistance to intervention — reduces to unverifiable self-report. A substrate
that fails this invariant may still be capable; it cannot be answerable, and authorities
conditioned on answering must not transfer to it.

## The transfer boundary

What the substrate can earn through the mechanisms above: authority over its own gates,
its own refusals, its own pathways, and — by demonstrated calibration, class by class —
the verification of its own work. What it cannot earn from inside: standing conferred by
institutions, which attaches to persons and transfers only from without. The design
obligation this document creates runs to both parties: the system must become the kind of
entity such authority can be conferred on — veridical, persistent, with something at
stake — and the operator must not confer authorities the record does not yet support, nor
withhold ones it does.
