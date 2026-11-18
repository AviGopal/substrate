#!/usr/bin/env bash
# walk-owner-seed-clone-binding.test.sh: the owner seed says which clone a request holding clones of more than one repo
# binds when a template names none: the clone of the repo its own newest change_wanted names (walk applicable.ts, bind.ts).
#   (a) one clone_binding row, exactly {of: gitWorktree, by: [{shape: change_wanted, field: repo}]} (nothing else on it:
#       not retired, no other `by` entry)
#   (b) the seeder run again writes none again
#   (c) it is found by its own `of`: a store holding it and then a newer clone_binding of another `of` gets no second copy
#       (the walk reads the newest row for each `of`, so the other shape's row leaves this one in force)
#   (d) the newest row for its `of` decides: a store holding it and then a newer gitWorktree row with another `by` gets it
#       written again
# usage: validation/scripts/walk-owner-seed-clone-binding.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-clonebind.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
command -v bun >/dev/null || { echo "FAIL - no bun: cannot judge"; exit 1; }
cat > "$T/drive.ts" <<'TS'
type Row = Record<string, any>
const [seed, inv] = process.argv.slice(2)
const rows: Row[] = []
// PRIOR=other: this row already written, then a newer clone_binding of another `of`
const row = (id: string, x: Row) => ({ shape: "clone_binding", ...x, id, seq: rows.length + 1, role: "owner", input_refs: [] })
if (process.env.PRIOR === "same") rows.push(row("p1", { of: "gitWorktree", by: [{ shape: "change_wanted", field: "repo" }] }), row("p2", { of: "gitWorktree", by: [{ shape: "gap", field: "repo" }] }))
if (process.env.PRIOR === "other") rows.push(row("p1", { of: "gitWorktree", by: [{ shape: "change_wanted", field: "repo" }] }), row("p2", { of: "gitCommitResult", by: [{ shape: "gap", field: "repo" }] }))
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
const run = async () => { const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], { env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-clonebindtest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" }); await p.exited }
await run()
const n1 = rows.length
await run()
const mine = rows.slice(planted, n1).filter((r) => r.shape === "clone_binding")
console.log(JSON.stringify({
  // each clone_binding row as the seed wrote it, less what the store adds (id, seq, role) and its empty refs
  rows: mine.map(({ id: _i, seq: _s, role: _r, input_refs: _x, ...rest }) => rest),
  again: rows.slice(n1).filter((r) => r.shape === "clone_binding").length,
}))
server.stop(true)
TS
drive() { TMPDIR="$T" bun "$T/drive.ts" "$ROOT/scripts/substrate/walk-owner-seed.ts" "$ROOT/scripts/substrate/vessels.inventory.json" 2>/dev/null | tail -1; }
OUT="$(drive)"
if [ "$(jq -c '.rows' <<<"$OUT")" = '[{"shape":"clone_binding","of":"gitWorktree","by":[{"shape":"change_wanted","field":"repo"}]}]' ]; then
  ok "(a) one clone_binding: exactly {of: gitWorktree, by: [{shape: change_wanted, field: repo}]}"
else bad "(a) rows: $(jq -c '.rows' <<<"$OUT" | cut -c1-300)"; fi
if [ "$(jq -c '.again' <<<"$OUT")" = 0 ]; then ok "(b) run again, the seeder writes none again"; else bad "(b) again: $(jq -c '.again' <<<"$OUT")"; fi
P="$(PRIOR=other drive)"
if [ "$(jq -c '.rows | length' <<<"$P")" = 0 ]; then ok "(c) found by its own of: no second copy when another of's clone_binding is newer"
else bad "(c) wrote: $(jq -c '.rows' <<<"$P" | cut -c1-300)"; fi
Q="$(PRIOR=same drive)"
if [ "$(jq -c '.rows' <<<"$Q")" = '[{"shape":"clone_binding","of":"gitWorktree","by":[{"shape":"change_wanted","field":"repo"}]}]' ]; then ok "(d) a newer gitWorktree row saying otherwise is overwritten with the seed's row"
else bad "(d) wrote: $(jq -c '.rows' <<<"$Q" | cut -c1-300)"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
