// resolve-http-e2e.ts — proves CONTENT-RESOLUTION-OVER-RELAY (the deliverable that
// closes the gap resolve-e2e.ts hit), plus a direct-connection HTTP-over-libp2p variant
// that proves the @libp2p/http Fetch API works AND that the version-coherence fix means
// no immediate `status=reset` on a direct dial.
//
// Part A (PRIMARY — relay-forced): vesselA fetches federation_probe from vesselB
// THROUGH the relay using the lpStream-corrected RESOLVE protocol. Asserts A gets B's
// content and reports whether the connection used was direct or relayed.
//
// Part B (SECONDARY — direct HTTP-over-libp2p): the same content resolved via
// @libp2p/http `services.http.fetch(peerId, …)` over a DIRECT connection — proves the
// Fetch-style API + that there's no instanceof/version-incoherence reset.
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import {
  createVesselLibp2p, serveResolve, resolveViaLibp2p,
  serveResolveHttp, resolveViaHttp,
} from './vessel-libp2p.ts'

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

const PROBE = {
  shape: 'federation_probe', produced_by: 'substrate-b',
  value: 'hello-from-substrate-B',
  note: 'resolved where the data lives (peer B) over federated libp2p',
}
function answer(pointer: any) {
  if (pointer?.type === 'federation_probe') return PROBE
  return { error: 'unknown shape', got: pointer?.type ?? null }
}

let partA = false, partB = false, partC = false
let partAPathLabel = 'unknown'

// ── Local relay with the RAISED reservation limits (so relayed bodies aren't reset) ──
const relay = await createLibp2p({
  addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
  transports: [tcp()], connectionEncrypters: [noise()], streamMuxers: [yamux()],
  services: {
    identify: identify(),
    relay: circuitRelayServer({
      reservations: {
        applyDefaultLimit: false,
        defaultDataLimit: BigInt(10 << 20),
        defaultDurationLimit: 600_000,
        maxReservations: 128,
        reservationTtl: 3_600_000,
      },
    }),
  },
})
await relay.start()
const relayMultiaddr = relay.getMultiaddrs()[0].toString()
console.log('[relay]', relayMultiaddr, '(raised limits: 10MiB / 600s / ttl 1h)')

// ── Part A: content-resolution THROUGH the relay (lpStream-corrected) ───────────────
{
  // disableDcutr on BOTH ends so the connection STAYS relayed (limited) — on loopback
  // DCUtR would otherwise instantly upgrade to direct and we wouldn't actually be
  // proving relay routing. With DCUtR off, the only path A↔B is through the relay.
  const vesselB = await createVesselLibp2p({ vesselId: 'federation-probe-vessel@substrate-b', relayMultiaddr, disableDcutr: true })
  await serveResolve(vesselB, answer)
  const vesselA = await createVesselLibp2p({ vesselId: 'goal-host-vessel@substrate-a', relayMultiaddr, disableDcutr: true })

  // Wait for B's relay reservation -> its advertisable circuit address.
  let circuitAddr = ''
  for (let i = 0; i < 30; i++) {
    const c = vesselB.advertiseMultiaddrs().find((m) => m.includes('p2p-circuit'))
    if (c) { circuitAddr = c; break }
    await sleep(500)
  }
  if (!circuitAddr) { console.error('PART-A-FAIL: vesselB never got a relay reservation') }
  else {
    console.log('[A] B circuit addr (forces relay path):', circuitAddr)
    try {
      // Dial BY the /p2p-circuit multiaddr to FORCE the relayed path (prove relay routing).
      const res = await resolveViaLibp2p(vesselA, circuitAddr, { type: 'federation_probe' })
      console.log('[A] resolved content:', JSON.stringify(res))
      partA = res?.content?.produced_by === 'substrate-b' && res?.content?.value === 'hello-from-substrate-B'
      // Report direct vs relayed for the connection A used to reach B. We classify by
      // the ADDRESS (presence of /p2p-circuit) rather than `.limits`, because the relay
      // runs applyDefaultLimit:false so a relayed connection carries no byte/duration
      // cap and `.limits` is therefore null even though the path IS through the relay.
      const bPeer = vesselB.peerId
      const conn = vesselA.node.getConnections().find((c) => c.remotePeer.toString() === bPeer)
      const viaCircuit = conn != null && conn.remoteAddr.toString().includes('p2p-circuit')
      partAPathLabel = conn == null ? 'no-conn'
        : viaCircuit ? 'RELAYED (via /p2p-circuit)'
        : (conn.limits != null ? 'RELAYED (limited)' : 'DIRECT (dcutr-upgraded)')
      console.log(`[A] connection to B was: ${partAPathLabel}`)
      console.log('[A] vesselA transport-health:', JSON.stringify(vesselA.health(), null, 0))
    } catch (e) {
      console.error('PART-A-FAIL: relay-routed resolve failed:', (e as Error).message)
    }
  }
  await stopQuietly(() => vesselA.stop()); await stopQuietly(() => vesselB.stop())
}

// ── Part B: content-resolution over @libp2p/http on a DIRECT connection ─────────────
// Proves the Fetch-style API + version coherence (no immediate reset on direct dial).
{
  const vesselB = await createVesselLibp2p({ vesselId: 'federation-probe-vessel@substrate-b', enableHttp: true, localTcpPort: 0 })
  await serveResolveHttp(vesselB, answer)
  const vesselA = await createVesselLibp2p({ vesselId: 'goal-host-vessel@substrate-a', enableHttp: true, localTcpPort: 0 })

  // Direct dial: A connects to B's direct TCP multiaddr (no relay) — this is the path
  // that previously could `status=reset` if @libp2p/interface/@libp2p/utils were
  // duplicated. Single coherent versions => clean upgrade.
  const bDirect = vesselB.advertiseMultiaddrs().find((m) => m.includes('/tcp/') && !m.includes('p2p-circuit'))
  if (!bDirect) { console.error('PART-B-FAIL: no direct multiaddr on B') }
  else {
    console.log('[B] B direct addr:', bDirect)
    try {
      const res = await resolveViaHttp(vesselA, bDirect, { type: 'federation_probe' })
      console.log('[B] resolved content (HTTP-over-libp2p):', JSON.stringify(res))
      partB = res?.content?.produced_by === 'substrate-b' && res?.content?.value === 'hello-from-substrate-B'
      const conn = vesselA.node.getConnections().find((c) => c.remotePeer.toString() === vesselB.peerId)
      console.log(`[B] connection status: ${conn?.status ?? 'none'} (limited=${conn?.limits != null}) — no reset = version-coherence OK`)
    } catch (e) {
      console.error('PART-B-FAIL: HTTP-over-libp2p resolve failed:', (e as Error).message)
    }
  }
  await stopQuietly(() => vesselA.stop()); await stopQuietly(() => vesselB.stop())
}

// ── Part C: content-resolution over @libp2p/http THROUGH the relay (no direct route) ─
// The strong result: with the relay configured `applyDefaultLimit:false`, the relayed
// connection carries NO `.limits`, so libp2p does not treat it as "limited" and the
// internal `/http/1.1` stream opens on both ends — @libp2p/http fetch works OVER THE
// RELAY too. (With default relay limits, `.limits={}` and this path is rejected with
// "Cannot open protocol stream on limited connection".) dcutr disabled so the only
// A↔B path is the relay circuit.
{
  const vesselB = await createVesselLibp2p({ vesselId: 'federation-probe-vessel@substrate-b', relayMultiaddr, enableHttp: true, disableDcutr: true })
  await serveResolveHttp(vesselB, answer)
  const vesselA = await createVesselLibp2p({ vesselId: 'goal-host-vessel@substrate-a', relayMultiaddr, enableHttp: true, disableDcutr: true })
  let circuitAddr = ''
  for (let i = 0; i < 30; i++) {
    const c = vesselB.advertiseMultiaddrs().find((m) => m.includes('p2p-circuit'))
    if (c) { circuitAddr = c; break }
    await sleep(500)
  }
  if (!circuitAddr) { console.error('PART-C-FAIL: vesselB never got a relay reservation') }
  else {
    try {
      const res = await resolveViaHttp(vesselA, circuitAddr, { type: 'federation_probe' })
      console.log('[C] resolved content (HTTP-over-libp2p, RELAYED):', JSON.stringify(res))
      partC = res?.content?.produced_by === 'substrate-b' && res?.content?.value === 'hello-from-substrate-B'
      const conn = vesselA.node.getConnections().find((c) => c.remotePeer.toString() === vesselB.peerId)
      console.log(`[C] connection to B: ${conn?.remoteAddr.toString().includes('p2p-circuit') ? 'RELAYED (/p2p-circuit)' : 'direct'} limits=${conn?.limits == null ? 'null (uncapped → HTTP allowed)' : 'set'}`)
    } catch (e) {
      console.error('PART-C-FAIL: HTTP-over-relay resolve failed:', (e as Error).message)
    }
  }
  await stopQuietly(() => vesselA.stop()); await stopQuietly(() => vesselB.stop())
}

await stopQuietly(() => relay.stop())

console.log('\n──────── RESULT ────────')
console.log(`Part A (content-resolution OVER RELAY, lpStream-corrected): ${partA ? 'PASS' : 'FAIL'} [path: ${partAPathLabel}]`)
console.log(`Part B (content-resolution DIRECT, @libp2p/http fetch):     ${partB ? 'PASS' : 'FAIL'}`)
console.log(`Part C (content-resolution OVER RELAY, @libp2p/http fetch): ${partC ? 'PASS' : 'FAIL'} (requires relay applyDefaultLimit:false)`)
// The deliverable is content-resolution OVER THE RELAY (Part A, corroborated by Part C).
if (partA && partC) console.log('HTTP-RESOLVE-PASS')
process.exit(partA && partB && partC ? 0 : 1)

// libp2p node.stop() can hang in this loopback/relay teardown; bound it so the test
// always reaches its verdict.
async function stopQuietly(fn: () => Promise<void>): Promise<void> {
  await Promise.race([fn().catch(() => {}), sleep(3000)])
}
