# Proposal: Substrate-Hosted Explicit Vessels

## Why

`docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` §265-276 names two services
that are *structurally* vessels (they bundle resolvers and dispatch logic) but
do not participate in the four-primitive model: they do not register with
discovery-vessel, they do not advertise shapes, and they are reachable only via
in-process calls or REST endpoints. These are the **implicit vessels**:

- **ActivityExecutor** inside MiniBob (`repos/minibob/src/activity.ts`) — invoked
  by `repos/minibob/src/goal-processor.ts:463` as `await this.executor.execute(...)`.
  No impulse pointer is created; no resolver is dispatched. Goal-processor
  hard-codes orchestration that should live in meta-activities.
- **Thompson Sampling** inside activity-api
  (`repos/metabob-activity-api/src/db/paradigm.ts` posterior computation +
  `GET /v2/activities/:id/variant-scores` REST handler) — Phase 9 of the IAL
  added a `thompson_posterior` impulse case in `src/routes/impulses.ts` but the
  shape is **not advertised** in `config.discovery.shapes`. Clients hit REST
  directly.

The implicit-vessel surface is the largest open hole in the foundation's
self-consistency check. So long as core execution and posterior lookup bypass
the impulse system, the four-primitive hypothesis (impulse / pointer / resolver
/ vessel) is **under-tested** in exactly the places where it matters most for
Phase 27 (lift). Lift cannot hand over to a substrate whose core execution
path is reachable only by in-process call from a single binary.

`repos/ias-executor-ts/` is positioned to close this gap. Milestones A–D are
complete; `GoalHost` (`src/examples/goal-host.ts`) already composes BunHost +
ActivityApiAdapter + HttpDiscoveryAdapter + lifecycle-subscriber and exposes
`runGoal(text)` / `runTemplate(id)`. The forward-looking spec
`2026-05-19-ias-executor-as-canonical-host` deprecates minibob's in-process
executor in favour of GoalHost via the `goal-host-bridge.ts` shim. Phase 26
(`2026-05-23-single-container-substrate`) gives us systemd-managed vessel units
with discovery-based registration via `scripts/substrate/units/*.service`.

Composing these capabilities, the substrate can host the *full* set of
explicit vessels that lift requires, with no further refactor to minibob's
goal-processor.ts. The intermediate `goal-host-bridge.ts` becomes vestigial
once `goal-host-vessel` is its own systemd unit.

## What Changes

This change defines:

1. **A vessel-daemon toolkit** added to `ias-executor-ts` exposing
   `VesselDaemon` (Bun HTTP wrapper around any executor + subscriber +
   discovery loop), `ResolverServer` (Hono router mapping resolver ids to
   pointer-typed routes), and `DiscoveryRegistrationLoop` (the
   register-on-startup + 60s heartbeat + deregister-on-SIGTERM utility that is
   currently copy-pasted across activity-api, identity-vessel, concept-db,
   conversation-vessel, discovery-vessel, and development-vessel). `GoalHost`
   is promoted out of `src/examples/` into `src/hosts/` as a first-class
   export. Target: any new substrate vessel is ≤100 LOC of glue.

2. **Six substrate-hosted explicit vessels**, each a systemd unit in the
   single-container substrate:

   | Vessel | Port | Owns | Replaces |
   |---|---|---|---|
   | `goal-host-vessel` | 8210 | `goal_execution`, `activity_execution` shapes; `POST /run-goal` | the in-process `executor.execute()` call in goal-processor.ts |
   | `llm-resolver-vessel` | 8220 | `llmText`, `llmStructured`, `llmToolCall` shapes; owns Anthropic/OpenAI keys | `repos/minibob/src/llm.ts` and the nine LLM-flavoured resolvers under `repos/minibob/src/resolvers/` |
   | `local-tools-vessel` | 8230 | `fileContent`, `commandResult`, `gitDiff`, `directoryTree` advertised shapes | `repos/minibob/src/tools.ts` advertisement (BunFileSystemAdapter / BunProcessAdapter stay in-process per host) |
   | `ribosome-vessel` | 8240 | subscribes to activity-api WebSocket `task.completed` / `execution:succeeded` events; writes via `activityTemplate_update` | the lifecycle-meta ribosome embedded in minibob |
   | `boredom-vessel` | 8250 | timer-driven autonomous-loop driver | `repos/minibob/src/boredom.ts` |
   | `bootstrap-seeder.service` | (oneshot) | seeds `SHARED_TEMPLATES` from ias-executor-ts into activity-api at substrate boot | minibob-on-startup seeding (chicken-and-egg dissolver) |

3. **Thompson posterior advertisement** — add `thompson_posterior` to
   activity-api's `config.discovery.shapes`. Fix the account-vs-global scope
   ordering bug noted in IAL Phase 9.3. (This closes the second implicit-vessel
   gap with minimal code change.)

4. **Cross-vessel composition_chain propagation** — `VesselDaemon`'s `/run-goal`
   endpoint accepts `parent_execution_id` and `composition_chain` in the
   request body and threads them into `ExecuteOptions`. This is the single
   subtlest correctness property: the learning loop's two-arm symmetry
   (forward impulse-relevance writes via `lifecycle:task:completed`, reverse
   Thompson updates via execution outcomes) holds only if both arms see the
   same execution id and chain across vessel boundaries.

5. **Minibob shrink path** — staged extraction so the substrate remains
   functional at every step. After Step 6, `repos/minibob/` is a ~200-LOC CLI
   shell that POSTs to `goal-host-vessel`; the package is renamed
   `metabob-cli`. No user-visible change to `minibob --single "…"`.

This change introduces **no new primitives**. It surfaces existing capabilities
behind explicit vessel boundaries and folds the result into the IAL's pre-lift
readiness checklist.

## Lift integration

Amends IAL `2026-04-26-impulse-activity-loop/tasks.md` Phase 27.3 (Pre-lift
readiness checklist) with a new section **27.3.c — Explicit-vessel coverage**:

- 27.3.c.1 — No core execution path may be reachable only via in-process call.
  Verified by static check: `goal-host-bridge.ts` is deleted; `goal-processor.ts`
  is deleted or reduced to a CLI client; `repos/minibob/src/activity.ts` no
  longer exports `ActivityExecutor`.
- 27.3.c.2 — `thompson_posterior` resolves via `POST /v2/impulses/resolve` and
  the shape is advertised in `config.discovery.shapes`. REST surface remains
  for backwards compatibility.
- 27.3.c.3 — All six new vessels respond to `GET /health` and complete
  discovery registration within 10s of substrate start. Verified by
  `scripts/substrate/smoke-test.sh`.
- 27.3.c.4 — Cross-vessel `composition_chain` end-to-end test: a goal that
  dispatches across `goal-host → llm-resolver → local-tools → activity-api`
  produces a single trace tree whose `composition_chain` is contiguous and
  whose Thompson α/β credits propagate to the orchestrator via the existing
  Phase 18.4 chain-credit path.

Lift cannot enter `candidate` status until 27.3.c is fully green. Per IAL
Phase 27.1.2, the substrate's `convergence-tick` must produce three
non-human-triggered `convergenceReport` snapshots; the substrate cannot
produce those without `boredom-vessel` running as its own systemd unit
(item 27.3.c.3).

## Success criteria

1. **Six new systemd units present and healthy** in a fresh substrate boot.
   Verified by `docker exec substrate systemctl is-active <vessel>.service`
   returning `active` for each.
2. **`minibob --single "…"` works unchanged from the user's perspective**,
   but its implementation is a one-shot HTTP client. Verified by running the
   failure-mode harness (`validation/scripts/failure-mode-harness.ts`) against
   the substrate; baseline pass-rate (≥4/6 modes per memory note
   `percolation_2026_05_22_failure_mode_loop`) preserved or improved.
3. **`thompson_posterior` resolves both via REST and via
   `POST /v2/impulses/resolve`** with identical payloads, and the shape
   appears in `GET /v2/vessels/shapes` discovery output.
4. **Composition-chain credit propagation works across vessel boundaries**.
   Integration test: dispatch a 3-vessel composition; assert the orchestrator
   activity's α increment matches the expected γ-discounted ancestor credit
   from Phase 18.4 (validation test `18.4.7` ported to the cross-vessel
   topology).
5. **Pre-lift readiness checklist item 27.3.c green** on canary substrate.
   `validation/state/lift-status.json` shows no blockers under `27.3.c`.

## Capabilities

### New Capabilities

- `vessel-daemon-toolkit` (this change) — `VesselDaemon`, `ResolverServer`,
  `DiscoveryRegistrationLoop` promoted to first-class exports of
  `@avigopal/ias-executor-ts`. `GoalHost` moved from `src/examples/` to
  `src/hosts/`. Target: any substrate vessel is ≤100 LOC of glue against this
  toolkit. Owned by `ias-executor-ts`. Spec:
  `specs/vessel-daemon-toolkit/spec.md`.
- `substrate-explicit-vessels` (this change) — the six new vessels
  (`goal-host`, `llm-resolver`, `local-tools`, `ribosome`, `boredom`,
  `bootstrap-seeder`) wired as systemd units in the single-container
  substrate, with `thompson_posterior` advertisement on activity-api.
  Spec: `specs/substrate-explicit-vessels/spec.md`.

### Modified Capabilities

- IAL Phase 27.3 (pre-lift readiness checklist) gains §27.3.c.
- `goal-host-bridge.ts` in minibob is deprecated in favour of HTTP dispatch
  to `goal-host-vessel`. `repos/minibob/` shrinks from ~17k LOC to ~200 LOC
  CLI shell.

## Out of scope

- **ZK-attested cross-vessel traces** — covered by sibling
  `2026-05-23-zk-trace-attestations` (H6 in the security-hardening
  framework). Today's substrate runs all vessels under shared trust root
  (identity-vessel as authority); ZK becomes load-bearing only when vessels
  span trust boundaries (e.g., post-lift vessel federation). The two specs
  are coordinated but independent: substrate-explicit-vessels can land
  without H6, and H6 can land without further changes to substrate-explicit-vessels.
- **Vessel federation across substrates** — a separate
  `2026-05-23-vessel-federation` change exists; explicit-vessels is its
  precondition (you cannot federate implicit vessels) but federation is
  not in scope here.
- **Removing the minibob daemon mode entirely** — staged extraction (Step 7)
  is captured in tasks.md but not gated on this change's completion. The
  CLI surface is preserved.
