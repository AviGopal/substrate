// fed-federated-resolve.ts — the full cross-substrate federation path, end to end:
// a consumer in substrate A (1) DISCOVERS a federation_probe producer via A's discovery
// (which peer-fans-out to B's discovery and returns B's libp2p_multiaddr through the new
// contract field), then (2) RESOLVES the shape's content FROM B over libp2p, through the
// relay. Proves discover-by-shape → libp2p address → resolve-over-overlay across substrates.
import { createVesselLibp2p, resolveViaHttp } from '@avigopal/libp2p-federation-transport'

const DISCOVERY = 'http://127.0.0.1:8100'
const API_KEY = process.env.METABOB_API_KEY || ''

// 1) discover via A's discovery (peer fan-out to B)
const dr = await fetch(DISCOVERY + '/resolve', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'ApiKey ' + API_KEY },
  body: JSON.stringify({ pointer: { type: 'vesselCapability', shape: 'federation_probe' } }),
})
const dj: any = await dr.json()
const v = dj?.content?.vessels?.[0]
console.log('DISCOVERED:', JSON.stringify({ vesselId: v?.vesselId, via: v?.discoveredVia, protocol: v?.protocol, libp2p: v?.libp2p_multiaddr }))
const addr = Array.isArray(v?.libp2p_multiaddr) ? v.libp2p_multiaddr[0] : v?.libp2p_multiaddr
if (!addr) { console.log('CROSS-SUBSTRATE-FED-FAIL: discovery returned no libp2p_multiaddr'); process.exit(1) }

// 2) resolve the content FROM the discovered peer over libp2p (through the relay)
const cli = await createVesselLibp2p({ vesselId: 'goal-host@substrate-a-fedclient', relayMultiaddr: process.env.RELAY_MULTIADDR, enableHttp: true })
await new Promise((r) => setTimeout(r, 1500)) // get our own relay reservation
const res = await resolveViaHttp(cli, addr, { type: 'federation_probe' })
console.log('RESOLVED:', JSON.stringify(res))
console.log(res?.content?.produced_by === 'federation-transport@substrate-b' ? 'CROSS-SUBSTRATE-FED-PASS' : 'CROSS-SUBSTRATE-FED-FAIL')
await cli.stop(); process.exit(0)
