# Core Idioms of the Substrate

> Names the recurring patterns the substrate
> uses, defined in foundation-aligned vocabulary, with citations to the specs
> that already use them. This document introduces no new primitives — every
> idiom here is a composition of the four primitives named in
> [`architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
> ("Minimum Self-Stable Set", §47–68): **impulse**, **pointer**, **resolver**,
> **vessel**.
>
> **Purpose**: Substrate-side concept extraction needs a single source for the
> idioms (recurring patterns) the system queries against. Today these are
> scattered across the foundation prose and individual spec design docs. This
> document consolidates them so a subsequent run of `extract-concepts-from-docs`
> against this file populates `concept-db` with idiom-typed concepts.
>
> **Scope**: 13 idioms (idiom 13, "Neutral emitter", is an S2→S3 extension
> appended to the original 12). The list is closed against the foundation
> model; new idioms enter via spec proposals, not via this file.

---

## 1. Classification: lift-critical vs S2→S3 extension

The IAL S1 → S2 lift (per `2026-04-26-impulse-activity-loop/tasks.md` §27.S.4)
requires a minimum cohesive idiom set. Subsequent S2 → S3 motion (§27.S.5,
§27.S.6) extends it. Each idiom in §2 below is tagged with its classification.

| # | Idiom | Lift-critical? | Notes |
|---|---|---|---|
| 1 | Goal → Activity → Trace | **Yes** | The atomic loop unit; nothing works without it. Foundation §353–457. |
| 2 | Discovery + Resolve by shape | **Yes** | Required for vessel routing. Foundation §292–334. |
| 3 | Thompson selection on (key, problem-class) | **Yes** | Required for selection learning. Foundation §215–223, §474–488. |
| 4 | Lifecycle hook subscription | **Yes** | Required for the meta-activity layer. Foundation §62, `2026-05-19-ias-executor-as-canonical-host` §"Lifecycle-subscription dispatch". |
| 5 | Validator-as-activity | **Yes** | Required for failure-mode detection. Foundation §61, `2026-04-26-validators-and-failure-modes`. |
| 6 | Ribosome extraction | **Yes** | Required for topology growth. Foundation §62, §602–613. |
| 7 | Closure-audit | **Yes** | Required for IAL §27.3.i. `2026-05-23-substrate-closure-properties` §"closure principle". |
| 8 | Composition-chain credit propagation | **Yes** | Foundation §452–463; activity-api chain-credit. |
| 9 | State-space-signature conditional learning | **Yes** | Foundation §215–222 ("shape-conditioned"); activity-api conditional writes. |
| 10 | Forge variant testing | **Borderline** (S1→S2 named in §27.3.g.7) | Operator-dispatched pre-lift; substrate-dispatched post-lift. `2026-05-23-substrate-forge-vessel`. |
| 11 | Push-away with cited rationale | **Borderline** (S2→S3 readiness measure per §27.S.6) | Data primitives needed pre-lift; rate-trend measured post-lift. `2026-05-23-intervention-tracking`. |
| 12 | External-resolver-vesselization | **No — S2→S3 extension** | Post-lift acceleration; ribosome repointed at external calls. `2026-05-23-external-resolver-vesselization`. |
| 13 | Neutral emitter | **No — S2→S3 extension** | Decouples event topology from vessel topology; required for environment-reactive vessels and federated substrates. |

The lift-critical set (1–9) is the minimum cohesive substrate. The borderline
pair (10, 11) is named in the lift acceptance gates but the *trend* they
measure is post-lift. (12) is a post-lift acceleration mechanism that
demonstrates self-similar reuse of an idiom (6) on a new input domain.

---

## 2. The Idioms

### Idiom 1 — Goal → Activity → Trace

**Definition.** The atomic unit of substrate work. A goal arrives as an
impulse; the system extracts the shapes that would constitute a goal-satisfying
state; shape-matching finds candidate activities; Thompson Sampling
probabilistically selects one (this selection is the *emergent intent*); the
activity executes task-by-task; the full execution is recorded as a trace.
This is the i → t → o **recall motion** of the foundation (§28–34).

**Recurrence.** Every substrate execution. Foundation §353–457 ("The Execution
Flow") gives the canonical decomposition. The executor is the canonical
IAS host (`ias-executor-as-canonical-host`).

**Composability.** Composes pointer-as-shape (foundation §37–45), resolver
dispatch (foundation §51–54), and trace recording. Output traces are consumed
by every learning-direction idiom (3, 6, 8, 9) and by validator-as-activity (5).

**Lift-critical / S2→S3 extension.** Lift-critical. Nothing works without it.

**Example invocation.** A user goal "Fix the auth bug" produces input impulses
of shapes `{goal, error_log, source_code}`; shape-matching selects
`debug-null-pointer:v3` (Thompson α=45, β=3); execution runs five tasks;
trace `exec-abc123` is written.

**Anti-pattern.** Direct calls that bypass the activity layer (e.g.,
hardcoded REST against `/v2/impulses/resolve` from a vessel that has not
itself emitted a goal-shaped impulse). The "Unified Execution Path" section
of the foundation (§887–894) explicitly names this as a structural gap on the
remediation track.

---

### Idiom 2 — Discovery + Resolve by shape

**Definition.** Vessels advertise the shapes they can resolve via the
discovery-vessel registry; callers query discovery for "who resolves shape X"
and dispatch the impulse to that vessel's `POST /resolve` endpoint. The
substrate carries no hardcoded vessel→shape map. Foundation §292–334
("Vessel Discovery", "Vessels Collaborate, Not Nest").

**Recurrence.** Every cross-vessel resolution. activity-api advertises read
shapes and `*_write` shapes through the registry; the executor's unified
vessel-resolve path honours the advertised contract rather than any hardcoded
vessel→shape map.

**Composability.** Composes pointer-as-shape (the dispatch key) and
vessel-as-resolver-bundle (the dispatch target). Consumed by every idiom that
crosses a vessel boundary.

**Lift-critical / S2→S3 extension.** Lift-critical. Without it the substrate
cannot route between vessels without operator-pinned config.

**Example invocation.** The executor has a `conceptGraph`-shaped impulse to
resolve; queries discovery; discovery returns `concept-db` as the advertising
vessel; the executor POSTs the impulse pointer to `concept-db /resolve`;
concept-db resolves and returns the body.

**Anti-pattern.** Hardcoded vessel URLs in any non-bootstrap code path. The
substrate idiom forbids shape-specific vessel logic in the executor — no
per-vessel resolvers baked into the host.

---

### Idiom 3 — Thompson selection on (key, problem-class)

**Definition.** Every selection point in the substrate samples from a Beta
posterior keyed on `(selectable_id, problem_class)`. Successes increment α;
failures increment β; new selections sample from `Beta(α, β)` per candidate
and pick the highest sample. Foundation §215–223 ("Computed Thompson Scores"),
§474–488 ("Two-Direction Learning Duality").

**Recurrence.** Activity selection (`activity-api /v2/activities/recommend`),
impulse-pool selection (`impulse_preparation` / `impulse_pool_selection`
resolvers), forge-strategy selection (`forge-strategy-selector` resolver per
`2026-05-23-substrate-forge-vessel` §6), LLM-model selection (per
`2026-05-23-llm-resolver-model-mab`).

**Composability.** Composes trace recording (the data source) and
state-space-signature conditional learning (idiom 9; conditions the posterior
on `problem_class`). Sibling to cost-weighted posteriors
(`2026-05-23-cost-weighted-posteriors`).

**Lift-critical / S2→S3 extension.** Lift-critical. Without it, recall is
indistinguishable from random selection over the candidate set.

**Example invocation.** Given pool with shape signature `{error_log, source_code}`
and three candidate templates with posteriors `(α=45, β=3)`, `(α=12, β=2)`,
`(α=8, β=5)`, sample from each Beta and pick the highest — usually the first,
occasionally the second or third (exploration).

**Anti-pattern.** Inline α/β writes that bypass the posterior aggregation view
(`v_activity_score`); race-prone and breaks the symmetry invariant between
the forward and reverse learning arms (foundation §488). Phase 18.4 retired
inline writes (per memory note `percolation_2026_05_18_phase1_rl_and_pooling`).

---

### Idiom 4 — Lifecycle hook subscription

**Definition.** Meta-activities subscribe to lifecycle event impulses
(`lifecycle:task:preBinding`, `lifecycle:task:completed`,
`lifecycle:execution:succeeded`, etc.). When an executor emits a lifecycle
event, the dispatch engine resolves the subscriber set and dispatches the
matching activities — without explicit wiring at the call site. Foundation
§61 ("Lifecycle event = an impulse of shape `lifecycle:*`"),
`2026-05-19-ias-executor-as-canonical-host` §"Lifecycle-subscription dispatch".

**Recurrence.** Slot-binding, validator-dispatch, ribosome-extract,
test-audit, intervention-detection (per
`2026-05-23-intervention-tracking` §"Detection hooks") all attach via this
idiom. Implemented in the canonical IAS host's lifecycle-subscription layer.

**Composability.** Composes Goal → Activity → Trace (idiom 1; lifecycle
events are emitted by the executor mid-trace) and Discovery + Resolve (idiom 2;
subscribers are found via a registered subscription, addressed by shape).
Enables validator-as-activity (5) and ribosome extraction (6) without
hard-coding their dispatch.

**Lift-critical / S2→S3 extension.** Lift-critical. The meta-activity layer
(validators, ribosome, audit) is the substrate's self-observation surface;
without it the substrate cannot react to its own behaviour.

**Example invocation.** Task `t3` of activity `debug-null-pointer` completes;
executor emits `lifecycle:task:completed` carrying the task's output impulse
ids; the validator-dispatch meta-activity subscribes to that shape and runs
each declared validation rule; on failure it emits a `failure_mode` impulse.

**Anti-pattern.** Calling validators or ribosome inline from the executor.
Couples the executor to specific meta-activities; precludes adding new
subscribers without editing executor source.

**Third event layer — environment-reactive impulse events.** Task events and
execution events describe what the substrate did to itself. Impulse events
describe what changed in the environment around the substrate.
`lifecycle:impulse:stale` fires when an external change makes a loaded impulse's
content unreliable (a file the impulse points to has been modified since load
time; a DB row has been updated by a concurrent resolver). `lifecycle:impulse:expired`
fires when a time-bounded resource has run out (a token budget, a lock, a
cache TTL). Subscribers to these events are environment-reactive: they can
re-load the affected impulse, abort dependent tasks, or trigger a re-probe.
This third layer is what gives the substrate genuine environment awareness —
not just "what did I do" but "what changed around me."

---

### Idiom 5 — Validator-as-activity

**Definition.** A validator is a resolver whose output is a
`validation_result`-shaped impulse. It is dispatched as an activity, not as
inline assertion code. Failures emit a `failure_mode` impulse with discriminated
context (`verifier_negative | budget_exhausted | safety_breach | cascading |
user_abort`) per the failure-mode taxonomy.

**Recurrence.** Every gate check. The validator-dispatch meta-activity
(CLAUDE.md §"Impulse-binding selection layer") routes per-rule resolvers
on `lifecycle:task:completed`. `foundation-compliance` validator (proposed
in `2026-05-23-substrate-closure-properties` §6) gates spec-authoring.

**Composability.** Composes lifecycle hook subscription (idiom 4; validators
attach on `lifecycle:task:completed`) and Goal → Activity → Trace (idiom 1;
each validator run is itself a small trace). Feeds Thompson selection
(idiom 3) — verifier_negative writes a full β penalty per the stratified
failure-mode rules (Phase 18 stratified posteriors).

**Lift-critical / S2→S3 extension.** Lift-critical. Without it the
substrate cannot distinguish a successful trace from a failed one in
machine-checkable terms.

**Example invocation.** Task produces a `patch` impulse; declared validation
rule requires `requiredPatterns: ["PASS"]`; validator runs the patch's test
output through the pattern check; emits
`validation_result {pass: false, failure_mode: {type: "verifier_negative",
context: {validator_id: "test-pass-pattern", failed_evidence: [...]}}}`.

**Anti-pattern.** Validation written as raw `throw` in resolver code. No
trace, no posterior update, no learning. The validators-and-failure-modes spec
exists specifically to retire this pattern.

---

### Idiom 6 — Ribosome extraction

**Definition.** A resolver `trace-shaped → template-shaped` (foundation §62).
Analyses a successful execution trace, identifies the triggering input shapes
and the task sequence, and emits a new activity template with seed posterior
`(α=1, β=0)`. Registered for future shape-matching. Foundation §602–613.

**Recurrence.** Lifecycle meta-activity on
`lifecycle:execution:succeeded` (CLAUDE.md §"Registry hygiene"). The same
machinery, repointed, drives external-resolver-vesselization (idiom 12) and
LLM-to-deterministic distillation (`2026-05-23-llm-to-deterministic-distillation`
§"Self-application").

**Composability.** Consumes traces (idiom 1's output) and produces new
activities (idiom 1's input). It is the learning-direction (o → t → i) edge
that closes the topology-discovery loop (foundation §810–824). Composes
with lifecycle hook subscription (idiom 4) for dispatch.

**Lift-critical / S2→S3 extension.** Lift-critical. Without it, every
new pattern is operator-authored; the substrate cannot grow its own
capability set.

**Example invocation.** Improvisation succeeds for a never-seen input shape
combination. Ribosome reads the trace, extracts the task sequence, names the
template, registers it. Next similar input matches the new template directly
instead of improvising.

**Anti-pattern.** Speculative template generation from non-trace evidence
(the "improviser writing into the registry" path, retired per CLAUDE.md
§"Registry hygiene"). Templates must have grounding traces.

---

### Idiom 7 — Closure-audit

**Definition.** A self-containment check: for each property required by
substrate operation, ask "what would happen if external tool X were removed?"
If the answer is "the property would no longer hold", closure for that
property is open. `2026-05-23-substrate-closure-properties` §"closure
principle" defines the principle; the audit script
`validation/scripts/closure-audit.ts` walks each property and runs
substrate-only resolvers to attempt it.

**Recurrence.** Nightly cron activity (proposed). Seven enumerated closure
gaps per `2026-05-23-substrate-closure-properties` §"What Changes": memory,
skills, subagents, CI, self-healing, spec-authoring, audit-script itself.

**Composability.** Composes Goal → Activity → Trace (the audit dispatches
activities and reads traces) and Discovery + Resolve (the audit asks
"is anyone advertising this shape?"). The audit *is itself* a substrate
activity — it cannot be implemented as operator script if closure is to
hold for it. Recursive self-application: the closure-audit's own closure
status is one of the audited properties.

**Lift-critical / S2→S3 extension.** Lift-critical. IAL §27.3.i gates the
lift on closure-audit green for three consecutive nightly runs.

**Example invocation.** Audit asks "if `~/.claude/projects/.../memory/` were
removed, could the substrate still recall finding `F-V58`?" Substrate
attempts to resolve a `memoryNote { id: "F-V58" }` impulse; if
development-vessel cannot resolve it, the audit logs `memory: open`.

**Anti-pattern.** Auditing closure with operator-side scripts. The audit
needs to run from inside the substrate to count — otherwise its own
liveness depends on the harness it claims to audit.

---

### Idiom 8 — Composition-chain credit propagation

**Definition.** When a composed execution succeeds or fails, α/β deltas
propagate γ-discounted along the `composition_chain` (root-first ancestor
list) to every ancestor's posterior. Foundation §452–463 names the chain
fields; Phase 18.4 (CLAUDE.md §"Composition-chain credit propagation")
ships `propagateCreditAlongChain` in activity-api with the F-V56/F-V57
fixes.

**Recurrence.** Every nested execution. parent_execution_id and
composition_chain are written atomically with each trace; the credit-
propagation pass runs on trace finalization.

**Composability.** Composes trace recording (idiom 1's chain fields) and
Thompson selection (idiom 3; the propagated deltas update sibling
posteriors). Sibling of state-space-signature conditional learning
(idiom 9) — chain-credit conditions on the ancestor identity rather than
on the pool signature.

**Lift-critical / S2→S3 extension.** Lift-critical; implemented in activity-api's
credit-propagation pass.

**Example invocation.** `goal_processing_activity_driven` dispatches
`recommend-activity`, which dispatches `debug-null-pointer`, which succeeds.
Three composition_chain entries; α=0.30 (raw 0.25, scaled) propagates to
each ancestor; sibling posteriors at each level shift.

**Anti-pattern.** Crediting only the directly-executed leaf. Drops the
signal that the *whole composition* succeeded, not just the leaf.

---

### Idiom 9 — State-space-signature conditional learning

**Definition.** Thompson posteriors are conditioned on the shape signature
of the impulse pool at selection time. The same activity has different
α/β depending on which shapes were available when it was chosen. Foundation
§215–222 ("Shape-conditioned learning enables goal-aware success rates").
Phase 24 (CLAUDE.md §"Phase 24 — conditional posterior read path", §"Phase
24 §1–§3 write paths") ships the v1 conditional writes; §4 ships the
conditional read path.

**Recurrence.** Every Thompson selection that has a non-trivial input pool.
The state-space signature is computed from the present shape set; the
posterior view aggregates traces matching that signature.

**Composability.** Composes Thompson selection (idiom 3; conditions the
posterior) and trace recording (idiom 1; the signature is derived from
trace inputs). Distinct from composition-chain credit (idiom 8): chain
conditions on ancestor identity; this conditions on *pool composition*.

**Lift-critical / S2→S3 extension.** Lift-critical. The conditional read path
activates once accumulated conditional rows reach sufficient sample size per
signature; below that it falls back to the marginal posterior.

**Example invocation.** Activity `debug-null-pointer` has overall
posterior `(α=45, β=3)`. Conditioned on signature `{error_log, source_code}`
it is `(α=42, β=1)`. Conditioned on signature `{error_log}` alone it is
`(α=3, β=2)`. Selection samples the conditional posterior, not the marginal.

**Anti-pattern.** Reading the marginal posterior when a conditional one
exists. Throws away the strongest signal the system has about *which
conditions* this activity actually performs under.

---

### Idiom 10 — Forge variant testing

**Definition.** Spawn N ephemeral substrate clones in parallel, each
applying a different candidate change; observe N outcomes; promote the
winner. Moves variant exploration from `O(N × deploy_time)` to
`O(1 × deploy_time + N × measurement_time)`.
`2026-05-23-substrate-forge-vessel` §"Why".

**Recurrence.** Operator-dispatched today (`vessel-forge-host.ts` probe).
Substrate-dispatched post-lift as part of self-deployment +
self-replacement (`2026-05-23-substrate-self-replacement-pipeline`). The
forge itself is Thompson-tracked (`forge-strategy-selector`), and forge
is forgeable (`2026-05-23-substrate-forge-vessel` §"Self-application").

**Composability.** Composes Goal → Activity → Trace (each fork is a goal
dispatched to an isolated substrate clone), Thompson selection (idiom 3;
across forge strategies), and Closure-audit (idiom 7; forge must operate
without operator shell access). Recursive self-application: a fork may
spawn sub-forks bounded by depth-cap 3.

**Lift-critical / S2→S3 extension.** Borderline lift-critical. Named in
§27.3.g.7 of the explicit-vessels closure. Pre-lift dispatched by operator
for verifying candidate changes; post-lift dispatched by substrate.

**Example invocation.** Substrate has four candidate templates for
`extract-deterministic-resolver`. Dispatches 4-parallel `forkRequest`s;
each fork runs the candidate against the test-audit corpus; forge collects
four `forkOutcome` impulses; `forkPromotion` applies the winner; rollback
preserves prior state if needed.

**Anti-pattern.** Running variant tests on the canonical substrate
sequentially. Slow, and crashes during testing degrade the canonical state.

---

### Idiom 11 — Push-away with cited rationale

**Definition.** The substrate refuses an operator action with
substrate-side evidence: refusing gate identity, refusal code, trace ids,
posterior state, validator verdict, and a foundation citation. The refusal
is itself an `interventionRefused` impulse. The trend in refusal rate
(versus operator intervention rate) under sustained adversarial exposure
is the S2 → S3 readiness measure per IAL §27.S.6.
`2026-05-23-intervention-tracking` §"What Changes".

**Recurrence.** Every substrate gate (admin scope, trace deletion,
lift-status writes, policy mutations) emits `interventionRefused` on
refusal. The aggregator `intervention-rate-tick` emits
`interventionRateReport` daily.

**Composability.** Composes validator-as-activity (idiom 5; the refusal is
a `verifier_negative` outcome with structured context) and lifecycle hook
subscription (idiom 4; detection hooks subscribe to operator-action
shapes). Audit verdict (`interventionAuditVerdict`) is itself a
trace-recordable activity dispatched on a sampled refusal.

**Lift-critical / S2→S3 extension.** Borderline. Pre-lift: data primitives
must be emitted by all substrate gates (the IAL §27.S.6 measure is
operationally inert without them). Post-lift: rate trend is the S3
readiness signal.

**Example invocation.** Operator attempts to `kubectl delete pod surrealdb`.
Detection hook in development-vessel classifies as `intervention` (not
`maintenance`). Substrate's self-healing gate refuses, emitting
`interventionRefused { refusing_gate: "self-healing", refusal_code:
"OPERATOR_BYPASS_OF_RECOVERY_PATH", cited_evidence: { traces: ["..."],
foundation: "§263 — vessels resolve where data lives", suggested_alternative:
"dispatch restart-vessel activity" } }`.

**Anti-pattern.** Refusal without citation. The "no" without evidence is
indistinguishable from a stuck gate from the operator's side and from a
brittle gate from the substrate's side. The cited-evidence requirement is
what makes the refusal a learnable signal.

---

### Idiom 12 — External-resolver-vesselization

**Definition.** The ribosome (idiom 6) repointed at *calls leaving the
substrate*. When N successful calls to a stable external endpoint accumulate
a stable input-shape, output-shape, error-mode, and cost distribution, the
substrate mints a typed vessel for that endpoint. Subsequent calls route
through the new vessel by shape; the generic
`shell-exec`/`http-fetch`/`external-validation` adapter remains as
bootstrap-only fallback. `2026-05-23-external-resolver-vesselization` §"Why".

**Recurrence.** Post-lift acceleration. Operator pre-declared vessel set
grows by substrate observation of external-call patterns. Sibling pattern:
LLM-to-deterministic distillation (`2026-05-23-llm-to-deterministic-distillation`
turns fat-LLM-resolver patterns into thin deterministic ones; this turns
fat-external-resolver patterns into thin typed ones).

**Composability.** Composes ribosome (idiom 6; the extraction mechanism),
Discovery + Resolve (idiom 2; the minted vessel registers and advertises),
Forge variant testing (idiom 10; the minted vessel is forge-tested before
promotion to the canonical substrate), and Closure-audit (idiom 7; the
minted vessel must be substrate-resident).

**Lift-critical / S2→S3 extension.** S2 → S3 extension. The substrate
sustains its loop without this idiom; the idiom accelerates it.

**Example invocation.** Substrate makes 200 successful `gh pr list`
calls via `shell-exec` over a week. Trace pattern is stable:
input-shape `{org, repo, filter}`, output-shape `{pull_requests[]}`,
error-mode `{rate_limit | auth_failure}`, cost ≈ $0. Ribosome mints
`github-pr-vessel` advertising `pullRequestList` shape. Future
`pullRequestList` impulses route directly to the new vessel.

**Anti-pattern.** Operator pre-declaring a vessel for every external
endpoint. Brittle, premature, and not foundation-aligned (vessels are
introspected at the point of use, foundation §294).

---

### Idiom 13 — Neutral emitter

**Definition.** Every lifecycle event — task binding, execution completion,
gap classification, vessel registration, impulse state change — is emitted on
the substrate-wide broadcast bus without targeting a specific consumer. Vessels
subscribe to the events they need; emitters have no knowledge of their
subscribers. This decouples the substrate's internal event topology from its
vessel topology: new subscribers can attach without any change to emitting
vessels; removing a subscriber never breaks an emitter.

The architectural invariant: if removing a subscriber breaks an emitter, the
emitter was targeting that subscriber. Fix the emitter — it was not emitting
neutrally.

**Recurrence.** activity-api's WebSocket broadcaster is the canonical bus for
all substrate events (`ws://localhost:18080/ws` externally; inside the
container at the in-process port). Discovery-vessel emits `vessel.registered`,
`vessel.heartbeat`, `vessel.deregistered`, and `vessel.expired` on this bus.
goal-host-vessel subscribes to `vessel.registered` to register proxy resolvers
for newly-appearing vessels; ribosome-vessel subscribes to
`lifecycle:execution:succeeded`; validator-dispatch subscribes to
`lifecycle:task:completed`. None of these subscriber registrations are visible
to the emitting vessel.

**Composability.** Composes Lifecycle hook subscription (idiom 4; this idiom
defines the broadcast semantics under which lifecycle hooks operate). Also
composes Discovery + Resolve (idiom 2; a vessel that learns about a peer
vessel via `vessel.registered` can immediately resolve shapes against it without
a restart cycle). Federation extends this idiom inter-substrate: a peer
discovery-vessel's `vessel.registered` events propagate into the local bus as
`provisional` entries, making remote vessels appear shape-addressable.

**Lift-critical / S2→S3 extension.** S2→S3 extension. The substrate operates
without this idiom as a strictly named idiom — Lifecycle hook subscription
(idiom 4) covers the functional requirement pre-lift. The neutral-emitter
framing becomes load-bearing at S2→S3 scale, where adding a new subscriber
(an adversarial probe vessel, an audit vessel, a federated peer) must not
require touching any emitting vessel's source.

**Example invocation.** A new `audit-vessel` is added to the substrate. It
subscribes to `vessel.registered` (to detect unrecognized vessels),
`task.completed` (to sample output shapes for purity audit), and
`interventionRefused` (to aggregate the S2→S3 signal). The addition requires
zero changes to discovery-vessel, goal-host-vessel, or any task executor. The
bus is the integration point; the bus is not changed.

**Anti-pattern.** An emitter that constructs its subscriber list and dispatches
to each subscriber explicitly. This couples the emitter to subscriber identity
and requires emitter edits when the subscriber set changes — the architectural
dual of the inline-validator anti-pattern in idiom 4.

---

## 3. The meta-idiom — self-similarity

The idioms above recurse. Each substrate mechanism, once specified, becomes
input to its own machinery.

- **Ribosome** (idiom 6) extracts templates from traces. The same machinery,
  pointed at calls leaving the substrate, becomes
  **External-resolver-vesselization** (idiom 12). Pointed at LLM-resolver
  outputs, it becomes the distillation extractor of
  `2026-05-23-llm-to-deterministic-distillation`. One idiom, three input
  domains.

- **Forge** (idiom 10) tests candidate changes. The forge vessel's own
  implementation is a candidate change forgeable by a prior forge
  (`2026-05-23-substrate-forge-vessel` §"forge is forgeable"). Recursive
  self-application bottoms out at the operator-authored bootstrap forge.

- **Closure-audit** (idiom 7) walks substrate properties. The audit itself
  is one of the audited properties: "if the closure-audit script were
  removed, could the substrate still verify its own closure?" Recursive
  containment is the test.

- **Validator-as-activity** (idiom 5) gates resolver outputs. The
  `foundation-compliance` validator
  (`2026-05-23-substrate-closure-properties` §6) gates spec-authoring —
  including specs that modify the validator framework itself.

- **Thompson selection** (idiom 3) ranks candidates. The
  `forge-strategy-selector` Thompson-ranks forge strategies; the LLM-model
  MAB (`2026-05-23-llm-resolver-model-mab`) Thompson-ranks LLM models;
  the substrate ranks its own ranking strategies.

The self-similar property is what makes post-lift extension feasible. Every
new domain the substrate encounters reuses the same idiom set with a new
input pointer-shape. Growth is not bounded by adding new mechanisms; it is
bounded by observing new shapes worth applying the existing mechanisms to.

This is the operational read of foundation §810–824 ("Topology Discovery Is
the Purpose"): convergence is not the discovery of every shape, but the
recursive application of a finite idiom set across an unbounded shape space.

---

## References

- [`architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — canonical model.
- `openspec/changes/2026-04-26-impulse-activity-loop/tasks.md` — IAL §27.S.4 (S1→S2 lift), §27.S.5, §27.S.6.
- `openspec/changes/2026-05-23-topology-discovery-loop/` — 4-cell measurement + probes.
- `openspec/changes/2026-05-23-intervention-tracking/` — push-away data primitives.
- `openspec/changes/2026-05-19-ias-executor-as-canonical-host/` — lifecycle-subscription dispatch home.
