#!/usr/bin/env bash
# walk-owner-seed-due-context.test.sh: the deadline's producer is shown what its own request has met, so a deadline is
# set from what the request has done: its answer and grade, its acts, the calls the walk could not make for it, and its
# ended steps; and it reads the deadlines that request already missed, bound to that request alone:
#   (a) MUST-FAIL: the due schema's context is outcome (newest per role), answer (newest), request_acts (newest), failure
#       where kind skip (newest per request_ref), the first three kept in that order within a quarter of the context,
#       then the skips and ended call/run hops joined to their pointer_type, not kept
#   (b) MUST-FAIL: its reads keep the people's grades and add record_lapsed of due/answer bound to its inputs (x-inputs)
#   (c) its inputs are unchanged: world_changed alone
# usage: validation/scripts/walk-owner-seed-due-context.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-duecontext.XXXXXX")"; trap 'rm -rf "$T"' EXIT
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
const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], { env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-duecontexttest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
await p.exited
const last = (f: (r: Row) => boolean) => rows.filter(f).at(-1)
const due = last((r) => r.shape === "shape_schema" && r.target === "due")
console.log(JSON.stringify({ ctx: due?.context ?? null, reads: due?.reads ?? null, inputs: due?.inputs ?? null, share: due?.keep_share ?? null }))
server.stop(true)
TS
OUT="$(TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
WANT_CTX='[{"shape":"outcome","latest_by":"role","keep":true},{"shape":"answer","latest_by":"shape","keep":true},{"shape":"request_acts","latest_by":"shape","keep":true},{"shape":"failure","where":{"kind":"skip"},"latest_by":"request_ref"},{"shape":"hop","where":{"phase":"ended","kind":["call","run"]},"join":{"on":"call_id","take":["pointer_type"]}}]'
WANT_READS='[{"type":"record_read","shape":"outcome","where":{"role":"person"}},{"type":"record_lapsed","deadline_shape":"due","answer_shape":"answer","asks":{"x-inputs":true}}]'
if [ "$(jq -c '.ctx' <<<"$OUT")" = "$WANT_CTX" ]; then ok "(a) the due producer is shown its request's answer, grade, acts, skips and ended steps"
else bad "(a) due context: $(jq -c '.ctx' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '.reads' <<<"$OUT")" = "$WANT_READS" ]; then ok "(b) it reads people's grades and the request's own missed deadlines"
else bad "(b) due reads: $(jq -c '.reads' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '.share' <<<"$OUT")" = '0.25' ]; then ok "(a) its kept rows have a quarter of the context, fitted in the order listed"
else bad "(a) due keep_share: $(jq -c '.share' <<<"$OUT")"; fi
if [ "$(jq -c '.inputs' <<<"$OUT")" = '["world_changed"]' ]; then ok "(c) its inputs are the ask alone, as before"
else bad "(c) due inputs: $(jq -c '.inputs' <<<"$OUT")"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
