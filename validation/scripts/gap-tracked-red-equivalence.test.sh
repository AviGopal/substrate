#!/usr/bin/env bash
# The shared tracked-red predicate (scripts/substrate/lib/gap-tracked-red.sh) behaves exactly as
# pull-sync's ORIGINAL inline implementation, checked hermetically on every run: a future edit to
# the lib that changes what pull-sync exempts fails here, not on a node.
#
# THE REFERENCE is embedded below VERBATIM from scripts/substrate/substrate-pull-sync.sh at
# 1a4f4202a404f1f7e22d0c10b245a09366f34baa (the last commit before the extraction):
# tracked_fail_names() and the two gate lines that partitioned CONF_SET with awk. Do not edit
# it to make a lib change pass; a deliberate semantic change replaces this test's verdicts.
#
#   names      the reference vs pull-sync's current loader (sourced from this tree, same curl
#              stub) over a synthetic store (repos/ prefixes, blank/non-string only_tests,
#              string classification_metadata, non-object rows, closed/reopened/"Open" rows, a
#              shape mismatch, missing fields, a non-array only_tests) x vessels x file lists
#   request    both send the byte-identical resolver request, except that the lib's request leads
#              with `-K -`: the node key travels as a curl config on stdin (every resolve call sends
#              a credential; resolve-writers-send-credentials P7). The data requested is unchanged.
#   file kind  gtr_load on the RAW store file (no resolver filter) gives the same names
#   matcher    the reference awk pair vs gtr_select over 48+ adversarial name/line sets
#   unreachable curl failing, garbage, an error JSON, an HTML 500 and empty output: both empty
#
# usage: validation/scripts/gap-tracked-red-equivalence.test.sh
# Needs bash, jq, awk, sed.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PS="$ROOT/scripts/substrate/substrate-pull-sync.sh"
T="$(mktemp -d "${TMPDIR:-/tmp}/gtr-equiv.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0
ok()  { echo "ok   - $*"; }
bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }

# ── THE REFERENCE (verbatim, 1a4f4202) ─────────────────────────────────────────
cat > "$T/ref.sh" <<'REF'
tracked_fail_names() {
  local files
  files="$(printf '%s\n' "$2" | jq -R -s -c 'split("\n") | map(select(length > 0))' 2>/dev/null || echo '[]')"
  curl -s --max-time 30 -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' \
    -d '{"impulse":{"pointer":{"type":"substrateGap","status":"open","limit":5000}}}' 2>/dev/null \
  | jq -r --arg v "$1" --argjson files "$files" '(.body.gaps // [])[] | .classification_metadata.evidence_resolve? // empty | select(.shape? == "test_suite") | select(((.input.vessel // "") | sub("^repos/"; "")) == $v) | select((.input.test_file // "") as $tf | $files | index($tf)) | (.input.only_tests // [])[] | select(type == "string" and test("\\S"))' 2>/dev/null || true
}
ref_partition() {
            SUBTRACTED="$(printf '%s\n' "${CONF_SET:-}" | awk -v names="$TRACKED" 'BEGIN{n=split(names,T,"\n")} $0=="" {next} {hit=0; for(i=1;i<=n;i++){ if(T[i]!="" && !used[i] && ((length($0)>=length(T[i])+3 && substr($0,length($0)-length(T[i])-2)==" > " T[i]) || $0=="(fail) " T[i] || $0=="✗ " T[i])){used[i]=1; hit=1; break} } if(hit) print}' || true)"
            UNTRACKED="$(printf '%s\n' "${CONF_SET:-}" | awk -v names="$TRACKED" 'BEGIN{n=split(names,T,"\n")} $0=="" {next} {hit=0; for(i=1;i<=n;i++){ if(T[i]!="" && !used[i] && ((length($0)>=length(T[i])+3 && substr($0,length($0)-length(T[i])-2)==" > " T[i]) || $0=="(fail) " T[i] || $0=="✗ " T[i])){used[i]=1; hit=1; break} } if(!hit) print}' || true)"
}
REF

# ── the current implementation: pull-sync's own loader block ───────────────────
sed -n '/^# >>> gap-tracked-red loader$/,/^# <<< gap-tracked-red loader$/p' "$PS" > "$T/new.sh"
grep -q 'tracked_fail_names()' "$T/new.sh" || { echo "FAIL - could not extract pull-sync's gap-tracked-red loader"; exit 1; }

# ── fixture store (synthetic; the shape of gaps/gaps.json rows) ────────────────
er() { # id status vessel test_file only_tests-json [shape]
  jq -n -c --arg id "$1" --arg s "$2" --arg v "$3" --arg f "$4" --argjson o "$5" --arg sh "${6:-test_suite}" \
    '{id:$id,status:$s,classification_metadata:{evidence_resolve:{shape:$sh,input:{vessel:$v,test_file:$f,only_tests:$o}}}}'
}
{
  echo '['
  er g01 open repos/demo test/a.test.ts '["alpha","describe > beta"," ","",7,null,"gamma"]'; echo ,
  er g02 open demo test/b.test.ts '["delta","alpha"]'; echo ,
  er g03 open other test/a.test.ts '["epsilon"]'; echo ,
  er g04 open demo test/a.test.ts '["zeta"]' not_test_suite; echo ,
  er g05 closed demo test/a.test.ts '["theta-closed"]'; echo ,
  er g06 reopened demo test/a.test.ts '["iota-reopened"]'; echo ,
  er g07 Open demo test/a.test.ts '["kappa-Open"]'; echo ,
  er g08 open repos/repos/demo test/a.test.ts '["lambda-double-prefix"]'; echo ,
  er g09 open demo "" '["mu-no-file"]'; echo ,
  er g10 open "" test/a.test.ts '["nu-no-vessel"]'; echo ,
  er g11 open demo test/a.test.ts '["alpha","xi > leaf"]'; echo ,
  er g12 open activity-api src/x.test.ts '["omicron"]'; echo ,
  echo '{"id":"g13","status":"open","classification_metadata":"free text"},'
  echo '{"id":"g14","status":"open"},'
  echo '{"id":"g15","status":"open","classification_metadata":{"evidence_resolve":"not an object"}},'
  echo '{"id":"g16","status":"open","classification_metadata":{"evidence_resolve":{"shape":"test_suite","input":{"vessel":"demo","test_file":"test/a.test.ts"}}}},'
  echo '{"id":"g17","status":"open","classification_metadata":{"evidence_resolve":{"shape":"test_suite"}}},'
  echo '"a-string-row",'
  echo '{"id":"g18","classification_metadata":{"evidence_resolve":{"shape":"test_suite","input":{"vessel":"demo","test_file":"test/a.test.ts","only_tests":["pi-no-status"]}}}},'
  er g19 open demo test/c.test.ts '"rho-not-an-array"'
  echo ']'
} > "$T/store.json"
jq -e 'length == 20' "$T/store.json" >/dev/null || { echo "FAIL - the fixture store does not parse"; exit 1; }
# The substrateGap resolver's read, modelled: status === "open" (strict), as substrate-gap.ts filters.
jq -c '{shape:"substrateGap",body:{gaps:[.[] | objects | select(.status == "open")]}}' "$T/store.json" > "$T/resp.json"

# One curl stub for both (both call `curl` by name, in-process): logs its args, answers $RESP_MODE.
RESP_MODE=ok
curl() {
  printf '%s\n' "$*" >> "$CURL_LOG"
  case "$RESP_MODE" in
    ok) cat "$T/resp.json" ;;
    fail) return 7 ;;
    garbage) echo 'not json at all' ;;
    error) echo '{"error":"use_vessel_discovery","shape":"substrateGap"}' ;;
    html) printf '<html><body>500 Internal Server Error</body></html>' ;;
    empty) : ;;
  esac
}
DEV_VESSEL=http://stub.invalid
ref_names() { ( CURL_LOG="$T/curl-ref.log"; . "$T/ref.sh"; tracked_fail_names "$1" "$2" ); }
new_names() { ( CURL_LOG="$T/curl-new.log"; PULLSYNC_SELF_DIR="$ROOT/scripts/substrate" PULLSYNC_SHARE_DIR="$T/no-share"
  . "$T/new.sh" >/dev/null 2>&1; [ -n "$GTR_LIB" ] || { echo "NO-LIB"; return; }; tracked_fail_names "$1" "$2" ); }
file_names() { ( PULLSYNC_SELF_DIR="$ROOT/scripts/substrate" PULLSYNC_SHARE_DIR="$T/no-share"
  . "$T/new.sh" >/dev/null 2>&1; gtr_load "$T/store.json" "$T/loaded.json" && gtr_tracked_names "$T/loaded.json" "$1" "$2" ); }

# ── names ──────────────────────────────────────────────────────────────────────
: > "$T/curl-ref.log"; : > "$T/curl-new.log"
FILESETS=("test/a.test.ts" "test/b.test.ts" "$(printf 'test/a.test.ts\ntest/b.test.ts')" "" "$(printf '\ntest/a.test.ts\n\n')" "unrelated.ts" "test/c.test.ts" "src/x.test.ts" "test/a.test.t")
n=0; d=0; fd=0; nonempty=0
for v in demo other activity-api "" repos/demo; do
  for files in "${FILESETS[@]}"; do
    a="$(ref_names "$v" "$files")"; b="$(new_names "$v" "$files")"; c="$(file_names "$v" "$files")"; n=$((n+1))
    [ -n "$a" ] && nonempty=$((nonempty+1))
    [ "$a" = "$b" ] || { d=$((d+1)); echo "    DIFF resolver v='$v' files='$(printf '%s' "$files" | tr '\n' ',')': ref=[$(printf '%s' "$a" | tr '\n' ',')] new=[$(printf '%s' "$b" | tr '\n' ',')]"; }
    [ "$a" = "$c" ] || { fd=$((fd+1)); echo "    DIFF file v='$v' files='$(printf '%s' "$files" | tr '\n' ',')': ref=[$(printf '%s' "$a" | tr '\n' ',')] file=[$(printf '%s' "$c" | tr '\n' ',')]"; }
  done
done
[ "$nonempty" -ge 5 ] && ok "names: the fixture exercises tracked names ($nonempty of $n calls return some)" || bad "names: only $nonempty of $n calls return names — the fixture checks nothing"
[ "$d" = 0 ] && ok "names: reference = pull-sync's current tracked_fail_names on all $n calls" || bad "names: $d of $n calls differ"
[ "$fd" = 0 ] && ok "file kind: gtr_load on the raw store gives the reference's names on all $n calls" || bad "file kind: $fd of $n calls differ"
[ "$(ref_names demo test/a.test.ts | tr '\n' ',')" = "alpha,describe > beta,gamma,alpha,xi > leaf," ] && ok "names: the reference sees what it should (positive control)" || bad "names: reference control gave '$(ref_names demo test/a.test.ts | tr '\n' ',')'"

# ── request ────────────────────────────────────────────────────────────────────
# The only permitted difference is the credential carrier: every new request leads with `-K -`.
[ -s "$T/curl-new.log" ] && ! grep -qv '^-K - ' "$T/curl-new.log" \
  && ok "request: the lib sends its credential as a curl config on stdin (-K -) on every request" \
  || bad "request: a lib request without the leading -K - credential carrier: [$(grep -v '^-K - ' "$T/curl-new.log" | sort -u)]"
[ -s "$T/curl-ref.log" ] && cmp -s <(sort -u "$T/curl-ref.log") <(sed 's/^-K - //' "$T/curl-new.log" | sort -u) \
  && ok "request: byte-identical resolver request apart from -K - ($(sort -u "$T/curl-ref.log" | head -1 | cut -c1-60)...)" || bad "request differs: ref=[$(sort -u "$T/curl-ref.log")] new=[$(sort -u "$T/curl-new.log")]"

# ── unreachable ────────────────────────────────────────────────────────────────
for RESP_MODE in fail garbage error html empty; do
  a="$(ref_names demo test/a.test.ts; echo "rc=$?")"; b="$(new_names demo test/a.test.ts; echo "rc=$?")"
  [ "$a" = "rc=0" ] && [ "$b" = "rc=0" ] && ok "unreachable ($RESP_MODE): both return no names, rc 0" || bad "unreachable ($RESP_MODE): ref=[$a] new=[$b]"
done
RESP_MODE=ok

# ── matcher ────────────────────────────────────────────────────────────────────
( . "$T/ref.sh"; PULLSYNC_SELF_DIR="$ROOT/scripts/substrate" PULLSYNC_SHARE_DIR="$T/no-share"; . "$T/new.sh" >/dev/null 2>&1
  NAMESETS=("broke" "a > broke" "$(printf 'broke\nbroke')" "x" "" "$(printf 'works\nbroke')" "$(printf 'describe > test\nleaf')" "✗ odd" "$(printf 'a.b\n[x]')")
  LINESETS=("(fail) new > broke" "(fail) broke" "✗ broke" "$(printf '(fail) a > broke\n(fail) b > broke')" "(fail) unbroke" "(fail) new > broken"
            "$(printf '(fail) a > broke\n(fail) other > x\n✗ x')" "" "(fail) describe > test" "$(printf 'x > describe > test\n(fail) q > leaf')" "(fail) axb > a.b" "(fail) a.b" "(fail) [x]" "✗ ✗ odd")
  m=0; md=0
  for TRACKED in "${NAMESETS[@]}"; do for CONF_SET in "${LINESETS[@]}"; do
    unset SUBTRACTED UNTRACKED; ref_partition
    nt="$(gtr_select tracked "$TRACKED" "$CONF_SET")"; nu="$(gtr_select untracked "$TRACKED" "$CONF_SET")"
    m=$((m+1))
    { [ "${SUBTRACTED-UNSET}" = "$nt" ] && [ "${UNTRACKED-UNSET}" = "$nu" ]; } || { md=$((md+1)); echo "    DIFF names=[$TRACKED] lines=[$CONF_SET] ref=[${SUBTRACTED-UNSET}|${UNTRACKED-UNSET}] new=[$nt|$nu]"; }
  done; done
  TRACKED=broke CONF_SET='(fail) new > broke'; unset SUBTRACTED; ref_partition
  [ "${SUBTRACTED-UNSET}" = '(fail) new > broke' ] || { echo "    the reference matcher did not run (positive control)"; md=$((md+1)); }
  echo "MATCHER $m $md" ) > "$T/matcher.txt" 2>&1
sed -n '/^    /p' "$T/matcher.txt"
read -r _ M MD < <(grep '^MATCHER ' "$T/matcher.txt")
[ "${M:-0}" -ge 48 ] && [ "${MD:-1}" = 0 ] && ok "matcher: reference awk = gtr_select on all $M name/line sets (reference positive control ran)" || bad "matcher: ${MD:-?} of ${M:-?} sets differ"

echo; [ "$FAILS" = 0 ] && { echo "PASS"; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
