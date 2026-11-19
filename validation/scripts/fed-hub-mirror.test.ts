// fed-hub-mirror.test.ts — the transport's hub mirror, run as the transport runs it: rows only discovery answers are not
// mirrored, and what counts as "only discovery answers" is read from THIS substrate's discovery, never the hub's.
//
// WHY. discovery keeps its own row registered now. The hub mirror carried every plain-HTTP local row, so every spoke
// would have mirrored `discovery-vessel@<spoke>` to the hub for good, and a hub caller routed by shape could land on a
// spoke's discovery. mirror-rows.ts skips such a row; which shapes discovery answers is read from discovery's /shapes,
// and reading the hub's /shapes instead would skip by another substrate's list.
//
// WHAT IS JUDGED. A relay (relay.ts of this tree) and the transport server of this tree run as child processes on
// loopback, the transport reserving a circuit on the relay so its hub mirror runs. Two stub discoveries: this substrate's
// (a registry holding discovery's own row and records', and /shapes answering discovery's own list) and a hub's (whose
// /shapes answers another list, and which records every /register). Asserted: the hub is registered `records-vessel@<id>`
// and never `discovery-vessel@<id>`; /shapes is read from this substrate's discovery and never from the hub's.
//
// SAFETY and NEEDS: loopback only, stubs in this process, a private state dir and relay key, the federation-relay libp2p
// dependencies and this tree's transport package, or a FAIL, never a skip.
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
const SUBSTRATE = `fed-hub-mirror-test-${process.pid}`
const DISCOVERY_LOCAL = ['vesselCapability', 'vesselEndpoint', 'vesselHealth', 'vesselRegistry', 'shapeDescriptions', 'vesselList', 'shapeProducers']

let work = ''
let output = ''
const children: Array<ReturnType<typeof Bun.spawn>> = []
const stubs: Array<{ stop: (force?: boolean) => void }> = []
const hubRegistered: string[] = []
const shapesReadFrom: string[] = []

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function waitFor(pred: () => boolean, ms: number, what: string) {
  const end = Date.now() + ms
  while (Date.now() < end) { if (pred()) return; await sleep(50) }
  throw new Error('timed out waiting for ' + what + '\n--- child output ---\n' + output.slice(-4000))
}
async function drain(stream: ReadableStream<Uint8Array> | null | undefined) {
  if (!stream) return
  const dec = new TextDecoder()
  for await (const chunk of stream as any) output += dec.decode(chunk, { stream: true })
}
const freePort = () => { const s = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('') }); const p = s.port; s.stop(true); return p }

beforeAll(async () => {
  const deps = DEP_CANDIDATES.find((d) => existsSync(join(d, 'libp2p')) && existsSync(join(d, '@libp2p/circuit-relay-v2')))
  if (!deps) throw new Error('FAIL - cannot judge: no federation-relay libp2p dependencies at ' + DEP_CANDIDATES.join(' | '))
  if (!existsSync(join(PKG_DIR, 'src/index.ts'))) throw new Error('FAIL - cannot judge: no ' + PKG_DIR + '/src/index.ts (submodule not checked out)')

  // Private copies of the relay and the server beside a node_modules whose transport package is THIS tree's.
  work = mkdtempSync(join(tmpdir(), 'fed-hub-mirror-'))
  const fed = join(work, 'fed')
  const nm = join(fed, 'node_modules')
  mkdirSync(nm, { recursive: true })
  for (const e of readdirSync(deps)) {
    if (e === '@avigopal' || e === '.bin' || e === '.cache') continue
    symlinkSync(join(deps, e), join(nm, e))
  }
  const pkgCopy = join(nm, '@avigopal/libp2p-federation-transport')
  mkdirSync(join(pkgCopy, 'src'), { recursive: true })
  cpSync(join(PKG_DIR, 'package.json'), join(pkgCopy, 'package.json'))
  for (const f of readdirSync(join(PKG_DIR, 'src')).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))) cpSync(join(PKG_DIR, 'src', f), join(pkgCopy, 'src', f))
  // mirror-rows.ts only where it exists: the tree before it mirrored without it, and its legs say so by failing
  for (const f of ['federation-transport-server.ts', 'ingress-auth.ts', 'identity-ask.ts', 'mirror-rows.ts', 'relay.ts']) if (existsSync(join(FED_DIR, f))) cpSync(join(FED_DIR, f), join(fed, f))

  // This substrate's discovery: a registry holding discovery's own row and records', and its own /shapes.
  const local = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(req) {
      const u = new URL(req.url)
      if (u.pathname === '/shapes') { shapesReadFrom.push('local'); return Response.json({ shapes: DISCOVERY_LOCAL, vessel: 'discovery' }) }
      if (u.pathname === '/register') return new Response('{}', { status: 201 })
      if (u.pathname === '/resolve') {
        const p = ((await req.json().catch(() => ({}))) as any)?.pointer ?? {}
        const vessels = p.type === 'vesselRegistry' ? [
          { vesselId: 'discovery-vessel', protocol: 'http', endpoint: 'http://127.0.0.1:9', shapes: DISCOVERY_LOCAL },
          { vesselId: 'records-vessel', protocol: 'http', endpoint: 'http://127.0.0.1:9', shapes: ['record_read', 'record_write'] },
        ] : []
        return Response.json({ content: { vessels } })
      }
      return new Response('not found', { status: 404 })
    },
  })
  // The hub's discovery: another substrate's /shapes (as the hub would list it), and a record of what is registered.
  const hub = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(req) {
      const u = new URL(req.url)
      if (u.pathname === '/shapes') { shapesReadFrom.push('hub'); return Response.json({ shapes: ['record_read'], vessel: 'discovery' }) }
      if (u.pathname === '/register') { const b: any = await req.json().catch(() => null); hubRegistered.push(String(b?.vesselId ?? '')); return new Response('{}', { status: 201 }) }
      if (u.pathname === '/resolve') return Response.json({ content: { vessels: [] } })
      return new Response('not found', { status: 404 })
    },
  })
  stubs.push(local, hub)

  const relayPort = freePort()
  const relay = Bun.spawn([process.execPath, join(fed, 'relay.ts')], {
    cwd: fed,
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: work, TMPDIR: work, TZ: 'UTC', RELAY_TCP_PORT: String(relayPort), RELAY_KEY_FILE: join(work, 'relay-key.protobuf'), PUBLIC_IP: '127.0.0.1' },
    stdout: 'pipe', stderr: 'pipe',
  })
  children.push(relay)
  void drain(relay.stdout as any); void drain(relay.stderr as any)
  await waitFor(() => /\[relay\] listening: \/ip4\/127\.0\.0\.1\/tcp\/\d+\/p2p\/\S+/.test(output), 30_000, 'the relay to listen')
  const relayAddr = output.match(/\[relay\] listening: (\/ip4\/127\.0\.0\.1\/tcp\/\d+\/p2p\/\S+)/)![1]

  const dead = 'http://127.0.0.1:9'
  const transport = Bun.spawn([process.execPath, join(fed, 'federation-transport-server.ts')], {
    cwd: fed,
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: work, TMPDIR: work, NODE_ENV: 'test', TZ: 'UTC',
      FED_VESSEL_ID: 'federation-transport-vessel', FED_SUBSTRATE_ID: SUBSTRATE, FED_HEALTH_PORT: String(freePort()),
      DISCOVERY_URL: `http://127.0.0.1:${local.port}`, HUB_DISCOVERY_URL: `http://127.0.0.1:${hub.port}`, RELAY_MULTIADDR: relayAddr,
      ACTIVITY_API_URL: dead, DEVELOPMENT_VESSEL_URL: dead, IDENTITY_UPSTREAM_URL: dead,
      FED_STATE_DIR: join(work, 'state'), METABOB_API_KEY: 'fedhub-test-key-not-a-credential',
      FED_PROBE_PATH: '/nonexistent/federation-probe-tick.ts', BUN_BIN: '/nonexistent/bun',
    },
    stdout: 'pipe', stderr: 'pipe',
  })
  children.push(transport)
  void drain(transport.stdout as any); void drain(transport.stderr as any)
  await waitFor(() => hubRegistered.some((id) => id.startsWith('records-vessel@')), 60_000, 'the hub mirror to register a local row')
}, 120_000)

afterAll(() => {
  for (const c of children) { try { process.kill(c.pid, 'SIGKILL') } catch {} }
  for (const s of stubs) s.stop(true)
  if (work) rmSync(work, { recursive: true, force: true })
})

test("[MUST-FAIL] the hub is registered records' row and never discovery's own", () => {
  expect([hubRegistered.includes(`records-vessel@${SUBSTRATE}`), hubRegistered.some((id) => id.startsWith('discovery-vessel@'))]).toEqual([true, false])
})

test("[MUST-FAIL] which shapes discovery answers is read from this substrate's discovery, never the hub's", () => {
  expect([shapesReadFrom.includes('local'), shapesReadFrom.includes('hub')]).toEqual([true, false])
})
