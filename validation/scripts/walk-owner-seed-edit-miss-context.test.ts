// walk-owner-seed-edit-miss-context.test.ts — an edit drafted after an fs_edit miss is drafted seeing the miss. The miss
// quotes the file's real lines (what the next edit must anchor on); shown only through the bare failure entry it is cut,
// and on a busy root newer rows push it out of the newest-first fill, so the drafter repeats the same miss. The request
// keeps the newest fs_edit failure per path whole, and the newest edit result per path beside it.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-attempt-explanation).
//   rows: both variants of the request schema name the two entries exactly as declared, ranked (described fits kept rows
//     in the order listed) after the request's own small kept rows and before its diff, and listed before the bare
//     failure entry (a row is shown by the first entry it matches).
//
// SAFETY and NEEDS: loopback only (stub store), a private temp dir.
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")

const MISS = { shape: "failure", where: { call: "fs_edit" }, latest_by: "path", whole: true, keep: true }
const EDITED = { shape: "fileEditResult", latest_by: "path", keep: true }

const T = mkdtempSync(join(tmpdir(), "wos-miss-"))
let seeded: Row[] = []
const schemaOf = (target: string, variant: string): Row | undefined =>
  seeded.filter((r) => r.shape === "shape_schema" && r.target === target && String(r.variant ?? "") === variant).at(-1)

beforeAll(async () => {
  const rows: Row[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
    const p = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row
    if (p.type === "record_read") return Response.json(rows.filter((r) => r.shape === p.shape).filter((r) => Object.entries((p.where ?? {}) as Row).every(([k, v]) => String(r[k]) === String(v))))
    if (p.type === "record_write") { const r = { ...p.row, id: `o${rows.length + 1}`, seq: rows.length + 1, role: p.role }; rows.push(r); return Response.json(r) }
    return Response.json({ error: "Not found", shape: p.type }, { status: 404 })
  } })
  // the seed reads its inventory beside itself
  await Bun.write(join(T, "walk-owner-seed.ts"), Bun.file(SEED))
  await Bun.write(join(T, "vessels.inventory.json"), Bun.file(INVENTORY))
  const p = Bun.spawn([process.execPath, join(T, "walk-owner-seed.ts")], { env: { PATH: process.env.PATH ?? "",
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-misstest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

describe("the request's context, for an edit that missed", () => {
  for (const variant of ["", "gap"]) {
    test(`[MUST-FAIL] the request${variant ? "/gap" : ""} keeps the newest fs_edit miss per path whole, and the newest edit result per path, ranked before its diff and listed before the bare failure entry`, () => {
      const ctx = (schemaOf("request", variant)?.context ?? []) as unknown[]
      const at = (e: unknown) => ctx.findIndex((x) => JSON.stringify(x) === JSON.stringify(e))
      const shape = (name: string) => ctx.findIndex((x) => (x as Row)?.shape === name)
      expect(at(MISS)).toBeGreaterThan(shape("request_acts"))
      expect(at(EDITED)).toBe(at(MISS) + 1)
      expect(at(EDITED)).toBeLessThan(at("failure"))
      expect(at(EDITED)).toBeLessThan(shape("gitDiff"))
    })
  }

  test("[GUARD] the request still shows every failure: the bare entry stays, once", () => {
    for (const variant of ["", "gap"]) expect(((schemaOf("request", variant)?.context ?? []) as unknown[]).filter((e) => e === "failure")).toHaveLength(1)
  })
})
