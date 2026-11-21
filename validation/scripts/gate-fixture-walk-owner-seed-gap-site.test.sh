#!/usr/bin/env bash
# gate-fixture-walk-owner-seed-gap-site.test.sh: walk-owner-seed-gap-site.sh notices a seeder that offers the gap
# edit-site judgment on a gap some stack localized, or without a code search.
#   (a) CONTROL: the committed tree passes the fixture
#   (b) must-fail: the seeder with `exit 99` after line 1 (the coverage map's script mutation)
#   (c) must-fail: the gap input's where dropped (offered on any gap)
#   (d) must-fail: the codeSearchResult input dropped
#   (e) must-fail: a second gap input with no where beside the localized-false one
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FX="$ROOT/validation/scripts/gate/fixtures/walk-owner-seed-gap-site.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-gap-site.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
S=scripts/substrate
mk() { rm -rf "$T/c"; mkdir -p "$T/c/$S"; cp "$ROOT/$S/walk-owner-seed.ts" "$T/c/$S/"; }
run() { CANDIDATE_DIR="$T/c" TMPDIR="$T" bash "$FX" > "$T/out" 2>&1; }
red() { if ! run; then ok "$1 is refused: $(grep -m1 '^FAIL - ' "$T/out" | cut -c1-140)"; else bad "$1 passed the fixture"; fi; }
# Replace one exact text in the candidate seeder, and fail the test (not the fixture) when the text is not there.
sub() { bun -e 'const [f,a,b]=process.argv.slice(1); const s=await Bun.file(f).text(); if (s.split(a).length!==2) { console.error("anchor: "+a); process.exit(3) } await Bun.write(f, s.replace(a,()=>b))' "$T/c/$S/walk-owner-seed.ts" "$1" "$2" || { bad "mutant anchor missing: $1"; return 1; }; }
GAP='{ shape: "gap", latest_by: "gap_id", where: { localized: false } }'
CS=', { shape: "codeSearchResult", latest_by: "shape" }]'

mk; run && ok "(a) control: the committed seeder passes" || { bad "(a) control failed: $(head -3 "$T/out")"; echo "$FAILS failure(s)"; exit 1; }
mk; sed -i '1a exit 99' "$T/c/$S/walk-owner-seed.ts"; red "(b) a seeder that exits 99 after line 1"
mk; sub "$GAP" '{ shape: "gap", latest_by: "gap_id" }' && red "(c) a seeder that offers the judgment on any gap"
mk; sub "$CS" ']' && red "(d) a seeder that offers the judgment without a code search"
mk; sub "$GAP" "$GAP"', { shape: "gap", latest_by: "gap_id" }' && red "(e) a seeder that adds a gap input with no where"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
