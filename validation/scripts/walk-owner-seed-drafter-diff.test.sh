#!/usr/bin/env bash
# walk-owner-seed-drafter-diff.test.sh: the request's producer (who drafts each edit) is shown the clone's newest diff with
# what its check said (the drafter-context ruling), whole (the check follows the diff text in the row), kept and listed after the
# clone (described fits kept rows in the owner's order, so the diff never pushes the clone out), covering the git_diff
# call's own hop:
#   (a) MUST-FAIL: both request variants' context holds {shape: gitDiff, latest_by: shape, where: {tree: x-latest,
#       role: walk}, whole: true, keep: true, covers: {shape: hop, on: call_id}}, after the gitWorktree entry
#   (b) the entries before it are as before, in order
# usage: validation/scripts/walk-owner-seed-drafter-diff.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-drafterdiff.XXXXXX")"; trap 'rm -rf "$T"' EXIT
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
const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], { env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-drafterdifftest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
await p.exited
const last = (f: (r: Row) => boolean) => rows.filter(f).at(-1)
const req = ["", "gap"].map((v) => last((r) => r.shape === "shape_schema" && r.target === "request" && String(r.variant ?? "") === v))
console.log(JSON.stringify({ ctx: req.map((s) => s?.context ?? null) }))
server.stop(true)
TS
OUT="$(TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
XL='{"x-latest":{"shapes":["gitCommitResult","gitWorktree","gitDiff"],"moves":["gitCommitResult","gitWorktree"],"same":"cwd","field":"tree","continues":"gap_id"}}'
WANT='{"shape":"gitDiff","latest_by":"shape","where":{"tree":'"$XL"',"role":"walk"},"whole":true,"keep":true,"covers":{"shape":"hop","on":"call_id"}}'
if [ "$(jq -c '[.ctx[] | map(select(.shape? == "gitDiff"))]' <<<"$OUT")" = "[[$WANT],[$WANT]]" ]; then
  ok "(a) both request variants are shown the clone's newest diff, whole, kept, covering its hop"
else bad "(a) gitDiff entries: $(jq -c '[.ctx[] | map(select(.shape? == "gitDiff"))]' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '[.ctx[] | .[0:(to_entries | map(select((.value | type) == "object" and .value.shape == "gitDiff")) | .[0].key)] | map(if type == "string" then . else .shape end)]' <<<"$OUT")" = '[["hop","failure","answer","outcome","fileContent","gitWorktree","change_wanted","gitCommitResult","request_acts"],["hop","failure","answer","outcome","fileContent","gitWorktree","change_wanted","gitCommitResult","request_acts"]]' ]; then
  ok "(b) the entries before it are as before"
else bad "(b) $(jq -c '[.ctx[] | .[0:(to_entries | map(select((.value | type) == "object" and .value.shape == "gitDiff")) | .[0].key)] | map(if type == "string" then . else .shape end)]' <<<"$OUT" | cut -c1-300)"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
