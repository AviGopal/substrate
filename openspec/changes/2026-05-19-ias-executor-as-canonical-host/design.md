# Design: ias-executor-ts as the Canonical Activity Host

## Context

`repos/ias-executor-ts/` is the pure execution substrate. `repos/minibob/` is
the long-standing god-object that bundled the executor with a REPL, a CLI, a
daemon, a boredom loop, vessel-registration, ACP gossip, and 80 embedded
templates. The two co-exist today: minibob owns the production execution path
on canary; ias-executor-ts has the cleaner substrate and is consumed by the
forge tests (`vessel-forge-host.ts`).

This design lays out (A) the three-layer model that motivates the move,
(B) the vessel contract under the canonical model, (C) the activity contract,
(D) what belongs in ias-executor-ts and what does not, (E) the lifecycle-
subscription-dispatch port, (F) the shared template catalogue, (G) the
GoalHost reference implementation, (H) the migration plan, (I) explicit non-
goals, (J) a trade-off analysis of what we lose by deprecating minibob's
bundled approach, and (K) connections to existing specs.

---

## A. The Three-Layer Model

> "The purpose of a pure vessel is to contain some typescript code that can be
> driven by activities. At some level we need to establish a tradeoff between
> the rote consistent behavior of code and the variable behavior of llms, the
> middle ground is activities."

Three layers. Each does what the others cannot.

### A.1 TypeScript code — the rote layer

Deterministic, version-controlled, testable. What `repos/ias-executor-ts/` is:
the executor, the impulse store, the resolver registry, the lifecycle event
emitter. What `repos/discovery-vessel/` is: the registry, the heartbeat TTL,
the resolver-contract advertisement. What a future `repos/forge-host/` would
be: Docker + Helmfile + Discovery ports plus the six forge resolvers
(`vessel-forge-host.ts:28-33`).

A vessel that **contains** an LLM call inside its TS surface violates the
layering — the LLM call becomes invisible to activities that try to budget,
schedule, or audit it. A vessel that **exposes** an `ask-llm` resolver is
fine: the activity decides when to dispatch it.

Examples:

- *Right.* `BunFileSystemAdapter.read(path)` (`bun-host.ts:32`) — a
  TS-deterministic function exposed as the `file-read` resolver.
- *Right.* `discovery.lookupShapeProducers(shape)` — TS deterministic,
  exposed via DiscoveryPort.
- *Wrong.* A `summariseFile(path)` helper that secretly calls an LLM
  internally — activities can't budget or stratify the call.

### A.2 Activities — the structured-search layer

JSON templates with `input_shapes` / `output_shapes` / `tasks`
(`repos/ias-executor-ts/src/ontology.ts:31-51`). Constrain the search space
between rote code and free-form LLM. Each task names a resolver and a tier:
`deterministic`, `pattern`, or `llm`. Activities are the place where the
mixing decision is made — *this* task is rote bash, *that* task needs an LLM
to interpret a free-form input.

Examples:

- *Right.* `audit-test-report.json`: four tasks, three deterministic (decision-
  record completeness, witness presence, sensitivity history), one llm (review
  the alignment claim) — `2026-05-18-test-audit-loop/design.md:91-94`.
- *Right.* `forge-vessel-for-shape.json`: six tasks dispatched to six forge
  resolvers, every step recorded on the trace.
- *Wrong.* An activity whose `tasks` field contains a single LLM task that
  generates the rest of the workflow on the fly — that's a god-prompt
  wearing an activity costume.

### A.3 LLMs — the variable layer

Used **only** where deterministic resolution is impossible: semantic inference,
novel composition, free-form generation. Always invoked through an LLM-tier
resolver (`makeLLMResolver` in `bun-host.ts:83-108`), never hidden inside a
deterministic resolver's body.

Examples:

- *Right.* `review_alignment_claim` task in `audit-test-report` — the
  plausibility judgement is genuinely outside what a rule can decide
  (`2026-05-18-test-audit-loop/design.md:55-61`).
- *Right.* `compose_audit_report` in audit chains — free-text summary.
- *Wrong.* `check_decision_record_complete` calling an LLM to "decide if the
  record looks complete" — that's a schema check; the deterministic resolver
  exists for a reason.

### A.4 Crossing the layers

The discipline is: **code does what it can deterministically, activities
constrain everything else, LLMs sit at the bottom of the resolver dispatch.**
A change that pulls logic *up* the layers (LLM → activity, activity → TS) is
good and lossless. A change that pushes logic *down* (activity → TS) hides
state from the learning loop. The current minibob god-object pushes a lot of
goal-processing logic into TS that should be expressed as activities.

---

## B. Vessel Contract Under the Canonical Model

A vessel is a TypeScript package that:

1. **Advertises shapes** via discovery-vessel registration (see
   `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` for the three
   invariants).
2. **Exposes resolvers** for those shapes through a single resolve endpoint
   (e.g. `POST /v2/impulses/resolve` for activity-api, or in-process for
   embedded vessels like the BunFileSystemAdapter).
3. **Owns an auth boundary** — every mutation validates an API key or JWT
   against identity-vessel; reads honour `$token.org_id` for tenant
   isolation.
4. **Registers non-blockingly** — discovery-registration failure must not
   prevent the vessel from serving its resolvers.
5. **WS observer is exception-safe** — if a vessel subscribes to activity-
   api's `/ws` for cross-vessel learning (e.g. concept-db's
   ExecutionObserver), every handler swallows-and-logs so the observer
   never throws into the WS loop.

A vessel must **not**:

- Contain hidden LLM calls in its TS surface (§A.1).
- Multiplex multiple unrelated shapes through a god-resolver — each shape
  gets its own resolver id, even if they share an implementation.
- Maintain a hidden state machine across resolve calls — state lives in
  impulses, traces, or external storage with its own contract.
- Bundle its own activity executor — there is one executor (this spec), and
  vessels are *attached to it*, not *parallel to it*.

Minibob today fails #3 and #4. Activity-api passes all five. Discovery-vessel
passes all five. Identity-vessel passes all five.

---

## C. Activity Contract

An activity template declares:

- `id`, `name`, `description`, `tags[]`.
- `input_shapes?: string[]` — what the activity consumes. Optional; absent
  means "accepts any input."
- `output_shapes: string[]` — what the activity produces. **Required.**
  Without declared outputs the activity cannot participate in shape-based
  recommendation, validator dispatch, or chain credit propagation.
- `tasks: ActivityTask[]` — ordered list. Each task names a resolver and a
  tier.
- `subscription?: { shape, filter?, must_fire?, dedupe_key? }` — for meta-
  activities that fire on lifecycle impulses.

Per task:

- `resolver: string` — id of a registered resolver. `bash`, `file-read`, `llm`
  are the BunHost defaults; `forge:scaffold-vessel-skeleton` etc. are forge-
  host-specific.
- `inputShapes?` — what *this task* needs from the pool. Plain shape names or
  `InputShapeRef { shape, producedBy?, cardinality? }` for predicate-
  constrained binding (`ontology.ts:29-40`).
- `outputShapes?` — what this task produces. Used by validator-dispatch.
- `config?: Record<string, unknown>` — resolver-specific. `{ path, command,
  prompt, ... }`.
- `prompt?: { template, variables? }` — when resolver is `llm`. Alternative
  to `config.prompt`.
- `validation?: { ... }` — rules for validator-dispatch to enforce post-
  task.
- `retry?: { max_attempts, strategy }`.

**When LLM-tier is justified:**

- The input is semantically open (free-form goal text, untyped human input).
- The required reasoning is over meaning, not structure (alignment-claim
  review, code-summary generation, novel template composition).
- The cost is bounded by activity-level budgeting (`ExecutionBudget` in
  `engine.ts:7-11`).

**When LLM-tier is wrong:**

- A schema rule can decide the question.
- The output is itself an LLM-shaped string ("LLM decides which template to
  call") — that's hiding control flow inside a resolver.
- The same call would be made every time regardless of input — that's a
  deterministic resolver waiting to be extracted.

---

## D. ias-executor-ts as Canonical Executor

What ias-executor-ts **is**:

- A pure execution substrate (`README.md:5-13`).
- `ExecutionRuntime` (`runtime.ts:47-83`) holding the impulse store, resolver
  registry, clock/random ports, event sink, trace sink, template provider,
  attached-vessel registry.
- `ActivityExecutor` (`engine.ts:32`) — the loop that resolves task input
  shapes, dispatches resolvers, emits lifecycle events, accumulates outputs,
  and records the trace.
- Explicit ports for host effects: `FileSystemPort`, `ProcessPort`, `LLMPort`,
  `EventSink`, `TraceSink`, `DiscoveryPort`, `DockerPort`, `HelmfilePort`
  (the last three for the forge host).
- Reference hosts: `BunHost` (`bun-host.ts:128-169`), `VesselForgeHost`
  (`vessel-forge-host.ts:1-12`), and the new `GoalHost` (this spec, §G).

What ias-executor-ts **is not**:

- A goal-text-to-template mapper. That is a `POST /v2/activities/recommend`
  call on activity-api.
- A vessel registrar. That is discovery-vessel.
- A user-facing shell. Hosts compose the executor with whatever UI they need.
- A daemon. The executor is a library; hosts run it in whatever process
  topology suits them.
- A learning algorithm. Thompson Sampling is activity-api's job.

The current `repos/ias-executor-ts/src/index.ts` exports `ontology`, `ports`,
`impulses`, `resolvers`, `runtime`, `engine`. This is the entire public
surface. After this spec lands it gains a lifecycle-subscriber module (§E) and
a shared template loader (§F).

---

## E. Lifecycle-Subscription Dispatch Port

The piece of minibob's god-object that genuinely belongs in the canonical
executor is `lifecycle-subscriptions.ts` (`repos/minibob/src/lifecycle-
subscriptions.ts`, 552 lines). Slot-binding, validator-dispatch, ribosome-
extract, the test-audit-loop trio (`audit-test-report`, `run-sensitivity-
probe`, `debug-failing-audit`), and the forge escalation path all rely on it.
Without lifecycle-subscription dispatch, ias-executor-ts cannot host the
canonical meta-activities; with it, ias-executor-ts can host the entire IAL
stack.

The current implementation in minibob carries:

- `findSubscribers(shape, payload, emittingTemplateId?)` —
  `lifecycle-subscriptions.ts:302-324`.
- `matchesFilter(filter, payload)` with suffix-predicate semantics
  (`_contains`, `_equals`) and snake-case → camelCase fallback
  (`lifecycle-subscriptions.ts:203-254`).
- `rankSubscribers(candidates, context, { topK })` with `must_fire`
  segregation (`lifecycle-subscriptions.ts:330-364`).
- Dedupe via per-process `Map<string,number>` with 5-minute TTL and
  opportunistic GC (`lifecycle-subscriptions.ts:381-485`).
- Depth-cap refusal for `tags ∋ "audit"` templates, default 2, max 4
  (`lifecycle-subscriptions.ts:424-457`, mirrors `2026-05-18-test-audit-loop`
  spec R5).
- Failure isolation in `fireSubscribers` — subscriber failures are logged
  and swallowed (`lifecycle-subscriptions.ts:541-548`).

### E.1 Two integration options

**Option E.1: Inline in `ExecutionRuntime`.** Add a `subscribers:
SubscriberRegistry` field alongside `resolvers` and `attachedVessels`.
`emit(event)` calls `findSubscribers(event.type, event.data)` and dispatches
via the runtime's own `ActivityExecutor.execute`.

**Option E.2: Attached vessel of kind `lifecycle-subscriber`.** A new
`AttachedVessel` kind in `ontology.ts`. The lifecycle-subscriber vessel
exposes a single resolver (`dispatchSubscribers`) and is attached like any
other capability (`bun-host.ts:143-147`). The executor's `emit()` looks up
attached lifecycle-subscriber vessels and dispatches through them.

**Choice: Option E.2.**

Reasons:

1. The README dev-loop rule 4 is explicit: "Attach capability-bearing vessels
   explicitly; do not smuggle them in as hidden built-ins."
   (`ias-executor-ts/README.md:32`). Inlining the subscriber registry into
   the runtime smuggles it in; attaching it as a vessel makes it
   inspectable.
2. Tests that don't want subscriber dispatch (the pure in-memory path
   `README.md:29`) get it for free by not attaching the vessel. Inlining
   would require an opt-out flag.
3. Other hosts that want different dispatch semantics (e.g. a forge host
   that only fires on `forge:*` shapes) can attach a customised
   lifecycle-subscriber vessel instead of monkey-patching the runtime.

### E.2 Carry-over semantics

The port preserves verbatim:

- Suffix predicates `_contains` / `_equals` (`lifecycle-subscriptions.ts:209-
  222`).
- snake-case → camelCase payload-field fallback (`lifecycle-
  subscriptions.ts:241-254`).
- Self-subscription guard via `emittingTemplateId` skip
  (`lifecycle-subscriptions.ts:312-315`).
- Top-K: high-frequency shapes (`task:completed`, `task:started`,
  `execution:tick`) → K=1; other shapes → K=3
  (`lifecycle-subscriptions.ts:82-95`).
- `must_fire` segregation (`lifecycle-subscriptions.ts:344-363`).
- Dedupe window 5 minutes, key template syntax
  `"{test_registration_id}:{audit_subtype}"` with dotted-path resolution
  (`lifecycle-subscriptions.ts:381-417`).
- Audit-tag depth-cap (default 2, ASSERT-bounded 4) reading from
  `template.metadata.auditDepthCap` and `payload.parentDepth` /
  `compositionChain` / `composition_chain`
  (`lifecycle-subscriptions.ts:424-457`).
- Subscriber-failure isolation (`lifecycle-subscriptions.ts:541-548`).

Behaviour parity is the load-bearing test: every existing canary trace that
exercised lifecycle subscribers under minibob must produce a byte-identical
sequence of subscriber dispatches (modulo timestamps and ids) under
ias-executor-ts. Spec test plan in tasks.md §S.

### E.3 Template provider

The subscriber-lookup path needs a template provider — today
`defaultTemplateProvider` reads from minibob's embedded-templates module
(`lifecycle-subscriptions.ts:114-122`). After §F, the provider reads from
the shared catalogue (or from an activity-api-backed
`HttpTemplateProvider` for hosts that want live registry queries).
`ExecutionRuntime.templateProvider` already exists (`runtime.ts:54, 65, 79-
82`) and is consumed by the executor's compose-dispatch path; the
subscriber-lookup path uses the same field.

---

## F. Shared Template Catalogue

The 80 templates in `repos/minibob/src/embedded-templates/` are JSON. They
have no minibob-specific dependencies. They are referenced by:

- minibob itself (current).
- forge tests (via `MINIBOB_BIN` spawn — they end up in minibob's process).
- The test-audit-loop spec, which assumes `audit-test-report.json`,
  `run-sensitivity-probe.json`, `debug-failing-audit.json` are loadable
  (`2026-05-18-test-audit-loop/proposal.md:113-115`).
- Workbench (when previewing template behaviour).
- The validation harness in `validation/scripts/` (indirectly via minibob
  spawns).

### F.1 Two location options

**Option F.1: `repos/ias-executor-ts/src/templates/`.** Templates live inside
the executor package. Loaded by a shared catalogue module exported alongside
the runtime. Every host that imports ias-executor-ts gets the catalogue for
free.

**Option F.2: `repos/activity-templates/` as a standalone package.** A new
monorepo entry consumed by ias-executor-ts, minibob (during transition), and
workbench. Pure JSON + a thin TS loader. Versioned independently.

**Choice: Option F.1 with a forward path to F.2 if the catalogue grows.**

Reasons:

1. The templates are tightly coupled to the executor's ontology (`subscription`
   shape, `inputShapes` syntax, resolver tiers). Co-locating them with the
   ontology keeps the coupling honest.
2. Standalone-package overhead (separate `package.json`, separate version
   bumps, separate publishing) is not justified by the current consumer set
   (executor + minibob, both internal). If a third independent consumer
   emerges, split out F.2.
3. The current `repos/ias-executor-ts/src/examples/` already holds host
   references (`bun-host.ts`, `vessel-forge-host.ts`). Templates are
   analogous: they describe how the executor is used, and they belong with it.

### F.2 Catalogue structure

```
repos/ias-executor-ts/src/templates/
├── index.ts                       # loader + validation + cache
├── meta/                          # lifecycle-subscriber templates
│   ├── slot-binding.json
│   ├── validator-dispatch.json
│   ├── create-shape-provider-goal.json
│   ├── ribosome-extract.json
│   ├── audit-test-report.json
│   ├── run-sensitivity-probe.json
│   └── debug-failing-audit.json
├── goals/                         # goal-processing templates
│   ├── goal-processing-standard.json
│   └── goal-processing-activity-driven.json
├── registry-quality/              # the six-pack
│   ├── core-activity-audit.json
│   ├── review-activity.json
│   ├── prune-activity.json
│   ├── replace-activity.json
│   ├── extract-pattern.json
│   └── concept-from-pattern.json
├── forge/                         # vessel forge templates
│   └── forge-vessel-for-shape.json
└── bootstrap/                     # well-formed examples
    ├── hello-world-minimal.json
    ├── execute-shell-command.json
    └── ...
```

The `index.ts` loader mirrors `repos/minibob/src/embedded-templates/index.ts`:
validation (`validateTemplate`), repair attempt on validation failure
(deferred — repair is itself a meta-activity, so it lives in the catalogue
not the loader), in-memory cache.

Migration: minibob's `embedded-templates/index.ts` becomes a thin re-export
of the shared catalogue for one release cycle, then is removed in Phase 4.

---

## G. GoalHost Reference Implementation

The composed host. The pattern that replaces "spawn minibob --single $goal."

### G.1 Constructor signature

```typescript
export interface GoalHostOptions {
  llm: LLMPort;                          // required — needed for llm-tier resolvers
  activityApiEndpoint: string;           // e.g. https://activity.metabob.com
  activityApiKey: string;                // canary or prod api key
  discoveryEndpoint?: string;            // default: discovery.metabob.com
  identityEndpoint?: string;             // default: identity.metabob.com
  eventSink?: EventSink;                 // default: no-op
  workingDirectory?: string;             // default: process.cwd()
}

export class GoalHost {
  readonly runtime: ExecutionRuntime;
  readonly executor: ActivityExecutor;

  constructor(options: GoalHostOptions);

  async runGoal(goalText: string, opts?: { variables?: Record<string, unknown> }): Promise<ExecutionTrace>;
  async runTemplate(templateId: string, opts?: ExecuteOptions): Promise<ExecutionTrace>;
}
```

### G.2 Composition

GoalHost wires:

- **BunHost** internals (file-read, bash, llm resolvers via Bun adapters) —
  copied from `bun-host.ts:128-169`.
- **`ActivityApiAdapter`** — wraps `POST /v2/activities/recommend` (for
  `runGoal`), `POST /v2/activities/execution-traces` (TraceSink), and
  `GET /v2/activities/templates/:id` (templateProvider fallback). Modelled
  after `HttpTraceSink` (`bun-host.ts:187-207`) but with three methods
  instead of one.
- **`HttpDiscoveryAdapter`** — already exists in
  `ias-executor-ts/src/adapters/discovery-adapter.ts`, used by
  `vessel-forge-host.ts:19`.
- **`IdentityVesselAdapter`** — thin wrapper over the api-key header. For
  GoalHost, identity is implicit in the `activityApiKey`; no separate adapter
  is needed unless the host wants to mint per-request JWTs (deferred).
- **Lifecycle-subscriber vessel** (§E) attached with the shared catalogue
  (§F) as its template provider.
- **Shared template catalogue** registered as the `templateProvider` on the
  runtime so compose-dispatch and lifecycle-subscriber lookup share one
  source.

### G.3 `runGoal` flow

```
1. Seed a `goal` impulse with goalText into the runtime store.
2. Call activityApi.recommend({ goal: goalText, expected_output_shapes: [] })
   → top template id.
3. Load template via the templateProvider (catalogue first, activity-api
   fallback).
4. Execute via ActivityExecutor.execute(template, { variables, impulses: [goalImpulse] }).
5. TraceSink writes the trace to canary. EventSink emits lifecycle events to
   the caller-provided sink (or a no-op).
6. Return the trace.
```

That's the whole entry point. Everything else minibob does today (CLI
prompting, REPL conversation history, boredom polling, ACP gossip, waking
activities) is **not** GoalHost's responsibility.

### G.4 Comparison to `vessel-forge-host.ts`

GoalHost is to general goals what VesselForgeHost is to forge goals:

| Aspect | VesselForgeHost | GoalHost |
|--------|-----------------|----------|
| Resolver set | 6 forge resolvers + BunHost defaults | BunHost defaults |
| External ports | Docker, Helmfile, Discovery | Discovery, ActivityApi, (Identity) |
| Template source | One template id passed to `execute()` | `recommend` → top template id |
| Trace sink | Caller-provided | ActivityApi (canary) |
| Lifecycle subscribers | None today | Attached, reading shared catalogue |

`vessel-forge-host.ts` is the closest precedent and the pattern to extend.

---

## H. Migration Plan

### Phase 1 — Substrate

1. Port `lifecycle-subscriptions.ts` into `repos/ias-executor-ts/src/`.
   Attach as `lifecycle-subscriber` vessel kind (§E).
2. Move embedded templates into
   `repos/ias-executor-ts/src/templates/` (§F).
3. Ship `repos/ias-executor-ts/src/examples/goal-host.ts` (§G).
4. minibob's `embedded-templates/index.ts` becomes a thin re-export of the
   shared catalogue.
5. minibob's `lifecycle-subscriptions.ts` becomes a thin re-export of the
   ias-executor-ts module.

Behaviour change: **none**. Minibob still primary on canary. Tests prove
parity.

### Phase 2 — Forge migration

1. Switch `validation/scripts/test-forge-goal-completion.ts` from
   `spawn(MINIBOB_BIN)` (`test-forge-goal-completion.ts:221`) to
   `GoalHost.runGoal()`. The sketch in
   `validation/scripts/_forge-via-ias-executor.ts:5` is the model.
2. Run Pass 1 + Pass 2 of the test on canary via GoalHost.
3. Compare trace shape (`(activity_template_id, task_ids, output_shapes,
   failure_mode?)`) against the last minibob-driven run.

Acceptance: success criterion #3 in proposal.md.

### Phase 3 — Harness migration

1. `validation/scripts/reuse-harness.ts` switches to GoalHost.
2. `validation/scripts/cycle.sh` switches to GoalHost.
3. Each `test-22-*` script in `validation/scripts/` switches.
4. Run for 7 days. Compare `reuse_mrr` and `recommend_mrr` against the
   pre-migration baseline.

Acceptance: success criterion #4 in proposal.md (±0.02 band).

### Phase 4 — Minibob deprecation

Decision point. Two paths:

**Path 4a: Retire minibob entirely.** If no remaining live consumer needs the
TUI/REPL/boredom/ACP surface, archive the repo. Remove
`repos/minibob/` from `.gitmodules`. Update CLAUDE.md and the deployment
manifests.

**Path 4b: Shrink minibob to a thin shell.** Keep `boredom.ts`,
`conversational-repl.ts`, `acp.ts`, CLI entry. Remove `activity.ts`,
`lifecycle-subscriptions.ts`, `embedded-templates/`, `goal-processor.ts`.
Total minibob LOC drops from ~11.7k (`activity.ts` 7,932 + `impulse.ts` 2,334
+ `goal-processor.ts` 602 + `boredom.ts` 834 = 11,702 in the four largest
files alone) to < 1,500 LOC.

The decision waits on Phase 3 harness data plus an explicit user check:
*does anyone still use the TUI shell?* If no, 4a. If yes, 4b.

Acceptance: success criterion #5 in proposal.md.

---

## I. What Does Not Belong in the Canonical Executor

Explicit non-goals. The README says some of this
(`ias-executor-ts/README.md:14`); the rest is implied. Listed here so the
boundary is uncontested.

- **CLI parsing.** Hosts handle their own argv. The executor exports a
  library API.
- **REPL / TUI.** A user-facing shell is a host concern. Minibob's
  `conversational-repl.ts` stays in minibob (or its successor).
- **Daemon / server.** The executor is a library. If a host wants to expose
  the executor over HTTP, it builds the server (see activity-api's pattern).
- **Boredom / autonomous loops.** A separate vessel + scheduler. Not the
  executor's concern.
- **Vessel registration with discovery-vessel.** Discovery's job. The
  executor accepts a `DiscoveryPort`; it does not own the registration
  lifecycle.
- **Goal-text-to-template mapping.** Activity-api's `POST /v2/activities/
  recommend` is the canonical mapper. The executor does not pattern-match
  goal text.
- **Thompson Sampling internals.** Activity-api owns variant_performance_
  metrics, the recommend handler, posterior writes. The executor emits
  traces; the backend learns.
- **Concept-DB integration, conversation memory, MCP protocol, ACP gossip.**
  Each is its own vessel or its own host's concern.

The executor only executes templates with the right ports wired up. That is
the entire job.

---

## J. Trade-Off Analysis

Honest accounting. Minibob accumulated real value as well as accidental
complexity. What we lose, and where it goes.

### J.1 Goal-processing heuristics

Minibob's `goal-processor.ts` (602 lines) contains failure-penalty tracking
(`goal-processor.ts:48-59`), budget state, impulse-state-space management,
LLM client wiring. Most of the *behaviour* has already been refactored into
template-dispatchable resolvers (`goal-processor.ts:1-12` notes the 96 %
reduction from 7,631 to ~300 effective lines via meta-activity delegation).

What remains is genuinely useful: the failure-penalty timeout that prevents
the recommender from re-selecting a template that just failed
(`goal-processor.ts:48-59`). This needs to move into either (a) an attached
vessel on GoalHost that intercepts the recommend response, or (b) a server-
side filter on activity-api's recommend handler. **Recommended path: (b)**,
because the penalty is org-wide signal, not per-host. Out of scope for this
spec; tracked as a follow-up.

### J.2 Boredom loop

`boredom.ts` (834 lines) is the autonomous improvement engine. It does **not**
belong in the canonical executor. It is its own vessel: a scheduler that
periodically calls `GoalHost.runGoal(autonomousGoalText)`. Path 4b keeps it
in minibob; if minibob is retired, boredom moves to a new
`repos/autonomous-driver/` package. Not the canonical executor's problem.

### J.3 ACP gossip

`acp.ts` (389 lines) + `acp-gossip.ts` (204 lines) handle the Agent
Communication Protocol. Same disposition as boredom: not the executor's
concern, lives in its own vessel.

### J.4 Retry logic

Minibob's `activity.ts` has rich retry semantics (per-task max-attempts,
strategy hints). ias-executor-ts's `engine.ts` is simpler — retry today is
not implemented in the canonical executor. **This is a real gap.** Phase 1
ports it. See tasks.md §1.

### J.5 Scope inheritance for sub-goals

`create-shape-provider-goal` enforces scope inheritance per
`2026-04-26-shape-provider-goal-creation/design.md`. The activity itself
encodes the rule (sub-goal `outputShapes ⊆ parent.endpoint_output_shapes`),
so the executor doesn't need it. The activity is in the shared catalogue
(§F). Carries over.

### J.6 Embedded LLM provider switching

Minibob CLI accepts `--provider anthropic|openai` and routes the LLM client
accordingly. GoalHost requires the host to inject an `LLMPort`. Provider
switching becomes a host-level concern. **Net change: simpler.** The TUI
shell (Path 4b) keeps the flag and constructs the right port.

### J.7 What's strictly lost

Genuinely lost behaviours (not migrated, not replaced):

- `--idle`, `--caffeine` flags. These are CLI-shell concerns. Path 4a loses
  them; Path 4b keeps them.
- `/teach`, `/warn`, `/auth`, `/status` REPL commands. Path 4a loses them;
  Path 4b keeps them.
- Embedded template *self-healing* (`embedded-templates/index.ts:293-373`).
  The repair-on-validation-failure path. Re-implementable as a meta-activity
  if it's actually exercised in practice (audit canary logs first).

No business-critical behaviour is strictly lost. The strict losses are all
shell affordances replaceable by a thin TUI in Path 4b.

---

## K. Connections to Existing Specs

- **`2026-05-18-test-audit-loop`** — the audit-test-report / run-sensitivity-
  probe / debug-failing-audit templates assume lifecycle-subscription dispatch
  with `output_shapes_contains` filter semantics and depth-cap enforcement.
  This spec carries those semantics into the canonical executor.
- **`2026-05-18-forge-goal-completion-test`** — the test is the first
  migration target (Phase 2). VesselForgeHost is the precedent for GoalHost.
- **`2026-05-17-state-space-signature-thompson-keying`** — Thompson keying
  runs on activity-api, not in the executor. Unchanged.
- **`2026-05-17-shape-dispatch-agreement`** — shape-dispatch is enforced at
  template-load time; the shared catalogue (§F) is the new enforcement
  point.
- **Phase 22 — Autonomous Vessel Forge.** VesselForgeHost ships the pattern
  this spec generalises. GoalHost is the same pattern for the goal-driven
  path. Phase 22 templates (`forge-vessel-for-shape.json`) move into the
  shared catalogue.
- **`2026-04-26-impulse-activity-loop`** Phase 22 §1965-1997 — the
  `forge_vessel_for_shape` activity and slot-binding escalation branch
  continue to work; the executor that runs them is now ias-executor-ts.
- **`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`** — the foundational
  document. This spec implements its layering rule by deleting the layer
  violations in minibob.
- **`docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md`** — the three vessel
  invariants. This spec applies them to ias-executor-ts (it already passes
  them) and re-evaluates minibob against them (it fails several).
