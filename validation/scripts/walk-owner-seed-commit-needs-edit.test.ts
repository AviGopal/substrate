// walk-owner-seed-commit-needs-edit.test.ts — a commit is offered only when there is something to commit (the USER
// ruling, commit offered only when there is something to commit). git_commit consumes what changed in its clone, so the
// owner seed says so in the requires form the walk already reads: git_commit needs an answer of one of the tools that
// change a file (fileEditResult, fileWriteResult, codeInsertResult, codeReplaceResult, codeAddImportResult), or a clone
// handed out by a refresh that carried uncommitted edits, naming the clone the commit names (cwd), newest per clone.
// After an edit the call that consumes it is the one offered; a clone with nothing changed in it is not committed. These
// legs replace write-in-clone's guard that git_commit was offered with no clone, which that ruling retired.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store; its rows go through the walk's own applicable
// (repos/walk-vessel) with a root's rows in the forms the walk records them, values made up.
//
// SAFETY and NEEDS: loopback only (the stub store), a private temp dir; reads repos/walk-vessel (run-glue-tests NEEDS).
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")
const APPLICABLE = join(ROOT, "repos/walk-vessel/src/applicable.ts")
const EDITS = ["fileEditResult", "fileWriteResult", "codeInsertResult", "codeReplaceResult", "codeAddImportResult"]

const T = mkdtempSync(join(tmpdir(), "wos-commitedit-"))
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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-commitedit-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

describe("the seed's rows", () => {
  test("[MUST-FAIL] git_commit requires something to commit in its clone: one row per edit shape, a carrying refresh and a diff saying so, one group", () => {
    const req = seeded.filter((r) => r.shape === "requires" && r.for === "git_commit" && r.group === "uncommitted")
      .map(({ id: _i, seq: _s, role: _r, input_refs: _x, ...rest }) => rest)
    expect(req).toEqual([...EDITS.map((needs) =>
      ({ shape: "requires", for: "git_commit", needs, where: { cwd: { "x-pointer": "cwd" } }, latest_by: "cwd", group: "uncommitted" })),
      { shape: "requires", for: "git_commit", needs: "gitWorktree", where: { carried: "uncommitted", cwd: { "x-pointer": "cwd" } }, latest_by: "cwd", group: "uncommitted" },
      { shape: "requires", for: "git_commit", needs: "gitDiff", where: { uncommitted_any: true, cwd: { "x-pointer": "cwd" } }, latest_by: "cwd", group: "uncommitted" }])
  })
})

describe("the walk reading them", () => {
  const realFetch = globalThis.fetch
  const served = new Set(["git_commit", "git_worktree", "fs_edit"])
  let applicable: (pool: Row[], skipped?: Row[], now?: number, note?: Row, answers?: Record<string, string>) => Promise<Array<{ id: string }>>
  beforeAll(async () => {
    Object.assign(process.env, { WALK_VESSEL_ID: "walk-commitedit-test", WALK_PORT: "1", DISCOVERY_URL: "http://discovery.test", WALK_ENDPOINT: "http://walk.test", METABOB_API_KEY: "k" })
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      const { pointer } = JSON.parse(String(init?.body)) as { pointer: Row }
      return Response.json({ content: { vessels: served.has(String(pointer.shape)) ? [{ vesselId: "v", endpoint: "http://v.test" }] : [] } })
    }) as typeof fetch
    applicable = (await import(APPLICABLE)).applicable as any
  })
  afterAll(() => { globalThis.fetch = realFetch })

  const tree = (n: number) => String(n).repeat(40)
  const cwd = "/trees/walk-trees/some-vessel-fixture-0001"
  const cwd2 = "/trees/walk-trees/some-vessel-fixture-0002"
  const gap = { shape: "gap", id: "root-gap", seq: 10, role: "detector", gap_id: "failing-test-some-vessel-fixture", status: "open", repo: "some-vessel", input_refs: [] }
  const from = (shape: string, seq: number, fields: Row): Row =>
    ({ shape, id: `${shape}-${seq}`, seq, role: "walk", call_id: `c${seq}`, selection_ref: `sel${seq}`, t: seq, writer: "walk-commitedit-test", input_refs: [gap.id], ...fields })
  const handout = (seq: number, at = cwd) => from("gitWorktree", seq, { cwd: at, repo: "some-vessel", branch: "dev", base: tree(7), tree: tree(1), committed_tree: tree(1) })
  // an edit as the walk records it: an applied one names its clone (cwd); one found already made names none
  const applied = (seq: number, shape = "fileEditResult", at = cwd) => from(shape, seq, { cwd: at, path: `${at}/src/x.ts`, ok: true, after: "a".repeat(64) })
  // a refresh that carried uncommitted edits: the tree on disk, no committed tree
  const carrying = (seq: number, at = cwd) => {
    const { committed_tree: _c, ...rest } = handout(seq)
    return { ...rest, cwd: at, carried: "uncommitted" }
  }
  const already = (seq: number) => from("fileEditResult", seq, { path: `${cwd}/src/x.ts`, ok: true, applied: false, after: "a".repeat(64) })
  const commitAsked = { shape: "request", id: "rq-commit", seq: 5000, role: "described", pointer: { type: "git_commit", cwd, message: "m" }, input_refs: [gap.id] }
  const offered = async (extra: Row[]): Promise<boolean> => {
    const pool = [gap, ...seeded, ...extra.map((r) => ({ ...r, seq: r.seq + 1000 })), commitAsked]
    const cands = await applicable(pool, [], Date.now(), { root: gap.id }, { git_commit: "gitCommitResult", git_worktree: "gitWorktree", fs_edit: "fileEditResult" })
    return cands.some((c) => c.id === "call/git_commit")
  }

  test("[MUST-FAIL] a clean clone with nothing edited: a commit is not offered", async () => {
    expect(await offered([handout(20)])).toBe(false)
  })
  test("[GUARD] after an applied edit in the commit's clone, the commit is offered, for each kind of edit", async () => {
    for (const shape of EDITS) expect(await offered([handout(20), applied(30, shape)])).toBe(true)
  })
  test("[MUST-FAIL] an edit of another clone only does not open a commit of this one", async () => {
    expect(await offered([handout(20), applied(30, "fileEditResult", cwd2)])).toBe(false)
  })
  test("[GUARD] another clone's edit newer than this clone's does not hide it: each clone's own newest edit is read", async () => {
    expect(await offered([handout(20), applied(30), applied(40, "fileEditResult", cwd2)])).toBe(true)
  })
  test("[MUST-FAIL] an edit found already made changed nothing, and opens no commit", async () => {
    expect(await offered([handout(20), already(30)])).toBe(false)
  })
  test("[MUST-FAIL] no clone and nothing edited: a commit is not offered", async () => {
    expect(await offered([])).toBe(false)
  })
  test("[GUARD] a clone refreshed with its uncommitted edits carried: the commit is offered", async () => {
    expect(await offered([carrying(20)])).toBe(true)
  })
  test("[MUST-FAIL] a carrying refresh of another clone does not open a commit of this one", async () => {
    expect(await offered([handout(20), carrying(30, cwd2)])).toBe(false)
  })
  test("[GUARD] another clone's clean handout newer than this clone's carrying one does not hide it", async () => {
    expect(await offered([carrying(20), handout(30, cwd2)])).toBe(true)
  })
  test("[MUST-FAIL] a clean handout of the clone after a carrying one: nothing to commit, no commit", async () => {
    expect(await offered([carrying(20), handout(30)])).toBe(false)
  })
})
