# proxy-resolver-reactive-registration

## Purpose

Replace goal-host-vessel's one-shot startup proxy registration with a reactive subscription to `vessel.registered` events on the substrate bus. Dissolves F-129 (proxy registration race when goal-host restarts before dev-vessel finishes booting) and establishes the pattern any future proxy-hosting vessel can follow.

## Contract

### Behaviour on startup

1. Goal-host-vessel starts. It calls the existing `registerDevVesselProxies()` function. If dev-vessel is up, proxies register normally. If dev-vessel is down, the function returns without registering any proxies and logs a single warning (no longer terminal).
2. Goal-host then opens a WebSocket client to `${ACTIVITY_API_ENDPOINT}/ws` and performs the handshake (`{type:"authenticate", token: METABOB_API_KEY}`).
3. The subscriber registers a handler for events where `type === "vessel.registered"`.

### Behaviour on event

When `vessel.registered` arrives:

1. If `data.vessel_id !== DEV_VESSEL_ID` (the dev-vessel identity goal-host proxies for), ignore.
2. Otherwise, debounce by 500ms — multiple rapid registrations (e.g. flapping dev-vessel) coalesce into one re-fetch.
3. After the debounce, call `registerDevVesselProxies()`. The function:
   a. Fetches `${DEV_VESSEL_ENDPOINT}/shapes`.
   b. Diffs the returned shape list against the currently-registered proxy set.
   c. Registers proxies for each NEW shape. Existing proxies are left alone (idempotent re-registration is also acceptable but unnecessary).
   d. Logs the diff (shape count before, after, newly added).

### Behaviour on reconnect

The WS client implements exponential backoff (1s → 30s) per the existing concept-db `ExecutionObserver` pattern. On reconnect, the subscriber:

1. Re-completes the auth handshake.
2. Immediately calls `registerDevVesselProxies()` once to catch up on any registrations that occurred while disconnected.

This makes the subscriber's eventual consistency window equal to the WS reconnection interval, not unbounded.

### Behaviour on vessel.expired

Goal-host does NOT remove proxies when it sees `vessel.expired` for `DEV_VESSEL_ID`. Rationale: an expired vessel is more likely transient (restart, network blip) than permanent. Removing proxies would cause goals routed through them to fail with `resolver not registered`. Keeping proxies registered lets the next call attempt fail at HTTP-call time with a cleaner "connection refused" error that reflects the actual state.

If dev-vessel comes back up, a new `vessel.registered` fires and the re-fetch path picks up any shape changes. If dev-vessel does not return, operator intervention restores it; on restart goal-host re-fetches anyway.

### Behaviour for other proxied vessels (forward compat)

The current implementation only proxies `development-vessel`. Future expansion to proxy other vessels follows the same pattern:

1. Maintain a configured list of proxy-target vessel IDs.
2. On `vessel.registered` event, check `data.vessel_id` against the list.
3. If match, debounce + re-fetch `/shapes` for that specific vessel.

This spec defines the pattern for `development-vessel`; extending to additional vessels is mechanical.

## Non-requirements

- No proactive vessel discovery. Goal-host does not enumerate all known vessels and try to proxy each one. The proxy-target list is explicit.
- No retry on registration failure inside the event handler. If `/shapes` is unreachable during the re-fetch, log and bail — the next `vessel.heartbeat` event (if subscriber also handles that) or the next reconnect-driven catchup will retry.
- No backpressure handling. If `vessel.registered` events arrive faster than the debounce window can clear, the debounce extends; this is the standard `setTimeout` reset pattern.

## Scenarios

### S1: F-129 baseline (the race)

```
T+0s   operator: systemctl restart development-vessel goal-host-vessel
T+0.1s goal-host starts, opens WS connection
T+1.0s goal-host calls registerDevVesselProxies()
       → dev-vessel /shapes returns ECONNREFUSED (still booting)
       → logs warning, registers 0 proxies, continues
T+1.1s goal-host WS handshake completes, subscriber active
T+3.0s dev-vessel finishes booting, registers with discovery-vessel
T+3.1s discovery-vessel emits vessel.registered for development-vessel-local
T+3.6s goal-host subscriber debounce fires (500ms after event)
T+3.7s registerDevVesselProxies() succeeds, 30 proxies registered
T+3.8s any pending boredom goal proceeds normally
```

Before this spec, T+1.0s would be terminal: 0 proxies, all subsequent dev-vessel goals fail until manual goal-host restart.

### S2: Hot-reload of dev-vessel

```
T+0s    operator: systemctl restart development-vessel
T+0.1s  dev-vessel deregisters (graceful) → vessel.deregistered fires
T+0.2s  goal-host subscriber sees vessel.deregistered → no action (proxies stay)
T+3.0s  dev-vessel re-registers → vessel.registered fires
T+3.5s  goal-host re-fetches /shapes, registers any new proxies (idempotent for existing)
```

If dev-vessel's shape list changed between versions (e.g. added a new resolver), the new shape is automatically picked up.

### S3: Activity-api WS outage

```
T+0s   activity-api restarts
T+1s   goal-host WS subscriber sees disconnect
T+1s   exponential backoff begins (1s, 2s, 4s, ...)
T+8s   activity-api back up, reconnect succeeds, handshake completes
T+8.1s subscriber immediately calls registerDevVesselProxies() (catchup)
T+8.5s any registrations that occurred during outage are reflected
```

Events emitted during the outage are not replayed by the broadcaster. The subscriber's immediate catchup re-fetch handles the gap.

## Implementation pointers

- Existing one-shot logic: `repos/goal-host-vessel/src/index.ts` around line 190 (the `try { fetch(...)/shapes ... }` block). Refactor into a named `registerDevVesselProxies(): Promise<{ added: string[], total: number }>`.
- WS subscriber: copy the structure from `repos/concept-db/src/services/execution-observer.ts` (handshake, reconnect, swallow-and-log handlers).
- Currently-registered shape set: maintain a `Set<string>` keyed on the qualified resolver id (e.g. `development-vessel:coverage_tick`) at goal-host-startup scope.
- Debounce: standard `let timer: Timer | null = null; clearTimeout(timer); timer = setTimeout(fn, 500);`.
