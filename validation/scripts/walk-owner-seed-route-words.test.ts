// walk-owner-seed-route-words.test.ts — the route the walk reads for a request (request_acts.path) is in the request
// producer's context, kept, but no word said what it is: requests kept asking for another edit while path.next was the
// commit. The request and answer descriptions now say what path.next is, and that a failure or refusal naming something
// to read or fix comes first.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-gap-words).
//   rows: the request schema (both variants) and the answer schema name request_acts.path and path.next, and the
//     read-or-fix-first clause; the request still keeps the newest request_acts in its context.
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

const T = mkdtempSync(join(tmpdir(), "wos-route-"))
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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-routewords-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const schemas = (target: string): Row[] => seeded.filter((r) => r.shape === "shape_schema" && r.target === target)

describe("the route, as the producer is told it", () => {
  test("[MUST-FAIL] the request's description, both variants, says what path.next is and that a named read or fix comes first", () => {
    const req = schemas("request")
    expect(req.map((r) => r.variant).sort()).toEqual(["", "gap"])
    for (const r of req) {
      expect(String(r.description)).toContain("request_acts.path")
      expect(String(r.description)).toContain("path.next names the calls that move this request")
      expect(String(r.description)).toContain("unless a failure or refusal row names something to read or fix first")
    }
  })

  test("[MUST-FAIL] the answer's description says the same, so its promised next call is the route's", () => {
    const ans = schemas("answer")
    expect(ans.length).toBeGreaterThan(0)
    for (const a of ans) expect(String(a.description)).toContain("path.next names the calls that move this request")
  })

  test("[GUARD] the request still keeps the newest request_acts in its context", () => {
    for (const r of schemas("request"))
      expect(r.context).toContainEqual({ shape: "request_acts", latest_by: "shape", keep: true })
  })
})
