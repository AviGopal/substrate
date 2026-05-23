# Capability: vessel-daemon-toolkit

## Definition

`@avigopal/ias-executor-ts` exposes a vessel-daemon toolkit consisting of
four primary exports usable by any substrate-hosted vessel to compose its
HTTP surface, discovery registration, and resolver dispatch with minimal
boilerplate.

## Exports

### `VesselDaemon`

```typescript
class VesselDaemon {
  constructor(opts: {
    vesselId: string;
    port: number;
    discoveryEndpoint: string;
    identityApiKey: string;
    executor: ActivityExecutor;
    subscriber?: LifecycleSubscriberVessel;
    resolvers: Map<string, Resolver>;  // shape → resolver
    advertisedShapes: ShapeAdvertisement[];
  });

  async start(): Promise<void>;
  async stop(): Promise<void>;
}
```

Routes:
- `POST /resolve { pointer: { type, ... } }` — dispatches to the resolver
  bound to `pointer.type`.
- `POST /run-goal { goal, parent_execution_id?, composition_chain?, options? }`
  — runs a goal via the wrapped executor.
- `GET /health` — returns `{ status: 'ok', vessel_id, uptime_s }`.

Cross-vessel composition-chain handling: any non-root invocation carrying
an `X-Caller-Vessel` header MUST also carry `parent_execution_id`. Missing
→ 400 + a `verifier_negative` self-trace.

### `ResolverServer`

```typescript
class ResolverServer {
  constructor(resolvers: Map<string, Resolver>);
  router(): Hono;
}
```

Hono router that binds resolver ids to pointer-typed `POST /resolve` routes.
Internal to `VesselDaemon`; exposed separately for vessels that need custom
HTTP composition.

### `DiscoveryRegistrationLoop`

```typescript
class DiscoveryRegistrationLoop {
  constructor(opts: {
    discoveryEndpoint: string;
    identityApiKey: string;
    vesselId: string;
    resolveEndpoint: string;
    advertisedShapes: ShapeAdvertisement[];
    heartbeatIntervalMs?: number;  // default 60000
  });

  async start(): Promise<void>;
  async stop(): Promise<void>;
  onUnhealthy(callback: () => void): void;
}
```

Registers on startup, heartbeats every 60s, deregisters on `stop()` /
SIGTERM. Replaces the copy-pasted registration code currently in
activity-api, identity-vessel, concept-db, conversation-vessel,
discovery-vessel, and development-vessel.

### `GoalHost` (relocated)

Moved from `src/examples/goal-host.ts` to `src/hosts/goal-host.ts`. The
class itself is unchanged; only the import path moves. A deprecated
re-export remains at the old path for one release.

## Acceptance

- A vessel implemented using `VesselDaemon` is ≤100 LOC of glue
  (verified by the `src/hosts/__example__/minimal-vessel.ts` example).
- All six new substrate vessels (per `substrate-explicit-vessels/spec.md`)
  use `VesselDaemon`.
- All six pre-existing vessels (activity-api, identity-vessel, concept-db,
  conversation-vessel, discovery-vessel, development-vessel) replace their
  hand-written registration code with `DiscoveryRegistrationLoop`. (This
  migration is in scope for tasks 0.4+, not gated on this change's other
  phases.)
- `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` references
  `VesselDaemon` as the canonical starting point.
