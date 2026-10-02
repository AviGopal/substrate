# One transport story: the overlay is THE transport; localhost is its degenerate case

## Why

The substrate has two transport stories today:

1. **The libp2p overlay** (`repos/libp2p-federation-transport` + `scripts/substrate/federation-relay/`): encrypted (Noise, end-to-end through the relay), peer-ID-authenticated (Ed25519 identity seeded deterministically from `vesselId`, so `peerId` IS the vessel's federation identity — SUBSTRATE_AS_NETWORK §1 / H2), NAT-traversing (Circuit Relay v2 + AutoNAT + DCUtR). It already carries real traffic: the ingress sidecar (`src/sidecar.ts`) makes any plain-HTTP vessel discovery-reachable over the relay; the egress front door (`federation-transport-server.ts` `/egress/resolve`) lets libp2p-free vessels (goal-host) dial libp2p peers; obsidian-vessel embeds the sidecar (`repos/obsidian-vessel/sidecar/federation-sidecar.ts`).
2. **Plain HTTP on the loopback**, with same-machine knowledge baked into code: `127.0.0.1:8xxx` fallback constants across dev-vessel/boredom-vessel/activity-api resolvers, literal `http://127.0.0.1:8080/...` URLs inside seed activity templates, the operator-side `18xxx` host-port remap convention, and env knobs like `PREFER_LIBP2P_ROUTE=1` that make *transport choice* a host configuration rather than a property of the vessel's registration.

Idiomatic under existing primitives: **a vessel's reachability is entirely described by its discovery registration** (resolver contract + `protocol` + `libp2p_peer_id` + `libp2p_multiaddr`). The overlay is the general transport; "HTTP to a loopback endpoint" is merely the degenerate advertised case where caller and vessel share a machine. No new tier, no new category — this is the existing discovery registration carrying one more fact, and existing callers reading it.

## What changes (this slice — additive/advisory, nothing switches over)

1. **Discovery registration is the single reachability description.**
   - `repos/discovery-vessel` already carries `protocol: "http" | ... | "libp2p"`, `libp2p_peer_id`, `libp2p_multiaddr` on registration, capability results, and heartbeats (landed with the sidecar work). This is the canonical schema.
   - `packages/vessel-discovery-client` (the shared client every idiomatic vessel registers through) learns the same fields additively: `"libp2p"` joins the `protocol` union; `libp2p_peer_id` / `libp2p_multiaddr` flow through `VesselClientConfig` → registration payload → `VesselRegistration` / capability-result types. A vessel that fronts itself with the ingress sidecar — or later embeds `createVesselLibp2p` directly — advertises its multiaddrs through the same client call it already makes.

2. **Callers pick transport from the registration, not from env/machine knowledge.**
   - goal-host's `routeFor` routes **any** vessel advertising `protocol === "libp2p"` with a `libp2p_multiaddr` via the egress front door — not only `discoveredVia === "peer"` vessels, and not gated on `PREFER_LIBP2P_ROUTE=1`. Today a *locally* registered libp2p vessel (exactly what the ingress sidecar registers: its HTTP `endpoint` is a health-only port) is routed to its dead HTTP endpoint and the resolve 404s. Registration says libp2p ⇒ route libp2p. HTTP-advertising vessels are untouched.
   - `PREFER_LIBP2P_ROUTE` remains only as a test override for vessels that advertise *both* transports; it is no longer required for correctness.

3. **Loopback defaults become what they always were: the degenerate case.** The `127.0.0.1:8xxx` fallbacks in resolver code and the `18xxx` operator remap are *defaults for the co-located deployment*, not the transport model. They stay (env-overridable) for now; the direction is that a resolver reaching another vessel consults discovery (`vesselCapability`) and follows the returned reachability description, so the constants stop being load-bearing. Literal URLs inside seed activity templates (`draft-gap-closing-activity.ts`, `detect-concept-db-drift.ts`, `vessel-scaffold-trigger-tick.ts`) are the worst leak class — baked into activity JSON, not even env-overridable — and are flagged for follow-up slices, not fixed here.

## Non-goals (explicitly out of this slice)

- No cutover: HTTP-advertising vessels keep resolving over HTTP exactly as today.
- No removal of loopback defaults or the 18xxx host mapping.
- No relay requirement for local operation: with no `RELAY_MULTIADDR`, nothing changes — the degenerate case needs no overlay infrastructure. The host contract stays `docker run <image>` + env + volumes.
- No new auth scheme: peer-ID authenticity comes from the existing deterministic-identity design (vessel_id → Ed25519 → peerId); scope attestation remains H2/H3 forward work.

## Leak inventory (same-machine assumptions in resolver/client code, 2026-07-04)

Transport-choice leaks (the target of this change):
- `repos/goal-host-vessel/src/index.ts:1344-1359` — `routeFor` requires `discoveredVia === "peer"` before honoring `libp2p_multiaddr`; local libp2p registrations fall through to a dead HTTP endpoint.
- `repos/goal-host-vessel/src/index.ts:1350` — `PREFER_LIBP2P_ROUTE=1` env knob makes transport a host setting.
- `repos/goal-host-vessel/src/index.ts:3481-3494` — second copy of the same peer-only routing.
- `packages/vessel-discovery-client/src/types.ts:48,122` — protocol union lacks `"libp2p"`; no `libp2p_peer_id`/`libp2p_multiaddr` anywhere in the shared client, so idiomatic vessels cannot advertise overlay reachability at all.

Loopback-default leaks (tolerated degenerate-case defaults; env-overridable):
- `repos/development-vessel/src/resolvers/*.ts` — ~20 files with `http://127.0.0.1:8080|8090|8100|8210|8220|8260` DEFAULT_* constants (capability-gap-audit, resolver-distribution-audit, code-needs-report, trace-outcome-validity-audit, stale-pointer-emit, learning-signal-health-observer, precondition-rejection-scan, orphaned-capability-scan, selector-saturation-audit, vessel-mitosis-evaluate, dispatch-goal, repair-policy, pick-priority-scenario, source-code, populated-concept-graph-links, obsidian-*, llm-api-health-observer, concept-db-health-observer, gate-saturation-scan, model-opportunity-scan).
- `repos/boredom-vessel/src/index.ts:20-23`, `repos/activity-api/src/routes/activities.ts:4181`, `repos/activity-api/src/lib/signature-embedding.ts:32`, `repos/activity-dashboard/src/index.ts:5`, `repos/activity-dashboard/src/lib/api-client.ts:41`.
- `repos/goal-host-vessel/src/index.ts:89` — `FED_TRANSPORT_EGRESS ?? http://127.0.0.1:8401` (acceptable: the egress IS co-located by design; it is the local on-ramp to the overlay).

Baked-URL leaks (worst class — inside seed activity template JSON, not env-overridable; follow-up slices):
- `repos/development-vessel/src/seed/draft-gap-closing-activity.ts:110-332` (multiple literal `http://127.0.0.1:8080|8090|8260` URLs, including inside a drafting prompt that teaches new activities to hardcode URLs).
- `repos/development-vessel/src/seed/detect-concept-db-drift.ts:63,79`; `detect-classifier-distribution-skew.ts:171`; `vessel-scaffold-trigger-tick.ts:241`.

## Verification

- Registration round-trip: a vessel registering through `vessel-discovery-client` with `protocol:"libp2p"` + multiaddrs is returned by `vesselCapability` queries with those fields intact (discovery-vessel already echoes them — `src/resolvers.ts:43-46`).
- Routing: with a local libp2p-only registration present, goal-host resolves that vessel's shape via `/egress/resolve?target=<multiaddr>` instead of the vessel's HTTP endpoint; existing HTTP vessels' routing is byte-identical.
