#!/usr/bin/env bash
# kind: known-valid
# The candidate pull-sync can source its tracked-red predicate FROM THE CANDIDATE ARCHIVE
# (scripts/substrate/lib/gap-tracked-red.sh beside the body: the accepted/ layout gate-runner
# executes), with no share-dir fallback. A body that declares the gap-tracked-red loader but
# whose archive cannot satisfy it would run every promoted tick as a TRACKED-RED LIB MISSING
# no-op on every node, so it must never be promoted. A body without the loader has nothing to
# satisfy and passes. Run by shadow-eval.sh with PULLSYNC_BIN / CANDIDATE_DIR (see its header).
set -u
grep -q '^# >>> gap-tracked-red loader$' "$PULLSYNC_BIN" || { echo "ok - the candidate body has no gap-tracked-red loader"; exit 0; }
W="$(mktemp -d "${TMPDIR:-/tmp}/lib-sources.XXXXXX")" || { echo "FAIL - mktemp"; exit 1; }
trap 'rm -rf "$W"' EXIT
mkdir -p "$W/empty-share"
sed -n '/^# >>> gap-tracked-red loader$/,/^# <<< gap-tracked-red loader$/p' "$PULLSYNC_BIN" > "$W/loader.sh"
printf '[{"id":"g","status":"open","classification_metadata":{"evidence_resolve":{"shape":"test_suite","input":{"vessel":"v","test_file":"t.test.ts","only_tests":["probe"]}}}}]\n' > "$W/store.json"
out="$( PULLSYNC_SELF_DIR="$(dirname "$PULLSYNC_BIN")" PULLSYNC_SHARE_DIR="$W/empty-share" DEV_VESSEL="$W/store.json"
  # shellcheck disable=SC1091
  . "$W/loader.sh" >/dev/null 2>&1
  printf 'lib=%s\n' "${GTR_LIB:-}"
  printf 'names=%s\n' "$(tracked_fail_names v t.test.ts 2>/dev/null | tr '\n' ' ')"
  printf 'match=%s\n' "$(gtr_select tracked probe '(fail) a > probe' 2>/dev/null)" )"
lib="$(printf '%s\n' "$out" | sed -n 's/^lib=//p')"
case "$lib" in
  "$CANDIDATE_DIR"/*) ;;
  *) echo "FAIL - the candidate pull-sync cannot source scripts/substrate/lib/gap-tracked-red.sh from its own archive (loaded: '${lib:-nothing}')"; exit 1 ;;
esac
printf '%s\n' "$out" | grep -qx 'names=probe ' || { echo "FAIL - the candidate's tracked_fail_names does not return a tracked name: $(printf '%s' "$out" | tr '\n' ' ')"; exit 1; }
printf '%s\n' "$out" | grep -qx 'match=(fail) a > probe' || { echo "FAIL - the candidate's gtr_select does not match a tracked leaf name"; exit 1; }
echo "ok - the candidate pull-sync sources its tracked-red predicate from its own archive"
exit 0
