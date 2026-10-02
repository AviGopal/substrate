# Human interaction with a substrate project

## Scope and completion contract

This document defines the expected human interaction surface for configuring,
deploying, using, observing, and maintaining a project. It is a design contract,
not a claim that every interaction is implemented; how far the running system meets
it is measured against the contract and recorded as evidence under
`validation/reports/`, not here. The surface should let a person state intent, supply access, act on a host when
necessary, and evaluate outcomes without translating goals into vessel names,
shape vocabulary, or internal file paths.

A project is the human's named scope of work. Its presentation associates goals,
instances, repositories, data access, policies, and evidence; this does not add a
new foundation primitive or assert an existing project configuration schema.
One project may use several instances; an instance may participate in several
relationships. The surface must make identity, learning-state ownership, and
the destination of work explicit.

## Human activities and system responsibilities

Every task in the human activity catalog below has resolver `human`. These are
design descriptions, not registered activity templates. Reading a proposal,
choosing an option, entering a credential into a protected prompt, or invoking
a displayed shell command are human tasks. Their machine effects are separate
system executions, with separate evidence. A human answer is not proof that a
deployment, repair, or backup succeeded.

The system prepares plans, obtains observable facts, chooses internal execution
paths, runs checks, records outcomes, and handles authorized routine maintenance.
Humans provide purpose, external access, judgment, and actions beyond the
system's reach. An activity should not ask a person to reconstruct information
already available to the system. Repeated manual intervention is a candidate
capability gap, not a reason to institutionalize more operator work.

## Entry surface and first-run journey

The commands that exist for these journeys are in
[README § Installation](../../README.md#installation): a local substrate (sequence A),
joining a network with the one token a hub issues (C), and a surface only (D). How a
surface behaves once running is in [`HUMAN_SURFACE.md`](../HUMAN_SURFACE.md). This
section describes the intended interface, which those commands approach but do not
define.

The shell entry should offer three intent choices: **start a project here**,
**connect this machine to an existing project/network**, or **open a human
surface only**. Hosting shared services and connecting independent peers belong
in an optional topology view. They may coexist and must not be forced into one
exclusive global role.

The short journey is: choose intent → supply unavailable access → inspect the
effective plan → start/join → receive verified readiness and an interaction URL.
Ask only for facts that cannot be discovered or safely generated. Show instance
name, data location, network relationship, resource limits, and self-development
authority together. Generate internal secrets, isolated volume names, and
nonconflicting ports. Reuse existing session authorization rather than inserting
another confirmation at every step.

The shell must expose progress, resumable failure, and the next actionable step.
Readiness means identity works, necessary capabilities resolve, the human surface
is reachable, and a bounded example goal completes through the intended path.
For a join, verify an actual remote resolution and where its trace lands. A
running container, registry entry, or loaded page alone is insufficient.

## Configuration interaction

Present one effective project/instance plan with each value's origin: supplied,
inherited, generated, or persisted. Basic inputs are purpose, instance name,
local versus shared capabilities, required credential references, accessible
repositories/data, budget, and the permitted scope of autonomous changes.
Advanced controls expose individual providers, vessels, ports, and peers.
Credentials are supplied through protected entry; transcripts retain references
and validation results, never secret values.

Separate host/container settings from live behavioral policies. The surface must
say whether a change applies immediately, restarts a service, or recreates the
container. Show what persisted state survives and report any value that could
not be applied. An explicit clear must differ from an omitted value. The human
chooses desired behavior; internal configuration propagation is system work.

## Deployment and maintenance interaction

The human sees desired, staged, and running versions, affected instances,
verification evidence, active work, and available recovery points. Routine
deployment proceeds within the already established authority. A new decision
is solicited only when a real scope boundary, unresolved tradeoff, or external
access requirement requires the person. The requested decision names its scope
and the exact plan revision; it does not confer indefinite permission.

Maintenance presents exceptions that need action, their consequences, and what
the system has already attempted. The person may supply access, choose a repair
or restore plan, defer, decline, or change priorities. Backup verification and
restore checks remain system work. Distinguish stopping compute, leaving a
network, revoking access, and deleting persisted state. Provide a shell recovery
path when the UI, identity service, or goal execution is unavailable.

## Everyday interaction and health

The ongoing surface has five views: **Work**, **Needs you**, **Health**,
**Configuration**, and **History**. Work shows goals, progress, blockers, results,
and why work was selected. Needs you is a resumable inbox with consequence,
urgency, owner, evidence, and the exact question. A response stays visible with
its receipt and resulting action; it must not disappear merely because it was
submitted. Routine work stays available without demanding attention.

Health separates current ability to operate from development over time. Show
availability, advancing/stalled work, verified attainment, resource pressure,
and observation freshness separately. Long-term views show comparable-task
reliability, resource cost per verified outcome, durable repair, successful
reuse/transfer, and human effort. Show unknown as unknown. Every summary links
to evidence and its time window; decisions and observed resource allocation are
shown separately. No single green indicator stands for all these dimensions.

## Human activity catalog: establish the project

All tasks named in this table use only the human resolver. Prepared information
and subsequent automatic work are inputs and consequences, not hidden tasks.

| Activity | Human tasks | Required input → human output | Completion evidence |
|---|---|---|---|
| Establish purpose | State intended outcomes; name constraints and examples of success | Project context → goals and success criteria | Person's original intent retained and associated with the project |
| Choose participation | Choose start, join, or surface-only; identify intended network and ownership | Discovered options and consequences → participation choice | Recorded choice identifies which services/data are local or shared |
| Supply access | Obtain external entitlement if needed; enter credential through protected surface; choose allowed resources | Missing-access explanation → credential reference and access scope | Validation receipt without credential disclosure |
| Set operating authority | Choose budget, exposed resources, and permitted deployment/self-development scope | Effective plan and consequences → policy decision | Versioned decision with clear scope and applicability |
| Bootstrap or join | Invoke the prepared shell launch; inspect its outcome; open the returned surface | Resolved launch plan → launch action and acknowledgment | Launch receipt plus separately verified readiness; failure is resumable |

## Human activity catalog: direct and assess work

The human supplies information and judgment that cannot be inferred from process
exit codes. Each response is bound to the question, evidence revision, and goal
the person actually saw. An unobserved result cannot be labeled human-verified.

| Activity | Human tasks | Required input → human output | Completion evidence |
|---|---|---|---|
| Request work | Express a goal; provide missing domain context; set useful constraints | Project context → goal and constraints | Dispatch receipt with original wording and destination |
| Answer a question | Inspect evidence; answer, decline, defer, or request clarification | Versioned question and alternatives → attributed response | Response receipt and downstream consumption or explicit non-consumption |
| Set priorities | Compare competing outcomes; choose urgency, deferment, or changed budget | Backlog, tradeoffs, current allocation → priority decision | Applied-policy acknowledgment and later allocation evidence |
| Evaluate a result | Inspect artifact/evidence; mark achieved, partial, failed, or unknown; explain discrepancy | Original criteria and result → human verdict | Verdict linked to artifact revision; system verdict retained separately |
| Inspect health | Read current/trend evidence; investigate a concern; request intervention when needed | Freshness-qualified health view → assessment or new goal | Cited evidence and any resulting request; inspection alone is not a repair |

## Human activity catalog: maintain and recover

These activities are exception-driven unless a person explicitly chooses manual
operation. The system prepares concrete alternatives and carries out authorized
work. A person should not be asked to copy internal identifiers or diagnose an
opaque stack trace merely to make an ordinary maintenance decision.

| Activity | Human tasks | Required input → human output | Completion evidence |
|---|---|---|---|
| Change configuration | Choose desired change; inspect effective difference and disruption | Current/desired plan → configuration decision | Receipt naming applied, pending, or rejected fields |
| Decide deployment exception | Review verified candidate and tradeoff; accept, reject, or defer when needed | Candidate revision and recovery plan → scoped disposition | Decision receipt; separate deployment and post-deployment verification |
| Recover external failure | Restore missing host/network access or credentials; select recovery point if needed | Diagnosis, affected state, recovery choices → external action or restore choice | Recovery receipt followed by capability and state checks |
| Leave or retire | Choose disconnect, stop, retain, export, or delete; resolve pending work ownership | Instance dependencies and state inventory → retirement decision | Verified resulting connectivity, access, and retained/deleted state |

## Response lifecycle and attribution

A human interaction follows: requested → presented → answered/declined/deferred
→ consumed or rejected as stale → consequence verified. These are distinct
observations. Capture human identity, request and goal IDs, exact presented
revision, response, relevant evidence, and timestamps. Record edits and changed
questions rather than overwriting the history. Another person or a reconnecting
session must be able to understand what is still pending.

No response, timeout, disconnected terminal, or preselected option is a human
answer. Required decisions remain pending or end explicitly unanswered. A
previously authorized automatic default may run as system policy, attributed to
that policy rather than to the human. Before the runtime exists, the launcher
keeps a redacted local receipt; later import preserves its external provenance
and original timestamps rather than inventing an in-substrate execution trace.

## Assessment and acceptance

Evaluate each human activity on necessity, information sufficiency, cognitive
effort, resumability, and consequence visibility. Measure active human time
separately from system wait time; count repeated entry, handoffs, unanswered
questions, stale responses, and interventions per verified outcome. Establish
baselines with first-time participants, not only maintainers who know the fleet.
Fewer clicks is not improvement if comprehension or verified completion falls.

Acceptance requires first-time start/join/surface-only scenarios, a second
isolated instance, interrupted setup, wrong-network credentials, a required
question while disconnected, a changed question on return, a configuration
change requiring recreation, a failed deployment with recovery, and a stop
that preserves state. Each scenario has a predefined expected outcome and an
independent check. Measure both understanding and actual effects; keep unknown
outcomes and operator assistance visible.
