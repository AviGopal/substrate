// federation-transport-server.ts — the integration wrapper that turns the vetted
// vessel-libp2p primitive into an actual RUNNING substrate vessel.
//
// It (1) brings up the libp2p transport (key-from-vesselId, dials the relay, holds a
// reservation), (2) serves cross-substrate resolution over @libp2p/http, (3) exposes a
// plain HTTP /health carrying the transport sensing surface so the substrate's
// self-recovery + the (substrate-authored) transport-health observer can probe it, and
// (4) registers with the local discovery-vessel — advertising its libp2p peer_id +
// circuit multiaddr in `metadata` (a stopgap that needs no change to discovery's typed
// contract; the proper libp2p_* contract fields are the operator-must-land follow-up).
import { createVesselLibp2p, serveResolve, serveResolveHttp, resolveViaLibp2p, resolveViaHttp, type VesselLibp2p } from '@avigopal/libp2p-federation-transport'
import { ping } from '@libp2p/ping'
import { hostname } from 'node:os'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { multiaddr } from '@multiformats/multiaddr'

// RESILIENCE: libp2p internals emit 'error' events on streams/sockets that have no
// listener (e.g. a relay/peer dial TimeoutError surfacing through internal:streams/
// destroy → emitError). Without these guards that becomes ERR_UNHANDLED_ERROR and the
// whole vessel exits 1, crash-looping under self-recovery. A peer being unreachable
// must degrade gracefully — log and continue, never throw into the event loop.
process.on('uncaughtException', (err) => {
  console.error('[fed-transport] uncaughtException (continuing):', (err as Error)?.message ?? String(err))
})
process.on('unhandledRejection', (reason) => {
  console.error('[fed-transport] unhandledRejection (continuing):', (reason as Error)?.message ?? String(reason))
})

const VESSEL_ID = process.env.FED_VESSEL_ID || 'federation-transport-vessel'
let RELAY = process.env.RELAY_MULTIADDR || ''
const DISCOVERY = process.env.DISCOVERY_URL || 'http://127.0.0.1:8100'
const API_KEY = process.env.METABOB_API_KEY || ''
// Location independence (law 11): hub-facing calls authenticate to a DIFFERENT trust
// domain than local calls. A spoke's METABOB_API_KEY is issued by the spoke's own
// identity-vessel and is NOT valid on the hub (the hub validates a key claiming issuer
// 127.0.0.1:8101 against ITS OWN HMAC secret, so a spoke-issued key fails) — reusing it
// 401s every hub register, and the spoke's caps never reach the hub namespace. HUB_API_KEY
// carries a HUB-ISSUED credential for hub-facing calls (the namespace-mirror register
// below, and any future hub fan-out). It falls back to API_KEY so a same-domain / single-
// substrate deployment (hub==local, or an unfederated node) is byte-for-byte unchanged.
const HUB_API_KEY = process.env.HUB_API_KEY || API_KEY
const HEALTH_PORT = parseInt(process.env.FED_HEALTH_PORT || '8401', 10)

// "Just point and go": if RELAY_MULTIADDR wasn't handed to us, derive the relay
// anchor from the discovery we are pointed at via its public GET /bootstrap
// (law 1 — read the relay at use time, never freeze a stale multiaddr in env).
// Prefer the hub discovery (a spoke's pointer); fall back to local discovery.
const BOOTSTRAP_URL = (process.env.BOOTSTRAP_URL || process.env.HUB_DISCOVERY_URL || DISCOVERY).replace(/\/$/, '')
const LOCAL_BOOTSTRAP_URL = DISCOVERY.replace(/\/$/, '')

// Anchor lookup is ADVISORY, never fatal, and never one-shot.
//
// It has to be re-runnable because /bootstrap DERIVES relay_multiaddrs from the circuits
// currently registered in that discovery — so the answer is empty until some transport in
// the network holds a reservation, and becomes non-empty later, with no notification. A
// single startup fetch can only ever see the bootstrap moment.
async function fetchAnchor(url: string): Promise<string> {
  if (!url) return ''
  try {
    const r = await fetch(`${url}/bootstrap`, { signal: AbortSignal.timeout(5000) })
    if (!r.ok) return ''
    const b = await r.json() as { relay_multiaddrs?: string[] }
    const ma = b.relay_multiaddrs?.find((m) => typeof m === 'string' && m) ?? ''
    if (ma) console.log(`[fed-transport] relay from ${url}/bootstrap: ${ma}`)
    return ma
  } catch (e) {
    // An unreachable pointer is a HINT that missed, not an error condition. Observed
    // 2026-09-12: a stale droplet IP pinned in a host workspace file (HTTP 000) timed out
    // here, and the exit below then deleted this substrate's entire libp2p presence — 13
    // of 13 registry rows with libp2p_multiaddr:null, a unit parked in `activating`
    // forever (Restart=always ⇒ never `failed`, so nothing reported it). An address
    // someone typed once must never be able to kill the node (law 11).
    console.error(`[fed-transport] bootstrap fetch failed (${url}): ${(e as Error).message}`)
    return ''
  }
}
// Prefer the pointed-at (hub) discovery; fall back to LOCAL discovery. The comment above
// has claimed this fallback since the file was written — the code never had it, so a dead
// hub pointer skipped the healthy local /bootstrap answering in 0.7ms in the same container.
//
// MULTIADDR-ONLY JOIN. A substrate handed only PEER_MULTIADDR has no HTTP endpoint to
// fetch /bootstrap from — that is the entire point of the form: a multiaddr names a peer
// IDENTITY, a URL names a host. So dial the peer over libp2p and ask it for
// substrateBootstrap, which its ingress answers from its own discovery (see the DISCOVERY
// OVER THE OVERLAY short-circuit in proxyToLocalOwner).
//
// This inverts the HTTP order deliberately. The URL path derives a relay FROM a discovery
// endpoint; here the relay is learned THROUGH a peer that is already reachable, because
// the multiaddr IS the reachability. Anchors learned this way are held in memory and
// served at :8401/anchors — never written to /etc/substrate/env, which gen-env truncates
// on every boot and which would freeze a value that changes.
//
// Tried FIRST when present, because an operator who supplied a multiaddr chose a peer,
// not a host, and silently preferring an HTTP guess would discard that choice.
const PEER_MULTIADDR = process.env.PEER_MULTIADDR || ''
let LEARNED_ANCHORS: Record<string, unknown> | null = null
async function anchorFromPeer(): Promise<string> {
  if (!PEER_MULTIADDR) return ''
  let boot: any = null
  try {
    // Derive the boot identity INLINE rather than referencing LIBP2P_IDENTITY: this runs
    // during anchor resolution, which happens BEFORE that const is declared, and a
    // temporal-dead-zone throw here was swallowed by the catch below and reported as
    // "multiaddr bootstrap failed" — a real bug wearing the costume of an unreachable peer.
    const bootId = `${VESSEL_ID}@${process.env.FED_SUBSTRATE_ID || hostname()}-boot`
    boot = await createVesselLibp2p({ vesselId: bootId, enableHttp: true })
    const res: any = await resolveViaHttp(boot, PEER_MULTIADDR, { type: 'substrateBootstrap' })
    const c = (res && typeof res === 'object' && 'content' in res) ? (res as any).content : res
    LEARNED_ANCHORS = (c && typeof c === 'object') ? c : null
    const ma = String((c?.relay_multiaddrs ?? [])[0] ?? '')
    if (ma) console.log(`[fed-transport] relay learned from peer over libp2p: ${ma}`)
    else console.log('[fed-transport] peer answered substrateBootstrap with no relay anchor — continuing direct-only')
    return ma
  } catch (e) {
    console.error(`[fed-transport] multiaddr bootstrap failed (continuing): ${String((e as Error)?.message ?? e)}`)
    return ''
  } finally { if (boot) await boot.stop().catch(() => {}) }
}
async function resolveAnchor(): Promise<string> {
  return (await anchorFromPeer())
    || (await fetchAnchor(BOOTSTRAP_URL))
    || (BOOTSTRAP_URL === LOCAL_BOOTSTRAP_URL ? '' : await fetchAnchor(LOCAL_BOOTSTRAP_URL))
}
if (!RELAY) RELAY = await resolveAnchor()

// A RELAY-LESS TRANSPORT IS A HEALTHY TRANSPORT (operator-ratified 2026-07-19:
// "the relay won't always be available due to networking conditions, so internally a
// direct connection should be equivalent to a punchthrough").
//
// This used to be `process.exit(1)`, and that single line made the overlay bootstrap
// CIRCULAR: discovery derives relay_multiaddrs from registered circuits, circuits exist
// only once a transport reserves, and the transport refused to start without an anchor —
// so a standalone substrate (the default inventory) could never originate an overlay, and
// every substrate whose anchor went stale went dark in the same way. Worse, the direct-dial
// machinery this file already implements (currentDirectAddrs / advertisedAddrs, "direct ≡
// punchthrough") was unreachable code: the process exited before the node was constructed.
//
// Relay-less we still get /ip4/0.0.0.0/tcp/<ephemeral>, dcutr and autonat — i.e. every
// same-host / same-LAN peer is fully reachable, which is the ENTIRE reachability surface of
// a single-host deployment. The relay is the NAT fallback rung, not the entry condition.
if (!RELAY) console.warn('[fed-transport] no relay anchor yet — starting DIRECT-ONLY (direct ≡ punchthrough); an anchor is re-attempted on a backoff and adopted if one appears')

// The libp2p keypair is derived deterministically from this id (seed =
// sha256(id)), so it MUST be substrate-scoped: every substrate runs a transport
// named `federation-transport-vessel`, and a bare id gives them all the SAME
// peer id — circuit dials through the relay become ambiguous between
// substrates, and isSelfCircuit() filters every peer substrate's rows as
// self-dials ("no local or remote producer" at the hub, hub↔spoke↔obsidian all
// dark). FED_SUBSTRATE_ID keeps the peer id stable across container recreates;
// the hostname fallback (container id) still guarantees uniqueness, at the cost
// of a new peer id per recreate (heals via re-registration + row TTL).
const LIBP2P_IDENTITY = `${VESSEL_ID}@${process.env.FED_SUBSTRATE_ID || hostname()}`

// The ping RESPONDER (extraServices) is the prerequisite for the relay's reserved-peer
// keep-alive: the relay pings each reserved peer to keep the NAT mapping warm and detect
// a silently-dead connection. Without this service every relay→vessel ping fails as
// "unsupported protocol" (not "dead"), so the responder must be live on every vessel
// BEFORE the relay keep-alive is enabled.
// `relayMultiaddr` is passed ONLY when we actually hold an anchor: createVesselLibp2p
// branches on its presence (index.ts:257 pushes the generic '/p2p-circuit' listen addr,
// :283 starts the reservation-refresh loop). Passing '' would be falsy-equivalent today but
// the intent must be explicit — this is the switch between a relayed node and a direct-only
// one, not an optional detail.
const buildNode = (relay: string): Promise<VesselLibp2p> => createVesselLibp2p({
  vesselId: LIBP2P_IDENTITY,
  ...(relay ? { relayMultiaddr: relay } : {}),
  enableHttp: true,
  extraServices: { ping: ping() },
})
// `let`, not `const`: adopting a relay anchor discovered AFTER startup requires replacing
// the node (see adoptAnchor() at the bottom — the '/p2p-circuit' listen address can only be
// set at construction). Every consumer below reads this binding at call time, so the swap is
// invisible to them; the peer id is unchanged because the key is derived from LIBP2P_IDENTITY.
let vl: VesselLibp2p = await buildNode(RELAY)

// Resolve handler (where the data lives). Probe shapes are answered inline; any OTHER
// shape is proxied to the vessel that owns it on THIS substrate, found via the LOCAL
// discovery (X-Discovery-Depth pinned high so the lookup can never fan back out to a
// peer and loop A→hub→A). This is what makes the transport a genuine ingress for the
// whole substrate: a remote peer that discovered us through the hub namespace can
// resolve any locally-owned shape over the relay, not just federation_probe.
// FED_EXTRA_SHAPE lets ONE substrate advertise a shape its peers do NOT — so a peer's
// goal walk finds no LOCAL producer, fans out via discovery, and is forced down the
// genuine cross-substrate libp2p route (proving remote resolve, not a self-dial).
const EXTRA_SHAPE = process.env.FED_EXTRA_SHAPE || ''

async function localDiscoveryResolve(pointer: any, allowFanout = false): Promise<any[]> {
  const dr = await fetch(DISCOVERY + '/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'ApiKey ' + API_KEY,
      // local-only by default: never peer-fan-out from an ingress lookup. A
      // first-hop EGRESS lookup may fan out (allowFanout) — vessels that
      // register only at the hub (e.g. host-side obsidian sidecars) are
      // invisible in the local registry and reachable only via the union view.
      'X-Discovery-Depth': allowFanout ? '0' : '99',
    },
    body: JSON.stringify({ pointer }),
    signal: AbortSignal.timeout(5000),
  })
  const dj = (await dr.json().catch(() => ({}))) as any
  return (dj?.content?.vessels ?? []) as any[]
}

// A plain-HTTP owner row is only reachable from THIS transport if its endpoint is not
// a cross-host artifact. `host.docker.internal` is a vault-/container-host loopback
// alias that resolves ONLY on the machine that registered it; on any other substrate it
// is dead. Such a row must never be chosen over — or shadow — a live libp2p circuit,
// otherwise a remote resolve of a vessel that registered a host-local HTTP endpoint
// (e.g. an Obsidian plugin) dies with "ingress proxy failed" instead of hopping to the
// vessel's circuit. Genuine intra-container owners (127.0.0.1:<port> of a co-resident
// vessel) stay reachable and are deliberately NOT excluded here.
const HOST_LOCAL_UNREACHABLE = /(^|\/\/)host\.docker\.internal(:|\/|$)/i
// Loopback is only "co-resident" for a row THIS substrate registered. A row imported
// from a peer namespace carries the endpoint as the ORIGINATING machine saw it, so its
// 127.0.0.1 names that machine, not this one — dialling it reaches nothing here, and it
// shadows the live circuit the same way a host.docker.internal row does. Foreign rows
// are exactly those whose vesselId carries an `@<substrate>` suffix that is not ours.
const LOOPBACK_ENDPOINT = /(^|\/\/)(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/i
function isForeignRow(v: any): boolean {
  const id = String(v?.vesselId ?? '')
  const at = id.lastIndexOf('@')
  return at !== -1 && id.slice(at + 1) !== SUBSTRATE_ID
}
function reachableHttp(v: any): boolean {
  const endpoint = String(v?.endpoint ?? '')
  if (HOST_LOCAL_UNREACHABLE.test(endpoint)) return false
  if (LOOPBACK_ENDPOINT.test(endpoint) && isForeignRow(v)) return false
  return true
}
// Never dial our own circuit: a hub self-mirror row (`<id>@<substrate>`) carries THIS
// transport's peer id, so forwarding to it loops the ingress back onto itself.
function isSelfCircuit(v: any): boolean {
  const ma = Array.isArray(v?.libp2p_multiaddr) ? String(v.libp2p_multiaddr[0] ?? '') : ''
  return !!ma && ma.includes(vl.peerId)
}

async function proxyToLocalOwner(pointer: any): Promise<any> {
  const t = String(pointer?.type ?? '')
  const hop = Number(pointer?._fedHop ?? 0)

  // ── DISCOVERY OVER THE OVERLAY ──────────────────────────────────────────────────
  //
  // The premise of a multiaddr-only join is that a substrate handed nothing but a peer
  // multiaddr can find out where it has arrived. That requires asking the peer's DISCOVERY
  // something, over libp2p, before it holds any HTTP endpoint at all.
  //
  // The generic passthrough below already forwards any shape to whichever local vessel owns
  // it, so in principle discovery is already reachable this way. In practice it is not:
  // DISCOVERY-VESSEL DOES NOT REGISTER ITSELF into its own registry (verified — there is no
  // self-registration in repos/discovery-vessel/src/index.ts), so a vesselCapability lookup
  // for `vesselRegistry` finds no owner and the proxy answers `unknown shape`. The one
  // vessel every joiner must reach is the one vessel that cannot be found by the mechanism
  // used to find vessels.
  //
  // Short-circuit rather than "fix" discovery to self-register: self-registration would put
  // discovery in its own TTL/heartbeat cycle and make the registry's liveness depend on the
  // registry, which is the circularity this whole subsystem keeps tripping over. Answering
  // these four shapes directly is the smaller, non-circular change, and it lives in
  // scripts/ rather than a gated vessel.
  //
  // substrateBootstrap is deliberately UNAUTHENTICATED, matching discovery's own
  // PUBLIC_PATHS treatment of GET /bootstrap: a joiner has not yet been told the identity
  // authority, so requiring a credential to learn where the identity authority lives is a
  // chicken-and-egg. It returns routing anchors only — never registry contents.
  const DISCOVERY_SHAPES = new Set(['vesselRegistry', 'vesselCapability', 'vesselEndpoint', 'vesselHealth'])
  if (t === 'substrateBootstrap') {
    try {
      const r = await fetch(DISCOVERY + '/bootstrap', { signal: AbortSignal.timeout(5000) })
      const b = await r.json()
      return { shape: 'substrateBootstrap', produced_by: VESSEL_ID, ...(b as Record<string, unknown>) }
    } catch (e) {
      return { error: 'substrateBootstrap unavailable: ' + String((e as Error)?.message ?? e) }
    }
  }
  if (DISCOVERY_SHAPES.has(t)) {
    // REGISTRY CONTENTS ARE NOT PUBLIC, AND THIS PATH IS THE NEWEST WAY TO REACH THEM.
    //
    // The libp2p ingress performs no authorization of its own and resolves remote requests
    // with THIS transport's key, so anyone who can dial gets whatever the transport can
    // reach. That is a pre-existing hole (peer ids are sha256 of a guessable vesselId, and
    // Noise gives confidentiality, not authorization) — but exposing the registry over the
    // overlay is something I added, and widening an exposure while leaving it unguarded is
    // not acceptable just because the underlying hole predates me.
    //
    // The ingress cannot see request headers without a change to the gated transport
    // package, so the credential travels in the POINTER envelope, which serveResolveHttp
    // already forwards intact. A caller proves it belongs to this fleet by echoing the
    // shared key as pointer._auth.
    //
    // FED_DISCOVERY_OVERLAY_AUTH=0 restores the previous behaviour. It exists because this
    // is a fail-CLOSED change on a live fleet and a rollback must not require a redeploy —
    // not as an invitation to leave it off.
    if ((process.env.FED_DISCOVERY_OVERLAY_AUTH ?? '1') !== '0') {
      const presented = String((pointer as any)?._auth ?? '')
      if (!API_KEY || presented !== API_KEY) {
        console.log(`[fed-transport] refused uncredentialed overlay ${t} (registry contents are not public)`)
        return { error: 'unauthorized', shape: t, note: 'registry shapes over the overlay require pointer._auth; substrateBootstrap is the public anchor-only alternative' }
      }
    }
    try {
      const rows = await localDiscoveryResolve(pointer)
      return { shape: t, produced_by: VESSEL_ID, vessels: rows, found: rows.length > 0 }
    } catch (e) {
      return { error: 'discovery short-circuit failed: ' + String((e as Error)?.message ?? e) }
    }
  }
  const forwardLibp2p = async (v: any) => {
    console.log('[fed-transport] ingress→libp2p forward ' + t + ' to ' + String(v.libp2p_multiaddr[0]).slice(-20))
    const res = await resolveOverLibp2p(String(v.libp2p_multiaddr[0]), { ...pointer, _fedHop: hop + 1 })
    return (res && typeof res === 'object' && 'content' in (res as any)) ? (res as any).content : res
  }
  // Per-vessel addressing: a caller that discovered `<vesselId>@<substrate>` through
  // the hub namespace names its target via pointer._fedTargetVessel (either form —
  // bare vesselId or the substrate-qualified mirror id). When set, route to exactly
  // that vessel; shape-owner lookup is only the fallback. This is what makes
  // DUPLICATE shapes across the fleet individually addressable (two goal-hosts, two
  // activity-apis) instead of collapsing onto whichever vessel shape-lookup finds.
  const wanted = String(pointer?._fedTargetVessel ?? '').split('@')[0]
  if (wanted) {
    const all = await localDiscoveryResolve({ type: 'vesselRegistry' })
    const cand = all.find((v: any) => String(v?.vesselId ?? '') === wanted && !String(v.vesselId).startsWith(VESSEL_ID))
    if (cand) {
      // A libp2p target is reached over its circuit (the previous code required
      // protocol!=='libp2p' here, so naming a libp2p vessel silently fell through and
      // the shape then routed to a dead host-local HTTP row).
      if (hop < 1 && cand.protocol === 'libp2p' && Array.isArray(cand.libp2p_multiaddr) && cand.libp2p_multiaddr[0] && !isSelfCircuit(cand))
        return forwardLibp2p(cand)
      if (cand.protocol !== 'libp2p' && reachableHttp(cand)) return proxyToVessel(pointer, t, cand)
    }
  }
  const vessels = await localDiscoveryResolve({ type: 'vesselCapability', shape: t })
  // Prefer a REACHABLE plain-HTTP LOCAL vessel: never ourselves, never our own
  // hub-mirror registration (vesselId-prefixed), never a libp2p-protocol entry, and
  // never a cross-host-dead host.docker.internal row (which would shadow the circuit).
  const httpCandidates = vessels.filter(
    (v: any) => v?.vesselId && !String(v.vesselId).startsWith(VESSEL_ID) && v?.protocol !== 'libp2p' && reachableHttp(v),
  )
  // Honor the producer's self-declared distribution rule on the cross-substrate
  // path too, not only discovery's own /resolve pick: discovery echoes
  // distribution_policy in capability rows since the policy data-path landed
  // (discovery-vessel 6ab2e24). A unique_authoritative / stateful_data_owner_pin
  // producer wins over interchangeable replicas; absent/stateless keeps the prior
  // first-reachable behavior. (Capability rows do not echo `metadata`, so the
  // first-class field is the only signal here — which is exactly why it exists.)
  const policyOf = (v: any) => String(v?.distribution_policy ?? 'stateless')
  const pinnedOwner = httpCandidates.find(
    (v: any) => policyOf(v) === 'unique_authoritative' || policyOf(v) === 'stateful_data_owner_pin',
  )
  const owner = pinnedOwner ?? httpCandidates[0]
  if (!owner) {
    // No reachable LOCAL owner — try a REMOTE one over libp2p. The hub namespace mirror
    // advertises other substrates' shapes with protocol:'libp2p' + the OWNING
    // transport's circuit multiaddr. Forwarding one hop there is what makes
    // "connect to any relay → reach all vessels" true: the owning substrate's
    // ingress then lands on its own local plain-HTTP vessel. A hop guard
    // (pointer._fedHop) bounds this to a single cross-substrate hop so a
    // mutual mirror (A↔B) can never ping-pong. Skip self-mirror circuits, and prefer
    // a DIRECT sidecar row (bare vesselId) over an `@substrate` mirror row — the direct
    // row dials the vessel's own circuit, the mirror dials another transport that only
    // re-proxies (and, for a host-local owner, would fail again).
    const libp2pFilter = (v: any) => v?.vesselId && !String(v.vesselId).startsWith(VESSEL_ID)
      && v?.protocol === 'libp2p' && Array.isArray(v?.libp2p_multiaddr) && v.libp2p_multiaddr[0] && !isSelfCircuit(v)
    let libp2pRows = hop < 1 ? vessels.filter(libp2pFilter) : []
    if (hop < 1 && libp2pRows.length === 0) {
      // Nothing local — a hub-registered-only producer (host sidecars) is
      // visible solely through discovery's union fan-out. One fan-out retry on
      // first-hop lookups only; remote-originated resolves (hop>=1) stay
      // local-only so a mutual mirror can never ping-pong.
      libp2pRows = (await localDiscoveryResolve({ type: 'vesselCapability', shape: t }, true)).filter(libp2pFilter)
    }
    const remote = libp2pRows.find((v: any) => !String(v.vesselId).includes('@')) ?? libp2pRows[0]
    if (remote) return forwardLibp2p(remote)
    // Host-local HTTP fallback (law 11 data-locality). A row in OUR OWN discovery whose
    // endpoint is host.docker.internal is dead from every OTHER substrate — reachableHttp
    // rightly excludes it above so it never shadows a live circuit — but on the substrate
    // that OWNS the registration (this ingress: `vessels` is the local-only query, fan-out
    // rows only ever enter libp2pRows) the alias resolves against the real container host.
    // Serve it here instead of "no producer": this is the last hop that makes host-resident
    // sidecars (e.g. the Obsidian vault plugin at host.docker.internal:27182) reachable
    // through the federation, by shape or by ?vessel= hint.
    const hostLocal = (wanted
      ? vessels.filter((v: any) => String(v?.vesselId ?? '') === wanted)
      : vessels
    ).find((v: any) => v?.vesselId && !String(v.vesselId).startsWith(VESSEL_ID)
      && v?.protocol !== 'libp2p' && String(v?.endpoint ?? '') && !reachableHttp(v))
    if (hostLocal) {
      console.log('[fed-transport] ingress→host-local HTTP fallback ' + t + ' via ' + String(hostLocal.vesselId))
      return proxyToVessel(pointer, t, hostLocal)
    }
    return { error: 'unknown shape: ' + t, note: 'no local or remote producer via ' + VESSEL_ID }
  }
  return proxyToVessel(pointer, t, owner)
}

async function proxyToVessel(pointer: any, t: string, owner: any): Promise<any> {
  const base = String(owner.endpoint ?? '').replace(/\/$/, '')
  // resolve_endpoint may be a PATH ("/v2/impulses/resolve", dev-vessel) or a full
  // absolute URL ("http://127.0.0.1:8210/resolve", goal-host). Concatenating base +
  // a full URL yields an invalid URL ("...8210http://...") → "fetch() URL is invalid".
  // Use the absolute form as-is; otherwise hang the path off base.
  const rawResolve = String(owner.resolve_endpoint ?? '/v2/impulses/resolve')
  const url = /^https?:\/\//.test(rawResolve) ? rawResolve : base + (rawResolve.startsWith('/') ? rawResolve : '/' + rawResolve)
  // Transport-internal routing keys never leak to the owning vessel.
  const fwd: any = { ...pointer }
  delete fwd._fedTargetVessel
  delete fwd._fedHop
  const rr = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + API_KEY },
    // Envelope that satisfies every resolve reader in the fleet: top-level pointer
    // fields (goal-host reads body.type), impulse=pointer (dev-vessel reads
    // impulse.type), and impulse.pointer (goal-host's impulse-contract path). A
    // single form kept them incompatible — goal-host got type:undefined from
    // {impulse: pointer}.
    body: JSON.stringify({ ...fwd, impulse: { ...fwd, pointer: fwd } }),
    // 20_000 here silently killed the ReAct floor. `llm_completion` has NO local
    // producer — it resolves only to llm-resolver-opus@syzygy-hub — so EVERY agentic
    // tool loop crosses this proxy. A 5-tool universal-executor dispatch measures well
    // past 20s (reproduced: HTTP 500 "ingress proxy failed: The operation timed out."
    // at 20.45s, while the same call with one tool returns in 4.9s). goal-host caps a
    // single floor iteration at 90s (ITER_TIMEOUT_MS), so this hop must sit above that
    // or the caller can never observe its own timeout — it just sees a non-ok response,
    // breaks the loop, and returns an empty result the floor reports as `empty_loop`.
    // Same defect class as the ribosome's 15s replay budget against a 15.4-16.9s fetch:
    // a hardcoded transport deadline set below the operation's real latency.
    signal: AbortSignal.timeout(120000),
  })
  const rj = (await rr.json().catch(() => ({}))) as any
  // Normalize the two local envelope styles ({success,shape,body} / {content}) into
  // one content payload so the remote caller's resolve parsing stays uniform.
  const body = rj?.body ?? rj?.content ?? rj
  // Carry the SIBLING metadata through. llm-resolver is agentic by design: it executes
  // tool_use itself and returns a `tool_calls` AUDIT array as a sibling of `content`
  // (llm-resolver-vessel/src/index.ts:584), alongside usage/model/provider. Collapsing
  // to `body` alone DESTROYED all of them at the wire, which is why a remote caller
  // could not distinguish a grounded answer from a confabulated one and goal-host's
  // groundedOk was permanently 0 across 72h. Additive-only: every known cross-repo
  // reader consumes .value/.body/.content and none enumerate keys, so adding siblings
  // cannot displace an existing field.
  const carried: Record<string, unknown> = {}
  if (rj && typeof rj === 'object') {
    for (const k of ['tool_calls', 'iterations', 'usage', 'model', 'provider', 'stop_reason']) {
      if ((rj as any)[k] !== undefined) carried[k] = (rj as any)[k]
    }
  }
  return { shape: t, produced_by: owner.vesselId + '@' + VESSEL_ID, ...carried, ...((body && typeof body === 'object') ? { body } : { value: body }), note: 'proxied to the owning vessel on the peer substrate over libp2p' }
}

// One handler, served over BOTH transports: serveResolve (lpStream — carries multi-KB
// bodies reliably after the sendAll fix) and serveResolveHttp (legacy HTTP-over-libp2p,
// kept so not-yet-migrated callers still resolve small payloads). New callers dial the
// lpStream path (resolveViaLibp2p); large proxied responses only work over it.
const resolveHandler = async (pointer: any): Promise<any> => {
  const t = pointer?.type
  if (t === 'federation_probe')
    return { shape: 'federation_probe', produced_by: VESSEL_ID, value: 'hello-over-libp2p-http', note: 'resolved where the data lives, over libp2p' }
  if (EXTRA_SHAPE && t === EXTRA_SHAPE)
    return { shape: EXTRA_SHAPE, produced_by: VESSEL_ID, value: 'cross-substrate-resolve-ok', note: 'resolved on the PEER substrate over libp2p (genuine cross-substrate)' }
  // PAYLOAD INTEGRITY. federation_probe above returns a CONSTANT — it echoes nothing, so
  // it cannot detect a truncated frame, and a truncation is exactly the failure the
  // lpStream framing (4-byte BE length + UTF-8 JSON, sendAll chunking at 1024B) can
  // produce. This shape carries the caller's bytes back.
  //
  // Return the echo AND a SERVER-computed sha256 over the bytes actually received. Those
  // are two independent witnesses: a corrupted echo and a hash taken over the wrong bytes
  // are distinguishable, where a single field would let one defect mask the other. The
  // caller asserts BOTH hash and byte-length — hash alone misses a re-canonicalization,
  // length alone misses corruption that preserves size.
  //
  // `payload` is a string echoed verbatim (no re-encoding on this side). `payload_obj`
  // exists for the nested-JSON class, where the point is to exercise the envelope parser
  // rather than the framing; it is echoed as its serialization, which the caller compares
  // against its own.
  // THE SWEEP HAS TO BE A SHAPE, NOT A SCRIPT PATH IN PROSE.
  //
  // The federation-verification rhythm family fired correctly and its goal text named a
  // raw file path — `execute … scripts/substrate/federation-relay/federation-probe-tick.ts`.
  // goal-host has no capability that runs a script, so the walk reached for the nearest
  // thing it did have and tried to FETCH the path as a URL:
  //   "invalid URL: http://<peer>:18100/scripts/substrate/federation-relay/federation-probe-tick.ts"
  // It then graded itself HOLLOW and reached:false, which is honest but useless. Every
  // other entry in the rhythm registry names an activity; this one named a file, and law 2
  // is explicit that a behaviour reachable only as an operator's command line is invisible
  // to the learning loop. rhythm-conductor-tick's FAMILY_RESOLVERS exists for exactly this
  // ("dispatch the resolver directly instead of enqueuing an NL goal that goal-host cannot
  // walk into an invocation") but lives in a gated file, so the same end is reached here by
  // making the sweep RESOLVABLE.
  //
  // WHY IT RETURNS A REPORT RATHER THAN BLOCKING ON A FRESH ONE. A sweep takes minutes;
  // goal-host's per-iteration budget is 90s. A handler that blocked would time out and be
  // graded hollow for a sweep that actually succeeded — the worst of both. So this reads
  // the latest report the PROBE wrote, and starts a refresh when that report is stale. The
  // caller always gets real measured content plus its age, and never a synthesised verdict.
  //
  // PROVENANCE: the transport serves this report; it does not author it. Every verdict
  // inside was witnessed by the probe's own ephemeral peer. A transport summarising its own
  // reachability would violate the rule this whole subsystem is built on — so the body is
  // passed through untouched and carries its own witness fields.
  if (t === 'federation_verification_report') {
    const DEV_POOL_URL = (process.env.DEVELOPMENT_VESSEL_URL || 'http://127.0.0.1:8090') + '/v2/impulses/resolve'
    const FRESH_MS = Number(process.env.FED_REPORT_FRESH_MS || 3_600_000)
    let report: any = null
    try {
      const r = await fetch(DEV_POOL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + API_KEY },
        body: JSON.stringify({ impulse: { pointer: { type: 'poolImpulse', shape: 'federationVerificationReport', limit: 200 } } }),
        signal: AbortSignal.timeout(8000),
      })
      const j: any = await r.json()
      const rows = (j?.body?.impulses ?? []).filter((i: any) => i?.shape === 'federationVerificationReport')
      rows.sort((a: any, b: any) => String(a?.body?.sweep_id ?? '').localeCompare(String(b?.body?.sweep_id ?? '')))
      report = rows.length ? rows[rows.length - 1].body : null
      if (!report) console.error(`[fed-transport] federation_verification_report: pool returned ${(j?.body?.impulses ?? []).length} impulse(s), 0 of shape federationVerificationReport`)
    } catch (e) {
      // NOT SILENT. A swallowed read here is indistinguishable from "no sweep has ever
      // run", so the shape would answer `report: null` forever and the only symptom would
      // be an absence — the same failure class this subsystem keeps producing. Say which
      // call failed and why.
      console.error(`[fed-transport] federation_verification_report: pool read FAILED (${DEV_POOL_URL}): ${String((e as Error)?.message ?? e)}`)
    }

    const ts = report?.ts ?? (report?.sweep_id ? Date.parse(String(report.sweep_id).replace('sweep-', '')) : 0)
    const ageMs = ts ? Date.now() - ts : Number.MAX_SAFE_INTEGER
    let refreshStarted = false
    if (ageMs > FRESH_MS) {
      try {
        // Detached: the sweep outlives this request by design. It writes its own report to
        // the pool, which is where the next resolve will read it from.
        Bun.spawn({
          // THE INSTRUMENT MUST NOT LIVE IN THE WORKSPACE IT MEASURES.
          //
          // This used to spawn the probe from a path relative to THIS file, i.e. from
          // /workspace/git/super-repo — the substrate's own working clone. That clone is
          // the substrate's development surface: it creates per-vessel branches and checks
          // them out. Observed: HEAD moved from a merge on `obsidian-episode-vessel` to
          // `development-vessel`, a branch on which federation-probe-tick.ts does not exist
          // at all (`git ls-tree HEAD` lists only the transport). The probe silently
          // vanished and no sweep could spawn — the oracle disabled by the routine activity
          // of the thing it was watching.
          //
          // So prefer a STABLE install path and keep the in-tree copy only as a fallback
          // for a dev checkout. FED_PROBE_PATH overrides both.
          cmd: [process.env.BUN_BIN || '/root/.bun/bin/bun', probeScriptPath()],
          cwd: new URL('.', import.meta.url).pathname,
          env: process.env as Record<string, string>,
          stdout: 'ignore', stderr: 'ignore',
        }).unref()
        refreshStarted = true
      } catch (e) { console.error('[fed-transport] sweep spawn failed:', String((e as Error)?.message ?? e)) }
    }
    return {
      shape: 'federation_verification_report',
      produced_by: VESSEL_ID,
      report_age_ms: ageMs === Number.MAX_SAFE_INTEGER ? null : ageMs,
      report_is_fresh: ageMs <= FRESH_MS,
      refresh_started: refreshStarted,
      report,
      note: report
        ? 'measured by federation-probe-tick from an independent ephemeral libp2p peer; this vessel serves the report, it does not author it'
        : 'no federation verification report exists yet; a sweep has been started if possible',
    }
  }
  if (t === 'federation_echo') {
    const hasObj = Object.prototype.hasOwnProperty.call(pointer ?? {}, 'payload_obj')
    const payload = hasObj ? JSON.stringify(pointer.payload_obj) : String(pointer?.payload ?? '')
    const bytes = Buffer.from(payload, 'utf8')
    return {
      shape: 'federation_echo',
      produced_by: VESSEL_ID,
      len: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      echo: payload,
      source_field: hasObj ? 'payload_obj' : 'payload',
    }
  }
  try {
    return await proxyToLocalOwner(pointer)
  } catch (e) {
    return { error: 'ingress proxy failed: ' + String((e as Error)?.message ?? e) }
  }
}
await serveResolve(vl, resolveHandler)
await serveResolveHttp(vl, resolveHandler)

// Dial a peer over the lpStream path (reliable for large bodies); fall back to the
// legacy HTTP path if the peer hasn't migrated yet (protocol not supported). Keeps
// cross-substrate resolution working through a mixed-version rollout.
async function resolveOverLibp2p(target: string, pointer: any): Promise<any> {
  try { return await resolveViaLibp2p(vl, target, pointer) }
  catch { return await resolveViaHttp(vl, target, pointer) }
}

// The advertisable circuit multiaddr must be derived LIVE, never captured once:
// a reservation that lands after a bounded startup wait (relay bounce, slow dial)
// would otherwise leave `circuit` empty forever — local registrations then
// advertise no multiaddr and registerAtHub() early-returns silently, so the
// substrate's entire hub mirror disappears while local `register -> 201` keeps
// logging success (observed on the spoke: reservations=1, circuit empty, all
// @substrate rows gone from the hub). Same defect class as the obsidian
// sidecar's stale capture (fixed in 480ac50).
const currentCircuit = () => vl.advertiseMultiaddrs().find((m) => m.includes('p2p-circuit')) ?? ''
// Ratified decision "direct ≡ punchthrough": a direct connection is equivalent to a
// relay punchthrough, so registration rows must announce the node's DIRECT listen
// addrs alongside the relay circuit. Same-host / same-network peers can then dial
// direct with no relay dependency; the circuit stays FIRST in the list so existing
// consumers that blindly take libp2p_multiaddr[0] keep the remote-safe address.
const currentDirectAddrs = () => vl.advertiseMultiaddrs().filter((m) => !m.includes('p2p-circuit'))
const advertisedAddrs = () => [currentCircuit(), ...currentDirectAddrs()].filter(Boolean)
// Bounded startup wait so first registrations usually carry the circuit already.
// Skipped entirely with no anchor: there is nothing to wait FOR, and spending 20s before
// serving /health would make a perfectly healthy direct-only transport look slow to start
// to the very self-recovery watchdog that probes it.
if (RELAY) {
  for (let i = 0; i < 40 && !currentCircuit(); i++) {
    await new Promise((r) => setTimeout(r, 500))
  }
}
const circuit = currentCircuit() // legacy snapshot for startup logging only

// Plain HTTP surface the substrate senses + the libp2p EGRESS front door.
//
// /egress/resolve is the keystone that lets a libp2p-FREE vessel (goal-host has no
// libp2p deps) reach a peer vessel over the relay overlay: goal-host POSTs the peer's
// libp2p target (multiaddr or peerId, via X-Libp2p-Target header or body.target) plus
// the impulse pointer; this vessel — which already holds the relay reservation and the
// @libp2p/http client — dials the peer and returns its {content} verbatim. This is
// "resolvers live where data lives" applied to TRANSPORT: the libp2p egress lives in
// the transport vessel, and goal-host stays a thin HTTP caller. Body is accepted in the
// substrate's normal resolve envelopes ({impulse:{pointer}} / {impulse} / {pointer}) so
// the caller's existing resolve-response parsing works unchanged.
Bun.serve({
  port: HEALTH_PORT,
  hostname: '0.0.0.0',
  async fetch(req) {
    const u = new URL(req.url)
    if (u.pathname === '/health') {
      // The redial/egress-failure counters make the storm class OBSERVABLE as data a
      // health consumer can rate-check (signature: redial rate >1/min sustained), instead
      // of living only in journald where no shaped impulse can reach it.
      // Both numbers, deliberately. activeReservations counts LISTEN ADDRESSES and is
      // what every existing consumer reads; reservationsHeld is what the relay actually
      // granted. Reporting only the new one would silently change a field others depend
      // on; reporting only the old one is what let a phantom look healthy. A disagreement
      // between the two IS the phantom, now visible in the payload instead of discoverable
      // only by an external dial.
      const rt = reservationTruth()
      const transport = {
        ...(vl.health() as unknown as Record<string, unknown>),
        redialCount, egressNoReservationCount, lastRedialReason,
        reservationsHeld: rt.held,
        reservationRelays: rt.relays,
        reservationExpiresInMs: rt.expiresInMs,
        phantomSuspected: rt.held === 0 && !!currentCircuit(),
      }
      return Response.json({ status: 'ok', service: VESSEL_ID, transport, libp2p_peer_id: vl.peerId, libp2p_multiaddr: currentCircuit() })
    }
    // ── IDENTITY OVER THE OVERLAY ────────────────────────────────────────────────
    //
    // Namespace inheritance today is structural and worth preserving exactly: role `spoke`
    // excludes `control`, so the local identity-vessel is masked, the seeder skips via
    // ExecCondition, no local org is ever created, and every vessel presents its
    // hub-issued key to IDENTITY_VESSEL_URL — which resolves it to the HUB's org_id. The
    // spoke lands in the hub's namespace by construction rather than by configuration.
    //
    // A multiaddr-joined substrate has no HTTP identity URL to point at. Rather than make
    // identity a shape — key validation is a synchronous check on the hot path of every
    // request, and resolving a shape requires a validated key, so that is both a latency
    // disaster and a circularity — give the spoke a LOCAL ADDRESS for a REMOTE resolver.
    // Set IDENTITY_VESSEL_URL=http://127.0.0.1:8401/identity and this route carries the
    // call to the identity endpoint learned from the peer. Every local vessel keeps
    // believing IDENTITY_VESSEL_URL is an HTTP URL that validates keys, which it is.
    //
    // Law 11: the resolver stays where its data lives (the hub); the spoke gets an address
    // for it, not a copy of it.
    if (u.pathname.startsWith('/identity/')) {
      const base = String((LEARNED_ANCHORS as any)?.identity_endpoint ?? process.env.IDENTITY_UPSTREAM_URL ?? '').replace(/\/$/, '')
      if (!base) return Response.json({ error: 'no identity endpoint learned yet — this substrate has not completed a peer bootstrap' }, { status: 503 })
      const target = base + u.pathname.replace(/^\/identity/, '') + u.search
      try {
        const r = await fetch(target, {
          method: req.method,
          headers: req.headers,
          body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.text(),
          signal: AbortSignal.timeout(10_000),
        })
        return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') ?? 'application/json' } })
      } catch (e) {
        // Named, not swallowed: an identity proxy that fails silently makes every
        // downstream 401 look like a bad key rather than an unreachable validator.
        return Response.json({ error: 'identity proxy failed', upstream: target, detail: String((e as Error)?.message ?? e) }, { status: 502 })
      }
    }
    if (u.pathname === '/anchors' && req.method === 'GET') {
      // What this substrate learned about where it joined, readable at use time. A
      // URL-joined spoke freezes its anchors in env; a multiaddr-joined one holds them
      // here, so nothing depends on a file that gen-env rewrites every boot.
      return Response.json({
        peer_multiaddr: PEER_MULTIADDR || null,
        learned: LEARNED_ANCHORS,
        relay: RELAY || null,
        source: LEARNED_ANCHORS ? 'peer:substrateBootstrap over libp2p' : (RELAY ? 'http:/bootstrap or env' : 'none'),
      })
    }
    if (u.pathname === '/egress/resolve' && req.method === 'POST') {
      try {
        const body = (await req.json().catch(() => ({}))) as any
        // Target may arrive three ways so the caller can stay maximally thin: a
        // ?target= query param (lets a caller route purely by URL — no header/body
        // threading needed, the goal-host path), an X-Libp2p-Target header, or
        // body.target. Query param wins, then header, then body.
        const target = u.searchParams.get('target') || req.headers.get('x-libp2p-target') || body?.target || ''
        let pointer = body?.impulse?.pointer ?? body?.impulse ?? body?.pointer ?? body
        // Per-vessel addressing: ?vessel=<vesselId[@substrate]> (or body.vessel) names
        // the exact vessel on the target substrate — the remote ingress routes to it
        // instead of shape-owner lookup, so duplicate shapes stay distinguishable.
        const targetVessel = u.searchParams.get('vessel') || body?.vessel || ''
        if (targetVessel) pointer = { ...pointer, _fedTargetVessel: targetVessel }
        // A target is normally required, but a caller that names ?vessel= can route
        // WITHOUT one: the destination is reached over a LIVE hub circuit chosen from
        // our own connection table (the repair branch below), and _fedTargetVessel
        // selects the vessel on the far side. Only reject when we have NEITHER.
        if (!target && !targetVessel) return Response.json({ error: 'missing libp2p target (?target= query, X-Libp2p-Target header, or body.target) or ?vessel=' }, { status: 400 })
        // resolveViaHttp returns the peer's { content, metadata } (serveResolveHttp wraps
        // it that way). Pass it through verbatim so the caller's resolve parsing applies.
        const errOf = (e: any) => ({ error: String((e as Error)?.message ?? e) })
        let res: any = null
        if (target && String(target).includes(vl.peerId)) {
          // Self-target: a hub-mirror discovery row for THIS substrate carries our own
          // circuit. libp2p refuses the dial ("Can not dial self"), so serve it exactly
          // as our own ingress would — locally — instead of erroring through the relay.
          res = { content: await resolveHandler(pointer), metadata: { shape: String((pointer as any)?.type ?? '') } }
        } else if (target) {
          console.log('[fed-transport] egress/resolve -> ' + String((pointer as any)?.type ?? '?') + ' via ' + String(target).slice(-20))
          res = await resolveOverLibp2p(String(target), pointer).catch(errOf)
        }
        // Circuit Relay v2 returns NO_RESERVATION as the RELAY's verdict about the
        // DESTINATION peer (no reservation, or no live relay↔destination connection) —
        // it says nothing about OUR reservation. Tearing down our own healthy relay
        // connection here cannot repair the far side; under continuous egress traffic it
        // becomes a self-sustaining storm (each close fails the next in-flight egress
        // with "failed to connect via relay" → another teardown → …) that also drops
        // OUR ingress reachability, spreading the flap to the peer substrate. Only
        // refresh when OUR side is demonstrably down, then retry once.
        if (target && res?.error && /NO_RESERVATION|failed to connect via relay/i.test(String(res.error))) {
          egressNoReservationCount++
          // Counter deltas must be attributable from the journal (observed: +153
          // on the health counter with ZERO correlatable log lines). Rate-limited:
          // first event per minute logs; a burst raises only the counter.
          if (Date.now() - lastEgressNoResLogAt >= 60_000) {
            lastEgressNoResLogAt = Date.now()
            console.log(`[fed-transport] egress NO_RESERVATION/relay-connect fail #${egressNoReservationCount} type=${String((pointer as any)?.type ?? '?')} target=…${String(target).slice(-20)}`)
          }
          if (!currentCircuit() || relayConnections().length === 0) await redialRelay('egress relay-side down')
          res = await resolveOverLibp2p(String(target), pointer).catch(errOf)
        }
        // Fail-open target repair: a relay-only circuit target (…/p2p-circuit with no
        // trailing /p2p/<dest> — e.g. a truncated discovery advertisement) is undialable
        // and errors above; a ?vessel=-only call arrives with no target at all. In both
        // cases, when a vessel is named, retry against each LIVE full circuit from our own
        // connection table (dialable addrs carrying /p2p-circuit/p2p/<dest>) and let
        // _fedTargetVessel route on the far side. Healthy full-target resolves return
        // above and never enter this branch. Reads live connections — hardcodes no peer
        // (law 11: location independence).
        if ((!res || res.error) && targetVessel) {
          const conns = ((vl.health() as any)?.connections ?? []) as Array<{ addr: string }>
          const circuits = [...new Set(conns.map((c) => String(c.addr)).filter((a) => a.includes('/p2p-circuit/p2p/') && !a.includes(vl.peerId)))]
          // A ?vessel= call with no explicit target fans across every live circuit. A peer
          // that does NOT own the named vessel answers with a nested content-error (e.g.
          // the obsidian sidecar: {content:{error:'unknown obsidian shape: llm_completion'}})
          // — that is NOT a hit. Accepting it lands the call on the wrong substrate: a hub
          // llm arm has no dialable circuit of its own (loopback, no multiaddr), so a naive
          // first-success loop settles on whichever peer replied FIRST (often obsidian).
          // Skip nested content-errors and keep trying so the call reaches the circuit whose
          // substrate actually owns _fedTargetVessel and proxies to it locally — this is what
          // makes cross-substrate LLM spill ("any funded arm in the network suffices") work.
          // A NON-SERVING OWNER IS NOT A HIT EITHER.
          //
          // This predicate used to look only at content.error, and only when the envelope had
          // no shape/body/value. A peer that OWNS the named vessel but cannot serve answers
          // with a fully-formed envelope whose failure sits one level DOWN:
          //
          //   {content:{shape:'llm_completion',produced_by:'…@spoke-739b76f1',
          //             body:{resolved:false,error:'no llm arm is currently servable …'}}}
          //
          // content.error is undefined there, so isHollowErr was false, the loop took the
          // FAILURE as its hit and stopped — never trying the remaining circuits. Measured
          // 2026-08-18: a substrate on neither this host nor the hub had joined through the
          // public relay advertising llm arms it could not serve. Every llm_completion in the
          // fleet settled on it, the ReAct floor logged 'dispatch FAILED http=500' on all 8
          // iterations, and ordinary human goals failed while three WORKING arms sat on the
          // hub's circuit, later in the very list this loop was walking.
          //
          // Keeping the cross-substrate spill intact is the point ("any funded arm in the
          // network suffices"); a spill that settles on an arm which just said it cannot serve
          // is not spill, it is a stop. Recognising the nested refusal is what lets the loop
          // walk PAST a non-serving owner to one that answers.
          const nestedRefusal = (r: any) => {
            const c = r?.content
            if (!c || typeof c !== 'object') return false
            const b = (c as any).body
            if (!b || typeof b !== 'object') return false
            return typeof b.error === 'string' || b.resolved === false
          }
          const isHollowErr = (r: any) => (r?.content && typeof r.content === 'object' && (r.content as any).error
            && !('shape' in r.content) && !('body' in r.content) && !('value' in r.content))
            || nestedRefusal(r)
          let reached = false
          for (const a of circuits) {
            const alt = await resolveOverLibp2p(a, pointer).catch(errOf)
            if (alt && !alt.error && !isHollowErr(alt)) { console.log('[fed-transport] egress repair -> ' + String((pointer as any)?.type ?? '?') + ' via live circuit …' + a.slice(-16)); res = alt; reached = true; break }
            res = res ?? alt
          }
          // DEMAND-DRIVEN RECOVERY (law 5): the named vessel could not be reached over ANY
          // live circuit — either the circuit set has DRAINED (0 peer circuits) or the only
          // live peers are non-owning (they answer with the nested content-error skipped
          // above). Both mean the path to the owning substrate is gone while our reservation
          // still looks valid, and the phantom watchdog would not act for up to 2 ticks
          // (~10 min). Kick a re-dial NOW so a fresh circuit forms and the NEXT request
          // recovers in seconds. Storm-safe: the 'egress' prefix collapses a burst to one
          // dial per 30s and the redialing guard serializes; futile-but-harmless when the
          // peer substrate itself is down (rate-limited), fast recovery the moment it returns.
          if (!reached) void redialRelay('egress could not reach ' + targetVessel + ' over any live circuit')
        }
        // A peer's ingress reports ITS failures inside content ({content:{error:...}}) —
        // returning those as 200 lets genuine failures masquerade as reaches downstream
        // (hollow-reach pollution). Treat content that is nothing but an error as a 502.
        const contentErr = res?.content && typeof res.content === 'object' && (res.content as any).error
          && !('shape' in res.content) && !('body' in res.content) && !('value' in res.content)
        return Response.json(res ?? { error: 'empty libp2p resolve' }, { status: (res && !res.error && !contentErr) ? 200 : 502 })
      } catch (e) {
        return Response.json({ error: 'libp2p egress failed: ' + String((e as Error)?.message ?? e) }, { status: 502 })
      }
    }
    // Local resolve surface matching the resolve_endpoint this vessel (and every
    // capability row mirrored under its endpoint) advertises in discovery. A
    // mirrored row's URL — http://127.0.0.1:8401/v2/impulses/resolve — is thereby
    // valid VERBATIM on any substrate: the local transport serves the local owner
    // or hops once over libp2p to the owning substrate (proxyToLocalOwner).
    if (u.pathname === '/v2/impulses/resolve' && req.method === 'POST') {
      try {
        const body = (await req.json().catch(() => ({}))) as any
        const pointer = body?.impulse?.pointer ?? body?.impulse ?? body?.pointer ?? body
        console.log('[fed-transport] local/resolve -> ' + String((pointer as any)?.type ?? '?'))
        const res = await resolveHandler(pointer)
        return Response.json({ content: res, metadata: { shape: String((pointer as any)?.type ?? '') } }, { status: 200 })
      } catch (e) {
        return Response.json({ error: 'local resolve failed: ' + String((e as Error)?.message ?? e) }, { status: 502 })
      }
    }
    return new Response('not found', { status: 404 })
  },
})

async function register() {
  try {
    const r = await fetch(DISCOVERY + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + API_KEY },
      body: JSON.stringify({
        vesselId: VESSEL_ID, vesselName: VESSEL_ID, version: '0.1.0',
        endpoint: `http://127.0.0.1:${HEALTH_PORT}`,           // HTTP surface (health + self-recovery probe)
        // federation_echo is NOT advertised. It is a test instrument for the probe's
        // payload matrix, which dials this transport DIRECTLY by multiaddr and gets it
        // answered inline by resolveHandler — discovery was never on its path.
        //
        // Advertising it was actively harmful. The probe exercises federation_echo eight
        // times per sweep (one per payload class), so its posterior climbed fast, and the
        // walk began selecting `satisfier:federation_echo` for goals targeting
        // federation_verification_report — both shapes live on this vessel and the echo arm
        // simply looked better. Called with no payload it returns empty, grades HOLLOW
        // ("the report was not successfully retrieved"), gets suppressed, and the walk drops
        // to the ReAct floor where it improvises curl against a placeholder host. No sweep
        // ever spawns, because nothing reaches this transport.
        //
        // The measuring instrument had earned enough credit to be mistaken for the thing it
        // measures. Keeping it undiscoverable is the fix: it stays fully usable by direct
        // dial, and stops competing for selection it should never have been eligible for.
        shapes: ['federation_probe', 'federation_verification_report', 'substrateBootstrap', ...(EXTRA_SHAPE ? [EXTRA_SHAPE] : [])],
        resolve_endpoint: '/v2/impulses/resolve', resolve_request_format: 'pointer', auth_scheme: 'none',
        protocol: 'libp2p',                          // signals libp2p-overlay reachability
        libp2p_peer_id: vl.peerId,                   // proper discovery-contract fields (not metadata —
        libp2p_multiaddr: advertisedAddrs(),         // discovery doesn't echo metadata in capability responses)
                                                     // circuit first, then direct listen addrs (direct ≡ punchthrough)
        shape_descriptions: { federation_probe: 'libp2p-reachable probe shape served by the federation transport vessel' },
      }),
    })
    console.log('[fed-transport] register ->', r.status)
    if (r.status === 401 || r.status === 403) void emitJoinHealth('auth_rejected', 'local /register -> ' + r.status)
  } catch (e) { console.log('[fed-transport] register err', String(e)) }
}

// Federation-join health detector (law 6): a stale-key / auth-rejected join must fail
// LOUDLY as a queryable signal, not silently blank a downstream panel. Emits a shaped
// federation_join_health observation to activity-api; guarded and never throws (must not
// disturb the process guards). Emitted only on the failure path — silent success is unchanged.
const ACTIVITY_API = (process.env.ACTIVITY_API_URL || process.env.ACTIVITY_API_ENDPOINT || 'http://127.0.0.1:8080').replace(/\/$/, '')
async function emitJoinHealth(state: string, detail: string) {
  if (!ACTIVITY_API) return
  try {
    await fetch(ACTIVITY_API + '/v2/impulses/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + API_KEY },
      body: JSON.stringify({ impulse: { type: 'federation_join_health', substrate: SUBSTRATE_ID, vessel: VESSEL_ID, state, detail, ts: Date.now() } }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (e) { console.error('[fed-transport] join-health emit failed', String(e)) }
}
// HUB NAMESPACE MIRROR: when HUB_DISCOVERY_URL is set, this substrate's capability
// surface is mirrored into the HUB discovery under a substrate-unique vesselId, with
// the libp2p circuit multiaddr as the reachability contract. Peers whose discovery
// fans out to the hub then see (and can resolve, via the ingress proxy above) every
// shape this substrate owns — the "same discovery namespace" leg of federation.
// The mirror excludes this transport's own probe shapes (already registered locally
// on the peer side) and refreshes on the same TTL cadence as the local registration.
const HUB_DISCOVERY = (process.env.HUB_DISCOVERY_URL || '').replace(/\/$/, '')
const SUBSTRATE_ID = process.env.FED_SUBSTRATE_ID || hostname()
// Self-mirror guard: on the hub itself HUB_DISCOVERY_URL points at the LOCAL
// discovery (localhost:8100), so the namespace mirror would re-register every
// native vessel as `<vessel>@<substrate>` in its own registry — 8 observed
// duplicate rows that split shape-selection traffic and route purely-local
// resolves through this facade for nothing. Mirroring is only meaningful into
// a DIFFERENT registry; loopback-host equality (localhost ≡ 127.0.0.1, same
// port) identifies the self case.
const SELF_MIRROR = (() => {
  if (!HUB_DISCOVERY) return false
  try {
    const norm = (u: string) => {
      const p = new URL(u)
      const host = p.hostname === 'localhost' ? '127.0.0.1' : p.hostname
      return `${host}:${p.port || (p.protocol === 'https:' ? '443' : '80')}`
    }
    return norm(HUB_DISCOVERY) === norm(DISCOVERY)
  } catch { return false }
})()
if (SELF_MIRROR) console.log(`[fed-transport] hub mirror disabled: HUB_DISCOVERY_URL (${HUB_DISCOVERY}) is this substrate's own discovery — nothing to federate into`)
// Deployments set FED_VESSEL_ID already substrate-qualified (federation-transport-vessel@min-proof);
// appending unconditionally minted doubled hub rows like …@min-proof@min-proof.
const HUB_VESSEL_ID = VESSEL_ID.endsWith(`@${SUBSTRATE_ID}`) ? VESSEL_ID : `${VESSEL_ID}@${SUBSTRATE_ID}`

// The mirror is PER-VESSEL (2026-07-11): each plain-HTTP local vessel gets its own
// `<vesselId>@<substrate>` row in the hub namespace, carrying that vessel's shapes and
// THIS transport's circuit multiaddr as the reachability contract. This is what makes
// every vessel in the fleet individually addressable and health-scoreable from any
// substrate (bidirectional vessel↔vessel via discovery + the libp2p sidecar), and it
// lets DUPLICATE vessels (two activity-apis, two goal-hosts) coexist as distinct rows
// instead of colliding on one blob mirror. A remote caller dials the circuit and names
// its target via pointer._fedTargetVessel (the ingress proxy routes to that vessel).
async function localVesselRows(): Promise<Array<{ vesselId: string; shapes: string[] }>> {
  const vessels = await localDiscoveryResolve({ type: 'vesselRegistry' })
  const rows: Array<{ vesselId: string; shapes: string[] }> = []
  for (const v of vessels) {
    const id = String(v?.vesselId ?? '')
    // Skip ourselves, our own mirror row, any libp2p-protocol entry (another
    // substrate's mirror — re-exporting mirrored shapes would ping-pong namespaces),
    // and already-qualified rows (a `x@substrate` id is some substrate's mirror).
    if (!id || id.startsWith(VESSEL_ID) || v?.protocol === 'libp2p' || id.includes('@')) continue
    // Liveness gate: never mirror a vessel whose only endpoint is cross-host-dead
    // (host.docker.internal), else the hub namespace grows a `<id>@<substrate>` row
    // whose circuit re-proxies to an unreachable HTTP owner — a poison producer that
    // outlives discovery's TTL and shadows the vessel's real circuit row.
    if (HOST_LOCAL_UNREACHABLE.test(String(v?.endpoint ?? ''))) continue
    const shapes = (v?.shapes ?? []).filter((s: any) => typeof s === 'string' && s)
    if (shapes.length === 0) continue
    rows.push({ vesselId: id, shapes })
  }
  return rows
}

// A lost reservation must degrade OBSERVABLY, not silently: warn loudly when the hub
// mirror is skipped for want of a circuit, but throttled (once per window while the
// outage persists — the tick fires every 120s and a warn-per-tick is log spam).
let noCircuitWarnedAt = 0
const NO_CIRCUIT_WARN_WINDOW_MS = 600_000

// CROSS-BOUNDARY DE-ADVERTISE. The mirror was register-only, so a local vessel that went
// away kept its `<vessel>@<substrate>` row on the HUB until discovery's 5-min TTL expired
// it. For up to five minutes every peer in the network saw a producer that no longer
// exists, selected it (a mirror row advertises the shape and a live circuit, so it wins
// against nothing), dialled our circuit, and got 'no local or remote producer' from
// proxyToLocalOwner — a hollow reach attributed to the WRONG substrate. Withdrawal must
// cross the boundary as explicitly as advertisement does.
//
// The set is what we ACTUALLY registered on the previous tick, not what we think we own:
// diffing against a recomputed expectation would delete rows we never created (e.g. another
// substrate's identically-named vessel) if the two ever disagreed.
let mirroredVesselIds = new Set<string>()
async function deadvertiseAtHub(gone: string[]): Promise<void> {
  if (gone.length === 0) return
  const results = await Promise.all(gone.map(async (id) => {
    try {
      const r = await fetch(`${HUB_DISCOVERY}/vessels/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: 'ApiKey ' + HUB_API_KEY },
        signal: AbortSignal.timeout(5000),
      })
      // 404 is SUCCESS for a withdrawal: the row is already gone (TTL beat us, or a
      // previous tick's DELETE landed). Treating it as failure would log an error every
      // tick for a state that is exactly what we asked for.
      return `${id}:${r.status}`
    } catch (e) { return `${id}:err:${String((e as Error)?.message ?? e)}` }
  }))
  const failed = results.filter((s) => !/:(200|202|204|404)$/.test(s))
  console.log(`[fed-transport] hub-deadvertise (${results.length} rows) -> ${failed.length === 0 ? 'all ok' : 'FAILED ' + failed.join(', ')}`)
}

async function registerAtHub() {
  if (!HUB_DISCOVERY) return  // SELF_MIRROR (hub) now still runs: advertises hub-native vessels with the circuit for inbound peer dials (see per-vessel rows below; own anchor row skipped)
  const liveCircuit = currentCircuit()
  if (!liveCircuit) {
    if (Date.now() - noCircuitWarnedAt >= NO_CIRCUIT_WARN_WINDOW_MS) {
      noCircuitWarnedAt = Date.now()
      console.error(`[federation] ${RELAY ? 'no relay reservation' : 'no relay anchor (direct-only)'} — remote visibility suspended (hub mirror skipped; refreshes immediately on reacquisition)`)
    }
    return
  }
  noCircuitWarnedAt = 0 // circuit is back — the NEXT outage warns immediately again
  try {
    const rows = await localVesselRows()
    if (rows.length === 0) return // local registry mid-repopulation — keep the last hub TTL alive next tick
    // The transport's own row anchors the substrate ingress (probe shape only — shape
    // traffic belongs to the per-vessel rows below).
    const registrations = [
      // federation_verification_report is DELIBERATELY NOT MIRRORED to the hub.
      //
      // It answers "what is THIS substrate's overlay state", so it is meaningful only from
      // the substrate that measured it. Advertising it into the hub namespace made all
      // three transports offer the same shape, and discovery has no reason to prefer the
      // local one — every row is protocol:libp2p, so the prefer-direct rule cannot break
      // the tie. Measured: the walk resolved it via EGRESS to a peer
      // (`egress/resolve -> federation_verification_report via LM3t9…`), which returned
      // that peer's view and spawned no sweep here. Cadence kept firing — alpha climbed
      // 10.5 -> 19.5, roughly eighteen fires — while not one sweep landed, because every
      // fire was answered by the wrong substrate.
      //
      // Kept in the LOCAL register() below, so a resolve on this substrate always reaches
      // this substrate's own transport. A cross-substrate view is a separate question and
      // would need a substrate-scoped pointer, not an ambiguous shared shape.
      ...(SELF_MIRROR ? [] : [{ vesselId: HUB_VESSEL_ID, shapes: ['federation_probe', ...(EXTRA_SHAPE ? [EXTRA_SHAPE] : [])] }]),
      ...rows.map((r) => ({ vesselId: `${r.vesselId}@${SUBSTRATE_ID}`, shapes: r.shapes })),
    ]
    const results = await Promise.all(registrations.map(async (reg) => {
      const r = await fetch(HUB_DISCOVERY + '/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + HUB_API_KEY },
        body: JSON.stringify({
          vesselId: reg.vesselId, vesselName: reg.vesselId, version: '0.1.0',
          endpoint: `http://127.0.0.1:${HEALTH_PORT}`, // local-only surface; reachability is the circuit below
          shapes: reg.shapes,
          resolve_endpoint: '/v2/impulses/resolve', resolve_request_format: 'pointer', auth_scheme: 'none',
          protocol: 'libp2p',
          libp2p_peer_id: vl.peerId,
          // Circuit first (remote-safe for [0]-consumers), then direct listen addrs —
          // direct ≡ punchthrough: a same-host/same-net peer dials direct, no relay.
          libp2p_multiaddr: [liveCircuit, ...currentDirectAddrs()],
        }),
      }).catch((e) => ({ status: 'err:' + String((e as Error)?.message ?? e) } as any))
      return `${reg.vesselId}:${r.status}`
    }))
    const failed = results.filter((s) => !/:(200|201)$/.test(s))
    console.log(`[fed-transport] hub-register per-vessel (${results.length} rows) -> ${failed.length === 0 ? 'all ok' : 'FAILED ' + failed.join(', ')}`)
    if (failed.some((s) => /:40[13]$/.test(s))) void emitJoinHealth('auth_rejected', 'hub /register FAILED ' + failed.join(', '))
    // Withdraw what we advertised last tick and no longer advertise. Reached only AFTER
    // both guards above, and that placement is the whole safety argument:
    //   • no live circuit  -> early return. A dropped reservation is a US problem, not a
    //     THEM problem: the vessels are all still there, we just can't be reached. Deleting
    //     the fleet's hub rows on our own outage would turn a reachability blip into a
    //     registry wipe that only a full re-register repairs.
    //   • rows.length === 0 -> early return. The local registry repopulating (a discovery
    //     restart empties an in-memory, 5-min-TTL registry) looks identical to "every
    //     vessel left". The existing comment already chose to ride the hub TTL through it;
    //     de-advertising there would amplify a local blip into a fleet-wide withdrawal.
    // So a row is deleted only when we held a circuit, saw a NON-EMPTY local registry, and
    // that vessel was absent from it — i.e. genuine departure, not instrument failure.
    // SELF_MIRROR is respected implicitly: under it the anchor row is never registered, so
    // it never enters the set and can never be deleted.
    const currentIds = new Set(registrations.map((r) => r.vesselId))
    await deadvertiseAtHub([...mirroredVesselIds].filter((id) => !currentIds.has(id)))
    mirroredVesselIds = currentIds
  } catch (e) { console.log('[fed-transport] hub-register err', String(e)) }
}



// ── THE AUTHORITATIVE RESERVATION STATE ──────────────────────────────────────────────
//
// `activeReservations` in the transport-health snapshot counts /p2p-circuit LISTEN
// ADDRESSES. A listen address is managed by the relay LISTENER and survives the relay
// dropping the reservation behind it — so a transport reports a reservation it does not
// hold and keeps advertising a circuit nobody can dial.
//
// Measured unattended by the federation oracle: peer-fixture-1 self-reported
// `activeReservations: 1` with a circuit multiaddr, while a dial from an independent peer
// got `NO_RESERVATION` from the relay, and seven of its rows were still served as fresh by
// the hub. The health field was not stale — it was answering a different question than the
// one being asked of it.
//
// The circuit-relay-v2 transport keeps the real thing: a ReservationStore whose
// `reservations` Map holds one entry per relay that actually granted us one, each carrying
// the reservation's `expire`, and the Map is emptied on `relay:removed`. So ask it.
//
// Access path verified empirically, not assumed:
//   node.components.transportManager.getTransports() -> the entry carrying .reservationStore
// The sibling node.transportManager is undefined; only the components path resolves.

// Resolve the probe script from a location the substrate's own branch switching cannot
// remove. existsSync rather than a try/catch on spawn: a missing file must be visible as a
// named choice in the log, not as a spawn error attributed to the probe itself.
function probeScriptPath(): string {
  const candidates = [
    process.env.FED_PROBE_PATH || '',
    '/usr/local/lib/substrate/federation-probe-tick.ts',
    new URL('./federation-probe-tick.ts', import.meta.url).pathname,
  ].filter(Boolean)
  // The catch USED to be silent, and that hid a real defect for a full cycle: `existsSync`
  // was never imported, so every candidate threw ReferenceError, every throw was swallowed
  // here, and the function fell through to the last candidate — the in-workspace copy this
  // whole function exists to stop depending on. Nothing typechecks scripts/, so a bare
  // undefined inside a silent catch is invisible to every gate we have. Say why a candidate
  // was skipped: a probe that cannot be STAT'd and a probe that is ABSENT are different
  // failures and must not read the same.
  for (const c of candidates) {
    try { if (existsSync(c)) return c } catch (e) {
      console.error(`[fed-transport] probe candidate ${c} could not be checked: ${String((e as Error)?.message ?? e)}`)
    }
  }
  console.error('[fed-transport] probe script not found in any of: ' + candidates.join(', '))
  return candidates[candidates.length - 1]!
}

function reservationTruth(): { held: number; relays: string[]; expiresInMs: number | null } {
  try {
    const ts = (vl.node as any)?.components?.transportManager?.getTransports?.() ?? []
    for (const t of ts) {
      const map = (t as any)?.reservationStore?.reservations
      if (!map || typeof map.size !== 'number') continue
      const relays: string[] = []
      let soonest: number | null = null
      for (const [k, v] of map) {
        relays.push(String(k))
        // `expire` is a protobuf uint64 and arrives as a BigInt. Number() it before any
        // arithmetic or serialisation: JSON.stringify THROWS on BigInt, which would take
        // the whole /health response down — turning an observability improvement into an
        // outage of the thing being observed.
        const exp = (v as any)?.reservation?.expire
        if (exp != null) {
          const ms = Number(exp) * 1000 - Date.now()
          if (soonest == null || ms < soonest) soonest = ms
        }
      }
      return { held: map.size, relays, expiresInMs: soonest }
    }
  } catch { /* introspection is best-effort and must never break health */ }
  return { held: -1, relays: [], expiresInMs: null }  // -1 = unreadable, distinct from 0 = none held
}

// ── GRACEFUL DEPARTURE ───────────────────────────────────────────────────────────────
// A whole substrate leaving used to take its hub rows with it only via the 5-minute TTL.
// registerAtHub's de-advertise covers a VESSEL that stops while the transport keeps
// running; it cannot cover the transport itself going away, because the code that would
// withdraw is the code that is exiting. Measured on a real departure: the hub kept
// advertising all 8 rows of a stopped peer, and resolving one returned HTTP 502 in 29ms —
// bounded, but a goal walk selects a dead producer for up to the TTL.
//
// So withdraw on the way out. This covers a GRACEFUL stop (systemctl stop, docker stop,
// a redeploy). A kill -9 or a host loss still decays on TTL, which is the correct fallback
// and is why the TTL exists — this narrows the window, it does not remove the need for one.
//
// Bounded, because shutdown must not hang: systemd will SIGKILL after TimeoutStopSec and a
// withdraw that blocks would simply become the kill it was trying to avoid.
let shuttingDown = false
async function withdrawAndExit(sig: string): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  const ids = [...mirroredVesselIds]
  console.log(`[fed-transport] ${sig}: withdrawing ${ids.length} mirrored row(s) from the hub before exit`)
  try {
    await Promise.race([
      deadvertiseAtHub(ids),
      new Promise((res) => setTimeout(res, 5000)),
    ])
    console.log(`[fed-transport] ${sig}: withdrawal complete`)
  } catch (e) {
    console.error(`[fed-transport] ${sig}: withdrawal failed (rows will decay on the hub TTL):`, String((e as Error)?.message ?? e))
  }
  process.exit(0)
}
process.on('SIGTERM', () => { void withdrawAndExit('SIGTERM') })
process.on('SIGINT', () => { void withdrawAndExit('SIGINT') })

await register()
await registerAtHub()
setInterval(register, 120_000) // refresh discovery TTL
setInterval(registerAtHub, 120_000)

// RESERVATION (RE)ACQUISITION HOOK: VesselLibp2p exposes no reservation event, so the
// acquisition path is observed as currentCircuit() transitioning empty → non-empty
// (the circuit-relay transport surfaces the /p2p-circuit addr the moment a
// reservation lands). On that transition, refresh the local + hub registrations
// IMMEDIATELY instead of leaving the substrate's remote presence blank for up to a
// full 120s tick. The reverse transition logs the loss loudly (once — transition-
// edged, not per-poll).
let hadCircuit = !!currentCircuit()
setInterval(() => {
  const has = !!currentCircuit()
  if (has && !hadCircuit) {
    console.log('[federation] relay reservation (re)acquired — refreshing local + hub registrations immediately')
    void register()
    void registerAtHub()
  } else if (!has && hadCircuit) {
    console.error('[federation] relay reservation lost — remote visibility suspended until reacquired')
  }
  hadCircuit = has
}, 5_000)

// ── RELAY RESERVATION WATCHDOG ──────────────────────────────────────────────
// createVesselLibp2p dials the relay ONCE at startup for a bounded (~1h) reservation
// that nothing renews (a plain re-dial to a connected relay is a no-op). Force a fresh
// reservation by CLOSE + RE-DIAL: reactively on circuit loss / observed NO_RESERVATION,
// and proactively well inside the ~1h TTL, so the circuit never empties and hub egress
// never sees NO_RESERVATION. Re-advertisement is handled by the transition watcher above.
// Derived at CALL time, not captured once: RELAY is mutable now (adoptAnchor may set it
// long after startup), and a const snapshot taken while relay-less would stay '' forever —
// the watchdog would then treat an adopted relay's connections as absent and redial in a
// loop. Same class as the currentCircuit() capture defect documented above.
const relayPeer = () => RELAY.match(/\/p2p\/([^/]+)/)?.[1] ?? ''
const relayConnections = () => {
  const p = relayPeer()
  return p ? vl.node.getConnections().filter((c) => c.remotePeer.toString() === p) : []
}
let redialing = false
let lastReserveAt = Date.now()
let lastRedialAttemptAt = 0
let redialCount = 0
let egressNoReservationCount = 0
let lastEgressNoResLogAt = 0
let lastRedialReason = ''
async function redialRelay(reason: string): Promise<void> {
  if (redialing) return
  // No anchor ⇒ nothing to dial. Without this guard every caller below (the egress repair
  // path, the phantom watchdog's `circuit empty` branch) would reach multiaddr('') and
  // throw once per tick / per failing egress on a node that is working exactly as designed.
  // Acquiring an anchor is adoptAnchor()'s job, not a re-dial's.
  if (!RELAY) return
  // Reactive (egress-triggered) redials are rate-limited so a burst of failing egress
  // calls collapses into ONE teardown, never one per request: closing the relay
  // connection under concurrent traffic is what turned a single transient error into
  // a sustained reservation flap. The 10-min watchdog still covers a genuinely
  // stuck-down state. The stamp covers FAILED attempts too — while the relay itself is
  // unreachable, lastReserveAt never advances, and without the attempt stamp every
  // failing egress would re-enter close+dial churn against the dead relay.
  if (reason.startsWith('egress') && Date.now() - Math.max(lastReserveAt, lastRedialAttemptAt) < 30_000) return
  lastRedialAttemptAt = Date.now()
  redialCount++
  lastRedialReason = reason
  redialing = true
  try {
    // Close any LIVE relay connection first — a dial while connected returns the existing
    // connection and does NOT re-reserve. If the relay connection is already gone this
    // closes nothing and the dial re-establishes connection + reservation.
    await Promise.allSettled(relayConnections().map((c) => c.close()))
    await vl.node.dial(multiaddr(RELAY))
    lastReserveAt = Date.now()
    console.log(`[federation] relay re-dial (${reason}) — reservation refreshed; circuit=${currentCircuit() ? 'up' : '(pending)'}`)
  } catch (e) {
    console.error(`[federation] relay re-dial (${reason}) failed:`, (e as Error)?.message ?? String(e))
  } finally {
    redialing = false
  }
}
// PHANTOM-RESERVATION DETECTION: after a relay restart, this client can keep
// "renewing" a reservation the new relay process refuses to honor for inbound HOPs
// (observed live: TTL climbing client-side while every peer egress to us returned
// NO_RESERVATION for ~90 min — a silent one-directional partition invisible to our
// own health). The local tell is the circuit CONNECTIONS emptying while the
// reservation still claims valid: relayed peers ride /p2p-circuit conns, and when
// the relay stops honoring us those conns drain and never return. Two consecutive
// 10-min ticks in that state force a fresh dial (close + re-dial re-reserves against
// the relay's live state). Bounded cost: an idle node with genuinely no inbound
// circuits redials at most every 20 min; a partitioned node self-heals within 20 min
// instead of never.
let phantomStrikes = 0
setInterval(() => {
  // Direct-only is a healthy steady state, not a degraded one — there is no reservation to
  // hold and no phantom to detect. Bail before the `circuit empty` branch so a relay-less
  // node doesn't accumulate redial attempts against an anchor it does not have.
  if (!RELAY) return
  const circuitUp = !!currentCircuit()
  const relayUp = relayConnections().length > 0
  if (!circuitUp || !relayUp) { phantomStrikes = 0; void redialRelay(!circuitUp ? 'circuit empty' : 'relay connection gone'); return }
  // A LISTEN ADDRESS WITH NO HELD RESERVATION IS A PHANTOM, AND IT IS KNOWABLE NOW —
  // no strikes needed. This is not an inference from quiet traffic; it is the relay client's
  // own bookkeeping saying it holds nothing. The strike-based branch below still covers the
  // cases this cannot decide: the store being unreadable (held === -1), or a genuinely held
  // reservation whose circuits stay quiet.
  const truth = reservationTruth()
  if (truth.held === 0) {
    phantomStrikes = 0
    void redialRelay('PHANTOM CONFIRMED: a /p2p-circuit listen address is advertised while the reservation store holds 0 reservations')
    return
  }
  // A HELD RESERVATION MEANS THERE IS NO PHANTOM, WHATEVER THE TRAFFIC LOOKS LIKE.
  //
  // The traffic heuristic below reads "no inbound circuit connections for 2 ticks" as a
  // lost reservation. That inference is wrong whenever peers reach us WITHOUT using the
  // circuit — which is the normal case on a shared host or LAN, where DCUtR upgrades the
  // connection to direct and the circuit legitimately carries nothing.
  //
  // Measured on this hub with two healthy federated peers: 14 `circuit=(pending)` redials
  // in three hours and ZERO reservation re-acquisitions logged — the watchdog firing every
  // 10 minutes against a reservation that was never lost. Each redial closes and re-dials
  // the relay, opening a window where the circuit is empty and inbound dials fail with
  // NO_RESERVATION. The detector was manufacturing the outage it existed to catch.
  //
  // So when the client's own store says a reservation is held, that settles it. The traffic
  // heuristic survives only for the case the store cannot be read (held === -1), where an
  // imperfect signal beats none.
  if (truth.held > 0) { phantomStrikes = 0; return }
  const circuitConns = vl.node.getConnections().filter((c) => c.remoteAddr?.toString().includes('p2p-circuit'))
  if (circuitConns.length === 0) {
    phantomStrikes++
    if (phantomStrikes >= 2) { phantomStrikes = 0; void redialRelay('phantom-reservation suspicion: reservation claims valid but no circuit peers for 2 ticks') }
  } else phantomStrikes = 0
  // No scheduled pre-expiry teardown otherwise: the circuit-relay client renews the
  // reservation IN PLACE over the live connection (verified: TTL stays ~full, renewal
  // cycle under 2 min); a timed close+redial only manufactures reservation blips. The
  // reactive branches above, the egress-triggered redial, and the client library's
  // TTL<50% re-reserve remain the recovery paths for genuine drops.
  // 5-min tick: the relay drops circuits fleet-wide in shared events (~every 2.2h
  // observed); with 2 strikes required, detection lag is the tick interval — at
  // 10 min the peer-facing blind window ran 20+ min (872 failed hub egresses in one
  // night). 5 min halves it; the idle-node worst case stays bounded (1 redial/10 min).
}, 300_000) // 5 min

// ── ANCHOR RE-ACQUISITION (relay-less → relayed, without a restart) ─────────────────
// The bootstrap is circular by construction: /bootstrap derives relay_multiaddrs from the
// circuits registered in that discovery, so the anchor a joining substrate needs does not
// exist until some transport already holds a reservation. Startup therefore cannot be the
// only chance to see one — a substrate that boots first (or boots while the hub is down)
// must be able to JOIN LATER, on its own, with no operator and no unit restart.
//
// THE API LIMITATION, STATED HONESTLY. createVesselLibp2p only pushes the generic
// '/p2p-circuit' listen address when relayMultiaddr is set (index.ts:257), and js-libp2p
// exposes no supported way to add a listen address to a started node. The circuit-relay
// transport makes reservations from its LISTENER, so simply dialling the relay on the
// existing node would open a connection and obtain NO reservation — a silent half-join
// (connected to the relay, unreachable through it) that looks fine in the connection table.
// Adoption therefore REPLACES the node. That is cheap and safe here:
//   • the peer id is derived from LIBP2P_IDENTITY, so it is byte-identical across the swap
//     — every hub row, every cached circuit target, every isSelfCircuit() check still holds;
//   • the direct listeners are ephemeral ports (localTcpPort unset ⇒ :0), so the new node
//     cannot collide with the old one, and the 120s re-register republishes the new addrs;
//   • Bun.serve() and the HTTP surface are untouched — /health and /egress/resolve never
//     stop answering.
// The new node is built and its handlers registered BEFORE the old one is stopped, so a
// construction failure leaves the working direct-only node in place and we simply retry.
// In-flight resolves on the old node are lost at the swap; that is one bounded blip against
// a substrate that would otherwise stay relay-less until a human noticed.
let adopting = false
async function adoptAnchor(anchor: string): Promise<void> {
  if (adopting || !anchor) return
  adopting = true
  const previous = vl
  try {
    console.log(`[fed-transport] relay anchor acquired (${anchor}) — rebuilding the libp2p node to adopt it (listen addrs are construction-time)`)
    const next = await buildNode(anchor)
    await serveResolve(next, resolveHandler)
    await serveResolveHttp(next, resolveHandler)
    RELAY = anchor        // must land before the swap: relayPeer()/redialRelay() read it
    vl = next
    await previous.stop().catch(() => {})
    // NOT re-registering here on purpose. The reservation lands asynchronously after the
    // dial, so registering now would advertise a node with no circuit yet. The existing
    // reservation-transition watcher polls currentCircuit() every 5s and fires register() +
    // registerAtHub() the moment empty → non-empty — the same path a reacquisition after a
    // relay bounce takes. One acquisition path, one refresh, no duplicate.
  } catch (e) {
    console.error(`[fed-transport] relay adoption failed (staying direct-only, will retry): ${(e as Error)?.message ?? String(e)}`)
  } finally {
    adopting = false
  }
}
// Backoff, not a fixed interval: while no anchor exists anywhere in the network this poll
// is pure futile traffic against discovery, and a hot 5s loop against a dead pinned host
// (each attempt costing a 5s timeout) is the storm class this file already fights on the
// egress path. Start at 15s, double to a 10-minute ceiling, reset on adoption.
const ANCHOR_POLL_MIN_MS = 15_000
const ANCHOR_POLL_MAX_MS = 600_000
let anchorPollMs = ANCHOR_POLL_MIN_MS
const pollForAnchor = async () => {
  if (!RELAY) {
    const anchor = await resolveAnchor()
    if (anchor) {
      await adoptAnchor(anchor)
      if (RELAY) anchorPollMs = ANCHOR_POLL_MIN_MS
    } else {
      anchorPollMs = Math.min(anchorPollMs * 2, ANCHOR_POLL_MAX_MS)
    }
  }
  // Keep the timer alive even once relayed: a relay we adopted can go away (the anchor is
  // a hint checked at use time, law 1), and if a future path ever clears RELAY the poller
  // is already running. Self-rescheduling rather than setInterval so the backoff is real —
  // setInterval cannot change its own period, and the previous generation of this file's
  // watchdogs learned that a fixed period is a floor on recovery latency, not a budget.
  setTimeout(() => void pollForAnchor(), RELAY ? ANCHOR_POLL_MAX_MS : anchorPollMs)
}
setTimeout(() => void pollForAnchor(), anchorPollMs)

console.log(`[fed-transport] up id=${VESSEL_ID} peer=${vl.peerId} health=:${HEALTH_PORT} circuit=${circuit || (RELAY ? '(none yet)' : '(direct-only, no relay anchor)')} hub=${HUB_DISCOVERY || '(no hub mirror)'}`)
