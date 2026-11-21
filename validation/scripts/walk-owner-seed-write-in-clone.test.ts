// walk-owner-seed-write-in-clone.test.ts — a change is written in its clone. A tool that writes a file names only a path,
// and the only paths it could name before a clone exists are the live checkout's (relative to the workspace, or
// repos/<vessel>/…), which containment refuses: so a root offered a write before its clone wrote nowhere, and its diff
// found "no commit since it was made" every time. The owner seed says so in rows the walk reads: each writer requires a
// gitWorktree (a clone handed out to the root), in its own group, besides a wanted change or an open gap.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-commit-before-check).
//   rows: one requires row per writer, exactly; git_worktree, git_commit, git_diff and git_land gain none.
//   behaviour: the seeded owner rows go through the walk's own applicable (repos/walk-vessel) with a root's rows in the
//     forms the walk records them, values made up: with no clone, no writer is offered, the skip names git_worktree as
//     where a gitWorktree comes from, and git_worktree is offered, while git_commit is offered as before; with the
//     root's clone handed out, every writer is.
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

const WRITERS: Record<string, string> = { fs_edit: "fileEditResult", fs_write: "fileWriteResult", code_replace_lines: "codeReplaceResult",
  code_insert_after_line: "codeInsertResult", code_add_import: "codeAddImportResult" }

const T = mkdtempSync(join(tmpdir(), "wos-clone-"))
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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-clonetest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const strip = ({ id: _i, seq: _s, role: _r, input_refs: _x, ...rest }: Row): Row => rest

describe("the seed's rows", () => {
  test("[MUST-FAIL] each writer requires a gitWorktree, in its own group: one row per writer", () => {
    const req = seeded.filter((r) => r.shape === "requires" && r.needs === "gitWorktree" && r.group === "clone").map(strip)
    expect(req.map((r) => r.for).sort()).toEqual(Object.keys(WRITERS).sort())
    for (const r of req) expect(r).toEqual({ shape: "requires", for: r.for, needs: "gitWorktree", where: {}, latest_by: "cwd", group: "clone" })
  })

  test("[GUARD] the git_ tools gain no gitWorktree requirement beyond git_diff's", () => {
    const git = seeded.filter((r) => r.shape === "requires" && r.needs === "gitWorktree" && String(r.for).startsWith("git_")).map((r) => r.for)
    expect(git).toEqual(["git_diff"])
  })
})

describe("the walk reading them", () => {
  const realFetch = globalThis.fetch
  const served = new Set(["git_worktree", "git_commit", "fs_read", ...Object.keys(WRITERS)])
  let applicable: (pool: Row[], skipped?: Row[], now?: number, note?: Row, answers?: Record<string, string>) => Promise<Array<{ id: string }>>
  beforeAll(async () => {
    Object.assign(process.env, { WALK_VESSEL_ID: "walk-clone-test", WALK_PORT: "1", DISCOVERY_URL: "http://discovery.test", WALK_ENDPOINT: "http://walk.test", METABOB_API_KEY: "k" })
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      const { pointer } = JSON.parse(String(init?.body)) as { pointer: Row }
      return Response.json({ content: { vessels: served.has(String(pointer.shape)) ? [{ vesselId: "v", endpoint: "http://v.test" }] : [] } })
    }) as typeof fetch
    applicable = (await import(APPLICABLE)).applicable as any
  })
  afterAll(() => { globalThis.fetch = realFetch })

  const tree = (n: number) => String(n).repeat(40)
  const cwd = "/trees/walk-trees/some-vessel-fixture-0001"
  const path = `${cwd}/src/x.ts`
  const gap = { shape: "gap", id: "root-gap", seq: 10, role: "detector", gap_id: "failing-test-some-vessel-fixture", status: "open", repo: "some-vessel", input_refs: [] }
  const ask = { shape: "world_changed", id: "root-ask", seq: 10, role: "person", input_refs: [] }
  const wanted = { shape: "change_wanted", id: "cw-ask", seq: 11, role: "described", wanted: true, repo: "some-vessel", input_refs: ["root-ask"] }
  const from = (root: string, shape: string, seq: number, fields: Row): Row =>
    ({ shape, id: `${shape}-${seq}`, seq, role: "walk", call_id: `c${seq}`, selection_ref: `sel${seq}`, t: seq, writer: "walk-clone-test", input_refs: [root], ...fields })
  const handout = (root: string, seq: number) => from(root, "gitWorktree", seq, { cwd, repo: "some-vessel", branch: "dev", base: tree(7),
    super_base: tree(8), origin_url: "https://example.test/some-vessel.git", committed_tree: tree(1) })
  const read = (root: string, seq: number) => from(root, "fileContent", seq, { path, content: "a\n" })
  // each writer's request as a drafter writes one, and a clone asked for by the repository the root wants changed
  const requests = (root: string): Row[] => [
    { shape: "request", id: "rq-git_worktree", seq: 5000, role: "described", pointer: { type: "git_worktree", repo: "some-vessel" }, input_refs: [root] },
    { shape: "request", id: "rq-git_commit", seq: 4999, role: "described", pointer: { type: "git_commit", cwd, message: "m" }, input_refs: [root] },
    ...Object.keys(WRITERS).map((type, i) => ({ shape: "request", id: `rq-${type}`, seq: 5001 + i, role: "described",
      pointer: { type, path, old_string: "a", new_string: "b", content: "b", start_line: 1, end_line: 1, after_line: 1, text: "b", module: "m", specifier: "{ y }" }, input_refs: [root] })),
  ]
  const run = async (root: Row, extra: Row[]) => {
    const skipped: Row[] = []
    const base = root.id === "root-ask" ? [root, wanted] : [root]
    const pool = [...base, ...seeded, ...extra.map((r) => ({ ...r, seq: r.seq + 1000 })), ...requests(root.id)]
    const cands = await applicable(pool, skipped, Date.now(), { root: root.id }, { git_worktree: "gitWorktree", git_commit: "gitCommitResult", fs_read: "fileContent", ...WRITERS })
    const offered = (t: string) => cands.some((c) => c.id === `call/${t}`)
    return { offered, why: (t: string) => String(skipped.find((s) => s.id === `rq-${t}`)?.unserved ?? "") }
  }

  for (const root of [gap, ask]) {
    test(`[MUST-FAIL] with no clone, no writer is offered and each skip names git_worktree; the clone is (${root.shape} root)`, async () => {
      const r = await run(root, [read(root.id, 20)])
      expect(Object.keys(WRITERS).filter(r.offered)).toEqual([])
      for (const t of Object.keys(WRITERS)) expect(`${t}: ${r.why(t)}`).toContain("gitWorktree comes from a git_worktree call")
      expect(r.offered("git_worktree")).toBe(true)
    })

    test(`[GUARD] the git_ tools are not held for a clone: with none, git_commit is offered as before (${root.shape} root)`, async () => {
      expect((await run(root, [read(root.id, 20)])).offered("git_commit")).toBe(true)
    })

    test(`[GUARD] with the root's clone handed out, every writer is offered (${root.shape} root)`, async () => {
      const r = await run(root, [handout(root.id, 20), read(root.id, 21)])
      expect(Object.keys(WRITERS).filter((t) => !r.offered(t))).toEqual([])
    })
  }
})
