// walk-owner-seed-commit-before-check.test.ts — a diff waits for a commit of the clone's newest edit (the "Commit before
// checking" ruling). git_diff reads commits only, so an applied edit newer than every commit is diffed as the tree
// before it. The owner seed says so in rows the walk reads: git_diff requires a gitCommitResult or a gitWorktree whose
// committed_tree is the clone's newest committed tree (x-latest over commits and edits, the clone located by its
// handout), so after an edit the step named is git_commit. Nothing about what git_diff answers or how it is graded
// changes, and what a landing and its verdict read (the clone's newest tree) is left as it was.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-newest-tree.test.sh).
//   rows: the two requires rows, exactly; every other x-latest the seed writes is the newest-tree value it wrote
//     before, in as many places; gitDiff's news_key adds uncommitted.
//   behaviour: the seeded owner rows go through the walk's own applicable (repos/walk-vessel) with a root's rows in the
//     forms the walk records them (a clean clone handed out on a refresh, an applied edit, an edit found already made),
//     with values made up: a clean clone is diffed as before; after an applied edit the diff waits and git_commit is
//     offered; a commit newer than the edit opens the diff again; an edit found already made changes nothing. Each
//     kind of applied edit moves the clone; each clone's own newest row is read; a gap opened again reads the clone of
//     the gap it continues; a refused commit waits for news (a refresh). Whether a commit is offered at all (only when
//     there is something to commit) is walk-owner-seed-commit-needs-edit's.
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
const COMMITTED = { "x-latest": { shapes: ["gitCommitResult", "gitWorktree", ...EDITS], moves: ["gitCommitResult", ...EDITS],
  at: ["gitWorktree"], same: "cwd", field: "committed_tree", continues: "gap_id" } }
const NEWEST = { "x-latest": { shapes: ["gitCommitResult", "gitWorktree", "gitDiff"], moves: ["gitCommitResult", "gitWorktree"],
  same: "cwd", field: "tree", continues: "gap_id" } }
// how many places the seed writes the newest-tree value: the 7 before this change, each left as it was, and the 4 of
// attempt_explanation (both variants read the newest tree's diff and the verdict on it)
const NEWEST_PLACES = 11

const T = mkdtempSync(join(tmpdir(), "wos-commit-"))
let seeded: Row[] = []

// every x-latest value anywhere in a row, with the row it is in
const latests = (rows: Row[]): Array<{ row: Row; value: unknown }> => {
  const out: Array<{ row: Row; value: unknown }> = []
  const walk = (v: unknown, row: Row): void => {
    if (Array.isArray(v)) { for (const x of v) walk(x, row); return }
    if (typeof v !== "object" || v === null) return
    if ("x-latest" in v) { out.push({ row, value: v }); return }
    for (const x of Object.values(v)) walk(x, row)
  }
  for (const r of rows) walk(r, r)
  return out
}

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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-committest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

describe("the seed's rows", () => {
  test("[MUST-FAIL] git_diff requires a commit or a clean handout naming the clone's newest committed tree: two rows, one group", () => {
    const req = seeded.filter((r) => r.shape === "requires" && r.for === "git_diff" && r.group === "committed")
      .map(({ id: _i, seq: _s, role: _r, input_refs: _x, ...rest }) => rest)
    expect(req).toEqual([
      { shape: "requires", for: "git_diff", needs: "gitCommitResult", where: { committed_tree: COMMITTED }, latest_by: "cwd", group: "committed" },
      { shape: "requires", for: "git_diff", needs: "gitWorktree", where: { committed_tree: COMMITTED }, latest_by: "cwd", group: "committed" },
    ])
  })

  test("[MUST-FAIL] the committed tree is read in those two rows only", () => {
    const committed = latests(seeded).filter((x) => JSON.stringify(x.value) === JSON.stringify(COMMITTED))
    expect(committed.map((x) => [x.row.for, x.row.needs])).toEqual([["git_diff", "gitCommitResult"], ["git_diff", "gitWorktree"]])
  })

  test("what a landing and its verdict read is left as it was: every other x-latest is the newest-tree value, in as many places as before", () => {
    const rest = latests(seeded).filter((x) => JSON.stringify(x.value) !== JSON.stringify(COMMITTED))
    expect(rest.map((x) => x.value)).toEqual(Array(NEWEST_PLACES).fill(NEWEST))
    const land = seeded.filter((r) => r.shape === "requires" && r.for === "git_land" && r.needs === "land_verdict").at(-1)
    expect(land?.where).toEqual({ r: 1, tree: NEWEST })
  })

  test("[MUST-FAIL] a diff whose uncommitted files differ is news: gitDiff's news_key names uncommitted", () => {
    const key = seeded.filter((r) => r.shape === "news_key" && r.of === "gitDiff").at(-1)
    expect(key?.fields).toEqual(["tree", "check.ran", "check.passed", "typecheck.ran", "typecheck.passed", "uncommitted"])
  })
})

describe("the walk reading them", () => {
  const realFetch = globalThis.fetch
  const served = new Set(["git_diff", "git_commit", "git_worktree", "fs_read", "fs_edit"])
  let applicable: (pool: Row[], skipped?: Row[], now?: number, note?: Row, answers?: Record<string, string>) => Promise<Array<{ id: string }>>
  beforeAll(async () => {
    Object.assign(process.env, { WALK_VESSEL_ID: "walk-commit-test", WALK_PORT: "1", DISCOVERY_URL: "http://discovery.test", WALK_ENDPOINT: "http://walk.test", METABOB_API_KEY: "k" })
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      const { pointer } = JSON.parse(String(init?.body)) as { pointer: Row }
      return Response.json({ content: { vessels: served.has(String(pointer.shape)) ? [{ vesselId: "v", endpoint: "http://v.test" }] : [] } })
    }) as typeof fetch
    applicable = (await import(APPLICABLE)).applicable as any
  })
  afterAll(() => { globalThis.fetch = realFetch })

  const tree = (n: number) => String(n).repeat(40)
  const cwd = "/trees/walk-trees/some-vessel-fixture-0001"
  // a root of each kind the walk serves: a detector's open gap, or a person's ask a model judged to want a change
  const gap = { shape: "gap", id: "root-gap", seq: 10, role: "detector", gap_id: "failing-test-some-vessel-fixture", status: "open", repo: "some-vessel", input_refs: [] }
  const ask = { shape: "world_changed", id: "root-ask", seq: 10, role: "person", input_refs: [] }
  const wanted = { shape: "change_wanted", id: "cw-ask", seq: 11, role: "described", wanted: true, repo: "some-vessel", input_refs: ["root-ask"] }
  // the forms the walk records (keys as on the live rows; values made up)
  const from = (root: string, shape: string, seq: number, fields: Row): Row =>
    ({ shape, id: `${shape}-${seq}`, seq, role: "walk", call_id: `c${seq}`, selection_ref: `sel${seq}`, t: seq, writer: "walk-commit-test", input_refs: [root], ...fields })
  const handout = (root: string, seq: number, t: string) => from(root, "gitWorktree", seq, { cwd, repo: "some-vessel", branch: "dev", base: tree(7),
    super_base: tree(8), origin_url: "https://example.test/some-vessel.git", refreshed_from: tree(6), head: tree(5), tree: t, committed_tree: t })
  // a fresh clone says its committed tree and no tree, head or refreshed_from key (only a refresh says the tree on
  // disk), and what an earlier clone held that was not carried over; a commit may likewise say only its committed tree.
  // An absent key is unknown, never a match and never "no newer commit".
  const fresh = (root: string, seq: number, t: string) => {
    const { tree: _t, refreshed_from: _r, head: _h, ...rest } = handout(root, seq, t)
    return { ...rest, not_carried: { conflicts: [], cwd, from: tree(6), why: "replaced" } }
  }
  const commitOnly = (root: string, seq: number, t: string) => {
    const { tree: _t, ...rest } = commit(root, seq, t)
    return rest
  }
  // a refresh that carried uncommitted edits says the tree on disk and no committed tree
  const dirty = (root: string, seq: number, t: string) => {
    const { committed_tree: _c, ...rest } = handout(root, seq, t)
    return { ...rest, carried: "uncommitted" }
  }
  const applied = (root: string, seq: number, shape = "fileEditResult") => from(root, shape, seq, { cwd, path: `${cwd}/src/x.ts`, ok: true, after: "a".repeat(64) })
  const already = (root: string, seq: number) => from(root, "fileEditResult", seq, { path: `${cwd}/src/x.ts`, ok: true, applied: false, after: "a".repeat(64) })
  // a commit as the walk records it: no root, ok, repo or branch key; what it changed, what waits on a person, its scan
  const commit = (root: string, seq: number, t: string) => from(root, "gitCommitResult", seq, { cwd, base: tree(7), sha: tree(4), tree: t,
    committed_tree: t, changed: ["src/x.ts", "src/y.ts"], needs_person: ["src/x.ts (protected)"], scan: "clean" })
  // a clone is asked for by its repository (the one the root wants changed), every other call by the clone
  const request = (root: string, type: string, seq: number) => ({ shape: "request", id: `rq-${type}`, seq, role: "described",
    pointer: { type, cwd, ...(type === "git_worktree" ? { repo: "some-vessel" } : {}) }, input_refs: [root] })
  // an edit request as a drafter writes one: the file it edits, and the read of that file it is made from
  const editOf = (root: string, seq: number) => ({ shape: "request", id: "rq-edit-x", seq, role: "described",
    pointer: { type: "fs_edit", cwd, path: `${cwd}/src/x.ts`, old_string: "a", new_string: "b" }, input_refs: [root] })
  const read = (root: string, seq: number) => from(root, "fileContent", seq, { path: `${cwd}/src/x.ts`, content: "a\n" })

  // a clone handed out before handouts said a committed tree: the refresh form with no committed_tree key
  const old = (root: string, seq: number, t: string) => {
    const { committed_tree: _c, ...rest } = handout(root, seq, t)
    return rest
  }
  // a template whose one call is git_diff on the clone (as a described template holding git_diff runs it)
  const diffTemplate = (seq: number) => ({ shape: "activity_template", id: "tpl-diff", seq, role: "described", input_refs: [],
    sig: { in: ["gitWorktree"], out: ["gitDiff"] }, calls: [{ shape: "git_diff", pointer: { cwd } }] })
  // another clone: the root's earlier one, or another root's
  const cwd2 = "/trees/walk-trees/some-vessel-fixture-0002"
  const elsewhere = (r: Row): Row => ({ ...r, cwd: cwd2 })
  // the walk's own record of a call made for a request: the request, its selection (for the root), and its hops; a call
  // the vessel refused ends in a failure blaming the request, one it answered in an ended hop carrying its answer
  const called = (root: string, n: number, type: string, output?: Row): Row[] => [
    { shape: "request", id: `rq-${type}-${n}`, seq: n, role: "described", pointer: { type, cwd }, input_refs: [root] },
    { shape: "selection", id: `sel-${n}`, seq: n + 1, role: "walk", a: `call/${type}`, from: `rq-${type}-${n}`, root, input_refs: [root] },
    { shape: "hop", id: `hop-s${n}`, seq: n + 2, role: "walk", phase: "started", kind: "call", call_id: `h${n}`, pointer_type: type, args: { cwd }, selection_ref: `sel-${n}`, input_refs: [root] },
    output === undefined
      ? { shape: "failure", id: `fail-${n}`, seq: n + 3, role: "walk", blames: "request", call_id: `h${n}`, selection_ref: `sel-${n}`, input_refs: [root] }
      : { shape: "hop", id: `hop-e${n}`, seq: n + 3, role: "walk", phase: "ended", kind: "call", call_id: `h${n}`, pointer_type: type, output, selection_ref: `sel-${n}`, input_refs: [root] },
  ]
  const run = async (root: Row, extra: Row[], also: string[] = []) => {
    const skipped: Row[] = []
    const base = root.id === "root-ask" ? [root, wanted] : [root]
    const pool = [...base, ...seeded.map((r) => ({ ...r, seq: r.seq })), ...extra.map((r) => ({ ...r, seq: r.seq + 1000 })),
      request(root.id, "git_diff", 5000), request(root.id, "git_commit", 5001), ...also.map((x, i) => request(root.id, x, 5002 + i))]
    const cands = await applicable(pool, skipped, Date.now(), { root: root.id }, { git_diff: "gitDiff", git_commit: "gitCommitResult", git_worktree: "gitWorktree", fs_read: "fileContent", fs_edit: "fileEditResult" })
    return { diff: cands.some((c) => c.id === "call/git_diff"), commit: cands.some((c) => c.id === "call/git_commit"),
      worktree: cands.some((c) => c.id === "call/git_worktree"), edit: cands.some((c) => c.id === "call/fs_edit"),
      template: cands.some((c) => c.id === "run/tpl-diff"), read: cands.some((c) => c.id === "call/fs_read"),
      why: String(skipped.find((s) => s.id === "rq-git_diff")?.unserved ?? "") }
  }

  for (const root of [gap, ask]) {
    const id = root.id
    // the walk's offer only: git_diff itself answers a clone with no commit since it was made with "no change to diff"
    test(`a clean clone handed out and not edited: the diff is offered as before (${root.shape} root)`, async () => {
      expect((await run(root, [handout(id, 20, tree(1))])).diff).toBe(true)
    })

    test(`[MUST-FAIL] after an applied edit the diff waits, git_commit is offered, and the step named is a commit (${root.shape} root)`, async () => {
      const r = await run(root, [handout(id, 20, tree(1)), applied(id, 30)])
      expect([r.diff, r.commit]).toEqual([false, true])
      expect(r.why).toContain("gitCommitResult comes from a git_commit call")
    })

    test(`[MUST-FAIL] a clone refreshed with uncommitted edits (its tree, no committed tree) waits for a commit (${root.shape} root)`, async () => {
      const r = await run(root, [dirty(id, 20, tree(1))])
      expect([r.diff, r.commit]).toEqual([false, true])
    })

    test(`a commit newer than the edit opens the diff again, on the commit's tree (${root.shape} root)`, async () => {
      expect((await run(root, [handout(id, 20, tree(1)), applied(id, 30), commit(id, 40, tree(2))])).diff).toBe(true)
    })

    test(`[MUST-FAIL] an edit found already made, after an applied one with no commit, still waits for the commit (${root.shape} root)`, async () => {
      const r = await run(root, [handout(id, 20, tree(1)), applied(id, 30), already(id, 35)])
      expect([r.diff, r.commit]).toEqual([false, true])
    })


    test(`[MUST-FAIL] a fresh clone (no tree key) then an applied edit with no commit: the diff waits, git_commit is offered (${root.shape} root)`, async () => {
      const r = await run(root, [fresh(id, 20, tree(1)), applied(id, 30)])
      expect([r.diff, r.commit]).toEqual([false, true])
    })

    test(`a fresh clone (no tree key), an applied edit, then a commit saying only its committed tree: the diff is offered (${root.shape} root)`, async () => {
      expect((await run(root, [fresh(id, 20, tree(1)), applied(id, 30), commitOnly(id, 40, tree(2))])).diff).toBe(true)
    })

    // A clone handed out before handouts said a committed tree, and not edited since, has nothing to diff (git_diff
    // refuses a clone with no commit since it was made) and nothing to commit: what moves it is an edit, after which a
    // commit says its committed tree. The edit stays offered.
    test(`[TRANSITION] a clone handed out with no committed_tree and not edited: the diff waits, a read and then an edit are offered (${root.shape} root)`, async () => {
      const r = await run(root, [old(id, 20, tree(1))], ["fs_read"])
      expect([r.diff, r.read]).toEqual([false, true])
      const e = await run(root, [old(id, 20, tree(1)), read(id, 25), editOf(id, 5100 - 1000)])
      expect([e.diff, e.edit]).toEqual([false, true])
    })

    test(`[MUST-FAIL] a template whose calls include git_diff waits for the commit too: an applied edit, no commit, not run (${root.shape} root)`, async () => {
      const r = await run(root, [handout(id, 20, tree(1)), applied(id, 30), diffTemplate(31)])
      expect([r.template, r.diff, r.commit]).toEqual([false, false, true])
    })

    test(`a template whose calls include git_diff runs on a clean clone as before (${root.shape} root)`, async () => {
      expect((await run(root, [handout(id, 20, tree(1)), diffTemplate(21)])).template).toBe(true)
    })

    test(`an edit found already made on a clean clone changes nothing: diffed as before (${root.shape} root)`, async () => {
      expect((await run(root, [handout(id, 20, tree(1)), already(id, 35)])).diff).toBe(true)
    })

    // every kind of applied edit moves the clone off its commit, not only an edit of a span
    for (const shape of EDITS) {
      test(`[MUST-FAIL] after an applied ${shape} the diff waits and git_commit is offered; a commit after it opens the diff (${root.shape} root)`, async () => {
        const r = await run(root, [handout(id, 20, tree(1)), commit(id, 25, tree(2)), applied(id, 30, shape)])
        expect([r.diff, r.commit]).toEqual([false, true])
        expect((await run(root, [handout(id, 20, tree(1)), commit(id, 25, tree(2)), applied(id, 30, shape), commit(id, 40, tree(3))])).diff).toBe(true)
      })
    }

    // Each clone's own newest row is read (latest_by cwd): another clone's newer row never hides this clone's. An
    // unknown committed tree meets nothing either way, so what tells the reading apart is a clone that IS committed.
    test(`[MUST-FAIL] this clone committed, then the root's other clone committed another tree later: this clone's diff is offered (${root.shape} root)`, async () => {
      const r = await run(root, [elsewhere(handout(id, 15, tree(8))), handout(id, 20, tree(1)), commit(id, 30, tree(2)), elsewhere(commit(id, 40, tree(3)))])
      expect(r.diff).toBe(true)
      expect((await run(root, [elsewhere(handout(id, 15, tree(8))), handout(id, 20, tree(1)), commit(id, 30, tree(2)), applied(id, 35), elsewhere(commit(id, 40, tree(3)))])).diff).toBe(false)
    })

    test(`[MUST-FAIL] a clean clone handed out, then another root's clone handed out later: this clone's diff is offered (${root.shape} root)`, async () => {
      expect((await run(root, [handout(id, 20, tree(1)), elsewhere(handout("root-other", 30, tree(9)))])).diff).toBe(true)
    })

    // What ends the wait when the commit has nothing to commit (an edit that put back the committed tree): git_commit,
    // refused, is not made again until something new comes; a refresh handing the clone out clean names its committed
    // tree, and the diff runs on it. Until then the refresh stays offered.
    test(`[MUST-FAIL] an applied edit whose commit was refused: the diff and git_commit wait, git_worktree is offered; a clean refresh after the edit opens the diff (${root.shape} root)`, async () => {
      const waiting = [handout(id, 20, tree(1)), applied(id, 30), ...called(id, 40, "git_commit")]
      const r = await run(root, waiting, ["git_worktree"])
      expect([r.diff, r.commit, r.worktree]).toEqual([false, false, true])
      expect((await run(root, [...waiting, handout(id, 50, tree(1))])).diff).toBe(true)
    })

  }

  // A gap opened again (the same gap_id, a newer root) has no handout of its own: it reads the clone of the root it
  // continues (continues gap_id), so a clone that root committed clean is diffed, and one it edited since waits.
  const again = { ...gap, id: "root-gap-again", seq: 1500 }
  test("[MUST-FAIL] a gap opened again reads the clone of the gap it continues: committed clean, the diff is offered", async () => {
    expect((await run(again, [gap, handout(gap.id, 20, tree(1)), commit(gap.id, 30, tree(2))])).diff).toBe(true)
  })

  test("a gap opened again whose continued clone was edited after its commit: the diff waits, git_commit is offered", async () => {
    const r = await run(again, [gap, handout(gap.id, 20, tree(1)), commit(gap.id, 30, tree(2)), applied(gap.id, 35)])
    expect([r.diff, r.commit]).toEqual([false, true])
  })
})
