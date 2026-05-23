# Design: Substrate-Hosted Explicit Vessels

## Context

Foundation §265-276 (`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`)
identifies the implicit-vessel gap. Two services bundle resolvers and dispatch
logic but bypass discovery / impulse-routing entirely. The foundation calls
this "structural", not pejorative — the four-primitive model would equally
permit a category of co-located vessels — but it flags that the hypothesis
is **untested** in the parts of the system where it matters most.

The IAL spec's Phase 27 (lift) cannot hand over to a substrate whose core
execution path is reachable only by in-process call from a single binary.
The hand-over condition is "the substrate sustains its own topology-discovery
loop without external developer input". A substrate that depends on minibob's
in-process executor cannot survive minibob's evolution; conversely, minibob's
unbundling into explicit vessels is precisely what makes the hand-over
testable.

## Design decisions

### D1 — In-process vs. cross-vessel: where the boundary lives

**Decision**: `ActivityExecutor`, `LifecycleSubscriberVessel`, and the Bun
filesystem/process adapters stay **in-process inside each vessel host**. They
do not become their own substrate units.

**Why**: making file IO remote is wrong — it multiplies hop count per task
without buying a trust or scaling boundary. The "implicit ActivityExecutor"
worry from the foundation is about *advertisement*, not *co-location*. Every
vessel host bundles its own ActivityExecutor; what becomes explicit is which
shapes that host advertises and resolves.

The pattern: a substrate vessel is a `VesselDaemon` wrapping
`(executor, subscriber, registration-loop, resolver-server)`. Multiple
substrate vessels run; each has its own ActivityExecutor. Cross-vessel
dispatch is HTTP. Within-vessel dispatch is in-process.

### D2 — Latency budget

**Measurement (verified against goal-host.ts:307-493)**: GoalHost today
makes ~3-5 cross-vessel HTTP calls per goal (activity-api for templates,
recommendations, trace writes; discovery for resolver routing). Adding
local-tools-vessel, llm-resolver-vessel, ribosome-vessel as separate
units adds at most 1-2 hops per task. Most goals have 10-30 tasks. Worst
case: ~30 tasks × 2 extra hops × ~15ms localhost RTT = ~900ms overhead.

**Verdict**: acceptable. LLM calls dominate at ≥500ms each; goals spend
most wall-clock in LLM, not in IPC.

**Mitigation**: resolvers **inside a task** stay in-process within the
host. Only cross boundaries when fetching shapes the host doesn't own.
GoalHost already follows this rule (`makeProducerSelectionResolver` does
one HTTP call to activity-api, not three vessel hops).

### D3 — Composition-chain threading across vessel boundaries

This is the subtlest correctness issue. Within a single `ActivityExecutor`,
`TranslatingTraceSink` (`repos/ias-executor-ts/src/adapters/activity-api-trace-sink.ts`)
threads `composition_chain` correctly — verified at goal-host.ts:348-353.

**Across vessels**, the chain is interrupted. If `goal-host-vessel`
dispatches to `llm-resolver-vessel`, the LLM resolver's executor starts a
fresh chain unless the parent's chain is propagated.

**Mechanism**: `VesselDaemon`'s endpoints accept
`parent_execution_id` and `composition_chain` in the request body and
thread them into `ExecuteOptions`. Callers must include them. The
caller side already has this state — `ExecuteOptions` carries it
through `runGoal` / `runTemplate`.

**Verification**: a chain-credit integration test (Phase 18.4.7) ported
to a 3-vessel topology. Today's test runs single-process; the ported
test confirms the same α/β updates hit ancestors when execution crosses
vessel boundaries.

**Risk**: if any vessel forgets to forward the chain, that hop becomes
a "credit cliff" — orchestrator credit stops accumulating. Detection:
runtime assertion in `VesselDaemon` that any non-root invocation
(distinguished by an `X-Caller-Vessel` header) MUST carry
`parent_execution_id`. Missing → 400 + `verifier_negative` self-trace.

### D4 — Auth: per-vessel API keys minted at substrate boot

Each new vessel needs its own identity-vessel-issued API key for outbound
calls to activity-api (trace writes, posterior reads) and to other
vessels. `scripts/substrate/seed-identity.ts` is extended to mint keys at
boot; `gen-env.sh` writes them to `/etc/substrate/env/<vessel>.env`,
read by the systemd unit's `EnvironmentFile`.

**Why per-vessel**: trace attribution. Every write must identify the
calling vessel so the learning loop can attribute outcomes. Shared keys
break this.

**Trust root**: identity-vessel is the issuer. All keys derive from the
substrate's seed identity. This is single-trust-root federation — fine
for a local substrate, insufficient for cross-substrate vessel federation.
Cross-substrate trust is the H6 / zk-trace-attestations problem (see
sibling spec `2026-05-23-zk-trace-attestations`).

### D5 — Bootstrap chicken-and-egg

Today, minibob seeds embedded templates into activity-api at startup. When
minibob is removed, the seed step disappears unless we re-home it.

**Decision**: a `bootstrap-seeder.service` systemd `Type=oneshot` unit,
ordered `After=activity-api.service`. Reads `SHARED_TEMPLATES` from
ias-executor-ts. POSTs each via `activityTemplate_update` impulse. Exits.

**Idempotency**: each upsert is keyed on template id; repeat invocations
are no-ops. Tracked in `init_templates` table mirroring `init_migrations`.

**Bootstrap auth**: the seeder uses an API key minted by
`seed-identity.ts` *before* activity-api starts accepting auth-gated
writes. systemd ordering ensures the key file exists when the seeder
runs.

### D6 — The `goal-host-bridge.ts` is vestigial

Memory note `percolation_2026_05_20_ias_executor_ts` confirms
`goal-host-bridge.ts` is wired and gated by `GOAL_RUNTIME=ias-executor`.
The bridge is a transitional shim from "minibob calls GoalHost in-process"
to "goal-host-vessel runs as its own daemon". With Phase 4 of this
change shipped, every dispatch is HTTP and the bridge becomes dead code.

We delete it in Phase 4.4. The cutover risk is low because the bridge
itself is recent (2026-05-20) and the GoalHost API surface it wraps is
stable.

## Alternatives considered

### A1 — Keep ActivityExecutor in-process forever; only advertise

Rejected. The whole point of advertisement is that another vessel can
dispatch to your executor via the impulse system. If ActivityExecutor stays
in-process inside minibob, no other vessel can advertise it as their
own resolver — minibob remains the sole executor. Lift cannot hand over
to a substrate where the executor is owned by a single binary.

### A2 — One vessel per resolver

Rejected. Over-decomposition. The nine LLM-flavoured resolvers share
prompt scaffolding, model selection, and credentials. Splitting them
into nine units multiplies operational surface for no boundary benefit.
The vessel boundary should track **trust / credential / data ownership**,
not granularity of resolver registration.

### A3 — Wait for ZK-attested traces (H6) before extracting vessels

Rejected. The two changes are orthogonal. H6 protects against
cross-trust-boundary trace poisoning; within a shared-trust substrate
(today's reality), per-vessel API keys + identity-vessel attestation are
sufficient. H6 becomes load-bearing only when vessels federate across
substrates. Blocking extraction on H6 means lift waits years; extracting
now and adding H6 later is the right order.

## Open questions

- **Q1**: Does `concept-db` get a place in this layout? It already runs
  as a vessel. The LLM-flavoured resolvers (goal-enrichment) call
  concept-db indirectly today. After extraction, llm-resolver-vessel
  calls concept-db as a downstream dependency — no new wiring.
- **Q2**: Does `vessel-forge-host` (`repos/ias-executor-ts/src/examples/vessel-forge-host.ts`)
  become its own substrate unit or fold into `development-vessel`?
  Recommendation: **fold into development-vessel** as a new resolver.
  Avoids over-decomposition. Development-vessel is already the
  substrate-self-improvement vessel and adding another unit just for
  forging duplicates lifecycle/auth boilerplate.
- **Q3**: How does the conversational-repl (`repos/minibob/src/conversational-repl.ts`)
  survive the shrink? It's a stateful UI surface, not a vessel. Likely
  becomes part of the thin `metabob-cli` along with `cli/`. Confirmation
  deferred to Phase 8.

## Cross-references

- IAL: `openspec/changes/2026-04-26-impulse-activity-loop/proposal.md` §7
  (lift criterion), `tasks.md` Phase 27.3 (pre-lift checklist).
- ias-executor-ts canonical host: `openspec/changes/2026-05-19-ias-executor-as-canonical-host/`.
- Substrate: `openspec/changes/2026-05-23-single-container-substrate/`,
  `docs/SUBSTRATE.md`.
- Topology discovery loop: `openspec/changes/2026-05-23-topology-discovery-loop/`.
- ZK trace attestations (sibling, deferred): `openspec/changes/2026-05-23-zk-trace-attestations/`.
- Vessel federation (downstream, depends on this): `openspec/changes/2026-05-23-vessel-federation/`.
