#!/usr/bin/env bash
# walk-owner-seed-asks-stall-news.test.sh: the owner seed declares what an ask is, and writes the walk's stall rule and
# what makes a diff news (asks are the kind the owner declares; every other owner row is a setting the walk is given):
#   (a) the plain request schema's input is {shape: world_changed, ask: true}, and no other schema declares an ask
#   (b) one stall_rule: after_rows 240
#   (c) one news_key for gitDiff: its tree and whether each check ran and passed
#   (d) the seeder run again writes none of them again
# usage: validation/scripts/walk-owner-seed-asks-stall-news.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-askstall.XXXXXX")"; trap 'rm -rf "$T"' EXIT
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
const run = async () => { const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], { env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-askstalltest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" }); await p.exited }
await run()
const n1 = rows.length
await run()
const again = rows.slice(n1).filter((r) => ["stall_rule", "news_key"].includes(r.shape) || (r.shape === "shape_schema" && r.target === "request")).length
const last = (f: (r: Row) => boolean) => rows.filter(f).at(-1)
const req = last((r) => r.shape === "shape_schema" && r.target === "request" && !r.variant)
const asks = rows.filter((r) => r.shape === "shape_schema").flatMap((s) => [s.inputs ?? []].flat().filter((e: any) => e?.ask === true).map((e: any) => `${s.target}|${s.variant ?? ""}|${e.shape}`))
console.log(JSON.stringify({ reqInputs: req?.inputs ?? null, asks: [...new Set(asks)],
  stall: rows.filter((r) => r.shape === "stall_rule").map((r) => r.after_rows), news: rows.filter((r) => r.shape === "news_key").map((r) => [r.of, r.fields]), again }))
server.stop(true)
TS
OUT="$(TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
if [ "$(jq -c '.reqInputs' <<<"$OUT")" = '[{"shape":"world_changed","ask":true}]' ] && [ "$(jq -c '.asks' <<<"$OUT")" = '["request||world_changed"]' ]; then
  ok "(a) the request schema declares world_changed the ask, and no other schema declares one"
else bad "(a) $(jq -c '[.reqInputs, .asks]' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '.stall' <<<"$OUT")" = '[240]' ]; then ok "(b) one stall_rule, after_rows 240"; else bad "(b) stall: $(jq -c '.stall' <<<"$OUT")"; fi
if [ "$(jq -c '.news' <<<"$OUT")" = '[["gitDiff",["tree","check.ran","check.passed","typecheck.ran","typecheck.passed"]]]' ]; then
  ok "(c) one news_key for gitDiff: the tree and whether each check ran and passed"
else bad "(c) news: $(jq -c '.news' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '.again' <<<"$OUT")" = 0 ]; then ok "(d) run again, the seeder writes none of them again"; else bad "(d) again: $(jq -c '.again' <<<"$OUT")"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
