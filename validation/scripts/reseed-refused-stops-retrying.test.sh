#!/usr/bin/env bash
# reseed-refused-stops-retrying.test.sh: when identity-vessel refuses the seed request itself (signup 400, e.g.
# WEAK_PASSWORD), seed-identity exits 3 and reseed-restart must stop at once and say so. It used to retry ten times,
# each logged as "identity-vessel DB likely still warming", and restart identity-vessel halfway through; a human reading
# that journal was sent after the wrong cause (measured 2026-10-12, podman install acceptance).
#   (a) MUST-FAIL: a seeder that exits 3 is run exactly once, and the loop says REFUSED
#   (b) control: a seeder that exits 1 is still retried (transient), and says "still warming"
#   (c) seed-identity maps a signup 400 to exit 3 and leaves other failures to the retryable throw
# The loop is extracted from reseed-restart with the bun path pointed at a stub; sleep and systemctl are stubbed.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="${1:-$HERE/../../scripts/substrate/reseed-restart.sh}"; S="${2:-$HERE/../../scripts/substrate/seed-identity.ts}"
T="$(mktemp -d "${TMPDIR:-/tmp}/reseed.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
awk '/^SEED_OK=0$/{on=1} on{print} on && /^fi$/{exit}' "$R" | sed "s#/root/.bun/bin/bun /vessels/seed-identity.ts#\"\$T/seeder\"#" > "$T/loop.sh"
grep -q 'T/seeder' "$T/loop.sh" && grep -q 'seq 1 10' "$T/loop.sh" || { echo "FAIL - could not extract the retry loop"; exit 1; }
run() { # $1 seeder exit code -> "<calls>|<log>"
  printf '#!/bin/sh\necho x >> "%s/calls"\nexit %s\n' "$T" "$1" > "$T/seeder"; chmod +x "$T/seeder"; : > "$T/calls"
  out="$( T="$T"; log() { echo "$*"; }; sleep() { :; }; systemctl() { :; }; . "$T/loop.sh" 2>&1 )"
  printf '%s|%s' "$(wc -l < "$T/calls" | tr -d ' ')" "$out"
}
r="$(run 3)"
[ "${r%%|*}" = 1 ] && ok "(a) a refused seed (exit 3) runs once" || bad "(a) a refused seed ran ${r%%|*} times"
case "${r#*|}" in *REFUSED*) ok "(a) and the log says REFUSED" ;; *) bad "(a) log does not say REFUSED" ;; esac
case "${r#*|}" in *"still warming"*) bad "(a) log still blames a warming DB" ;; *) ok "(a) the log does not blame a warming DB" ;; esac
r="$(run 1)"
[ "${r%%|*}" = 10 ] && ok "(b) a transient failure (exit 1) is retried 10 times" || bad "(b) a transient failure ran ${r%%|*} times"
case "${r#*|}" in *"still warming"*) ok "(b) and is logged as transient" ;; *) bad "(b) transient failure not logged as such" ;; esac
awk '/if \(!signupRes.ok\) \{/{on=1} on{print} on && /^  \}$/{exit}' "$S" > "$T/signup.ts"
grep -q 'signupRes.status === 400' "$T/signup.ts" && grep -q 'process.exit(3)' "$T/signup.ts" \
  && ok "(c) seed-identity exits 3 on a signup 400" || bad "(c) seed-identity does not map a signup 400 to exit 3"
grep -q 'throw new Error(`signup failed' "$T/signup.ts" && ok "(c) other signup failures still throw (retryable)" || bad "(c) the retryable throw is gone"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
