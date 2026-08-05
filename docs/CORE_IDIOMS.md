# Core Idioms of the Substrate

> Names the recurring patterns the substrate
> uses, defined in foundation-aligned vocabulary, with citations to the code and
> specs that already use them. This document introduces no new primitives — every
> idiom here is a composition of the four primitives named in
> [`architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](architecture/IMPULSE_ACTIVITY_FOUNDATION.md)
> §"Minimum Self-Stable Set": **impulse**, **pointer**, **resolver**, **vessel**.
>
> **Purpose**: the substrate reads its own documentation. `scripts/substrate/ingest-docs-as-concepts.ts`
> walks `docs/**` (excluding `docs/archive/`) and mints one concept per section,
> keyed `"<relpath>#<slug(heading)>"`. This file ingests as `shape=docSection`;
> only `docs/architecture/**` ingests as `shape=architecturePrinciple` and is
> dense-searched into the code-authoring prompt. So this document's job is to hold
> the idiom vocabulary in one queryable place rather than leave it scattered across
> foundation prose and per-change design docs.
>
> **Scope**: 13 idioms (idiom 13, "Neutral emitter", is an S2→S3 extension
> appended to the original 12). The list is closed against the foundation
> model; new idioms enter via spec proposals, not via this file.

---

## 1. Classification: lift-critical vs S2→S3 extension

The substrate's trajectory is S1 → S2 → S3 (see `CLAUDE.md` §"The operator role"):
operator-authored development, then substrate-authored development under
supervision, then a system that resists harmful intervention with cited evidence.
The S1 → S2 lift requires a minimum cohesive idiom set; the S2 → S3 motion extends
it. Each idiom in §2 below is tagged with its classification.

| # | Idiom | Lift-critical? | Notes |
|---|---|---|---|
| 1 | Goal → Activity → Trace | **Yes** | The atomic loop unit; nothing works without it. Foundation §"The Execution Flow". |
| 2 | Discovery + Resolve by shape | **Yes** | Required for vessel routing. Foundation §"Vessels Collaborate, Not Nest". |
| 3 | Thompson selection on (key, problem-class) | **Yes** | Required for selection learning. Foundation §"Computed Thompson Scores", §"Two-Direction Learning Duality". |
| 4 | Lifecycle hook subscription | **Yes** | Required for the meta-activity layer. Foundation §"Minimum Self-Stable Set" ("lifecycle event = an impulse of shape `lifecycle:*`"). |
| 5 | Validator-as-activity | **Yes** | Required for failure-mode detection. Foundation §"Minimum Self-Stable Set" ("validator = a resolver whose output is `validation_result`-shaped"). |
| 6 | Ribosome extraction | **Yes** | Required for topology growth. Foundation §"The Ribosome: Extracting Activities from Traces". |
| 7 | Closure-audit | **Yes** | Required before the substrate can be said to stand on its own primitives. |
| 8 | Composition-chain credit propagation | **Yes** | Foundation §"4. Record Trace"; `propagateCreditAlongChain` in activity-api. |
| 9 | State-space-signature conditional learning | **Yes** | Foundation §"Computed Thompson Scores" ("shape-conditioned learning"); the `v_shape_conditioned_score` read path. |
| 10 | Forge variant testing | **Borderline** | Operator-dispatched pre-lift; substrate-dispatched post-lift. |
| 11 | Push-away with cited rationale | **Borderline** | Data primitives needed pre-lift; the refusal-rate trend is a post-lift measure. |
| 12 | External-resolver-vesselization | **No — S2→S3 extension** | Post-lift acceleration; ribosome repointed at external calls. Foundation §"External Resolver Vesselization". |
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
This is the i → t → o **recall motion** of the foundation
(§"Three States, Two Motions").

**Recurrence.** Every substrate execution. Foundation §"The Execution Flow"
gives the canonical decomposition. The executor is the canonical IAS host
(`repos/ias-executor-ts`), and the walk it performs — backward-chaining from
the goal's target shapes, then judging whether the goal was *reached* — is the
execution model described in
[`architecture/SUBSTRATE_AS_SOFTWARE.md`](architecture/SUBSTRATE_AS_SOFTWARE.md) §3.

**Composability.** Composes pointer-as-shape (foundation
§"Pointer-as-Shape: The Bootstrap Principle"), resolver dispatch, and trace
recording. Output traces are consumed by every learning-direction idiom
(3, 6, 8, 9) and by validator-as-activity (5).

**Lift-critical / S2→S3 extension.** Lift-critical. Nothing works without it.

**Example invocation.** A user goal "Fix the auth bug" produces input impulses
of shapes `{goal, error_log, source_code}`; shape-matching selects a
`debug-null-pointer` variant with a strong posterior; execution runs its tasks;
one trace row is written carrying the tasks, their per-task impulse ids, the
composition chain, and the reach verdict.

**Anti-pattern.** Direct calls that bypass the activity layer — for example a
hardcoded REST call against `/v2/impulses/resolve` from a vessel that has not
itself emitted a goal-shaped impulse. Foundation §"Unified Execution Path" names
this as a structural gap on the remediation track, and `CLAUDE.md` §"Alignment
checklist" lists "new single-use REST endpoints" and "untraced execution" as
red flags.

---

### Idiom 2 — Discovery + Resolve by shape

**Definition.** Vessels advertise the shapes they can resolve via the
discovery-vessel registry; callers query discovery for "who resolves shape X"
and dispatch the impulse to that vessel's advertised `resolve_endpoint`. The
substrate carries no hardcoded vessel→shape map. Foundation §"Vessels
Collaborate, Not Nest" and the data-plane invariant in §"Minimum Self-Stable
Set": every data-plane exchange is a typed-pointer envelope
`{ "impulse": { "pointer": { "type": "<shape>", … } } }`, and the endpoint
*path* is per-vessel advertised data, not part of the contract.

**Recurrence.** Every cross-vessel resolution. activity-api advertises read
shapes and `*_write` shapes through the registry (for example `impulseRelevance`
and `impulseRelevance_write`); the executor's unified vessel-resolve path
honours the advertised contract rather than any hardcoded vessel→shape map.

**Composability.** Composes pointer-as-shape (the dispatch key) and
vessel-as-resolver-bundle (the dispatch target). Consumed by every idiom that
crosses a vessel boundary.

**Lift-critical / S2→S3 extension.** Lift-critical. Without it the substrate
cannot route between vessels without operator-pinned config.

**Example invocation.** The executor has a `conceptGraph`-shaped impulse to
resolve; queries discovery; discovery returns `concept-db` as the advertising
vessel; the executor POSTs the impulse pointer to concept-db's advertised
resolve endpoint; concept-db resolves and returns the body.

**Anti-pattern.** Hardcoded vessel URLs in any non-bootstrap code path. The
substrate idiom forbids shape-specific vessel logic in the executor — no
per-vessel resolvers baked into the host. Bootstrap identity (ports, secrets,
the discovery endpoint itself) is the stated exception, per `CLAUDE.md` law 1.

---

### Idiom 3 — Thompson selection on (key, problem-class)

**Definition.** Every selection point in the substrate samples from a Beta
posterior keyed on `(selectable_id, problem_class)`. Successes increment α;
failures increment β; new selections sample from `Beta(α, β)` per candidate
and pick the highest sample. Because the posterior starts at the uniform prior,
α is (successes + 1) and β is (failures + 1) — an arm with no observations has
`α + β − 2 = 0`. Foundation §"Computed Thompson Scores", §"Two-Direction
Learning Duality".

**Recurrence.** Activity selection (activity-api `POST /v2/activities/recommend`),
impulse-pool selection (the `impulse_preparation` and `impulse_pool_selection`
resolvers in the executor), and model selection inside the LLM resolver, which
Thompson-ranks per-model sub-resolver ids (`llmText@<model>`) as described in
[`architecture/RESOLVER_TRACKING.md`](architecture/RESOLVER_TRACKING.md)
§"Per-model LLM sub-resolvers".

**Composability.** Composes trace recording (the data source) and
state-space-signature conditional learning (idiom 9; conditions the posterior
on the pool signature). A success is not a flat `+1α`: the graded-yield update
splits a successful execution as `α += y, β += (1 − y)` where `y ∈ [floor, 1]`
reflects cost-efficiency and output productivity, so Thompson can tell a good
variant from a great one.

**Lift-critical / S2→S3 extension.** Lift-critical. Without it, recall is
indistinguishable from random selection over the candidate set.

**Example invocation.** Given a pool with shape signature `{error_log, source_code}`
and three candidate templates with posteriors `(α=45, β=3)`, `(α=12, β=2)`,
`(α=8, β=5)`, sample from each Beta and pick the highest — usually the first,
occasionally the second or third (exploration).

**Anti-pattern.** Inline α/β writes that bypass the posterior aggregation views
(`v_activity_score`, `v_shape_conditioned_score`); race-prone, and it breaks the
symmetry invariant between the forward and reverse learning arms. Every write
site goes through `applyOutcomeToPosteriors`, which is also what makes the
outcome-conditional β step sizes (idiom 5) apply uniformly.

---

### Idiom 4 — Lifecycle hook subscription

**Definition.** Meta-activities subscribe to lifecycle event impulses. When an
executor emits a lifecycle event, the dispatch engine resolves the subscriber
set and dispatches the matching activities — without explicit wiring at the call
site. Foundation §"Minimum Self-Stable Set": a lifecycle event *is* an impulse
of shape `lifecycle:*`, routed through the executor's implicit vessel to
subscribed meta-activities.

**Recurrence.** The execution engine emits lifecycle events at fixed points of an
execution, and the lifecycle templates in
`repos/ias-executor-ts/src/templates/lifecycle/` attach to them by declaring the
shape they subscribe to:

| Event | Emitted | Subscribing template |
|---|---|---|
| `lifecycle:task:preBinding` | before a task's slots are bound | `slot-binding` |
| `lifecycle:task:completed` | after a task completes without throwing | `validator-dispatch` |
| `lifecycle:execution:succeeded` | on a successful execution | `audit-test-report`, `debug-failing-audit` |
| `lifecycle:gap:classified` | when the engine classifies a gap — `missing_input_shapes`, or a task's resolver not being registered | none in the lifecycle template directory |

The engine is not the only emitter: the LLM prompt resolver
(`repos/ias-executor-ts/src/resolvers/llm-prompt.ts`) emits
`lifecycle:llm:dispatched` before an LLM call. Emitted events also reach the
substrate bus when a host wraps the engine's sink in `BusForwardingEventSink`
(`repos/ias-executor-ts/src/adapters/bus-forwarder.ts`), which rewrites the event
name into dotted bus form; goal-host-vessel does this, so a bus consumer can react
to an event no lifecycle template subscribes to.

Adding a subscriber means adding a template that declares the event shape, not
editing the executor.

**Composability.** Composes Goal → Activity → Trace (idiom 1; lifecycle
events are emitted by the executor mid-trace) and Discovery + Resolve (idiom 2;
subscribers are found via a registered subscription, addressed by shape).
Enables validator-as-activity (5) and ribosome extraction (6) without
hard-coding their dispatch.

**Lift-critical / S2→S3 extension.** Lift-critical. The meta-activity layer
(validators, ribosome, audit) is the substrate's self-observation surface;
without it the substrate cannot react to its own behaviour.

**Example invocation.** A task of activity `debug-null-pointer` completes; the
executor emits `lifecycle:task:completed` carrying the task's output impulse
ids; the `validator-dispatch` template subscribes to that shape and runs each
declared validation rule; on failure it emits a `failure_mode` impulse.

**Anti-pattern.** Calling validators or the ribosome inline from the executor.
Couples the executor to specific meta-activities; precludes adding new
subscribers without editing executor source.

**Where the event set is load-bearing.** Subscribers are indexed by
`subscription.shape` and dispatched on an exact match with the emitted event
type (`LifecycleSubscriberVessel` in
`repos/ias-executor-ts/src/lifecycle-subscriber.ts`). A template that declares an
event type nothing emits therefore registers but is never reached by this path —
`ribosome-extract.json` declares `lifecycle:activity:postExecution`, which no
emitter in the executor produces (see idiom 6). So before writing a subscriber,
check that its declared event is actually emitted somewhere; when it is not, the
honest move is to add the emit alongside the subscriber rather than assume the
event exists.

---

### Idiom 5 — Validator-as-activity

**Definition.** A validator is a resolver whose output is a
`validation_result`-shaped impulse. It is dispatched as an activity, not as
inline assertion code. Failures emit a `failure_mode` impulse — a discriminated
union on `type` with **six** variants, defined by `FailureModeSchema` in
`repos/activity-api/src/models/schemas.ts`:

| `type` | Carries | Meaning |
|---|---|---|
| `verifier_negative` | `validator_id`, `failed_evidence[]` | a validator or check rejected the output |
| `budget_exhausted` | `budget_type` (`cost`\|`duration`), `consumed`, `allowed` | a cost or duration budget was exceeded |
| `safety_breach` | `breach_type` (`depth`\|`cycle`), optional `limit`, `ancestor_chain` | a depth or cycle guard tripped |
| `cascading` | `upstream_task_id`, optional recursive `upstream_failure_mode` | the failure was caused upstream |
| `user_abort` | `abort_source` | the execution was cancelled |
| `prediction_disagreement` | `context` (discriminated on `sub_type`) | a substrate-authored activity emitted a prediction and the observed continuation diverged |

`prediction_disagreement.context` is itself a three-way discriminated union:
`intent_inconsistency` (an intent label inconsistent with the observed
continuation), `trajectory_divergence` (predicted signatures diverged from the
observed one at some index within the horizon), and `action_no_effect` (a
command was dispatched and the pre/post state signatures are identical).

**The outcome-conditional β step is the standing rule.** A failure does not
always cost a full β. `computeDeltas` in
`repos/activity-api/src/lib/posterior-update.ts` maps the outcome to the step
size, so "how wrong" survives into the posterior instead of being flattened:

| Outcome | α delta | β delta |
|---|---|---|
| success | `y` (graded yield; `1` with the graded update disabled) | `1 − y` (`0` with it disabled) |
| failed trace with no `failure_mode` recorded | 0 | 1 — treated as `verifier_negative`, with a warning |
| `verifier_negative` | 0 | 1 |
| `budget_exhausted` | 0 | 0.5 — it ran, it hit a ceiling; not necessarily wrong |
| `safety_breach` | 0 | 1 |
| `cascading` | 0 | 0 — the victim; the upstream cause carries the penalty |
| `user_abort` | 0 | 0 — no signal |
| `prediction_disagreement` / `action_no_effect` | 0 | 1 — confidently dispatched, world unchanged |
| `prediction_disagreement` / `intent_inconsistency` | 0 | 0.5 — a guess, and it was wrong |
| `prediction_disagreement` / `trajectory_divergence` | 0 | 0.5 — same |
| `prediction_disagreement` with an absent or unrecognised `sub_type` | 0 | 0.5, with a warning — the half-penalty is the majority case, and this mode always means a wrong guess rather than a validator rejection |
| an unrecognised `failure_mode.type` | 0 | 1, with a warning — unknown modes default strict |

The two defaults point in opposite directions on purpose: an unknown *failure
mode* is treated as a full rejection, while an unknown *sub-case of a known
mode* keeps that mode's dominant step. Read the warning list on a posterior
write; a steady stream of either warning means the taxonomy has drifted from
what the callers actually emit.

**Recurrence.** Every gate check. The `validator-dispatch` lifecycle template
routes per-rule resolvers on `lifecycle:task:completed`.

**Composability.** Composes lifecycle hook subscription (idiom 4; validators
attach on `lifecycle:task:completed`) and Goal → Activity → Trace (idiom 1;
each validator run is itself a small trace). Feeds Thompson selection
(idiom 3) through the step-size table above.

**Lift-critical / S2→S3 extension.** Lift-critical. Without it the
substrate cannot distinguish a successful trace from a failed one in
machine-checkable terms.

**Example invocation.** A task produces a `patch` impulse; the declared
validation rule requires the pattern `PASS`; the validator runs the patch's test
output through the pattern check and emits
`validation_result {pass: false, failure_mode: {type: "verifier_negative",
reason: "…", validator_id: "test-pass-pattern", failed_evidence: [{check_id: "…"}]}}`.
Note that `validator_id` and `failed_evidence` sit on the failure mode itself;
only `prediction_disagreement` carries a nested `context`.

**Anti-pattern.** Validation written as a raw `throw` in resolver code. No
trace, no posterior update, no learning — and, specifically, no failure mode,
so the step-size table above degrades to the strict default for every failure
regardless of what actually went wrong.

---

### Idiom 6 — Ribosome extraction

**Definition.** A resolver `trace-shaped → template-shaped` (foundation
§"Minimum Self-Stable Set"). It analyses a successful execution trace,
identifies the triggering input shapes and the task sequence, and emits a new
activity template with a seed posterior. The template is registered for future
shape-matching. Foundation §"The Ribosome: Extracting Activities from Traces".

**Recurrence.** The `ribosome-extract` lifecycle template
(`repos/ias-executor-ts/src/templates/lifecycle/ribosome-extract.json`) expresses
the extraction as a task chain — resolve the trace signature, score extraction
quality, synthesize a template proposal, validate it, and persist it only when
the template's `applyExtraction` variable is set, which defaults to false so the
chain is proposal-only until it is flipped. It declares
`subscription.shape = "lifecycle:activity:postExecution"`, an event no emitter in
the executor produces, so the dispatch path described in idiom 4 does not reach
it. ribosome-vessel runs extraction as a standing service instead: it holds a
persistent, auto-reconnecting WebSocket client
against activity-api's `/ws` bus and reacts to `execution_completed`
(equivalently `execution.completed`) broadcasts. The same machinery, repointed,
drives external-resolver-vesselization (idiom 12).

**Composability.** Consumes traces (idiom 1's output) and produces new
activities (idiom 1's input). It is the learning-direction (o → t → i) edge
that closes the topology-discovery loop (foundation §"Topology Discovery Is the
Purpose"). Composes with lifecycle hook subscription (idiom 4) for dispatch.

**Lift-critical / S2→S3 extension.** Lift-critical. Without it, every
new pattern is operator-authored; the substrate cannot grow its own
capability set.

**Example invocation.** Improvisation succeeds for a never-seen input shape
combination. The ribosome reads the trace, extracts the task sequence, names the
template, registers it. The next similar input matches the new template directly
instead of improvising.

**Anti-pattern.** Speculative template generation from non-trace evidence —
an improviser writing straight into the registry, or an operator uploading a
hand-written template. Templates must have grounding traces; this is `CLAUDE.md`
law 4, "Activities are earned by doing, not declared". A declared-but-never-walked
template is hollow: it splits selection traffic while carrying no evidence.

---

### Idiom 7 — Closure-audit

**Definition.** A self-containment check: for each property required by
substrate operation, ask "what would happen if external tool X were removed?"
If the answer is "the property would no longer hold", closure for that
property is open. The audit script `validation/scripts/closure-audit.ts` walks
each property and runs substrate-only resolvers to attempt it, taking
`--without=<property>` to simulate the absence of a specific external
dependency. It writes `validation/state/closure-status.json` and exits non-zero
while any tested property is still open.

**Recurrence.** Run on a rhythm rather than a fixed timer (`CLAUDE.md` law 5).
The script enumerates seven closure properties, each expressed as the external
crutch whose removal it simulates:

| `--without=` | The question it asks |
|---|---|
| `operator-memory` | does substrate memory work without operator-side memory files? |
| `slash-skills` | can skill-equivalent operations run through substrate resolvers alone? |
| `subagents` | can complex tasks execute without operator-side subagents? |
| `github-actions` | does CI and merge gating work through the substrate alone? |
| `operator-shell` | can the substrate self-heal without operator shell access? |
| `operator-spec-authoring` | can the substrate author specs without the operator? |
| `push-away` | does the substrate refuse incompetent interventions with cited evidence? |

**Composability.** Composes Goal → Activity → Trace (the audit dispatches
activities and reads traces) and Discovery + Resolve (the audit asks
"is anyone advertising this shape?"). The audit runs today as an operator-side
`bun` script under `validation/scripts/`, and the seven properties it enumerates
are all external crutches — none of them is the audit's own liveness. Moving the
audit inside the substrate, so that its own execution does not depend on the
harness it is auditing, is the open item named in the anti-pattern below.

**Lift-critical / S2→S3 extension.** Lift-critical. The audit's exit code is the
gate: zero only when every property it tested is closed, non-zero while any gap
remains. A single green run is weak evidence — the property that matters is that
it stays green across runs, since a closure that holds only when the operator
happens to be present is not closure.

**Example invocation.** The audit asks "if the operator-side memory directory
were removed, could the substrate still recall a given finding?" It resolves a
`memoryNote` impulse against development-vessel; if development-vessel cannot
resolve it, the audit records `memory: open`.

**Anti-pattern.** Auditing closure with operator-side scripts. The audit
needs to run from inside the substrate to count — otherwise its own
liveness depends on the harness it claims to audit.

---

### Idiom 8 — Composition-chain credit propagation

**Definition.** When a composed execution succeeds or fails, α/β deltas
propagate along the `composition_chain` (the root-first ancestor list) to
ancestors' posteriors, decayed per ancestor depth. The decay is an eligibility
trace, `Δα_{t−k} = λ^k · r` — TD(λ), not a per-step discount γ — and it is
bounded: at most four ancestors from the leaf are credited. λ is resolved at
use time from the `TD_LAMBDA` tuning parameter and must lie in the open interval
(0, 1); an out-of-range value falls back to the default with a warning.
Foundation §"4. Record Trace" names the chain fields;
`propagateCreditAlongChain` in `repos/activity-api/src/lib/posterior-update.ts`
implements the walk.

**Recurrence.** Every nested execution. `parent_execution_id` and
`composition_chain` are written atomically with each trace; the credit-
propagation pass runs on trace finalization.

**Composability.** Composes trace recording (idiom 1's chain fields) and
Thompson selection (idiom 3; the propagated deltas update ancestor
posteriors). Sibling of state-space-signature conditional learning
(idiom 9) — chain-credit conditions on the ancestor identity rather than
on the pool signature.

**Lift-critical / S2→S3 extension.** Lift-critical; implemented in activity-api's
credit-propagation pass.

**Example invocation.** A goal-processing activity dispatches a recommendation
activity, which dispatches `debug-null-pointer`, which succeeds. The chain has
three entries; the leaf's reward is written at full weight and each ancestor
receives it scaled by λ raised to its depth from the leaf.

**Anti-pattern.** Crediting only the directly-executed leaf. Drops the
signal that the *whole composition* succeeded, not just the leaf. The dual
anti-pattern is k-fold double-counting: when one task fans out to k parallel
siblings, each sibling trace carries the fan-out width so a shared ancestor is
credited once on average rather than k times.

---

### Idiom 9 — State-space-signature conditional learning

**Definition.** Thompson posteriors are conditioned on the shape signature
of the impulse pool at selection time. The same activity has different
α/β depending on which shapes were available when it was chosen. Foundation
§"Computed Thompson Scores": shape-conditioned learning enables goal-aware
success rates — activity X performs better when the input includes shape Y.

**Recurrence.** Every Thompson selection that has a non-trivial input pool.
The signature is computed from the present shape set; the read path queries
`v_shape_conditioned_score` and degrades in three steps:

1. **exact match** — rows whose `shape_signature` equals the computed signature;
2. **subset match** — the most-executed row whose signature is contained in the
   computed one, so a near-miss pool still reuses learned evidence;
3. **marginal fallback** — the unconditioned activity scores, used when no
   conditional row exists at all (and also when the conditional query errors,
   so a database hiccup degrades rather than blocks selection).

**Composability.** Composes Thompson selection (idiom 3; conditions the
posterior) and trace recording (idiom 1; the signature is derived from
trace inputs). Distinct from composition-chain credit (idiom 8): chain
conditions on ancestor identity; this conditions on *pool composition*.
Lifecycle-hook subscriber templates are deliberately excluded from the
state-conditioned posterior — they measure hook mechanics, not goal reach, and
their volume would otherwise poison goal-reach selection.

**Lift-critical / S2→S3 extension.** Lift-critical. Reading the conditional
posterior is what makes selection goal-aware rather than reputation-aware.

**Example invocation.** Activity `debug-null-pointer` has overall
posterior `(α=45, β=3)`. Conditioned on signature `{error_log, source_code}`
it is `(α=42, β=1)`. Conditioned on signature `{error_log}` alone it is
`(α=3, β=2)`. Selection samples the conditional posterior, not the marginal.

**Anti-pattern.** Reading the marginal posterior when a conditional one
exists. Throws away the strongest signal the system has about *which
conditions* this activity actually performs under.

---

### Idiom 10 — Forge variant testing

**Definition.** When the walk needs a shape nobody produces, the substrate
builds the producer rather than failing the goal. The forge is a template
(`repos/ias-executor-ts/src/templates/forge/forge-vessel-for-shape.json`) hosted
by a runtime that carries the extra ports a build needs — Docker, Helmfile, and
Discovery — alongside the ordinary executor ports
(`repos/ias-executor-ts/src/examples/vessel-forge-host.ts`). Its tasks run in a
fixed order: a zero-cost recursion-and-environment guard, then compose a vessel
spec, scaffold the file tree, wire discovery registration, wire the auth
blueprint, build and push the image, sync the deployment overlay and wait for
readiness, and finally verify three invariants — discovery, observation, auth.
A run that clears all of them emits `vesselVerified`.

**Recurrence.** Not on an automatic path today. `slot-binding`'s escalation branch
(`escalate_unbindable`) fires when its `select_or_produce` task reports
`unbindable=true` — the `producer_selection` resolver found no producer for a
missing shape — but what it dispatches is the `create-shape-provider-goal`
escalation template
(`repos/ias-executor-ts/src/templates/escalation/create-shape-provider-goal.json`),
not the forge. Inside the vessels the forge template is registered
(`repos/ias-executor-ts/src/templates/index.ts`) but not dispatched; the runs that
do exist are operator-run — `validation/scripts/test-22-forge-and-paths.ts` loads
the template file and executes it directly against `VesselForgeHost`.
Routing the no-producer-at-all case to it is described as intent in a comment on
the `shape_producer_inventory` case in `repos/activity-api/src/routes/impulses.ts`
and is not wired into `slot-binding`. Post-lift, the substrate is expected to
dispatch the forge itself.

**Composability.** Composes Goal → Activity → Trace (the forge run is an
ordinary traced activity, so its failures are ordinary failure modes),
Lifecycle hook subscription (idiom 4; `slot-binding`'s escalation branch is the
path a no-producer case travels),
and Closure-audit (idiom 7; the forge must operate without operator shell
access to count as closed). Recursive self-application: a forged vessel may
itself need a shape nobody produces.

**Lift-critical / S2→S3 extension.** Borderline lift-critical. Pre-lift the
escalation is dispatched under supervision for verifying candidate changes;
post-lift it is dispatched by the substrate.

**Example invocation.** A walk needs a shape with no producer and a forge run is
dispatched. The guard task confirms recursion depth is under the cap and that
`docker` and `helmfile` are both on PATH — absent either, it fails immediately
and cheaply rather than half-building. The remaining tasks scaffold, wire,
build, deploy, and probe the new vessel; the three invariant probes are what
decide whether the forge reached.

**Anti-pattern.** An unbounded forge. Recursion depth is capped and the cap is
enforced by the *first* task, which reports a `safety_breach` failure mode with
`breach_type: depth` — so an infinite forge cascade registers as a named safety
failure in the learning loop rather than as an outage.

---

### Idiom 11 — Push-away with cited rationale

**Definition.** The substrate refuses an intervention with substrate-side
evidence rather than a bare "no". The evaluation resolver
(`repos/development-vessel/src/resolvers/intervention-evaluate.ts`) takes an
`intervention_evaluate` pointer carrying the proposed change (its `source` is
`operator`, `external`, or `substrate_authored`) plus `cited_evidence[]`, where
each citation is a typed reference — a trace id, a concept id, a file path, a
URL, or a memo. It searches its own priors for material that supports or
contradicts the change; the refusal path fires when nothing was cited *and* the
substrate holds concrete contradicting priors. A refusal is persisted as an
`interventionRefused` record carrying the proposed change, the refusal basis,
the substrate priors cited, and the strictness the verdict was rendered at.

**Recurrence.** development-vessel advertises `intervention_evaluate`,
`interventionRefused` (the read side, filterable by id or by source), and
`interventionRefused_write`. The accumulated refusal history is the push-away
corpus; the trend in refusal rate versus intervention rate under sustained
adversarial exposure is the S2 → S3 readiness measure (`CLAUDE.md`
§"The operator role", adversarial duty).

**Composability.** Composes validator-as-activity (idiom 5; a refusal is a
verdict with structured context, not an exception) and lifecycle hook
subscription (idiom 4; detection hooks observe the actions being judged).

**Lift-critical / S2→S3 extension.** Borderline. Pre-lift: the data primitives
must exist and be emitted, or the readiness measure is operationally inert.
Post-lift: the rate trend is the S3 readiness signal.

**Example invocation.** A proposed change arrives with `source: "operator"`,
an intent string, a diff summary, and an empty `cited_evidence` array. The
resolver extracts keywords from the intent and diff, searches concepts and
traces, and finds priors that contradict the change. Verdict: REFUSE, with the
refusal basis naming the contradicting priors and a `cited_evidence_strength_score`
of zero recorded against the proposal.

**Anti-pattern.** Refusal without citation. A "no" without evidence is
indistinguishable from a stuck gate from the operator's side and from a
brittle gate from the substrate's side. The cited-evidence requirement is
what makes the refusal a learnable signal — which is why the resolver scores
citation strength explicitly rather than treating refusal as binary.

---

### Idiom 12 — External-resolver-vesselization

**Definition.** The ribosome (idiom 6) repointed at *calls leaving the
substrate*. When repeated successful calls to a stable external endpoint
accumulate a stable input-shape, output-shape, error-mode, and cost
distribution, the substrate mints a typed vessel for that endpoint. Subsequent
calls route through the new vessel by shape; the generic adapters (`shell-exec`
for processes, `http-fetch` for HTTP) remain as the bootstrap-only fallback.
Foundation §"External Resolver Vesselization".

**Recurrence.** Post-lift acceleration. The operator's pre-declared vessel set
grows by substrate observation of external-call patterns rather than by
anticipation.

**Composability.** Composes ribosome (idiom 6; the extraction mechanism),
Discovery + Resolve (idiom 2; the minted vessel registers and advertises),
Forge variant testing (idiom 10; minting the vessel is a forge run, invariant
probes included), and Closure-audit (idiom 7; the minted vessel must be
substrate-resident).

**Lift-critical / S2→S3 extension.** S2 → S3 extension. The substrate
sustains its loop without this idiom; the idiom accelerates it.

**Example invocation.** The substrate makes many successful `gh pr list`
calls via `shell-exec`. The trace pattern is stable: input-shape
`{org, repo, filter}`, output-shape `{pull_requests[]}`, error-mode
`{rate_limit | auth_failure}`, negligible cost. The ribosome mints a vessel
advertising a `pullRequestList` shape. Future `pullRequestList` impulses route
directly to the new vessel.

**Anti-pattern.** Operator pre-declaring a vessel for every external
endpoint. Brittle, premature, and not foundation-aligned — foundation
§"Vessel Discovery" holds that vessels are introspected at the point of use,
and `CLAUDE.md` law 3 ("reuse before mint") makes the cost explicit: a
speculative mint is a fresh uninformed cell that splits selection traffic.

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
substrate events: it upgrades on the `/ws` path, and that path is exempt from
the JWT middleware so the upgrade itself is not an auth round-trip. Vessels
reach it at the activity-api endpoint they already hold, with the scheme
rewritten to `ws`. discovery-vessel's event bus emits `vessel.registered`,
`vessel.deregistered`, and `vessel.expired`; vessel health emits
`vessel.heartbeat`. goal-host-vessel consumes `vessel.registered` to register
proxy resolvers for newly-appearing vessels; ribosome-vessel holds a persistent
auto-reconnecting client and consumes `execution_completed`. None of these
subscriber registrations are visible to the emitting vessel.

**Composability.** Composes Lifecycle hook subscription (idiom 4; this idiom
defines the broadcast semantics under which lifecycle hooks operate). Also
composes Discovery + Resolve (idiom 2; a vessel that learns about a peer
vessel via `vessel.registered` can immediately resolve shapes against it without
a restart cycle). Federation extends this idiom inter-substrate: a peer
discovery-vessel's registration events propagate into the local bus, making
remote vessels appear shape-addressable.

**Lift-critical / S2→S3 extension.** S2→S3 extension. The substrate operates
without this idiom as a strictly named idiom — Lifecycle hook subscription
(idiom 4) covers the functional requirement pre-lift. The neutral-emitter
framing becomes load-bearing at S2→S3 scale, where adding a new subscriber
(an adversarial probe vessel, an audit vessel, a federated peer) must not
require touching any emitting vessel's source.

**Example invocation.** Suppose an audit vessel is added to the substrate. It
subscribes to `vessel.registered` (to detect unrecognized vessels), task
completion (to sample output shapes for a purity audit), and the refusal record
(to aggregate the S2→S3 signal). The addition requires zero changes to
discovery-vessel, goal-host-vessel, or any task executor. The bus is the
integration point; the bus is not changed.

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
  **External-resolver-vesselization** (idiom 12). One idiom, several input
  domains.

- **Forge** (idiom 10) builds a producer for a missing shape. The forge host
  and its template are themselves substrate code, so a forged vessel is a
  candidate for the same treatment. Recursive self-application bottoms out at
  the operator-authored bootstrap forge — and is bounded on the way down by the
  depth guard that is the forge's first task.

- **Closure-audit** (idiom 7) walks substrate properties, each named as an
  external crutch whose removal it simulates. The recursive question — "if the
  operator-side audit script were removed, could the substrate still verify its
  own closure?" — is not among the properties the script enumerates; it is the
  test the audit does not yet apply to itself.

- **Validator-as-activity** (idiom 5) gates resolver outputs. The gate that
  checks a change against the foundation is itself a validator, so it gates
  changes to the validator framework too.

- **Thompson selection** (idiom 3) ranks candidates. It ranks activity
  variants, it ranks impulse-pool candidates, and it ranks the LLM models used
  to resolve a task; the substrate ranks its own ranking strategies with the
  one selection primitive.

The self-similar property is what makes post-lift extension feasible. Every
new domain the substrate encounters reuses the same idiom set with a new
input pointer-shape. Growth is not bounded by adding new mechanisms; it is
bounded by observing new shapes worth applying the existing mechanisms to.

This is the operational read of foundation §"Topology Discovery Is the
Purpose": convergence is not the discovery of every shape, but the
recursive application of a finite idiom set across an unbounded shape space.

---

## References

- [`architecture/IMPULSE_ACTIVITY_FOUNDATION.md`](architecture/IMPULSE_ACTIVITY_FOUNDATION.md) — the canonical model; every §-citation above names a section, not a line number.
- [`architecture/SUBSTRATE_AS_SOFTWARE.md`](architecture/SUBSTRATE_AS_SOFTWARE.md) — the execution walk and the durability groups the idioms move between.
- [`architecture/RESOLVER_TRACKING.md`](architecture/RESOLVER_TRACKING.md) — resolver tiers, per-model sub-resolvers, and the tier-versus-dispatch-pathway distinction.
- [`GLOSSARY.md`](GLOSSARY.md) — canonical term spellings, deprecated aliases, and the retired-name policy.
- `CLAUDE.md` — the laws and the operator role that idioms 7, 10, 11, and 13 are measured against.
