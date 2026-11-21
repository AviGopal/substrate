#!/usr/bin/env bash
# gate-fixture-walk-owner-seed-wait-bound.test.sh: walk-owner-seed-wait-bound.sh notices a seeder that writes no bound
# on a walk's wait, or one that bounds nothing.
#   (a) CONTROL: the committed tree passes the fixture
#   (b) must-fail: the seeder with `exit 99` after line 1 (the coverage map's script mutation)
#   (c) must-fail: the wait_bound row dropped
#   (d) must-fail: within_ms 0
#   (e) must-fail: within_ms as a string
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FX="$ROOT/validation/scripts/gate/fixtures/walk-owner-seed-wait-bound.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/wos-wait-bound.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
S=scripts/substrate
mk() { rm -rf "$T/c"; mkdir -p "$T/c/$S"; cp "$ROOT/$S/walk-owner-seed.ts" "$T/c/$S/"; }
run() { CANDIDATE_DIR="$T/c" TMPDIR="$T" bash "$FX" > "$T/out" 2>&1; }
red() { if ! run; then ok "$1 is refused: $(grep -m1 '^FAIL - ' "$T/out" | cut -c1-140)"; else bad "$1 passed the fixture"; fi; }
# Replace one exact text in the candidate seeder, and fail the test (not the fixture) when the text is not there.
sub() { bun -e 'const [f,a,b]=process.argv.slice(1); const s=await Bun.file(f).text(); if (s.split(a).length!==2) { console.error("anchor: "+a); process.exit(3) } await Bun.write(f, s.replace(a,()=>b))' "$T/c/$S/walk-owner-seed.ts" "$1" "$2" || { bad "mutant anchor missing: $1"; return 1; }; }
ROW='await ensure({ shape: "wait_bound", within_ms: 900_000 }, {}, "wait_bound");'

mk; run && ok "(a) control: the committed seeder passes" || { bad "(a) control failed: $(head -3 "$T/out")"; echo "$FAILS failure(s)"; exit 1; }
mk; sed -i '1a exit 99' "$T/c/$S/walk-owner-seed.ts"; red "(b) a seeder that exits 99 after line 1"
mk; sub "$ROW" '' && red "(c) a seeder that writes no wait_bound"
mk; sub "within_ms: 900_000 }" 'within_ms: 0 }' && red "(d) a seeder whose bound is 0"
mk; sub "within_ms: 900_000 }" 'within_ms: "900000" }' && red "(e) a seeder whose bound is a string"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS failure(s)"; exit 1; }
