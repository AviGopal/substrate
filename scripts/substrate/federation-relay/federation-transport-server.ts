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
import { hostname } from 'node:os'
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
if (!RELAY && BOOTSTRAP_URL) {
  try {
    const r = await fetch(`${BOOTSTRAP_URL}/bootstrap`, { signal: AbortSignal.timeout(5000) })
    if (r.ok) {
      const b = await r.json() as { relay_multiaddrs?: string[] }
      if (b.relay_multiaddrs?.length) {
        RELAY = b.relay_multiaddrs[0]!
        console.log(`[fed-transport] relay from ${BOOTSTRAP_URL}/bootstrap: ${RELAY}`)
      }
    }
  } catch (e) { console.error(`[fed-transport] bootstrap fetch failed: ${(e as Error).message}`) }
}

if (!RELAY) { console.error('[fed-transport] ERROR: set RELAY_MULTIADDR or point BOOTSTRAP_URL/HUB_DISCOVERY_URL at a discovery serving /bootstrap'); process.exit(1) }

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

const vl: VesselLibp2p = await createVesselLibp2p({ vesselId: LIBP2P_IDENTITY, relayMultiaddr: RELAY, enableHttp: true })

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
function reachableHttp(v: any): boolean {
  return !HOST_LOCAL_UNREACHABLE.test(String(v?.endpoint ?? ''))
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
  const owner = vessels.find(
    (v: any) => v?.vesselId && !String(v.vesselId).startsWith(VESSEL_ID) && v?.protocol !== 'libp2p' && reachableHttp(v),
  )
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
    signal: AbortSignal.timeout(20000),
  })
  const rj = (await rr.json().catch(() => ({}))) as any
  // Normalize the two local envelope styles ({success,shape,body} / {content}) into
  // one content payload so the remote caller's resolve parsing stays uniform.
  const body = rj?.body ?? rj?.content ?? rj
  return { shape: t, produced_by: owner.vesselId + '@' + VESSEL_ID, ...((body && typeof body === 'object') ? { body } : { value: body }), note: 'proxied to the owning vessel on the peer substrate over libp2p' }
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
for (let i = 0; i < 40 && !currentCircuit(); i++) {
  await new Promise((r) => setTimeout(r, 500))
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
      const transport = { ...(vl.health() as unknown as Record<string, unknown>), redialCount, egressNoReservationCount, lastRedialReason }
      return Response.json({ status: 'ok', service: VESSEL_ID, transport, libp2p_peer_id: vl.peerId, libp2p_multiaddr: currentCircuit() })
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
          for (const a of circuits) {
            const alt = await resolveOverLibp2p(a, pointer).catch(errOf)
            if (alt && !alt.error) { console.log('[fed-transport] egress repair -> ' + String((pointer as any)?.type ?? '?') + ' via live circuit …' + a.slice(-16)); res = alt; break }
            res = res ?? alt
          }
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
        shapes: ['federation_probe', ...(EXTRA_SHAPE ? [EXTRA_SHAPE] : [])],
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

async function registerAtHub() {
  if (!HUB_DISCOVERY) return
  const liveCircuit = currentCircuit()
  if (!liveCircuit) {
    if (Date.now() - noCircuitWarnedAt >= NO_CIRCUIT_WARN_WINDOW_MS) {
      noCircuitWarnedAt = Date.now()
      console.error('[federation] no relay reservation — remote visibility suspended (hub mirror skipped; refreshes immediately on reacquisition)')
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
      { vesselId: HUB_VESSEL_ID, shapes: ['federation_probe', ...(EXTRA_SHAPE ? [EXTRA_SHAPE] : [])] },
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
  } catch (e) { console.log('[fed-transport] hub-register err', String(e)) }
}

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
const RELAY_PEER = RELAY.match(/\/p2p\/([^/]+)/)?.[1] ?? ''
const relayConnections = () =>
  RELAY_PEER ? vl.node.getConnections().filter((c) => c.remotePeer.toString() === RELAY_PEER) : []
let redialing = false
let lastReserveAt = Date.now()
let lastRedialAttemptAt = 0
let redialCount = 0
let egressNoReservationCount = 0
let lastRedialReason = ''
async function redialRelay(reason: string): Promise<void> {
  if (redialing) return
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
  const circuitUp = !!currentCircuit()
  const relayUp = relayConnections().length > 0
  if (!circuitUp || !relayUp) { phantomStrikes = 0; void redialRelay(!circuitUp ? 'circuit empty' : 'relay connection gone'); return }
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
}, 600_000) // 10 min

console.log(`[fed-transport] up id=${VESSEL_ID} peer=${vl.peerId} health=:${HEALTH_PORT} circuit=${circuit || '(none yet)'} hub=${HUB_DISCOVERY || '(no hub mirror)'}`)
