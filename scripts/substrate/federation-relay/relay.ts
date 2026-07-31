// relay.ts — the public libp2p Circuit Relay v2 server for substrate federation.
//
// WHY: this is the ONE piece a substrate cannot provision for itself — a node with a
// publicly-reachable address. It runs on an operator-provided cloud VM (public IP).
// Every substrate's vessels dial OUT to it: AutoNAT detects their NAT, DCUtR tries a
// direct hole-punch, and for the ~30% symmetric-NAT floor the connection is relayed
// here (ciphertext only — Noise is end-to-end, the relay never sees plaintext).
// This is the L3 reachability layer beneath discovery-vessel (the L7 control plane),
// per docs/architecture/SUBSTRATE_AS_NETWORK.md §3.
//
// IDENTITY: the relay persists its keypair (RELAY_KEY_FILE) so its peerId — and thus
// the RELAY_MULTIADDR vessels are configured with — is STABLE across restarts.
//
// Run on the VM:
//   cd scripts/substrate/federation-relay && bun install
//   PUBLIC_IP=<vm-public-ip> bun relay.ts
//   # prints RELAY_MULTIADDR=/ip4/<ip>/tcp/30333/p2p/<peerId> and a /wss variant
// Open inbound TCP 30333 (and 443 if using the WSS listener) on the VM firewall.
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { circuitRelayServer } from '@libp2p/circuit-relay-v2'
import { autoNAT } from '@libp2p/autonat'
import { ping } from '@libp2p/ping'
import { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf } from '@libp2p/crypto/keys'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// REQUIRED — the VM's public IPv4. Accept FED_PUBLIC_IP too: vessels.manifest.json
// declares the relay's env key as FED_PUBLIC_IP, so honor both to avoid a silent
// "PUBLIC_IP unset -> exit" when the relay is installed via the manifest path.
const PUBLIC_IP = process.env.PUBLIC_IP || process.env.FED_PUBLIC_IP || ''
const TCP_PORT = parseInt(process.env.RELAY_TCP_PORT || '30333', 10)
const WS_PORT = parseInt(process.env.RELAY_WS_PORT || '0', 10) // set e.g. 443 to also offer browser-reachable WSS
const RELAY_KEY_FILE = process.env.RELAY_KEY_FILE || './relay-key.protobuf'

if (!PUBLIC_IP) { console.error('ERROR: set PUBLIC_IP=<vm public ipv4>'); process.exit(1) }

// Stable identity: load or mint+persist the relay private key.
let privateKey
if (existsSync(RELAY_KEY_FILE)) {
  privateKey = privateKeyFromProtobuf(readFileSync(RELAY_KEY_FILE))
} else {
  privateKey = await generateKeyPair('Ed25519')
  writeFileSync(RELAY_KEY_FILE, privateKeyToProtobuf(privateKey))
  console.log('[relay] minted + persisted new identity ->', RELAY_KEY_FILE)
}

const listen = [`/ip4/0.0.0.0/tcp/${TCP_PORT}`]
const announce = [`/ip4/${PUBLIC_IP}/tcp/${TCP_PORT}`]
if (WS_PORT > 0) { listen.push(`/ip4/0.0.0.0/tcp/${WS_PORT}/ws`); announce.push(`/ip4/${PUBLIC_IP}/tcp/${WS_PORT}/ws`) }

const node = await createLibp2p({
  privateKey,
  addresses: { listen, announce },
  transports: [tcp(), webSockets()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    identify: identify(),
    autonat: autoNAT(),               // lets dialing vessels learn their own NAT status
    // maxOutboundStreams defaults to 1; the keep-alive fires all reserved peers'
    // pings concurrently, so raise it to the reservation ceiling or every peer past
    // the first fails with "too many outbound protocol streams 2/1".
    ping: ping({
      timeout: parseInt(process.env.RELAY_PING_TIMEOUT_MS || '10000', 10),
      maxOutboundStreams: parseInt(process.env.RELAY_MAX_RESERVATIONS || '128', 10),
    }),
    relay: circuitRelayServer({       // the actual relay service (resource-capped)
      // Raise the per-circuit data/duration caps. The library defaults
      // (DEFAULT_DATA_LIMIT=128KB, DEFAULT_DURATION_LIMIT=120s) reset large or
      // long relayed streams — fine for a ping, fatal for a resolve body. We
      // disable the default per-reservation limit and set generous explicit
      // ceilings so relayed HTTP/resolve payloads aren't truncated mid-flight.
      // (Noise is end-to-end; raising the byte cap never exposes plaintext.)
      reservations: {
        applyDefaultLimit: false,                                                   // do NOT clamp each circuit to the 128KB/2min default
        defaultDataLimit: BigInt(10 << 20),                                         // 10 MiB per relayed circuit
        defaultDurationLimit: parseInt(process.env.RELAY_DURATION_LIMIT_MS || '600000', 10),  // 10 min
        maxReservations: parseInt(process.env.RELAY_MAX_RESERVATIONS || '128', 10),
        reservationTtl: parseInt(process.env.RELAY_RESERVATION_TTL_MS || '3600000', 10),       // 1 h
      },
    }),
  },
})
await node.start()

// ── RESERVED-PEER KEEP-ALIVE ────────────────────────────────────────────────
// A circuit-relay-v2 relay is PASSIVE: it never dials reserved peers, so if the
// relay↔peer connection silently dies (a NAT-behind spoke whose idle mapping
// expires with no FIN/RST — a half-open both sides still believe is live) the
// relay can neither notice nor reconnect. HOP CONNECTs then fail with
// NO_RESERVATION even though the reservation TTL reads full — the recurring
// hub→spoke storm (~74-min cadence, all fails targeting the NAT'd spoke).
// js-libp2p's connectionManager has no keep-alive, so add one: ping each reserved
// peer over its DIRECT connection every RELAY_KEEPALIVE_MS (< a ~30s NAT idle
// timeout). A SUCCESSFUL ping keeps the NAT mapping warm (prevents the half-open)
// AND proves the peer supports the protocol.
//
// SAFETY (learned from the reverted 6ec65736 churn loop): a peer that never runs a
// ping RESPONDER — e.g. a sidecar build without the service — would fail every ping
// as "unsupported protocol", not "dead". So NEVER close on that: only close a peer
// that has PONGED at least once (proving it CAN answer) AND then failed >=2 pings in
// a row (proving the connection actually died). A never-ponging peer is left alone.
const KEEPALIVE_MS = parseInt(process.env.RELAY_KEEPALIVE_MS || '20000', 10)
const PING_TIMEOUT_MS = parseInt(process.env.RELAY_PING_TIMEOUT_MS || '10000', 10)
const CLOSE_AFTER_FAILS = parseInt(process.env.RELAY_KEEPALIVE_CLOSE_AFTER || '2', 10)
const pongedEver = new Set<string>()      // peers that have answered ≥1 ping (support the responder)
const consecFails = new Map<string, number>()
setInterval(() => {
  for (const peerId of node.services.relay.reservations.keys()) {
    const pid = peerId.toString()
    // Only the DIRECT reservation-holding connection (limits == null); relayed
    // circuits carry non-null limits and must never be pinged/closed here.
    const direct = node.getConnections(peerId).filter((c) => c.limits == null && c.status === 'open')
    if (direct.length === 0) { consecFails.delete(pid); continue }
    void node.services.ping.ping(peerId, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) })
      .then(() => {
        if (!pongedEver.has(pid)) { pongedEver.add(pid); console.log(`[relay] reserved peer …${pid.slice(-8)} answers pings — liveness tracking active`) }
        consecFails.set(pid, 0)
      })
      .catch((err) => {
        const n = (consecFails.get(pid) ?? 0) + 1
        consecFails.set(pid, n)
        // Diagnostic (rate-limited per peer): surface WHY a reserved peer isn't
        // answering — 'unsupported protocol' = no responder; timeout/reset/limited =
        // dead or non-pingable connection. First failure + every 10th thereafter.
        if (n === 1 || n % 10 === 0) console.log(`[relay] keep-alive ping to …${pid.slice(-8)} failed (#${n}): ${String((err as Error)?.message ?? err).slice(0, 90)}`)
        if (pongedEver.has(pid) && n >= CLOSE_AFTER_FAILS) {
          consecFails.set(pid, 0)
          console.log(`[relay] reserved peer …${pid.slice(-8)} failed ${n} consecutive pings after prior success — closing dead connection to force re-dial`)
          for (const c of direct) { c.close().catch(() => c.abort(new Error('keep-alive: dead connection'))) }
        }
      })
  }
}, KEEPALIVE_MS)

console.log('[relay] started. peerId=', node.peerId.toString())
console.log(`[relay] reserved-peer keep-alive: ping every ${KEEPALIVE_MS}ms, close after ${CLOSE_AFTER_FAILS} consec fails (ponged peers only)`)
for (const ma of node.getMultiaddrs()) console.log('[relay] listening:', ma.toString())
// The line vessels need: set this as RELAY_MULTIADDR in each substrate's /etc/substrate/env.
const pub = node.getMultiaddrs().map(m => m.toString()).filter(m => m.includes(PUBLIC_IP))
console.log('\nRELAY_MULTIADDR=' + (pub[0] || `/ip4/${PUBLIC_IP}/tcp/${TCP_PORT}/p2p/${node.peerId.toString()}`))

process.on('SIGINT', async () => { await node.stop(); process.exit(0) })
process.on('SIGTERM', async () => { await node.stop(); process.exit(0) })
