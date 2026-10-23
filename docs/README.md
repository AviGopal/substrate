# Documentation index

These documents describe how the substrate works and what it is held to. They have two
readers: you, and the substrate itself. `scripts/substrate/ingest-docs-as-concepts.ts`
splits each Markdown file into sections and writes them into concept-db, where the code-authoring
path reads them back at drafting time, so each document is also an expectation the system checks
its own changes against. The contract that governs this is `DOC_INGESTION.md`
under *For agents and contributors* below — read it before authoring or restructuring anything here.

This index is organised by the nine architectural purposes the substrate must manifest to
stay stable and keep growing. A document appears under exactly one purpose: the one it is
load-bearing for. New here? Start with the root README's [walk-through of one goal](../README.md#a-goal-end-to-end), and keep the
[Glossary](GLOSSARY.md) open. The canonical references, if you read only three, are
`IMPULSE_ACTIVITY_FOUNDATION.md` (what is real), `SUBSTRATE_AS_SOFTWARE.md` (how a goal
becomes work), and `SUBSTRATE_AS_DYNAMICS.md` (how evidence becomes selection), each linked
under its purpose below. Behavioural guidance for agents working in this repository lives in
the root [`CLAUDE.md`](../CLAUDE.md), which also enumerates the agent cockpit's tool surface.

## 1. Ontology — what is real

**Purpose:** fix the vocabulary of things that exist, so every other document composes
rather than redefines. There are four primitives — impulse, pointer, resolver, vessel — and
an activity is derived from them; a shape is a routing-and-reasoning key, never a schema. A document that introduces a
fifth primitive is drift; a document that describes an existing primitive under a new name
splits the concept graph and costs the drafter a correct recall.

- [Impulse-Activity Foundation](architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — the canonical ontology; read before implementing anything.
- [Impulse State Space Specification](architecture/IMPULSE_STATE_SPACE_SPEC.md) — the pool as a state space, and what selecting over it means.
- [The substrate is an open representation](architecture/SUBSTRATE_AS_REPRESENTATION.md) — shapes as axes of an open representation.
- [The substrate as a weighted cell complex](architecture/SUBSTRATE_AS_DEC.md) — the discrete-exterior-calculus lens on the same objects.
- [Glossary](GLOSSARY.md) — canonical terms; the tie-breaker when two documents disagree on a name.
- [Impulse Shape Definitions](shapes/README.md) — how a shape document declares metadata, pointer, and resolved content.
- [Impulse-Write Resolver Path](specs/impulse-write-resolver.md) — how a shape is *written*, not only read.

## 2. Execution and the walk — how a goal becomes work

**Purpose:** describe how a goal is turned into a walk over the shape graph, how producers
are chosen, how data binds shape-to-shape between steps, and how the outcome is judged.
An output is verified by its use: the activity that consumes it succeeds, fails or declines
on it, and that outcome is recorded against the producer. A consumer counts only if it can
fail on bad input. The goal's `reached` verdict is the walk's own consumer verdict on the
deliverable. It is one consuming judgment among many, not a separate verification layer, and
a human's verdict on the same deliverable is a consumer verdict of equal standing. What is
never evidence is the exit status of the template that ran: hollow completion (clean exit,
nothing reached) and satisfier reaches (dirty exit, goal attained) are both ordinary
outcomes, so any document here that equates status with success is wrong on the
load-bearing point.

- [The substrate as software](architecture/SUBSTRATE_AS_SOFTWARE.md) — the execution walk end to end, and its durability physics.
- [The substrate is a Bayesian Q-learning MDP](architecture/SUBSTRATE_AS_MDP.md) — the walk as a decision process, including horizontal composition.
- [Goal Execution Paths Schema](architecture/GOAL_EXECUTION_PATHS_SCHEMA.md) — how a goal's path is recorded and reused by a later instance of the same goal.
- [Execution sequence diagrams](architecture/sequences/README.md) — index of the step-by-step walkthroughs below.
  - [Activity selection from the impulse state space](architecture/sequences/01-activity-selection.md)
  - [Impulse resolution during activity execution](architecture/sequences/02-impulse-resolution.md)
  - [Processing of required input impulses by resolvers](architecture/sequences/03-resolver-processing.md)
  - [Improvisation, failure modes, checkpoints, rollbacks](architecture/sequences/04-improvisation-failure-modes.md)
  - [Hook registration and behavior injection](architecture/sequences/05-hooks-behavior-injection.md)
- [Conditional Tasks](guides/CONDITIONAL_TASKS.md) — gating a task on an expression, and why a skip is not a failure.
- [Activity-Level Executor Hooks](specs/activity-level-executor-hooks.md) — the injection points around a task.
- [HTTP API v2 Activity Contract](API_V2_ACTIVITY.md) — the activity-api request/response surface the walk writes through.

## 3. Learning from traces — how evidence becomes selection

**Purpose:** every execution is traced, and the traces are the learning substrate. Thompson
sampling grades activity selection, relevance scores grade impulses, and the ribosome
extracts reached executions into reusable templates. The rule that keeps this honest is
that credit follows the reach verdict rather than the exit status, and that an ungraded
outcome is skipped rather than credited or blamed — a posterior fed by exit statuses learns
to prefer whatever exits cleanly.

- [The substrate is a slow–fast dynamical system](architecture/SUBSTRATE_AS_DYNAMICS.md) — the learning dynamics on a growing complex.
- [Failure modes](learning/FAILURE_MODES.md) — the failure taxonomy the schema defines (six typed members plus the untyped `execution_error`), why the store must be counted before reasoning from it, and the outcome-conditional posterior step sizes.
- [Resolver Tracking](architecture/RESOLVER_TRACKING.md) — recording which resolver served each impulse so selection is learned, not configured.
- [`thompson_posterior` shape](impulse-types/thompson_posterior.md) — the posterior itself, as a resolvable shape.
- [Learning-Loop Write Resolvers](impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) — the write side of the loop, shape by shape.
- [Activity Template Lifecycle and Deprecation](guides/ACTIVITY_LIFECYCLE_DEPRECATION.md) — how an arm leaves selection without discarding a working posterior.
- [Template Upkeep Pipeline](guides/TEMPLATE_UPKEEP.md) — how template drift is observed and corrected through the loop itself.
- [Dashboard Analytics](guides/DASHBOARD_ANALYTICS.md) — reading the learning loop from its analytics panels.
- [Substrate framing vs. the LLM literature](architecture/LITERATURE_COMPARISON.md) — where this learning model sits against published agent research.

## 4. Self-development — the system authors and lands its own change

**Purpose:** development flows *through* the substrate so every change produces a trace and
feeds the learning loop. A code change is dispatched as a goal that names a real source
file; the substrate drafts, verifies, and lands a traced commit. The documents here define
what the authoring path reads at drafting time, what gate a proposal must clear, and where
the system's own memory lives — the substrate's store is authoritative and operator-side
memory files are a derived cache.

- [Investigating and benchmarking concept-db](guides/CONCEPT_DB_INVESTIGATION.md) — how to interrogate the prose-knowledge vessel the authoring path depends on.
- [Concept Integration Templates](guides/CONCEPT_INTEGRATION_TEMPLATES.md) — calling concept shapes from an activity template.
- [The substrate earns sovereignty](architecture/SUBSTRATE_AS_SOVEREIGN.md) — the expectation that refusal, revision and answering are authorities the system earns with evidence, never flags an operator sets.

## 5. Topology and federation — where a vessel runs, how substrates peer

**Purpose:** the system must run identically wherever it is deployed, while a vessel still
belongs where its resolver's data lives. Federation is what makes those two demands
compatible: a shape served on another substrate resolves through the same
capability-addressed query, so vessel location stops mattering to a caller — but the data
does not move, and duplicating a vessel means duplicating access to its data.

- [Federation](FEDERATION.md) — topologies, the relay, what joining as a spoke means and how to confirm it, and the operational space.
- [Federation genres](operations/FEDERATION_GENRES.md) — the distribution-policy taxonomy that decides which of N producers of a shape a caller gets, and the identity-secret namespace boundary.
- [The substrate as a fleet](architecture/SUBSTRATE_AS_FLEET.md) — durability across containers, and what may cross the boundary.
- [The substrate as a network](architecture/SUBSTRATE_AS_NETWORK.md) — how work, identity, trust, and the system itself cross the boundary.
- [Schema Ownership](SCHEMA_OWNERSHIP.md) — which vessel owns which tables, and therefore where its resolver must live.

## 6. Identity and trust

**Purpose:** identity-vessel is the single validator — every vessel checks credentials
against it, with API keys for service-to-service calls and JWTs for browser surfaces.
Tenant isolation is enforced in the database through PERMISSIONS on the token's org claim,
not in application code, which is why bypassing PERMISSIONS with root credentials defeats
the whole mechanism rather than merely skipping a check.

- [JWT Claims Structure](AUTH_JWT_CLAIMS.md) — the claims every vessel can rely on being present.
- [RBAC Guide](RBAC_GUIDE.md) — roles, scopes, and how PERMISSIONS enforce them.
- [RBAC Troubleshooting](RBAC_TROUBLESHOOTING.md) — diagnosing a denial without reaching for root.
- [`auth_token_source` Contract Field](specs/auth-token-source-field.md) — which credential a caller must present to a given vessel.
- Credentials are issued and validated by the in-fleet identity-vessel, reached at its fleet address (see [README § Installation](../README.md#installation) for the port table); there is no out-of-fleet identity host.

## 7. Interface — the agent cockpit and the human surfaces

**Purpose:** there are two kinds of interface, and they are not variants of each other. An
agent works through the metabob-mcp cockpit: dispatch a goal, poll it, reconstruct the
walk's reasoning, record a verdict. A human works through a human surface: the web human
surface, a page that takes plain language and draws what came back in the form the content
calls for; or an Obsidian vessel, where each connected vault is a surface onto a
*different* human resolver with its own local information. All are resolvers to the
substrate, never preprocessors for it — if a goal
only works after someone rewrites it into paths and shapes, that rewriting is a gap. The
cockpit's tool surface is enumerated in the root `CLAUDE.md` linked at the top of this page.

- [Running a human surface](HUMAN_SURFACE.md) — what a surface needs (a relayed hub and the join token it issues; the launch is sequence D of the install page), what runs locally versus on the hub, and why a surface that loads but cannot dispatch is a hub-link problem.
- [Human project lifecycle](guides/HUMAN_PROJECT_LIFECYCLE.md) — what a human can expect across starting or joining, configuring, maintaining, deploying, interacting and checking health, with acceptance criteria per activity.
- [Human goals, evidence, and learning](architecture/EXPLICABILITY_SURFACE.md) — the interaction contract for how a surface shows a person what was asked, what came back and the evidence behind it, with an offline prototype.
- [Human participation](architecture/HUMAN_PARTICIPATION.md) — the behaviour and evidence contract for a human's questions, answers and feedback reaching the substrate as shaped exchanges.
- [Workbench Chain-Based UX Design](architecture/WORKBENCH_CHAIN_UX_DESIGN.md) — the chain vocabulary of the workbench surface, a contract for any surface that edits chains (the workbench itself is a separate repository, not part of the running fleet).

## 8. Operations and bootstrap

**Purpose:** a substrate boots and manages itself from an image plus environment plus
volumes; nothing may depend on a particular host machine or host workspace. Learning state
persists in the container volume, so anything destructive has to account for it. The
documents here cover operating a running fleet, iterating on a vessel against a running
substrate, and authoring a new vessel that satisfies the shape-dispatch contract. Standing
a fleet up is not among them: setup (profiles, ports, install inputs, the setup sequences,
backup and teardown) lives only in [README § Installation](../README.md#installation),
which the acceptance run executes, and every document here links there rather than
restating a launch.

- [Local single-container substrate](SUBSTRATE.md) — the operating reference: inventory and topology selection, `vessel-ctl`, the iteration loop, retention, and troubleshooting.
- [Advanced configuration](operations/CONFIGURATION_SURFACE.md) — every variable beyond the install inputs, by tier; the channel that delivers each and the moment it is read; the precedence chain; the table of alias names and the names they map to.
- [Live Development Guide](LIVE_DEVELOPMENT.md) — developer-only: hot-reload iteration on one vessel's source, not a way to run the fleet.
- [TypeScript Vessel Template](architecture/TYPESCRIPT_VESSEL_TEMPLATE.md) — the invariants a new vessel must satisfy, including shape-dispatch agreement.

## 9. Gap management and measurement

**Purpose:** progress is measured by the gap triple — close rate, latency from detection to
close, and durability, meaning gaps do not reappear wearing a different hat. Activity
counts, dispatch volume, and token spend are not progress. A claim in this section names
its metric and its floor so it can be falsified; an expectation that cannot fail is not an
expectation, and a verification gate with no call sites can never be observed failing and
so can never be trusted when it passes.

- [Testing documentation](testing/README.md) — index of the verification material.
- [Quick Verification Guide](testing/QUICK_VERIFICATION_GUIDE.md) — the short path to confirming a running substrate behaves, starting from the five-level `substrate-status` verdict.

## For agents and contributors

The working notes under `process/` govern how the system's own development is run: how documents
reach the drafter, the gates a proposal passes, the qualification envelope, and the probes and
methods agents use. They are read by the substrate and by the people and agents developing it.

- [Doc ingestion](process/DOC_INGESTION.md) — the contract governing every other document in this tree, and how `docs/architecture/**` reaches the code-authoring prompt.
- [Core Idioms](process/CORE_IDIOMS.md) — the recurring compositions of the four primitives, in foundation vocabulary.
- [Impulse Conformance Ledger](process/IMPULSE_CONFORMANCE_LEDGER.md) — the invariant that every data-plane hop is a typed impulse, and the control-plane exemptions.
- [Foundation Compliance Checks](process/FOUNDATION_COMPLIANCE_CHECKS.md) — the gate between a substrate-authored proposal and admission into the change tree.
- [Memory As Substrate](process/MEMORY_AS_SUBSTRATE.md) — the `memoryNote` store, its read and write directions, and why the files are a cache.
- [The qualification envelope](process/QUALIFICATION.md) — the tasks, faults, budgets and escalation conditions the substrate must handle without operator hands, and the metrics that judge it.
- [Shape→Action→Evidence Expectations](process/SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md) — falsifiable expectations with named metrics and floors.
- [The learning-loop selftest](process/LEARNING_LOOP_SELFTEST.md) — a probe with known ground truth that follows one execution through every learning seam.
- [Substrate-Narration Protocol](process/SUBSTRATE_NARRATION_PROTOCOL.md) — the operator-side narration and gap-accumulation methodology.
