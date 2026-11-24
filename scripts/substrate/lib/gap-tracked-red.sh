# gap-tracked-red.sh — THE predicate "this red test is tracked by an OPEN gap's only_tests" (sourced).
#
# ONE IMPLEMENTATION, TWO CALLERS. scripts/substrate/substrate-pull-sync.sh (its test gate
# subtracts tracked names from the newly-failing set) and validation/scripts/run-glue-tests.sh
# (the pre-commit glue gate lets a tracked red glue test through) both source this file, and both
# read the same two record shapes into gtr_person_marked, so a red one exempts the other does too. A
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
# FAIL CLOSED. An unreadable source (no jq, curl failure, a wrong address, a file without both
# lists of rows) is reported by gtr_load_marked's exit status, and every caller treats it as "no
# name is tracked": the stricter gate stands. A wrong address is unreadable, never "zero gaps";
# rows read with no gap a person filed or marked are a source read, exempting nothing.
#
# A REFUSED CREDENTIAL IS NOT A VERDICT. The store is read with the node key. A 401 means the key
# is stale or wrong: an environment fault that says nothing about any test. gtr_load_marked prints
# `credential refused (401) — key stale?` on stderr and returns 2, distinct from 1, and callers
# report the verdict they could not reach as UNKNOWN (the glue runner) or hold (pull-sync), never
# as a red or a regression.
#
# Interface (no globals set, no exit, safe under set -u):
#   gtr_load_marked <src> <out-file>
#       src: an http(s):// discovery base, read by shape (POST <src>/resolve, timeout GTR_MAX_TIME
#            seconds) as pull-sync's gate reads it: gap rows as stored, and outcomes of role person;
#            or a JSON file {"gap": [rows], "outcome": [rows]}.
#       Writes gtr_person_marked's list (possibly empty) to <out-file>. Returns 0, 1 = unreadable,
#       or 2 = either read refused the credential (HTTP 401; the distinct line is on stderr).
#   gtr_tracked_names <loaded-file> <vessel> <files, newline-separated>
#       Prints the tracked names, one per line. Prints nothing on any error.
#   gtr_select tracked|untracked <tracked names, newline-sep.> <red lines, newline-sep.>
#       Prints the red lines that are (tracked) / are not (untracked) matched by a name.
#   gtr_person_marked <gap rows file> <outcome rows file> <out-file>
#       From records rows (gap rows as stored, and person outcomes), writes the OPEN gaps a person filed or
#       marked right as one JSON array in the loaded form (id, status, classification_metadata), for
#       gtr_tracked_names. Returns 0, or 1 when either input is not a list of rows.
#
# PERSON-MARKED (USER ruling 11-23, check-first reds exempt only by a person-marked gap). A gap a person filed is
# marked by its filing: its latest row (of role detector or person) is the person's and open, and its names are that
# row's. Such a gap's names are the filing's even when a person also marked an earlier detector row of it. A detector's gap is marked
# when its latest row of role detector is open, and the latest person verdict citing one of its rows (an
# outcome of role person, r 0 or 1, numeric seq) is r 1, every row of the gap has a numeric seq (as the held-gap release reads it), and cites a row written after the closer's latest
# mark (check_runnable false with names_absent: the named tests were absent, so a verdict before it judged
# other names). Records refuses a person row under any service key, so no vessel can mark a gap; a gap any
# vessel can write under the node key exempts nothing alone, nor does a person's r 0 (the test is wrong).


gtr_load_marked() {
  local src="${1:-}" out="${2:-}" d rc=0 s ptr raw code
  [ -n "$src" ] && [ -n "$out" ] || return 1
  command -v jq >/dev/null 2>&1 || return 1
  d="$(mktemp -d "${TMPDIR:-/tmp}/gtr-marked.XXXXXX" 2>/dev/null)" || return 1
  case "$src" in
    http://*|https://*)
      for s in gap outcome; do
        case "$s" in
          gap) ptr='{"type":"record_read","shape":"gap","stored":true}' ;;
          outcome) ptr='{"type":"record_read","shape":"outcome","where":{"role":"person"}}' ;;
        esac
        # The node key goes on stdin as a curl config, never argv. -w appends the HTTP status on its own line.
        raw="$({ if [ -n "${METABOB_API_KEY:-}" ]; then printf 'header = "Authorization: ApiKey %s"\n' "$METABOB_API_KEY"; fi; } \
          | curl -K - -s -w '\n%{http_code}' --max-time "${GTR_MAX_TIME:-30}" -X POST "${src%/}/resolve" -H 'Content-Type: application/json' \
          -d "{\"pointer\":$ptr}" 2>/dev/null)" || { rc=1; break; }
        code=""
        case "$raw" in *$'\n'[0-9][0-9][0-9]) code="${raw##*$'\n'}"; raw="${raw%$'\n'*}" ;; esac
        if [ "$code" = 401 ]; then
          echo "credential refused (401) — key stale? records at ${src%/} refused the node key (METABOB_API_KEY $([ -n "${METABOB_API_KEY:-}" ] && echo set || echo unset); the key is never printed); tracked-red verdict unknown (environment), not red" >&2
          rc=2; break
        fi
        printf '%s' "$raw" | jq -c 'if type == "array" then . elif (.content | type) == "array" then .content else error("no rows") end' \
          > "$d/$s.json" 2>/dev/null || { rc=1; break; }
      done
      ;;
    *)
      if [ -f "$src" ] && [ -r "$src" ] && jq -c '.gap' "$src" > "$d/gap.json" 2>/dev/null && jq -c '.outcome' "$src" > "$d/outcome.json" 2>/dev/null; then :; else rc=1; fi
      ;;
  esac
  [ "$rc" -eq 0 ] && { gtr_person_marked "$d/gap.json" "$d/outcome.json" "$out" || rc=1; }
  rm -rf "${d:?}"
  [ "$rc" -eq 0 ] || : > "$out"
  return "$rc"
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

gtr_person_marked() {
  [ -r "${1:-}" ] && [ -r "${2:-}" ] && [ -n "${3:-}" ] || return 1
  command -v jq >/dev/null 2>&1 || return 1
  jq -e 'type == "array"' "$1" >/dev/null 2>&1 && jq -e 'type == "array"' "$2" >/dev/null 2>&1 || return 1
  jq -cn --slurpfile rows "$1" --slurpfile outs "$2" '
      ($outs[0] | map(select(.role == "person" and (.r == 0 or .r == 1) and (.seq | type) == "number"))) as $o
      | [$rows[0] | map(select(.shape == "gap" and (.role == "detector" or .role == "person"))) | group_by(.gap_id)[]
        | select(all(.[]; (.seq | type) == "number")) | sort_by(.seq) | .[-1] | select(.role == "person" and .status == "open")
        | {id: .gap_id, status: "open", classification_metadata: (.meta // {})}]
      + [$rows[0] | map(select(.shape == "gap" and .role == "detector")) | group_by(.gap_id)[]
        | select(all(.[]; (.seq | type) == "number")) | sort_by(.seq) as $all | $all[-1] as $g | select($g.status == "open")
        | ([$all | to_entries[] | select((.value.check_runnable == false or .value.meta.check_runnable == false) and .value.meta.names_absent != null) | .key] | last) as $mark
        | [$all | to_entries[] | select($mark == null or .key > $mark) | .value.id | tostring] as $ids
        | ([$o[] | select([(.input_refs // [])[] | tostring] | any(. as $x | $ids | index($x)))] | sort_by(.seq) | last) as $by
        | select($by != null and $by.r == 1)
        | {id: $g.gap_id, status: "open", classification_metadata: ($g.meta // {})}]
      | unique_by(.id)' > "$3" 2>/dev/null || { : > "$3"; return 1; }
}
