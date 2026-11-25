// walk-owner-seed-install-shown.test.ts — a request's producer sees what was installed. The walk makes a held request
// again once over an install bearing on it (the "Retry on its repo's install" and "Gap's repo, walk, and tool" rulings);
// the owner's request schema (an ask's and a gap's) names the owner's infra_window rows in its context, so the request is made again seeing
// what went in, one row per window, never kept ahead of the request's own rows.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store; the request schema's context entry for infra_window.
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
const T = mkdtempSync(join(tmpdir(), "wos-install-"))
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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-install-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const requestContext = (variant = ""): unknown[] =>
  [seeded.filter((r) => r.shape === "shape_schema" && r.target === "request" && (r.variant ?? "") === variant).at(-1)?.context ?? []].flat()

describe("the request schema shows what was installed", () => {
  // both request rows: an ask's, and a gap's (the roots a held gap leaves told are gap roots)
  test("[MUST-FAIL] the request's context names the owner's infra_window rows, one per window, for an ask and a gap alike", () => {
    for (const v of ["", "gap"]) expect(requestContext(v).filter((e) => (e as Row)?.shape === "infra_window")).toEqual([{ shape: "infra_window", latest_by: "window_id" }])
  })
  test("[GUARD] no other schema shows them, and the request's own kept rows keep their place", () => {
    const others = seeded.filter((r) => r.shape === "shape_schema" && r.target !== "request")
    expect(others.filter((r) => JSON.stringify([r.inputs, r.context]).includes("infra_window")).map((r) => r.target)).toEqual([])
    // the edit-miss rows are ranked in their own test (walk-owner-seed-edit-miss-context); the rest keep their order
    expect(requestContext().filter((e) => (e as Row)?.keep === true).map((e) => (e as Row).shape ?? "answers_a_call")
      .filter((s) => s !== "failure" && s !== "fileEditResult"))
      .toEqual(["gitWorktree", "change_wanted", "gitCommitResult", "request_acts", "gitDiff", "land_verdict", "attempt_explanation", "answers_a_call"])
  })
})
