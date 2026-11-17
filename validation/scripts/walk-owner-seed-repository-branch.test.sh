#!/usr/bin/env bash
# walk-owner-seed-repository-branch.test.sh: every owner repository row names the branch its repository takes landings
# on, from the inventory (a unit's own `branch`, else branch_default). git_land refuses a landing on any other branch,
# and any landing for a repository whose row names none.
#   (a) the committed inventory: every repository row names branch_default
#   (b) a unit naming its own branch: that repository's row names it
#   (c) an inventory with no branch_default: rows name no branch
# usage: validation/scripts/walk-owner-seed-repository-branch.test.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-branch.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
command -v bun >/dev/null || { echo "FAIL - no bun: cannot judge"; exit 1; }
cat > "$T/drive.ts" <<'TS'
// Runs the seeder beside the given inventory against an in-memory records stand-in; prints the repository rows.
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
const p = Bun.spawn([process.execPath, `${dir}/walk-owner-seed.ts`], { env: { PATH: process.env.PATH ?? "", DISCOVERY_URL: `http://127.0.0.1:${server.port}`, METABOB_API_KEY: `mb-branchtest-${"k".repeat(32)}` }, stdout: "pipe", stderr: "pipe" })
await p.exited
console.log(JSON.stringify(rows.filter((r) => r.shape === "repository").map((r) => ({ repo: r.repo, branch: r.branch ?? null, units: r.units }))))
server.stop(true)
TS
SEED="$ROOT/scripts/substrate/walk-owner-seed.ts"; INV="$ROOT/scripts/substrate/vessels.inventory.json"
rows() { TMPDIR="$T" bun "$T/drive.ts" "$SEED" "$1" 2>/dev/null | tail -1; }
R="$(rows "$INV")"
if [ "$(jq -r '[.[] | select(.branch != "dev")] | length' <<<"$R")" = 0 ] && [ "$(jq -r 'length' <<<"$R")" -gt 1 ]; then
  ok "(a) every repository row names the inventory's branch_default (dev)"
else bad "(a) rows: $(jq -c '[.[] | [.repo, .branch]]' <<<"$R" | cut -c1-300)"; fi
jq '(.vessels[] | select(.repo == "walk-vessel")) += {branch: "main"}' "$INV" > "$T/own.json"
R="$(rows "$T/own.json")"
if [ "$(jq -r '[.[] | select(.repo == "walk-vessel")][0].branch' <<<"$R")" = main ] && [ "$(jq -r '[.[] | select(.repo == "records-vessel")][0].branch' <<<"$R")" = dev ]; then
  ok "(b) a unit's own branch names its repository's"
else bad "(b) rows: $(jq -c '[.[] | [.repo, .branch]]' <<<"$R" | cut -c1-300)"; fi
jq 'del(.branch_default)' "$INV" > "$T/none.json"
R="$(rows "$T/none.json")"
if [ "$(jq -r '[.[] | select(.branch != null)] | length' <<<"$R")" = 0 ] && [ "$(jq -r 'length' <<<"$R")" -gt 1 ]; then
  ok "(c) with no branch_default and none of their own, rows name no branch"
else bad "(c) rows: $(jq -c '[.[] | [.repo, .branch]]' <<<"$R" | cut -c1-300)"; fi
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; }
echo "$FAILS FAILED"; exit 1
