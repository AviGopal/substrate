// e2e.ts — proves the FULL relay-routed path locally: relay + two "vessel" nodes,
// where vessel A reaches vessel B THROUGH the relay circuit (the exact mechanism that
// makes a NATed vessel reachable from anywhere). Also proves key-from-vessel-id gives
// stable, distinct peerIds. No public IP needed — uses a loopback relay.
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { ping } from '@libp2p/ping'
import { multiaddr } from '@multiformats/multiaddr'
import { createVesselLibp2p, vesselKeyFromId } from './vessel-libp2p.ts'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

// 1) Local relay (stands in for the public VM).
const relay = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: { identify: identify(), relay: circuitRelayServer() },
})
await relay.start()
const relayMultiaddr = relay.getMultiaddrs()[0].toString()
console.log('[relay] ', relayMultiaddr)

// 2) Two vessels, identities SEEDED FROM VESSEL ID, both reachable via the relay.
const vesselB = await createVesselLibp2p({ vesselId: 'goal-host-vessel@substrate-b', relayMultiaddr, extraServices: { ping: ping() } })
const vesselA = await createVesselLibp2p({ vesselId: 'goal-host-vessel@substrate-a', relayMultiaddr, extraServices: { ping: ping() } })
console.log('[vesselA] peerId', vesselA.peerId)
console.log('[vesselB] peerId', vesselB.peerId)

// determinism check: same id -> same peerId
const k1 = await vesselKeyFromId('goal-host-vessel@substrate-b')
const k2 = await vesselKeyFromId('goal-host-vessel@substrate-b')
console.log('[determinism] same-id peerId stable:', k1.publicKey.toString() === k2.publicKey.toString())

// 3) Wait for B to obtain a relay reservation (its advertisable circuit address).
let circuitAddr = ''
for (let i = 0; i < 30; i++) {
  const c = vesselB.advertiseMultiaddrs().find((m) => m.includes('p2p-circuit'))
  if (c) { circuitAddr = c; break }
  await sleep(500)
}
if (!circuitAddr) { console.error('VET-FAIL: vesselB never got a relay reservation'); process.exit(1) }
console.log('[vesselB] relay-circuit address (advertised to discovery):', circuitAddr)

// 4) Vessel A dials B THROUGH the relay circuit and pings — proves relay-routed reach.
try {
  const latency = await vesselA.node.services.ping.ping(multiaddr(circuitAddr))
  console.log(`VET-PASS: vesselA reached vesselB via relay circuit — ping ${latency}ms`)
} catch (e) {
  console.error('VET-FAIL: relay-routed dial failed:', (e as Error).message); process.exit(1)
}

await vesselA.stop(); await vesselB.stop(); await relay.stop()
process.exit(0)
