# Impulse Conformance Ledger

> **The invariant.** Every vessel-to-vessel **data-plane** exchange is a typed
> impulse: the caller resolves the target by shape via discovery and POSTs the
> typed-pointer envelope `{ "impulse": { "pointer": { "type": "<shape>", … } } }`
> to the target's **discovery-advertised** `resolve_endpoint`. The *path*
> (`/resolve` vs `/v2/impulses/resolve`) is per-vessel advertised data
> (`resolve_endpoint` in the registration contract,
> `repos/discovery-vessel/src/types.ts`), not part of the contract.
>
> **Exempt (control-plane / own-store):** discovery `register`/`heartbeat`,
> identity auth issuance/validation, `/health` probes, and a vessel accessing
> *its own* datastore.
>
> Prerequisite before migrating any seam: the **dual-parse conformance fix** —
> goal-host, concept-db, and llm-resolver `/resolve` handlers accept
> `body.impulse.pointer.*` (preferred) with legacy `body.*` fallback
> (openspec `2026-05-30-vessel-resolve-contract-conformance`).

This ledger tracks every known violation. Migration is decided **per-seam**
(audit-first): each row becomes an individually-scoped goal/openspec change
when its time comes. Audit date: 2026-07-02 (full inventory in the plan of
record; biggest seams reproduced here).

## Seam template

For each seam decide: **target shape** (existing or minted), **who moves
first** (lowest-stakes caller), **dual-serve window + retirement trigger**
(old surface stays until callers are gone), **risk**.

## Ledger

| # | Seam | Caller(s) → Callee | Target shape | Who moves first | Status |
|---|------|--------------------|--------------|-----------------|--------|
| 1 | `POST /run-goal` (bespoke REST) | boredom-vessel, dev-vessel dispatch sites, metabob-mcp → goal-host | `goal_execution` (exists on goal-host `/resolve`) | boredom-vessel (lowest stakes; watch a full boredom cycle) → dev-vessel → mcp. `run_goal_async` fire-and-forget may need a `dispatch_mode: async` param on the shape — decide before migrating mcp; don't block sync callers | **scheduled** (first migration) |
| 2 | goal-host → activity-api `recommend` / `discover-by-shapes` / `feedback` REST | goal-host → activity-api | `activityTemplateRecommendation`, `discoverByShapesQuery`, `activityFeedback_write` (all exist) | goal-host (pure caller-side change; requires the dual-parse fix first) | **scheduled** (second migration) |
| 3 | `POST /penalty` (no shape at all) | activity-api `posterior-update.ts` → relevance-sink-vessel | `impulseRelevancePenalty_write` on relevance-sink `/v2/impulses/resolve` | relevance-sink dual-serves the shape + registers it; activity-api's caller switched to the shaped resolve | **done** (relevance-sink + caller migrated; `/penalty` retained as legacy dual-serve) |
| 4 | activity-api `/ws` WebSocket events + `POST /v2/events/publish` bus | ribosome-vessel, concept-db ExecutionObserver, workbench, dashboards ← activity-api | `eventStream` read shape (cursor over the broadcaster's sequence buffer) is the poll-equivalent; the shaped-stream protocol is the live fast path | **read-side done** (`eventStream` shape live; ribosome consumes `execution_completed`). Live libp2p fan-out awaits the `/substrate/stream/1.0.0` protocol (shaped-stream design) |
| 5 | activity-api REST-only routes goal-host calls: `/v2/goal-paths`, `/v2/goal-paths/recommend`, `select-activity-for-goal`, `validate-composition` | goal-host → activity-api | mint `goalPath_write`, `goalPathRecommendation`, `activitySelection`, `compositionValidation` | activity-api adds shapes to its `/v2/impulses/resolve` dispatcher (delegating to the same handlers, like the existing 14 `*_write`s) | open |
| 6 | metabob-mcp `/v2/connections/*` lifecycle | metabob-mcp → activity-api | mint or exempt (connection lifecycle is arguably control-plane) | — | open (decide exemption) |
| 7 | Direct SurrealDB access bypassing the resolver surface | dev-vessel scan/export resolvers (`surrealdb-export.ts`, `orphaned-capability-scan.ts`, `compose-topology-tick.ts`, …), boredom-vessel → activity-api's store | route through existing read shapes or mint aggregate-read shapes | per-resolver decisions; **exempt**: identity-vessel (own store) | open |
| 8 | discovery `POST /register` + `POST /heartbeat` | every vessel → discovery | — | — | **exempt** (control-plane: registration/liveness is what makes shape-routing possible; expressing it as a shape is circular) |

## Why migrate at all

A bespoke REST hop is invisible to the learning loop. The same exchange as a
typed impulse lands in `impulse_resolutions` / trace events — resolver tier,
latency, cost, per-shape success — so Thompson selection and composition-edge
derivation can see and improve it. Verification for every migrated seam is
therefore twofold: (a) identical outcome, (b) the exchange now appears in the
trace.
