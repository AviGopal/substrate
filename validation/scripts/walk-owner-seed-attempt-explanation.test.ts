// walk-owner-seed-attempt-explanation.test.ts — a refused attempt is explained in a row of its own, kept in view (the "An
// explanation shape is required" ruling). The grader's r 0 verdict is shown to the next drafter only beside the newest
// tree's diff, so after the next commit the refusal drops out of view and the same fix is tried again. The owner seed
// declares attempt_explanation, made from the newest tree's diff and the r 0 verdict on it, whose what_failed quotes the
// diff's own words (x-quotes), and the request keeps every explanation of its root after its own kept rows.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-commit-before-check).
//   rows: both variants of the schema, exactly as declared; the request's first kept entry, in both variants; every
//     x-quotes the seed writes is bound to one of its schema's inputs (described reads a quoted row whole only there).
//   behaviour: the seeded rows go through the walk's own applicable (repos/walk-vessel) with a root's rows in the forms
//     the walk records them: an explanation is offered after the grader's r 0 on the newest tree, and not again once it
//     is made, nor after an r 1, before any verdict, or once a newer commit has moved the tree on.
//   end to end: described (repos/described-shape-vessel) runs as its unit does, on the seeded rows: an explanation of a
//     diff whose check did not run quotes its why or is refused; and on a root explained more often than the keep share
//     holds, the request's own clone, change_wanted and diff are still shown, with what share is left to explanations;
//     and the explainer on such a root is still shown the diff, the verdict and what the change already did.
//
// SAFETY and NEEDS: loopback only (stub store, stub discovery and identity), a private temp dir; reads repos/walk-vessel
// and repos/described-shape-vessel (run-glue-tests NEEDS).
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")
const APPLICABLE = join(ROOT, "repos/walk-vessel/src/applicable.ts")
const DESCRIBED = join(ROOT, "repos/described-shape-vessel")

const NEWEST = { "x-latest": { shapes: ["gitCommitResult", "gitWorktree", "gitDiff"], moves: ["gitCommitResult", "gitWorktree"],
  same: "cwd", field: "tree", continues: "gap_id" } }
const EXPLAINED = [{ shape: "gitDiff", latest_by: "shape", where: { tree: NEWEST, role: "walk" } },
  { shape: "land_verdict", latest_by: "tree", where: { tree: NEWEST, r: 0, role: "described" } }]

const T = mkdtempSync(join(tmpdir(), "wos-explain-"))
let seeded: Row[] = []
const last = (f: (r: Row) => boolean): Row | undefined => seeded.filter(f).at(-1)
const schemaOf = (target: string, variant: string): Row | undefined =>
  last((r) => r.shape === "shape_schema" && r.target === target && String(r.variant ?? "") === variant)

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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-explaintest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

describe("the seed's rows", () => {
  for (const variant of ["", "gap"]) {
    test(`[MUST-FAIL] attempt_explanation${variant ? "/gap" : ""} is made from the newest tree's diff and the r 0 verdict on it, and quotes the diff`, () => {
      const s = schemaOf("attempt_explanation", variant)
      expect(s?.inputs).toEqual([variant === "gap" ? { shape: "gap", latest_by: "gap_id" } : "world_changed", ...EXPLAINED])
      expect(s?.schema?.required).toEqual(["tree", "what_failed", "next_must"])
      expect(s?.schema?.properties?.tree?.["x-equals"]).toEqual({ shape: "gitDiff", path: "tree" })
      // the diff's own words, never the verdict's why: only the gitDiff row's fields are named
      // no list of fields: any text of the gitDiff row may be quoted (described reads a rule with no paths so)
      expect(s?.schema?.properties?.what_failed?.["x-quotes"]).toEqual({ shape: "gitDiff", min: 20 })
      expect([s?.schema?.properties?.what_failed?.maxLength, s?.schema?.properties?.next_must?.maxLength]).toEqual([1200, 800])
      expect(s?.context).toEqual([{ shape: "request_acts", latest_by: "shape", keep: true }, { shape: "attempt_explanation", keep: true },
        { shape: "failure", where: { refused: "schema" }, keep: true }])
    })

    test(`[MUST-FAIL] the request${variant ? "/gap" : ""} keeps every explanation of its root, after its own kept rows and before the calls' answers`, () => {
      const kept = (schemaOf("request", variant)?.context ?? []).filter((e: unknown) => typeof e === "object" && e !== null && (e as Row).keep === true)
      const names = kept.map((e: Row) => e.answers_a_call === true ? "answers" : e.shape)
      expect(names.slice(-2)).toEqual(["attempt_explanation", "answers"])
      expect(kept.at(-2)).toEqual({ shape: "attempt_explanation", keep: true })
    })
  }

  test("[MUST-FAIL] the judgment of a gap's edit site keeps the changes already refused for the gap, with why, in view", () => {
    const s = schemaOf("change_wanted", "gap")
    const ctx = (s?.context ?? []) as Row[]
    expect(ctx).toContainEqual({ shape: "land_verdict", latest_by: "tree", where: { r: 0, role: "described" }, keep: true })
    expect(ctx).toContainEqual({ shape: "attempt_explanation", keep: true })
    // after the judgment's own kept rows: its own earlier site comes first
    const at = (shape: string) => ctx.findIndex((e) => e?.shape === shape)
    expect(at("change_wanted")).toBeLessThan(at("land_verdict"))
    expect(at("land_verdict")).toBeLessThan(at("attempt_explanation"))
    expect(String(s?.description)).toContain("not named again")
  })

  test("every x-quotes the seed writes is bound to one of its schema's inputs (a context row may be clipped or left out)", () => {
    const quoting = seeded.filter((r) => r.shape === "shape_schema" && JSON.stringify(r.schema ?? {}).includes("\"x-quotes\""))
    expect(quoting.length).toBeGreaterThan(0)
    for (const s of quoting) {
      const inputShapes = (s.inputs as unknown[]).map((i) => (typeof i === "string" ? i : (i as Row).shape))
      const named = [...JSON.stringify(s.schema).matchAll(/"x-quotes":\{"shape":"([^"]+)"/g)].map((m) => m[1])
      for (const shape of named) expect(inputShapes).toContain(shape)
    }
  })
})

describe("the walk reading them", () => {
  const realFetch = globalThis.fetch
  let applicable: (pool: Row[], skipped?: Row[], now?: number, note?: Row, answers?: Record<string, string>) => Promise<Array<{ id: string; seen_key?: string }>>
  beforeAll(async () => {
    Object.assign(process.env, { WALK_VESSEL_ID: "walk-explain-test", WALK_PORT: "1", DISCOVERY_URL: "http://discovery.test", WALK_ENDPOINT: "http://walk.test", METABOB_API_KEY: "k" })
    globalThis.fetch = (async () => Response.json({ content: { vessels: [{ vesselId: "v", endpoint: "http://v.test" }] } })) as typeof fetch
    applicable = (await import(APPLICABLE)).applicable as any
  })
  afterAll(() => { globalThis.fetch = realFetch })

  const tree = (n: number) => String(n).repeat(40)
  const cwd = "/trees/walk-trees/some-vessel-fixture-0001"
  const gap = { shape: "gap", id: "root-gap", seq: 10, role: "detector", gap_id: "failing-test-some-vessel-fixture", status: "open", repo: "some-vessel", input_refs: [] }
  const ask = { shape: "world_changed", id: "root-ask", seq: 10, role: "person", input_refs: [] }
  const wanted = { shape: "change_wanted", id: "cw-ask", seq: 11, role: "described", wanted: true, repo: "some-vessel", input_refs: ["root-ask"] }
  const from = (root: string, shape: string, seq: number, fields: Row): Row =>
    ({ shape, id: `${shape}-${seq}`, seq, role: "walk", call_id: `c${seq}`, selection_ref: `sel${seq}`, t: seq, writer: "walk-explain-test", input_refs: [root], ...fields })
  const handout = (root: string, seq: number, t: string) => from(root, "gitWorktree", seq, { cwd, repo: "some-vessel", branch: "dev", tree: t, committed_tree: t })
  const commit = (root: string, seq: number, t: string) => from(root, "gitCommitResult", seq, { cwd, sha: tree(4), tree: t, committed_tree: t, changed: ["src/x.ts"] })
  const diff = (root: string, seq: number, t: string) => from(root, "gitDiff", seq, { cwd, repo: "some-vessel", tree: t,
    check: { ran: true, passed: false, out: "error: expect(received).toBe(expected)\nExpected: \"a\"\nReceived: \"b\"" }, typecheck: { ran: true, passed: true, out: "" } })
  const verdict = (root: string, seq: number, t: string, r: 0 | 1) => ({ shape: "land_verdict", id: `lv-${seq}`, seq, role: "described",
    repo: "some-vessel", tree: t, typecheck_ran: true, r, why: "the check did not pass", input_refs: [root, `gitDiff-${seq - 1}`] })
  const candidate = async (root: Row, extra: Row[], of = "attempt_explanation"): Promise<{ id: string; seen_key?: string } | undefined> => {
    const base = root.id === "root-ask" ? [root, wanted] : [root]
    const pool = [...base, ...seeded, ...extra.map((r) => ({ ...r, seq: r.seq + 1000 }))]
    const cands = await applicable(pool, [], Date.now(), { root: root.id })
    return cands.find((c) => c.id.startsWith(`produce/${of}/`))
  }
  const offered = async (root: Row, extra: Row[]): Promise<boolean> => (await candidate(root, extra)) !== undefined
  // an explanation made for that verdict, as the walk records a produce: its selection (keeping what it was handed),
  // the ended hop, the row
  const made = (root: string, c: { id: string; seen_key?: string }, seq: number): Row[] => [
    { shape: "selection", id: `sel${seq}`, seq, role: "walk", root, a: c.id, seen_key: c.seen_key, input_refs: [root] },
    { shape: "hop", id: `hp${seq}`, seq: seq + 1, role: "walk", phase: "ended", kind: "produce", selection_ref: `sel${seq}`, input_refs: [root] },
    { shape: "attempt_explanation", id: `ae${seq}`, seq: seq + 2, role: "described", tree: tree(1), what_failed: "Expected: \"a\"\nReceived: \"b\"",
      next_must: "keep a", selection_ref: `sel${seq}`, input_refs: [root, `gitDiff-30`, "lv-31"] },
  ]

  // a request made over what the walk handed it, as the walk records a produce
  const asked = (root: string, c: { id: string; seen_key?: string }, seq: number): Row[] => [
    { shape: "selection", id: `sel${seq}`, seq, role: "walk", root, a: c.id, seen_key: c.seen_key, input_refs: [root] },
    { shape: "hop", id: `hp${seq}`, seq: seq + 1, role: "walk", phase: "ended", kind: "produce", selection_ref: `sel${seq}`, input_refs: [root] },
    { shape: "request", id: `rq${seq}`, seq: seq + 2, role: "described", selection_ref: `sel${seq}`, input_refs: [root] },
  ]

  for (const root of [gap, ask]) {
    const id = root.id
    test(`[MUST-FAIL] after the grader's r 0 on the newest tree, an explanation is offered (${root.shape} root)`, async () => {
      expect(await offered(root, [handout(id, 20, tree(1)), diff(id, 30, tree(1)), verdict(id, 31, tree(1), 0)])).toBe(true)
    })
    test(`[MUST-FAIL] once that r 0 is explained, it is not explained again (${root.shape} root)`, async () => {
      const refused = [handout(id, 20, tree(1)), diff(id, 30, tree(1)), verdict(id, 31, tree(1), 0)]
      const c = await candidate(root, refused)
      expect(c?.seen_key).toBeDefined()
      expect(await offered(root, [...refused, ...made(id, c!, 40)])).toBe(false)
    })
    test(`[MUST-FAIL] a second r 0 from the grader on a tree already explained asks for no second explanation (${root.shape} root)`, async () => {
      const refused = [handout(id, 20, tree(1)), diff(id, 30, tree(1)), verdict(id, 31, tree(1), 0)]
      const c = await candidate(root, refused)
      expect(await offered(root, [...refused, ...made(id, c!, 40), verdict(id, 51, tree(1), 0)])).toBe(false)
    })
    test(`[GUARD] a refusal repeated before it was explained is still explained, once (${root.shape} root)`, async () => {
      const refused = [handout(id, 20, tree(1)), diff(id, 30, tree(1)), verdict(id, 31, tree(1), 0), verdict(id, 41, tree(1), 0)]
      const c = await candidate(root, refused)
      expect(c).toBeDefined()
      expect(await offered(root, [...refused, ...made(id, c!, 50)])).toBe(false)
    })
    // The repeat holds the request too (the walk reads a same-tree, same-r re-grade as no news), so a refused root's next
    // draft comes from its explanation: a new row the request is shown, which makes it due again, once.
    test(`[MUST-FAIL] the explanation of a refusal makes the root's request due again (${root.shape} root)`, async () => {
      const refused = [handout(id, 20, tree(1)), diff(id, 30, tree(1)), verdict(id, 31, tree(1), 0)]
      const rq = await candidate(root, refused, "request")
      expect(rq?.seen_key).toBeDefined()
      const drafted = [...refused, ...asked(id, rq!, 35)]
      expect(await candidate(root, drafted, "request")).toBeUndefined()
      const c = await candidate(root, drafted)
      expect(await candidate(root, [...drafted, ...made(id, c!, 40)], "request")).toBeDefined()
    })
    // What the explanation quotes is the walk's own diff of the tree, the one its call made: a gitDiff another role wrote
    // naming the same tree is not the diff's own words, and does not make an explanation due.
    test(`[GUARD] with only another role's diff of the newest tree, the r 0 offers no explanation (${root.shape} root)`, async () => {
      const foreign = { ...diff(id, 30, tree(1)), role: "person", writer: "someone" }
      expect(await offered(root, [handout(id, 20, tree(1)), foreign, verdict(id, 31, tree(1), 0)])).toBe(false)
    })
    test(`after an r 1 on that tree, none is offered (${root.shape} root)`, async () => {
      expect(await offered(root, [handout(id, 20, tree(1)), diff(id, 30, tree(1)), verdict(id, 31, tree(1), 1)])).toBe(false)
    })
    test(`with a diff and no verdict yet, none is offered (${root.shape} root)`, async () => {
      expect(await offered(root, [handout(id, 20, tree(1)), diff(id, 30, tree(1))])).toBe(false)
    })
    test(`once a newer commit moved the tree on, the old r 0 asks for no explanation of the new tree (${root.shape} root)`, async () => {
      expect(await offered(root, [handout(id, 20, tree(1)), diff(id, 30, tree(1)), verdict(id, 31, tree(1), 0), commit(id, 40, tree(2))])).toBe(false)
    })
  }
})

describe("described producing them", () => {
  const CH = { shape: "channel", id: "ch-e2e", calls: [{ pointer: { type: "llm_completion" }, input_field: "prompt", output_field: "content", producer_field: "model" }] }
  let rows: Row[] = []
  let llm = "{}"
  const prompts: string[] = []
  let discovery: ReturnType<typeof Bun.serve>
  let identity: ReturnType<typeof Bun.serve>
  let vessel: ReturnType<typeof Bun.spawn>
  let port = 0
  // a read answers the seeded rows its where names, as records does
  const where = (p: Row) => (r: Row): boolean => Object.entries((p.where ?? {}) as Row).every(([k, v]) => String(r[k]) === String(v))
  const answer = (p: Row): Response => {
    if (p.type === "record_read" && p.shape === "shape_schema") return Response.json(seeded.filter((r) => r.shape === "shape_schema").filter(where(p)))
    if (p.type === "record_read" && p.shape === "shape_description") return Response.json([])
    if (p.type === "record_read" && p.shape === "requires") return Response.json(seeded.filter((r) => r.shape === "requires").filter(where(p)))
    if (p.type === "record_read" && p.shape === "channel") return Response.json([CH])
    if (p.type === "record_read") return Response.json(rows.filter((r) => ((p.ids ?? []) as string[]).includes(r.id)))
    if (p.type === "record_summary") return Response.json({ shape: p.shape, count: 0, newest_seq: null, fields: {} })
    if (p.type === "shapeDescriptions") return Response.json({ content: { shape_descriptions: {}, data_shapes: {} } })
    if (p.type === "rows_in_object") return Response.json({ rows: [] })
    if (p.type === "record_lapsed") return Response.json([])
    if (p.type === "llm_completion") { prompts.push(String(p.prompt ?? "")); return Response.json({ content: llm, model: "m" }) }
    if (p.type === "record_write") return Response.json({ ...p.row, id: "row-w", writer: p.writer, role: p.role })
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  beforeAll(async () => {
    discovery = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
      const path = new URL(req.url).pathname
      const body = (req.method === "POST" ? await req.json().catch(() => ({})) : {}) as Row
      if (path === "/resolve") return answer((body.pointer ?? {}) as Row)
      return Response.json(path === "/heartbeat" ? { nextHeartbeatMs: 600000 } : { ok: true })
    } })
    identity = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => Response.json({ success: false }, { status: 401 }) })
    const s = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() }); port = s.port as number; s.stop(true)
    vessel = Bun.spawn([process.execPath, "src/index.ts"], { cwd: DESCRIBED, stdout: "ignore", stderr: "ignore", env: { PATH: process.env.PATH ?? "",
      DESCRIBED_VESSEL_ID: "described-explain-test", DESCRIBED_PORT: String(port), DISCOVERY_URL: `http://127.0.0.1:${discovery.port}`,
      DESCRIBED_ENDPOINT: `http://127.0.0.1:${port}`, IDENTITY_VESSEL_URL: `http://127.0.0.1:${identity.port}`, METABOB_API_KEY: "node-key-for-test" } })
    for (let i = 0; i < 400; i++) { if ((await fetch(`http://127.0.0.1:${port}/health`).catch(() => undefined))?.ok) break; await Bun.sleep(25) }
  })
  afterAll(() => { vessel?.kill(); discovery?.stop(true); identity?.stop(true) })

  const T1 = "1".repeat(40)
  const cwd = "/trees/walk-trees/clone-mark-0001"
  const ask = { shape: "world_changed", id: "w1", seq: 1, role: "person", what: "make the failing test pass" }
  const sel = { shape: "selection", id: "sel-p", seq: 900, role: "walk", root: "w1" }
  const tool = (shape: string, seq: number, f: Row): Row => ({ shape, id: `${shape}-${seq}`, seq, role: "walk", call_id: `c${seq}`, selection_ref: "sel-t", input_refs: ["w1"], ...f })
  const selT = { shape: "selection", id: "sel-t", seq: 2, role: "walk", root: "w1" }
  const clone = tool("gitWorktree", 10, { cwd, repo: "some-vessel", branch: "dev", tree: T1, committed_tree: T1 })
  const wanted = { shape: "change_wanted", id: "cw-1", seq: 11, role: "described", root: "w1", wanted: true, repo: "some-vessel", what: "wanted-mark: the change this root asks for", input_refs: ["w1"] }
  const produce = async (type: string, ids: string[]) => {
    const r = await fetch(`http://127.0.0.1:${port}/v2/impulses/resolve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "ApiKey node-key-for-test" },
      body: JSON.stringify({ impulse: { pointer: { type, shape: type, via_ref: "ch-e2e", input_refs: ids, selection_ref: "sel-p", call_id: "call-p" } } }) })
    return r.status
  }

  test("[MUST-FAIL] an explanation of a diff whose check did not run quotes the check's why, and a paraphrase of it is refused", async () => {
    const why = "bun was not found on the clone's PATH, so no test could run"
    const diff = tool("gitDiff", 20, { cwd, repo: "some-vessel", tree: T1, check: { ran: false, why }, typecheck: { ran: false, why: "no tsconfig.json in the clone" } })
    const verdict = { shape: "land_verdict", id: "lv-21", seq: 21, role: "described", root: "w1", repo: "some-vessel", tree: T1, r: 0, why: "the check did not run", input_refs: ["w1", diff.id] }
    rows = [ask, selT, sel, clone, diff, verdict]
    const ids = rows.map((r) => r.id)
    const said = async (what_failed: string) => { llm = JSON.stringify({ tree: T1, what_failed, next_must: "put bun on the PATH before the check" }); return await produce("attempt_explanation", ids) }
    expect({
      quoted: await said(`the check said: ${why}`),
      paraphrased: await said("the test runner was missing from the environment, so nothing ran"),
      verdictWords: await said("the check did not run, said the verdict"),
    }).toEqual({ quoted: 200, paraphrased: 422, verdictWords: 422 })
  })

  test("[MUST-FAIL] an explanation of a diff whose only failure is its suite quotes a regressed name, and a paraphrase of it is refused", async () => {
    const name = "write containment > a write outside the zones is refused"
    const diff = tool("gitDiff", 20, { cwd, repo: "some-vessel", tree: T1, check: { ran: true, passed: true, out: "1 pass" },
      typecheck: { ran: true, passed: true, out: "" }, suite: { ran: true, passed: false, exit_code: 1, regressed: [name, "b", "c"] } })
    const verdict = { shape: "land_verdict", id: "lv-21", seq: 21, role: "described", root: "w1", repo: "some-vessel", tree: T1, r: 0, why: "the suite regressed", input_refs: ["w1", diff.id] }
    rows = [ask, selT, sel, clone, diff, verdict]
    const ids = rows.map((r) => r.id)
    const said = async (what_failed: string) => { llm = JSON.stringify({ tree: T1, what_failed, next_must: "keep the write inside the zones" }); return await produce("attempt_explanation", ids) }
    expect({
      quoted: await said(`the suite regressed ${name}`),
      paraphrased: await said("a containment test began failing after this change was made"),
    }).toEqual({ quoted: 200, paraphrased: 422 })
  })

  // what the request's prompt holds of its own rows, with n explanations of its root near their bounds, on a root as old
  // roots are: newer hops than its clone, more than the context holds beside the kept rows, so only a kept row of the
  // clone is shown
  const hops = Array.from({ length: 40 }, (_, i) => ({ shape: "hop", id: `hp-${i}`, seq: 300 + i, role: "walk", phase: "ended", kind: "call",
    call_id: `ch${i}`, selection_ref: "sel-t", input_refs: ["w1"], output: { text: "z".repeat(3000) } }))
  const shownWith = async (n: number) => {
    // a diff of a few KB, as most are: larger than what the explanations leave of the share when they are fitted first
    const diff = tool("gitDiff", 20, { cwd, repo: "some-vessel", tree: T1, diff: `diff-mark\n${"+ a changed line\n".repeat(400)}`,
      check: { ran: true, passed: false, out: "diff-mark-check: 1 fail" }, typecheck: { ran: true, passed: true, out: "" } })
    const verdict = { shape: "land_verdict", id: "lv-21", seq: 21, role: "described", root: "w1", repo: "some-vessel", tree: T1, r: 0, why: "the check failed", input_refs: ["w1", diff.id] }
    const explained = Array.from({ length: n }, (_, i) => ({ shape: "attempt_explanation", id: `ae-${i}`, seq: 100 + i, role: "described", root: "w1", tree: T1,
      what_failed: `explain-mark-${i} ${"x".repeat(1150)}`, next_must: "y".repeat(780), input_refs: ["w1", diff.id] }))
    rows = [ask, selT, sel, clone, wanted, diff, verdict, ...explained, ...hops]
    prompts.length = 0
    llm = "{}"
    await produce("request", rows.map((r) => r.id))
    const prompt = prompts.at(-1) ?? ""
    return { clone: prompt.includes("clone-mark-0001"), wanted: prompt.includes("wanted-mark"), diff: prompt.includes("diff-mark-check"),
      explained: explained.filter((e) => prompt.includes(`explain-mark-${e.id.slice(3)} `)).length, newestExplained: n === 0 || prompt.includes(`explain-mark-${n - 1} `) }
  }

  test("[GUARD] with no explanations, the request is shown its clone, change_wanted and diff", async () => {
    expect(await shownWith(0)).toEqual({ clone: true, wanted: true, diff: true, explained: 0, newestExplained: true })
  })

  // 72: as many refused verdicts as the most refused root holds
  test("[MUST-FAIL] on a root explained more often than the keep share holds, the request is still shown its clone, change_wanted and diff", async () => {
    const shown = await shownWith(72)
    expect({ ...shown, explained: shown.explained > 0 }).toEqual({ clone: true, wanted: true, diff: true, explained: true, newestExplained: true })
  })

  // What the change already did (request_acts) is listed before the root's earlier explanations: next_must is told to
  // read it, and without it the next attempt is sent back to redo or undo what this change did. Kept rows are fitted
  // first only within a share; with none, the newer explanations fill the context ahead of the older acts row.
  // Explanations past the whole context, and an acts row larger than one explanation (a long change's acts are), so that
  // the acts are not shown by the slack a skipped row leaves.
  test("[MUST-FAIL] on a root explained more often than the context holds, the explainer is still shown the diff, the verdict and what the change did", async () => {
    const diff = tool("gitDiff", 20, { cwd, repo: "some-vessel", tree: T1, diff: `diff-mark\n${"+ a changed line\n".repeat(400)}`,
      check: { ran: true, passed: false, out: "diff-mark-check: 1 fail in the leg under change" }, typecheck: { ran: true, passed: true, out: "" } })
    const verdict = { shape: "land_verdict", id: "lv-21", seq: 21, role: "described", root: "w1", repo: "some-vessel", tree: T1, r: 0, why: "verdict-mark: the check failed", input_refs: ["w1", diff.id] }
    // as the walk writes it: citing the root, under the selection of the request it counts
    const acts = { shape: "request_acts", id: "ra-22", seq: 22, role: "walk", input_refs: ["w1"], selection_ref: "sel-t",
      acts: [{ a: "acts-mark: edited the failing leg's helper" }, ...Array.from({ length: 40 }, (_, i) => ({ a: `fs_edit src/part-${i}.ts ${"e".repeat(60)}` }))] }
    const explained = Array.from({ length: 110 }, (_, i) => ({ shape: "attempt_explanation", id: `ae-${i}`, seq: 100 + i, role: "described", root: "w1", tree: T1,
      what_failed: `explain-mark-${i} ${"x".repeat(1150)}`, next_must: "y".repeat(780), input_refs: ["w1", diff.id] }))
    rows = [ask, selT, sel, clone, diff, verdict, acts, ...explained, ...hops]
    prompts.length = 0
    llm = "{}"
    await produce("attempt_explanation", rows.map((r) => r.id))
    const prompt = prompts.at(-1) ?? ""
    expect({ diff: prompt.includes("diff-mark-check"), verdict: prompt.includes("verdict-mark"), acts: prompt.includes("acts-mark"),
      explained: explained.some((e) => prompt.includes(`explain-mark-${e.id.slice(3)} `)) })
      .toEqual({ diff: true, verdict: true, acts: true, explained: true })
  })
})
