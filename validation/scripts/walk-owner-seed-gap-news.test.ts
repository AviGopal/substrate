// walk-owner-seed-gap-news.test.ts — what makes a gap news. A detector restating a gap with only its claim's or summary's
// wording changed told no producer anything, yet each restatement was its own root and a tree already refused was judged
// again on each. The owner names a news_key for gap (the walk's repeats weigh a detector's row by it only then): the
// fields the held-gap release and the failing-test generator write, where they keep them (status, localized, waits_for
// and check_runnable at top level; the rest under meta), and never the claim or the summary.
//
// WHAT IS JUDGED. The seed of this tree runs against a stub store; the newest news_key row of gap is read.
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
const T = mkdtempSync(join(tmpdir(), "wos-gapnews-"))
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
    DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-gapnews-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
  await p.exited
  server.stop(true)
  seeded = rows
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

describe("gap's news_key", () => {
  test("[MUST-FAIL] the owner names what makes a gap news: the fields its writers set, where they keep them", () => {
    const key = seeded.filter((r) => r.shape === "news_key" && r.of === "gap").at(-1)
    expect(key?.fields).toEqual(["gap_id", "status", "localized", "waits_for", "check_runnable",
      "meta.edit_site", "meta.localized_by", "meta.claim_rejected_by", "meta.unlocalized_by", "meta.operator_hold", "meta.operator_hold_reason",
      "meta.check_runnable", "meta.protected_files", "meta.sources", "meta.evidence_resolve.input.test_file", "meta.evidence_resolve.input.only_tests"])
  })
  test("[GUARD] never the wording: no claim, summary or stamp, and nothing under classification_metadata", () => {
    const fields = (seeded.filter((r) => r.shape === "news_key" && r.of === "gap").at(-1)?.fields ?? []) as string[]
    expect(fields.filter((f) => /claim$|summary|^t$|seq|writer|classification_metadata/.test(f))).toEqual([])
    expect(seeded.filter((r) => r.shape === "news_key").map((r) => r.of)).toEqual(["gitDiff", "fileEditResult", "gap"])
  })
})
