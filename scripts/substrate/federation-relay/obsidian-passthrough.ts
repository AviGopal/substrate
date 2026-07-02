// obsidian-passthrough.ts — register the OPERATOR-HOST Obsidian plugin as a
// vessel in a (remote) hub's discovery, reachable over the libp2p relay.
//
// This is the "implicit vessel joins the shared operational space" leg of the
// three-location topology (hub = activity/learning surface, spoke = goal-host
// compute, host = the human's Obsidian): the plugin's HTTP surface
// (http://127.0.0.1:27182, NATed, unreachable from hub or spoke) is served
// over a Circuit-Relay-v2 reservation and registered into the HUB discovery
// with protocol:"libp2p" + the circuit multiaddr. A spoke goal-host that
// resolves one of the obsidian_* shapes gets the registration via peer
// fan-out (discoveredVia:"peer"), routes through its local
// federation-transport egress (FED_TRANSPORT_EGRESS /egress/resolve?target=…),
// and the resolve lands HERE — proxied to the plugin where the data lives.
//
// Run on the operator host:
//   RELAY_MULTIADDR=/ip4/<hub-ip>/tcp/30333/p2p/<relay-peer> \
//   DISCOVERY_URL=http://<hub-ip>:18100  API_KEY=<hub-issued key> \
//   OBSIDIAN_URL=http://127.0.0.1:27182 \
//   bun scripts/substrate/federation-relay/obsidian-passthrough.ts
import { createVesselLibp2p, serveResolveHttp, type VesselLibp2p } from '@avigopal/libp2p-federation-transport'

const VESSEL_ID = process.env.OBSIDIAN_VESSEL_ID || 'obsidian-host-vessel'
const RELAY = process.env.RELAY_MULTIADDR || ''
const DISCOVERY = process.env.DISCOVERY_URL || ''
const API_KEY = process.env.API_KEY || process.env.METABOB_API_KEY || ''
const OBSIDIAN = (process.env.OBSIDIAN_URL || 'http://127.0.0.1:27182').replace(/\/+$/, '')
const HEALTH_PORT = parseInt(process.env.OBSIDIAN_PASSTHROUGH_HEALTH_PORT || '8402', 10)
if (!RELAY || !DISCOVERY) { console.error('[obsidian-passthrough] set RELAY_MULTIADDR and DISCOVERY_URL'); process.exit(1) }

// shape -> plugin route. The plugin's HTTP server (repos/obsidian-vessel
// src/server) exposes observations (reads) and actions (writes).
const ROUTES: Record<string, { method: 'GET' | 'POST'; path: string; description: string }> = {
  obsidian_status: { method: 'GET', path: '/observations/status', description: 'live status of the operator-host Obsidian vault/plugin (open notes, recent events)' },
  obsidian_concept_status: { method: 'GET', path: '/observations/concept-status', description: 'concept-sync status of the operator-host Obsidian vault' },
  obsidian_dispatch_goal: { method: 'POST', path: '/actions/dispatch-goal', description: 'dispatch a goal typed into / on behalf of the operator-host Obsidian surface' },
  obsidian_open_note: { method: 'POST', path: '/actions/open-note', description: 'open a note in the operator-host Obsidian UI' },
  obsidian_sync: { method: 'POST', path: '/actions/sync', description: 'trigger a vault sync on the operator-host Obsidian' },
}

const vl: VesselLibp2p = await createVesselLibp2p({ vesselId: VESSEL_ID, relayMultiaddr: RELAY, enableHttp: true })

await serveResolveHttp(vl, async (pointer: any) => {
  const t = String(pointer?.type ?? '')
  const route = ROUTES[t]
  if (!route) return { error: 'unknown obsidian shape: ' + t }
  try {
    const init: RequestInit = route.method === 'POST'
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pointer?.body ?? pointer?.payload ?? {}) }
      : { method: 'GET' }
    const res = await fetch(OBSIDIAN + route.path, { ...init, signal: AbortSignal.timeout(10_000) })
    const body = await res.json().catch(() => ({}))
    return { shape: t, produced_by: VESSEL_ID, status: res.status, ok: res.ok, body, note: 'resolved on the operator host against the live Obsidian plugin (implicit-vessel surface)' }
  } catch (e) {
    return { error: 'obsidian plugin unreachable: ' + String((e as Error)?.message ?? e) }
  }
})

// Wait for the relay reservation -> advertisable circuit multiaddr.
let circuit = ''
for (let i = 0; i < 40; i++) {
  const c = vl.advertiseMultiaddrs().find((m) => m.includes('p2p-circuit'))
  if (c) { circuit = c; break }
  await new Promise((r) => setTimeout(r, 500))
}
if (!circuit) console.warn('[obsidian-passthrough] no circuit multiaddr yet — registration will advertise none')

Bun.serve({
  port: HEALTH_PORT,
  fetch(req) {
    const u = new URL(req.url)
    if (u.pathname === '/health') {
      return Response.json({ status: 'ok', service: VESSEL_ID, obsidian: OBSIDIAN, transport: vl.health(), libp2p_peer_id: vl.peerId, libp2p_multiaddr: circuit })
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
        endpoint: `http://127.0.0.1:${HEALTH_PORT}`,   // NATed loopback — real reachability is the circuit
        shapes: Object.keys(ROUTES),
        resolve_endpoint: '/v2/impulses/resolve', resolve_request_format: 'pointer', auth_scheme: 'none',
        protocol: 'libp2p',
        libp2p_peer_id: vl.peerId,
        libp2p_multiaddr: circuit ? [circuit] : [],
        systemVessel: true,
        shape_descriptions: Object.fromEntries(Object.entries(ROUTES).map(([k, v]) => [k, v.description])),
      }),
    })
    console.log('[obsidian-passthrough] register ->', r.status)
  } catch (e) { console.log('[obsidian-passthrough] register err', String(e)) }
}
await register()
setInterval(register, 120_000)

console.log(`[obsidian-passthrough] up id=${VESSEL_ID} peer=${vl.peerId} health=:${HEALTH_PORT} circuit=${circuit || '(none yet)'} -> obsidian ${OBSIDIAN}`)
