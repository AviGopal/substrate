// walk-owner-seed-route-words.test.ts — the route the walk reads for a request (request_acts.path) is in the request
// producer's context, kept, but no word said what it is: requests kept asking for another edit while path.next was the
// commit. The request and answer descriptions now say what path.next is, and that a failure or refusal naming something
// to read or fix comes first.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-gap-words).
//   rows: the request schema (both variants) and the answer schema name request_acts.path and path.next, and the
//     read-or-fix-first clause; the request still keeps the newest request_acts in its context. Each bounded free-text
//     field (attempt_explanation's what_failed and next_must, change_wanted's why) says its schema's maxLength in its
//     description's words, read from the schema, and what_failed asks for the first failing line, not the block.
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

  // a free-text field's bound, read from the seeded schema: the words must carry the same number, so they cannot drift
  const bounded: [string, string, string][] = [["attempt_explanation", "", "what_failed"], ["attempt_explanation", "gap", "what_failed"],
    ["attempt_explanation", "", "next_must"], ["attempt_explanation", "gap", "next_must"], ["change_wanted", "gap", "why"]]
  test("[MUST-FAIL] each bounded free-text field's description states its schema's maxLength", () => {
    for (const [target, variant, field] of bounded) {
      const row = schemas(target).find((r) => String(r.variant ?? "") === variant)
      const n = row?.schema?.properties?.[field]?.maxLength
      expect(typeof n).toBe("number")
      const words = String(row?.description)
      const at = words.indexOf(`at most ${n} characters`)
      expect(at).toBeGreaterThan(-1)
      // said of this field: the nearest bounded field named before the number is this one
      // a field named as itself, not as part of a dotted path (check.why is the gitDiff row's, not change_wanted's why)
      const lastAt = (f: string): number => Math.max(-1, ...[...words.slice(0, at).matchAll(new RegExp(`(?<![.\\w])${f}(?!\\w)`, "g"))].map((m) => m.index ?? -1))
      const named = bounded.map(([, , f]) => [f, lastAt(f)] as const).filter(([, i]) => i > -1).sort((x, y) => y[1] - x[1])
      expect(named[0]?.[0]).toBe(field)
    }
  })

  test("[MUST-FAIL] what_failed copies the first failing line, not the whole block; no description asks for a copy without a bound", () => {
    for (const r of schemas("attempt_explanation")) expect(String(r.description)).toContain("first failing line or error with its file and line, not the whole block")
    for (const r of seeded.filter((x) => x.shape === "shape_schema")) expect(String(r.description)).not.toContain("character for character")
  })

  test("[MUST-FAIL] an attempt explanation, both variants, keeps its own schema refusals in view", () => {
    const ae = schemas("attempt_explanation")
    expect(ae.map((r) => String(r.variant ?? "")).sort()).toEqual(["", "gap"])
    for (const r of ae) expect(r.context).toContainEqual({ shape: "failure", where: { refused: "schema" }, keep: true })
  })

  test("[GUARD] the request still keeps the newest request_acts in its context", () => {
    for (const r of schemas("request"))
      expect(r.context).toContainEqual({ shape: "request_acts", latest_by: "shape", keep: true })
  })
})
