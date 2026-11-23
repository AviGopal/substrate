// walk-owner-seed-prior-default.test.ts — the owner's default start for a move no level of records' fold has a record
// for (USER ruling 11-23, a never-run move starts from its kind's record, else the owner's p0). Records reads it as a
// row (prior {default: true, alpha0, beta0}), so the row is seeded before or with the fold that reads it. It is a setting
// the owner changes by writing a row, so a seed never writes over one already there.
//
// WHAT IS JUDGED. The seed of this tree against a stub store: run twice on an empty store, then once more after the
// owner wrote a later default; run once on a store holding only an owner default; run once on a store holding only
// another prior row. The prior rows it writes.
//
// SAFETY and NEEDS: loopback only (the stub store), a private temp dir.
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")
const T = mkdtempSync(join(tmpdir(), "wos-prior-"))
let rows: Row[] = []
const owner = (row: Row): Row => ({ ...row, id: `o${rows.length + 1}`, seq: rows.length + 1, role: "owner" })

const empty: Row[] = []
const ownerFirst: Row[] = []
const otherFirst: Row[] = []
let first = 0
let second = 0
let third = 0

beforeAll(async () => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
    const p = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row
    if (p.type === "record_read") return Response.json(rows.filter((r) => r.shape === p.shape).filter((r) => Object.entries((p.where ?? {}) as Row).every(([k, v]) => String(r[k]) === String(v))))
    if (p.type === "record_write") { const r = { ...p.row, id: `o${rows.length + 1}`, seq: rows.length + 1, role: p.role }; rows.push(r); return Response.json(r) }
    return Response.json({ error: "Not found", shape: p.type }, { status: 404 })
  } })
  await Bun.write(join(T, "walk-owner-seed.ts"), Bun.file(SEED))
  await Bun.write(join(T, "vessels.inventory.json"), Bun.file(INVENTORY))
  const run = async () => {
    const p = Bun.spawn([process.execPath, join(T, "walk-owner-seed.ts")], { env: { PATH: process.env.PATH ?? "",
      DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-prior-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
    await p.exited
  }
  rows = empty
  await run()
  first = rows.length
  await run()
  second = rows.length
  rows.push(owner({ shape: "prior", default: true, alpha0: 3, beta0: 5 }))
  third = rows.length
  await run()
  rows = ownerFirst
  rows.push(owner({ shape: "prior", default: true, alpha0: 3, beta0: 5 }))
  await run()
  rows = otherFirst
  rows.push(owner({ shape: "prior", kind: "run", alpha0: 2, beta0: 3 }))
  await run()
  server.stop(true)
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const priors = (store: Row[], from = 0, upTo = store.length): Row[] => store.slice(from, upTo).filter((r) => r.shape === "prior")
const values = (rs: Row[]) => rs.map(({ default: d, alpha0, beta0, role }) => ({ default: d, alpha0, beta0, role }))

describe("the owner's default start for a move with no record", () => {
  test("[MUST-FAIL] the seed writes one default prior row, as the owner, at 1/1", () => {
    expect(values(priors(empty, 0, first))).toEqual([{ default: true, alpha0: 1, beta0: 1, role: "owner" }])
  })
  test("[GUARD] run again, the seed writes no prior row, and writes none for a kind or a cell", () => {
    expect(priors(empty, first, second)).toEqual([])
    expect(priors(empty).filter((r) => r.kind !== undefined || r.cell !== undefined)).toEqual([])
  })
  test("[GUARD] a later owner default, at values other than the seed's, survives a reseed: no prior row is written over it", () => {
    expect(priors(empty, third)).toEqual([])
  })
  test("[GUARD] an owner default there before the first seed stands: the seed writes no prior row", () => {
    expect(values(priors(ownerFirst))).toEqual([{ default: true, alpha0: 3, beta0: 5, role: "owner" }])
  })
  test("[MUST-FAIL] a prior row that is not a default does not stand for one: the seed still writes the 1/1 default", () => {
    expect(values(priors(otherFirst, 1))).toEqual([{ default: true, alpha0: 1, beta0: 1, role: "owner" }])
  })
})
