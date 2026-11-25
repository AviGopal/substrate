#!/usr/bin/env bash
# walk-owner-seed-attempt-outcome.test.sh: the request's producer is shown each attempt with its outcome. After the clone's
# newest diff, both request variants' context lists the verdict on that same newest tree, then the answer of every call the
# request's root made (by relation, not by shape name), each kept; the order is keep priority, so the named entries fit
# first and neither new entry can push them out:
#   (a) MUST-FAIL: the entry after gitDiff is {shape: land_verdict, latest_by: tree, where: {tree: x-latest, role:
#       described}, keep: true}, on the same x-latest the gitDiff entry uses, the grader's verdict only (a person's mark
#       grades the page, and a newer one on the tree would otherwise win latest_by and leave the grader's out)
#   (b) MUST-FAIL: the last entry is {answers_a_call: true, latest_by: call_id, keep: true}, and between it and the
#       verdict only the root's explanations of its refused attempts ({shape: attempt_explanation, keep: true}) and what
#       was installed ({shape: infra_window, latest_by: window_id}, not kept: it admits no call's answer, so its place
#       before the catch-all changes nothing either admits)
#   (c) the entries up to and including gitDiff are as listed, in order (the fs_edit miss and edit result entries, then
#       the bare failure entry, after request_acts: see walk-owner-seed-drafter-diff.test.sh (b))
# usage: validation/scripts/walk-owner-seed-attempt-outcome.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-attempt.XXXXXX")"; trap 'rm -rf "$T"' EXIT
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
const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], { env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-attempttest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
await p.exited
const last = (f: (r: Row) => boolean) => rows.filter(f).at(-1)
const req = ["", "gap"].map((v) => last((r) => r.shape === "shape_schema" && r.target === "request" && String(r.variant ?? "") === v))
console.log(JSON.stringify({ ctx: req.map((s) => s?.context ?? null) }))
server.stop(true)
TS
OUT="$(TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1)"
XL='{"x-latest":{"shapes":["gitCommitResult","gitWorktree","gitDiff"],"moves":["gitCommitResult","gitWorktree"],"same":"cwd","field":"tree","continues":"gap_id"}}'
LV='{"shape":"land_verdict","latest_by":"tree","where":{"tree":'"$XL"',"role":"described"},"keep":true}'
DK='{"answers_a_call":true,"latest_by":"call_id","keep":true}'
AE='{"shape":"attempt_explanation","keep":true}'
IW='{"shape":"infra_window","latest_by":"window_id"}'
AFTER='[.ctx[] | .[(to_entries | map(select((.value | type) == "object" and .value.shape == "gitDiff")) | .[0].key) + 1:]]'
if [ "$(jq -c "$AFTER | map(.[0])" <<<"$OUT")" = "[$LV,$LV]" ]; then
  ok "(a) both request variants list the grader's verdict on the diff's own newest tree right after the diff, kept"
else bad "(a) after gitDiff: $(jq -c "$AFTER" <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c "$AFTER" <<<"$OUT")" = "[[$LV,$AE,$IW,$DK],[$LV,$AE,$IW,$DK]]" ]; then
  ok "(b) the answer of every call the root made is listed last, newest per call, kept"
else bad "(b) after gitDiff: $(jq -c "$AFTER" <<<"$OUT" | cut -c1-300)"; fi
BEFORE='[.ctx[] | .[0:(to_entries | map(select((.value | type) == "object" and .value.shape == "gitDiff")) | .[0].key) + 1] | map(if type == "string" then . else .shape end)]'
if [ "$(jq -c "$BEFORE" <<<"$OUT")" = '[["hop","answer","outcome","fileContent","gitWorktree","change_wanted","gitCommitResult","request_acts","failure","fileEditResult","failure","gitDiff"],["hop","answer","outcome","fileContent","gitWorktree","change_wanted","gitCommitResult","request_acts","failure","fileEditResult","failure","gitDiff"]]' ]; then
  ok "(c) the entries up to the diff are as before"
else bad "(c) $(jq -c "$BEFORE" <<<"$OUT" | cut -c1-300)"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
