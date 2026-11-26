# gap-check-stub.sh: local-tools' gap_check as a pull-sync test's curl stub answers it, for the harnesses that run the
# failing-test closer or generator. The caller sets T (its temp dir), DIR (the checkout) and FAKE (the fake bun's dir),
# and routes `gap_check` pointers to gap_check_stub from its curl().
# The answer: the fake bun runs the asked file, and each asked name's result is read
# from its output as the runner's report would give it (pass, fail, or absent). GC_REFUSE answers ran:false with that
# reason; GC_DOWN answers nothing; GC_REPORT forces every asked name's report result (the output left as it was);
# GC_SIGNALLED marks the run killed; GC_TRUNCATED says the output was cut to its end. Every ask is kept in gc-asks.txt.
gap_check_stub() {
  local p rc; p="$(printf '%s' "$1" | jq -c .pointer)"; echo "$p" >> "$T/gc-asks.txt"
  [ -n "${GC_DOWN:-}" ] && return 7
  [ -n "${GC_REFUSE:-}" ] && { jq -nc --arg why "$GC_REFUSE" '{content:{shape:"gapCheck",ran:false,passed:false,why:$why}}'; return 0; }
  (cd "$DIR" && "$FAKE/bun" test "./$(printf '%s' "$p" | jq -r .test_file)" > "$T/gc-out.txt" 2>&1); rc=$?
  jq -nc --argjson p "$p" --rawfile out "$T/gc-out.txt" --argjson rc "$rc" --arg force "${GC_REPORT:-}" --argjson sig "${GC_SIGNALLED:-false}" --argjson cut "${GC_TRUNCATED:-false}" '
    ($out | split("\n")) as $L
    | [$p.only_tests[] | . as $n | {key: $n, value: {result: (if $force != "" then $force elif ($L | index("(fail) " + $n)) then "fail"
        elif ($L | index("(pass) " + $n)) then "pass" else "absent" end)}}] | from_entries as $names
    | {content: {shape: "gapCheck", ran: true, passed: (($names | to_entries | all(.value.result == "pass")) and ($sig | not)),
        repo: $p.repo, head: $p.ref, test_file: $p.test_file, names: $names, exit_code: $rc, signalled: $sig, out: $out, truncated: $cut, uid: 65534}}'
}
