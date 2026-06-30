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
import { generateKeyPair, privateKeyFromProtobuf, privateKeyToProtobuf } from '@libp2p/crypto/keys'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const PUBLIC_IP = process.env.PUBLIC_IP || ''            // REQUIRED — the VM's public IPv4
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

console.log('[relay] started. peerId=', node.peerId.toString())
for (const ma of node.getMultiaddrs()) console.log('[relay] listening:', ma.toString())
// The line vessels need: set this as RELAY_MULTIADDR in each substrate's /etc/substrate/env.
const pub = node.getMultiaddrs().map(m => m.toString()).filter(m => m.includes(PUBLIC_IP))
console.log('\nRELAY_MULTIADDR=' + (pub[0] || `/ip4/${PUBLIC_IP}/tcp/${TCP_PORT}/p2p/${node.peerId.toString()}`))

process.on('SIGINT', async () => { await node.stop(); process.exit(0) })
process.on('SIGTERM', async () => { await node.stop(); process.exit(0) })
