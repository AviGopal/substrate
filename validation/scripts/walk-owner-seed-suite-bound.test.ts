// walk-owner-seed-suite-bound.test.ts — git_diff's whole-suite runs are bounded by an owner row, not the fixed step bound:
// the suite grows with its repository, and runs were being cut at the step bound. The seed writes a starting suite_bound
// row, only when the owner has none, and local-tools reads it at each call (repos/local-tools-vessel suite-bound.ts).
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-attempt-explanation).
//   rows: one suite_bound row naming no repo, as declared; a second run over a store where the owner revised it writes none;
//     a store whose newest owner row is still the 330 s an earlier seed wrote (naming no repo) takes the new value; one
//     naming a repo, or any other value, is kept; a store already at the new value takes nothing;
//     another writer's row does not stop it (only the owner's rows count, as local-tools reads only the owner's).
//   reader: local-tools' own suiteBoundOf over the seeded rows gives the seeded bound for any repository.
//
// SAFETY and NEEDS: loopback only (stub store), a private temp dir; reads repos/local-tools-vessel (run-glue-tests NEEDS).
import { afterAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")
const READER = join(ROOT, "repos/local-tools-vessel/src/suite-bound.ts")

const T = mkdtempSync(join(tmpdir(), "wos-bound-"))
afterAll(() => rmSync(T, { recursive: true, force: true }))

// the seed run against a store holding `rows`; what the store holds after it
const seedOver = async (rows: Row[]): Promise<Row[]> => {
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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-boundtest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  return rows
}
const bounds = (rows: Row[]) => rows.filter((r) => r.shape === "suite_bound")

describe("the suite's bound, as the seed writes it", () => {
  test("[MUST-FAIL] on an empty store the seed writes one suite_bound row, naming no repo, of 600 s", async () => {
    const b = bounds(await seedOver([]))
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ shape: "suite_bound", suite_step_ms: 600_000, role: "owner" })
    expect(b[0].repo).toBeUndefined()
  })

  test("[GUARD] a bound the owner revised is kept: the seed writes none over it", async () => {
    const revised = { shape: "suite_bound", id: "own1", seq: 0, role: "owner", suite_step_ms: 400_000 }
    expect(bounds(await seedOver([revised]))).toEqual([revised])
  })

  test("[MUST-FAIL] the owner's newest still the 330 s an earlier seed wrote: the seed writes the new value after it", async () => {
    const earlier = { shape: "suite_bound", id: "s1", seq: 0, role: "owner", suite_step_ms: 330_000 }
    const b = bounds(await seedOver([earlier]))
    expect(b).toEqual([earlier, expect.objectContaining({ role: "owner", suite_step_ms: 600_000 })])
    expect(b[1].repo).toBeUndefined()
  })

  test("[GUARD] 330 s naming a repository, or 330 s under a newer owner value, is not the seed's: kept", async () => {
    const scoped = { shape: "suite_bound", id: "s2", seq: 0, role: "owner", suite_step_ms: 330_000, repo: "local-tools-vessel" }
    expect(bounds(await seedOver([scoped]))).toEqual([scoped])
    const old = { shape: "suite_bound", id: "s3", seq: 0, role: "owner", suite_step_ms: 330_000 }
    const revised = { shape: "suite_bound", id: "s4", seq: 1, role: "owner", suite_step_ms: 450_000 }
    expect(bounds(await seedOver([old, revised]))).toEqual([old, revised])
  })

  test("[GUARD] a store already at the new value takes nothing more", async () => {
    const now = { shape: "suite_bound", id: "s5", seq: 0, role: "owner", suite_step_ms: 600_000 }
    expect(bounds(await seedOver([now]))).toEqual([now])
  })

  test("[MUST-FAIL] another writer's row is not the owner's: the seed still writes the owner's, and the reader takes it", async () => {
    const stray = { shape: "suite_bound", id: "w1", seq: 0, role: "walk", suite_step_ms: 1 }
    const seeded = await seedOver([stray])
    expect(bounds(seeded)).toEqual([stray, expect.objectContaining({ role: "owner", suite_step_ms: 600_000 })])
    const { suiteBoundOf } = await import(READER)
    const rows = async (q: { shape?: string }) => seeded.filter((r) => r.shape === q.shape)
    expect(await suiteBoundOf(rows, "some-vessel")).toBe(600_000)
  })

  test("[MUST-FAIL] local-tools' own reader, over the seeded rows, takes the seeded bound for any repository", async () => {
    const seeded = await seedOver([])
    const { suiteBoundOf } = await import(READER)
    const rows = async (q: { shape?: string }) => seeded.filter((r) => r.shape === q.shape)
    expect(await suiteBoundOf(rows, "some-vessel")).toBe(600_000)
    expect(await suiteBoundOf(rows, "local-tools-vessel")).toBe(600_000)
  })
})
