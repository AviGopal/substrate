## Why

The substrate has lifecycle events that emit *somewhere* but cannot be subscribed to from any other vessel. This is the consumer-coupling defect identified in iter008 audit investigation-026 (2026-05-27) and reproduced concretely by F-129 (2026-05-27, dev investigation-051):

1. **`ias-executor-ts` engine events** — `lifecycle:task:preBinding`, `lifecycle:execution:succeeded`, `lifecycle:gap:classified`, `lifecycle:llm:dispatched` fire on the in-process `eventSink` only. They reach the workbench through a separate WS overlay path, but no other vessel (concept-db, ribosome, future analyzers) can subscribe.
2. **`discovery-vessel` registration changes** — when a vessel registers, heartbeats, or expires, no event fires onto any channel. Consumers must poll `/shapes` to detect change. `goal-host-vessel` does this once at startup; if it restarts while a dependency is still booting, zero proxy resolvers register and every dev-vessel goal silently fails (F-129).
3. **`concept-db` internal events** — `concept:created`, `edge:created` fire on an in-process EventEmitter (`repos/concept-db/src/lifecycle/dispatcher.ts:34-97`) with no broadcast transport.

The neutral-emitter principle: **emitters broadcast neutrally; consumers register the hooks they need.** No event is "for" a specific consumer. The architectural fix is to put every lifecycle event on a single substrate-wide broadcast channel so any vessel can subscribe.

The infrastructure already exists. `repos/metabob-activity-api/src/websocket/broadcaster.ts` is a working WS broadcaster with `task.started`, `task.completed`, `task.failed`, `tool.call`, `impulse.resolved` events flowing today. `concept-db` and the workbench already subscribe to it. Three classes of trapped events need to flow onto this bus.

This change is the architectural prerequisite for several recurring issues:

- **F-129** (goal-host proxy registration race): proxy registration becomes reactive when goal-host subscribes to `vessel.registered` events.
- **iter008 #3 (concept-db internal events trapped)**: events get a broadcast transport.
- **iter008 #4 (lifecycle:task:* consumer-coupled to workbench)**: events flow on the shared bus; concept-db, ribosome, future analyzers can subscribe.

## What Changes

- **Substrate event taxonomy**: define a canonical event-type vocabulary and payload shape for the three event classes above. New event types are additive — no existing types change.
- **Lifecycle events bridge (ias-executor-ts → WS bus)**: `goal-host-vessel` configures its `EventSink` to also POST published events to activity-api's `/v2/events/publish` endpoint, which forwards them via the WS broadcaster. The in-process eventSink stays — this is an additive forwarder, not a replacement.
- **Vessel registration events (discovery-vessel → WS bus)**: discovery-vessel emits `vessel.registered`, `vessel.heartbeat`, `vessel.deregistered`, `vessel.expired` events on register / heartbeat / explicit-deregister / TTL-expiry. Same WS bus.
- **Activity-api `/v2/events/publish` endpoint**: minimal forward to `broadcaster.emit()`. Auth-gated by the API key. Idempotency not required — the bus is a fire-and-forget channel.
- **Goal-host reactive proxy registration**: subscribe to `vessel.registered` events. When a vessel that the host doesn't already proxy registers, fetch its `/shapes` and register proxies for any new shape ids. When a vessel's `vessel.expired` fires, optionally remove its proxies. Replaces the one-shot startup registration that races (F-129).

## Capabilities

### New Capabilities

- **`lifecycle-events-bridge`**: ias-executor-ts engine lifecycle events flow onto the activity-api WS broadcast bus via a forwarder configured at goal-host startup. Any vessel that already subscribes to the WS bus (concept-db, ribosome, workbench) receives them.
- **`vessel-registration-events`**: discovery-vessel emits `vessel.{registered,heartbeat,deregistered,expired}` events onto the WS broadcast bus. Goal-host (and any future proxy/observer) uses this to react to topology changes rather than poll.
- **`proxy-resolver-reactive-registration`**: goal-host-vessel re-registers its dev-vessel proxy resolvers on `vessel.registered` for any vessel whose `vessel_id === DEV_VESSEL_ID`. Replaces the one-shot startup fetch with a reactive subscription. Dissolves F-129.

### Modified Capabilities

None. This change is additive at every site:
- Existing WS event types (`task.*`, `tool.call`, `impulse.resolved`) unchanged.
- Existing event payloads unchanged.
- Existing subscribers continue receiving everything they receive today.
- The new `/v2/events/publish` endpoint is new; no existing routes change.

## Impact

- `repos/metabob-activity-api/src/routes/events.ts` (new) — `POST /v2/events/publish` accepts `{ type, payload }`, calls `broadcaster.emit({ type, ...payload })`. ~30 lines + tests.
- `repos/metabob-activity-api/src/index.ts` — mount the new route.
- `repos/ias-executor-ts/src/event-bus-forwarder.ts` (new) or extend the existing `EventSink` interface — a forwarder that posts to `/v2/events/publish` on each `emit()`. ~50 lines.
- `repos/goal-host-vessel/src/index.ts`:
  - Construct the bus forwarder, pass to GoalHost's eventSink.
  - On startup, also open a WS client to activity-api and subscribe to `vessel.registered` events.
  - On receipt, if `vessel_id === DEV_VESSEL_ID` and shapes diverge from current proxy set, re-fetch `/shapes` and register new proxies.
- `repos/discovery-vessel/src/registry.ts` — add WS-publish calls on register/heartbeat/deregister/TTL-expiry. ~30 lines.
- Tests:
  - activity-api: route accepts publish, broadcaster receives event
  - ias-executor-ts: forwarder POSTs on lifecycle emit
  - goal-host-vessel: WS subscriber re-registers proxies on `vessel.registered`
  - discovery-vessel: registration paths fire the four event types
- Wire docs:
  - Update `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` to add the substrate event taxonomy.
  - Cross-link from `repos/concept-db/CLAUDE.md` (consumer pattern) and `repos/goal-host-vessel/CLAUDE.md` (if it exists) or README.

## Dependencies

- No external blockers. The activity-api WS broadcaster is operational. Concept-db already demonstrates the subscriber pattern (`repos/concept-db/src/services/execution-observer.ts`).
- Optional: future work to migrate concept-db's internal `concept:created`/`edge:created` events onto the same bus, addressing iter008 finding #3 completely. Out of scope for this change; the path is documented in the design doc.

## Non-goals

- Replacing the activity-api WS broadcaster. The existing broadcaster IS the bus.
- Multi-vessel pub/sub fan-in beyond activity-api. Every vessel publishes to one place: activity-api `/v2/events/publish`. Activity-api fans out via WS to all subscribers.
- Backpressure / event-loss handling beyond the existing WS broadcaster's. Lifecycle events are best-effort; durable trace storage continues through `/v2/activities/execution-traces`.
- Migrating concept-db's in-process EventEmitter onto the bus. Logged in design doc as future work.
- Authorization beyond "valid API key". Per-event ACLs are out of scope; the existing `emitToOrg`/`emitToSession` patterns can be extended if needed later.
