// fed-owner-status.test.ts — an owning vessel's refusal crosses the federation transport as a refusal: its status and
// its reason reach the caller, never a 200 holding the refusal in its body.
//
// WHY. proxyToVessel read the owner's JSON and not its status, so records' 403 for a cross-node write ("cross-node
// writes wait for person marking") came back through the hop as {content: {body: {failure: ...}}} with status 200, and
// a person's refused ask was shown as asked.
//
// WHAT IS JUDGED. The transport server of this tree runs as a child process (the harness of fed-ingress-log.test.ts),
// with a stub owner that answers one shape normally and refuses another the way records does (403,
// {failure: {status, body}}). Asserted, for the refused shape: the lpStream ingress answer carries failure {status 403,
// the reason}; POST /v2/impulses/resolve answers 403 with the reason; /egress/resolve to self answers 403 with the
// reason. For the answered shape, every path still answers 200 with the owner's body. And an answer whose content
// holds a failure-shaped object (a 2xx from the owner with a top-level {failure: {status: 403}}, and a peer whose answer
// is such a row) still crosses as 200: the status comes from the transport's own mark of an owner's non-2xx, never from
// what an answer contains.
//
// SAFETY and NEEDS: as fed-ingress-log.test.ts (loopback only, stubs in this process, a private state dir, the
// federation-relay libp2p dependencies or a FAIL, never a skip).
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
const OWNED = new Set(['fedstatus_ok', 'fedstatus_refused', 'fedstatus_rowlike'])
const REASON = 'cross-node writes wait for person marking'

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
  work = mkdtempSync(join(tmpdir(), 'fed-owner-status-'))
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
  cpSync(join(FED_DIR, 'ingress-auth.ts'), join(fed, 'ingress-auth.ts'))

  pkg = await import(join(pkgCopy, 'src/index.ts'))
  multiaddrFn = (await import(Bun.resolveSync('@multiformats/multiaddr', fed))).multiaddr

  // The stubbed local owner, and a discovery that names it for the OWNED shapes.
  const owner = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(req) {
      const b: any = await req.json().catch(() => ({}))
      // records' own refusal, as it answers one: {failure: {status, body}} with that status
      if (String(b?.type) === 'fedstatus_refused') return Response.json({ failure: { status: 403, body: REASON } }, { status: 403 })
      // an answer (200) that happens to be failure-shaped: a failure row, a tool's refusal object
      if (String(b?.type) === 'fedstatus_rowlike') return Response.json({ failure: { status: 403, body: 'a failure-shaped row' } })
      return Response.json({ success: true, shape: String(b?.type ?? ''), body: { answer: 42 } })
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
      FED_SUBSTRATE_ID: `fed-owner-status-test-${process.pid}-${Date.now()}`,
      FED_HEALTH_PORT: String(healthPort),
      DISCOVERY_URL: `http://127.0.0.1:${discovery.port}`,
      ACTIVITY_API_URL: dead, DEVELOPMENT_VESSEL_URL: dead, IDENTITY_UPSTREAM_URL: dead,
      // The inbound-auth ratchet lives in the transport's state dir; a private one, so a live node's ratchet can never
      // flip this server into enforce (no policy is readable here: mode off, today's behaviour).
      FED_STATE_DIR: join(work, 'state'),
      METABOB_API_KEY: 'fedstatus-test-key-not-a-credential',
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
  client = await pkg.createVesselLibp2p({ vesselId: `fed-owner-status-client-${process.pid}-${Date.now()}`, enableHttp: true, disableDcutr: true })
}, 90_000)

afterAll(async () => {
  await client?.stop().catch(() => {})
  if (child) { try { process.kill(child.pid, 'SIGKILL') } catch {} }
  for (const s of stubs) s.stop(true)
  if (work) rmSync(work, { recursive: true, force: true })
})


test('an owner refusal reaches an lpStream caller as the owner\'s status and reason', async () => {
  const raw = JSON.parse(await rawResolve({ type: 'fedstatus_refused', q: 'lp' }))
  expect(raw?.content?.failure).toEqual({ status: 403, body: REASON })
  expect(raw?.content?.body).toBeUndefined()
}, 30_000)

test('an owner refusal reaches a local caller as the owner\'s status, on both local paths', async () => {
  const local = await fetch(`http://127.0.0.1:${healthPort}/v2/impulses/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedstatus_refused', q: 'local' } } }),
  })
  expect(local.status).toBe(403)
  expect(((await local.json()) as any)?.content?.failure?.body).toBe(REASON)
  const self = await fetch(`http://127.0.0.1:${healthPort}/egress/resolve?target=${encodeURIComponent(serverPeer)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedstatus_refused', q: 'self' } } }),
  })
  expect(self.status).toBe(403)
  expect(JSON.stringify(await self.json())).toContain(REASON)
}, 30_000)

test('an answered shape still crosses as a 200 with the owner\'s body (a guard)', async () => {
  const raw = JSON.parse(await rawResolve({ type: 'fedstatus_ok', q: 'lp' }))
  expect(raw?.content?.body?.answer).toBe(42)
  const local = await fetch(`http://127.0.0.1:${healthPort}/v2/impulses/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedstatus_ok', q: 'local' } } }),
  })
  expect(local.status).toBe(200)
  const self = await fetch(`http://127.0.0.1:${healthPort}/egress/resolve?target=${encodeURIComponent(serverPeer)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedstatus_ok', q: 'self' } } }),
  })
  expect(self.status).toBe(200)
}, 30_000)

test('an answer holding a failure-shaped object is an answer: 200 on every path (owner and relayed peer)', async () => {
  const local = await fetch(`http://127.0.0.1:${healthPort}/v2/impulses/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedstatus_rowlike', q: 'local' } } }),
  })
  expect(local.status).toBe(200)
  const self = await fetch(`http://127.0.0.1:${healthPort}/egress/resolve?target=${encodeURIComponent(serverPeer)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedstatus_rowlike', q: 'self' } } }),
  })
  expect(self.status).toBe(200)
  // A peer (the test's own node) whose answer is a failure-shaped row at the top of its content.
  await pkg.serveResolve(client, async () => ({ shape: 'fedstatus_peerrow', failure: { status: 403, body: 'a failure-shaped row' } }))
  const peerAddr = (client.node.getMultiaddrs() as any[]).map(String).find((m: string) => m.startsWith('/ip4/127.0.0.1/tcp/'))
  expect(peerAddr).toBeDefined()
  const viaPeer = await fetch(`http://127.0.0.1:${healthPort}/egress/resolve?target=${encodeURIComponent(String(peerAddr))}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ impulse: { pointer: { type: 'fedstatus_peerrow', q: 'peer' } } }),
  })
  const vb: any = await viaPeer.json()
  expect(vb?.content?.failure?.status).toBe(403)
  expect(viaPeer.status).toBe(200)
}, 30_000)
