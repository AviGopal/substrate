#!/usr/bin/env bash
# walk-owner-seed-newest-tree.test.sh: the owner seed binds a landing to the clone's newest tree (the newest-tree
# landing ruling): git_land requires a land_verdict at r 1 on that tree, and land_verdict (plain and gap) judges only a gitDiff of
# that tree a tool recorded. The tree is the owner's x-latest value, read by the walk and described alike.
#   (a) the requires row for git_land on land_verdict names r 1 and tree as the x-latest value
#   (b) both land_verdict schemas take a gitDiff where tree is the x-latest value and role is walk
# usage: validation/scripts/walk-owner-seed-newest-tree.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-newest.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
command -v bun >/dev/null || { echo "FAIL - no bun: cannot judge"; exit 1; }
cat > "$T/drive.ts" <<'TS'
type Row = Record<string, any>
const [seed, inv] = process.argv.slice(2)
const rows: Row[] = []
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } })
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (req) => {
  const p = (((await req.json().catch(() => ({}))) as Row).pointer ?? {}) as Row
  if (p.type === "record_read") return json(rows.filter((r) => r.shape === p.shape).filter((r) => Object.entries((p.where ?? {}) as Row).every(([k, v]) => String(r[k]) === String(v))))
  if (p.type === "record_write") { const r = { ...p.row, id: `r${rows.length + 1}`, seq: rows.length + 1, role: p.role }; rows.push(r); return json(r) }
  return json({ error: "Not found", shape: p.type }, 404)
} })
const dir = `${process.env.TMPDIR}/run-${Math.random().toString(36).slice(2)}`
await Bun.write(`${dir}/walk-owner-seed.ts`, Bun.file(seed))
await Bun.write(`${dir}/vessels.inventory.json`, Bun.file(inv))
const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], { env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-newesttest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
await p.exited
const last = (f: (r: Row) => boolean) => rows.filter(f).at(-1)
const req = last((r) => r.shape === "requires" && r.for === "git_land" && r.needs === "land_verdict")
const lv = ["", "gap"].map((v) => last((r) => r.shape === "shape_schema" && r.target === "land_verdict" && String(r.variant ?? "") === v))
console.log(JSON.stringify({ req: req?.where ?? null, inputs: lv.map((s) => (s?.inputs ?? []).find((e: any) => e?.shape === "gitDiff") ?? null) }))
server.stop(true)
TS
OUT="$(TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
XL='{"x-latest":{"shapes":["gitCommitResult","gitWorktree","gitDiff"],"moves":["gitCommitResult","gitWorktree"],"same":"cwd","field":"tree","continues":"gap_id"}}'
if [ "$(jq -c '.req.r' <<<"$OUT")" = 1 ] && [ "$(jq -c '.req.tree' <<<"$OUT")" = "$XL" ]; then
  ok "(a) git_land requires a land_verdict at r 1 on the clone's newest tree"
else bad "(a) requires where: $(jq -c '.req' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '[.inputs[] | .where.tree] | unique' <<<"$OUT")" = "[$XL]" ] && [ "$(jq -c '[.inputs[] | .where.role]' <<<"$OUT")" = '["walk","walk"]' ]; then
  ok "(b) both land_verdict schemas judge only a tool-recorded gitDiff of the clone's newest tree"
else bad "(b) inputs: $(jq -c '.inputs' <<<"$OUT" | cut -c1-300)"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
