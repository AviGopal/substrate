// walk-owner-seed-land-truncated.test.ts — the land judge refused a change "not shown whole" on a gitDiff row whose
// only true truncated was its suite's: a run's output cut at its bound, not the change. Both land_verdict descriptions
// now say which truncated means the change was cut (the row's own, beside its diff) and that a run's says only that its
// output was cut.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-route-words).
//   rows: both land_verdict variants name the row's own truncated, beside its diff, and say a truncated inside the
//     typecheck, check or suite decides nothing by itself; neither still says "the gitDiff's truncated" bare.
//
// SAFETY and NEEDS: loopback only (the stub store), a private temp dir.
// SAFETY and NEEDS: loopback only (the stub store), a private temp dir.
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")

const T = mkdtempSync(join(tmpdir(), "wos-landcut-"))
let seeded: Row[] = []

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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-landcut-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const schemas = (target: string): Row[] => seeded.filter((r) => r.shape === "shape_schema" && r.target === target)

describe("the land judge, as it is told what truncated means", () => {
  test("[MUST-FAIL] both land_verdict variants say the row's own truncated, beside its diff, is the change cut", () => {
    const lv = schemas("land_verdict")
    expect(lv.map((r) => String(r.variant ?? "")).sort()).toEqual(["", "gap"])
    for (const r of lv) {
      const words = String(r.description)
      expect(words).toContain("the gitDiff row's own truncated is true (the one beside its diff, not one inside its typecheck, check or suite)")
      expect(words).toContain("a truncated inside a run says only that the run's output was cut at its bound, and decides nothing by itself")
    }
  })

  test("[MUST-FAIL] neither says the gitDiff's truncated bare, as if any one were the change's", () => {
    for (const r of schemas("land_verdict")) expect(String(r.description)).not.toContain("the gitDiff's truncated")
  })

  test("[GUARD] the typecheck and check clauses still stand", () => {
    const [plain, gap] = ["", "gap"].map((v) => schemas("land_verdict").find((r) => String(r.variant ?? "") === v))
    expect(String(plain?.description)).toContain("0 when its typecheck ran and did not pass, because that tree does not compile")
    expect(String(gap?.description)).toContain("check (the gap's own check, run on that tree) did not pass")
  })
})
