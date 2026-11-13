#!/usr/bin/env bash
# gate-fixture-walk-owner-seed-clone-repo.test.sh: walk-owner-seed-clone-repo.sh notices a seeder that lets a clone be
# made of a repository the root does not name, or binds a tool whose call has no repo.
#   (a) CONTROL: the committed tree passes the fixture
#   (b) must-fail: the seeder with `exit 99` after line 1 (the coverage map's script mutation)
#   (c) must-fail: no repo binding (the rows as they were)
#   (d) must-fail: every change tool bound to the call's repo
#   (e) must-fail: only the gap alternative bound, the change_wanted one left open to any repo
#   (f) must-fail: the change_wanted judge not told about super
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FX="$ROOT/validation/scripts/gate/fixtures/walk-owner-seed-clone-repo.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-clone.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
S=scripts/substrate
mk() { rm -rf "$T/c"; mkdir -p "$T/c/$S"; cp "$ROOT/$S/walk-owner-seed.ts" "$ROOT/$S/vessels.inventory.json" "$T/c/$S/"; }
run() { CANDIDATE_DIR="$T/c" TMPDIR="$T" bash "$FX" > "$T/out" 2>&1; }
red() { if ! run; then ok "$1 is refused: $(grep -m1 '^FAIL - ' "$T/out" | cut -c1-140)"; else bad "$1 passed the fixture"; fi; }
# Replace one exact text in the candidate seeder, and fail the test (not the fixture) when the text is not there.
sub() { bun -e 'const [f,a,b]=process.argv.slice(1); const s=await Bun.file(f).text(); if (s.split(a).length!==2) { console.error("anchor: "+a); process.exit(3) } await Bun.write(f, s.replace(a,()=>b))' "$T/c/$S/walk-owner-seed.ts" "$1" "$2" || { bad "mutant anchor missing: $1"; return 1; }; }

mk; run && ok "(a) control: the committed seeder passes" || { bad "(a) control failed: $(head -3 "$T/out")"; echo "$FAILS failure(s)"; exit 1; }
mk; sed -i '1a exit 99' "$T/c/$S/walk-owner-seed.ts"; red "(b) a seeder that exits 99 after line 1"
mk; sub '(tool === CLONE ? { repo: { "x-pointer": "repo" } } : {})' '({})' && red "(c) a seeder that binds no repo"
mk; sub '(tool === CLONE ? { repo: { "x-pointer": "repo" } } : {})' '({ repo: { "x-pointer": "repo" } })' && red "(d) a seeder that binds every change tool to a repo"
mk; sub 'where: { wanted: true, ...sameRepo(tool) }' 'where: { wanted: true }' && red "(e) a seeder that leaves the change_wanted alternative open to any repo"
mk; sub $', or super when it is " +\n    "about the super-repo itself (its scripts, docs or configuration); ' ', when there is one; ' && red "(f) a change_wanted judge not told about super"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
