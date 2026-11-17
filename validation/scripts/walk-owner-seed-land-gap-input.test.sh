#!/usr/bin/env bash
# walk-owner-seed-land-gap-input.test.sh: the land verdict of a gap's change is shown the gap as it stands now (its newest
# row of the gap_id), not every rewrite of it: git_land takes a grader's r 1 only from exactly the request and the diff,
# and a verdict shown five rewrites cites five gap rows.
#   (a) the gap variant's gap input is {shape: gap, latest_by: gap_id}
#   (b) its gitDiff input is unchanged (the clone's newest tree, role walk), and the plain variant is untouched
# usage: validation/scripts/walk-owner-seed-land-gap-input.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-landgap.XXXXXX")"; trap 'rm -rf "$T"' EXIT
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
const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], { env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-landgaptest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
await p.exited
const last = (f: (r: Row) => boolean) => rows.filter(f).at(-1)
const lv = ["", "gap"].map((v) => last((r) => r.shape === "shape_schema" && r.target === "land_verdict" && String(r.variant ?? "") === v))
console.log(JSON.stringify({ plain: lv[0]?.inputs ?? null, gap: lv[1]?.inputs ?? null }))
server.stop(true)
TS
OUT="$(TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
XL='{"x-latest":{"shapes":["gitCommitResult","gitWorktree","gitDiff"],"moves":["gitCommitResult","gitWorktree"],"same":"cwd","field":"tree","continues":"gap_id"}}'
DIFF='{"shape":"gitDiff","latest_by":"shape","where":{"tree":'"$XL"',"role":"walk"}}'
if [ "$(jq -c '.gap[0]' <<<"$OUT")" = '{"shape":"gap","latest_by":"gap_id"}' ]; then
  ok "(a) the gap variant is shown the gap as it stands now (latest_by gap_id)"
else bad "(a) gap inputs: $(jq -c '.gap' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '.gap[1]' <<<"$OUT")" = "$DIFF" ] && [ "$(jq -c '.plain' <<<"$OUT")" = '["world_changed",'"$DIFF"']' ]; then
  ok "(b) the diff input and the plain variant are unchanged"
else bad "(b) inputs: $(jq -c '[.plain, .gap]' <<<"$OUT" | cut -c1-300)"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
