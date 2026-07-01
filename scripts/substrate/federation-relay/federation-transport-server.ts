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
import { createVesselLibp2p, serveResolveHttp, resolveViaHttp, type VesselLibp2p } from '@avigopal/libp2p-federation-transport'

const VESSEL_ID = process.env.FED_VESSEL_ID || 'federation-transport-vessel'
const RELAY = process.env.RELAY_MULTIADDR || ''
const DISCOVERY = process.env.DISCOVERY_URL || 'http://127.0.0.1:8100'
const API_KEY = process.env.METABOB_API_KEY || ''
const HEALTH_PORT = parseInt(process.env.FED_HEALTH_PORT || '8401', 10)

if (!RELAY) { console.error('[fed-transport] ERROR: set RELAY_MULTIADDR'); process.exit(1) }

const vl: VesselLibp2p = await createVesselLibp2p({ vesselId: VESSEL_ID, relayMultiaddr: RELAY, enableHttp: true })

// Resolve handler (where the data lives). A real vessel would proxy to its local
// activity-api /v2/impulses/resolve; for the integration probe we resolve federation_probe.
// FED_EXTRA_SHAPE lets ONE substrate advertise a shape its peers do NOT — so a peer's
// goal walk finds no LOCAL producer, fans out via discovery, and is forced down the
// genuine cross-substrate libp2p route (proving remote resolve, not a self-dial).
const EXTRA_SHAPE = process.env.FED_EXTRA_SHAPE || ''
await serveResolveHttp(vl, (pointer) => {
  const t = pointer?.type
  if (t === 'federation_probe')
    return { shape: 'federation_probe', produced_by: VESSEL_ID, value: 'hello-over-libp2p-http', note: 'resolved where the data lives, over libp2p HTTP' }
  if (EXTRA_SHAPE && t === EXTRA_SHAPE)
    return { shape: EXTRA_SHAPE, produced_by: VESSEL_ID, value: 'cross-substrate-resolve-ok', note: 'resolved on the PEER substrate over libp2p (genuine cross-substrate)' }
  return { error: 'unknown shape: ' + t }
})

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
        const pointer = body?.impulse?.pointer ?? body?.impulse ?? body?.pointer ?? body
        // resolveViaHttp returns the peer's { content, metadata } (serveResolveHttp wraps
        // it that way). Pass it through verbatim so the caller's resolve parsing applies.
        const res = await resolveViaHttp(vl, String(target), pointer)
        return Response.json(res ?? { error: 'empty libp2p resolve' }, { status: 200 })
      } catch (e) {
        return Response.json({ error: 'libp2p egress failed: ' + String((e as Error)?.message ?? e) }, { status: 502 })
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
await register()
setInterval(register, 120_000) // refresh discovery TTL

console.log(`[fed-transport] up id=${VESSEL_ID} peer=${vl.peerId} health=:${HEALTH_PORT} circuit=${circuit || '(none yet)'}`)
