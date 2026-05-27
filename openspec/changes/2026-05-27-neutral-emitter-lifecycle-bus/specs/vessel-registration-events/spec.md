# vessel-registration-events

## Purpose

Publish discovery-vessel registration mutations onto the substrate event bus so consumers can react to topology changes without polling. This is the architectural antidote to coupling like F-129, where goal-host's one-shot fetch of `/shapes` at startup races dev-vessel boot and lands zero proxies.

## Contract

### Event types

Discovery-vessel publishes four event types via `POST /v2/events/publish` on activity-api:

| Event type | When emitted | data fields |
|---|---|---|
| `vessel.registered` | After a successful `register()` call adds a new entry to the in-memory registry | `{ vessel_id, shapes: string[], resolve_endpoint, resolve_request_format, auth_scheme, ttl_seconds }` |
| `vessel.heartbeat` | After a successful `heartbeat()` refreshes a vessel's TTL | `{ vessel_id, ttl_seconds, shapes_count }` |
| `vessel.deregistered` | After a successful explicit `deregister()` (e.g. graceful shutdown) | `{ vessel_id, reason: "explicit" }` |
| `vessel.expired` | When the cleanup loop removes a vessel whose TTL elapsed | `{ vessel_id, last_heartbeat_ms, ttl_seconds, reason: "ttl_expired" }` |

All four use `scope: "broadcast"` — topology is substrate-public.

### Emit semantics

Each registry mutation is the canonical persistence operation; the event publish is a fire-and-forget follow-up:

1. The mutation (insert / update / delete in the in-memory registry) happens first and unconditionally.
2. The HTTP POST to `/v2/events/publish` is issued without `await`. Failure does not roll back the mutation.
3. HTTP timeout: 2 seconds. Failures logged at `warn` level once per startup window (rate-limited to avoid log spam during an activity-api outage).

This ensures registration events never block a vessel from registering. Topology integrity lives in the registry; the bus is a notification layer.

### Idempotency

Each event represents a single mutation. Re-emitting the same event with the same `vessel_id` and timestamp would be a duplicate; consumers MAY deduplicate using `(type, vessel_id, timestamp)` if they care, but the producer makes no effort to suppress duplicates. In practice mutations are not retried, so duplicates only arise if the producer is misconfigured.

### Configuration

Discovery-vessel reads `ACTIVITY_API_ENDPOINT` (existing env). If unset, the events feature is disabled and a single log line `[discovery-vessel] event bus disabled (ACTIVITY_API_ENDPOINT unset)` is written at startup. Otherwise events are emitted by default.

API-key auth uses the existing `METABOB_API_KEY` env variable.

## Behaviour

### Lifecycle of a registration sequence

1. Vessel `acme-vessel` POSTs to discovery-vessel `/register` with its shapes and resolver contract.
2. Discovery-vessel inserts the entry into its in-memory registry.
3. Discovery-vessel POSTs `vessel.registered` to activity-api `/v2/events/publish`.
4. Activity-api's WS broadcaster fans the event to all connected subscribers.
5. Goal-host-vessel (subscribed) sees `data.vessel_id === "development-vessel-local"`, debounces, fetches `/shapes`, and registers proxy resolvers for any new shapes.
6. Concept-db (subscribed, hypothetical future use) records the registration in its concept graph as a `vessel` concept with edges to each advertised shape.

### Lifecycle of TTL expiry

1. A vessel stops heartbeating (e.g. crashed or shut down ungracefully).
2. Discovery-vessel's cleanup loop fires (60s default cadence).
3. Loop detects TTL elapsed on the vessel's entry.
4. Loop removes the entry from the registry.
5. Loop emits `vessel.expired` to the bus.
6. Subscribers (audit-vessel, dashboards) record the deregistration. Goal-host MAY remove proxies for the expired vessel; this implementation chooses NOT to (proxies stay registered to surface a clearer error at call time).

### Authentication boundary

Discovery-vessel's existing `/register`, `/heartbeat`, `/deregister` endpoints require API-key authentication (per `repos/discovery-vessel/src/index.ts`). Events ride that same boundary: a successful authenticated mutation produces an authenticated event. Discovery-vessel publishes with its own service API key (`METABOB_API_KEY`), not the caller's, so the event chain is end-to-end traceable to discovery-vessel as `source_vessel_id`.

## Non-requirements

- No event log retention. WS reconnects don't see past events. Consumers re-derive state from `/resolve` queries on reconnect.
- No partial-failure semantics. If the registry mutation succeeds but the event POST fails, the registry is correct and the bus is stale; consumers will see the vessel via `/resolve` queries and self-correct on next subscribe.
- No fan-out beyond activity-api. Discovery-vessel publishes once; activity-api fans out.

## Scenarios

### S1: F-129 dissolution

Operator restarts goal-host while dev-vessel is still booting. Goal-host's initial `/shapes` fetch fails. Without this spec, goal-host stays at zero proxies until manual restart. With this spec:

1. Goal-host's WS subscriber is connected (handshake completed on its own boot).
2. Dev-vessel finishes booting and registers with discovery-vessel.
3. Discovery-vessel emits `vessel.registered` with `vessel_id="development-vessel-local"`.
4. Goal-host's subscriber sees the event, debounces 500ms, calls `registerDevVesselProxies()`.
5. Proxies are registered within ~6 seconds of dev-vessel coming up.

### S2: vessel hot-reload

A vessel restarts (e.g. operator deploys an update). Its existing registration is still present in the registry. On re-register, discovery-vessel emits `vessel.registered` again. Subscribers re-react idempotently. This is the expected path for hot-reload sequences.

### S3: activity-api outage

Activity-api goes down for 30 seconds. Discovery-vessel's event publishes all fail. The registry continues to accept mutations normally. When activity-api comes back, subsequent events flow. Events emitted during the outage are lost; subscribers reconnecting see the current registry state via `/resolve` (the canonical source of truth) and continue.

## Implementation pointers

- Mutation paths: `repos/discovery-vessel/src/registry.ts` `register()`, `heartbeat()`, `deregister()`, plus the TTL-cleanup loop.
- HTTP client: minimal `fetch()` with timeout via `AbortSignal.timeout(2000)`.
- Logging: rate-limited via a startup-scoped counter so each new outage period logs once.
