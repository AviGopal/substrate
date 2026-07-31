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
    ping: ping({ timeout: parseInt(process.env.RELAY_PING_TIMEOUT_MS || '10000', 10) }), // active liveness for the keep-alive loop below
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
// relay can neither notice nor reconnect. HOP CONNECTs to that peer then fail
// with NO_RESERVATION even though the peer's reservation TTL looks full — the
// recurring hub→spoke storm (~74-min cadence, all fails targeting the NAT'd
// spoke). js-libp2p's connectionManager has no keep-alive/liveness probe, so we
// add one: every RELAY_KEEPALIVE_MS (< a ~30s NAT idle timeout) ping each
// reserved peer over its DIRECT (non-limited) connection. The ping traffic keeps
// the NAT mapping alive (prevents the half-open), and a ping FAILURE means the
// connection is already dead — force-close it so the peer's own
// connection:close handler fires an immediate re-dial + fresh RESERVE, instead
// of the reservation rotting until its 1h TTL.
const KEEPALIVE_MS = parseInt(process.env.RELAY_KEEPALIVE_MS || '20000', 10)
const PING_TIMEOUT_MS = parseInt(process.env.RELAY_PING_TIMEOUT_MS || '10000', 10)
setInterval(() => {
  for (const peerId of node.services.relay.reservations.keys()) {
    // Only probe the DIRECT reservation-holding connection (limits == null);
    // relayed circuits carry non-null limits and must not be pinged/closed here.
    const direct = node.getConnections(peerId).filter((c) => c.limits == null && c.status === 'open')
    if (direct.length === 0) continue
    void node.services.ping.ping(peerId, { signal: AbortSignal.timeout(PING_TIMEOUT_MS) })
      .catch(() => {
        console.log(`[relay] keep-alive ping failed for …${peerId.toString().slice(-8)} — closing dead reserved-peer connection to force re-dial`)
        for (const c of direct) { c.close().catch(() => c.abort(new Error('keep-alive: dead connection'))) }
      })
  }
}, KEEPALIVE_MS)

console.log('[relay] started. peerId=', node.peerId.toString())
console.log(`[relay] reserved-peer keep-alive: ping every ${KEEPALIVE_MS}ms (timeout ${PING_TIMEOUT_MS}ms)`)
for (const ma of node.getMultiaddrs()) console.log('[relay] listening:', ma.toString())
// The line vessels need: set this as RELAY_MULTIADDR in each substrate's /etc/substrate/env.
const pub = node.getMultiaddrs().map(m => m.toString()).filter(m => m.includes(PUBLIC_IP))
console.log('\nRELAY_MULTIADDR=' + (pub[0] || `/ip4/${PUBLIC_IP}/tcp/${TCP_PORT}/p2p/${node.peerId.toString()}`))

process.on('SIGINT', async () => { await node.stop(); process.exit(0) })
process.on('SIGTERM', async () => { await node.stop(); process.exit(0) })
