## Context

`VesselDaemon.emitResolveTrace` (added 2026-05-28 in `repos/ias-executor-ts/src/hosts/vessel-daemon.ts`) emits a `task.completed` event with `data.source = "vessel_daemon_resolve"` after every successful `POST /resolve` hit on a substrate vessel. This event reaches activity-api's WS broadcaster via `POST /v2/events/publish`. concept-db's `ExecutionObserver` (`repos/concept-db/src/services/execution-observer.ts`) is subscribed to that same WS.

But concept-db's `extractConceptRefs` filter accepts only `concept:`-prefixed `impulse_id` or explicit `concept_id`. Analysis-vessel emissions don't carry either signal because the vessel-daemon mints a generic `impulse:<pointerType>:<ts>` id and the resolver result's `shape` is the analysis shape, not `"concept"`. So every event traverses the bus, the observer dispatches into `extractConceptRefs`, and the filter correctly returns the empty set.

The clean fix is to add concept-mint signaling *upstream* of the filter: a thin TS observer in dev-vessel that, on the filtered subset of events the operator considers concept-derivable, mints a signature concept in concept-db and records usage against it. The observer makes no decisions about *which symbols* are concepts inside a payload — it mints one concept per resolver-shape (e.g. one `problem_detection` concept whose usage count rises with every problem-detection run). Per-symbol concept extraction is correctly an *activity* concern (orchestration / LLM-tier decisions), not an observer concern, and is deferred to Part B.

## Goals

- Close the gap with minimum new vocabulary: no new shapes, no new resolver, no schema change.
- Keep the change reversible: when Part B's substrate-authored activity selects in Thompson, deprecate this observer cleanly.
- Make the deferral structure load-bearing: an explicit pointer to the dependencies the substrate needs to autonomously author Part B's adapter.

## Non-Goals

- Replacing concept-db's `extractConceptRefs` filter. Broadening it would conflate "is a concept" with "is concept-derivable" — concept-db has no way to discriminate which symbols inside a `problem_detection` payload are concepts worth tracking vs ephemeral mentions.
- Solving concept-db's runtime SurrealDB IAM rejection (`finding_2026_05_28_concept_db_root_signin_blocked`). That's a pre-existing bug surfaced by this bridge but separately scoped.
- Building the substrate-authored Part B activity now. The lift evaluation is *whether the substrate can author a sibling adapter when its dependencies ship* — pre-building Part B would defeat the test.

## Decisions

### Place the observer in dev-vessel, not in a new vessel

Per `repos/development-vessel/CLAUDE.md` §"Three-layer discipline", dev-vessel is the canonical home for "deterministic resolvers, no business decisions." A WS subscriber that filters by event type and dispatches HTTP calls qualifies — there are no business decisions in the filter, only the literal `BRIDGEABLE_SHAPES` set. Creating a new vessel for this would inflate the substrate's vessel count without adding capability separation.

### Mint by signature, not by symbol

The observer calls `POST /concepts/upsert-by-signature` with `{pointer_type: shape, shape}` — one concept per analysis shape. This is the deliberately-cheap shape. Per-symbol concept minting (where `buildProxyResolver` and `registerBuiltinResolvers` from a `problem_detection` payload would each become a concept linked to a parent rule concept) is richer, requires extraction logic the observer should not contain, and is the kind of decomposition an LLM-tier resolver inside a substrate-authored activity is appropriate for. Deferring to Part B keeps the layering clean.

### Bridgeable-shape literal vs config

`BRIDGEABLE_SHAPES` is a `const Set` literal in the observer file rather than env-configurable. Per dev-vessel's discipline, the "policy" of which shapes are concept-derivable should be auditable as static code. If the set needs to change, the change ships as a normal commit subject to review — not a runtime config flip.

### Fire-and-forget, no retries

Every dispatch is `Promise.catch().error`. concept-db unavailability does not block the WS event loop. Lost dispatches are acceptable — the next `task.completed` event for the same shape will mint a new usage record. Idempotency is the server's responsibility (upsert-by-signature is idempotent server-side; usage is monotonically incrementing).

## Alternatives Considered

### A. Broaden concept-db's `extractConceptRefs` filter

Considered and rejected. Filter expansion would mean concept-db decides which symbols in a `problem_detection` payload are concepts — a decision that belongs upstream, where the producer's semantics are knowable. Filter broadening also couples concept-db to every new vessel that ever emits a non-concept shape it should observe. The filter stays narrow; bridges proliferate at the producer side as needed.

### B. Add `conceptMintHook` to `VesselDaemonConfig`

Considered. Would let each vessel (analysis-vessel, future vessels) supply its own concept-mint function executed inline in `emitResolveTrace`. Cleaner than option A because the producer knows its semantics. Rejected because it puts concept-db-specific knowledge in `ias-executor-ts` library code (cross-cutting coupling) and because the per-vessel hook would each have to handle its own auth, retries, and failure semantics duplicatively.

### C. The path chosen — observer in dev-vessel

Centralizes the bridging policy in one place, keeps `ias-executor-ts` generic, doesn't couple concept-db to every producer's payload schema. Bridge code is one file (~190 LOC). Cost: an extra WS connection per dev-vessel start, negligible.

### D. Substrate-authored activity now (skip C)

Considered briefly. Rejected because the substrate cannot author this activity today (autonomous palette excludes `concept_create_write`; `substrateGap_write` has no consumer; `lifecycle.gap.classified` doesn't reach the WS). Pre-building it would mean operator-authored code in seed templates pretending to be substrate-authored. The S2 test is whether the substrate authors the next one autonomously, not whether this one exists.

## Open Questions

- **(Closes when Task 2.1–2.3 resolve.)** Does `concept-db`'s runtime SurrealDB JS client need `{namespace, database, username, password}` for root scope in 2.0.2? Or is the apply-schema path (which works) using a different connection wrapper?
- **(Closes when Task 3.4 resolves.)** Does `harness-run-matrix` accept a synthetic in-memory scenario as well as a filesystem path? If not, what minimal change to its template makes it accept either?
- **(Open until Part B ships.)** What's the right `activity_signature` shape for `output_shapes_must_include` when the desired output is a sequence of concept writes followed by usage records, not a single output shape?
