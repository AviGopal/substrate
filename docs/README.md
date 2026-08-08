# Documentation index

Every document under `docs/` is an **expectation the substrate holds about itself**, not
prose about the substrate. The tree is a runtime input: `scripts/substrate/ingest-docs-as-concepts.ts`
splits each file into sections and writes them into concept-db, where the code-authoring
path reads them back at drafting time. The contract that governs this is `DOC_INGESTION.md`
under purpose 4 below — read it before authoring or restructuring anything here.

This index is organised by the nine architectural purposes the substrate must manifest to
stay stable and keep growing. A document appears under exactly one purpose: the one it is
load-bearing for. The canonical entry points, if you read only three, are
`IMPULSE_ACTIVITY_FOUNDATION.md` (what is real), `SUBSTRATE_AS_SOFTWARE.md` (how a goal
becomes work), and `SUBSTRATE_AS_DYNAMICS.md` (how evidence becomes selection), each linked
under its purpose below. Behavioural guidance for agents working in this repository lives in
the root [`CLAUDE.md`](../CLAUDE.md), which also enumerates the agent cockpit's tool surface.

## 1. Ontology — what is real

**Purpose:** fix the vocabulary of things that exist, so every other document composes
rather than redefines. There are four primitives — impulse, pointer, resolver, vessel —
and a shape is a routing-and-reasoning key, never a schema. A document that introduces a
fifth primitive is drift; a document that describes an existing primitive under a new name
splits the concept graph and costs the drafter a correct recall.

- [Impulse-Activity Foundation](architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — the canonical ontology; read before implementing anything.
- [Impulse State Space Specification](architecture/IMPULSE_STATE_SPACE_SPEC.md) — the pool as a state space, and what selecting over it means.
- [Impulse Conformance Ledger](architecture/IMPULSE_CONFORMANCE_LEDGER.md) — the invariant that every data-plane hop is a typed impulse, and the control-plane exemptions.
- [The substrate is an open representation](architecture/SUBSTRATE_AS_REPRESENTATION.md) — shapes as axes of an open representation.
- [The substrate as a weighted cell complex](architecture/SUBSTRATE_AS_DEC.md) — the discrete-exterior-calculus lens on the same objects.
- [Glossary](GLOSSARY.md) — canonical terms; the tie-breaker when two documents disagree on a name.
- [Core Idioms](CORE_IDIOMS.md) — the recurring compositions of the four primitives, in foundation vocabulary.
- [Impulse Shape Definitions](shapes/README.md) — how a shape document declares metadata, pointer, and resolved content.
- [Impulse-Write Resolver Path](specs/impulse-write-resolver.md) — how a shape is *written*, not only read.

## 2. Execution and the walk — how a goal becomes work

**Purpose:** describe how a goal is turned into a walk over the shape graph, how producers
are chosen, how data binds shape-to-shape between steps, and how the outcome is judged.
The judged quantity is `reached` — whether the goal was actually attained — not the exit
status of the template that ran. Hollow completion (clean exit, nothing reached) and
satisfier reaches (dirty exit, goal attained) are both ordinary outcomes, so any document
here that equates status with success is wrong on the load-bearing point.

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
- [Activity Task Context Propagation](guides/ACTIVITY_TASK_CONTEXT_PROPAGATION.md) — how a later task sees what an earlier one produced.
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
- [Failure modes](learning/FAILURE_MODES.md) — the six-member failure taxonomy carried on traces, and the outcome-conditional posterior step sizes.
- [Runtime Activity Tracing](architecture/RUNTIME_ACTIVITY_TRACING.md) — the meta-trace levels and what each records.
- [Resolver Tracking](architecture/RESOLVER_TRACKING.md) — recording which resolver served each impulse so selection is learned, not configured.
- [`thompson_posterior` shape](impulse-types/thompson_posterior.md) — the posterior itself, as a resolvable shape.
- [Learning-Loop Write Resolvers](impulse-types/LEARNING_LOOP_WRITE_RESOLVERS.md) — the write side of the loop, shape by shape.
- [Activity Template Lifecycle and Deprecation](guides/ACTIVITY_LIFECYCLE_DEPRECATION.md) — how an arm is retired without discarding a working posterior.
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

- [Doc ingestion](self-development/DOC_INGESTION.md) — the contract governing every other document in this tree, and how `docs/architecture/**` reaches the code-authoring prompt.
- [Foundation Compliance Checks](FOUNDATION_COMPLIANCE_CHECKS.md) — the gate between a substrate-authored proposal and admission into the change tree.
- [Memory As Substrate](MEMORY_AS_SUBSTRATE.md) — the `memoryNote` store, its read and write directions, and why the files are a cache.
- [Investigating and benchmarking concept-db](guides/CONCEPT_DB_INVESTIGATION.md) — how to interrogate the prose-knowledge vessel the authoring path depends on.
- [Concept Integration Templates](guides/CONCEPT_INTEGRATION_TEMPLATES.md) — calling concept shapes from an activity template.

## 5. Topology and federation — where a vessel runs, how substrates peer

**Purpose:** the system must run identically wherever it is deployed, while a vessel still
belongs where its resolver's data lives. Federation is what makes those two demands
compatible: a shape served on another substrate resolves through the same
capability-addressed query, so vessel location stops mattering to a caller — but the data
does not move, and duplicating a vessel means duplicating access to its data.

- [Federation](FEDERATION.md) — topologies, the relay, joining as a spoke, and the operational space.
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
- [Identity Vessel curl examples](IDENTITY_VESSEL_CURL_EXAMPLES.md) — the request shapes for issuing and validating credentials by hand.

## 7. Interface — the agent cockpit and the human surfaces

**Purpose:** there are two kinds of interface, and they are not variants of each other. An
agent works through the metabob-mcp cockpit: dispatch a goal, poll it, reconstruct the
walk's reasoning, record a verdict. A human works through one of two: the web human
surface, a page that takes plain language and draws what came back in the form the content
calls for; or an Obsidian vessel, where each connected vault is a surface onto a
*different* human resolver with its own local information. All are resolvers to the
substrate, never preprocessors for it — if a goal
only works after someone rewrites it into paths and shapes, that rewriting is a gap. The
cockpit's tool surface is enumerated in the root `CLAUDE.md` linked at the top of this page.

- [Running a human surface](HUMAN_SURFACE.md) — five steps to put a page in front of a person: config, image, launch, open, ask. What runs locally versus on the hub, and why a surface that loads but cannot dispatch is a hub-link problem.
- [Workbench Chain-Based UX Design](architecture/WORKBENCH_CHAIN_UX_DESIGN.md) — the chain vocabulary of the workbench surface.
- [Interactive Activities and the Human Resolver](guides/INTERACTIVE_ACTIVITIES_AND_HUMAN_RESOLVER.md) — dispatching a task to a human as a resolver and waiting on the answer.
- [Substrate-Narration Protocol](SUBSTRATE_NARRATION_PROTOCOL.md) — the operator-side narration and gap-accumulation methodology.
- [Substrate presentation deck](SUBSTRATE_PRESENTATION_2026_06.md) — the slide-level framing used to explain the system to an outside audience.

## 8. Operations and bootstrap

**Purpose:** a substrate boots and manages itself from an image plus environment plus
volumes; nothing may depend on a particular host machine or host workspace. Learning state
persists in the container volume, so anything destructive has to account for it. The
documents here cover standing the fleet up, iterating on a vessel against a running
substrate, and authoring a new vessel that satisfies the shape-dispatch contract.

- [Local single-container substrate](SUBSTRATE.md) — bootstrap, the vessel fleet, port conventions, and troubleshooting.
- [Live Development Guide](LIVE_DEVELOPMENT.md) — hot-reload iteration against a running vessel.
- [TypeScript Vessel Template](architecture/TYPESCRIPT_VESSEL_TEMPLATE.md) — the invariants a new vessel must satisfy, including shape-dispatch agreement.

## 9. Gap management and measurement

**Purpose:** progress is measured by the gap triple — close rate, latency from detection to
close, and durability, meaning gaps do not reappear wearing a different hat. Activity
counts, dispatch volume, and token spend are not progress. A claim in this section names
its metric and its floor so it can be falsified; an expectation that cannot fail is not an
expectation, and a verification gate with no call sites can never be observed failing and
so can never be trusted when it passes.

- [Shape→Action→Evidence Expectations](architecture/SHAPE_ACTION_EVIDENCE_EXPECTATIONS.md) — falsifiable expectations with named metrics and floors.
- [External Validation](guides/EXTERNAL_VALIDATION.md) — validation as a resolver, and the error-type taxonomy it applies.
- [Testing documentation](testing/README.md) — index of the verification material.
- [Quick Verification Guide](testing/QUICK_VERIFICATION_GUIDE.md) — the short path to confirming a running substrate behaves.
