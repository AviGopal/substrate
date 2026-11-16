#!/usr/bin/env bash
# pull-sync-gap-reads-stored.test.sh: pull-sync reads gap rows as stored, never as records shows them.
#
# records shows a hold the owner reads as a fact as that fact on a default read (marked read_as_fact), and refuses a row
# carrying that mark (a view never becomes data). pull-sync keeps gap rows and writes them back (carry_gap_repo, the
# infra mark, the held-gap release), so each of its gap reads asks for rows as written (stored: true); one that did not
# would have its write-backs refused, and its selections (lift_held_gaps reads the hold in meta) would see the fact.
# Over the REAL script: every record_read of shape gap carries stored: true, and there is at least one.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="${PULLSYNC_SCRIPT:-$ROOT/scripts/substrate/substrate-pull-sync.sh}"
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
reads="$(grep -oE '"type":"record_read"[^}]*"shape":"gap"[^}]*\}' "$SCRIPT")"
n="$(printf '%s\n' "$reads" | grep -c . || true)"
bare="$(printf '%s\n' "$reads" | grep -vc '"stored":true' || true)"
[ "$n" -ge 1 ] && ok "pull-sync reads gap rows ($n reads)" || bad "no gap read found: the match no longer fits the script"
[ "$bare" = 0 ] && ok "[MUST-FAIL] every gap read asks for rows as stored" || bad "$bare of $n gap reads lack stored: true: $(printf '%s\n' "$reads" | grep -v '"stored":true' | head -2 | tr '\n' '|')"
[ "$FAILS" = 0 ] && echo "all ok" || { echo "$FAILS FAILED"; exit 1; }
