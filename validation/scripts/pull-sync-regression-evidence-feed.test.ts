// pull-sync-regression-evidence-feed.test.ts — a test regression's gap, as pull-sync writes it, names a test the walk's
// land check finds. pull-sync turns the runner's "(fail) <name> [<ms>]" lines into bare names (fail_names, then
// regression_evidence); local-tools reads the gap's evidence (gapOf) and finds each name in the whole suite's report,
// where every name starts at its file (greenIn). Each side has legs with its own literal name; this one runs the two
// sides' own code on one real run, so a change to either's form of a name turns it red here, not live.
//
// WHAT IS JUDGED. A made-up project whose one test fails is run by bun; pull-sync's own fail_names and
// regression_evidence (cut from the script, as pull-sync-regression-evidence.test.sh does) turn that run's output into
// the gap's evidence; local-tools' gapOf reads it from a stub store; local-tools' own greenIn (cut from git-land.ts)
// judges the named test against bun's junit report of the base (red) and of a fixed tree (green).
//   [MUST-FAIL on a tree without regression_evidence] the evidence names the failing test, and greenIn finds it red on
//   the base and green on the fixed tree
//   [GUARD] a passing sibling of the failing test is not named
//
// SAFETY and NEEDS: no network, a private temp dir; reads repos/local-tools-vessel (run-glue-tests NEEDS).
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

type Row = Record<string, any>
type Run = { passed: Set<string> | null; failed: Map<string, string> }
const ROOT = resolve(import.meta.dir, "../..")
const PULL_SYNC = join(ROOT, "scripts/substrate/substrate-pull-sync.sh")
const GIT_LAND = join(ROOT, "repos/local-tools-vessel/src/git-land.ts")
const T = mkdtempSync(join(tmpdir(), "regev-feed-"))

const calc = (sum: string) => `import { describe, expect, test } from "bun:test"
const add = (a: number, b: number) => ${sum}
describe("add", () => {
  test("adds", () => { expect(add(2, 3)).toBe(5) })
  test("keeps zero", () => { expect(add(0, 0)).toBe(0) })
})
`
// a run of the project as the land check runs a suite: junit report, names from the file
const runOf = (tree: string, sum: string): { out: string; xml: string } => {
  const dir = join(T, tree)
  Bun.spawnSync(["mkdir", "-p", dir])
  writeFileSync(join(dir, "calc.test.ts"), calc(sum))
  const report = join(dir, "report.xml")
  const r = Bun.spawnSync([process.execPath, "test", "--reporter=junit", `--reporter-outfile=${report}`], { cwd: dir, env: { ...process.env, NO_COLOR: "1" } })
  return { out: `${r.stdout.toString()}${r.stderr.toString()}`, xml: readFileSync(report, "utf8") }
}
// a function of the script, cut from it by its first and last lines, run in bash
const shellFn = (name: string, indent: string): string => {
  const src = readFileSync(PULL_SYNC, "utf8").split("\n")
  const start = src.findIndex((l) => l.startsWith(`${indent}${name}() {`))
  if (start < 0) return ""
  const end = src.findIndex((l, i) => i > start && l === `${indent}}`)
  return end < 0 ? "" : src.slice(start, end + 1).join("\n")
}

let base: { out: string; xml: string }
let fixed: { out: string; xml: string }
let evidence: Row | null = null
let gap: Row | null = null
let greenIn: ((run: Run, n: string) => boolean) | null = null
let reportOf: (xml: string, withFile?: boolean) => { passed: Set<string>; failed: Map<string, string> }
beforeAll(async () => {
  base = runOf("base", "a - b")
  fixed = runOf("fixed", "a + b")
  const failNames = shellFn("fail_names", "  ")
  const regressionEvidence = shellFn("regression_evidence", "")
  writeFileSync(join(T, "out.txt"), base.out)
  const sh = Bun.spawnSync(["bash", "-c", `${failNames}\n${regressionEvidence}\nregression_evidence calc "$(fail_names "$(cat "$1")")"`, "feed", join(T, "out.txt")])
  if (failNames !== "" && regressionEvidence !== "" && sh.exitCode === 0) evidence = JSON.parse(sh.stdout.toString())
  const land = await import(GIT_LAND)
  reportOf = land.reportOf
  // the store the walk's call reads: its selection, whose root is the detector's gap carrying pull-sync's evidence
  const rows: Row[] = [{ id: "sel1", shape: "selection", root: "gap1" },
    { id: "gap1", shape: "gap", role: "detector", gap_id: "pull-sync-test-regression-calc", meta: { evidence_resolve: evidence } }]
  gap = await land.gapOf(async (q: { ids?: string[] }) => rows.filter((r) => (q.ids ?? []).includes(r.id)), "sel1")
  // greenIn is git-land's own, cut from the file and transpiled: the rule the land check applies, not a copy of it
  const text = readFileSync(GIT_LAND, "utf8")
  const m = /^const matches = [^\n]*\n/m.exec(text)
  const g = /^const greenIn = [\s\S]*?;\n/m.exec(text)
  if (m && g) {
    const js = new Bun.Transpiler({ loader: "ts" }).transformSync(`${m[0]}${g[0]}export { greenIn }`)
    greenIn = (await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`)).greenIn
  }
})
afterAll(() => rmSync(T, { recursive: true, force: true }))

describe("a regression's gap, from the runner's line to the land check's match", () => {
  test("[MUST-FAIL] the gap names the failing test, red on the base's report and green on the fixed tree's", () => {
    expect(base.out).toContain("(fail) add > adds")
    expect(gap).toMatchObject({ gap_id: "pull-sync-test-regression-calc", vessel: "calc", only_tests: ["add > adds"] })
    expect(greenIn).not.toBeNull()
    const names = (gap as { only_tests: string[] }).only_tests
    expect(names.some((n) => !greenIn!(reportOf(base.xml, true), n))).toBe(true)
    expect(names.every((n) => greenIn!(reportOf(fixed.xml, true), n))).toBe(true)
  })
  test("[GUARD] a test that passed on the base is not named", () => {
    expect((gap as { only_tests?: string[] } | null)?.only_tests ?? []).not.toContain("add > keeps zero")
  })
})
