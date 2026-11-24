#!/usr/bin/env bash
# walk-owner-seed-asks-stall-news.test.sh: the owner seed declares what an ask is, and writes the walk's stall rule and
# what makes a diff news (asks are the kind the owner declares; every other owner row is a setting the walk is given):
#   (a) the plain request schema's input is {shape: world_changed, ask: true}, and no other schema declares an ask
#   (b) one stall_rule: after_rows 240, ends_after 3
#   (c) one news_key for gitDiff: its tree, whether each check ran and passed, and what the clone held uncommitted
#   (e) one news_key for fileEditResult: the edited path and the bytes it left there (after); the third is gap's
#       (walk-owner-seed-gap-news.test.ts reads its fields)
#   (f) each news_key is found by its own `of`: a store whose newest news_key is another shape's gets no second copy
#   (g) one rhythm naming the stall, every_ms 1800000, beside the detector's template rhythm, also on a store that
#       already holds the detector's (it does not stand for the stall's); a store whose owner already has a stall
#       rhythm (another value) gets none
#   (h) an owner's stall_rule naming ends_after (another value) is kept; one naming none gains ends_after 3 and keeps
#       its after_rows
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
// PRIOR=edit: the fileEditResult key already written, then a newer gitDiff key with other fields; PRIOR=diff: the gitDiff
// key already written, then a newer fileEditResult key with other fields
const nk = (id: string, of: string, fields: string[]) => ({ shape: "news_key", of, fields, id, seq: rows.length + 1, role: "owner", input_refs: [] })
if (process.env.PRIOR === "edit") rows.push(nk("p1", "fileEditResult", ["path", "after"]), nk("p2", "gitDiff", ["tree"]))
// PRIOR=stall: the owner's own stall rhythm, another value; PRIOR=detector: a store from before the stall rhythm, holding
// the detector's template rhythm only
if (process.env.PRIOR === "stall") rows.push({ shape: "rhythm", target: "stall", every_ms: 3_600_000, id: "p1", seq: 1, role: "owner", input_refs: [] })
if (process.env.PRIOR === "detector") rows.push({ shape: "rhythm", template: "t0", every_rows: 240, id: "p1", seq: 1, role: "owner", input_refs: [] })
// PRIOR=rule: the owner's own stall_rule with another ends_after; PRIOR=oldrule: a rule from before ends_after, with its
// own after_rows
if (process.env.PRIOR === "rule") rows.push({ shape: "stall_rule", after_rows: 240, ends_after: 5, id: "p1", seq: 1, role: "owner", input_refs: [] })
if (process.env.PRIOR === "oldrule") rows.push({ shape: "stall_rule", after_rows: 300, id: "p1", seq: 1, role: "owner", input_refs: [] })
if (process.env.PRIOR === "diff") rows.push(nk("p1", "gitDiff", ["tree", "check.ran", "check.passed", "typecheck.ran", "typecheck.passed", "uncommitted"]), nk("p2", "fileEditResult", ["path"]))
const planted = rows.length
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
const again = rows.slice(n1).filter((r) => ["stall_rule", "news_key"].includes(r.shape) || (r.shape === "rhythm" && r.target === "stall") || (r.shape === "shape_schema" && r.target === "request")).length
const last = (f: (r: Row) => boolean) => rows.filter(f).at(-1)
const req = last((r) => r.shape === "shape_schema" && r.target === "request" && !r.variant)
const asks = rows.filter((r) => r.shape === "shape_schema").flatMap((s) => [s.inputs ?? []].flat().filter((e: any) => e?.ask === true).map((e: any) => `${s.target}|${s.variant ?? ""}|${e.shape}`))
const written = (of: string) => rows.slice(planted, n1).filter((r) => r.shape === "news_key" && r.of === of).length
console.log(JSON.stringify({ editWrites: written("fileEditResult"), diffWrites: written("gitDiff"), reqInputs: req?.inputs ?? null, asks: [...new Set(asks)],
  stall: rows.filter((r) => r.shape === "stall_rule").map((r) => [r.after_rows, r.ends_after]),
  clock: rows.filter((r) => r.shape === "rhythm" && r.target !== undefined).map(({ id: _i, seq: _s, role: _r, input_refs: _x, ...rest }) => rest),
  templateRhythms: rows.filter((r) => r.shape === "rhythm" && r.template !== undefined).length, news: rows.filter((r) => r.shape === "news_key").map((r) => [r.of, r.fields]),
  // each news_key row as the seed wrote it, less what the store adds (id, seq, role) and its empty refs
  newsRows: rows.filter((r) => r.shape === "news_key" && !String(r.id).startsWith("p")).map(({ id: _i, seq: _s, role: _r, input_refs: _x, ...rest }) => rest), again }))
server.stop(true)
TS
OUT="$(TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
if [ "$(jq -c '.reqInputs' <<<"$OUT")" = '[{"shape":"world_changed","ask":true}]' ] && [ "$(jq -c '.asks' <<<"$OUT")" = '["request||world_changed"]' ]; then
  ok "(a) the request schema declares world_changed the ask, and no other schema declares one"
else bad "(a) $(jq -c '[.reqInputs, .asks]' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '.stall' <<<"$OUT")" = '[[240,3]]' ]; then ok "(b) one stall_rule, after_rows 240, ends_after 3"; else bad "(b) stall: $(jq -c '.stall' <<<"$OUT")"; fi
if [ "$(jq -c '[.news[] | select(.[0] == "gitDiff")]' <<<"$OUT")" = '[["gitDiff",["tree","check.ran","check.passed","typecheck.ran","typecheck.passed","uncommitted"]]]' ]; then
  ok "(c) one news_key for gitDiff: the tree, whether each check ran and passed, and what the clone held uncommitted"
else bad "(c) news: $(jq -c '.news' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '[.newsRows[] | select(.of == "fileEditResult")]' <<<"$OUT")" = '[{"shape":"news_key","of":"fileEditResult","fields":["path","after"]}]' ] && [ "$(jq -c '.news | length' <<<"$OUT")" = 3 ]; then
  ok "(e) one news_key for fileEditResult, exactly {of, fields: [path, after]} (nothing else on it: not retired); besides it only gitDiff's and gap's"
else bad "(e) news: $(jq -c '.news' <<<"$OUT" | cut -c1-300)"; fi
E="$(PRIOR=edit TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
D="$(PRIOR=diff TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
if [ "$(jq -c '[.editWrites, .diffWrites]' <<<"$E")" = '[0,1]' ] && [ "$(jq -c '[.diffWrites, .editWrites]' <<<"$D")" = '[0,1]' ]; then
  ok "(f) each news_key is found by its own of: no second copy when another shape's key is newer"
else bad "(f) edit-first $(jq -c '[.editWrites, .diffWrites]' <<<"$E") diff-first $(jq -c '[.diffWrites, .editWrites]' <<<"$D")"; fi
P="$(PRIOR=stall TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
U="$(PRIOR=detector TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
if [ "$(jq -c '.clock' <<<"$OUT")" = '[{"shape":"rhythm","target":"stall","every_ms":1800000}]' ] && [ "$(jq -c '.templateRhythms' <<<"$OUT")" = 1 ] \
  && [ "$(jq -c '.clock' <<<"$P")" = '[{"shape":"rhythm","target":"stall","every_ms":3600000}]' ] \
  && [ "$(jq -c '.clock' <<<"$U")" = '[{"shape":"rhythm","target":"stall","every_ms":1800000}]' ]; then
  ok "(g) one stall rhythm, every_ms 1800000, beside the detector's, also on a store that already has the detector's; an owner's own stall rhythm is kept"
else bad "(g) clock: $(jq -c '[.clock, .templateRhythms]' <<<"$OUT" | cut -c1-300) prior: $(jq -c '.clock' <<<"$P" | cut -c1-200) upgrade: $(jq -c '.clock' <<<"$U" | cut -c1-200)"; fi
K="$(PRIOR=rule TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
O="$(PRIOR=oldrule TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
if [ "$(jq -c '.stall' <<<"$K")" = '[[240,5]]' ] && [ "$(jq -c '.stall' <<<"$O")" = '[[300,null],[300,3]]' ]; then
  ok "(h) an owner's stall_rule naming ends_after is kept; one naming none gains ends_after 3 and keeps its after_rows"
else bad "(h) kept: $(jq -c '.stall' <<<"$K") upgrade: $(jq -c '.stall' <<<"$O")"; fi
if [ "$(jq -c '.again' <<<"$OUT")" = 0 ]; then ok "(d) run again, the seeder writes none of them again"; else bad "(d) again: $(jq -c '.again' <<<"$OUT")"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
