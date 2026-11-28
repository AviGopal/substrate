// walk-owner-seed-uses-drop.test.ts — what an answer relied on (uses) is held to the rows it was shown by leaving an
// unshown id out, not by refusing the answer: every owner schema's uses marks its items "x-shown": "drop", on every
// shape that has one. evidence_refs stays refused when it names no row shown, since a grade rests on it. The words a
// producer reads say which ids are a row's own, since ids copied from inside a shown row's fields name no row shown.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store; the shape_schema rows it writes.
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
const T = mkdtempSync(join(tmpdir(), "wos-usesdrop-"))
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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-usesdrop-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const schemas = (): Row[] => seeded.filter((r) => r.shape === "shape_schema")
const withField = (field: string): Row[] => schemas().filter((r) => r.schema?.properties?.[field] !== undefined)
const named = (rows: Row[]): string[] => rows.map((r) => `${r.target}/${r.variant ?? ""}`).sort()

describe("an unshown id in uses is left out, not refused, on every shape", () => {
  test("[MUST-FAIL] every schema's uses drops an id naming no row shown", () => {
    const uses = withField("uses")
    expect(named(uses)).toEqual(["answer/", "attempt_explanation/", "attempt_explanation/gap", "change_wanted/gap", "change_wanted/unscoped", "land_verdict/", "land_verdict/gap", "request/", "request/gap", "shape_schema/open"].sort())
    for (const r of uses) expect(r.schema.properties.uses).toEqual({ type: "array", items: { type: "string", "x-shown": "drop" } })
  })
  test("[MUST-FAIL] every schema with uses says which ids are a row's own, and that an unshown one is left out", () => {
    for (const r of withField("uses")) {
      expect(r.description).toContain("each row's own top-level id, never an id written inside one of its fields")
      expect(r.description).toContain("not_shown_whole or named_not_shown")
      expect(r.description).toContain("nor a row a read returned that does not name one of your inputs")
      expect(r.description).toContain("An id that names no row you were shown is left out and passes no credit.")
    }
  })
  test("[GUARD] evidence_refs still refuses an id naming no row shown", () => {
    const refs = withField("evidence_refs")
    expect(refs.length).toBeGreaterThan(0)
    for (const r of refs) expect(r.schema.properties.evidence_refs.items["x-shown"]).toBe(true)
  })
})
