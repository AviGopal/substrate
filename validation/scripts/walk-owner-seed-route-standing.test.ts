// walk-owner-seed-route-standing.test.ts — the walk's route over the owner graph this seed actually writes. A route rule
// tested only on a synthetic owner graph missed the seed's real form: every change tool needs, in one group, a wanted
// change or an open gap, and a rule that cut that group after a refusal left every refused gap root with no route. The
// open gap is a standing fact (nothing makes a gap row), so it is read as it stands.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-attempt-explanation); its
// rows go through the walk's own applicable (repos/walk-vessel) with a gap root's rows in the forms the walk records
// them, and the route the walk names for the root (note.path) is read: before any verdict, and after the grader's r 0
// on the newest tree, with the gap row older than the verdict.
//
// SAFETY and NEEDS: loopback only (stub store), a private temp dir; reads repos/walk-vessel (run-glue-tests NEEDS).
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")
const APPLICABLE = join(ROOT, "repos/walk-vessel/src/applicable.ts")
// the calls' answers as discovery serves them (walk-owner-seed-commit-before-check)
const ANSWERS = { git_diff: "gitDiff", git_commit: "gitCommitResult", git_worktree: "gitWorktree", fs_read: "fileContent", fs_edit: "fileEditResult" }

const T = mkdtempSync(join(tmpdir(), "wos-route-"))
let seeded: Row[] = []
const realFetch = globalThis.fetch
let applicable: (pool: Row[], skipped?: Row[], now?: number, note?: Row, answers?: Record<string, string>) => Promise<unknown[]>

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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-routetest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
  Object.assign(process.env, { WALK_VESSEL_ID: "walk-route-test", WALK_PORT: "1", DISCOVERY_URL: "http://discovery.test", WALK_ENDPOINT: "http://walk.test", METABOB_API_KEY: "k" })
  globalThis.fetch = (async () => Response.json({ content: { vessels: [{ vesselId: "v", endpoint: "http://v.test" }] } })) as typeof fetch
  applicable = (await import(APPLICABLE)).applicable as any
})
afterAll(() => { globalThis.fetch = realFetch; rmSync(T, { recursive: true, force: true }) })

const t = (n: number) => String(n).repeat(40)
const cwd = "/trees/walk-trees/some-vessel-fixture-0001"
const gap = { shape: "gap", id: "root-gap", seq: 1010, role: "detector", gap_id: "failing-test-some-vessel-fixture", status: "open", repo: "some-vessel", input_refs: [] }
const from = (shape: string, seq: number, fields: Row): Row =>
  ({ shape, id: `${shape}-${seq}`, seq, role: "walk", call_id: `c${seq}`, selection_ref: `sel${seq}`, t: seq, writer: "walk-route-test", input_refs: [gap.id], ...fields })
const attempt = [
  from("gitWorktree", 1011, { cwd, repo: "some-vessel", branch: "dev", tree: t(1), committed_tree: t(1) }),
  from("fileContent", 1012, { cwd, path: `${cwd}/src/x.ts`, content: "export const x = 1\n" }),
  from("fileEditResult", 1013, { cwd, path: `${cwd}/src/x.ts`, ok: true }),
  from("gitCommitResult", 1014, { cwd, sha: t(4), tree: t(2), committed_tree: t(2), changed: ["src/x.ts"] }),
  from("gitDiff", 1015, { cwd, repo: "some-vessel", tree: t(2), check: { ran: true, passed: false, out: "error: expect(received).toBe(expected)" }, typecheck: { ran: true, passed: true, out: "" } }),
]
const refused = { shape: "land_verdict", id: "lv-1016", seq: 1016, role: "described", repo: "some-vessel", tree: t(2), typecheck_ran: true, r: 0,
  why: "the check did not pass", input_refs: [gap.id, "gitDiff-1015"] }
const route = async (extra: Row[]): Promise<Row | undefined> => {
  const note: Row = { root: gap.id }
  await applicable([...seeded, gap, ...extra], [], Date.now(), note, ANSWERS)
  return note.path
}

describe("the route over the seed's owner graph, for a gap root", () => {
  test("[GUARD] before any verdict, the root has a route to its landing", async () => {
    const path = await route(attempt)
    expect(path?.call).toBe("git_land")
    expect(path).not.toHaveProperty("broken")
  })

  test("[MUST-FAIL] after the grader's r 0 on the newest tree, with the open gap older than it, the root still has a route, through a new edit", async () => {
    const path = await route([...attempt, refused])
    expect(path?.call).toBe("git_land")
    expect(path?.broken).toBeUndefined()
    // a new diff needs a new commit, a new commit a new edit: the edit side is on the route
    expect(path?.calls).toEqual(expect.arrayContaining(["git_commit", "git_diff", "fs_edit"]))
  })
})
