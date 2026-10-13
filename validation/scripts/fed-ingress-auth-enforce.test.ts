// fed-ingress-auth-enforce.test.ts — THE REAL TRANSPORT SERVER WITH INBOUND AUTHENTICATION IN ENFORCE MODE (operator
// exception, user ruling 2026-10-12). Companion to fed-ingress-auth.test.ts (the pure logic) and fed-ingress-log.test.ts
// (mode off: today's behaviour, unchanged).
//
// WHAT IS JUDGED. This tree's federation-transport-server.ts + ingress-auth.ts + repos/libp2p-federation-transport run as a
// child process. Its policy pool (fedIngressAuthPolicy = enforce), identity (/v1/keys/validate), discovery and the owning
// vessel are stubs in this process. Two client nodes dial it; the SAME client is listed in same_authority_peers, the
// FOREIGN one is not. Asserted:
//   - a non-public shape with no credential, or an invalid one, is REFUSED (unauthorized, with the reason), and the owner
//     is never called; a valid _fedAuth is answered, and the OWNER receives the pointer WITHOUT the credential;
//   - substrateBootstrap (the only PUBLIC shape) is answered with no credential;
//   - egress: a local caller's own `Authorization: ApiKey` reaches the SAME-authority peer as _fedAuth, and the FOREIGN peer
//     receives no _fedAuth at all (no bearer key across a trust boundary); a caller with no header sends none;
//   - no planted key ever appears in the server's output (logs), in any refusal body, or at the owner.
//
// SAFETY. Loopback only; every other upstream is 127.0.0.1:9; unique identities per run; the child is killed by PID; the
// ratchet sentinel is written in a private mktemp state dir. Placeholder keys only.
// NEEDS the federation-relay libp2p dependencies (this tree, the baked image copy, or the transport's install) and the
// repos/libp2p-federation-transport checkout. None found is a FAIL ("cannot judge"), never a skip.
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
const VALID = 'FEDAUTH-PLACEHOLDER-VALID-KEY-a1'
const INVALID = 'FEDAUTH-PLACEHOLDER-INVALID-KEY-b2'
const TRANSPORT_KEY = 'fedauth-test-transport-key-not-a-credential'
const OWNED = new Set(['fedauth_owned'])

let work = ''
let child: ReturnType<typeof Bun.spawn> | null = null
let output = ''
let pkg: any = null
let multiaddrFn: any = null
let same: any = null
let foreign: any = null
let serverAddr = ''
let healthPort = 0
let registered: any = null
const ownerSaw: any[] = []
const sameSaw: any[] = []
const foreignSaw: any[] = []
let policyBody: Record<string, unknown> = { mode: 'enforce', same_authority_peers: [], cache: false }
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
const loopback = (node: any): string => {
  const a = (node.node.getMultiaddrs() as any[]).map((m) => m.toString()).find((m: string) => m.startsWith('/ip4/127.0.0.1/tcp/'))
  if (!a) throw new Error('client has no loopback listen address')
  return a.includes('/p2p/') ? a : `${a}/p2p/${node.peerId}`
}
async function inbound(pointer: unknown): Promise<any> {
  return await pkg.resolveViaLibp2p(same, serverAddr, pointer)
}
async function egress(target: string, pointer: unknown, key: string | null): Promise<Response> {
  return await fetch(`http://127.0.0.1:${healthPort}/egress/resolve?target=${encodeURIComponent(target)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'ApiKey ' + key } : {}) },
    body: JSON.stringify({ impulse: { pointer } }),
  })
}

beforeAll(async () => {
  const deps = DEP_CANDIDATES.find((d) => existsSync(join(d, 'libp2p')) && existsSync(join(d, '@libp2p/ping')))
  if (!deps) throw new Error('FAIL - cannot judge: no federation-relay libp2p dependencies at ' + DEP_CANDIDATES.join(' | '))
  if (!existsSync(join(PKG_DIR, 'src/index.ts'))) throw new Error('FAIL - cannot judge: no ' + PKG_DIR + '/src/index.ts (submodule not checked out)')

  work = mkdtempSync(join(tmpdir(), 'fed-ingress-auth-'))
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

  // Two client nodes that also SERVE resolve, so what the server's egress sends them is captured verbatim.
  same = await pkg.createVesselLibp2p({ vesselId: `fedauth-same-${process.pid}-${Date.now()}`, enableHttp: true, disableDcutr: true })
  foreign = await pkg.createVesselLibp2p({ vesselId: `fedauth-foreign-${process.pid}-${Date.now()}`, enableHttp: true, disableDcutr: true })
  await pkg.serveResolve(same, async (p: any) => { sameSaw.push(p); return { shape: String(p?.type ?? ''), produced_by: 'same', body: { ok: true } } })
  await pkg.serveResolve(foreign, async (p: any) => { foreignSaw.push(p); return { shape: String(p?.type ?? ''), produced_by: 'foreign', body: { ok: true } } })
  policyBody = { mode: 'enforce', same_authority_peers: [String(same.peerId)], same_authority_substrates: ['placeholder-hub'], cache: false }

  const owner = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
    const b: any = await req.json().catch(() => ({}))
    ownerSaw.push(b)
    return Response.json({ success: true, shape: String(b?.type ?? ''), body: { answer: 7 } })
  } })
  stubs.push(owner)
  const discovery = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
    const u = new URL(req.url)
    if (u.pathname === '/register') { const b: any = await req.json().catch(() => null); if (b?.vesselId === 'federation-transport-vessel') registered = b; return new Response('{}', { status: 201 }) }
    if (u.pathname === '/bootstrap') return Response.json({ anchors: { placeholder: true } })
    if (u.pathname === '/resolve') {
      const b: any = await req.json().catch(() => ({}))
      const p = b?.pointer ?? {}
      const vessels = p.type === 'vesselCapability' && OWNED.has(String(p.shape))
        ? [{ vesselId: 'stub-owner', endpoint: `http://127.0.0.1:${owner.port}`, resolve_endpoint: '/v2/impulses/resolve', protocol: 'http' }]
        : []
      return Response.json({ content: { vessels } })
    }
    return new Response('not found', { status: 404 })
  } })
  stubs.push(discovery)
  const pool = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
    const b: any = await req.json().catch(() => ({}))
    const p = b?.impulse?.pointer ?? {}
    // A VERIFIED OPERATOR row, as development-vessel's read marks a trust-root write it attested (the transport honours nothing else).
    const impulses = p.shape === 'fedIngressAuthPolicy' ? [{ shape: 'fedIngressAuthPolicy', status: 'open', body: policyBody, attested_verified: true, attested: { by: 'operator', key_id: 'k-placeholder' } }] : []
    return Response.json({ success: true, body: { impulses } })
  } })
  stubs.push(pool)
  const identity = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
    const b: any = await req.json().catch(() => ({}))
    return Response.json({ data: b?.api_key === VALID ? { valid: true, org_id: 'org-placeholder', user_id: 'user-placeholder', scopes: ['read'] } : { valid: false } })
  } })
  stubs.push(identity)

  const probe = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('') })
  healthPort = probe.port
  probe.stop(true)
  const dead = 'http://127.0.0.1:9'
  child = Bun.spawn([process.execPath, join(fed, 'federation-transport-server.ts')], {
    cwd: fed,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: work, TMPDIR: work, NODE_ENV: 'test', TZ: 'UTC',
      FED_VESSEL_ID: 'federation-transport-vessel',
      FED_SUBSTRATE_ID: `fed-ingress-auth-test-${process.pid}-${Date.now()}`,
      FED_HEALTH_PORT: String(healthPort),
      DISCOVERY_URL: `http://127.0.0.1:${discovery.port}`,
      DEVELOPMENT_VESSEL_URL: `http://127.0.0.1:${pool.port}`,
      IDENTITY_VESSEL_URL: `http://127.0.0.1:${identity.port}`,
      ACTIVITY_API_URL: dead, IDENTITY_UPSTREAM_URL: dead,
      FED_STATE_DIR: join(work, 'state'),
      METABOB_API_KEY: TRANSPORT_KEY,
      FED_PROBE_PATH: '/nonexistent/federation-probe-tick.ts', BUN_BIN: '/nonexistent/bun',
    },
    stdout: 'pipe', stderr: 'pipe',
  })
  void drain(child.stdout as any); void drain(child.stderr as any)
  await waitFor(() => output.includes('[fed-transport] up '), 45_000, 'the transport to come up')
  await waitFor(() => Array.isArray(registered?.libp2p_multiaddr), 15_000, 'the transport to register its addresses')
  const direct = (registered.libp2p_multiaddr as string[]).find((m) => m.startsWith('/ip4/127.0.0.1/tcp/'))
  if (!direct) throw new Error('no loopback address registered: ' + JSON.stringify(registered.libp2p_multiaddr))
  serverAddr = direct.includes('/p2p/') ? direct : `${direct}/p2p/${registered.libp2p_peer_id}`
  void multiaddrFn
}, 120_000)

afterAll(async () => {
  await same?.stop().catch(() => {})
  await foreign?.stop().catch(() => {})
  if (child) { try { process.kill(child.pid, 'SIGKILL') } catch {} }
  for (const s of stubs) s.stop(true)
  if (work) rmSync(work, { recursive: true, force: true })
})

test('MUST-FAIL: a non-public shape with no credential is refused under enforce, and the owner is never called', async () => {
  const before = ownerSaw.length
  const res = await inbound({ type: 'fedauth_owned', q: 'bare' })
  const c = res?.content ?? res
  expect(c?.error).toBe('unauthorized')
  expect(c?.reason).toBe('absent')
  expect(ownerSaw.length).toBe(before)
  await waitFor(() => output.includes('[fed-ingress-auth] mode=enforce shape=fedauth_owned decision=refuse reason=absent'), 5_000, 'the refusal line')
}, 30_000)

test('MUST-FAIL: an invalid key is refused; the refusal body and the logs never contain it', async () => {
  const res = await inbound({ type: 'fedauth_owned', q: 'bad', _fedAuth: INVALID })
  const c = res?.content ?? res
  expect(c?.error).toBe('unauthorized')
  expect(c?.reason).toBe('invalid')
  expect(JSON.stringify(res)).not.toContain(INVALID)
  await sleep(300)
  expect(output).not.toContain(INVALID)
}, 30_000)

test('a valid _fedAuth is answered, and the OWNER receives the pointer WITHOUT the credential', async () => {
  const before = ownerSaw.length
  const res = await inbound({ type: 'fedauth_owned', q: 'good', _fedAuth: VALID })
  const c = res?.content ?? res
  expect(c?.body?.answer).toBe(7)
  expect(ownerSaw.length).toBe(before + 1)
  expect(JSON.stringify(ownerSaw[ownerSaw.length - 1])).not.toContain(VALID)
  await waitFor(() => output.includes('[fed-ingress-auth] mode=enforce shape=fedauth_owned decision=allow reason=valid'), 5_000, 'the allow line')
  expect(output).not.toContain(VALID)
}, 30_000)

test('substrateBootstrap (the only PUBLIC shape) is answered with no credential', async () => {
  const res = await inbound({ type: 'substrateBootstrap' })
  const c = res?.content ?? res
  expect(c?.shape).toBe('substrateBootstrap')
  expect(c?.error).toBeUndefined()
}, 30_000)

test('MUST-FAIL: egress carries the caller\'s own key ONLY to the same-authority peer; the foreign peer gets none', async () => {
  const s0 = sameSaw.length, f0 = foreignSaw.length
  const r1 = await egress(loopback(same), { type: 'fedauth_probe', q: 'same' }, VALID)
  expect(r1.status).toBe(200)
  const r2 = await egress(loopback(foreign), { type: 'fedauth_probe', q: 'foreign', _fedAuth: INVALID }, VALID)
  expect(r2.status).toBe(200)
  expect(sameSaw.length).toBe(s0 + 1)
  expect(foreignSaw.length).toBe(f0 + 1)
  expect(sameSaw[sameSaw.length - 1]?._fedAuth).toBe(VALID)
  expect(foreignSaw[foreignSaw.length - 1]?._fedAuth).toBeUndefined()
  expect(JSON.stringify(foreignSaw[foreignSaw.length - 1])).not.toContain('FEDAUTH-PLACEHOLDER')
  await sleep(300)
  expect(output).not.toContain(VALID)
  expect(output).not.toContain(INVALID)
}, 45_000)

test('MUST-FAIL: a caller with no Authorization header sends no credential, and the transport never substitutes its own', async () => {
  const s0 = sameSaw.length
  const r = await egress(loopback(same), { type: 'fedauth_probe', q: 'noheader' }, null)
  expect(r.status).toBe(200)
  expect(sameSaw.length).toBe(s0 + 1)
  const seen = sameSaw[sameSaw.length - 1]
  expect(seen?._fedAuth).toBeUndefined()
  expect(JSON.stringify(seen)).not.toContain(TRANSPORT_KEY)
}, 45_000)
