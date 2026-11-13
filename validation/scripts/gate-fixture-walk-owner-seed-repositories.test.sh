#!/usr/bin/env bash
# gate-fixture-walk-owner-seed-repositories.test.sh: walk-owner-seed-repositories.sh notices a seeder that does not give
# the change_wanted judge the fleet's repositories, and an inventory that names none.
#   (a) CONTROL: the committed tree passes the fixture
#   (b) must-fail: the inventory replaced with {} (the coverage map's JSON mutation)
#   (c) must-fail: the seeder with `exit 99` after line 1 (the coverage map's script mutation)
#   (d) must-fail: a seeder that writes no repository rows
#   (e) must-fail: a seeder that ignores the inventory's retired state
#   (f) must-fail: a change_wanted schema that does not show the repository rows
#   (g) must-fail: a seeder that does not retire a repository the inventory no longer names
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FX="$ROOT/validation/scripts/gate/fixtures/walk-owner-seed-repositories.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-repos.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
S=scripts/substrate
mk() { rm -rf "$T/c"; mkdir -p "$T/c/$S"; cp "$ROOT/$S/walk-owner-seed.ts" "$ROOT/$S/vessels.inventory.json" "$T/c/$S/"; }
run() { CANDIDATE_DIR="$T/c" TMPDIR="$T" bash "$FX" > "$T/out" 2>&1; }
red() { if ! run; then ok "$1 is refused: $(grep -m1 '^FAIL - ' "$T/out" | cut -c1-140)"; else bad "$1 passed the fixture"; fi; }
# Replace one exact text in the candidate seeder, and fail the test (not the fixture) when the text is not there.
sub() { bun -e 'const [f,a,b]=process.argv.slice(1); const s=await Bun.file(f).text(); if (s.split(a).length!==2) { console.error("anchor: "+a); process.exit(3) } await Bun.write(f, s.replace(a,b))' "$T/c/$S/walk-owner-seed.ts" "$1" "$2" || { bad "mutant anchor missing: $1"; return 1; }; }

mk; run && ok "(a) control: the committed seeder and inventory pass" || { bad "(a) control failed: $(head -3 "$T/out")"; echo "$FAILS failure(s)"; exit 1; }
mk; echo '{}' > "$T/c/$S/vessels.inventory.json"; red "(b) an inventory replaced with {}"
mk; sed -i '1a exit 99' "$T/c/$S/walk-owner-seed.ts"; red "(c) a seeder that exits 99 after line 1"
mk; sub '  for (const r of repos) await ensure(r, { repo: r.repo }, `repository ${r.repo}`);' '' && red "(d) a seeder that writes no repository rows"
mk; sub '    retired: us.every((u) => u.retired === true),' '    retired: false,' && red "(e) a seeder that ignores the retired state"
mk; sub '  context: [{ shape: "repository", latest_by: "repo" }],' '  context: [],' && red "(f) a change_wanted schema with no repository context"
mk; sub '      if (named.has(repo) || r.retired === true) continue;' '      continue;' && red "(g) a seeder that keeps a removed repository live"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
