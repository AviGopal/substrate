// Which of this substrate's registry rows the hub mirror carries (scripts/substrate/federation-relay/mirror-rows.ts): a
// row whose every shape discovery answers itself is not mirrored, since no hub caller should ever be routed to a spoke's
// copy of it; every other rule stays as it was; and when discovery's own shapes cannot be read, every row is mirrored, as
// before. The server's mirror reads through it.
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const MOD = join(ROOT, 'scripts/substrate/federation-relay/mirror-rows.ts')
const DEAD = /(^|\/\/)host\.docker\.internal(:|\/|$)/i
const OWN = 'federation-transport-vessel'
// what discovery's GET /shapes answers: the shapes it resolves itself
const DISCOVERY_LOCAL = ['vesselCapability', 'vesselEndpoint', 'vesselHealth', 'vesselRegistry', 'shapeDescriptions', 'vesselList', 'shapeProducers']
const DISCOVERY_ROW = { vesselId: 'discovery-vessel', protocol: 'http', endpoint: 'http://localhost:8100', shapes: DISCOVERY_LOCAL }
const RECORDS_ROW = { vesselId: 'records-vessel', protocol: 'http', endpoint: 'http://127.0.0.1:8510', shapes: ['record_read', 'record_write'] }
const mod = async () => import(MOD)
const ids = (rows: Array<{ vesselId: string }>) => rows.map((r) => r.vesselId)

describe('the hub mirror never carries a row only discovery answers', () => {
  test("[MUST-FAIL] discovery's own row is not mirrored once discovery's shapes are read; a normal row still is", async () => {
    const { mirrorRows } = await mod()
    expect(ids(mirrorRows([DISCOVERY_ROW, RECORDS_ROW], OWN, DEAD, new Set(DISCOVERY_LOCAL)))).toEqual(['records-vessel'])
  })
  test('a row serving one of those shapes beside another is still mirrored: its other shapes route (a guard)', async () => {
    const { mirrorRows } = await mod()
    const mixed = { ...RECORDS_ROW, vesselId: 'mixed-vessel', shapes: ['vesselRegistry', 'record_read'] }
    expect(mirrorRows([mixed], OWN, DEAD, new Set(DISCOVERY_LOCAL))).toEqual([{ vesselId: 'mixed-vessel', shapes: ['vesselRegistry', 'record_read'] }])
  })
  test("when discovery's shapes cannot be read, every row is mirrored, as before (a guard)", async () => {
    const { mirrorRows } = await mod()
    expect(ids(mirrorRows([DISCOVERY_ROW, RECORDS_ROW], OWN, DEAD, null))).toEqual(['discovery-vessel', 'records-vessel'])
  })
  test('the rules kept: ourselves, a libp2p row, a qualified id, a cross-host-dead endpoint and a row serving nothing are not mirrored (a guard)', async () => {
    const { mirrorRows } = await mod()
    const rows = [
      { ...RECORDS_ROW, vesselId: `${OWN}` }, { ...RECORDS_ROW, vesselId: `${OWN}@node-a` }, { ...RECORDS_ROW, vesselId: 'peer-row', protocol: 'libp2p' },
      { ...RECORDS_ROW, vesselId: 'records-vessel@node-b' }, { ...RECORDS_ROW, vesselId: 'vault-sidecar', endpoint: 'http://host.docker.internal:27124' },
      { ...RECORDS_ROW, vesselId: 'empty-vessel', shapes: [] }, { ...RECORDS_ROW, vesselId: 'odd-shapes', shapes: [1, '', null] },
      { ...RECORDS_ROW, vesselId: 'string-shapes', shapes: 'record_read' }, RECORDS_ROW,
    ]
    expect(ids(mirrorRows(rows, OWN, DEAD, new Set(DISCOVERY_LOCAL)))).toEqual(['records-vessel'])
    expect(ids(mirrorRows(rows, OWN, DEAD, null))).toEqual(['records-vessel']) // and with discovery's shapes unread
  })
})

describe("discovery's own shapes, read from its public /shapes", () => {
  test('[MUST-FAIL] the shapes /shapes lists; null when it does not answer a list', async () => {
    const { discoveryLocalShapes } = await mod()
    // answers only discovery's /shapes; any other path is not found, as discovery would answer it
    const answering = (body: unknown, status = 200) => (async (u: unknown) => String(u) === 'http://d.test/shapes'
      ? Response.json(body, { status }) : Response.json({ shapes: ['record_read', 'vesselRegistry'] }, { status: 404 })) as unknown as typeof fetch
    expect([...((await discoveryLocalShapes('http://d.test', answering({ shapes: DISCOVERY_LOCAL, vessel: 'discovery' }))) ?? [])].sort()).toEqual([...DISCOVERY_LOCAL].sort())
    expect(await discoveryLocalShapes('http://d.test', answering({ shapes: DISCOVERY_LOCAL, error: 'down' }, 503))).toBeNull() // a refusal, whatever it lists
    expect(await discoveryLocalShapes('http://d.test', answering({ shapes: 'vesselRegistry' }))).toBeNull()
    expect(await discoveryLocalShapes('http://d.test', (async () => { throw new TypeError('connection refused') }) as unknown as typeof fetch)).toBeNull()
  })
  test('[MUST-FAIL] the read of /shapes is bounded: a discovery that never answers cannot hold the mirror', async () => {
    const { discoveryLocalShapes } = await mod()
    let signal: unknown
    const hangs = ((_u: unknown, init?: RequestInit) => {
      signal = init?.signal
      return new Promise<Response>((_ok, fail) => init?.signal?.addEventListener('abort', () => fail(new Error('aborted'))))
    }) as unknown as typeof fetch
    const read = discoveryLocalShapes('http://d.test', hangs)
    expect(signal instanceof AbortSignal).toBe(true)
    expect(await read).toBeNull()
  }, 15_000)
  test("[MUST-FAIL] the server's hub mirror reads through them (a pin)", () => {
    const src = readFileSync(join(ROOT, 'scripts/substrate/federation-relay/federation-transport-server.ts'), 'utf8')
    const body = src.slice(src.indexOf('async function localVesselRows('), src.indexOf('\n}\n', src.indexOf('async function localVesselRows(')))
    expect([body.includes('mirrorRows(vessels, VESSEL_ID, HOST_LOCAL_UNREACHABLE, await discoveryLocalShapes(DISCOVERY))'), src.includes("from './mirror-rows'")]).toEqual([true, true])
  })
})
