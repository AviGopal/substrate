// fed-ingress-log.test.ts — an inbound libp2p request to the federation transport writes
// exactly one `[fed-ingress]` line, and nothing else about the exchange changes.
//
// WHAT IS JUDGED. The transport server under test (this tree's
// scripts/substrate/federation-relay/federation-transport-server.ts, with this tree's
// repos/libp2p-federation-transport) runs as a child process. A fixture-owned client node
// dials it directly on loopback over both inbound protocols. Asserted:
//   - one line per inbound request: shape, the CLIENT's peer id, transport,
//     carries_credential, would_refuse, outcome;
//   - a recognisable fake `_auth` value never appears anywhere in the server's output;
//   - the lpStream response bytes for a fixed frame equal the bytes the unchanged server
//     produced for it, through the same stubbed local owner;
//   - the two LOCAL callers of the shared handler (POST /v2/impulses/resolve and
//     /egress/resolve to self) log no `[fed-ingress]` line.
//
// SAFETY. Loopback only. Discovery and the owning vessel are stubs in this process; every
// other upstream the server knows is pointed at 127.0.0.1:9. The server's identity is
// unique per run, so its peer id cannot collide with a live transport. The child is killed
// by PID. Nothing is written outside a mktemp directory.
//
// NEEDS the federation-relay libp2p dependencies, found in this tree, or the baked image
// copy, or the transport's own install. None found is a FAIL ("cannot judge"), never a skip.
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const FED_DIR = join(ROOT, 'scripts/substrate/federation-relay')
const PKG_DIR = join(ROOT, 'repos/libp2p-federation-transport')
const DEP_CANDIDATES = [
  join(FED_DIR, 'node_modules'),
  '/usr/local/share/substrate/super-repo/scripts/substrate/federation-relay/node_modules',
  join(PKG_DIR, 'node_modules'),
]
const MARKER = 'FEDLOG-FAKE-AUTH-MARKER-7f3a9c'
const OWNED = new Set(['fedlog_owned', 'concept'])

let work = ''
let child: ReturnType<typeof Bun.spawn> | null = null
let output = ''
let pkg: any = null
let multiaddrFn: any = null
let client: any = null
let serverPeer = ''
let serverAddr = ''
let healthPort = 0
let registered: any = null
const stubs: Array<{ stop: (force?: boolean) => void }> = []

const ingressLines = () => output.split('\n').filter((l) => l.startsWith('[fed-ingress]'))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function waitFor(pred: () => boolean, ms: number, what: string) {
  const end = Date.now() + ms
  while (Date.now() < end) { if (pred()) return; await sleep(50) }
  throw new Error('timed out waiting for ' + what + '\n--- server output ---\n' + output.slice(-4000))
}
async function drain(stream: ReadableStream<Uint8Array> | null | undefined) {
  if (!stream) return
  const dec = new TextDecoder()
  for await (const chunk of stream as any) output += dec.decode(chunk, { stream: true })
}

// The lpStream wire format (4-byte big-endian length + UTF-8 JSON), by hand, so the
// response is captured as BYTES rather than as whatever a JSON parser makes of them.
async function rawResolve(pointer: unknown): Promise<string> {
  const stream = await client.node.dialProtocol(multiaddrFn(serverAddr), '/substrate/resolve/1.0.0', { runOnLimitedConnection: true })
  const body = new TextEncoder().encode(JSON.stringify(pointer))
  const out = new Uint8Array(4 + body.length)
  new DataView(out.buffer).setUint32(0, body.length)
  out.set(body, 4)
  for (let off = 0; off < out.length; off += 1024) {
    if (stream.send(out.subarray(off, off + 1024)) === false && typeof stream.onDrain === 'function') await stream.onDrain()
  }
  let acc = new Uint8Array(0)
  for await (const chunk of stream) {
    const b: Uint8Array = chunk instanceof Uint8Array ? chunk : chunk.subarray()
    const next = new Uint8Array(acc.length + b.length); next.set(acc); next.set(b, acc.length); acc = next
    if (acc.length >= 4) {
      const len = new DataView(acc.buffer, acc.byteOffset, 4).getUint32(0)
      if (acc.length >= 4 + len) { await stream.close().catch(() => {}); return new TextDecoder().decode(acc.subarray(4, 4 + len)) }
    }
  }
  throw new Error('stream ended before a full frame arrived')
}

beforeAll(async () => {
  const deps = DEP_CANDIDATES.find((d) => existsSync(join(d, 'libp2p')) && existsSync(join(d, '@libp2p/ping')))
  if (!deps) throw new Error('FAIL - cannot judge: no federation-relay libp2p dependencies at ' + DEP_CANDIDATES.join(' | '))
  if (!existsSync(join(PKG_DIR, 'src/index.ts'))) throw new Error('FAIL - cannot judge: no ' + PKG_DIR + '/src/index.ts (submodule not checked out)')

  // A private copy of the server beside a node_modules whose transport package is THIS
  // tree's (materialised, as the image does, so its deps resolve beside it).
  work = mkdtempSync(join(tmpdir(), 'fed-ingress-log-'))
  const fed = join(work, 'fed')
  const nm = join(fed, 'node_modules')
  mkdirSync(nm, { recursive: true })
  for (const e of readdirSync(deps)) {
    if (e === '@avigopal' || e === '.bin' || e === '.cache') continue
    symlinkSync(join(deps, e), join(nm, e))
  }
  const pkgCopy = join(nm, '@avigopal/libp2p-federation-transport')
  mkdirSync(pkgCopy, { recursive: true })
  cpSync(join(PKG_DIR, 'package.json'), join(pkgCopy, 'package.json'))
  mkdirSync(join(pkgCopy, 'src'))
  for (const f of readdirSync(join(PKG_DIR, 'src')).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))) cpSync(join(PKG_DIR, 'src', f), join(pkgCopy, 'src', f))
  cpSync(join(FED_DIR, 'federation-transport-server.ts'), join(fed, 'federation-transport-server.ts'))

  pkg = await import(join(pkgCopy, 'src/index.ts'))
  multiaddrFn = (await import(Bun.resolveSync('@multiformats/multiaddr', fed))).multiaddr

  // The stubbed local owner, and a discovery that names it for the OWNED shapes.
  const owner = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(req) {
      const b: any = await req.json().catch(() => ({}))
      return Response.json({ success: true, shape: String(b?.type ?? ''), body: { answer: 42, asked: String(b?.q ?? '') } })
    },
  })
  stubs.push(owner)
  const discovery = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(req) {
      const u = new URL(req.url)
      if (u.pathname === '/register') { const b: any = await req.json().catch(() => null); if (b?.vesselId === 'federation-transport-vessel') registered = b; return new Response('{}', { status: 201 }) }
      if (u.pathname === '/resolve') {
        const b: any = await req.json().catch(() => ({}))
        const p = b?.pointer ?? {}
        const vessels = p.type === 'vesselCapability' && OWNED.has(String(p.shape))
          ? [{ vesselId: 'stub-owner', endpoint: `http://127.0.0.1:${owner.port}`, resolve_endpoint: '/v2/impulses/resolve', protocol: 'http' }]
          : []
        return Response.json({ content: { vessels } })
      }
      return new Response('not found', { status: 404 })
    },
  })
  stubs.push(discovery)

  const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('') })
  healthPort = probe.port
  probe.stop(true)
  const dead = 'http://127.0.0.1:9'
  child = Bun.spawn([process.execPath, join(fed, 'federation-transport-server.ts')], {
    cwd: fed,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: work, TMPDIR: work, NODE_ENV: 'test', TZ: 'UTC',
      FED_VESSEL_ID: 'federation-transport-vessel',
      FED_SUBSTRATE_ID: `fed-ingress-log-test-${process.pid}-${Date.now()}`,
      FED_HEALTH_PORT: String(healthPort),
      DISCOVERY_URL: `http://127.0.0.1:${discovery.port}`,
      ACTIVITY_API_URL: dead, DEVELOPMENT_VESSEL_URL: dead, IDENTITY_UPSTREAM_URL: dead,
      METABOB_API_KEY: 'fedlog-test-key-not-a-credential',
      FED_PROBE_PATH: '/nonexistent/federation-probe-tick.ts', BUN_BIN: '/nonexistent/bun',
    },
    stdout: 'pipe', stderr: 'pipe',
  })
  void drain(child.stdout as any); void drain(child.stderr as any)
  await waitFor(() => output.includes('[fed-transport] up '), 45_000, 'the transport to come up')
  await waitFor(() => Array.isArray(registered?.libp2p_multiaddr), 15_000, 'the transport to register its addresses')
  serverPeer = String(registered.libp2p_peer_id)
  const direct = (registered.libp2p_multiaddr as string[]).find((m) => m.startsWith('/ip4/127.0.0.1/tcp/'))
  if (!direct) throw new Error('no loopback address registered: ' + JSON.stringify(registered.libp2p_multiaddr))
  serverAddr = direct.includes('/p2p/') ? direct : `${direct}/p2p/${serverPeer}`
  client = await pkg.createVesselLibp2p({ vesselId: `fed-ingress-log-client-${process.pid}-${Date.now()}`, enableHttp: true, disableDcutr: true })
}, 90_000)

afterAll(async () => {
  await client?.stop().catch(() => {})
  if (child) { try { process.kill(child.pid, 'SIGKILL') } catch {} }
  for (const s of stubs) s.stop(true)
  if (work) rmSync(work, { recursive: true, force: true })
})

test('the lpStream response to a fixed frame is byte-identical to the unchanged server\'s', async () => {
  const raw = await rawResolve({ type: 'fedlog_owned', q: 'same-frame', _auth: MARKER })
  // The unchanged server's answer for this frame through this owner, byte for byte.
  expect(raw).toBe('{"content":{"shape":"fedlog_owned","produced_by":"stub-owner@federation-transport-vessel","body":{"answer":42,"asked":"same-frame"},"note":"proxied to the owning vessel on the peer substrate over libp2p"},"metadata":{"shape":"fedlog_owned"}}')
}, 30_000)

test('an inbound lpStream frame writes exactly one [fed-ingress] line, without the credential', async () => {
  const before = ingressLines().length
  await rawResolve({ type: 'fedlog_owned', q: 'lp', _auth: MARKER })
  const want = `[fed-ingress] shape=fedlog_owned peer=${client.peerId} transport=lpstream carries_credential=y would_refuse=y outcome=ok`
  await waitFor(() => ingressLines().length > before, 5_000, 'the [fed-ingress] line')
  await sleep(300)
  expect(ingressLines().slice(before)).toEqual([want])
}, 30_000)

test('an inbound HTTP-over-libp2p request writes one line; an allowlisted shape is would_refuse=n', async () => {
  const before = ingressLines().length
  const res = await pkg.resolveViaHttp(client, serverAddr, { type: 'concept', q: 'http' })
  expect(res?.content?.shape).toBe('concept')
  await waitFor(() => ingressLines().length > before, 5_000, 'the [fed-ingress] line')
  await sleep(300)
  expect(ingressLines().slice(before)).toEqual([`[fed-ingress] shape=concept peer=${client.peerId} transport=http carries_credential=n would_refuse=n outcome=ok`])
}, 30_000)

test('an inbound request the handler answers with an error logs outcome=error', async () => {
  const before = ingressLines().length
  const raw = await rawResolve({ type: 'fedlog_unowned' })
  expect(JSON.parse(raw).content.error).toContain('unknown shape')
  await waitFor(() => ingressLines().length > before, 5_000, 'the [fed-ingress] line')
  await sleep(300)
  expect(ingressLines().slice(before)).toEqual([`[fed-ingress] shape=fedlog_unowned peer=${client.peerId} transport=lpstream carries_credential=n would_refuse=y outcome=error`])
}, 30_000)

test('the local callers of the shared handler log no [fed-ingress] line', async () => {
  const before = ingressLines().length
  const local = await fetch(`http://127.0.0.1:${healthPort}/v2/impulses/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedlog_owned', q: 'local', _auth: MARKER } } }),
  })
  expect(local.status).toBe(200)
  expect(((await local.json()) as any)?.content?.body?.answer).toBe(42)
  const self = await fetch(`http://127.0.0.1:${healthPort}/egress/resolve?target=${encodeURIComponent(serverPeer)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedlog_owned', q: 'self' } } }),
  })
  expect(self.status).toBe(200)
  expect(((await self.json()) as any)?.content?.body?.answer).toBe(42)
  await sleep(1000)
  expect(ingressLines().slice(before)).toEqual([])
}, 30_000)

test('the fake credential never reaches the server\'s output', () => {
  expect(output.length).toBeGreaterThan(0)
  expect(output.includes(MARKER)).toBe(false)
})
