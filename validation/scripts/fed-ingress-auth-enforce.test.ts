// fed-ingress-auth-enforce.test.ts — THE REAL TRANSPORT SERVER WITH INBOUND AUTHENTICATION IN ENFORCE MODE (an operator
// exception). Companion to fed-ingress-auth.test.ts (the pure logic) and fed-ingress-log.test.ts
// (mode off: today's behaviour, unchanged).
//
// WHAT IS JUDGED. This tree's federation-transport-server.ts + ingress-auth.ts + repos/libp2p-federation-transport run as a
// child process. Its policy (the owner's fedIngressAuthPolicy row in local records, enforce, read through discovery),
// identity (/v1/auth/on-behalf-of and /v1/auth/resolve, holding each token's audience as identity does), discovery and
// the owning vessel are stubs in this process. Two client nodes serve resolve so what the server's egress sends them is
// captured verbatim; one of them also dials in. Asserted:
//   - inbound: a non-public shape with no credential, a raw key, or a token minted for another peer or another shape is
//     REFUSED (unauthorized, with the reason) and the owner is never called; a token minted for THIS transport's peer
//     id and this shape is answered, and the OWNER receives the pointer WITHOUT the credential, under the caller's
//     token and its audience, never under the transport's own key;
//   - substrateBootstrap (a PUBLIC shape) is answered with no credential;
//   - egress: a local caller's `Authorization: ApiKey` is minted for (actor = the transport's key, ttl 30 s, audience =
//     the dialed peer and the shape) and only `Bearer <token>` reaches the peer, bound to that peer; a Bearer session
//     caller, a caller with no header, and a caller identity refuses send nothing;
//   - no planted key or token ever appears in the server's output (logs), in any refusal body, or at the owner.
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
// The owner's policy row, as records answers a record_read of it through discovery.
const policyRows = [{ shape: 'fedIngressAuthPolicy', role: 'owner', seq: 1, mode: 'enforce', cache: false }]
const ownerHeaders: Array<{ authorization: string | null; audience: string | null }> = []
// identity's state: every token it minted, with the audience it was minted for; every mint request it received.
const minted = new Map<string, { node: string; shape: string }>()
const mintAsked: any[] = []
const CALLER_KEY_ID = 'kid-caller-placeholder'
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
async function egress(target: string, pointer: unknown, authorization: string | null): Promise<Response> {
  return await fetch(`http://127.0.0.1:${healthPort}/egress/resolve?target=${encodeURIComponent(target)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
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

  const owner = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
    const b: any = await req.json().catch(() => ({}))
    ownerSaw.push(b)
    ownerHeaders.push({ authorization: req.headers.get('authorization'), audience: req.headers.get('x-auth-audience') })
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
      if (p.type === 'record_read' && p.shape === 'fedIngressAuthPolicy') return Response.json({ content: policyRows })
      const vessels = p.type === 'vesselCapability' && OWNED.has(String(p.shape))
        ? [{ vesselId: 'stub-owner', endpoint: `http://127.0.0.1:${owner.port}`, resolve_endpoint: '/v2/impulses/resolve', protocol: 'http' }]
        : []
      return Response.json({ content: { vessels } })
    }
    return new Response('not found', { status: 404 })
  } })
  stubs.push(discovery)
  // identity: mints only for the transport's own key as actor and a valid ApiKey caller; validates a token only for the
  // audience it was minted for (as identity's resolveAuthentication does), answering the caller's key id.
  let n = 0
  const identity = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
    const u = new URL(req.url)
    const b: any = await req.json().catch(() => ({}))
    if (u.pathname === '/v1/auth/on-behalf-of') {
      mintAsked.push({ authorization: req.headers.get('authorization'), body: b })
      if (req.headers.get('authorization') !== 'ApiKey ' + TRANSPORT_KEY || b?.caller !== 'ApiKey ' + VALID) return Response.json({ success: false }, { status: 403 })
      const token = 'oboplaceholder.' + (++n) + '.' + process.pid
      minted.set(token, { node: String(b.audience.node), shape: String(b.audience.shape) })
      return Response.json({ success: true, data: { token } })
    }
    if (u.pathname === '/v1/auth/resolve') {
      const p = b?.impulse?.pointer ?? {}
      const aud = minted.get(String(p.token ?? ''))
      if (!aud || !p.audience || aud.node !== p.audience.node || aud.shape !== p.audience.shape) return Response.json({ success: false }, { status: 401 })
      return Response.json({ success: true, data: { authenticated: true, orgId: 'org-placeholder', userId: 'user-placeholder', keyId: CALLER_KEY_ID, obo: aud } })
    }
    return new Response('not found', { status: 404 })
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

// A token identity holds for an audience, as if minted for another transport (inbound tests).
let direct = 0
const tokenFor = (node: string, shape: string): string => {
  const t = 'oboplaceholder.direct.' + (++direct) + '.' + process.pid
  minted.set(t, { node, shape })
  return t
}
const serverPeer = (): string => String(registered.libp2p_peer_id)
const tokensSeen = (): string[] => [...minted.keys()]

test('MUST-FAIL: a non-public shape with no credential is refused under enforce, and the owner is never called', async () => {
  const before = ownerSaw.length
  const res = await inbound({ type: 'fedauth_owned', q: 'bare' })
  const c = res?.content ?? res
  expect(c?.error).toBe('unauthorized')
  expect(c?.reason).toBe('absent')
  expect(ownerSaw.length).toBe(before)
  await waitFor(() => output.includes('[fed-ingress-auth] mode=enforce shape=fedauth_owned decision=refuse reason=absent'), 5_000, 'the refusal line')
}, 30_000)

test('MUST-FAIL: a raw key is refused (not_obo), even one identity would accept; the body and the logs never contain it', async () => {
  const before = ownerSaw.length
  for (const raw of [VALID, 'ApiKey ' + VALID, INVALID]) {
    const res = await inbound({ type: 'fedauth_owned', q: 'raw', _fedAuth: raw })
    const c = res?.content ?? res
    expect(c?.error).toBe('unauthorized')
    expect(c?.reason).toBe('not_obo')
    expect(JSON.stringify(res)).not.toContain(raw)
  }
  expect(ownerSaw.length).toBe(before)
  await sleep(300)
  expect(output).not.toContain(VALID)
  expect(output).not.toContain(INVALID)
}, 30_000)

test('MUST-FAIL: a token minted for another peer, or for another shape, is refused and the owner is never called', async () => {
  const before = ownerSaw.length
  for (const t of [tokenFor(String(foreign.peerId), 'fedauth_owned'), tokenFor(serverPeer(), 'other_shape')]) {
    const res = await inbound({ type: 'fedauth_owned', q: 'elsewhere', _fedAuth: 'Bearer ' + t })
    const c = res?.content ?? res
    expect(c?.error).toBe('unauthorized')
    expect(c?.reason).toBe('invalid')
    expect(JSON.stringify(res)).not.toContain(t)
  }
  expect(ownerSaw.length).toBe(before)
}, 30_000)

test('MUST-FAIL: a token for THIS peer and shape is answered; the OWNER gets the pointer without the credential, under the token and its audience, never the transport key', async () => {
  const before = ownerSaw.length
  const t = tokenFor(serverPeer(), 'fedauth_owned')
  const res = await inbound({ type: 'fedauth_owned', q: 'good', _fedAuth: 'Bearer ' + t })
  const c = res?.content ?? res
  expect(c?.body?.answer).toBe(7)
  expect(ownerSaw.length).toBe(before + 1)
  expect(JSON.stringify(ownerSaw[ownerSaw.length - 1])).not.toContain(t)
  expect(ownerHeaders[ownerHeaders.length - 1]).toEqual({ authorization: 'Bearer ' + t, audience: serverPeer() + '/fedauth_owned' })
  await waitFor(() => output.includes('[fed-ingress-auth] mode=enforce shape=fedauth_owned decision=allow reason=valid'), 5_000, 'the allow line')
  expect(output).toContain('/' + CALLER_KEY_ID + ' enforced=y')
  expect(output).not.toContain(t)
}, 30_000)

test('substrateBootstrap (a PUBLIC shape) is answered with no credential', async () => {
  const res = await inbound({ type: 'substrateBootstrap' })
  const c = res?.content ?? res
  expect(c?.shape).toBe('substrateBootstrap')
  expect(c?.error).toBeUndefined()
}, 30_000)

test('MUST-FAIL: egress mints for an ApiKey caller (transport as actor, ttl 30, the dialed peer and shape) and sends only Bearer <token>', async () => {
  const s0 = sameSaw.length, f0 = foreignSaw.length, m0 = mintAsked.length
  const r1 = await egress(loopback(same), { type: 'fedauth_probe', q: 'same', _auth: INVALID }, 'ApiKey ' + VALID)
  expect(r1.status).toBe(200)
  const r2 = await egress(loopback(foreign), { type: 'fedauth_probe', q: 'foreign', _fedAuth: INVALID }, 'ApiKey ' + VALID)
  expect(r2.status).toBe(200)
  expect(sameSaw.length).toBe(s0 + 1)
  expect(foreignSaw.length).toBe(f0 + 1)
  expect(mintAsked.slice(m0).map((m) => m.body)).toEqual([
    { caller: 'ApiKey ' + VALID, audience: { node: String(same.peerId), shape: 'fedauth_probe' }, ttl_seconds: 30 },
    { caller: 'ApiKey ' + VALID, audience: { node: String(foreign.peerId), shape: 'fedauth_probe' }, ttl_seconds: 30 },
  ])
  expect(mintAsked.slice(m0).every((m) => m.authorization === 'ApiKey ' + TRANSPORT_KEY)).toBe(true)
  for (const [seen, peer] of [[sameSaw[sameSaw.length - 1], same.peerId], [foreignSaw[foreignSaw.length - 1], foreign.peerId]] as const) {
    const fa = String(seen?._fedAuth ?? '')
    expect(fa.startsWith('Bearer oboplaceholder.')).toBe(true)
    expect(minted.get(fa.slice('Bearer '.length))).toEqual({ node: String(peer), shape: 'fedauth_probe' })
    expect(seen?._auth).toBeUndefined()
    expect(JSON.stringify(seen)).not.toContain('FEDAUTH-PLACEHOLDER')
  }
  await sleep(300)
  expect(output).not.toContain(VALID)
  expect(output).not.toContain(INVALID)
  for (const t of tokensSeen()) expect(output).not.toContain(t)
}, 45_000)

test('MUST-FAIL: a Bearer session caller, a caller with no header, or one identity refuses sends no credential; the transport never substitutes its own', async () => {
  for (const [q, auth, mints] of [['session', 'Bearer ' + VALID, 0], ['noheader', null, 0], ['refused', 'ApiKey ' + INVALID, 1]] as const) {
    const s0 = sameSaw.length, m0 = mintAsked.length
    const r = await egress(loopback(same), { type: 'fedauth_probe', q }, auth)
    expect(r.status).toBe(200)
    expect(sameSaw.length).toBe(s0 + 1)
    expect([q, mintAsked.length - m0]).toEqual([q, mints])
    const seen = sameSaw[sameSaw.length - 1]
    expect([q, seen?._fedAuth]).toEqual([q, undefined])
    expect(JSON.stringify(seen)).not.toContain(TRANSPORT_KEY)
    expect(JSON.stringify(seen)).not.toContain('FEDAUTH-PLACEHOLDER')
  }
}, 45_000)
