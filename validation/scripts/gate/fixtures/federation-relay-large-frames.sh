#!/usr/bin/env bash
# kind: known-valid
# The candidate federation relay carries large frames on two circuits at once. Run by shadow-eval.sh with
# CANDIDATE_DIR (see its header).
#
# WHY. Noise hands every frame of 1200 bytes or more to node:crypto's chacha20-poly1305, which Bun does not
# implement ("Unknown cipher"). A relay still on that default aborts every circuit that carries such a frame
# (af119736). Vessels write at most 1 KiB at a time, so in the fleet those frames form only when writes
# coalesce under load. The relay runs from the baked super-repo tree, so this fixture is what lets that
# tree converge in place: a relay change is judged by what it does, not by whether it parses.
#
# HOW. The candidate's relay.ts runs on a random loopback port. One Bun process holds three fixture-owned
# libp2p nodes, built from the node's baked relay dependencies: a sender and two receivers, each receiver
# reserving a circuit.
#   - DCUtR and AutoNAT are off and the nodes listen on no TCP port, so every byte crosses the relay.
#   - All three use the AssemblyScript cipher, so only the candidate relay can mis-encrypt a large frame.
#   - Over the same connections the sender first sends 200 bytes on both circuits (the control). If that
#     fails, nothing can be judged.
#   - Then it sends 1 MiB on both circuits at once, in 16 KiB writes, so large frames are certain rather
#     than timing-dependent. It counts the frames of 1200 bytes or more it encrypts; a run with none is
#     "cannot judge", never a pass.
#   - Each receiver replies with the length and sha256 of what arrived. Pass only if both match and no
#     connection other than the relay's was opened.
# Everything runs in one process: a second process would open fresh loopback connections within a second,
# and libp2p's per-host inbound rate limit can refuse them.
#
# NEEDS a bun that the shadow sandbox's nobody can execute. An image whose only bun lives under /root
# (mode 0700) fails here as "cannot judge", by design: a skip would read as a pass.
#
# SAFETY. Loopback only, no egress. The relay's env-file persistence is pointed at scratch (its default is
# /etc/substrate/env). Every child runs under its own timeout, shorter than the fixture budget, and is
# killed by PID. The candidate transport server is NOT run here: by default it calls live loopback services
# (discovery, development-vessel), and the shadow sandbox shares the node's network.
#
# MEASURED in containers of image accepted-4277b49d with no network, as nobody under env -i, with a
# world-executable bun:
#   - relay.ts at af119736^ (blob 42452cf4): FAIL 5 of 5, with both circuits erroring. The control passes.
#   - relay.ts at af119736  (blob 65dde115): PASS 5 of 5, 256 large frames each run. The control passes.
#   - No run opened a direct connection. About 3 s per run.
set -uo pipefail
: "${CANDIDATE_DIR:?run by shadow-eval.sh}"
REL="$CANDIDATE_DIR/scripts/substrate/federation-relay/relay.ts"
NM="${FED_NODE_MODULES:-/usr/local/share/substrate/super-repo/scripts/substrate/federation-relay/node_modules}"
BUN="${FED_BUN:-$(command -v bun || echo /usr/local/bin/node)}"
[ -f "$REL" ] || { echo "FAIL - the candidate has no scripts/substrate/federation-relay/relay.ts"; exit 1; }
[ -d "$NM/libp2p" ] && [ -n "$("$BUN" -e 'console.log(process.versions.bun ?? "")' 2>/dev/null)" ] \
  || { echo "FAIL - cannot judge: no baked relay dependencies at $NM or no bun at $BUN (a skip would read as a pass)"; exit 1; }
W="$(mktemp -d "${TMPDIR:-/tmp}/fx-relay-frames.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
PIDS=()
trap 'for p in "${PIDS[@]}"; do kill -9 "$p" 2>/dev/null; done; rm -rf "$W"' EXIT
mkdir -p "$W/fed"; cp "$REL" "$W/fed/relay.ts"; ln -s "$NM" "$W/fed/node_modules"
cat > "$W/fed/blob.ts" <<'TS'
// blob.ts <relay-multiaddr>: prints CONTROL, RESULTS, VERDICT pass|fail|cannot-judge (and DIAG on a timeout).
// Three nodes in this one process: a sender A and receivers B1 B2. DCUtR and AutoNAT are off and none of them
// listens on TCP, so every byte crosses the relay. All three use the AssemblyScript cipher, so only the relay
// can mis-encrypt a large frame. Each receiver reserves a circuit. Over the SAME connections A first sends
// 200 bytes to both circuits (the control), then 1 MiB to both at once. Each receiver replies with the length
// and sha256 of what arrived. One process, so one set of connections: a second process would open fresh
// loopback connections within a second, and libp2p's per-host inbound rate limit can refuse them.
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { asCrypto, defaultCrypto } from '@chainsafe/libp2p-noise/crypto'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { multiaddr } from '@multiformats/multiaddr'
import { createHash } from 'node:crypto'
const relayAddr = process.argv[2]
const PROTO = '/fixture/blob/1.0.0', CHUNK = 16384, LARGE = 1 << 20
const RELAY_ID = relayAddr.split('/p2p/').pop() ?? '#'
// The trigger is a noise frame of 1200 bytes or more. Count the ones A encrypts: a run that never sent one
// says nothing about the relay, and must not read as a pass.
let large = 0
const enc = (counting: boolean) => noise({ crypto: { ...defaultCrypto,
  chaCha20Poly1305Encrypt: (p: any, n: any, ad: any, k: any) => { if (counting && p.byteLength >= 1200) large++; return asCrypto.chaCha20Poly1305Encrypt(p, n, ad, k) },
  chaCha20Poly1305Decrypt: asCrypto.chaCha20Poly1305Decrypt } })
const mk = (listen: string[], counting = false) => createLibp2p({ addresses: { listen }, transports: [tcp(), circuitRelayTransport()],
  connectionEncrypters: [enc(counting)], streamMuxers: [yamux()], services: { identify: identify() } })
// Each 16 KiB send() goes out as one muxer frame, which noise encrypts as one frame far above 1200 bytes.
// So the trigger does not depend on writes coalescing under load. Drain when the stream asks.
async function sendAll(s: any, b: Uint8Array) {
  for (let o = 0; o < b.length; o += CHUNK) if (s.send(b.subarray(o, o + CHUNK)) === false) await s.onDrain() }
const GOT: Record<string, number> = {}; const SENT: any[] = []; let stage = 'setup'
async function readAll(s: any, want: number, tag = '') { const parts: Uint8Array[] = []; let n = 0
  for await (const c of s) { const u = c.subarray ? c.subarray() : c; parts.push(u); n += u.length; if (tag) GOT[tag] = n; if (n >= want) break }
  return Buffer.concat(parts) }
// A connection error outside a stream (the relay resetting a link it could not encrypt for) fails this run;
// it must not crash the harness.
let stray = 0; const strays: string[] = []
const onStray = (e: any) => { stray++; if (strays.length < 3) strays.push(String(e?.name ?? '') + ': ' + String(e?.message ?? e).slice(0, 100)) }
process.on('unhandledRejection', onStray); process.on('uncaughtException', onStray)
// On a timeout, say where it stopped: the stage, bytes arrived per receiver, and each sender stream's state.
const deadline = setTimeout(() => {
  console.log('DIAG stage=' + stage + ' got=' + JSON.stringify(GOT) + ' senders=' + JSON.stringify(SENT.map((s: any) => ({ wbuf: s.writeBufferLength, needsDrain: s.writableNeedsDrain, ws: s.writeStatus, st: s.status }))) + ' strays=' + JSON.stringify(strays))
  console.log('VERDICT fail (timed out at ' + stage + ')'); process.exit(3) }, 90_000)
const relay = multiaddr(relayAddr)
let nrecv = 0
const recv = async () => {
  const n = await mk(['/p2p-circuit'])
  await n.handle(PROTO, (s: any) => { void (async () => {
    try { // the sender names the size in an 8-byte header; header and body may share a chunk
      const tag = 'recv' + (nrecv++); const parts: Uint8Array[] = []; let n = 0, want = -1
      for await (const c of s) { const u = c.subarray ? c.subarray() : c; parts.push(u); n += u.length
        if (want < 0 && n >= 8) want = 8 + Number(new TextDecoder().decode(Buffer.concat(parts).subarray(0, 8)).trim())
        GOT[tag] = n; if (want >= 0 && n >= want) break }
      const b = Buffer.concat(parts).subarray(8)
      s.send(new TextEncoder().encode(JSON.stringify({ len: b.length, sha: createHash('sha256').update(b).digest('hex') }) + '\n')); await s.close()
    } catch (e) { try { s.abort(e as Error) } catch {} } })() }, { runOnLimitedConnection: true })
  await n.dial(relay)
  for (let i = 0; i < 100; i++) { const c = n.getMultiaddrs().map(String).find(a => a.includes('/p2p-circuit/p2p/')); if (c) return { n, c }; await new Promise(r => setTimeout(r, 100)) }
  throw new Error('no circuit reservation on the relay within 10 s')
}
const bodyOf = (size: number) => { const b = new Uint8Array(size); for (let i = 0; i < size; i++) b[i] = (i * 2654435761) >>> 24; return b }
async function main() {
  const [b1, b2] = await Promise.all([recv(), recv()])
  const a = await mk([], true); await a.dial(relay)
  const one = async (target: string, body: Uint8Array) => {
    const sha = createHash('sha256').update(body).digest('hex')
    try { const s: any = await a.dialProtocol(multiaddr(target), PROTO, { runOnLimitedConnection: true }); SENT.push(s)
      s.send(new TextEncoder().encode(String(body.length).padStart(8, ' ')))
      await sendAll(s, body); const r = JSON.parse((await readAll(s, 1)).toString().trim().split('\n')[0] || '{}')
      return r.len === body.length && r.sha === sha ? 'ok' : `short len=${r.len}`
    } catch (e) { return 'error ' + String((e as Error)?.message ?? e).slice(0, 120) } }
  const tally = (res: string[]) => { const c: Record<string, number> = {}; for (const r of res) c[r] = (c[r] ?? 0) + 1; return JSON.stringify(c) }
  stage = 'control'
  const small = bodyOf(200); const ctl = await Promise.all([one(b1.c, small), one(b2.c, small)])
  console.log('CONTROL ' + tally(ctl))
  if (!ctl.every(r => r === 'ok')) { console.log('VERDICT cannot-judge (the 200-byte control failed)'); return [a, b1.n, b2.n] }
  stage = 'large'; const before = large
  const big = bodyOf(LARGE); const res = await Promise.all([one(b1.c, big), one(b2.c, big)])
  const sentLarge = large - before
  const direct = [a, b1.n, b2.n].some(n => n.getConnections().some(c => !String(c.remoteAddr).includes('p2p-circuit') && !String(c.remoteAddr).includes(RELAY_ID)))
  console.log('RESULTS ' + tally(res) + ' large_frames_sent=' + sentLarge + ' direct_connections=' + direct + ' stray_errors=' + stray + (strays.length ? ' ' + JSON.stringify(strays) : ''))
  if (!res.every(r => r === 'ok') || direct || stray > 0) console.log('VERDICT fail')
  else if (sentLarge === 0) console.log('VERDICT cannot-judge (no noise frame of 1200 bytes or more was sent)')
  else console.log('VERDICT pass')
  return [a, b1.n, b2.n]
}
const nodes = await main().catch((e) => { console.log('VERDICT fail (' + stage + ': ' + String((e as Error)?.message ?? e).slice(0, 160) + ')'); return [] as any[] })
clearTimeout(deadline); await Promise.all(nodes.map((n: any) => n.stop())).catch(() => {}); process.exit(0)
TS
port="$("$BUN" -e 'const s=Bun.listen({hostname:"127.0.0.1",port:0,socket:{data(){}}});console.log(s.port);s.stop(true)')"
( cd "$W/fed" && exec env PUBLIC_IP=127.0.0.1 RELAY_TCP_PORT="$port" RELAY_KEY_FILE="$W/relay.key" \
    SUBSTRATE_ENV_FILE="$W/env" SUBSTRATE_PROVENANCE_FILE="$W/env.provenance" \
    timeout 220 "$BUN" relay.ts ) > "$W/relay.log" 2>&1 & PIDS+=($!)
for _ in $(seq 1 60); do grep -q "/tcp/$port/p2p/" "$W/relay.log" && break; sleep 0.5; done
rid="$(grep -o "/tcp/$port/p2p/[A-Za-z0-9]*" "$W/relay.log" | head -1 | sed 's#.*/p2p/##')"
[ -n "$rid" ] || { echo "FAIL - the candidate relay never announced /ip4/127.0.0.1/tcp/$port/p2p/<id>: $(tail -3 "$W/relay.log" | tr '\n' ' ' | cut -c1-300)"; exit 1; }
RA="/ip4/127.0.0.1/tcp/$port/p2p/$rid"
out="$( (cd "$W/fed" && timeout 110 "$BUN" blob.ts "$RA" 2>&1) | grep -E '^(CONTROL|RESULTS|VERDICT|DIAG)')"
v="$(sed -n 's/^VERDICT //p' <<<"$out")"
case "$v" in
  pass) ;;
  cannot-judge*) echo "FAIL - cannot judge: $v; $(tr '\n' ' ' <<<"$out" | cut -c1-400)"; exit 1 ;;
  *) echo "FAIL - the candidate relay drops large frames on two concurrent circuits: $(tr '\n' ' ' <<<"$out" | cut -c1-500)"; exit 1 ;;
esac
echo "ok - the candidate relay carries 1 MiB bodies on two concurrent circuits ($(sed -n 's/^RESULTS //p' <<<"$out"))"
exit 0
