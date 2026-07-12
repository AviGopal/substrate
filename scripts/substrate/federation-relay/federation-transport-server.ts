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
const RELAY = process.env.RELAY_MULTIADDR || ''
const DISCOVERY = process.env.DISCOVERY_URL || 'http://127.0.0.1:8100'
const API_KEY = process.env.METABOB_API_KEY || ''
const HEALTH_PORT = parseInt(process.env.FED_HEALTH_PORT || '8401', 10)

if (!RELAY) { console.error('[fed-transport] ERROR: set RELAY_MULTIADDR'); process.exit(1) }

const vl: VesselLibp2p = await createVesselLibp2p({ vesselId: VESSEL_ID, relayMultiaddr: RELAY, enableHttp: true })

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

async function localDiscoveryResolve(pointer: any): Promise<any[]> {
  const dr = await fetch(DISCOVERY + '/resolve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'ApiKey ' + API_KEY,
      'X-Discovery-Depth': '99', // local-only: never peer-fan-out from an ingress lookup
    },
    body: JSON.stringify({ pointer }),
    signal: AbortSignal.timeout(5000),
  })
  const dj = (await dr.json().catch(() => ({}))) as any
  return (dj?.content?.vessels ?? []) as any[]
}

async function proxyToLocalOwner(pointer: any): Promise<any> {
  const t = String(pointer?.type ?? '')
  // Per-vessel addressing: a caller that discovered `<vesselId>@<substrate>` through
  // the hub namespace names its target via pointer._fedTargetVessel (either form —
  // bare vesselId or the substrate-qualified mirror id). When set, route to exactly
  // that vessel; shape-owner lookup is only the fallback. This is what makes
  // DUPLICATE shapes across the fleet individually addressable (two goal-hosts, two
  // activity-apis) instead of collapsing onto whichever vessel shape-lookup finds.
  const wanted = String(pointer?._fedTargetVessel ?? '').split('@')[0]
  if (wanted) {
    const all = await localDiscoveryResolve({ type: 'vesselRegistry' })
    const target = all.find(
      (v: any) => String(v?.vesselId ?? '') === wanted && !String(v.vesselId).startsWith(VESSEL_ID) && v?.protocol !== 'libp2p',
    )
    if (target) return proxyToVessel(pointer, t, target)
  }
  const vessels = await localDiscoveryResolve({ type: 'vesselCapability', shape: t })
  // Prefer a plain-HTTP LOCAL vessel: never ourselves, never our own hub-mirror
  // registration (vesselId-prefixed), never a libp2p-protocol entry.
  const owner = vessels.find(
    (v: any) => v?.vesselId && !String(v.vesselId).startsWith(VESSEL_ID) && v?.protocol !== 'libp2p',
  )
  if (!owner) {
    // No LOCAL owner — try a REMOTE one over libp2p. The hub namespace mirror
    // advertises other substrates' shapes with protocol:'libp2p' + the OWNING
    // transport's circuit multiaddr. Forwarding one hop there is what makes
    // "connect to any relay → reach all vessels" true: the owning substrate's
    // ingress then lands on its own local plain-HTTP vessel. A hop guard
    // (pointer._fedHop) bounds this to a single cross-substrate hop so a
    // mutual mirror (A↔B) can never ping-pong.
    const hop = Number(pointer?._fedHop ?? 0)
    const remote = hop < 1 ? vessels.find(
      (v: any) => v?.vesselId && !String(v.vesselId).startsWith(VESSEL_ID)
        && v?.protocol === 'libp2p' && Array.isArray(v?.libp2p_multiaddr) && v.libp2p_multiaddr[0],
    ) : undefined
    if (remote) {
      console.log('[fed-transport] ingress→libp2p forward ' + t + ' to ' + String(remote.libp2p_multiaddr[0]).slice(-20))
      const res = await resolveOverLibp2p(String(remote.libp2p_multiaddr[0]), { ...pointer, _fedHop: hop + 1 })
      return (res && typeof res === 'object' && 'content' in (res as any)) ? (res as any).content : res
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

// Wait for the relay reservation → our advertisable circuit multiaddr.
let circuit = ''
for (let i = 0; i < 40; i++) {
  const c = vl.advertiseMultiaddrs().find((m) => m.includes('p2p-circuit'))
  if (c) { circuit = c; break }
  await new Promise((r) => setTimeout(r, 500))
}

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
      return Response.json({ status: 'ok', service: VESSEL_ID, transport: vl.health(), libp2p_peer_id: vl.peerId, libp2p_multiaddr: circuit })
    }
    if (u.pathname === '/egress/resolve' && req.method === 'POST') {
      try {
        const body = (await req.json().catch(() => ({}))) as any
        // Target may arrive three ways so the caller can stay maximally thin: a
        // ?target= query param (lets a caller route purely by URL — no header/body
        // threading needed, the goal-host path), an X-Libp2p-Target header, or
        // body.target. Query param wins, then header, then body.
        const target = u.searchParams.get('target') || req.headers.get('x-libp2p-target') || body?.target || ''
        if (!target) return Response.json({ error: 'missing libp2p target (?target= query, X-Libp2p-Target header, or body.target)' }, { status: 400 })
        let pointer = body?.impulse?.pointer ?? body?.impulse ?? body?.pointer ?? body
        // Per-vessel addressing: ?vessel=<vesselId[@substrate]> (or body.vessel) names
        // the exact vessel on the target substrate — the remote ingress routes to it
        // instead of shape-owner lookup, so duplicate shapes stay distinguishable.
        const targetVessel = u.searchParams.get('vessel') || body?.vessel || ''
        if (targetVessel) pointer = { ...pointer, _fedTargetVessel: targetVessel }
        // resolveViaHttp returns the peer's { content, metadata } (serveResolveHttp wraps
        // it that way). Pass it through verbatim so the caller's resolve parsing applies.
        console.log('[fed-transport] egress/resolve -> ' + String((pointer as any)?.type ?? '?') + ' via ' + String(target).slice(-20))
        const res = await resolveOverLibp2p(String(target), pointer)
        return Response.json(res ?? { error: 'empty libp2p resolve' }, { status: 200 })
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
        libp2p_multiaddr: [circuit],                 // discovery doesn't echo metadata in capability responses)
        shape_descriptions: { federation_probe: 'libp2p-reachable probe shape served by the federation transport vessel' },
      }),
    })
    console.log('[fed-transport] register ->', r.status)
  } catch (e) { console.log('[fed-transport] register err', String(e)) }
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
const HUB_VESSEL_ID = `${VESSEL_ID}@${SUBSTRATE_ID}`

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
    const shapes = (v?.shapes ?? []).filter((s: any) => typeof s === 'string' && s)
    if (shapes.length === 0) continue
    rows.push({ vesselId: id, shapes })
  }
  return rows
}

async function registerAtHub() {
  if (!HUB_DISCOVERY || !circuit) return
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
        headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + API_KEY },
        body: JSON.stringify({
          vesselId: reg.vesselId, vesselName: reg.vesselId, version: '0.1.0',
          endpoint: `http://127.0.0.1:${HEALTH_PORT}`, // local-only surface; reachability is the circuit below
          shapes: reg.shapes,
          resolve_endpoint: '/v2/impulses/resolve', resolve_request_format: 'pointer', auth_scheme: 'none',
          protocol: 'libp2p',
          libp2p_peer_id: vl.peerId,
          libp2p_multiaddr: [circuit],
        }),
      }).catch((e) => ({ status: 'err:' + String((e as Error)?.message ?? e) } as any))
      return `${reg.vesselId}:${r.status}`
    }))
    const failed = results.filter((s) => !/:(200|201)$/.test(s))
    console.log(`[fed-transport] hub-register per-vessel (${results.length} rows) -> ${failed.length === 0 ? 'all ok' : 'FAILED ' + failed.join(', ')}`)
  } catch (e) { console.log('[fed-transport] hub-register err', String(e)) }
}

await register()
await registerAtHub()
setInterval(register, 120_000) // refresh discovery TTL
setInterval(registerAtHub, 120_000)

console.log(`[fed-transport] up id=${VESSEL_ID} peer=${vl.peerId} health=:${HEALTH_PORT} circuit=${circuit || '(none yet)'} hub=${HUB_DISCOVERY || '(no hub mirror)'}`)
