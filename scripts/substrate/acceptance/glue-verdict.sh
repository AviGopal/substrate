# glue-verdict.sh — the acceptance check of a glue-test run, from the runner's summary.
# Sourced by run-acceptance.sh.
#
# run-glue-tests.sh prints one line per test (PASS/FAIL/SKIP/…, a duration or "-", the
# test's name, then a reason in parentheses). A skip is never a pass: in gating mode a run
# that skipped any test fails the check, because what it skipped was not judged. In
# report-only mode the skips are recorded and the exit status decides.
glue_verdict() { # <runner output file> <runner exit status> <mode> -> {result, exit, failed, skipped}
  local out="$1" rc="$2" mode="$3" failed skipped r=fail
  failed="$(sed -n 's/^FAIL  *[^ ]*  \([^ ]*\)  (exit.*/\1/p' "$out" | jq -R . | jq -sc .)"
  skipped="$(sed -n 's/^SKIP  *[^ ]*  \([^ ]*\)  (.*/\1/p' "$out" | jq -R . | jq -sc .)"
  [ "$rc" -eq 0 ] && r=pass
  [ "$mode" = gating ] && [ "$skipped" != "[]" ] && r=fail
  jq -nc --arg r "$r" --argjson rc "$rc" --argjson f "$failed" --argjson s "$skipped" \
    '{result: $r, exit: $rc, failed: $f, skipped: $s}'
}
