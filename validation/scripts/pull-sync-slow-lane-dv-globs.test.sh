#!/usr/bin/env bash
# development-vessel's slow lane (scripts/substrate/substrate-pull-sync.sh, PULLSYNC_SLOW_TEST_GLOBS_DEFAULT and
# slow_test_globs). Its one-process suite ran ~575-751 s unloaded and was killed at the per-run cap under load, so the
# two-run overlay never fit a tick and the vessel stayed budget-starved; the default named a slow list for
# activity-api only, and the shaped string row cannot be written. The default now names development-vessel's ten
# slowest files.
#   (a) MUST-FAIL: slow_test_globs development-vessel returns exactly the ten files, in order
#   (b) MUST-FAIL: slow_split puts exactly those ten in the slow set of a development-vessel-shaped tree, the rest fast
#   (c) CONTROL: activity-api's entry is unchanged, verbatim
#   (d) CONTROL: a vessel the default does not name has no slow list
# usage: validation/scripts/pull-sync-slow-lane-dv-globs.test.sh [path/to/substrate-pull-sync.sh]
set -uo pipefail
SCRIPT="${1:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/substrate/substrate-pull-sync.sh}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
{
  grep '^PULLSYNC_SLOW_TEST_GLOBS_DEFAULT=' "$SCRIPT"
  sed -n '/^slow_test_globs() {/,/^}/p' "$SCRIPT"
  sed -n '/^slow_split() {/,/^}/p' "$SCRIPT"
} > "$T/fns.sh"
# shellcheck disable=SC1090
source "$T/fns.sh"
tuning_param() { TP_VALUE="$2"; }   # no shaped row: the default
DV="test/lib/self-call-auth-sweep.test.ts,test/resolvers/feature-compose-semantic-gate-unconditional.test.ts,test/drafter-split/f8-time-bound.test.ts,test/drafter/v1-prompts.test.ts,test/drafter-split/f6-behaviour-preservation.test.ts,test/drafter-split/verdict-diff.golden.test.ts,test/drafter-split/f1-adversarial-module.test.ts,test/resolvers/gap-check-supply-site-mutation.test.ts,test/drafter-split/f10-variant-allowlist.test.ts,test/resolvers/gap-check-supply-region-pair-5e69d7a0.test.ts"
AA='*.real*.test.ts,*.scale.test.ts,test/trace-list-bounded-newest-first.test.ts'

slow_test_globs development-vessel
[ "$SLOW_GLOBS" = "$DV" ] && ok "(a) development-vessel's slow list is the ten files" || bad "(a) development-vessel's slow list is '${SLOW_GLOBS}'"

# (b) a tree with the ten slow files and two fast ones
mkdir -p "$T/dv"
IFS=',' read -ra _l <<< "$DV"
for f in "${_l[@]}" test/fast-one.test.ts test/drafter/v2-prompts.test.ts; do mkdir -p "$T/dv/$(dirname "$f")"; : > "$T/dv/$f"; done
SLOW_GLOBS="$DV"
_slow="$(slow_split "$T/dv" slow | sed 's|^\./||' | LC_ALL=C sort)"
_want="$(printf '%s\n' "${_l[@]}" | LC_ALL=C sort)"
_fast="$(slow_split "$T/dv" fast | sed 's|^\./||' | LC_ALL=C sort | tr '\n' ' ')"
slow_test_globs development-vessel
[ -n "$SLOW_GLOBS" ] && [ "$_slow" = "$_want" ] && [ "$_fast" = "test/drafter/v2-prompts.test.ts test/fast-one.test.ts " ] \
  && ok "(b) the split puts exactly the ten in the slow set" || bad "(b) split: slow=[$(printf '%s' "$_slow" | tr '\n' ' ')] fast=[$_fast] default=[$SLOW_GLOBS]"

slow_test_globs activity-api
[ "$SLOW_GLOBS" = "$AA" ] && ok "(c) control: activity-api's entry is verbatim" || bad "(c) activity-api's slow list changed: '$SLOW_GLOBS'"
slow_test_globs concept-db
[ -z "$SLOW_GLOBS" ] && ok "(d) control: an unnamed vessel has no slow list" || bad "(d) concept-db got '$SLOW_GLOBS'"

echo
[ "$FAILS" -eq 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAIL"; exit 1; }
