# gap-tracked-red.sh — THE predicate "this red test is tracked by an OPEN gap's only_tests" (sourced).
#
# ONE IMPLEMENTATION, TWO CALLERS. scripts/substrate/substrate-pull-sync.sh (its test gate
# subtracts tracked names from the newly-failing set) and validation/scripts/run-glue-tests.sh
# (the pre-commit glue gate lets a tracked red glue test through) both source this file. A
# second hand-written copy is the failure class this file exists to prevent: two copies of
# one predicate drift, and the gate that drifted stops meaning what its log says.
# validation/scripts/gap-tracked-red-shared.test.sh proves both callers reach these functions.
#
# WHAT IS TRACKED. A gap is tracked-red evidence when ALL hold:
#   - status is exactly "open" (the substrateGap resolver's own status filter is strict
#     equality, so "Open", "reopened", "resolved", "closed" are NOT open here either);
#   - classification_metadata.evidence_resolve.shape == "test_suite";
#   - evidence_resolve.input.vessel, with any "repos/" prefix removed, equals the caller's vessel;
#   - evidence_resolve.input.test_file is one of the caller's files;
#   - the name is a non-blank string in evidence_resolve.input.only_tests.
# The CALLER chooses the files: pull-sync passes the files its candidate commit changed (a
# check-first landing touches its check file; a tracked test broken by an UNRELATED change still
# counts as a regression). The glue runner passes the red test's own file.
#
# GLUE TEST NAMES. A glue test (validation/scripts/<f>.test.sh) names a failing case by printing
# a line "FAIL - <label>" (the ok/bad convention of validation/scripts/lib/gate-test-lib.sh).
# The case's test name is <label>, scoped by its file. A gap that tracks it carries:
#   classification_metadata.evidence_resolve = {shape: "test_suite", input: {vessel: "super-repo",
#     test_file: "validation/scripts/<f>.test.sh", only_tests: ["<label>"]}}
# — the same shape as a vessel's bun-test gap, which is the point of one predicate. The label
# must be static text: a label that interpolates a measured value changes when the value does
# and then no longer matches. The runner displays a case as <f>.test.sh::<label>.
#
# NAME MATCHING (gtr_select) is pull-sync's rule, unchanged: a red line matches a tracked name
# when it ENDS with " > <name>" (a bun leaf name) or IS "(fail) <name>" / "✗ <name>"; never by
# substring. Each tracked name matches at most ONE red line, so a name shared by two cases
# cannot hide the second one. Glue labels are fed as "(fail) <label>".
#
# FAIL CLOSED. An unreadable store (no jq, curl failure, a wrong address, a file that does not
# parse to an array) is reported by gtr_load's exit status, and every caller treats it as "no
# name is tracked": the stricter gate stands. A wrong address is unreadable, never "zero gaps".
#
# A REFUSED CREDENTIAL IS NOT A VERDICT. The store is read with the node key. A 401 means the key
# is stale or wrong: an environment fault that says nothing about any test. gtr_load prints
# `credential refused (401) — key stale?` on stderr and returns 2, distinct from 1, and callers
# report the verdict they could not reach as UNKNOWN (the glue runner) or hold (pull-sync), never
# as a red or a regression.
#
# Interface (no globals set, no exit, safe under set -u):
#   gtr_load <src> <out-file>
#       src: a JSON file (a flat array of gaps, as gaps/gaps.json; or {gaps:[...]}; or a
#            resolver response {shape:"substrateGap", body:{gaps:[...]}}), or an http(s)://
#            development-vessel base, read with the substrateGap resolver
#            (status "open", limit GTR_LIMIT, timeout GTR_MAX_TIME seconds).
#       Writes the OPEN gaps as one JSON array to <out-file>. Returns 0, 1 = unreadable, or
#       2 = the store refused the credential (HTTP 401; the distinct line is on stderr).
#   gtr_tracked_names <loaded-file> <vessel> <files, newline-separated>
#       Prints the tracked names, one per line. Prints nothing on any error.
#   gtr_select tracked|untracked <tracked names, newline-sep.> <red lines, newline-sep.>
#       Prints the red lines that are (tracked) / are not (untracked) matched by a name.

GTR_LIMIT="${GTR_LIMIT:-5000}"

gtr_load() {
  local src="${1:-}" out="${2:-}" raw code
  [ -n "$src" ] && [ -n "$out" ] || return 1
  command -v jq >/dev/null 2>&1 || return 1
  case "$src" in
    http://*|https://*)
      # The store is read with the node key when one is set (on stdin as a curl config, never argv):
      # every resolve route validates its caller, and an anonymous read can come back empty.
      # -w appends the HTTP status on its own line; output without a 3-digit last line is all body.
      raw="$({ if [ -n "${METABOB_API_KEY:-}" ]; then printf 'header = "Authorization: ApiKey %s"\n' "$METABOB_API_KEY"; fi; } \
        | curl -K - -s -w '\n%{http_code}' --max-time "${GTR_MAX_TIME:-30}" -X POST "${src%/}/v2/impulses/resolve" -H 'Content-Type: application/json' \
        -d "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap\",\"status\":\"open\",\"limit\":$GTR_LIMIT}}}" 2>/dev/null)" || return 1
      code=""
      case "$raw" in
        *$'\n'[0-9][0-9][0-9]) code="${raw##*$'\n'}"; raw="${raw%$'\n'*}" ;;
      esac
      if [ "$code" = 401 ]; then
        echo "credential refused (401) — key stale? the gap store at ${src%/} refused the node key (METABOB_API_KEY $([ -n "${METABOB_API_KEY:-}" ] && echo set || echo unset); the key is never printed); tracked-red verdict unknown (environment), not red" >&2
        : > "$out"; return 2
      fi
      ;;
    *)
      [ -f "$src" ] && [ -r "$src" ] || return 1
      raw="$(cat "$src" 2>/dev/null)" || return 1
      ;;
  esac
  printf '%s' "$raw" | jq -c '
    if type == "array" then .
    elif type == "object" and (.shape? == "substrateGap") and ((.body.gaps? | type) == "array") then .body.gaps
    elif type == "object" and ((.gaps? | type) == "array") then .gaps
    else error("not a gap store") end
    | [ .[] | select(type == "object" and .status? == "open") ]' > "$out" 2>/dev/null || { : > "$out"; return 1; }
  [ -s "$out" ] || return 1
  return 0
}

gtr_tracked_names() {
  local files
  [ -r "${1:-}" ] || return 0
  files="$(printf '%s\n' "${3:-}" | jq -R -s -c 'split("\n") | map(select(length > 0))' 2>/dev/null || echo '[]')"
  jq -r --arg v "${2:-}" --argjson files "$files" '.[] | .classification_metadata.evidence_resolve? // empty | select(.shape? == "test_suite") | select(((.input.vessel // "") | sub("^repos/"; "")) == $v) | select((.input.test_file // "") as $tf | $files | index($tf)) | (.input.only_tests // [])[] | select(type == "string" and test("\\S"))' "$1" 2>/dev/null || true
}

gtr_select() {
  local want
  case "${1:-}" in tracked) want=1 ;; untracked) want=0 ;; *) return 2 ;; esac
  printf '%s\n' "${3:-}" | awk -v names="${2:-}" -v want="$want" 'BEGIN{n=split(names,T,"\n")} $0=="" {next} {hit=0; for(i=1;i<=n;i++){ if(T[i]!="" && !used[i] && ((length($0)>=length(T[i])+3 && substr($0,length($0)-length(T[i])-2)==" > " T[i]) || $0=="(fail) " T[i] || $0=="✗ " T[i])){used[i]=1; hit=1; break} } if(hit==want) print}' || true
}
