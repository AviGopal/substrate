// walk-owner-seed-gap-read.test.ts — a request's producer reads each detector gap as it stands now: the latest row per
// gap_id, never every row of every gap. The request's words ask only whether a gap's latest row is closed, so its history
// adds nothing a producer reads, and on every prompt it grew with the store.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store; the request schemas' reads.
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
const T = mkdtempSync(join(tmpdir(), "wos-gapread-"))
let seeded: Row[] = []

beforeAll(async () => {
  const rows: Row[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
    const p = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row
    if (p.type === "record_read") return Response.json(rows.filter((r) => r.shape === p.shape).filter((r) => Object.entries((p.where ?? {}) as Row).every(([k, v]) => String(r[k]) === String(v))))
    if (p.type === "record_write") { const r = { ...p.row, id: `o${rows.length + 1}`, seq: rows.length + 1, role: p.role }; rows.push(r); return Response.json(r) }
    return Response.json({ error: "Not found", shape: p.type }, { status: 404 })
  } })
  await Bun.write(join(T, "walk-owner-seed.ts"), Bun.file(SEED))
  await Bun.write(join(T, "vessels.inventory.json"), Bun.file(INVENTORY))
  const p = Bun.spawn([process.execPath, join(T, "walk-owner-seed.ts")], { env: { PATH: process.env.PATH ?? "",
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-gapread-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const readsOf = (variant: string): Row[] =>
  [seeded.filter((r) => r.shape === "shape_schema" && r.target === "request" && (r.variant ?? "") === variant).at(-1)?.reads ?? []].flat()

describe("the request schema reads each gap as it stands", () => {
  test("[MUST-FAIL] every gap read a request schema makes takes the latest row per gap_id", () => {
    const gapReads = ["", "gap"].flatMap((v) => readsOf(v).filter((r) => r?.type === "record_read" && r?.shape === "gap"))
    expect(gapReads.length).toBeGreaterThan(0)
    for (const r of gapReads) expect(r).toEqual({ type: "record_read", shape: "gap", latest_by: "gap_id" })
  })
  test("[GUARD] the request schema's other reads are as they were", () => {
    expect(readsOf("").filter((r) => !(r?.type === "record_read" && r?.shape === "gap"))).toEqual([{ type: "shapeDescriptions", declared: true }])
  })
})
