// resolve-e2e.ts — proves CROSS-SUBSTRATE RESOLUTION (content, not just ping) over a
// relay-routed libp2p connection. This closes the c51d3f8 semantic gap: the question
// (a pointer) is routed to the PEER, the peer resolves it where its data lives, and the
// content comes back — all through the relay (the "from anywhere" path).
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { createVesselLibp2p, serveResolve, resolveViaLibp2p } from '@avigopal/libp2p-federation-transport'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// Local relay (stands in for the public VM).
const relay = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()], connectionEncrypters: [noise()], streamMuxers: [yamux()],
  services: { identify: identify(), relay: circuitRelayServer() },
})
await relay.start()
const relayMultiaddr = relay.getMultiaddrs()[0].toString()

// Vessel B (on "substrate-b") SERVES federation_probe; reachable only via the relay.
const vesselB = await createVesselLibp2p({ vesselId: 'federation-probe-vessel@substrate-b', relayMultiaddr })
await serveResolve(vesselB, (pointer) => {
  if (pointer?.type === 'federation_probe') {
    return { shape: 'federation_probe', produced_by: 'substrate-b', value: 'hello-from-substrate-B', note: 'resolved where the data lives (peer B) over relay-routed libp2p' }
  }
  return { error: 'unknown shape' }
})

// Vessel A (on "substrate-a") will resolve through the relay.
const vesselA = await createVesselLibp2p({ vesselId: 'goal-host-vessel@substrate-a', relayMultiaddr })

// Wait for B's relay reservation -> its advertisable circuit address.
let circuitAddr = ''
for (let i = 0; i < 30; i++) {
  const c = vesselB.advertiseMultiaddrs().find((m) => m.includes('p2p-circuit'))
  if (c) { circuitAddr = c; break }
  await sleep(500)
}
if (!circuitAddr) { console.error('VET-FAIL: no reservation'); process.exit(1) }
console.log('[B circuit addr]', circuitAddr)

// A resolves federation_probe FROM B, through the relay, over libp2p.
const res = await resolveViaLibp2p(vesselA, circuitAddr, { type: 'federation_probe' })
console.log('[A resolved content]', JSON.stringify(res))
const ok = res?.content?.produced_by === 'substrate-b' && res?.content?.value === 'hello-from-substrate-B'
console.log(ok ? 'VET-PASS: cross-substrate RESOLVE over relay-routed libp2p returned peer content' : 'VET-FAIL: content mismatch')

await vesselA.stop(); await vesselB.stop(); await relay.stop()
process.exit(ok ? 0 : 1)
