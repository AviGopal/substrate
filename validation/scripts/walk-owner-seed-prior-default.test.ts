// walk-owner-seed-prior-default.test.ts — the owner's default start for a move no level of records' fold has a record
// for (USER ruling 11-23, a never-run move starts from its kind's record, else the owner's p0). Records reads it as a
// row (prior {default: true, alpha0, beta0}), so the row is seeded before or with the fold that reads it. It is a setting
// the owner changes by writing a row, so a reseed never writes over a later one.
//
// WHAT IS JUDGED. The seed of this tree, run twice against a stub store, then once more after the owner wrote a later
// default prior row: the prior rows it writes.
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
const rows: Row[] = []
let first = 0
let second = 0

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
  await run()
  first = rows.length
  await run()
  second = rows.length
  rows.push({ shape: "prior", default: true, alpha0: 1, beta0: 5, id: `o${rows.length + 1}`, seq: rows.length + 1, role: "owner" })
  await run()
  server.stop(true)
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const priors = (upTo = rows.length): Row[] => rows.slice(0, upTo).filter((r) => r.shape === "prior")

describe("the owner's default start for a move with no record", () => {
  test("[MUST-FAIL] the seed writes one default prior row, as the owner, at 1/1", () => {
    expect(priors(first).map(({ default: d, alpha0, beta0, role }) => ({ default: d, alpha0, beta0, role })))
      .toEqual([{ default: true, alpha0: 1, beta0: 1, role: "owner" }])
  })
  test("[GUARD] run again, the seed writes no prior row, and writes none for a kind or a cell", () => {
    expect(priors(second).length).toBe(priors(first).length)
    expect(priors().filter((r) => r.kind !== undefined || r.cell !== undefined)).toEqual([])
  })
  test("[GUARD] a later owner default the seed did not write survives a reseed: the seed writes no prior row over it", () => {
    expect(priors().slice(priors(second).length).map(({ alpha0, beta0 }) => [alpha0, beta0])).toEqual([[1, 5]])
  })
})
