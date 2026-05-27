## 1. Activity-api: publish endpoint

- [ ] 1.1 Create `repos/metabob-activity-api/src/routes/events.ts`. `POST /v2/events/publish` accepts `{ type: string, source_vessel_id?: string, scope?: "broadcast" | "org" | "session", target?: string, data: object }`. Validates type matches `^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$` (`<source>.<noun>.<verb>` form).
- [ ] 1.2 Default scope is `"broadcast"` → calls `broadcaster.emit({ type, timestamp: Date.now(), source_vessel_id, ...data })`. `"org"` → `emitToOrg(message, target=orgId from JWT)`. `"session"` → `emitToSession(message, target=sessionId from body)`.
- [ ] 1.3 Mount route at `repos/metabob-activity-api/src/index.ts` after auth middleware. Returns `{ accepted: true, ts: number }`. Never throws — broadcaster failures logged and swallowed (lifecycle is best-effort).
- [ ] 1.4 Add test `repos/metabob-activity-api/src/routes/events.test.ts`: (a) valid type publishes; (b) malformed type returns 400; (c) broadcaster failure does NOT propagate; (d) `org` scope requires JWT orgId; (e) emitter receives the wrapped message via subscribed client.
- [ ] 1.5 `bun run typecheck` and `bun test` in `repos/metabob-activity-api` — zero new errors.

## 2. ias-executor-ts: bus forwarder

- [ ] 2.1 Add `BusForwardingEventSink` adapter in `repos/ias-executor-ts/src/adapters/bus-forwarder.ts`. Wraps an inner `EventSink` and forwards every emit to `POST {activityApiEndpoint}/v2/events/publish` with `type` mapped from the lifecycle event name (`lifecycle:task:preBinding` → `lifecycle.task.pre_binding`). The inner sink still receives the event synchronously.
- [ ] 2.2 Mapping rule: replace `:` with `.`, camelCase to snake_case. Document in adapter doc comment. Include `source_vessel_id` from constructor option.
- [ ] 2.3 Forwarding is fire-and-forget: no `await`, no retry, errors logged via `console.warn` only. HTTP timeout 2s. Lifecycle events must not block engine progression.
- [ ] 2.4 Add unit test `repos/ias-executor-ts/test/adapters/bus-forwarder.test.ts`: (a) wraps inner sink; (b) emits both inner-sink and POST; (c) POST failure does not throw; (d) name mapping `lifecycle:task:preBinding` → `lifecycle.task.pre_binding`.
- [ ] 2.5 Export from `repos/ias-executor-ts/src/adapters/index.ts`.

## 3. Goal-host: wire forwarder + reactive registration

- [ ] 3.1 In `repos/goal-host-vessel/src/index.ts` startup, construct `BusForwardingEventSink` wrapping the existing eventSink with `activityApiEndpoint=ACTIVITY_API_ENDPOINT`, `sourceVesselId="goal-host-vessel"`. Pass to GoalHost.
- [ ] 3.2 Add WS subscriber `repos/goal-host-vessel/src/observers/vessel-registration-observer.ts` (or inline in `index.ts` if small enough). Connects to `${ACTIVITY_API_ENDPOINT}/ws`, handshake `{type:"authenticate",token:METABOB_API_KEY}`. On `vessel.registered` with `data.vessel_id === DEV_VESSEL_ID`, debounce 500ms then call the existing `registerDevVesselProxies()` logic.
- [ ] 3.3 Refactor the one-shot startup `registerDevVesselProxies()` into a named, idempotent function. Initial call at startup stays; the subscriber calls it again on registration events. Track currently-registered shape ids in a Set so the function diffs against `/shapes` and only registers new ones.
- [ ] 3.4 Reconnection: exponential backoff 1s → 30s. On reconnect, immediately call `registerDevVesselProxies()` once to catch up on anything registered while disconnected.
- [ ] 3.5 Add a smoke test (manual or scripted): kill dev-vessel, kill goal-host, start goal-host (expect zero proxies registered), start dev-vessel (expect goal-host to register proxies within 5s of dev-vessel's registration completing).
- [ ] 3.6 Update goal-host's README / inline docs to note that proxy registration is reactive, not one-shot.

## 4. Discovery-vessel: emit registration events

- [ ] 4.1 In `repos/discovery-vessel/src/registry.ts`, after successful `register()`, POST `vessel.registered` to `/v2/events/publish` with data `{ vessel_id, shapes, resolve_endpoint, ttl_seconds }`. Fire-and-forget; failures logged only.
- [ ] 4.2 Same pattern for `heartbeat()` → `vessel.heartbeat` with `{ vessel_id }`.
- [ ] 4.3 Same pattern for `deregister()` → `vessel.deregistered` with `{ vessel_id, reason: "explicit" }`.
- [ ] 4.4 TTL-expiry path (currently in the cleanup loop): emit `vessel.expired` with `{ vessel_id, last_heartbeat, ttl_seconds }`.
- [ ] 4.5 Configuration: `ACTIVITY_API_ENDPOINT` (existing env). If unset or unreachable, skip emit and log once per startup.
- [ ] 4.6 Test `repos/discovery-vessel/test/registry-events.test.ts`: each of register / heartbeat / deregister / expire fires one POST with correct type+data; HTTP failure does not break the underlying registry mutation.

## 5. Documentation

- [ ] 5.1 Update `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` to add a "Substrate event bus" subsection in the vessels section. Document the event taxonomy and `<source>.<noun>.<verb>` naming convention.
- [ ] 5.2 Update root `CLAUDE.md` §3 (Endpoints) — add `POST /v2/events/publish` to the activity-api endpoint list.
- [ ] 5.3 Update `repos/concept-db/CLAUDE.md` to note that `lifecycle.task.*` and `vessel.*` events are now available on the same WS bus it already subscribes to, enabling subscription patterns beyond `task.completed`.
- [ ] 5.4 Cross-link the spec from `validation/state/agent-coordination.json` `open_gates` once the change lands.

## 6. Verification gates

- [ ] 6.1 End-to-end smoke (manual): on a fresh substrate-live, kill goal-host while dev-vessel is up — restart goal-host — confirm proxies register reactively from `vessel.heartbeat` (or `vessel.registered` if the timing catches it). Confirm probe-reachable-unlearned still dispatches end-to-end.
- [ ] 6.2 Audit-channel acknowledgment: file a dev-investigation acknowledging iter008 investigation-026 #3 partially closed (`lifecycle.task.*` now broadcast) and #4 closed (consumer-coupling dissolved). Note that concept-db internal events remain as future-work.
- [ ] 6.3 F-129 closed: re-trigger the original race scenario (restart goal-host before dev-vessel finishes booting), confirm the proxies eventually register without operator intervention.

## 7. Out-of-scope follow-ups (track but do not block)

- [ ] 7.1 Migrate concept-db's internal EventEmitter (`repos/concept-db/src/lifecycle/dispatcher.ts:34-97`) to publish onto the bus. Iter008 finding #3 full closure.
- [ ] 7.2 Replace goal-host's WS-on-startup with a shared substrate-wide subscriber library so future vessels (audit-vessel, analyzer-vessel) don't reinvent reconnection logic.
- [ ] 7.3 Per-event-type schema validation at publish time.
