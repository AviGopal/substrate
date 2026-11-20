// walk-owner-seed-gap-words.test.ts — a gap row reads as its summary. The surface draws a row by the words its owner's
// shape_description names, else the view entry's, else none, and a row with none is drawn as its shape and time
// (repos/human-surface-vessel/src/row-words.ts). The gap description named no words, so a view listing gap rows with
// no words of its own drew each as the bare word "gap". The owner seed now names summary, the field a detector writes
// to say what failed.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store (the drive of walk-owner-seed-commit-before-check).
//   rows: the gap description names words ["summary"] and keeps what it said before (detector-written, its text); the
//     other shown rows' words are as they were.
//   behaviour: the seeded shape_description rows go through the surface's own reader (row-words.ts) with a gap row in
//     the form a detector writes it, values made up: its words are its summary; with no declarations, none.
//   update: run against a store already holding a gap description with no words (a node seeded before), the seed
//     writes one newer gap description with words, and the reader takes it.
//
// SAFETY and NEEDS: loopback only (the stub store), a private temp dir; reads repos/human-surface-vessel
// (run-glue-tests NEEDS).
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
const ROOT = resolve(import.meta.dir, "../..")
const SEED = join(ROOT, "scripts/substrate/walk-owner-seed.ts")
const INVENTORY = join(ROOT, "scripts/substrate/vessels.inventory.json")
const ROW_WORDS = join(ROOT, "repos/human-surface-vessel/src/row-words.ts")

const T = mkdtempSync(join(tmpdir(), "wos-gapwords-"))
let seeded: Row[] = []
let updated: Row[] = []
// the gap description as a node holds it from before this seed named words
const OLD_GAP = { shape: "shape_description", of: "gap", written_by_role: "detector", input_refs: [], role: "owner", id: "o-old", seq: 1,
  description: "A check a detector made failed (an older text)." }

// the seed of this tree, run once against a stub store holding `start`; answers every row the store then holds
const seedInto = async (start: Row[]): Promise<Row[]> => {
  const rows: Row[] = [...start]
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
    const p = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row
    if (p.type === "record_read") return Response.json(rows.filter((r) => r.shape === p.shape).filter((r) => Object.entries((p.where ?? {}) as Row).every(([k, v]) => String(r[k]) === String(v))))
    if (p.type === "record_write") { const r = { ...p.row, id: `o${rows.length + 1}`, seq: rows.length + 1, role: p.role }; rows.push(r); return Response.json(r) }
    return Response.json({ error: "Not found", shape: p.type }, { status: 404 })
  } })
  const p = Bun.spawn([process.execPath, join(T, "walk-owner-seed.ts")], { env: { PATH: process.env.PATH ?? "",
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-gapwords-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  return rows
}

beforeAll(async () => {
  // the seed reads its inventory beside itself
  await Bun.write(join(T, "walk-owner-seed.ts"), Bun.file(SEED))
  await Bun.write(join(T, "vessels.inventory.json"), Bun.file(INVENTORY))
  seeded = await seedInto([])
  updated = await seedInto([OLD_GAP])
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

const described = (): Row[] => seeded.filter((r) => r.shape === "shape_description")
const latestOf = (of: string): Row | undefined => described().filter((r) => r.of === of).at(-1)

describe("the seed's rows", () => {
  test("[MUST-FAIL] the gap description names summary as its words, and still says what it said", () => {
    const gap = latestOf("gap")
    expect(gap?.words).toEqual(["summary"])
    expect(gap?.written_by_role).toBe("detector")
    expect(String(gap?.description)).toStartWith("A check a detector made failed")
    expect(described().filter((r) => r.of === "gap")).toHaveLength(1)
  })

  test("the other shown rows' words are as they were", () => {
    expect(latestOf("world_changed")?.words).toEqual(["what"])
    expect(latestOf("answer")?.words).toEqual(["text"])
    expect(latestOf("outcome")?.words).toEqual(["r"])
  })
})

describe("the surface's reader, over the seeded rows", () => {
  const gapRow = { shape: "gap", gap_id: "g-one", status: "open", category: "failing-test", severity: "medium", repo: "walk-vessel",
    summary: "two tests in one file fail", meta: { tests: 2 } }

  test("[MUST-FAIL] a gap row's words are its summary, not nothing (drawn as the bare shape)", async () => {
    const { declaredWords, rowWords, wordsFor } = await import(ROW_WORDS)
    const declared = declaredWords(described())
    expect(rowWords(gapRow, wordsFor("gap", declared, undefined))).toEqual([{ field: "summary", value: "two tests in one file fail" }])
  })

  test("control: with no declaration a gap row has no words", async () => {
    const { rowWords, wordsFor } = await import(ROW_WORDS)
    expect(rowWords(gapRow, wordsFor("gap", new Map(), undefined))).toEqual([])
  })
})

describe("a node holding the gap description from before words", () => {
  test("[MUST-FAIL] the seed writes one newer gap description with words; the surface's reader takes it", async () => {
    const gaps = updated.filter((r) => r.shape === "shape_description" && r.of === "gap")
    expect(gaps).toHaveLength(2)
    expect(gaps[0]).toBe(OLD_GAP)
    expect(gaps[1]?.words).toEqual(["summary"])
    const { declaredWords } = await import(ROW_WORDS)
    expect(declaredWords(updated.filter((r) => r.shape === "shape_description")).get("gap")).toEqual(["summary"])
  })
})
