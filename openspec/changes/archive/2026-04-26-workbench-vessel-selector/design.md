## Context

The workbench trajectory editor (`TrajectoryEditorPage.tsx`) currently submits goals via `GoalSubmissionPanel`, which hard-codes a single `POST /v2/impulses/resolve` call routed through the workbench's `api-client` (base URL: `VITE_ACTIVITY_API_URL`). This couples all execution to the activity-api proxy rather than letting the user target a specific MiniBob vessel directly.

Discovery-vessel already returns a full vessel registry via `POST /resolve { pointer: { type: "vesselRegistry" } }` and exposes per-vessel metadata including `endpoint`, `resolve_endpoint`, `shapes`, and `health`. MiniBob advertises the `goalExecution` shape at registration. The workbench has `VITE_DISCOVERY_ENDPOINT` in its env example but nothing consumes it today.

The trajectory store (`trajectoryStore.ts`) uses Zustand with localStorage persistence (v2 schema). The `ImpulseStatePanel` already has a `realizedImpulseIds` prop path from `useTrajectoryExecution`. MiniBob's HTTP server is a simple `Bun.serve` fetch handler with a series of `if`-branch routes; it has no `/impulses` read endpoint today.

## Goals / Non-Goals

**Goals:**
- Let the user see all executor vessels online (via discovery-vessel registry)
- Let the user select one executor and route goal execution to it directly
- Show live impulse state from the selected vessel in the sidebar
- Display per-vessel Thompson α/β scores so the user can make an informed choice
- Add a read-only `GET /impulses` endpoint to MiniBob for introspection

**Non-Goals:**
- Modifying discovery-vessel itself (read-only consumer)
- Implementing vessel orchestration / load balancing (user picks manually)
- Adding write operations to MiniBob's impulse store via the HTTP API
- Migrating the workbench's other pages (ExecutionsPage, TemplatesPage) to the vessel-aware flow
- Authentication between the workbench and the selected MiniBob vessel (relies on the same `ApiKey` the workbench already uses)

## Decisions

### D1: Query discovery-vessel directly from the workbench, not via activity-api proxy

**Decision:** `useVesselRegistry` calls `VITE_DISCOVERY_ENDPOINT + "/resolve"` directly using a raw `fetch` (not the workbench `api-client` which is wired to activity-api).

**Rationale:** The workbench already has `VITE_DISCOVERY_ENDPOINT` in `.env.example`. Routing through activity-api would add a proxy hop and couple two separate concerns. Discovery-vessel is publicly addressable; its `/resolve` endpoint requires no authentication beyond what's already available.

**Alternative considered:** Add a `/v2/vessels` proxy endpoint to activity-api (the legacy `/v2/vessels/*` path is already deprecated). Rejected because it adds surface area to a path being wound down.

### D2: Store selected vessel in Zustand trajectory store, persisted to localStorage v2

**Decision:** Add `selectedVesselId`, `selectedVesselEndpoint`, and `vesselScores` directly to `TrajectoryState` with `selectVessel` / `recordVesselOutcome` actions.

**Rationale:** Vessel selection is session-level state tightly coupled to the trajectory (a trajectory is meant to run on a specific executor). Co-locating it with the trajectory makes save/restore coherent. Persisting it means the user's last-used vessel survives a page refresh.

**Alternative considered:** Keep vessel selection in a separate React context or Zustand slice. Rejected because it would fragment the localStorage save/restore logic and require passing vessel state through additional prop chains.

### D3: GoalSubmissionPanel reads selectedVesselEndpoint from the store; fallback with toast warning

**Decision:** `GoalSubmissionPanel` calls `useTrajectoryStore` to read `selectedVesselEndpoint`. If set, it POSTs to `${selectedVesselEndpoint}/v2/impulses/resolve`. If null, it falls back to the existing behavior (current base URL path) and shows a warning toast.

**Rationale:** Minimal change to `GoalSubmissionPanel`'s existing flow. The fallback preserves backward compatibility for users who haven't set up discovery-vessel. Toast (shadcn `useToast`) is already available in the workbench.

**Alternative considered:** Disable submission entirely when no vessel is selected. Rejected because it would break existing usage where the activity-api proxy handles routing.

### D4: MiniBob `GET /impulses` returns a lightweight summary list, not full content

**Decision:** The response is `{ impulses: Array<{ id: string, shape: string, pointer_type: string, loaded: boolean, summary: string | null }> }`. Full pointer data and resolved content are not included.

**Rationale:** Content can be large (full file reads). The workbench needs only metadata to render shape badges in the sidebar. This aligns with the metadata-first principle.

**Alternative considered:** Return full `Impulse` objects. Rejected due to payload size and the risk of leaking sensitive resolved content (e.g., environment files) across the network to a browser.

### D5: ImpulseStatePanel subscribes to selected vessel WS for `impulse:created` only; polls GET /impulses for snapshot

**Decision:** On vessel selection, open a new `useWebSocket` connection to `${selectedVesselEndpoint}/ws`. Listen for `{ type: "impulse:created", impulse: { id, metadata: { shape }, pointer: { type } } }` events. Poll `GET /impulses` every 10 s for the initial and refresh snapshot. Display accumulated shapes in a new "Vessel State" collapsible section inside `ImpulseStatePanel`.

**Rationale:** WS gives live additions; the polling snapshot handles the case where WS was disconnected or the user connected mid-execution. Augmenting `ImpulseStatePanel` rather than creating a standalone panel avoids adding another collapsible sidebar panel to an already dense layout.

**Alternative considered:** Use only WS (no polling). Rejected because the first connection will miss any impulses already in the store from before the workbench connected.

### D6: vesselScores persisted as plain object in localStorage (not a Map)

**Decision:** `vesselScores` is stored as `Record<string, { alpha: number, beta: number }>` in the state, serialized as a plain JSON object in localStorage. Zustand state exposes a Map-like getter/setter but the underlying store value is a plain object.

**Rationale:** `Map` is not JSON-serializable. Zustand's built-in `JSON.stringify` in `saveToLocalStorage` must work without a custom replacer. Plain object is simpler and sufficient given the expected O(10) vessels.

## Risks / Trade-offs

- **Discovery-vessel unavailable** → `useVesselRegistry` returns an empty list. `VesselSelectorPanel` shows "No executor vessels online" message. GoalSubmissionPanel falls back gracefully. No crash path.
- **CORS on direct vessel calls** → MiniBob must return `Access-Control-Allow-Origin` headers for workbench origin. MiniBob already serves CORS on `POST /v2/impulses/resolve`; `GET /impulses` must do the same.
- **Selected vessel goes offline between selection and submission** → GoalSubmissionPanel's existing `classifyError` will catch the network failure and render the `vessel-offline` error variant (new kind added).
- **impulse:created WS event shape assumption** → MiniBob already broadcasts `impulse:created` via `broadcastImpulseCreated`. If the payload shape differs from `{ type, impulse }`, the panel degrades silently (shows only polled shapes). Not a hard failure.
- **localStorage bloat from vesselScores** → Bounded by number of distinct vessels; each entry is ~40 bytes. Not a concern.

## Migration Plan

1. Deploy MiniBob changes (add `GET /impulses`) — backward compatible; no existing route affected.
2. Deploy workbench changes — additive to store, new component, updated panel. Existing trajectories in localStorage deserialize cleanly; new fields default to `null` / `{}`.
3. No rollback complexity: all changes are additive. Reverting either side independently is safe.

## Open Questions

- Does the workbench need to send its `ApiKey` to MiniBob's `GET /impulses` endpoint? MiniBob currently has no auth guard on its introspection routes (`/health`, `/status`, `/manifest`). For consistency with those, `GET /impulses` can be unauthenticated in the first iteration, with auth added when MiniBob's auth story solidifies.
- Should `VesselSelectorPanel` auto-select the single vessel when exactly one is online? Deferred — the user should make an explicit choice to avoid surprising auto-routing.
