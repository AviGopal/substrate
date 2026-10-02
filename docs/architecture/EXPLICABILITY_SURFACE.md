# Human goals, evidence, and learning

Status: interaction contract, with an [offline prototype](./prototypes/explicability.html)
and a [first implemented participation pathway](./HUMAN_PARTICIPATION.md). The prototype
uses invented examples. It makes no claims about current evaluation results.

## Purpose

A person should be able to state an outcome, understand the system's interpretation,
inspect the basis for a reach claim, and supply a correction without having to learn
the internal shape vocabulary. The interface should also make visible whether that
correction was received, consumed, and later useful. Receiving feedback is not evidence
that the system learned from it.

This extends the existing human surface's goal → outcome → evidence → next action
sequence. It does not require replacing that surface or the chain workbench.

## The interface is a learnable substrate composition

The durable design is the interaction contract, not a fixed arrangement of panels.
Visual structure and interaction procedure are both candidates for improvement through
experience. Human-surface-vessel is one renderer and onboarding path; it is not the
system's canonical model of human interaction. The accompanying HTML is a disposable
candidate for discussing legibility, not a new runtime or a prescribed final layout.

Use the substrate's existing idioms to express the loop:

| Interaction | Substrate expression | What must remain traceable |
|---|---|---|
| Human states a desired outcome | Goal with supplied context impulses | Original intent and later revisions |
| System asks for missing information | Activity produces a solicitation / question; human resolves it | Why the answer was needed and which activity consumed it |
| System presents an outcome | Produced impulses and artifacts, rendered according to content form and policy | Source, content, pathway and evidence scope |
| Human disputes or assesses reach | Assessment impulse linked to goal, execution and artifact | Assessor and evidence; receipt separate from downstream credit |
| Human asks for a different presentation | Surface intent resolved to a policy change, or a capability gap | Understood and unparsed portions, changed policy and outcome |
| System improves the interaction | Candidate activity or rendering variant, exercised and graded | Parent, selection context, actual variant exposure and verified result |

These are semantic mappings, not declarations of new registered shapes. Use existing
discovery contracts where available; identify absent capabilities explicitly.

There is already a concrete seed in human-surface-vessel:
[`RenderPolicy`](../../repos/human-surface-vessel/src/store.ts) carries token overrides,
content-form preferences and evidence expansion settings; [`surfaceIntent`](../../repos/human-surface-vessel/src/surface-intent.ts)
translates supported instructions into policy changes and retains unparsed demand.
That makes some presentation choices variable. It does not, by itself, prove learned
selection, durable retention, or the ability to author new interaction procedures.
Stateful-ui-vessel also exposes panel/question authoring and interactor impulses.

Extend this seed in two directions: selection among existing presentation/procedure
variants, and acquisition of a previously unavailable renderer or interaction activity.
For example, selecting an existing comparison form is selection improvement; acquiring
an evidence-comparison procedure that lets a person detect a previously hidden
contradiction is candidate structural growth. The latter earns demonstrated status
only after it changes verified human-system performance.

An interaction trial should link the human task/context, policy and procedure versions,
presented artifacts, exposure interval, human contribution, downstream execution and
assessment. Credit must be attached to the variant actually experienced. Compare
variants on correct goal interpretation, accurate reach assessment, useful clarification,
completion time and total human effort. Clicks, dwell, aesthetic preference and feedback
volume can inform investigation; they are not correctness rewards. A variant that
elicits fewer objections by hiding evidence is a regression.

The improvement pipeline therefore applies to the interface itself: detect a recurring
misunderstanding → select an investigation → author a variant → exercise on isolated
human tasks → promote/prune from evidence → propagate applicable learning. Preserve
the parent variant and evaluate transfer and retention. Pin the experienced variant
during an interaction so adaptation does not move controls under the person's focus.

Evidence provenance, explicit uncertainty, truthful action receipts and attribution
are constraints on every candidate. The system can change layout and procedure while
preserving those meanings. Existing [interaction conformance checks](../../packages/interaction-conformance/README.md)
provide a partial guard and teachable rules; their documented static limitations require
behavioral checks as well. A new surface should expose the same underlying activities
and records rather than accumulating a private learning loop inside browser state.

## Evaluation isolation during the initial design

The initial design delivery was a standalone HTML file and this document. It does not load the
live application, poll services, dispatch goals, emit interaction telemetry, submit
grades, install dependencies, or change evaluation configuration. All prototype inputs
remain in page memory and disappear on reload. Its content security policy blocks
connections and form submission. Open the file directly in a browser.

The evaluation has since completed and local implementation has begun; see the linked
participation contract for scope and tests. Human activity must be attributable before
enabling it in a measured cohort. A read-only live viewer still creates load; the tests
use isolated records and servers.

## Interaction contract

| Human question | Visible answer | Evidence boundary |
|---|---|---|
| What did I ask for? | Original goal, separately from the system's interpretation and proposed success conditions | Never rewrite the original silently; mark unconfirmed interpretations |
| What is happening? | Recorded progress, pending question, observation time, and next responsible actor | Execution status is separate from the reach claim; missing or stale records remain visible |
| Did it work? | Outcome artifact, each criterion's result, checker identity and scope | Machine claim, human assessment, and independent check remain distinct; disagreement is visible |
| Why this route? | Recorded selection inputs and pathway provenance, expandable on success as well as failure | No retrospective story presented as a recorded decision; missing inputs mean explanation unavailable |
| What do you need from me? | A specific question, why it matters, what an answer changes | Clarification, new context, goal revision, and reach assessment are separate acts |
| Did my contribution matter? | Receipt → consumption → learned-state update → applicable reuse | Each transition requires a linked record; a write acknowledgement proves only receipt |
| Is the system improving? | Frozen-cohort behavioral results beside evidenced capability changes and frontier debt | Neither run volume nor registry growth demonstrates learning |

The first screen leads with the goal, outcome evidence, and next action. Technical
identifiers and raw traces belong in expandable evidence details. Unknown, failed,
not assessed, and stale are distinct states. A truncated preview links to a complete
artifact or explicitly says that the full artifact is unavailable.

## Data needed for integration

The inspected `GoalWalkState` contract already exposes `goal`, `status`, `reached`,
`goalReachReason`, `answerBody`, `poolProvenance`, `executionPath`, `selectedTemplateId`,
`humanGraded`, `humanReachNotes`, and an unstructured `learning` object. These support
part of the view, but do not establish per-criterion independent checks, a complete
feedback-consumption chain, or a demonstrated capability graph.

Use an adapter with explicit unavailable states for the missing records. Do not infer
that a new derivation created a retained capability, that a selected template explains
why it won, or that `humanGraded` proves independent verification.

The future view model needs:

- Goal revision, original text, interpreted outcome, criterion IDs, confirmation state,
  source actor, and scope/context identifiers.
- Execution and snapshot IDs, source observation time, freshness/sequence completeness,
  pathway identity and version, and links to recorded selection evidence.
- Assessments keyed to execution, artifact version and criterion, with result
  (pass/fail/unknown), assessor identity/type, independence basis, method, and evidence.
  Preserve conflicting assessments rather than overwriting them in the display.
- Contributions with kind, author, target goal revision/execution, receipt state, and
  separately linked consumption, update, and later behavioral evidence.
- Capability snapshots with advertised/attempted/demonstrated/retained states,
  context and pathway identity, composition edges, witness runs, regressions,
  retirements, and last retention check.

Production submission must use the existing traced activity mechanisms. A changed goal
creates an explicit revision; an assessment targets the artifact actually inspected.
Failed and ambiguous submissions preserve the draft and expose delivery uncertainty.
Retry deduplication and server acknowledgement must be verified before live integration.

## Two views of progress

Convergence is local to a versioned task distribution. Show cohort, scoring revision,
starting learned-state snapshot, resource budget, and pre-registered success/false-accept
thresholds. Plot held-out performance against independently graded relevant trials,
elapsed time, and total cost including operator effort. Show denominator, uncertainty,
subsequent-window retention and controlled-change recovery. Mark “criterion not reached”
when applicable. Never pool a changing exploration set into the frozen trend.

Structural growth shows newly demonstrated reachability and compositions alongside
held-out transfer, retention, integration yield, frontier debt age, regressions and
retirements. Attribute detection, framing, authoring and verification separately;
operator presence alone cannot determine autonomous contribution. Inventory can be
shown as inventory, without labeling it demonstrated coverage.

Pipeline diagnostics show detect → select → author → exercise → promote/prune →
propagate learning, with stage-specific throughput, latency, backlog and evidence
completeness. Do not compare incompatible units to choose a numerical minimum.
The spectral rate expression remains an architectural hypothesis until its operator,
normalization and time mapping are validated. See [DEC rate model](./SUBSTRATE_AS_DEC.md)
and [dynamics limitations](./SUBSTRATE_AS_DYNAMICS.md).

## Review and acceptance

Use the prototype's reached, contradicted, and awaiting-clarification cases with people
who did not author the UI. Ask each person to identify the goal, distinguish completion
from verified reach, find contradictory evidence, identify who acts next, and explain
whether a drafted correction has changed the system. Record accuracy, time, unsupported
trust decisions and moderator assistance. Compare against the existing interface using
the same frozen cases and counterbalanced order; choose acceptance thresholds before
the study. Prototype usability is not a system convergence result.

Before integration, exercise missing/stale evidence, conflicting assessments, goal
revision, failed/ambiguous acknowledgement, duplicate submission, restart, and feedback
that was received but never consumed. Require keyboard operation, readable narrow
layouts, text labels for states and screen-reader announcements of local interactions.
Evaluate a responsibility-cycle gain later in an isolated system copy using before,
after, disable, restore, held-out-family and restart trials. A persuasive explanation
alone does not establish the causal gain.
