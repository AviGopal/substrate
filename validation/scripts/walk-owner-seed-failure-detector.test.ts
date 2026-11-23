// walk-owner-seed-failure-detector.test.ts — the walk's failure classes are filed because the owner's seed makes their
// detector run: a failure_rule row (target walk_failure) it decides by, the template whose one call is
// walk_failure_detect, and a rhythm naming that template. Without these rows the detector was never called and decided
// by nothing (no failure_rule: it answers an error and reads no further), so no class was ever filed.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store. Its rows then go (1) through the walk's own applicable
// (repos/walk-vessel), as shared rows on the walk's idle root, and (2) to local-tools' own detect
// (repos/local-tools-vessel) against a stub records holding them beside walk failure rows. Values are made up.
//
// SAFETY and NEEDS: loopback only (stub stores), a private temp dir; reads repos/walk-vessel and
// repos/local-tools-vessel (run-glue-tests NEEDS).
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")
const APPLICABLE = join(ROOT, "repos/walk-vessel/src/applicable.ts")
const DETECT = join(ROOT, "repos/local-tools-vessel/src/walk-failure-detect.ts")

const OTHER_TARGET = "some_other_failure"
const OTHER_TEMPLATE = "some-other-template"
const T = mkdtempSync(join(tmpdir(), "wos-faildetect-"))
let seeded: Row[] = []
let firstSeeding: Row[] = []
let secondSeeding: Row[] = []
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
  const seed = async () => {
    const p = Bun.spawn([process.execPath, join(T, "walk-owner-seed.ts")], { env: { PATH: process.env.PATH ?? "",
      DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-faildetect-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
    await p.exited
  }
  // Seeded, then another target's rule and another template's rhythm written after, then seeded again: each row is
  // found by its own key (target, template), so a newer row of another key never makes the seed write its own again.
  await seed()
  firstSeeding = [...rows]
  for (const row of [{ shape: "failure_rule", target: OTHER_TARGET, min_count: 1 }, { shape: "rhythm", template: OTHER_TEMPLATE, every_rows: 1 }])
    rows.push({ ...row, id: `o${rows.length + 1}`, seq: rows.length + 1, role: "owner", input_refs: [] })
  await seed()
  secondSeeding = [...rows]
  // Then the rhythm naming the detector's template says another cadence (an owner edit, or a row a crashed seed left)
  // and the seed runs again: it finds the template present and restores the rhythm the seed says.
  const tid = secondSeeding.find((r) => r.shape === "activity_template" && [r.calls].flat().some((c: Row) => c?.shape === "walk_failure_detect"))?.id
  if (tid !== undefined) rows.push({ shape: "rhythm", template: tid, every_rows: 7, id: `o${rows.length + 1}`, seq: rows.length + 1, role: "owner", input_refs: [] })
  await seed()
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const bare = ({ id: _i, seq: _s, role: _r, input_refs: _x, ...rest }: Row) => rest
const ruleRow = () => secondSeeding.filter((r) => r.shape === "failure_rule" && r.target === "walk_failure")
const templateRows = () => secondSeeding.filter((r) => r.shape === "activity_template" && [r.calls].flat().some((c: Row) => c?.shape === "walk_failure_detect"))
const rhythmRows = () => secondSeeding.filter((r) => r.shape === "rhythm" && r.template !== OTHER_TEMPLATE)

describe("the seed's rows", () => {
  test("[MUST-FAIL] the failure_rule the detector decides by, writing, once over two seedings", () => {
    expect(ruleRow().map(bare)).toEqual([{ shape: "failure_rule", target: "walk_failure", min_count: 3, min_roots: 1, window_rows: 2000, quiet_rows: 2000, write: true }])
  })
  test("[MUST-FAIL] the template whose one call is walk_failure_detect", () => {
    expect(templateRows().map(bare)).toEqual([{ shape: "activity_template", sig: { in: [], out: ["walkFailureReport"] }, calls: [{ shape: "walk_failure_detect", pointer: {} }] }])
    expect(templateRows()[0].role).toBe("owner")
  })
  test("[MUST-FAIL] a rhythm naming that template, on the stall rule's cadence, once over two seedings", () => {
    const stall = secondSeeding.filter((r) => r.shape === "stall_rule").at(-1)
    expect(rhythmRows().map(bare)).toEqual([{ shape: "rhythm", template: templateRows()[0]?.id, every_rows: stall?.after_rows }])
  })
})

describe("one seeding", () => {
  test("[MUST-FAIL] a node seeded once has the rhythm naming the template it wrote in the same run", () => {
    const t = firstSeeding.filter((r) => r.shape === "activity_template" && [r.calls].flat().some((c: Row) => c?.shape === "walk_failure_detect"))
    expect(t.length).toBe(1)
    expect(firstSeeding.filter((r) => r.shape === "rhythm").map((r) => r.template)).toEqual([t[0].id])
  })
})

describe("a later seeding", () => {
  test("[MUST-FAIL] with the template already present, a rhythm for it saying another cadence is restored to the seed's", () => {
    const tid = templateRows()[0]?.id
    const newest = seeded.filter((r) => r.shape === "rhythm" && r.template === tid).at(-1)
    expect(newest?.every_rows).toBe(rhythmRows()[0]?.every_rows)
    expect(seeded.filter((r) => r.shape === "rhythm" && r.template === tid).map((r) => r.every_rows)).toEqual([rhythmRows()[0]?.every_rows, 7, rhythmRows()[0]?.every_rows])
  })
})

describe("the walk reading them", () => {
  const realFetch = globalThis.fetch
  let applicable: (pool: Row[], skipped?: Row[], now?: number, note?: Row, answers?: Record<string, string>) => Promise<Array<{ id: string }>>
  beforeAll(async () => {
    Object.assign(process.env, { WALK_VESSEL_ID: "walk-faildetect-test", WALK_PORT: "1", DISCOVERY_URL: "http://discovery.test", WALK_ENDPOINT: "http://walk.test", METABOB_API_KEY: "k" })
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      const { pointer } = JSON.parse(String(init?.body)) as { pointer: Row }
      return Response.json({ content: { vessels: pointer.shape === "walk_failure_detect" ? [{ vesselId: "v", endpoint: "http://v.test" }] : [] } })
    }) as typeof fetch
    applicable = (await import(APPLICABLE)).applicable as any
  })
  afterAll(() => { globalThis.fetch = realFetch })

  // the walk's idle root: its arm row, the owner's shared rows beside it, nothing awaited
  const arm = { shape: "arm", id: "arm-1", seq: 5000, role: "walk", input_refs: [] }
  const offeredAt = async (head: number): Promise<boolean> => {
    const pool = [...seeded, arm]
    const cands = await applicable(pool, [], Date.now(), { root: arm.id, awaits: false, head }, {})
    return cands.some((c) => c.id === `run/${templateRows()[0]?.id}`)
  }

  const newestRhythm = () => seeded.filter((r) => r.shape === "rhythm" && r.template === templateRows()[0]?.id).at(-1) as Row
  test("[MUST-FAIL] once every_rows store rows have passed since the rhythm row, the detector's template is offered", async () => {
    const r = newestRhythm()
    expect(await offeredAt(r.seq + r.every_rows)).toBe(true)
  })
  test("[MUST-FAIL] before then it is not", async () => {
    const r = newestRhythm()
    expect(await offeredAt(r.seq + r.every_rows - 1)).toBe(false)
  })
})

describe("the detector reading them", () => {
  const realFetch = globalThis.fetch
  afterAll(() => { globalThis.fetch = realFetch })
  // three failures of one tool, alike, on one root: a class at the seeded rule's min_count over its min_roots
  const sel = (n: number): Row => ({ shape: "selection", id: `sel${n}`, seq: 3000 + n, role: "walk", a: "call/fs_edit", root: "root-1", arm: "treated" })
  const hop = (n: number): Row => ({ shape: "hop", id: `hop${n}`, seq: 3000 + n, role: "walk", phase: "started", call_id: `c${n}`, pointer_type: "fs_edit", args: { path: "src/x.ts" } })
  const fail = (n: number): Row => ({ shape: "failure", id: `f${n}`, seq: 3000 + n, role: "walk", call_id: `c${n}`, selection_ref: `sel${n}`, status: 200, blames: "request", body: "{\"error\":\"old_string not found in src/x.ts\"}", input_refs: [] })
  const walkRows = [1, 2, 3].flatMap((n) => [sel(n), hop(n), fail(n)])

  // records as the detector reads it: the head, rows of a shape after a seq, rows by id; a gap write is kept
  const run = async (owner: Row[]): Promise<{ report: Row; gaps: Row[] }> => {
    const store = [...owner, ...walkRows]
    const gaps: Row[] = []
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      const { pointer: p } = JSON.parse(String(init?.body)) as { pointer: Row }
      if (p.type === "record_write") { gaps.push(p.row); return Response.json({ ...p.row, id: `g${gaps.length}`, role: p.role }) }
      if (p.head === true) return Response.json({ at_seq: 3100 })
      if (Array.isArray(p.ids)) return Response.json(store.filter((r) => p.ids.includes(r.id)))
      return Response.json(store.filter((r) => r.shape === p.shape && (p.after_seq === undefined || r.seq > p.after_seq)))
    }) as typeof fetch
    Object.assign(process.env, { DISCOVERY_ENDPOINT: "http://discovery.test", METABOB_API_KEY: "k" })
    const { detect } = await import(DETECT)
    return { report: await detect(), gaps }
  }
  const withoutRule = () => seeded.filter((r) => !(r.shape === "failure_rule" && r.target === "walk_failure"))

  test("[MUST-FAIL] with the seeded rule, a class that recurs is filed as a gap", async () => {
    const { report, gaps } = await run(seeded)
    expect(report.shape).toBe("walkFailureReport")
    expect(gaps.map((g) => [g.shape, g.status, g.tool, g.count])).toEqual([["gap", "open", "fs_edit", 3]])
  })
  test("[GUARD] with no failure_rule row, nothing is read past the rule and nothing is written", async () => {
    const { report, gaps } = await run(withoutRule())
    expect(String(report.error)).toContain("no owner failure_rule row")
    expect(gaps).toEqual([])
  })
  test("[MUST-FAIL] with the rule saying write false, the report is made and no gap is written", async () => {
    const dry = [...withoutRule(), ...ruleRow().map((r) => ({ ...r, write: false }))]
    const { report, gaps } = await run(dry)
    expect(report.shape).toBe("walkFailureReport")
    expect(report.classes.map((k: Row) => [k.tool, k.action])).toEqual([["fs_edit", "opened"]])
    expect(report.written).toBe(0)
    expect(gaps).toEqual([])
  })
})
